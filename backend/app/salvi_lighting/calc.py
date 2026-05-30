"""CIE 140 / EN 13201 simplified street-lighting calculator.

Coordinates:
  x: longitudinal (along road, direction of travel)
  y: transverse, 0 = left edge of carriageway, W = right edge
  z: vertical (up positive)

LDT convention:
  C=0°   along road in direction of travel (+x)
  C=90°  across road towards road interior (+y of luminaire frame)
  gamma=0° straight down
"""
import math

from .r_table import r_value, R3_Q0

# EN 13201-2 requirements per class
ME_REQ = {
    "M1": dict(L=2.0,  Uo=0.4,  Ul=0.7, TI=10, SR=0.5),
    "M2": dict(L=1.5,  Uo=0.4,  Ul=0.7, TI=10, SR=0.5),
    "M3": dict(L=1.0,  Uo=0.4,  Ul=0.6, TI=15, SR=0.5),
    "M4": dict(L=0.75, Uo=0.4,  Ul=0.6, TI=15, SR=0.5),
    "M5": dict(L=0.5,  Uo=0.35, Ul=0.4, TI=15, SR=0.5),
    "M6": dict(L=0.3,  Uo=0.35, Ul=0.4, TI=20, SR=0.5),
}
P_REQ = {
    "P1": dict(Eavg=15.0, Emin=3.0),
    "P2": dict(Eavg=10.0, Emin=2.0),
    "P3": dict(Eavg=7.5,  Emin=1.5),
    "P4": dict(Eavg=5.0,  Emin=1.0),
    "P5": dict(Eavg=3.0,  Emin=0.6),
    "P6": dict(Eavg=2.0,  Emin=0.4),
}


class Photometry:
    """Wrap a parsed LDT dict for sampling I(C, gamma) in cd/klm."""

    def __init__(self, d):
        self.d = d
        self.Mc = d["Mc"]
        self.Dc = d["Dc"]
        self.Ng = d["Ng"]
        self.Dg = d["Dg"]
        self.I = d["I"]
        self.flux = d["lamp_sets"][0]["flux_lm"]
        self.power = d["lamp_sets"][0]["wattage"]
        self.eff = self.flux / self.power
        self.LORL = d["LORL"] / 100.0
        self.conv = d["conv"]

    def intensity(self, C_deg, gamma_deg):
        """Return I in cd/klm, bilinearly interpolated."""
        C = C_deg % 360
        ci = C / self.Dc
        c0 = int(math.floor(ci)) % self.Mc
        c1 = (c0 + 1) % self.Mc
        tc = ci - math.floor(ci)
        g = max(0.0, min(180.0, gamma_deg))
        gi = g / self.Dg
        g0 = int(math.floor(gi))
        g1 = min(g0 + 1, self.Ng - 1)
        tg = gi - g0
        i00 = self.I[c0][g0]
        i01 = self.I[c0][g1]
        i10 = self.I[c1][g0]
        i11 = self.I[c1][g1]
        v = (1 - tc) * (1 - tg) * i00 + (1 - tc) * tg * i01 + tc * (1 - tg) * i10 + tc * tg * i11
        return max(0.0, v) * self.conv


class Luminaire:
    """A luminaire instance: position, orientation, scaling."""

    def __init__(self, photometry, pos, height, aim_deg=0.0, tilt_deg=0.0,
                 flux_scale=1.0, mf=1.0, mirror_y=False):
        self.ph = photometry
        self.x0, self.y0 = pos
        self.h = height
        self.aim = math.radians(aim_deg)
        self.tilt = math.radians(tilt_deg)
        self.flux_scale = flux_scale
        self.mf = mf
        self.mirror_y = mirror_y

    def _world_to_lum_frame(self, dx, dy):
        """Rotate world offset into luminaire frame, returning (rx2, ry2, rz2)."""
        h = self.h
        ca, sa = math.cos(-self.aim), math.sin(-self.aim)
        rx = ca * dx - sa * dy
        ry = sa * dx + ca * dy
        rz = -h
        if self.mirror_y:
            ry = -ry
        ct, st = math.cos(-self.tilt), math.sin(-self.tilt)
        ry2 = ry * ct - rz * st
        rz2 = ry * st + rz * ct
        return rx, ry2, rz2

    def _candela(self, rx2, ry2, rz2):
        """Return (cd, d, gamma) from luminaire-frame vector."""
        d = math.sqrt(rx2 * rx2 + ry2 * ry2 + rz2 * rz2)
        if d < 1e-6:
            return 0.0, d, 0.0
        cos_g = max(-1.0, min(1.0, -rz2 / d))
        gamma = math.degrees(math.acos(cos_g))
        C = math.degrees(math.atan2(ry2, rx2)) % 360
        I_cdkl = self.ph.intensity(C, gamma)
        cd = I_cdkl * (self.ph.flux / 1000.0) * self.flux_scale * self.mf
        return cd, d, gamma

    def E_at(self, x, y):
        """Illuminance contribution at (x, y) on road (z=0). Returns lux."""
        rx2, ry2, rz2 = self._world_to_lum_frame(x - self.x0, y - self.y0)
        cd, d, _ = self._candela(rx2, ry2, rz2)
        if d < 1e-6:
            return 0.0
        cos_inc = self.h / d
        return cd * cos_inc / (d * d)

    def L_at(self, x, y, observer_xy, observer_h=1.5, road='R3'):
        """Luminance contribution at (x, y) for observer. Returns cd/m².

        CIE 140 / CIE 144 convention:
            beta = 180 - angle_between(observer->P, luminaire->P) in plan view
        beta=0 corresponds to luminaire AHEAD of P along the direction of view
        (specular reflection back to observer); beta=180 corresponds to
        luminaire BEHIND P (between observer and P), which gives near-zero r.
        """
        rx2, ry2, rz2 = self._world_to_lum_frame(x - self.x0, y - self.y0)
        cd, d, gamma = self._candela(rx2, ry2, rz2)
        if d < 1e-6:
            return 0.0
        # CIE 144: tg(γ) = D_horizontal / h  (world geometry, independent of tilt)
        dx, dy = x - self.x0, y - self.y0
        tg = math.sqrt(dx * dx + dy * dy) / self.h
        # Vectors in plan view: observer->P and luminaire->P
        opx = x - observer_xy[0]
        opy = y - observer_xy[1]
        lpx = x - self.x0
        lpy = y - self.y0
        n_op = math.hypot(opx, opy)
        n_lp = math.hypot(lpx, lpy)
        if n_op < 1e-6 or n_lp < 1e-6:
            return 0.0
        cos_th = max(-1.0, min(1.0, (opx * lpx + opy * lpy) / (n_op * n_lp)))
        theta = math.degrees(math.acos(cos_th))
        beta = 180.0 - theta  # CIE 140 convention
        r = r_value(tg, beta, road=road)
        return r * cd / (self.h * self.h)


def build_luminaires(cfg, photometry, flux_scale=1.0):
    """Build all luminaire instances for ±5 periods of one calculation field."""
    arr = cfg["arrangement"]
    h = cfg["h"]
    S = cfg["S"]
    W = cfg["W"]
    arm = cfg["arm"]
    tilt = cfg["tilt"]
    mf = cfg["mf"]

    if arr == "Lineal":
        pole_side = str(cfg.get("pole_side", "left")).lower()
        poles = [dict(side="R" if pole_side == "right" else "L", x_offset=0.0)]
    elif arr == "Bilateral":
        pole_side = str(cfg.get("pole_side", "left")).lower()
        first = "R" if pole_side == "right" else "L"
        second = "L" if first == "R" else "R"
        poles = [dict(side=first, x_offset=0.0), dict(side=second, x_offset=S / 2.0)]
    elif arr == "Central Doble":
        poles = [dict(side="C", x_offset=0.0, mirror=False), dict(side="C", x_offset=0.0, mirror=True)]
    elif arr == "En Isleta":
        poles = [dict(side="C", x_offset=0.0, mirror=False)]
    else:
        poles = [dict(side="L", x_offset=0.0)]

    luminaires = []
    for k in range(-5, 6):
        for p in poles:
            x = k * S + p.get("x_offset", 0.0)
            side = p["side"]
            if side == "L":
                lum_y = 0.0 + arm
                mirror = False
            elif side == "R":
                lum_y = W - arm
                mirror = True
            else:  # C
                lum_y = W / 2.0
                mirror = bool(p.get("mirror", False))
            luminaires.append(
                Luminaire(photometry, (x, lum_y), h,
                          aim_deg=0.0, tilt_deg=tilt,
                          flux_scale=flux_scale, mf=mf, mirror_y=mirror)
            )
    return luminaires


def _make_grid(cfg):
    """Return (xs, ys, n_lanes, lane_width) for CIE 140 evaluation grid."""
    S = cfg["S"]
    W = cfg["W"]
    n_long = 12
    n_lanes = max(1, int(round(W / 3.5)))
    pts_per_lane = 3
    lane_width = W / n_lanes
    xs = [(2 * i - 1) * S / 24 for i in range(1, n_long + 1)]
    ys = []
    for ln in range(n_lanes):
        y0 = ln * lane_width
        for j in range(pts_per_lane):
            ys.append(y0 + (j + 0.5) * lane_width / pts_per_lane)
    return xs, ys, n_lanes, lane_width


def calc_road(cfg, photometry, flux_scale=1.0):
    """CIE 140 illuminance grid. Returns Eavg, Emin, Emax and grid data."""
    xs, ys, n_lanes, lane_width = _make_grid(cfg)
    luminaires = build_luminaires(cfg, photometry, flux_scale=flux_scale)
    Egrid = [[sum(lum.E_at(x, y) for lum in luminaires) for y in ys] for x in xs]
    Eflat = [v for row in Egrid for v in row]
    return dict(
        xs=xs, ys=ys, Egrid=Egrid,
        Eavg=sum(Eflat) / len(Eflat),
        Emin=min(Eflat),
        Emax=max(Eflat),
        n_lanes=n_lanes,
        lane_width=lane_width,
    )


def calc_luminance(cfg, photometry, flux_scale=1.0, road='R3'):
    """CIE 140 luminance grid, observer on near lane (lane 0) at x=-60 m."""
    xs, ys, n_lanes, lane_width = _make_grid(cfg)
    obs_lane = 0  # CIE 140: observer in near (left) lane
    obs_y = (obs_lane + 0.5) * lane_width
    obs_xy = (-60.0, obs_y)
    luminaires = build_luminaires(cfg, photometry, flux_scale=flux_scale)
    Lgrid = [[sum(lum.L_at(x, y, obs_xy, road=road) for lum in luminaires) for y in ys] for x in xs]
    Lflat = [v for row in Lgrid for v in row]
    Lavg = sum(Lflat) / len(Lflat)
    Lmin = min(Lflat)
    Lmax = max(Lflat)
    Uo = Lmin / Lavg if Lavg > 0 else 0.0
    # Ul: longitudinal uniformity along observer's lane centerline
    j_center = min(range(len(ys)), key=lambda j: abs(ys[j] - obs_y))
    Lcenter = [Lgrid[i][j_center] for i in range(len(xs))]
    Ul = (min(Lcenter) / max(Lcenter)) if max(Lcenter) > 0 else 0.0
    # TI: threshold increment (CIE 88 / EN 13201)
    eye = (-60.0, obs_y, 1.5)
    Lv = 0.0
    for lum in luminaires:
        dx = lum.x0 - eye[0]
        dy = lum.y0 - eye[1]
        dz = lum.h - eye[2]
        d = math.sqrt(dx * dx + dy * dy + dz * dz)
        if d < 1e-6:
            continue
        cos_theta = dx / d
        theta = math.degrees(math.acos(max(-1.0, min(1.0, cos_theta))))
        if theta < 1.5 or theta > 60:
            continue
        rx2, ry2, rz2 = lum._world_to_lum_frame(-dx, -dy)
        # rz is relative to lamp, so -dz applies
        # recompute for eye direction from lamp: vector (lamp→eye) = (-dx,-dy,-dz)
        h_lum = lum.h
        rx = -dx
        ry = -dy
        rz = -dz
        if lum.mirror_y:
            ry = -ry
        ct, st = math.cos(-lum.tilt), math.sin(-lum.tilt)
        ry2 = ry * ct - rz * st
        rz2_e = ry * st + rz * ct
        rx2 = rx
        dd = math.sqrt(rx2 * rx2 + ry2 * ry2 + rz2_e * rz2_e)
        if dd < 1e-6:
            continue
        cos_g = max(-1.0, min(1.0, -rz2_e / dd))
        gamma = math.degrees(math.acos(cos_g))
        C = math.degrees(math.atan2(ry2, rx2)) % 360
        cd = lum.ph.intensity(C, gamma) * (lum.ph.flux / 1000.0) * lum.flux_scale * lum.mf
        E_eye = cd * abs(dx / d) / (d * d)
        Lv += 10.0 * E_eye / (theta ** 2)
    TI = (65.0 * Lv / (Lavg ** 0.8)) if Lavg > 0 else 999.0
    return dict(
        Lavg=Lavg, Lmin=Lmin, Lmax=Lmax,
        Uo=Uo, Ul=Ul, TI=TI,
        Lgrid=Lgrid, xs=xs, ys=ys,
        n_lanes=n_lanes, obs=obs_xy,
    )


def calc_SR(cfg, photometry, flux_scale=1.0):
    """Surround Ratio: min of left/right outer-strip / inner-strip illuminance ratio."""
    S = cfg["S"]
    W = cfg["W"]
    luminaires = build_luminaires(cfg, photometry, flux_scale=flux_scale)
    strip_w = min(5.0, W / 2.0)
    n_long = 12
    xs = [(2 * i - 1) * S / 24 for i in range(1, n_long + 1)]

    def strip_avg(y0, y1, n=3):
        ys_s = [y0 + (j + 0.5) * (y1 - y0) / n for j in range(n)]
        total = sum(
            sum(lum.E_at(x, y) for lum in luminaires)
            for x in xs for y in ys_s
        )
        return total / (len(xs) * n)

    inner_L = strip_avg(0, strip_w)
    outer_L = strip_avg(-strip_w, 0)
    inner_R = strip_avg(W - strip_w, W)
    outer_R = strip_avg(W, W + strip_w)
    SR_L = outer_L / inner_L if inner_L > 0 else 0.0
    SR_R = outer_R / inner_R if inner_R > 0 else 0.0
    return min(SR_L, SR_R)


def evaluate(cfg, photometry, flux_scale=1.0, road='R3'):
    """Run all calculations. Returns combined results dict.

    `road` selects the CIE 144 pavement reflection table for luminance
    calculations: 'R1', 'R2', 'R3' or 'R4'.
    """
    eclass = cfg["class"]
    out = {}
    if eclass.startswith("M"):
        rL = calc_luminance(cfg, photometry, flux_scale=flux_scale, road=road)
        out.update(rL)
        out["SR"] = calc_SR(cfg, photometry, flux_scale=flux_scale)
        req = ME_REQ[eclass]
        out["req"] = req
        out["ok_L"] = rL["Lavg"] >= req["L"]
        out["ok_Uo"] = rL["Uo"] >= req["Uo"]
        out["ok_Ul"] = rL["Ul"] >= req["Ul"]
        out["ok_TI"] = rL["TI"] <= req["TI"]
        out["ok_SR"] = out["SR"] >= req["SR"]
        out["compliant"] = all([out["ok_L"], out["ok_Uo"], out["ok_Ul"], out["ok_TI"], out["ok_SR"]])
        out["mode"] = "ME"
    elif eclass.startswith("P"):
        rE = calc_road(cfg, photometry, flux_scale=flux_scale)
        out["Eavg"] = rE["Eavg"]
        out["Emin"] = rE["Emin"]
        req = P_REQ.get(eclass, {})
        out["req"] = req
        out["ok_Eavg"] = rE["Eavg"] >= req.get("Eavg", 0)
        out["ok_Emin"] = rE["Emin"] >= req.get("Emin", 0)
        out["compliant"] = out["ok_Eavg"] and out["ok_Emin"]
        out["mode"] = "P"
    return out
