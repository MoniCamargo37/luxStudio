from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from ..salvi_lighting import parse_ldt

from ..services import ldt_loader
from ..schemas.models import LDTInfo, LDTFamily

router = APIRouter()


@router.get("/list", response_model=list[LDTInfo])
async def list_ldts():
    """List all available LDT files."""
    ldts = ldt_loader.get_all_ldts()
    return [LDTInfo(
        id=ldt["id"],
        filename=ldt["filename"],
        luminaire_name=ldt["luminaire_name"],
        manufacturer=ldt.get("manufacturer", "Unknown"),
        model_family=ldt.get("model_family", "UNKNOWN"),
        cct=ldt.get("cct", 4000),
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
    """Validate an uploaded LDT and optionally add it to the local catalog."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty LDT file")

    try:
        if persist:
            target_path = ldt_loader.save_uploaded_ldt(file.filename or "uploaded.ldt", data, manufacturer)
            parsed = parse_ldt(str(target_path))
            saved = True
        else:
            tmp_path = ldt_loader.LDT_DIR / "__tmp_upload__.ldt"
            tmp_path.write_bytes(data)
            parsed = parse_ldt(str(tmp_path))
            tmp_path.unlink(missing_ok=True)
            saved = False
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid LDT file: {exc}") from exc

    return {
        "saved": saved,
        "luminaire_name": parsed.get("lum_name", file.filename),
        "manufacturer": manufacturer,
        "power": parsed["lamp_sets"][0]["wattage"],
        "flux": parsed["lamp_sets"][0]["flux_lm"],
    }


@router.get("/{ldt_id}", response_model=LDTInfo)
async def get_ldt(ldt_id: str):
    """Get details for a specific LDT."""
    info = ldt_loader.get_ldt_by_id(ldt_id)
    if info is None:
        raise HTTPException(status_code=404, detail="LDT not found")
    return LDTInfo(**{k: v for k, v in info.items() if k in ("id", "filename", "luminaire_name", "manufacturer", "model_family", "cct", "optic_family", "power", "flux", "efficiency", "LORL", "isym")})


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
