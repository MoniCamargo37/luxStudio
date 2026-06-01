from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..services import ldt_loader
from ..schemas.models import LDTInfo, LDTFamily

router = APIRouter()


@router.get("/list", response_model=list[LDTInfo])
async def list_ldts():
    """List all luminaires registered in the database."""
    ldts = ldt_loader.get_all_ldts()
    return [LDTInfo(
        id=ldt["id"],
        filename=ldt["filename"],
        luminaire_name=ldt["luminaire_name"],
        manufacturer=ldt.get("manufacturer", "Unknown"),
        model_family=ldt.get("model_family", "UNKNOWN"),
        cct=ldt.get("cct", 4000),
        cri=ldt.get("cri", 70),
        optic_family=ldt["optic_family"],
        power=ldt["power"],
        flux=ldt["flux"],
        efficiency=ldt["efficiency"],
        LORL=ldt["LORL"],
        isym=ldt["isym"],
    ) for ldt in ldts]


@router.get("/families", response_model=list[LDTFamily])
async def list_families():
    """List LDTs grouped by optic family."""
    families = ldt_loader.get_families()
    return [LDTFamily(**f) for f in families]


@router.get("/catalog")
async def list_catalog():
    """List every available LDT with product metadata for UI filtering."""
    return [
        {
            "id": ldt["id"],
            "filename": ldt["filename"],
            "luminaire_name": ldt["luminaire_name"],
            "manufacturer": ldt.get("manufacturer", "Unknown"),
            "model_family": ldt.get("model_family", "UNKNOWN"),
            "cct": ldt.get("cct", 4000),
            "cri": ldt.get("cri", 70),
            "optic_family": ldt["optic_family"],
            "power": ldt["power"],
            "flux": ldt["flux"],
            "efficiency": ldt["efficiency"],
            "LORL": ldt["LORL"],
            "isym": ldt["isym"],
        }
        for ldt in ldt_loader.get_all_ldts()
    ]


@router.post("/upload")
async def upload_ldt(
    file: UploadFile = File(...),
    persist: bool = Form(False),
    manufacturer: str = Form("Custom"),
):
    """Upload an external LDT for temporary calculation use only."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty LDT file")
    if persist:
        raise HTTPException(
            status_code=400,
            detail="Use /api/admin/luminaires/upload to save luminaires in the database.",
        )

    try:
        info = ldt_loader.save_temporary_ldt(file.filename or "external.ldt", data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid LDT file: {exc}") from exc

    return LDTInfo(**{k: v for k, v in info.items() if k in ("id", "filename", "luminaire_name", "manufacturer", "model_family", "cct", "cri", "optic_family", "power", "flux", "efficiency", "LORL", "isym")})


@router.get("/{ldt_id}", response_model=LDTInfo)
async def get_ldt(ldt_id: str):
    """Get details for a specific LDT."""
    info = ldt_loader.get_ldt_by_id(ldt_id)
    if info is None:
        raise HTTPException(status_code=404, detail="LDT not found")
    return LDTInfo(**{k: v for k, v in info.items() if k in ("id", "filename", "luminaire_name", "manufacturer", "model_family", "cct", "cri", "optic_family", "power", "flux", "efficiency", "LORL", "isym")})


@router.get("/{ldt_id}/curve")
async def get_ldt_curve(ldt_id: str):
    """Get full photometric curve data for graphing."""
    info = ldt_loader.get_ldt_by_id(ldt_id)
    if info is None:
        raise HTTPException(status_code=404, detail="LDT not found")
    c0_idx = 0
    c_step = info["C"][1] - info["C"][0] if len(info["C"]) > 1 else 90
    c90_idx = int(round(90 / c_step)) % len(info["C"])
    return {
        "id": ldt_id,
        "gamma": info["G"],
        "C0": info["I"][c0_idx],
        "C90": info["I"][c90_idx],
        "Mc": info["Mc"],
        "Ng": info["Ng"],
    }
