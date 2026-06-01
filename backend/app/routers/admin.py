import os
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db, LDT_DIR
from ..models import Luminaire
from ..schemas.models import LDTInfo
from ..services import admin_service


class UpdateLuminaireBody(BaseModel):
    manufacturer: Optional[str] = None
    model_family: Optional[str] = None
    optic_family: Optional[str] = None
    luminaire_name: Optional[str] = None
    power: Optional[float] = None
    cct: Optional[int] = None
    cri: Optional[int] = None
    flux: Optional[float] = None
    efficiency: Optional[float] = None
    LORL: Optional[float] = None
    isym: Optional[int] = None

router = APIRouter()


def _lum_to_info(lum: Luminaire) -> LDTInfo:
    return LDTInfo(
        id=str(lum.id),
        filename=Path(lum.ldt_path).name,
        luminaire_name=lum.name,
        manufacturer=lum.manufacturer.name if lum.manufacturer else "Unknown",
        model_family=lum.type,
        cct=lum.cct,
        cri=getattr(lum, "cri", 70) or 70,
        optic_family=lum.optic_family,
        power=lum.power,
        flux=lum.flux,
        efficiency=lum.efficiency,
        LORL=lum.LORL,
        isym=lum.isym,
    )


@router.post("/parse-ldt")
async def parse_ldt(file: UploadFile = File(...)):
    """Upload an LDT and return extracted fields for admin form preview. Does NOT save."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty LDT file")
    try:
        result = admin_service.parse_ldt_preview(data, file.filename or "unknown.ldt")
        return result
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid LDT file: {exc}")


@router.post("/luminaires/upload")
async def upload_luminaire(
    file: UploadFile = File(...),
    manufacturer: str = Form(...),
    model_family: str = Form(...),
    optic_family: str = Form(...),
    luminaire_name: str = Form(...),
    power: float = Form(...),
    cct: int = Form(...),
    cri: int = Form(70),
    flux: float = Form(...),
    efficiency: float = Form(...),
    LORL: float = Form(...),
    isym: int = Form(...),
    db: Session = Depends(get_db),
):
    """Upload an LDT and save as a new luminaire."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty LDT file")

    fd, tmp_path = tempfile.mkstemp(suffix=".ldt")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        lum = admin_service.create_luminaire(db, {
            "ldt_temp_path": tmp_path,
            "filename": file.filename or "unknown.ldt",
            "manufacturer": manufacturer,
            "model_family": model_family,
            "optic_family": optic_family,
            "luminaire_name": luminaire_name,
            "power": power,
            "cct": cct,
            "cri": cri,
            "flux": flux,
            "efficiency": efficiency,
            "LORL": LORL,
            "isym": isym,
        })
        return _lum_to_info(lum)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@router.get("/luminaires", response_model=list[LDTInfo])
async def list_luminaires(db: Session = Depends(get_db)):
    """List all luminaires from the database."""
    luminaires = admin_service.get_all_luminaires(db)
    return [_lum_to_info(l) for l in luminaires]


@router.get("/luminaires/{lum_id}", response_model=LDTInfo)
async def get_luminaire(lum_id: int, db: Session = Depends(get_db)):
    """Get a single luminaire by ID."""
    lum = admin_service.get_luminaire_by_id(db, lum_id)
    if not lum:
        raise HTTPException(status_code=404, detail="Luminaire not found")
    return _lum_to_info(lum)


@router.put("/luminaires/{lum_id}")
async def update_luminaire(
    lum_id: int,
    body: UpdateLuminaireBody,
    db: Session = Depends(get_db),
):
    """Update a luminaire. Body can include any subset of fields."""
    data = body.model_dump(exclude_none=True)
    lum = admin_service.update_luminaire(db, lum_id, data)
    if not lum:
        raise HTTPException(status_code=404, detail="Luminaire not found")
    return _lum_to_info(lum)


@router.delete("/luminaires/{lum_id}")
async def delete_luminaire(lum_id: int, db: Session = Depends(get_db)):
    """Delete a luminaire and its LDT file."""
    ok = admin_service.delete_luminaire(db, lum_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Luminaire not found")
    return {"ok": True}


@router.get("/manufacturers")
async def list_manufacturers(db: Session = Depends(get_db)):
    """List all manufacturers."""
    mfrs = admin_service.get_manufacturers(db)
    return [{"id": m.id, "name": m.name} for m in mfrs]
