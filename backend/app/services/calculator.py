from typing import Optional

from ..salvi_lighting import evaluate, ME_REQ, P_REQ, Photometry
from ..schemas.models import CalculationConfig, CalculationResult, CriterionResult, LDTInfo
from .geometry import arm_projection, effective_overhang, luminaire_mounting_height
from .ldt_loader import get_all_ldts, get_ldt_by_id, get_photometry

POWER_LAW_EXPONENT = 0.832

# LUXEON 5050 Round typical luminous flux at rated current, Tj=25 C.
# Values are normalized against CRI 70 by CCT and interpolated for intermediate CCTs.
LUXEON_5050_CRI_FLUX = {
    2700: {70: 640.0, 80: 593.0, 90: 475.0},
    3000: {70: 667.0, 80: 615.0, 90: 490.0},
    3500: {70: 686.0, 80: 620.0, 90: 510.0},
    4000: {70: 693.0, 80: 645.0, 90: 530.0},
    5000: {70: 693.0, 80: 645.0, 90: 530.0},
    5700: {70: 683.0, 80: 644.0, 90: 530.0},
}


def _power_law_flux(ref_power: float, ref_flux: float, target_power: float) -> float:
    if ref_power <= 0 or target_power <= 0:
        return ref_flux
    return ref_flux * (target_power / ref_power) ** POWER_LAW_EXPONENT


def _cri_flux_factor(cct: int, target_cri: int, reference_cri: int = 70) -> float:
    target_cri = min(90, max(70, int(target_cri)))
    reference_cri = min(90, max(70, int(reference_cri)))
    if target_cri == reference_cri:
        return 1.0

    def flux_for_cri(values: dict[int, float], cri: int) -> Optional[float]:
        return _interpolate(float(cri), [(float(key), value) for key, value in values.items()])

    target_points = [
        (float(cct_value), flux_for_cri(values, target_cri))
        for cct_value, values in LUXEON_5050_CRI_FLUX.items()
    ]
    reference_points = [
        (float(cct_value), flux_for_cri(values, reference_cri))
        for cct_value, values in LUXEON_5050_CRI_FLUX.items()
    ]
    target_points = [(cct_value, flux) for cct_value, flux in target_points if flux is not None]
    reference_points = [(cct_value, flux) for cct_value, flux in reference_points if flux is not None]
    target_flux = _interpolate(float(cct), target_points)
    reference_flux = _interpolate(float(cct), reference_points)
    if not target_flux or not reference_flux:
        return 1.0
    return target_flux / reference_flux


def run_calculation(config: CalculationConfig, ldt_id: str) -> CalculationResult:
    photometry = get_photometry(ldt_id)
    if photometry is None:
        raise ValueError(f"LDT not found: {ldt_id}")

    ldt_info = get_ldt_by_id(ldt_id)
    if ldt_info is None:
        raise ValueError(f"LDT metadata not found: {ldt_id}")

    if ldt_id.startswith("temp-"):
        exact_config = config.model_copy(update={
            "power": float(photometry.power),
            "cct": int(ldt_info.get("cct", config.cct)),
            "cri": int(ldt_info.get("cri", config.cri)),
            "optic_family": ldt_info.get("optic_family", config.optic_family),
            "manufacturer": ldt_info.get("manufacturer", config.manufacturer),
            "model_family": ldt_info.get("model_family", config.model_family),
        })
        target_info = dict(ldt_info)
        target_info["power"] = float(photometry.power)
        target_info["cct"] = int(ldt_info.get("cct", exact_config.cct))
        target_info["cri"] = int(ldt_info.get("cri", exact_config.cri))
        target_info["flux"] = float(photometry.flux)
        target_info["efficiency"] = round(photometry.eff, 1)
        return run_calculation_with_photometry(exact_config, photometry, target_info, flux_scale=1.0)

    target_info = _target_luminaire_info(config, photometry, ldt_info)
    flux_scale = target_info["flux"] / photometry.flux if photometry.flux else 1.0
    return run_calculation_with_photometry(config, photometry, target_info, flux_scale=flux_scale)


def run_calculation_with_photometry(
    config: CalculationConfig,
    photometry: Photometry,
    ldt_info: dict,
    flux_scale: float = 1.0,
) -> CalculationResult:
    cfg = _config_to_cfg(config, photometry)
    result = evaluate(cfg, photometry, flux_scale=flux_scale, road=config.pavement)
    _apply_uniformity_offset_sign(config, photometry, result, flux_scale)
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
            cri=ldt_info.get("cri", config.cri),
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
    return {
        "arrangement": config.arrangement,
        "h": luminaire_mounting_height(config),
        "S": config.spacing,
        "W": config.road_width,
        "arm": effective_overhang(config),
        "tilt": config.tilt,
        "mf": config.mf,
        "class": config.lighting_class,
        "pole_side": config.pole_side,
    }


def _config_to_uniformity_cfg(config: CalculationConfig, photometry: Photometry) -> dict:
    cfg = _config_to_cfg(config, photometry)
    horizontal_arm, _ = arm_projection(config)
    cfg["arm"] = horizontal_arm + config.pole_offset
    return cfg


def _apply_uniformity_offset_sign(
    config: CalculationConfig,
    photometry: Photometry,
    result: dict,
    flux_scale: float,
) -> None:
    if result.get("mode") != "ME" or abs(config.pole_offset) < 1e-9:
        return

    uniformity_cfg = _config_to_uniformity_cfg(config, photometry)
    uniformity_result = evaluate(
        uniformity_cfg,
        photometry,
        flux_scale=flux_scale,
        road=config.pavement,
    )

    for key in ("Uo", "Ul", "ok_Uo", "ok_Ul"):
        if key in uniformity_result:
            result[key] = uniformity_result[key]

    result["compliant"] = all(
        result.get(key, False)
        for key in ("ok_L", "ok_Uo", "ok_Ul", "ok_TI", "ok_SR")
    )


def _target_luminaire_info(config: CalculationConfig, photometry: Photometry, reference_info: dict) -> dict:
    target = dict(reference_info)

    if abs(config.power - photometry.power) / max(photometry.power, 0.1) < 0.01:
        reference_cri = int(reference_info.get("cri", 70) or 70)
        target_flux = float(photometry.flux) * _cri_flux_factor(config.cct, config.cri, reference_cri)
        target["power"] = float(config.power)
        target["cct"] = int(config.cct)
        target["cri"] = int(config.cri)
        target["flux"] = target_flux
        target["efficiency"] = round(target_flux / float(config.power), 1) if config.power else 0
        return target

    target_flux = _estimate_flux_for_config(config, reference_info)
    if target_flux is None:
        reference_efficiency = reference_info.get("efficiency") or getattr(photometry, "eff", None)
        if reference_efficiency:
            target_flux = float(config.power) * float(reference_efficiency)
        else:
            target_flux = _power_law_flux(photometry.power, photometry.flux, float(config.power))

    reference_cri = int(reference_info.get("cri", 70) or 70)
    target_flux *= _cri_flux_factor(config.cct, config.cri, reference_cri)

    target["power"] = float(config.power)
    target["cct"] = int(config.cct)
    target["cri"] = int(config.cri)
    target["flux"] = float(target_flux)
    target["efficiency"] = round(float(target_flux) / float(config.power), 1) if config.power else 0
    return target


def _estimate_flux_for_config(config: CalculationConfig, reference_info: dict) -> Optional[float]:
    candidates = [
        ldt for ldt in get_all_ldts()
        if ldt.get("manufacturer", "Unknown") == reference_info.get("manufacturer", "Unknown")
        and ldt.get("model_family", "UNKNOWN") == reference_info.get("model_family", "UNKNOWN")
        and ldt.get("optic_family") == reference_info.get("optic_family")
        and int(ldt.get("cri", 70) or 70) == int(reference_info.get("cri", 70) or 70)
    ]
    if not candidates:
        return None

    cct_points = []
    for cct in sorted({int(item.get("cct", config.cct)) for item in candidates}):
        power_points = sorted(
            (
                (float(item["power"]), float(item["flux"]))
                for item in candidates
                if int(item.get("cct", config.cct)) == cct and float(item.get("power", 0)) > 0
            ),
            key=lambda point: point[0],
        )
        if len(power_points) == 1 and abs(power_points[0][0] - config.power) > 1e-9:
            flux_at_power = _power_law_flux(power_points[0][0], power_points[0][1], config.power)
        else:
            flux_at_power = _interpolate(config.power, power_points)
        if flux_at_power is not None:
            cct_points.append((float(cct), flux_at_power))

    return _interpolate(config.cct, cct_points)


def _interpolate(x: float, points: list[tuple[float, float]]) -> Optional[float]:
    if not points:
        return None
    if len(points) == 1:
        return points[0][1]

    points = sorted(points, key=lambda point: point[0])
    if x <= points[0][0]:
        return _linear_between(x, points[0], points[1])
    if x >= points[-1][0]:
        return _linear_between(x, points[-2], points[-1])

    for left, right in zip(points, points[1:]):
        if left[0] <= x <= right[0]:
            return _linear_between(x, left, right)
    return points[-1][1]


def _linear_between(x: float, left: tuple[float, float], right: tuple[float, float]) -> float:
    x1, y1 = left
    x2, y2 = right
    if abs(x2 - x1) < 1e-9:
        return y1
    return y1 + (y2 - y1) * ((float(x) - x1) / (x2 - x1))


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
