"""Footer pages the shop writes itself (About us, Shipping, Return & cancellation, ...).

The set of pages is fixed (PAGES); the admin edits each one's title and text. Stored as one JSON
document in the existing `app_meta` table (key "site_pages": {slug: {title, body, updatedAt}}),
so no migration is needed. Nothing is invented: every page starts with an empty text, and a
page without text isn't shown on the website.
"""
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import AppMetaModel
from app.services.content_service import clean_text, now_iso

KEY = "site_pages"

# slug -> default title, in footer order (src/types/content.ts SitePageSlug).
PAGES: Dict[str, str] = {
    "about": "About us",
    "promise": "Our promise",
    "local-pickup": "Local pickup",
    "express-stringing": "Express stringing",
    "shuttlers-talk": "Shuttlers talk",
    "shipping": "Shipping",
    "returns": "Return & cancellation",
    "terms": "Terms and conditions",
    "payments": "Payments",
    "stringing-guide": "Stringing guide",
}

TITLE_MAX = 80
BODY_MAX = 20_000


def _stored(db: Session) -> Dict[str, Any]:
    row = db.query(AppMetaModel).filter(AppMetaModel.key == KEY).first()
    return dict(row.value or {}) if row else {}


def _page(slug: str, stored: Optional[dict]) -> Dict[str, Any]:
    stored = stored if isinstance(stored, dict) else {}
    return {
        "slug": slug,
        "title": stored.get("title") or PAGES[slug],
        "body": stored.get("body") or "",
        "updatedAt": stored.get("updatedAt"),
    }


def list_pages(db: Session) -> List[Dict[str, Any]]:
    """Every footer page, including ones without text yet (admin)."""
    stored = _stored(db)
    return [_page(slug, stored.get(slug)) for slug in PAGES]


def public_pages(db: Session) -> List[Dict[str, Any]]:
    """Only the pages that have text (the website links just these)."""
    return [p for p in list_pages(db) if p["body"].strip()]


def clean_body(value: Optional[str]) -> str:
    """Plain text: line breaks kept (blank lines separate paragraphs), trailing spaces and runs of
    more than one blank line removed."""
    lines = [line.rstrip() for line in (value or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    out: List[str] = []
    for line in lines:
        if not line and (not out or not out[-1]):
            continue  # no leading blank lines, at most one blank line in a row
        out.append(line)
    body = "\n".join(out).strip("\n")
    if len(body) > BODY_MAX:
        raise HTTPException(status_code=422, detail=f"Page text must be at most {BODY_MAX:,} characters")
    return body


def save_page(db: Session, slug: str, title: Optional[str], body: Optional[str]) -> Dict[str, Any]:
    if slug not in PAGES:
        raise HTTPException(status_code=404, detail="Page not found")
    clean_title = clean_text(title, "Title", TITLE_MAX, required=True)
    stored = _stored(db)
    stored[slug] = {"title": clean_title, "body": clean_body(body), "updatedAt": now_iso()}
    row = db.query(AppMetaModel).filter(AppMetaModel.key == KEY).first()
    if row is None:
        db.add(AppMetaModel(key=KEY, value=stored))
    else:
        row.value = stored  # a new dict, so SQLAlchemy sees the JSON change
    db.commit()
    return _page(slug, stored[slug])
