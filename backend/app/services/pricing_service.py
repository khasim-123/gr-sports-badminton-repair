import math
from typing import Tuple, Dict, Any
from app.models import DistanceConfigModel

# Straight-line (great-circle) distance × ROAD_FACTOR ≈ typical city road distance.
# The booking form uses the same factor (src/utils/distance.ts) so the customer sees the same number.
ROAD_FACTOR = 1.3


def valid_coordinates(lat, lng) -> bool:
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return False
    if not (math.isfinite(lat) and math.isfinite(lng)):
        return False
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
        return False
    return not (lat == 0.0 and lng == 0.0)  # "null island" = a broken GPS fix


def road_distance_km(shop_lat: float, shop_lng: float, lat: float, lng: float) -> float:
    """Approximate road distance from the shop to (lat, lng), rounded to 0.1 km."""
    return round(_great_circle_km(shop_lat, shop_lng, lat, lng) * ROAD_FACTOR, 1)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on the earth in kilometers.
    """
    return round(_great_circle_km(lat1, lon1, lat2, lon2), 1)


def _great_circle_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0  # Earth's radius in kilometers

    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def _round_half_up(value: float) -> float:
    """Whole rupees, .5 rounds up (like Math.round in the booking form; Python's round() is half-even)."""
    return float(math.floor(value + 0.5 + 1e-9))


def calculate_delivery_charge(
    distance_km: float,
    config: DistanceConfigModel
) -> Dict[str, Any]:
    """
    Calculate delivery charge according to distance pricing configuration.
    Free delivery up to freeRadiusKm (default 10 KM).
    """
    free_radius = config.freeRadiusKm or 10.0
    per_km_rate = config.perKmRateBeyondFree or 15.0

    if distance_km <= free_radius:
        return {
            "charge": 0.0,
            "isFree": True,
            "chargeableKm": 0.0,
            "distanceKm": distance_km
        }

    chargeable_km = round(distance_km - free_radius, 1)

    if config.pricingMethod == "SLAB" and config.slabs:
        matched_slab = None
        for slab in config.slabs:
            if slab.get("minKm", 0) <= distance_km <= slab.get("maxKm", 9999):
                matched_slab = slab
                break
        if matched_slab:
            charge = float(matched_slab.get("price", 0.0))
        else:
            charge = _round_half_up(chargeable_km * per_km_rate)
    else:
        charge = _round_half_up(chargeable_km * per_km_rate)

    return {
        "charge": charge,
        "isFree": False,
        "chargeableKm": chargeable_km,
        "distanceKm": distance_km
    }
