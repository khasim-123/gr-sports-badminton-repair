"""Shop: T-shirts & apparel catalogue, cart price checks and online orders.

Public (no login):
  GET  /shop/apparel                 active apparel, featured first (computed inStock / sizes / colours)
  POST /shop/quote                   current prices, availability and delivery charge for a cart
Customers (and the admin):
  POST /orders                       customers only; a registered customer with a name
  GET  /orders, GET /orders/{id}     customers see their own orders, the admin sees every order
  POST /orders/{id}/cancel           customer while Placed / Confirmed; admin until delivered / picked up
Admin:
  PATCH /orders/{id}/status, POST /orders/{id}/payment, apparel catalogue CRUD under /shop/admin

What can be bought: apparel (a size + colour variant with a stock count), rackets (price set and
in stock) and string sets (price set, colour variant in stock). Prices always come from the
database — the browser's cart only says what and how many. Orders keep a snapshot of every item
(name, size / colour, price, photo), so later catalogue edits or deleted products don't change
past orders. Payment is collected on delivery or at the shop (Cash / UPI), like service bookings.
Notifications about an order use the order id as their requestId, so the customer who placed
it (and only them) sees them.
"""
import math
import random
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import (
    ApparelProductModel,
    ApparelVariantModel,
    CustomerModel,
    OrderModel,
    RacketModel,
    StringProductModel,
)
from app.routers.requests import _distance_config
from app.schemas import (
    ApparelProductCreate,
    ApparelProductSchema,
    ApparelProductUpdate,
    ApparelVariantCreate,
    ApparelVariantSchema,
    ApparelVariantUpdate,
    CartLineInput,
    OrderAddressSchema,
    OrderCancelInput,
    OrderPaymentInput,
    OrderQuoteSchema,
    OrderStatusUpdate,
    PlaceOrderInput,
    QuoteInput,
    ShopOrderSchema,
)
from app.security import CurrentUser, get_current_user, rate_limit, rate_limiter, require_admin
from app.services.content_service import BUSINESS_TZ, clean_mrp, new_id, now_iso, validate_link
from app.services.notification_service import create_notification, log_audit
from app.services.pricing_service import calculate_delivery_charge, road_distance_km, valid_coordinates
from app.services.shop_settings import display_phone as shop_display_phone, get_shop_settings
from app.services.sms_service import display_phone

router = APIRouter(tags=["Shop"])

# Catalogue limits
NAME_MIN, NAME_MAX = 2, 80
DESCRIPTION_MAX = 1000
FABRIC_MAX = 120
FIT_MAX = 60
PRICE_MAX = 100_000
IMAGES_MAX = 6
LINK_MAX = 500
SIZE_MAX = 20
COLOUR_MAX = 30
SKU_MAX = 40
STOCK_MAX = 10_000
SORT_ORDER_MAX = 100_000
HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

# Cart / order limits
MAX_QTY = 10
MAX_LINES = 20
NOTES_MAX = 300
ORDERS_PER_HOUR = 10  # per customer
PINCODE_RE = re.compile(r"^\d{6}$")

PRICE_ON_REQUEST = "Price on request — ask us on WhatsApp"
OUT_OF_STOCK = "Out of stock"
NOT_AVAILABLE = "No longer available"

# Order status flow (admin). Recording the payment while Out for Delivery / Ready for Pickup
# also completes the order; Delivered / Picked Up need the payment recorded first.
NEXT_STATUS = {
    ("delivery", "Placed"): "Confirmed",
    ("delivery", "Confirmed"): "Packed",
    ("delivery", "Packed"): "Out for Delivery",
    ("delivery", "Out for Delivery"): "Delivered",
    ("pickup", "Placed"): "Confirmed",
    ("pickup", "Confirmed"): "Packed",
    ("pickup", "Packed"): "Ready for Pickup",
    ("pickup", "Ready for Pickup"): "Picked Up",
}
COMPLETES_ON_PAYMENT = {"Out for Delivery": "Delivered", "Ready for Pickup": "Picked Up"}
CUSTOMER_CANCELLABLE = ("Placed", "Confirmed")
ADMIN_CANCELLABLE = ("Placed", "Confirmed", "Packed", "Out for Delivery", "Ready for Pickup")

STATUS_LABELS = {
    "Placed": "Order placed online",
    "Confirmed": "Order confirmed",
    "Packed": "Order packed",
    "Out for Delivery": "Out for delivery",
    "Ready for Pickup": "Ready for pickup at the shop",
    "Delivered": "Delivered",
    "Picked Up": "Picked up from the shop",
    "Cancelled": "Order cancelled",
}
CUSTOMER_MESSAGES = {
    "Confirmed": "Your order {id} is confirmed.",
    "Packed": "Your order {id} is packed.",
    "Out for Delivery": "Your order {id} is out for delivery.",
    "Ready for Pickup": "Your order {id} is ready for pickup at the shop.",
    "Delivered": "Your order {id} has been delivered. Thank you!",
    "Picked Up": "Your order {id} has been picked up. Thank you!",
}


# ---------------- Helpers ----------------

def _bad(detail: str) -> HTTPException:
    return HTTPException(status_code=422, detail=detail)


def _text(value: Optional[str], label: str, max_len: int, required: bool = False, single_line: bool = True) -> Optional[str]:
    v = (value or "").strip()
    if single_line:
        v = " ".join(v.split())
    if not v:
        if required:
            raise _bad(f"{label} is required")
        return None
    if len(v) > max_len:
        raise _bad(f"{label} must be at most {max_len} characters")
    return v


def _rupees(amount: float) -> str:
    amount = float(amount or 0)
    return f"₹{amount:,.0f}" if amount.is_integer() else f"₹{amount:,.2f}"


def _display_time() -> str:
    """Timeline time in the shop's time zone, e.g. "25 Oct 2026, 04:30 PM"."""
    return datetime.now(BUSINESS_TZ).strftime("%d %b %Y, %I:%M %p")


def _shop_phone(db: Session) -> str:
    return shop_display_phone(get_shop_settings(db).get("phone") or "")


def _plural(n: int, word: str) -> str:
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


# ---------------- Apparel: serialisation & validation ----------------

def serialize_apparel(product: ApparelProductModel) -> ApparelProductSchema:
    variants = list(product.variants or [])
    sizes: List[str] = []
    seen_sizes = set()
    colours: List[Dict[str, Any]] = []
    seen_colours = set()
    for v in variants:
        if v.size.casefold() not in seen_sizes:
            seen_sizes.add(v.size.casefold())
            sizes.append(v.size)
        if v.colour.casefold() not in seen_colours:
            seen_colours.add(v.colour.casefold())
            colours.append({"colour": v.colour, "colourHex": v.colourHex})
    return ApparelProductSchema(
        id=product.id,
        name=product.name,
        category=product.category,
        description=product.description,
        fabric=product.fabric,
        fit=product.fit,
        price=product.price,
        mrp=product.mrp,
        images=list(product.images or []),
        customisable=bool(product.customisable),
        isFeatured=bool(product.isFeatured),
        isActive=bool(product.isActive),
        sortOrder=product.sortOrder or 0,
        createdAt=product.createdAt,
        variants=[ApparelVariantSchema.model_validate(v) for v in variants],
        inStock=any((v.stock or 0) > 0 for v in variants),
        sizes=sizes,
        colours=colours,
    )


def _sort_order(value: Optional[int]) -> Optional[int]:
    if value is None:
        return None
    if not (-SORT_ORDER_MAX <= value <= SORT_ORDER_MAX):
        raise _bad("Sort order is out of range")
    return value


def _clean_images(images: Optional[List[str]]) -> List[str]:
    images = list(images or [])
    if len(images) > IMAGES_MAX:
        raise _bad(f"Add at most {IMAGES_MAX} photos")
    cleaned: List[str] = []
    for url in images:
        url = (url or "").strip()
        if len(url) > LINK_MAX:
            raise _bad(f"Photo links must be at most {LINK_MAX} characters")
        url = validate_link(url or None, "Photo")
        if url and url not in cleaned:
            cleaned.append(url)
    return cleaned


def _clean_product(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validates a full set of product fields (create, or an update merged onto the stored product)."""
    d = dict(data)
    d["name"] = _text(d.get("name"), "Name", NAME_MAX, required=True)
    if len(d["name"]) < NAME_MIN:
        raise _bad(f"Name must be at least {NAME_MIN} characters")
    d["description"] = _text(d.get("description"), "Description", DESCRIPTION_MAX, single_line=False)
    d["fabric"] = _text(d.get("fabric"), "Fabric", FABRIC_MAX)
    d["fit"] = _text(d.get("fit"), "Fit", FIT_MAX)
    price = d.get("price")
    if price is None:
        raise _bad("Price is required")
    price = float(price)
    if not math.isfinite(price) or price <= 0:
        raise _bad("Price must be more than ₹0")
    if price > PRICE_MAX:
        raise _bad("Price must be at most ₹1,00,000")
    d["price"] = round(price, 2)
    d["mrp"] = clean_mrp(d.get("mrp"), d["price"])
    d["images"] = _clean_images(d.get("images"))
    for flag in ("customisable", "isFeatured", "isActive"):
        d[flag] = bool(d.get(flag))
    d["sortOrder"] = _sort_order(d.get("sortOrder"))
    return d


def _clean_variant(data: Dict[str, Any]) -> Dict[str, Any]:
    d = dict(data)
    d["size"] = _text(d.get("size"), "Size", SIZE_MAX, required=True)
    d["colour"] = _text(d.get("colour"), "Colour", COLOUR_MAX, required=True)
    hex_code = (d.get("colourHex") or "").strip()
    if hex_code and not HEX_RE.match(hex_code):
        raise _bad("Colour code must look like #1F2A44")
    d["colourHex"] = hex_code.upper() if hex_code else None
    stock = d.get("stock")
    stock = 0 if stock is None else stock
    if isinstance(stock, bool) or not isinstance(stock, int) or not (0 <= stock <= STOCK_MAX):
        raise _bad(f"Stock must be a whole number from 0 to {STOCK_MAX:,}")
    d["stock"] = stock
    d["sku"] = _text(d.get("sku"), "SKU", SKU_MAX)
    d["sortOrder"] = _sort_order(d.get("sortOrder"))
    return d


def _assert_unique_variant(product: ApparelProductModel, size: str, colour: str, exclude_id: Optional[str] = None) -> None:
    for v in product.variants:
        if v.id != exclude_id and v.size.casefold() == size.casefold() and v.colour.casefold() == colour.casefold():
            raise HTTPException(status_code=409, detail=f"{product.name} already has size {size} in {colour}")


def _get_apparel(db: Session, product_id: str) -> ApparelProductModel:
    product = (
        db.query(ApparelProductModel)
        .options(selectinload(ApparelProductModel.variants))
        .filter(ApparelProductModel.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


def _get_apparel_variant(db: Session, variant_id: str) -> ApparelVariantModel:
    variant = db.query(ApparelVariantModel).filter(ApparelVariantModel.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Size / colour not found")
    return variant


def _commit_variant(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:  # (size, colour) added at the same moment by another admin tab
        db.rollback()
        raise HTTPException(status_code=409, detail="That size and colour already exists for this product")


# ---------------- Public catalogue ----------------

@router.get("/shop/apparel", response_model=List[ApparelProductSchema])
def public_apparel(db: Session = Depends(get_db)):
    products = (
        db.query(ApparelProductModel)
        .options(selectinload(ApparelProductModel.variants))
        .filter(ApparelProductModel.isActive == True)  # noqa: E712
        .all()
    )
    products.sort(key=lambda p: (not p.isFeatured, p.sortOrder or 0, p.name.casefold()))
    return [serialize_apparel(p) for p in products]


# ---------------- Cart pricing (quote) ----------------

def _merge_lines(items: List[CartLineInput]) -> List[Dict[str, Any]]:
    """Validates quantities and merges repeated lines for the same item (keeps cart order)."""
    if len(items) > MAX_LINES:
        raise _bad(f"You can order at most {MAX_LINES} different items at once")
    merged: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    for item in items:
        if not (1 <= item.quantity <= MAX_QTY):
            raise _bad(f"Quantity must be between 1 and {MAX_QTY}")
        kind = (item.kind or "").strip().lower()
        product_id = item.productId.strip()
        variant_id = (item.variantId or "").strip() or None
        if kind == "racket":
            variant_id = None  # rackets have no variants
        key = (kind, product_id, variant_id or "")
        if key in merged:
            merged[key]["quantity"] += item.quantity
        else:
            merged[key] = {"kind": kind, "productId": product_id, "variantId": variant_id, "quantity": item.quantity}
    return list(merged.values())


def _string_name(product: StringProductModel) -> str:
    brand = (product.brand or "").strip()
    name = (product.name or "").strip()
    return name if not brand or name.lower().startswith(brand.lower()) else f"{brand} {name}"


def _describe_line(line: Dict[str, Any], apparel: Dict[str, ApparelProductModel], rackets: Dict[str, RacketModel],
                   strings: Dict[str, StringProductModel]) -> Dict[str, Any]:
    """Name, detail, current price and photo of one cart line — or the reason it can't be ordered."""
    kind, product_id, variant_id = line["kind"], line["productId"], line["variantId"]

    if kind == "apparel":
        product = apparel.get(product_id)
        if not product or not product.isActive:
            return {"name": product.name if product else None, "reason": NOT_AVAILABLE}
        if not variant_id:
            return {"name": product.name, "reason": "Choose a size and colour"}
        variant = next((v for v in product.variants if v.id == variant_id), None)
        if not variant:
            return {"name": product.name, "reason": "This size or colour is no longer available"}
        if product.price is None or product.price <= 0:
            return {"name": product.name, "reason": PRICE_ON_REQUEST}
        return {
            "name": product.name,
            "detail": f"{variant.size} · {variant.colour}",
            "unitPrice": float(product.price),
            "image": (product.images or [None])[0],
            "stock": variant.stock or 0,
            "size": variant.size,
        }

    if kind == "racket":
        racket = rackets.get(product_id)
        name = f"{racket.brand} {racket.name}".strip() if racket else None
        if not racket or not racket.isActive:
            return {"name": name, "reason": NOT_AVAILABLE}
        if racket.price is None or racket.price <= 0:
            return {"name": name, "reason": PRICE_ON_REQUEST}
        if not racket.inStock:
            return {"name": name, "reason": OUT_OF_STOCK}
        return {"name": name, "detail": None, "unitPrice": float(racket.price), "image": (racket.images or [None])[0]}

    if kind == "string":
        product = strings.get(product_id)
        name = _string_name(product) if product else None
        if not product or not product.isActive:
            return {"name": name, "reason": NOT_AVAILABLE}
        if product.price is None or product.price <= 0:
            return {"name": name, "reason": PRICE_ON_REQUEST}
        if not variant_id:
            return {"name": name, "reason": "Choose a colour"}
        variant = next((v for v in product.variants if v.id == variant_id), None)
        if not variant:
            return {"name": name, "reason": "This colour is no longer available"}
        if not variant.inStock:
            return {"name": name, "reason": OUT_OF_STOCK}
        return {"name": name, "detail": variant.colour, "unitPrice": float(product.price), "image": variant.imageUrl}

    return {"name": None, "reason": "This item can't be ordered online — ask us on WhatsApp"}


def _price_lines(db: Session, lines: List[Dict[str, Any]]):
    """Returns (orderable lines, unavailable lines, apparel stock moves [(variantId, qty, line)])."""
    ids: Dict[str, set] = {"apparel": set(), "racket": set(), "string": set()}
    for line in lines:
        if line["kind"] in ids:
            ids[line["kind"]].add(line["productId"])
    apparel = {
        p.id: p for p in db.query(ApparelProductModel)
        .options(selectinload(ApparelProductModel.variants))
        .filter(ApparelProductModel.id.in_(ids["apparel"])).all()
    } if ids["apparel"] else {}
    rackets = {
        r.id: r for r in db.query(RacketModel).filter(RacketModel.id.in_(ids["racket"])).all()
    } if ids["racket"] else {}
    strings = {
        s.id: s for s in db.query(StringProductModel)
        .options(selectinload(StringProductModel.variants))
        .filter(StringProductModel.id.in_(ids["string"])).all()
    } if ids["string"] else {}

    items: List[Dict[str, Any]] = []
    unavailable: List[Dict[str, Any]] = []
    stock_moves: List[Tuple[str, int, Dict[str, Any]]] = []
    for line in lines:
        info = _describe_line(line, apparel, rackets, strings)
        qty = line["quantity"]
        reason = info.get("reason")
        if reason is None and qty > MAX_QTY:
            reason = f"You can order at most {MAX_QTY} of this item"
        if reason is None and "stock" in info and qty > info["stock"]:
            reason = OUT_OF_STOCK if info["stock"] <= 0 else f"Only {info['stock']} left in {info['size']}"
        if reason:
            unavailable.append({
                "kind": line["kind"], "productId": line["productId"], "variantId": line["variantId"],
                "name": info.get("name"), "reason": reason,
            })
            continue
        order_line = {
            "kind": line["kind"],
            "productId": line["productId"],
            "variantId": line["variantId"],
            "name": info["name"],
            "detail": info.get("detail"),
            "unitPrice": info["unitPrice"],
            "quantity": qty,
            "lineTotal": round(info["unitPrice"] * qty, 2),
            "image": info.get("image"),
        }
        items.append(order_line)
        if line["kind"] == "apparel":
            stock_moves.append((line["variantId"], qty, {**order_line, "size": info["size"]}))
    return items, unavailable, stock_moves


def _delivery(db: Session, fulfilment: str, address: Optional[OrderAddressSchema], strict: bool):
    """Returns (address dict to store, delivery charge, distance km, outside delivery area, max km).
    The distance comes from the phone's location when given (never from a number the browser
    sends); otherwise the distance the customer entered is used (distanceSource 'customer')."""
    if fulfilment == "pickup":
        return None, 0.0, None, False, None
    if address is None:
        if strict:
            raise _bad("Add your delivery address")
        return None, 0.0, None, False, None

    addr = address.model_copy()
    for field in ("id", "houseFlat", "street", "area", "city", "state", "pincode", "landmark"):
        value = getattr(addr, field)
        if isinstance(value, str):
            setattr(addr, field, " ".join(value.split()))
    addr.pincode = addr.pincode.replace(" ", "")
    if strict:
        if not addr.houseFlat:
            raise _bad("Add your house / flat number")
        if not addr.area:
            raise _bad("Add your area")
        if not PINCODE_RE.match(addr.pincode):
            raise _bad("Pincode must be 6 digits")

    config = _distance_config(db)
    if addr.lat is not None or addr.lng is not None:
        if addr.lat is None or addr.lng is None or not valid_coordinates(addr.lat, addr.lng):
            raise _bad("Your location couldn't be read. Try 'Use my current location' again or enter the distance instead.")
        km = road_distance_km(config.shopLat, config.shopLng, addr.lat, addr.lng)
        addr.distanceSource = "location"
    else:
        km = float(addr.distanceKm or 0)
        if km < 0:
            raise _bad("Distance can't be negative")
        km = round(km, 1)
        addr.distanceSource = "customer"
    addr.distanceKm = km

    max_km = config.maxServiceDistanceKm or 0
    outside = bool(max_km and km > max_km)
    charge = float(calculate_delivery_charge(km, config)["charge"])
    return addr.model_dump(), charge, km, outside, max_km


def _build_quote(db: Session, items: List[CartLineInput], fulfilment: str, address: Optional[OrderAddressSchema], strict: bool):
    lines = _merge_lines(items)
    priced, unavailable, stock_moves = _price_lines(db, lines)
    address_data, charge, km, outside, max_km = _delivery(db, fulfilment, address, strict)
    subtotal = round(sum(line["lineTotal"] for line in priced), 2)
    quote = {
        "items": priced,
        "unavailable": unavailable,
        "subtotal": subtotal,
        "deliveryCharge": charge,
        "distanceKm": km,
        "total": round(subtotal + charge, 2),
        "outsideDeliveryArea": outside,
    }
    return quote, stock_moves, address_data, max_km


@router.post(
    "/shop/quote",
    response_model=OrderQuoteSchema,
    dependencies=[Depends(rate_limit("shop-quote", limit=120, window_seconds=60))],  # loose: shared mobile IPs
)
def quote_cart(payload: QuoteInput, db: Session = Depends(get_db)):
    quote, _, _, _ = _build_quote(db, payload.items, payload.fulfilment, payload.address, strict=False)
    return quote


# ---------------- Orders ----------------

def _unavailable_response(unavailable: List[Dict[str, Any]], just_now: bool = False) -> JSONResponse:
    parts = []
    for u in unavailable:
        parts.append(f"{u.get('name') or 'An item'}: {u['reason']}")
    lead = "Sorry, this just sold out" if just_now else "Some items in your cart can't be ordered right now"
    detail = f"{lead} — {'; '.join(parts)}. Please update your cart and try again."
    return JSONResponse(status_code=409, content={"detail": detail, "unavailable": unavailable})


def _new_order_id(db: Session) -> str:
    for attempt in range(60):
        digits = 5 if attempt < 40 else 6
        candidate = f"ORD-{random.randint(10 ** (digits - 1), 10 ** digits - 1)}"
        if not db.query(OrderModel.id).filter(OrderModel.id == candidate).first():
            return candidate
    return f"ORD-{new_id('X')[2:]}"


def _require_order_access(user: CurrentUser) -> None:
    if user.is_staff and not user.is_admin:
        raise HTTPException(status_code=403, detail="Shop orders are handled by the admin")


def _load_order(db: Session, order_id: str, user: CurrentUser) -> OrderModel:
    """An order the user may see: customers only their own (404 otherwise), the admin any."""
    _require_order_access(user)
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order or (not user.is_admin and order.customerMobile != user.phone):
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def _append_timeline(order: OrderModel, status_: str, label: str, actor: str, notes: Optional[str] = None) -> None:
    timeline = list(order.timeline or [])
    timeline.append({"status": status_, "label": label, "timestamp": _display_time(), "actor": actor, "notes": notes})
    order.timeline = timeline


def _notify_customer(db: Session, order: OrderModel, type_: str, title: str, message: str) -> None:
    create_notification(db=db, type_=type_, title=title, message=message, request_id=order.id, target_roles=["CUSTOMER"])


def _stale(order_id: str) -> HTTPException:
    return HTTPException(status_code=409, detail=f"{order_id} was just changed by someone else. Refresh to see the latest status.")


@router.post("/orders", response_model=ShopOrderSchema, status_code=status.HTTP_201_CREATED)
def place_order(payload: PlaceOrderInput, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    if user.is_staff:
        raise HTTPException(status_code=403, detail="Orders are placed by customers from their own account")
    rate_limiter.check(f"shop-order:{user.phone}", ORDERS_PER_HOUR, 3600)
    customer = db.query(CustomerModel).filter(CustomerModel.phone == user.phone).first()
    customer_name = " ".join((customer.name or "").split()) if customer else ""
    if not customer_name:
        raise HTTPException(status_code=403, detail="Please add your name to your account before placing an order")
    if not payload.items:
        raise _bad("Your cart is empty")
    notes = _text(payload.notes, "Note", NOTES_MAX, single_line=False)

    # Re-priced here from the database: the browser's prices are never used.
    quote, stock_moves, address_data, max_km = _build_quote(db, payload.items, payload.fulfilment, payload.address, strict=True)
    if quote["unavailable"]:
        return _unavailable_response(quote["unavailable"])
    if not quote["items"]:
        raise _bad("Your cart is empty")
    if quote["outsideDeliveryArea"]:
        raise _bad(
            f"Sorry, we deliver within {max_km:g} KM of the shop (your address is about {quote['distanceKm']:g} KM away). "
            f"Please call {_shop_phone(db)} or choose pickup from the shop."
        )

    # Take the stock. Two customers buying the last piece at the same moment: only one
    # conditional UPDATE can match (the database re-checks stock >= qty under its row lock).
    for variant_id, qty, line in stock_moves:
        taken = (
            db.query(ApparelVariantModel)
            .filter(ApparelVariantModel.id == variant_id, ApparelVariantModel.stock >= qty)
            .update({ApparelVariantModel.stock: ApparelVariantModel.stock - qty}, synchronize_session=False)
        )
        if not taken:
            db.rollback()
            left = db.query(ApparelVariantModel.stock).filter(ApparelVariantModel.id == variant_id).scalar() or 0
            reason = OUT_OF_STOCK if left <= 0 else f"Only {left} left in {line['size']}"
            return _unavailable_response([{
                "kind": line["kind"], "productId": line["productId"], "variantId": line["variantId"],
                "name": line["name"], "reason": reason,
            }], just_now=True)

    order_id = _new_order_id(db)
    count = sum(line["quantity"] for line in quote["items"])
    if payload.fulfilment == "pickup":
        how = "Pickup from the shop."
    else:
        source = "from the customer's location" if address_data["distanceSource"] == "location" else "entered by the customer"
        charge = "free delivery" if quote["deliveryCharge"] <= 0 else f"delivery {_rupees(quote['deliveryCharge'])}"
        how = f"Delivery to {address_data['area']} ({quote['distanceKm']:g} KM, {source}; {charge})."
    order = OrderModel(
        id=order_id,
        customerName=customer_name,
        customerMobile=user.phone,
        createdAt=now_iso(),
        status="Placed",
        fulfilment=payload.fulfilment,
        address=address_data,
        distanceKm=quote["distanceKm"],
        items=quote["items"],
        subtotal=quote["subtotal"],
        deliveryCharge=quote["deliveryCharge"],
        total=quote["total"],
        paymentStatus="Pending",
        notes=notes,
        timeline=[{
            "status": "Placed",
            "label": STATUS_LABELS["Placed"],
            "timestamp": _display_time(),
            "actor": f"Customer ({customer_name})",
            "notes": f"{_plural(count, 'item')} · {_rupees(quote['total'])}. {how}",
        }],
    )
    db.add(order)
    try:
        db.commit()
    except IntegrityError:  # the same order number picked by two requests at once
        db.rollback()
        raise HTTPException(status_code=409, detail="Your order couldn't be saved. Please try again.")
    db.refresh(order)

    log_audit(db, customer_name, "CUSTOMER", f"Placed order ({_plural(count, 'item')}, {_rupees(order.total)})",
              order.id, f"{payload.fulfilment}; " + ", ".join(f"{l['quantity']} × {l['name']}" for l in order.items))
    create_notification(
        db=db,
        type_="new_request",
        title=f"New order {order.id}",
        message=f"New order {order.id}: {_plural(count, 'item')}, {_rupees(order.total)} — {customer_name}, {display_phone(user.phone)}",
        request_id=order.id,
        target_roles=["ADMIN"],
    )
    return order


@router.get("/orders", response_model=List[ShopOrderSchema])
def list_orders(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    _require_order_access(user)
    query = db.query(OrderModel)
    if not user.is_admin:
        query = query.filter(OrderModel.customerMobile == user.phone)
    return query.order_by(OrderModel.createdAt.desc(), OrderModel.id.desc()).all()


@router.get("/orders/{order_id}", response_model=ShopOrderSchema)
def get_order(order_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    return _load_order(db, order_id, user)


def _cancel(db: Session, order: OrderModel, user: CurrentUser, reason: Optional[str]) -> OrderModel:
    allowed = ADMIN_CANCELLABLE if user.is_admin else CUSTOMER_CANCELLABLE
    if order.status == "Cancelled":
        raise HTTPException(status_code=409, detail=f"{order.id} is already cancelled")
    if order.status not in allowed:
        if not user.is_admin and order.status in ADMIN_CANCELLABLE:
            raise HTTPException(
                status_code=409,
                detail=f"{order.id} is already {order.status.lower()}, so it can't be cancelled online. Please call us on {_shop_phone(db)}.",
            )
        raise HTTPException(status_code=409, detail=f"Can't cancel {order.id}: it is '{order.status}'.")

    claimed = (
        db.query(OrderModel)
        .filter(OrderModel.id == order.id, OrderModel.status == order.status)
        .update({OrderModel.status: "Cancelled"}, synchronize_session=False)
    )
    if not claimed:
        db.rollback()
        raise _stale(order.id)
    # Put the apparel back on the shelf (once: an order can only be cancelled once).
    for line in order.items or []:
        if line.get("kind") == "apparel" and line.get("variantId"):
            db.query(ApparelVariantModel).filter(ApparelVariantModel.id == line["variantId"]).update(
                {ApparelVariantModel.stock: ApparelVariantModel.stock + int(line.get("quantity") or 0)},
                synchronize_session=False,
            )
    by_customer = not user.is_staff
    order.status = "Cancelled"
    order.cancelReason = reason or ("Cancelled by the customer" if by_customer else "Cancelled by the shop")
    notes = reason
    if order.paymentStatus == "Paid":
        notes = " ".join(p for p in (reason, f"{_rupees(order.paidAmount or order.total)} was already paid — refund it to the customer.") if p)
    _append_timeline(
        order, "Cancelled", STATUS_LABELS["Cancelled"],
        f"Customer ({order.customerName})" if by_customer else user.label, notes,
    )
    db.commit()
    db.refresh(order)

    log_audit(db, order.customerName if by_customer else user.label, user.role, "Cancelled order", order.id, reason)
    if by_customer:
        create_notification(
            db=db, type_="status_update", title=f"Order {order.id} cancelled",
            message=f"{order.customerName} cancelled order {order.id}" + (f": {reason}" if reason else "."),
            request_id=order.id, target_roles=["ADMIN"],
        )
    else:
        _notify_customer(db, order, "status_update", f"Order {order.id} cancelled",
                         f"Your order {order.id} has been cancelled" + (f": {reason}" if reason else "."))
    return order


@router.post("/orders/{order_id}/cancel", response_model=ShopOrderSchema)
def cancel_order(order_id: str, payload: OrderCancelInput, db: Session = Depends(get_db),
                 user: CurrentUser = Depends(get_current_user)):
    order = _load_order(db, order_id, user)
    reason = _text(payload.reason, "Reason", NOTES_MAX, single_line=False)
    return _cancel(db, order, user, reason)


def _get_order_for_admin(db: Session, order_id: str) -> OrderModel:
    order = db.query(OrderModel).filter(OrderModel.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/orders/{order_id}/status", response_model=ShopOrderSchema)
def update_order_status(order_id: str, payload: OrderStatusUpdate, db: Session = Depends(get_db),
                        admin: CurrentUser = Depends(require_admin)):
    order = _get_order_for_admin(db, order_id)
    notes = _text(payload.notes, "Note", NOTES_MAX, single_line=False)
    new_status = payload.status
    if new_status == "Cancelled":
        return _cancel(db, order, admin, notes)
    if new_status == order.status:
        raise HTTPException(status_code=409, detail=f"{order.id} is already '{order.status}'")
    expected = NEXT_STATUS.get((order.fulfilment, order.status))
    if new_status != expected:
        hint = f" The next step is '{expected}'." if expected else ""
        raise HTTPException(status_code=409, detail=f"Can't change {order.id} from '{order.status}' to '{new_status}'.{hint}")
    if new_status in ("Delivered", "Picked Up") and order.paymentStatus != "Paid":
        raise HTTPException(
            status_code=409,
            detail=f"Record the payment for {order.id} first (recording it also marks the order {new_status}).",
        )

    claimed = (
        db.query(OrderModel)
        .filter(OrderModel.id == order.id, OrderModel.status == order.status)
        .update({OrderModel.status: new_status}, synchronize_session=False)
    )
    if not claimed:
        db.rollback()
        raise _stale(order.id)
    order.status = new_status
    _append_timeline(order, new_status, STATUS_LABELS[new_status], admin.label, notes)
    db.commit()
    db.refresh(order)

    log_audit(db, admin.label, admin.role, f"Order status changed to {new_status}", order.id, notes)
    _notify_customer(db, order, "status_update", f"Order {order.id}: {new_status}",
                     CUSTOMER_MESSAGES[new_status].format(id=order.id))
    return order


@router.post("/orders/{order_id}/payment", response_model=ShopOrderSchema)
def record_order_payment(order_id: str, payload: OrderPaymentInput, db: Session = Depends(get_db),
                         admin: CurrentUser = Depends(require_admin)):
    order = _get_order_for_admin(db, order_id)
    if order.status == "Cancelled":
        raise HTTPException(status_code=409, detail=f"{order.id} was cancelled — there is nothing to collect")
    if order.paymentStatus == "Paid":
        raise HTTPException(status_code=409, detail=f"Payment for {order.id} has already been recorded")
    amount = float(payload.amount)
    if amount <= 0:
        raise _bad("Enter the amount received (more than ₹0)")
    notes = _text(payload.notes, "Note", NOTES_MAX, single_line=False)
    total = round(float(order.total or 0), 2)
    if abs(amount - total) > 1 and not notes:  # ₹1 tolerance for rounding
        raise _bad(
            f"The order total is {_rupees(total)}. Record exactly that amount, or add a note explaining the difference (e.g. a discount)."
        )

    # Two admin tabs recording the same payment: only one conditional UPDATE can match.
    claimed = (
        db.query(OrderModel)
        .filter(OrderModel.id == order.id, OrderModel.status == order.status, OrderModel.paymentStatus != "Paid")
        .update({OrderModel.paymentStatus: "Paid"}, synchronize_session=False)
    )
    if not claimed:
        db.rollback()
        raise _stale(order.id)
    amount = round(amount, 2)
    order.paymentStatus = "Paid"
    order.paymentMethod = payload.method
    order.paidAmount = amount
    order.paidAt = now_iso()
    _append_timeline(order, "Payment Received", f"{_rupees(amount)} received via {payload.method}", admin.label, notes)
    completed = COMPLETES_ON_PAYMENT.get(order.status)
    if completed:
        order.status = completed
        _append_timeline(order, completed, STATUS_LABELS[completed], admin.label)
    db.commit()
    db.refresh(order)

    log_audit(db, admin.label, admin.role, f"Recorded {_rupees(amount)} payment ({payload.method})", order.id,
              notes or (f"Order is now {completed}" if completed else None))
    message = f"Payment of {_rupees(amount)} received for order {order.id}."
    if completed:
        message += " " + CUSTOMER_MESSAGES[completed].format(id=order.id)
    _notify_customer(db, order, "payment", f"Order {order.id}: payment received", message)
    return order


# ---------------- Admin: apparel catalogue ----------------

_PRODUCT_REQUIRED = ("name", "category", "price", "images", "customisable", "isFeatured", "isActive", "sortOrder")
_PRODUCT_FIELDS = ("name", "category", "description", "fabric", "fit", "price", "mrp", "images",
                   "customisable", "isFeatured", "isActive", "sortOrder")
_VARIANT_FIELDS = ("size", "colour", "colourHex", "stock", "sku", "sortOrder")


@router.get("/shop/admin/apparel", response_model=List[ApparelProductSchema])
def admin_list_apparel(db: Session = Depends(get_db), _: CurrentUser = Depends(require_admin)):
    products = (
        db.query(ApparelProductModel)
        .options(selectinload(ApparelProductModel.variants))
        .order_by(ApparelProductModel.sortOrder, ApparelProductModel.name)
        .all()
    )
    return [serialize_apparel(p) for p in products]


@router.post("/shop/admin/apparel", response_model=ApparelProductSchema, status_code=status.HTTP_201_CREATED)
def admin_create_apparel(payload: ApparelProductCreate, db: Session = Depends(get_db),
                         admin: CurrentUser = Depends(require_admin)):
    data = _clean_product(payload.model_dump())
    if data.get("sortOrder") is None:
        data["sortOrder"] = db.query(ApparelProductModel).count()
    product = ApparelProductModel(id=new_id("APP"), createdAt=now_iso(), **{k: data[k] for k in _PRODUCT_FIELDS})
    db.add(product)
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Added apparel: {product.name}", "CONTENT", _rupees(product.price))
    return serialize_apparel(_get_apparel(db, product.id))


@router.put("/shop/admin/apparel/{product_id}", response_model=ApparelProductSchema)
def admin_update_apparel(product_id: str, payload: ApparelProductUpdate, db: Session = Depends(get_db),
                         admin: CurrentUser = Depends(require_admin)):
    product = _get_apparel(db, product_id)
    changes = {k: v for k, v in payload.model_dump(exclude_unset=True).items()
               if not (k in _PRODUCT_REQUIRED and v is None)}
    current = {k: getattr(product, k) for k in _PRODUCT_FIELDS}
    data = _clean_product({**current, **changes})
    if data.get("sortOrder") is None:
        data["sortOrder"] = product.sortOrder or 0
    old_price = product.price
    for key in _PRODUCT_FIELDS:
        setattr(product, key, data[key])
    db.commit()
    if product.price != old_price:
        log_audit(db, admin.label, "ADMIN", f"Set price of {product.name}", "CONTENT",
                  f"{_rupees(old_price)} → {_rupees(product.price)}")
    else:
        log_audit(db, admin.label, "ADMIN", f"Updated apparel: {product.name}", "CONTENT")
    return serialize_apparel(_get_apparel(db, product_id))


@router.delete("/shop/admin/apparel/{product_id}")
def admin_delete_apparel(product_id: str, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    # Past orders keep their own snapshot of the item, so deleting a product doesn't change them.
    product = _get_apparel(db, product_id)
    name = product.name
    db.delete(product)
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Deleted apparel: {name}", "CONTENT")
    return {"success": True}


@router.post("/shop/admin/apparel/{product_id}/variants", response_model=ApparelVariantSchema,
             status_code=status.HTTP_201_CREATED)
def admin_add_apparel_variant(product_id: str, payload: ApparelVariantCreate, db: Session = Depends(get_db),
                              admin: CurrentUser = Depends(require_admin)):
    product = _get_apparel(db, product_id)
    data = _clean_variant(payload.model_dump())
    _assert_unique_variant(product, data["size"], data["colour"])
    if data.get("sortOrder") is None:
        data["sortOrder"] = max([v.sortOrder or 0 for v in product.variants], default=-1) + 1
    variant = ApparelVariantModel(id=new_id("AVR"), productId=product.id, **{k: data[k] for k in _VARIANT_FIELDS})
    db.add(variant)
    _commit_variant(db)
    db.refresh(variant)
    log_audit(db, admin.label, "ADMIN", f"Added {product.name} {variant.size} / {variant.colour}", "CONTENT",
              f"Stock {variant.stock}")
    return variant


@router.put("/shop/admin/apparel-variants/{variant_id}", response_model=ApparelVariantSchema)
def admin_update_apparel_variant(variant_id: str, payload: ApparelVariantUpdate, db: Session = Depends(get_db),
                                 admin: CurrentUser = Depends(require_admin)):
    variant = _get_apparel_variant(db, variant_id)
    product = _get_apparel(db, variant.productId)
    changes = {k: v for k, v in payload.model_dump(exclude_unset=True).items()
               if not (k in ("size", "colour", "stock", "sortOrder") and v is None)}
    current = {k: getattr(variant, k) for k in _VARIANT_FIELDS}
    data = _clean_variant({**current, **changes})
    if data.get("sortOrder") is None:
        data["sortOrder"] = variant.sortOrder or 0
    _assert_unique_variant(product, data["size"], data["colour"], exclude_id=variant.id)
    old_stock = variant.stock
    for key in _VARIANT_FIELDS:
        setattr(variant, key, data[key])
    _commit_variant(db)
    db.refresh(variant)
    if variant.stock != old_stock:
        log_audit(db, admin.label, "ADMIN", f"Set stock of {product.name} {variant.size} / {variant.colour}", "CONTENT",
                  f"{old_stock} → {variant.stock}")
    return variant


@router.delete("/shop/admin/apparel-variants/{variant_id}")
def admin_delete_apparel_variant(variant_id: str, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    variant = _get_apparel_variant(db, variant_id)
    label = f"{variant.size} / {variant.colour}"
    product_name = variant.product.name if variant.product else ""
    db.delete(variant)
    db.commit()
    log_audit(db, admin.label, "ADMIN", f"Removed {product_name} {label}".strip(), "CONTENT")
    return {"success": True}
