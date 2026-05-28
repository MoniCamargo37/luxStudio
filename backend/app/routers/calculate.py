from fastapi import APIRouter, HTTPException
from ..schemas.models import CalculationConfig, CalculationResult
from ..services.calculator import run_calculation
from ..services.ldt_loader import get_ldt_by_id, get_all_ldts

router = APIRouter()


@router.post("/calculate", response_model=CalculationResult)
async def calculate(config: CalculationConfig):
    """Run a full CIE 140 / EN 13201 calculation for the given configuration."""
    ldt_id = f"{config.optic_family}_{config.power:.0f}W".lower().replace(" ", "_")

    ldt = get_ldt_by_id(ldt_id)
    if ldt is None:
        for l in get_all_ldts():
            if l["optic_family"] == config.optic_family and abs(l["power"] - config.power) < 1:
                ldt = l
                ldt_id = l["id"]
                break

    if ldt is None:
        available = sorted(set(
            f"{l['optic_family']} {l['power']:.0f}W" for l in get_all_ldts()
        ))
        raise HTTPException(
            status_code=404,
            detail=f"No LDT found for family '{config.optic_family}' at {config.power:.0f}W. "
                   f"Available: {', '.join(available[:20])}",
        )

    return run_calculation(config, ldt_id)
