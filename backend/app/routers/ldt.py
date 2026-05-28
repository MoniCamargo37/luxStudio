from fastapi import APIRouter, HTTPException
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


@router.get("/{ldt_id}", response_model=LDTInfo)
async def get_ldt(ldt_id: str):
    """Get details for a specific LDT."""
    info = ldt_loader.get_ldt_by_id(ldt_id)
    if info is None:
        raise HTTPException(status_code=404, detail="LDT not found")
    return LDTInfo(**{k: v for k, v in info.items() if k in ("id", "filename", "luminaire_name", "optic_family", "power", "flux", "efficiency", "LORL", "isym")})


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
