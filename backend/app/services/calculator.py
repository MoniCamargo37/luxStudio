from ..salvi_lighting import evaluate, ME_REQ, P_REQ, Photometry
from ..schemas.models import CalculationConfig, CalculationResult, CriterionResult, LDTInfo
from .ldt_loader import get_ldt_by_id, get_photometry


def run_calculation(config: CalculationConfig, ldt_id: str) -> CalculationResult:
    photometry = get_photometry(ldt_id)
    if photometry is None:
        raise ValueError(f"LDT not found: {ldt_id}")

    ldt_info = get_ldt_by_id(ldt_id)
    if ldt_info is None:
        raise ValueError(f"LDT metadata not found: {ldt_id}")

    return run_calculation_with_photometry(config, photometry, ldt_info, flux_scale=1.0)


def run_calculation_with_photometry(
    config: CalculationConfig,
    photometry: Photometry,
    ldt_info: dict,
    flux_scale: float = 1.0,
) -> CalculationResult:
    cfg = _config_to_cfg(config, photometry)
    result = evaluate(cfg, photometry, flux_scale=flux_scale, road=config.pavement)
    criteria = _build_criteria(result)

    return CalculationResult(
        config=config,
        compliant=result.get("compliant", False),
        mode=result.get("mode", "ME"),
        luminaire=LDTInfo(
            id=ldt_info["id"],
            filename=ldt_info["filename"],
            luminaire_name=ldt_info["luminaire_name"],
            manufacturer=ldt_info.get("manufacturer", "Unknown"),
            model_family=ldt_info.get("model_family", "UNKNOWN"),
            cct=ldt_info.get("cct", config.cct),
            optic_family=ldt_info["optic_family"],
            power=ldt_info["power"],
            flux=ldt_info["flux"],
            efficiency=ldt_info["efficiency"],
            LORL=ldt_info["LORL"],
            isym=ldt_info["isym"],
        ),
        criteria=criteria,
        Lavg=result.get("Lavg"),
        Uo=result.get("Uo"),
        Ul=result.get("Ul"),
        TI=result.get("TI"),
        SR=result.get("SR"),
        Eavg=result.get("Eavg"),
        Emin=result.get("Emin"),
    )


def _config_to_cfg(config: CalculationConfig, photometry: Photometry) -> dict:
    effective_overhang = max(config.arm_length - config.pole_offset, 0.0)
    return {
        "arrangement": config.arrangement,
        "h": config.height,
        "S": config.spacing,
        "W": config.road_width,
        "arm": effective_overhang,
        "tilt": config.tilt,
        "mf": config.mf,
        "class": config.lighting_class,
    }


def _build_criteria(result: dict) -> list[CriterionResult]:
    criteria = []
    mode = result.get("mode", "ME")
    req = result.get("req", {})

    if mode == "ME":
        for key, name, fmt in [
            ("Lavg", "Lavg (cd/m²)", ".2f"),
            ("Uo", "Uo", ".3f"),
            ("Ul", "Ul", ".3f"),
            ("TI", "TI (%)", ".1f"),
            ("SR", "SR", ".3f"),
        ]:
            ok_key = f"ok_{key.split('(')[0].strip()}"
            if key == "Lavg":
                ok_key = "ok_L"
            elif key == "SR":
                ok_key = "ok_SR"
            criteria.append(CriterionResult(
                name=name,
                value=result.get(key, 0),
                required=req.get({"Lavg": "L", "Uo": "Uo", "Ul": "Ul", "TI": "TI", "SR": "SR"}.get(key, key), 0),
                passed=result.get(ok_key, False),
            ))
    elif mode == "P":
        for key, name in [("Eavg", "Eavg (lux)"), ("Emin", "Emin (lux)")]:
            ok_key = f"ok_{key}"
            criteria.append(CriterionResult(
                name=name,
                value=result.get(key, 0),
                required=req.get(key, 0),
                passed=result.get(ok_key, False),
            ))

    return criteria
