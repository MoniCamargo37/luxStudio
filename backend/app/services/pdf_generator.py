import io
import math
import base64
from pathlib import Path
from datetime import datetime

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

import asyncio
import concurrent.futures
from jinja2 import Environment, FileSystemLoader
from playwright.sync_api import sync_playwright

from .ldt_loader import get_ldt_by_id
from ..schemas.models import CalculationResult

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"

env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.size": 9,
    "axes.titlesize": 11,
    "axes.labelsize": 9,
    "figure.facecolor": "white",
})


def _make_polar_svg(c_angles, gamma_angles, intensity_grid, lum_name):
    """Polar diagram as base64 SVG."""
    fig, ax = plt.subplots(figsize=(3.6, 3.0), subplot_kw={"projection": "polar"})
    theta = np.radians(gamma_angles)

    def get_plane(ci):
        return [intensity_grid[ci % len(intensity_grid)][gi] for gi in range(len(gamma_angles))]

    c_step = c_angles[1] - c_angles[0] if len(c_angles) > 1 else 90
    ci_0 = 0
    ci_90 = int(round(90 / c_step)) % len(c_angles)
    ci_180 = int(round(180 / c_step)) % len(c_angles)
    ci_270 = int(round(270 / c_step)) % len(c_angles)

    plane_0 = get_plane(ci_0)
    plane_180 = get_plane(ci_180)
    plane_90 = get_plane(ci_90)
    plane_270 = get_plane(ci_270)

    ax.set_theta_zero_location("E")
    ax.set_theta_direction(-1)
    ax.plot(theta, plane_0, "r-", linewidth=1.7, label="C0-180")
    ax.plot(theta, plane_180, "r--", linewidth=0.9, alpha=0.45)
    ax.plot(theta, plane_90, "b-", linewidth=1.7, label="C90-270")
    ax.plot(theta, plane_270, "b--", linewidth=0.9, alpha=0.45)

    max_r = max(max(plane_0), max(plane_90), max(plane_180), max(plane_270)) * 1.12
    ax.set_ylim(0, max_r if max_r > 0 else 1)
    ax.set_title(f"I (cd/klm) - {lum_name}", fontsize=7.5, pad=8)
    ax.legend(loc="upper right", bbox_to_anchor=(1.13, 1.08), fontsize=6.5, framealpha=0.85)
    ax.grid(True, alpha=0.28)
    fig.subplots_adjust(left=0.06, right=0.92, top=0.82, bottom=0.06)
    svg = _fig_to_svg(fig)
    plt.close(fig)
    return svg


def _make_isolines_svg(xs, ys, Lgrid, obs_x, obs_y):
    """Luminance isolines as base64 SVG."""
    if Lgrid is None or len(Lgrid) == 0:
        return None

    fig, ax = plt.subplots(figsize=(6, 3))
    X, Y = np.meshgrid(xs, ys)
    Z = np.array(Lgrid).T

    levels = np.linspace(Z.min(), Z.max(), 12)
    cp = ax.contourf(X, Y, Z, levels=levels, cmap="viridis", alpha=0.85)
    cs = ax.contour(X, Y, Z, levels=levels, colors="white", linewidths=0.4)
    ax.clabel(cs, inline=True, fontsize=6, fmt="%.2f")

    ax.plot(obs_x, obs_y, "ko", markersize=4)
    ax.annotate("Observer", (obs_x, obs_y), fontsize=7, ha="right", va="bottom")

    ax.set_xlabel("x (m)")
    ax.set_ylabel("y (m)")
    ax.set_title("Luminance isolines (cd/m²)", fontsize=10)
    ax.set_aspect("equal")
    fig.colorbar(cp, ax=ax, shrink=0.8, label="cd/m²")
    fig.tight_layout()
    svg = _fig_to_svg(fig)
    plt.close(fig)
    return svg


def _fig_to_svg(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="svg", dpi=150, bbox_inches="tight")
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def _make_road_svg(cfg):
    """Cross-section with independent road and pole scales."""
    VW = 900

    road_top = 275
    road_h = 44
    road_bottom = road_top + road_h

    total_w = cfg.road_width + cfg.sidewalk_left + cfg.sidewalk_right
    max_total_w = 30 + 10 + 10
    h_scale = 620 / max_total_w
    total_px = total_w * h_scale
    section_left = (VW - total_px) / 2

    road_left = section_left + cfg.sidewalk_left * h_scale
    road_right = road_left + cfg.road_width * h_scale

    pole_px = cfg.height * ((road_top - 52) / 20)
    pole_top = road_top - pole_px
    pole_x = road_left
    arm_px = cfg.arm_length * h_scale
    arm_end = pole_x + arm_px
    luminaire_rotation = -cfg.tilt

    VH = int(road_bottom + 92)

    lines = []
    lines.append(f'<rect x="{road_left:.1f}" y="{road_top}" width="{cfg.road_width * h_scale:.1f}" height="{road_h}" fill="#555" rx="1"/>')
    if cfg.sidewalk_left > 0:
        lines.append(f'<rect x="{section_left:.1f}" y="{road_top}" width="{cfg.sidewalk_left * h_scale:.1f}" height="{road_h}" fill="#ccc" rx="1"/>')
    if cfg.sidewalk_right > 0:
        lines.append(f'<rect x="{road_right:.1f}" y="{road_top}" width="{cfg.sidewalk_right * h_scale:.1f}" height="{road_h}" fill="#ccc" rx="1"/>')

    for i in range(1, cfg.lanes):
        lx = road_left + i * cfg.road_width * h_scale / cfg.lanes
        lines.append(f'<line x1="{lx:.1f}" y1="{road_top + 8}" x2="{lx:.1f}" y2="{road_bottom - 8}" stroke="white" stroke-dasharray="6,6" stroke-width="2"/>')

    pw = 8
    lines.append(f'<line x1="{pole_x}" y1="{road_top}" x2="{pole_x}" y2="{pole_top}" stroke="#333" stroke-width="{pw:.1f}"/>')
    lines.append(f'<line x1="{pole_x}" y1="{pole_top}" x2="{arm_end:.1f}" y2="{pole_top}" stroke="#333" stroke-width="{pw * 0.7:.1f}"/>')

    lw = 44
    lh = 16
    lines.append(f'<rect x="{arm_end:.1f}" y="{pole_top - lh/2:.1f}" width="{lw:.1f}" height="{lh:.1f}" fill="#e63946" rx="2" transform="rotate({luminaire_rotation:.1f}, {arm_end:.1f}, {pole_top:.1f})"/>')

    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VW} {VH}" width="100%">'
    svg += "".join(lines)
    svg += f'<text x="{VW/2:.1f}" y="22" text-anchor="middle" font-size="14" font-weight="bold">Cross-section</text>'

    yd = road_bottom + 20
    svg += f'<line x1="{road_left:.1f}" y1="{yd}" x2="{road_right:.1f}" y2="{yd}" stroke="#333" stroke-width="1.5"/>'
    svg += f'<polygon points="{road_left:.1f},{yd} {road_left+6:.1f},{yd-3} {road_left+6:.1f},{yd+3}" fill="#333"/>'
    svg += f'<polygon points="{road_right:.1f},{yd} {road_right-6:.1f},{yd-3} {road_right-6:.1f},{yd+3}" fill="#333"/>'
    svg += f'<text x="{road_left + cfg.road_width * h_scale / 2:.1f}" y="{yd + 17}" text-anchor="middle" font-size="12" font-weight="bold">Road = {cfg.road_width:.1f} m</text>'
    svg += f'<line x1="{section_left:.1f}" y1="{yd + 31}" x2="{section_left + total_px:.1f}" y2="{yd + 31}" stroke="#555" stroke-width="1"/>'
    svg += f'<polygon points="{section_left:.1f},{yd + 31} {section_left+6:.1f},{yd+28} {section_left+6:.1f},{yd+34}" fill="#555"/>'
    svg += f'<polygon points="{section_left + total_px:.1f},{yd + 31} {section_left + total_px - 6:.1f},{yd+28} {section_left + total_px - 6:.1f},{yd+34}" fill="#555"/>'
    svg += f'<text x="{section_left + total_px / 2:.1f}" y="{yd + 48}" text-anchor="middle" font-size="11" fill="#555">Total = {total_w:.1f} m</text>'
    svg += f'<text x="{pole_x + 12:.1f}" y="{road_top - pole_px / 2 + 5:.1f}" text-anchor="start" font-size="12" font-weight="bold">h = {cfg.height:.1f} m</text>'
    svg += "</svg>"

    return svg


def _render_html(result: CalculationResult) -> str:
    cfg = result.config
    ldt_info = result.luminaire

    full_ldt = get_ldt_by_id(ldt_info.id)
    polar_svg = None
    isolines_svg = None

    if full_ldt:
        polar_svg = _make_polar_svg(full_ldt["C"], full_ldt["G"], full_ldt["I"], ldt_info.luminaire_name)

    road_svg = _make_road_svg(cfg)

    template = env.get_template("report.html")

    now = datetime.now().strftime("%d/%m/%Y %H:%M")
    compliant = result.compliant

    return template.render(
        title=f"Lighting Study - {ldt_info.luminaire_name}",
        date=now,
        compliant=compliant,
        compliant_label="PASS" if compliant else "FAIL",
        compliant_color="#10b981" if compliant else "#ef4444",
        luminaire_name=ldt_info.luminaire_name,
        luminaire_power=f"{ldt_info.power:.0f} W",
        luminaire_flux=f"{ldt_info.flux:,.0f} lm",
        luminaire_eff=f"{ldt_info.efficiency:.1f} lm/W",
        luminaire_LORL=f"{ldt_info.LORL:.0f} %",
        luminaire_family=ldt_info.optic_family,
        road_width=f"{cfg.road_width:.1f} m",
        total_width=f"{(cfg.road_width + cfg.sidewalk_left + cfg.sidewalk_right):.1f} m",
        sidewalk_left=f"{cfg.sidewalk_left:.1f} m",
        sidewalk_right=f"{cfg.sidewalk_right:.1f} m",
        lanes=cfg.lanes,
        arrangement=cfg.arrangement,
        height=f"{cfg.height:.1f} m",
        spacing=f"{cfg.spacing:.1f} m",
        arm_length=f"{cfg.arm_length:.1f} m",
        tilt=f"{cfg.tilt:.0f} deg",
        lighting_class=cfg.lighting_class,
        mf=f"{cfg.mf:.2f}",
        pavement=cfg.pavement,
        cct=f"{cfg.cct} K",
        criteria=result.criteria,
        Lavg=f"{result.Lavg:.2f}" if result.Lavg is not None else "-",
        Uo=f"{result.Uo:.3f}" if result.Uo is not None else "-",
        Ul=f"{result.Ul:.3f}" if result.Ul is not None else "-",
        TI=f"{result.TI:.1f}" if result.TI is not None else "-",
        SR=f"{result.SR:.3f}" if result.SR is not None else "-",
        road_svg=road_svg,
        polar_svg=polar_svg,
        isolines_svg=isolines_svg or "",
    )


def _generate_pdf_sync(html: str) -> bytes:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 794, "height": 1123})
        try:
            page.set_content(html, wait_until="networkidle")
            return page.pdf(format="A4", print_background=True, margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"})
        finally:
            page.close()
            browser.close()


async def generate_pdf(result: CalculationResult) -> bytes:
    html = _render_html(result)
    loop = asyncio.get_running_loop()
    with concurrent.futures.ThreadPoolExecutor() as pool:
        return await loop.run_in_executor(pool, _generate_pdf_sync, html)
