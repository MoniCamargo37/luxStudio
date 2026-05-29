"""Solver: scale lamp flux to meet lighting class requirements, then map to LDT power."""

import math
from .calc import calc_luminance, calc_road, calc_SR, ME_REQ, P_REQ

# Available LDT models (same F151 distribution, different flux/power)
LDT_LIBRARY = [
    ("KRONOS 14G F151 SPUW",  35.0,  5584.0),
    ("KRONOS 21G F151 SPUW",  54.0,  8528.0),
    ("KRONOS 28H F151 SPUW",  80.0, 12381.0),
    ("KRONOS 21G F151 SPUW",  85.0, 12728.0),
    ("KRONOS 42G F151 SPUW", 165.0, 23634.0),
    ("KRONOS 42G F151 SPUW", 170.0, 24193.0),
]


def lm_to_W(target_flux):
    """Map target flux (lm) to power (W) by interpolating across the LDT library.

    Returns (watts, description_string).
    """
    pairs = sorted(LDT_LIBRARY, key=lambda t: t[2])
    if target_flux <= pairs[0][2]:
        eff = pairs[0][2] / pairs[0][1]
        return target_flux / eff, f"<{pairs[0][0]} {pairs[0][1]:.0f}W (extrap @ {eff:.1f} lm/W)"
    if target_flux >= pairs[-1][2]:
        eff = pairs[-1][2] / pairs[-1][1]
        return target_flux / eff, f">{pairs[-1][0]} {pairs[-1][1]:.0f}W (extrap @ {eff:.1f} lm/W)"
    for i in range(len(pairs) - 1):
        f1, w1 = pairs[i][2], pairs[i][1]
        f2, w2 = pairs[i + 1][2], pairs[i + 1][1]
        if f1 <= target_flux <= f2:
            W = w1 + (w2 - w1) * (target_flux - f1) / (f2 - f1)
            return W, f"interp {pairs[i][1]:.0f}W↔{pairs[i+1][1]:.0f}W"
    return None, "?"


def evaluate_row(cfg, base_photometry, road: str = 'R3'):
    """Evaluate a single row config.

    Scales base_photometry flux to exactly meet Lavg (ME) or Eavg (P),
    then reports all photometric values and required power.

    `road` selects the CIE 144 pavement reflection table ('R1', 'R2', 'R3', 'R4').

    Returns a dict with: mode, eclass, target_flux, target_W, source,
    compliant, ok_* flags, and all photometric values.
    """
    eclass = cfg["class"]
    ph = base_photometry

    if eclass.startswith("M"):
        rL = calc_luminance(cfg, ph, flux_scale=1.0, road=road)
        SR = calc_SR(cfg, ph, flux_scale=1.0)
        req = ME_REQ[eclass]
        scale = req["L"] / rL["Lavg"] if rL["Lavg"] > 0 else float("inf")
        Lavg = rL["Lavg"] * scale
        Lmin = rL["Lmin"] * scale
        Uo = rL["Uo"]
        Ul = rL["Ul"]
        # TI scales as scale^0.2 because TI = 65*Lv/Lavg^0.8 and both Lv and Lavg scale linearly
        TI = rL["TI"] * (scale ** 0.2)
        target_flux = ph.flux * scale
        W, source = lm_to_W(target_flux)
        return dict(
            mode="ME", eclass=eclass,
            Lavg=Lavg, Lmin=Lmin, Uo=Uo, Ul=Ul, TI=TI, SR=SR,
            target_flux=target_flux, target_W=W, source=source,
            ok_L=Lavg >= req["L"] * 0.999,
            ok_Uo=Uo >= req["Uo"],
            ok_Ul=Ul >= req["Ul"],
            ok_TI=TI <= req["TI"],
            ok_SR=SR >= req["SR"],
            compliant=all([
                Lavg >= req["L"] * 0.999,
                Uo >= req["Uo"],
                Ul >= req["Ul"],
                TI <= req["TI"],
                SR >= req["SR"],
            ]),
            req=req,
        )

    if eclass.startswith("P"):
        rE = calc_road(cfg, ph, flux_scale=1.0)
        req = P_REQ.get(eclass, dict(Eavg=0, Emin=0))
        scale = req["Eavg"] / rE["Eavg"] if rE["Eavg"] > 0 else float("inf")
        Eavg = rE["Eavg"] * scale
        Emin = rE["Emin"] * scale
        Uo = (rE["Emin"] / rE["Eavg"]) if rE["Eavg"] > 0 else 0.0
        target_flux = ph.flux * scale
        W, source = lm_to_W(target_flux)
        return dict(
            mode="P", eclass=eclass,
            Eavg=Eavg, Emin=Emin, Uo=Uo,
            target_flux=target_flux, target_W=W, source=source,
            ok_E=Eavg >= req["Eavg"] * 0.999,
            ok_Emin=Emin >= req["Emin"],
            compliant=Eavg >= req["Eavg"] * 0.999 and Emin >= req["Emin"],
            req=req,
        )

    raise ValueError(f"Unknown lighting class: {eclass!r}")


def find_min_power(cfg, base_photometry, lm_to_W_fn, road='R3'):
    """Find the *minimum power* at which ALL photometric criteria are satisfied.

    Unlike ``evaluate_row`` (which scales to meet Lₐᵥ₉/Eₐᵥ₉ exactly and then
    reports pass/fail), this function searches for the lowest feasible flux
    multiplier where every requirement is met.

    Parameters
    ----------
    cfg : dict
        Row config with keys: arrangement, h, S, W, Wa, arm, class, tilt, mf.
    base_photometry : Photometry
        Photometry used for the spatial light distribution (shape).
    lm_to_W_fn : callable
        ``fn(target_flux) -> (watts, source_str)``.
    road : str
        Pavement reflection table ('R1'–'R4').

    Returns
    -------
    dict with keys:
        feasible : bool
            ``True`` when a solution exists.
        scale : float
            Minimum flux multiplier that passes all checks.
        target_flux, target_W, source : float/str
            Corresponding flux, power and interpolation note.
        Lavg, Uo, Ul, TI, SR : float
            Photometric values AT the feasible scale (only for ME mode).
        Eavg, Emin, Uo : float
            Photometric values AT the feasible scale (only for P mode).
        failing : list[str]
            Parameters that prevent a solution (empty when feasible).
    """
    eclass = cfg["class"]

    if eclass.startswith("M"):
        rL = calc_luminance(cfg, base_photometry, flux_scale=1.0, road=road)
        SR = calc_SR(cfg, base_photometry, flux_scale=1.0)
        req = ME_REQ[eclass]

        failing = []
        if rL["Uo"] < req["Uo"]:
            failing.append(f"Uo={rL['Uo']:.3f} < {req['Uo']}")
        if rL["Ul"] < req["Ul"]:
            failing.append(f"Ul={rL['Ul']:.3f} < {req['Ul']}")
        if SR < req["SR"]:
            failing.append(f"SR={SR:.3f} < {req['SR']}")

        # Uo, Ul, SR are scale-independent → if they fail, no solution exists
        if failing:
            return dict(mode="ME", feasible=False, scale=None, target_flux=None,
                        target_W=None, source=None, eclass=eclass,
                        Lavg=None, Uo=rL["Uo"], Ul=rL["Ul"], TI=rL["TI"], SR=SR,
                        failing=failing)

        # Minimum scale to meet Lavg
        scale_L = req["L"] / rL["Lavg"] if rL["Lavg"] > 0 else float("inf")

        # At scale_L, compute TI
        TI_at_scale = rL["TI"] * (scale_L ** 0.2)  # TI ∝ scale^0.2
        if TI_at_scale > req["TI"]:
            failing.append(
                f"TI={TI_at_scale:.1f} ≥ {req['TI']} a la escala Lavg={scale_L:.3f} "
                f"(reducir flujo empeora Lavg, aumentarlo empeora TI)"
            )
            return dict(mode="ME", feasible=False, scale=scale_L, target_flux=None,
                        target_W=None, source=None, eclass=eclass,
                        Lavg=req["L"], Uo=rL["Uo"], Ul=rL["Ul"],
                        TI=TI_at_scale, SR=SR,
                        failing=failing)

        scale = scale_L
        target_flux = base_photometry.flux * scale
        W, source = lm_to_W_fn(target_flux)
        return dict(
            mode="ME", eclass=eclass,
            feasible=True, scale=scale,
            target_flux=target_flux, target_W=W, source=source,
            Lavg=req["L"], Uo=rL["Uo"], Ul=rL["Ul"],
            TI=TI_at_scale, SR=SR,
            failing=[],
        )

    if eclass.startswith("P"):
        rE = calc_road(cfg, base_photometry, flux_scale=1.0)
        req = P_REQ.get(eclass, dict(Eavg=0, Emin=0))

        failing = []
        scale = req["Eavg"] / rE["Eavg"] if rE["Eavg"] > 0 else float("inf")

        # At this scale, Emin = rE["Emin"] * scale
        Emin_at_scale = rE["Emin"] * scale if scale != float("inf") else 0
        if Emin_at_scale < req["Emin"]:
            failing.append(
                f"Emin={Emin_at_scale:.2f} < {req['Emin']} lux "
                f"(escala Eavg={scale:.3f}); relación Emin/Eavg fija"
            )
            return dict(mode="P", eclass=eclass, feasible=False, scale=scale,
                        target_flux=None, target_W=None, source=None,
                        Eavg=req["Eavg"], Emin=Emin_at_scale,
                        Uo=rE["Emin"] / rE["Eavg"] if rE["Eavg"] > 0 else 0,
                        failing=failing)

        target_flux = base_photometry.flux * scale
        W, source = lm_to_W_fn(target_flux)
        return dict(
            mode="P", eclass=eclass, feasible=True, scale=scale,
            target_flux=target_flux, target_W=W, source=source,
            Eavg=req["Eavg"], Emin=Emin_at_scale,
            Uo=rE["Emin"] / rE["Eavg"] if rE["Eavg"] > 0 else 0,
            failing=[],
        )

    raise ValueError(f"Unknown lighting class: {eclass!r}")
