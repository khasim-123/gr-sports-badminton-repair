from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import MediaModel
from app.schemas import MediaResponse
from app.security import CurrentUser, require_admin
from app.services.content_service import new_id, now_iso, process_upload

router = APIRouter(prefix="/media", tags=["Media Uploads"])


def media_url(request: Request, media_id: str) -> str:
    base = settings.PUBLIC_API_URL.rstrip("/") if settings.PUBLIC_API_URL else str(request.base_url).rstrip("/")
    return f"{base}{settings.API_V1_STR}/media/{media_id}"


@router.post("", response_model=MediaResponse, status_code=status.HTTP_201_CREATED)
async def upload_media(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_admin),
):
    data = await file.read(settings.MAX_UPLOAD_BYTES + 1)
    if len(data) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File is too large (max {settings.MAX_UPLOAD_BYTES // (1024 * 1024)} MB)")
    if not data:
        raise HTTPException(status_code=422, detail="Empty file")

    body, content_type, ext = process_upload(data, file.content_type)
    base_name = (file.filename or "upload").rsplit(".", 1)[0][:150]
    media = MediaModel(
        id=new_id("MED"),
        fileName=f"{base_name}.{ext}",
        contentType=content_type,
        size=len(body),
        data=body,
        uploadedBy=admin.label,
        createdAt=now_iso(),
    )
    db.add(media)
    db.commit()
    return MediaResponse(
        id=media.id,
        url=media_url(request, media.id),
        contentType=content_type,
        size=media.size,
        fileName=media.fileName,
    )


@router.get("/{media_id}")
def get_media(media_id: str, db: Session = Depends(get_db)):
    media = db.query(MediaModel).filter(MediaModel.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="File not found")
    disposition = "inline"
    if media.fileName:
        safe_name = "".join(c for c in media.fileName if c.isalnum() or c in "._- ")
        disposition = f'inline; filename="{safe_name}"'
    return Response(
        content=media.data,
        media_type=media.contentType,
        headers={
            # Media ids are never reused, so the content can be cached forever.
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": disposition,
            "X-Content-Type-Options": "nosniff",
        },
    )
