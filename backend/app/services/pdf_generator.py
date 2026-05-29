import asyncio
import concurrent.futures
import html
import math
from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from playwright.sync_api import sync_playwright
from ..salvi_lighting import build_luminaires, calc_luminance, calc_road

from .ldt_loader import get_ldt_by_id, get_photometry
from ..schemas.models import CalculationConfig, CalculationResult

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"

env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))


def _fmt(value, digits=2, fallback="-"):
    if value is None:
        return fallback
    try:
        return f"{float(value):.{digits}f}"
    except (TypeError, ValueError):
        return fallback


def _safe(value):
    return html.escape(str(value))


def _points(points):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in points)


def _nice_scale(max_value):
    target = max(400, max_value * 1.08)
    max_r = int(math.ceil(target / 100) * 100)
    # Keep the printed scale stable and readable for roadway luminaire reports.
    return max_r, [100, 200, 300, 400]


def _interp_plane(photometry, c_index):
    c_angles = photometry["C"]
    g_angles = photometry["G"]
    grid = photometry["I"]
    if not c_angles or not g_angles or not grid:
        return [(g, 0.0) for g in range(0, 181, 5)]
    conv = float(photometry.get("conv", 1.0))
    target = c_index % 360
    indexed_angles = [(float(c) % 360, idx) for idx, c in enumerate(c_angles)]
    exact = next((idx for c, idx in indexed_angles if abs(c - target) < 1e-6), None)
    if exact is not None:
        return [(float(g), float(grid[exact][i]) * conv) for i, g in enumerate(g_angles)]

    ordered = sorted(indexed_angles)
    wrapped = ordered + [(ordered[0][0] + 360, ordered[0][1])]
    target_wrapped = target if target >= ordered[0][0] else target + 360
    lower = wrapped[0]
    upper = wrapped[-1]
    for left, right in zip(wrapped, wrapped[1:]):
        if left[0] <= target_wrapped <= right[0]:
            lower, upper = left, right
            break

    span = max(upper[0] - lower[0], 1e-9)
    t = (target_wrapped - lower[0]) / span
    return [
        (float(g), (float(grid[lower[1]][i]) * (1 - t) + float(grid[upper[1]][i]) * t) * conv)
        for i, g in enumerate(g_angles)
    ]


def _closed_plane(plane_a, plane_b):
    forward = [(gamma, value) for gamma, value in plane_a if 0 <= gamma <= 180]
    backward = [(360 - gamma, value) for gamma, value in reversed(plane_b) if 0 < gamma < 180]
    return forward + backward


def renderPolarPhotometrySvg(photometry):
    """Render a technical polar photometry SVG with gamma 0 at the bottom."""
    lum_name = _safe(photometry.get("luminaire_name", "Luminaire"))
    c0 = _interp_plane(photometry, 0)
    c90 = _interp_plane(photometry, 90)
    c180 = _interp_plane(photometry, 180)
    c270 = _interp_plane(photometry, 270)
    red_curve = _closed_plane(c0, c180)
    blue_curve = _closed_plane(c90, c270)
    max_value = max([v for _, v in red_curve + blue_curve] or [400])
    max_r, radial_ticks = _nice_scale(max_value)

    width, height = 620, 500
    cx, cy, radius = 300, 260, 178

    def xy(angle_deg, value):
        a = math.radians(angle_deg)
        r = radius * max(0.0, min(value / max_r, 1.0))
        # LDT gamma convention: 0 is straight down. In this polar diagram,
        # 0 is drawn at the bottom, 90 at the right and 180 at the top.
        return cx + math.sin(a) * r, cy + math.cos(a) * r

    def path_for(curve):
        if not curve:
            return ""
        pts = [xy(a, v) for a, v in curve]
        d = f"M {pts[0][0]:.1f} {pts[0][1]:.1f}"
        for x, y in pts[1:]:
            d += f" L {x:.1f} {y:.1f}"
        return d + " Z"

    grid = []
    for tick in radial_ticks:
        r = radius * tick / max_r
        grid.append(f'<circle cx="{cx}" cy="{cy}" r="{r:.1f}" fill="none" stroke="#d8dee8" stroke-width="1"/>')
        label_angle = math.radians(78)
        lx = cx + math.sin(label_angle) * r
        ly = cy + math.cos(label_angle) * r
        grid.append(
            f'<rect x="{lx + 5:.1f}" y="{ly - 9:.1f}" width="34" height="15" rx="2" fill="white" opacity="0.94"/>'
            f'<text x="{lx + 9:.1f}" y="{ly + 2:.1f}" font-size="11" fill="#475569">{tick}</text>'
        )
    for angle in range(0, 360, 15):
        x1, y1 = xy(angle, 0)
        x2, y2 = xy(angle, max_r)
        stroke = "#cbd5e1" if angle % 45 == 0 else "#e7ebf1"
        width_line = "1.1" if angle % 45 == 0 else "0.7"
        grid.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" stroke-width="{width_line}"/>')

    labels = []
    for angle in range(0, 360, 45):
        lx, ly = xy(angle, max_r * (1.22 if angle == 0 else 1.16))
        labels.append(
            f'<text x="{lx:.1f}" y="{ly + 4:.1f}" text-anchor="middle" font-size="13" font-weight="700" fill="#111827">{angle}&#176;</text>'
        )

    return f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="Polar photometry diagram">
  <rect x="0" y="0" width="{width}" height="{height}" fill="white"/>
  <text x="28" y="30" font-size="15" font-weight="800" fill="#0f172a">I (cd/klm) - {lum_name}</text>
  <text x="28" y="50" font-size="10.5" fill="#64748b">Photometric distribution, normalized per 1000 lm</text>
  <text x="28" y="68" font-size="10.5" fill="#64748b">Radial scale: {', '.join(str(t) for t in radial_ticks[:4])} cd/klm</text>
  <g>{''.join(grid)}</g>
  <path d="{path_for(red_curve)}" fill="none" stroke="#ef4444" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="{path_for(blue_curve)}" fill="none" stroke="#2563eb" stroke-width="2.4" stroke-linejoin="round"/>
  <circle cx="{cx}" cy="{cy}" r="3" fill="#111827"/>
  <g>{''.join(labels)}</g>
  <g transform="translate(430 36)">
    <rect x="0" y="0" width="150" height="54" rx="6" fill="white" stroke="#dbe3ef"/>
    <line x1="14" y1="18" x2="48" y2="18" stroke="#ef4444" stroke-width="2.8"/>
    <text x="58" y="22" font-size="12" font-weight="700" fill="#334155">C0-180</text>
    <line x1="14" y1="38" x2="48" y2="38" stroke="#2563eb" stroke-width="2.8"/>
    <text x="58" y="42" font-size="12" font-weight="700" fill="#334155">C90-270</text>
  </g>
</svg>
"""


def renderRoadPlanSvg(config: CalculationConfig):
    """Render a proportional top view of the road, lanes, sidewalks and luminaires."""
    total_w = config.road_width + config.sidewalk_left + config.sidewalk_right
    width, height = 900, 360
    margin_x, road_x = 88, 88
    usable_w = width - 2 * margin_x
    scale_x = usable_w / max(config.spacing, 1)
    scale_y = 210 / max(total_w, 1)
    top = 78
    section_h = total_w * scale_y
    road_y = top + config.sidewalk_left * scale_y
    road_h = config.road_width * scale_y
    right_sidewalk_y = road_y + road_h

    def y_from_m(m):
        return top + m * scale_y

    dims = []
    dims.append(_dimension(road_x, top + section_h + 28, road_x + usable_w, top + section_h + 28, f"Calculation length / spacing = {config.spacing:.1f} m"))
    dims.append(_dimension(road_x + usable_w + 28, road_y, road_x + usable_w + 28, road_y + road_h, f"Roadway = {config.road_width:.1f} m", vertical=True))
    if config.pole_offset > 0:
        dims.append(_dimension(road_x - 70, road_y - config.pole_offset * scale_y, road_x - 70, road_y, f"Pole offset = {config.pole_offset:.2f} m", vertical=True))
    if config.sidewalk_left > 0:
        dims.append(_dimension(road_x - 26, top, road_x - 26, road_y, f"{config.sidewalk_left:.1f} m", vertical=True))
    if config.sidewalk_right > 0:
        dims.append(_dimension(road_x - 48, right_sidewalk_y, road_x - 48, top + section_h, f"{config.sidewalk_right:.1f} m", vertical=True))

    lane_lines = []
    for i in range(1, config.lanes):
        y = road_y + road_h * i / config.lanes
        lane_lines.append(f'<line x1="{road_x}" y1="{y:.1f}" x2="{road_x + usable_w}" y2="{y:.1f}" stroke="white" stroke-width="2" stroke-dasharray="16 12"/>')

    arrows = []
    for i in range(config.lanes):
        ly = road_y + road_h * (i + 0.5) / config.lanes
        direction = 1 if i % 2 == 0 else -1
        ax = road_x + usable_w * (0.32 if direction == 1 else 0.68)
        arrows.append(_traffic_arrow(ax, ly, 70 * direction))

    luminaires = _plan_luminaires(config, road_x, road_y, usable_w, road_h, scale_x, scale_y)

    return f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">
  <rect width="{width}" height="{height}" fill="white"/>
  <text x="28" y="34" font-size="17" font-weight="800" fill="#0f172a">Street plan view</text>
  <text x="28" y="53" font-size="11" fill="#64748b">Calculation field, carriageway, pedestrian areas and luminaire positions</text>
  <rect x="{road_x}" y="{top:.1f}" width="{usable_w}" height="{section_h:.1f}" fill="#d7dee8"/>
  {f'<rect x="{road_x}" y="{top:.1f}" width="{usable_w}" height="{config.sidewalk_left * scale_y:.1f}" fill="#e8edf3"/>' if config.sidewalk_left > 0 else ''}
  <rect x="{road_x}" y="{road_y:.1f}" width="{usable_w}" height="{road_h:.1f}" fill="#59616c"/>
  {f'<rect x="{road_x}" y="{right_sidewalk_y:.1f}" width="{usable_w}" height="{config.sidewalk_right * scale_y:.1f}" fill="#e8edf3"/>' if config.sidewalk_right > 0 else ''}
  {''.join(lane_lines)}
  <text x="{road_x + 10}" y="{y_from_m(config.sidewalk_left / 2) + 4:.1f}" font-size="12" font-weight="700" fill="#475569">Sidewalk / Pedestrian area 1</text>
  <text x="{road_x + 10}" y="{road_y + road_h / 2 + 4:.1f}" font-size="13" font-weight="800" fill="white">Roadway</text>
  <text x="{road_x + 10}" y="{right_sidewalk_y + max(config.sidewalk_right, 0.2) * scale_y / 2 + 4:.1f}" font-size="12" font-weight="700" fill="#475569">Sidewalk / Pedestrian area 2</text>
  {''.join(arrows)}
  {''.join(luminaires)}
  <line x1="{road_x}" y1="{top + section_h + 8:.1f}" x2="{road_x}" y2="{top + section_h + 21:.1f}" stroke="#111827" stroke-width="1"/>
  <line x1="{road_x + usable_w}" y1="{top + section_h + 8:.1f}" x2="{road_x + usable_w}" y2="{top + section_h + 21:.1f}" stroke="#111827" stroke-width="1"/>
  <text x="{road_x:.1f}" y="{top + section_h + 42:.1f}" text-anchor="middle" font-size="12" font-weight="700" fill="#334155">0.00</text>
  <text x="{road_x + usable_w:.1f}" y="{top + section_h + 42:.1f}" text-anchor="middle" font-size="12" font-weight="700" fill="#334155">{config.spacing:.2f} m</text>
  <text x="{road_x + usable_w - 6:.1f}" y="{road_y - 12:.1f}" text-anchor="end" font-size="11" font-weight="700" fill="#1e40af">mast positions / spacing</text>
  {''.join(dims)}
</svg>
"""


def _plan_luminaires(config, road_x, road_y, usable_w, road_h, scale_x, scale_y):
    y_pole_left = road_y - config.pole_offset * scale_y
    y_pole_right = road_y + road_h + config.pole_offset * scale_y
    overhang = max(config.arm_length, 0) * scale_y
    xs = [road_x, road_x + usable_w]
    items = []

    def lum(x, y, side=1):
        head_y = y + side * overhang
        items.append(f'<line x1="{x:.1f}" y1="{y - 9:.1f}" x2="{x:.1f}" y2="{y + 9:.1f}" stroke="#ef4444" stroke-width="3"/>')
        items.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="#111827"/>')
        items.append(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x:.1f}" y2="{head_y:.1f}" stroke="#111827" stroke-width="2"/>')
        items.append(f'<rect x="{x - 13:.1f}" y="{head_y - 5:.1f}" width="26" height="10" rx="2" fill="#2563eb"/>')

    if config.arrangement == "Bilateral":
        for x in xs:
            lum(x, y_pole_left, 1)
            lum(x, y_pole_right, -1)
    elif config.arrangement == "Central Doble":
        for x in xs:
            lum(x, road_y + road_h / 2, -1)
            lum(x, road_y + road_h / 2, 1)
    elif config.arrangement == "En Isleta":
        for x in xs:
            lum(x, road_y + road_h / 2, 1)
    else:
        for x in xs:
            lum(x, y_pole_left, 1)
    return items


def _traffic_arrow(x, y, length):
    x2 = x + length
    head = 9 if length > 0 else -9
    return (
        f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x2:.1f}" y2="{y:.1f}" stroke="#f8fafc" stroke-width="2.2"/>'
        f'<polygon points="{x2:.1f},{y:.1f} {x2 - head:.1f},{y - 6:.1f} {x2 - head:.1f},{y + 6:.1f}" fill="#f8fafc"/>'
    )


def _dimension(x1, y1, x2, y2, label, vertical=False):
    if vertical:
        mid_y = (y1 + y2) / 2
        return (
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x1:.1f}" y2="{y2:.1f}" stroke="#334155" stroke-width="1"/>'
            f'<line x1="{x1 - 5:.1f}" y1="{y1:.1f}" x2="{x1 + 5:.1f}" y2="{y1:.1f}" stroke="#334155" stroke-width="1"/>'
            f'<line x1="{x1 - 5:.1f}" y1="{y2:.1f}" x2="{x1 + 5:.1f}" y2="{y2:.1f}" stroke="#334155" stroke-width="1"/>'
            f'<text x="{x1 - 8:.1f}" y="{mid_y:.1f}" transform="rotate(-90 {x1 - 8:.1f} {mid_y:.1f})" text-anchor="middle" font-size="11" font-weight="700" fill="#334155">{_safe(label)}</text>'
        )
    mid_x = (x1 + x2) / 2
    return (
        f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#334155" stroke-width="1"/>'
        f'<polygon points="{x1:.1f},{y1:.1f} {x1 + 7:.1f},{y1 - 4:.1f} {x1 + 7:.1f},{y1 + 4:.1f}" fill="#334155"/>'
        f'<polygon points="{x2:.1f},{y2:.1f} {x2 - 7:.1f},{y2 - 4:.1f} {x2 - 7:.1f},{y2 + 4:.1f}" fill="#334155"/>'
        f'<text x="{mid_x:.1f}" y="{y1 + 17:.1f}" text-anchor="middle" font-size="11" font-weight="700" fill="#334155">{_safe(label)}</text>'
    )


def renderRoadSectionSvg(config: CalculationConfig):
    """Render a technical transverse section with dimensions, arm, tilt and road proportions."""
    width, height = 900, 420
    ground_y = 300
    total_w = config.road_width + config.sidewalk_left + config.sidewalk_right
    scale_x = 560 / max(total_w, 1)
    left = (width - total_w * scale_x) / 2
    road_left = left + config.sidewalk_left * scale_x
    road_w = config.road_width * scale_x
    pole_x = road_left - config.pole_offset * scale_x
    pole_top = 74
    pole_scale = (ground_y - pole_top) / max(config.height, 1)
    arm_px = config.arm_length * scale_x
    head_x = pole_x + arm_px
    tilt_rad = math.radians(config.tilt)
    head_len, head_h = 58, 18
    head_angle = -config.tilt

    lanes = []
    for i in range(1, config.lanes):
        x = road_left + road_w * i / config.lanes
        lanes.append(f'<line x1="{x:.1f}" y1="{ground_y + 8}" x2="{x:.1f}" y2="{ground_y + 40}" stroke="white" stroke-width="2" stroke-dasharray="7 6"/>')

    dims = [
        _dimension(road_left, ground_y + 66, road_left + road_w, ground_y + 66, f"Roadway = {config.road_width:.1f} m"),
        _dimension(left, ground_y + 90, left + total_w * scale_x, ground_y + 90, f"Total width = {total_w:.1f} m"),
        _dimension(pole_x - 34, pole_top, pole_x - 34, ground_y, f"Mounting height = {config.height:.1f} m", vertical=True),
    ]
    if config.arm_length > 0:
        dims.append(_dimension(pole_x, pole_top - 22, head_x, pole_top - 22, f"Overhang / arm = {config.arm_length:.1f} m"))
    if config.pole_offset > 0:
        dims.append(_dimension(pole_x, ground_y - 22, road_left, ground_y - 22, f"Pole offset = {config.pole_offset:.2f} m"))

    return f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">
  <rect width="{width}" height="{height}" fill="white"/>
  <text x="28" y="34" font-size="17" font-weight="800" fill="#0f172a">Transverse section</text>
  <text x="28" y="53" font-size="11" fill="#64748b">Pole height, bracket arm, luminaire tilt and roadway section</text>
  <rect x="{left:.1f}" y="{ground_y}" width="{config.sidewalk_left * scale_x:.1f}" height="48" fill="#d8dee7"/>
  <rect x="{road_left:.1f}" y="{ground_y}" width="{road_w:.1f}" height="48" fill="#59616c"/>
  <rect x="{road_left + road_w:.1f}" y="{ground_y}" width="{config.sidewalk_right * scale_x:.1f}" height="48" fill="#d8dee7"/>
  {''.join(lanes)}
  <line x1="{pole_x:.1f}" y1="{ground_y}" x2="{pole_x:.1f}" y2="{pole_top:.1f}" stroke="#263241" stroke-width="9" stroke-linecap="square"/>
  <rect x="{pole_x - 16:.1f}" y="{ground_y - 7}" width="32" height="10" fill="#263241"/>
  <line x1="{pole_x:.1f}" y1="{pole_top:.1f}" x2="{head_x:.1f}" y2="{pole_top:.1f}" stroke="#263241" stroke-width="6" stroke-linecap="round"/>
  <circle cx="{pole_x - 55:.1f}" cy="{(pole_top + ground_y) / 2:.1f}" r="14" fill="white" stroke="#111827" stroke-width="2"/>
  <text x="{pole_x - 55:.1f}" y="{(pole_top + ground_y) / 2 + 5:.1f}" text-anchor="middle" font-size="14" font-weight="900" fill="#111827">1</text>
  <circle cx="{(pole_x + head_x) / 2:.1f}" cy="{pole_top - 48:.1f}" r="14" fill="white" stroke="#111827" stroke-width="2"/>
  <text x="{(pole_x + head_x) / 2:.1f}" y="{pole_top - 43:.1f}" text-anchor="middle" font-size="14" font-weight="900" fill="#111827">2</text>
  <g transform="rotate({head_angle:.1f} {head_x:.1f} {pole_top:.1f})">
    <rect x="{head_x:.1f}" y="{pole_top - head_h / 2:.1f}" width="{head_len}" height="{head_h}" rx="3" fill="#2563eb"/>
    <line x1="{head_x + 5:.1f}" y1="{pole_top + head_h / 2 + 3:.1f}" x2="{head_x + head_len - 7:.1f}" y2="{pole_top + head_h / 2 + 3:.1f}" stroke="#60a5fa" stroke-width="2"/>
  </g>
  <circle cx="{head_x + 70:.1f}" cy="{pole_top - 32:.1f}" r="14" fill="white" stroke="#111827" stroke-width="2"/>
  <text x="{head_x + 70:.1f}" y="{pole_top - 27:.1f}" text-anchor="middle" font-size="14" font-weight="900" fill="#111827">3</text>
  <circle cx="{head_x + 8:.1f}" cy="{pole_top + 40:.1f}" r="14" fill="white" stroke="#111827" stroke-width="2"/>
  <text x="{head_x + 8:.1f}" y="{pole_top + 45:.1f}" text-anchor="middle" font-size="14" font-weight="900" fill="#111827">4</text>
  <path d="M {head_x + 72:.1f} {pole_top:.1f} A 45 45 0 0 {1 if config.tilt >= 0 else 0} {head_x + 72 * math.cos(tilt_rad):.1f} {pole_top - 72 * math.sin(tilt_rad):.1f}" fill="none" stroke="#ef4444" stroke-width="1.6"/>
  <text x="{head_x + 82:.1f}" y="{pole_top - 12 if config.tilt >= 0 else pole_top + 26:.1f}" font-size="12" font-weight="800" fill="#ef4444">{config.tilt:.0f}&#176;</text>
  <text x="{pole_x + 18:.1f}" y="{ground_y - 18:.1f}" font-size="11" font-weight="700" fill="#475569">pole at road edge, luminaire projected over carriageway</text>
  {''.join(dims)}
</svg>
"""


def _cfg_dict(config: CalculationConfig):
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


def _calculation_grids(result: CalculationResult, ldt_id: str):
    photometry = get_photometry(ldt_id)
    if photometry is None:
        return {}
    cfg = _cfg_dict(result.config)
    flux_scale = 1.0
    if getattr(photometry, "flux", 0):
        flux_scale = result.luminaire.flux / photometry.flux
    grids = {}
    try:
        road = calc_road(cfg, photometry, flux_scale=flux_scale)
        grids["illuminance"] = {
            "title": "Roadway illuminance",
            "unit": "lux",
            "xs": road["xs"],
            "ys": road["ys"],
            "values": road["Egrid"],
            "avg": road["Eavg"],
            "min": road["Emin"],
            "max": road["Emax"],
            "zone": "roadway",
        }
    except Exception:
        pass
    if result.mode == "ME":
        try:
            lum = calc_luminance(cfg, photometry, flux_scale=flux_scale, road=result.config.pavement)
            grids["luminance"] = {
                "title": "Roadway luminance - Observer 1",
                "unit": "cd/m&#178;",
                "xs": lum["xs"],
                "ys": lum["ys"],
                "values": lum["Lgrid"],
                "avg": lum["Lavg"],
                "min": lum["Lmin"],
                "max": lum["Lmax"],
                "zone": "observer",
                "observer": lum.get("obs"),
                "pavement": result.config.pavement,
            }
        except Exception:
            pass
    return grids


def _visible_luminaires(config: CalculationConfig, photometry, flux_scale):
    cfg = _cfg_dict(config)
    luminaires = build_luminaires(cfg, photometry, flux_scale=flux_scale)
    margin = max(config.spacing * 0.02, 0.5)
    return [
        lum for lum in luminaires
        if -margin <= lum.x0 <= config.spacing + margin
    ]


def _field_contours(x_coords, y_coords, values, level):
    """Marching-squares contour segments for a rectilinear grid."""
    segments = []

    def crossing(p1, p2, v1, v2):
        if abs(v2 - v1) < 1e-12:
            t = 0.5
        else:
            t = (level - v1) / (v2 - v1)
        t = max(0.0, min(1.0, t))
        return p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t

    for ix in range(len(x_coords) - 1):
        for iy in range(len(y_coords) - 1):
            p = [
                (x_coords[ix], y_coords[iy]),
                (x_coords[ix + 1], y_coords[iy]),
                (x_coords[ix + 1], y_coords[iy + 1]),
                (x_coords[ix], y_coords[iy + 1]),
            ]
            v = [
                values[ix][iy],
                values[ix + 1][iy],
                values[ix + 1][iy + 1],
                values[ix][iy + 1],
            ]
            pts = []
            for a, b in ((0, 1), (1, 2), (2, 3), (3, 0)):
                va, vb = v[a], v[b]
                if (va < level <= vb) or (vb < level <= va):
                    pts.append(crossing(p[a], p[b], va, vb))
            if len(pts) == 2:
                segments.append((pts[0], pts[1]))
            elif len(pts) == 4:
                segments.append((pts[0], pts[1]))
                segments.append((pts[2], pts[3]))
    return segments


def _dense_isoline_field(calculationGrid, config: CalculationConfig, photometry, flux_scale, include_sidewalks):
    cfg = _cfg_dict(config)
    luminaires = build_luminaires(cfg, photometry, flux_scale=flux_scale)
    nx, ny = 74, 46
    x_min, x_max = 0.0, config.spacing
    y_min = -config.sidewalk_left if include_sidewalks else 0.0
    y_max = config.road_width + (config.sidewalk_right if include_sidewalks else 0.0)
    if y_max <= y_min:
        y_min, y_max = 0.0, max(config.road_width, 1.0)
    xs = [x_min + (x_max - x_min) * i / (nx - 1) for i in range(nx)]
    ys = [y_min + (y_max - y_min) * j / (ny - 1) for j in range(ny)]
    if calculationGrid.get("unit") == "lux":
        values = [[sum(lum.E_at(x, y) for lum in luminaires) for y in ys] for x in xs]
    else:
        observer_xy = calculationGrid.get("observer") or (-60.0, config.road_width / max(config.lanes, 1) / 2.0)
        pavement = calculationGrid.get("pavement", config.pavement)
        values = [[sum(lum.L_at(x, y, observer_xy, road=pavement) for lum in luminaires) for y in ys] for x in xs]
    flat = [v for col in values for v in col]
    return xs, ys, values, min(flat), max(flat)


def renderIsoLinesSvg(calculationGrid, config: CalculationConfig, photometry=None, flux_scale=1.0):
    """Render technical isolines from the calculated photometric field around each luminaire."""
    xs = calculationGrid.get("xs", [])
    ys = calculationGrid.get("ys", [])
    values = calculationGrid.get("values", [])
    unit = calculationGrid.get("unit", "lux")
    title = _safe(calculationGrid.get("title", "Isolines"))
    if not xs or not ys or not values:
        return ""

    include_sidewalks = calculationGrid.get("unit") == "lux"
    if photometry is not None:
        field_xs, field_ys, field_values, vmin, vmax = _dense_isoline_field(
            calculationGrid, config, photometry, flux_scale, include_sidewalks
        )
    else:
        field_xs, field_ys, field_values = xs, ys, values
        flat = [float(v) for row in values for v in row]
        vmin, vmax = min(flat), max(flat)
    if vmax <= vmin:
        levels = [vmax]
    else:
        levels = [vmin + (vmax - vmin) * p for p in (0.20, 0.38, 0.58, 0.78)]
    width, height = 900, 390
    plot_x, plot_y, plot_w, plot_h = 86, 78, 720, 215
    total_w = config.road_width + config.sidewalk_left + config.sidewalk_right
    y_min, y_max = min(field_ys), max(field_ys)
    road_y = plot_y + (0 - y_min) / max(y_max - y_min, 1) * plot_h
    road_h = config.road_width / max(y_max - y_min, 1) * plot_h

    x_min, x_max = min(field_xs), max(field_xs)

    def sx(x):
        return plot_x + (x - x_min) / max(x_max - x_min, 1) * plot_w

    def sy(y):
        return plot_y + (y - y_min) / max(y_max - y_min, 1) * plot_h

    grid_pts = []
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            value = values[i][j]
            color = "#1e40af" if value >= (vmin + vmax) / 2 else "#64748b"
            grid_pts.append(f'<circle cx="{sx(x):.1f}" cy="{sy(y):.1f}" r="2.2" fill="{color}" opacity="0.72"/>')

    contours = []
    colors = ["#60a5fa", "#22c55e", "#f59e0b", "#ef4444"]
    for idx, level in enumerate(levels):
        segments = _field_contours(field_xs, field_ys, field_values, level)
        for (x1, y1), (x2, y2) in segments:
            contours.append(
                f'<line x1="{sx(x1):.1f}" y1="{sy(y1):.1f}" x2="{sx(x2):.1f}" y2="{sy(y2):.1f}" '
                f'stroke="{colors[idx]}" stroke-width="1.7" stroke-linecap="round" opacity="0.9"/>'
            )
        label_x = plot_x + plot_w - 116
        label_y = plot_y + 20 + idx * 22
        contours.append(
            f'<rect x="{label_x - 7:.1f}" y="{label_y - 14:.1f}" width="108" height="19" rx="3" fill="white" opacity="0.9" stroke="#dbe3ef"/>'
            f'<line x1="{label_x:.1f}" y1="{label_y - 4:.1f}" x2="{label_x + 20:.1f}" y2="{label_y - 4:.1f}" stroke="{colors[idx]}" stroke-width="2.4"/>'
            f'<text x="{label_x + 26:.1f}" y="{label_y:.1f}" font-size="10" font-weight="800" fill="{colors[idx]}">{_fmt(level, 2)} {unit}</text>'
        )

    lanes = []
    for lane in range(1, config.lanes):
        y = road_y + road_h * lane / config.lanes
        lanes.append(f'<line x1="{plot_x}" y1="{y:.1f}" x2="{plot_x + plot_w}" y2="{y:.1f}" stroke="white" stroke-width="2" stroke-dasharray="14 10"/>')

    lum_markers = []
    if photometry is not None:
        for lum in _visible_luminaires(config, photometry, flux_scale):
            if y_min <= lum.y0 <= y_max:
                x, y = sx(lum.x0), sy(lum.y0)
                lum_markers.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="6.2" fill="#111827" stroke="white" stroke-width="1.6"/>')
                lum_markers.append(f'<path d="M {x - 12:.1f} {y:.1f} L {x + 12:.1f} {y:.1f} M {x:.1f} {y - 12:.1f} L {x:.1f} {y + 12:.1f}" stroke="#111827" stroke-width="1.2"/>')

    uniformity = (vmin / calculationGrid.get("avg", vmax)) if calculationGrid.get("avg", 0) else 0
    return f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">
  <rect width="{width}" height="{height}" fill="white"/>
  <text x="28" y="34" font-size="17" font-weight="800" fill="#0f172a">{title}</text>
  <text x="28" y="53" font-size="11" fill="#64748b">Real contour lines from luminaire positions, with EN 13201 calculation points overlaid</text>
  <rect x="{plot_x}" y="{plot_y}" width="{plot_w}" height="{plot_h}" fill="#e8edf3" stroke="#cbd5e1"/>
  <rect x="{plot_x}" y="{road_y:.1f}" width="{plot_w}" height="{road_h:.1f}" fill="#59616c"/>
  {''.join(lanes)}
  {''.join(contours)}
  {''.join(lum_markers)}
  {''.join(grid_pts)}
  <line x1="{plot_x}" y1="{plot_y + plot_h + 24}" x2="{plot_x + plot_w}" y2="{plot_y + plot_h + 24}" stroke="#334155"/>
  <text x="{plot_x + plot_w / 2}" y="{plot_y + plot_h + 42}" text-anchor="middle" font-size="11" font-weight="700" fill="#334155">x coordinate over spacing ({config.spacing:.1f} m)</text>
  <g transform="translate(820 94)">
    <rect x="0" y="0" width="60" height="150" rx="6" fill="#f8fafc" stroke="#dbe3ef"/>
    <text x="30" y="22" text-anchor="middle" font-size="10" fill="#64748b">Scale</text>
    <text x="30" y="48" text-anchor="middle" font-size="12" font-weight="800" fill="#0f172a">Avg</text>
    <text x="30" y="64" text-anchor="middle" font-size="11" fill="#334155">{_fmt(calculationGrid.get("avg"), 2)}</text>
    <text x="30" y="91" text-anchor="middle" font-size="12" font-weight="800" fill="#0f172a">Min</text>
    <text x="30" y="107" text-anchor="middle" font-size="11" fill="#334155">{_fmt(vmin, 2)}</text>
    <text x="30" y="133" text-anchor="middle" font-size="12" font-weight="800" fill="#0f172a">Min/Avg</text>
    <text x="30" y="147" text-anchor="middle" font-size="10" fill="#334155">{_fmt(uniformity, 3)}</text>
  </g>
</svg>
"""


def renderResultsTable(result: CalculationResult):
    rows = []
    for criterion in result.criteria:
        status_class = "ok" if criterion.passed else "fail"
        status = "PASS" if criterion.passed else "FAIL"
        rows.append(
            f"<tr><td>{_safe(criterion.name)}</td><td>{_fmt(criterion.value, 3)}</td>"
            f"<td>{_fmt(criterion.required, 3)}</td><td><span class=\"{status_class}\">{status}</span></td></tr>"
        )
    overall = "PASS" if result.compliant else "FAIL"
    overall_class = "ok" if result.compliant else "fail"
    return (
        "<table class=\"criteria-table\"><tr><th>Criterion</th><th>Value</th><th>Required</th><th>Status</th></tr>"
        + "".join(rows)
        + f"<tr class=\"result-row\"><td colspan=\"3\">Overall compliance</td><td><span class=\"{overall_class}\">{overall}</span></td></tr></table>"
    )


def _point_table(grid, max_rows=10, max_cols=12):
    if not grid:
        return ""
    xs = grid.get("xs", [])[:max_cols]
    ys = grid.get("ys", [])[:max_rows]
    values = grid.get("values", [])
    unit = grid.get("unit", "")
    header = "".join(f"<th>x={_fmt(x, 1)}</th>" for x in xs)
    rows = []
    for j, y in enumerate(ys):
        cells = []
        for i, _ in enumerate(xs):
            try:
                cells.append(f"<td>{_fmt(values[i][j], 2)}</td>")
            except Exception:
                cells.append("<td>-</td>")
        rows.append(f"<tr><th>y={_fmt(y, 1)}</th>{''.join(cells)}</tr>")
    return (
        f"<div class=\"table-note\">Values in {unit}. Coordinates correspond to the isoline diagram.</div>"
        f"<table class=\"point-table\"><tr><th>y / x</th>{header}</tr>{''.join(rows)}</table>"
    )


def _render_html(result: CalculationResult) -> str:
    cfg = result.config
    ldt_info = result.luminaire
    full_ldt = get_ldt_by_id(ldt_info.id)
    photometry = get_photometry(ldt_info.id)
    flux_scale = 1.0
    if photometry is not None and getattr(photometry, "flux", 0):
        flux_scale = ldt_info.flux / photometry.flux
    grids = _calculation_grids(result, ldt_info.id)
    primary_grid = grids.get("luminance") or grids.get("illuminance")
    illuminance_grid = grids.get("illuminance")
    luminance_grid = grids.get("luminance")

    template = env.get_template("report.html")
    now = datetime.now().strftime("%d/%m/%Y %H:%M")

    return template.render(
        title=f"Road Lighting Report - {ldt_info.luminaire_name}",
        date=now,
        standard="CIE 140 / EN 13201",
        compliant=result.compliant,
        compliant_label="PASS" if result.compliant else "FAIL",
        compliant_color="#10b981" if result.compliant else "#ef4444",
        luminaire=ldt_info,
        cfg=cfg,
        total_width=cfg.road_width + cfg.sidewalk_left + cfg.sidewalk_right,
        road_plan_svg=renderRoadPlanSvg(cfg),
        road_section_svg=renderRoadSectionSvg(cfg),
        mini_section_svg=renderRoadSectionSvg(cfg),
        polar_svg=renderPolarPhotometrySvg(full_ldt or {"luminaire_name": ldt_info.luminaire_name, "C": [], "G": [], "I": []}),
        iso_luminance_svg=renderIsoLinesSvg(luminance_grid, cfg, photometry, flux_scale) if luminance_grid else "",
        iso_illuminance_svg=renderIsoLinesSvg(illuminance_grid, cfg, photometry, flux_scale) if illuminance_grid else "",
        results_table=renderResultsTable(result),
        point_table=_point_table(primary_grid),
        Lavg=_fmt(result.Lavg, 2),
        Uo=_fmt(result.Uo, 3),
        Ul=_fmt(result.Ul, 3),
        TI=_fmt(result.TI, 1),
        SR=_fmt(result.SR, 3),
        Eavg=_fmt(result.Eavg or (illuminance_grid or {}).get("avg"), 2),
        Emin=_fmt(result.Emin or (illuminance_grid or {}).get("min"), 2),
        Emax=_fmt((illuminance_grid or {}).get("max"), 2),
    )


def _generate_pdf_sync(html_doc: str) -> bytes:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 794, "height": 1123})
        try:
            page.set_content(html_doc, wait_until="networkidle")
            return page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"},
            )
        finally:
            page.close()
            browser.close()


async def generate_pdf(result: CalculationResult) -> bytes:
    html_doc = _render_html(result)
    loop = asyncio.get_running_loop()
    with concurrent.futures.ThreadPoolExecutor() as pool:
        return await loop.run_in_executor(pool, _generate_pdf_sync, html_doc)

