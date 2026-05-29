from fastapi import HTTPException

from ..schemas.models import CalculationConfig
from .ldt_loader import get_all_ldts, get_ldt_by_id


def find_ldt_for_config(config: CalculationConfig):
    ldt_id = f"{config.optic_family}_{config.power:.0f}W".lower().replace(" ", "_")
    ldt = get_ldt_by_id(ldt_id)
    if ldt is not None:
        return ldt_id, ldt

    candidates = [
        l for l in get_all_ldts()
        if l["optic_family"] == config.optic_family and abs(l["power"] - config.power) < 1
    ]
    if candidates:
        ldt = candidates[0]
        return ldt["id"], ldt

    same_family = [l for l in get_all_ldts() if l["optic_family"] == config.optic_family]
    if same_family:
        ldt = min(same_family, key=lambda l: abs(l["power"] - config.power))
        return ldt["id"], ldt

    all_ldts = get_all_ldts()
    if all_ldts:
        ldt = min(all_ldts, key=lambda l: abs(l["power"] - config.power))
        return ldt["id"], ldt

    raise HTTPException(status_code=404, detail="No LDT files available")


def require_ldt_for_config(config: CalculationConfig):
    ldt_id, ldt = find_ldt_for_config(config)
    if ldt is None:
        available = sorted(set(
            f"{l['optic_family']} {l['power']:.0f}W" for l in get_all_ldts()
        ))
        raise HTTPException(
            status_code=404,
            detail=f"No LDT found for family '{config.optic_family}' at {config.power:.0f}W. "
                   f"Available: {', '.join(available[:20])}",
        )
    return ldt_id, ldt
