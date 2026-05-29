"""DIALux-style PDF report for a single street-lighting configuration."""
import math
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.patches import Rectangle

from .calc import (
    Photometry, build_luminaires, calc_luminance, calc_road, calc_SR,
    ME_REQ, P_REQ,
)

# Report metadata — override by passing cfg keys or setting module-level variables
DATE = "29.04.2026"
PROJECT = "Estudio Iluminación Pública tipo SALVI"
CLIENT = "SALVI"
ADDR1 = "Av. del Valles 36, P.I. Cantallops, Lliçà de Vall"
ADDR2 = "08185 Barcelona Spain"
USER = "Javier Elizalde"
PHONE = "+34667533229"
EMAIL = "elizalde@salvi.es"


def _add_header(fig, title_left, title_right):
    fig.text(0.07, 0.96, "Estudio Iluminacion Publica tipo para CNEL ECUADOR",
             fontsize=8, color="white",
             bbox=dict(facecolor="#3b3b3b", edgecolor="none", pad=4))
    fig.text(0.93, 0.965, "DIA", fontsize=22, color="#000",
             ha="right", va="center", weight="light")
    fig.text(0.97, 0.965, "Lux", fontsize=22, color="#1f78b4",
             ha="right", va="center", weight="bold")
    fig.text(0.97, 0.94, DATE, fontsize=8, ha="right", color="#666")
    fig.text(0.07, 0.90, CLIENT, fontsize=9, weight="bold")
    fig.text(0.07, 0.875, ADDR1, fontsize=8)
    fig.text(0.07, 0.86, ADDR2, fontsize=8)
    fig.text(0.97, 0.90, "Proyecto elaborado por  " + USER, fontsize=8, ha="right")
    fig.text(0.97, 0.885, "Teléfono   " + PHONE, fontsize=8, ha="right")
    fig.text(0.97, 0.870, "Fax", fontsize=8, ha="right")
    fig.text(0.97, 0.855, "e-Mail   " + EMAIL, fontsize=8, ha="right")
    fig.text(0.55, 0.81, title_left, fontsize=11, weight="bold", ha="left")
    fig.text(0.97, 0.81, title_right, fontsize=14, weight="bold", ha="right", color="#222")
    fig.add_artist(plt.Line2D([0.07, 0.97], [0.795, 0.795], color="#666", lw=0.7))
    fig.add_artist(plt.Line2D([0.07, 0.97], [0.835, 0.835], color="#888", lw=0.4))


def _draw_plan(ax, cfg):
    S = cfg["S"]; W = cfg["W"]; Wa = cfg["Wa"]; arr = cfg["arrangement"]
    L = max(40, 2 * S)
    ax.set_xlim(-1, L + 1)
    ax.set_ylim(-Wa - 2, W + Wa + 2)
    ax.set_aspect("equal")
    ax.add_patch(Rectangle((0, 0), L, W, fill=False, edgecolor="black", lw=1))
    if Wa > 0:
        ax.add_patch(Rectangle((0, -Wa), L, Wa, fill=False, edgecolor="gray", lw=0.5))
        ax.add_patch(Rectangle((0, W), L, Wa, fill=False, edgecolor="gray", lw=0.5))
    n_lanes = max(1, int(round(W / 3.5)))
    lw = W / n_lanes
    for i in range(1, n_lanes):
        ax.plot([0, L], [i * lw, i * lw], color="gray", lw=0.4, ls=(0, (3, 3)))
    for i in range(n_lanes):
        ax.annotate("", xy=(L * 0.08, (i + 0.5) * lw), xytext=(0.5, (i + 0.5) * lw),
                    arrowprops=dict(arrowstyle="->", color="gray", lw=0.7))
    n = int(L / S) + 1
    arm = cfg["arm"]
    if arr == "Lineal":
        for k in range(n + 1):
            ax.plot(k * S, arm, marker="_", color="red", markersize=10, mew=2)
            ax.plot(k * S, 0, marker="s", color="red", markersize=4)
    elif arr == "Bilateral":
        for k in range(n + 1):
            ax.plot(k * S, arm, marker="_", color="red", markersize=10, mew=2)
            ax.plot(k * S + S / 2, W - arm, marker="_", color="red", markersize=10, mew=2)
    elif arr in ("Central Doble", "En Isleta"):
        for k in range(n + 1):
            ax.plot(k * S, W / 2, marker="+", color="red", markersize=12, mew=2)
    ax.text(0, -Wa - 1.7, "0.00", fontsize=7, ha="center")
    ax.text(L, -Wa - 1.7, f"{L:.2f} m", fontsize=7, ha="center")
    ax.set_xticks([]); ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)


def _draw_elev(ax, cfg):
    h = cfg["h"]; arr = cfg["arrangement"]
    ax.set_xlim(-0.5, 4.5)
    ax.set_ylim(0, h + 2)
    ax.set_aspect("equal")
    ax.plot([-0.5, 4.5], [0, 0], color="black", lw=0.8)
    ax.fill_between([-0.5, 4.5], -0.1, 0, color="#d8d8d8")
    px = [0, 0, 0.5, 1.5, 2.5]
    py = [0, h * 0.7, h * 0.85, h * 0.95, h]
    ax.plot(px, py, color="black", lw=2)
    ax.add_patch(Rectangle((px[-1], h - 0.05), 0.5, 0.10, color="#f4d300", ec="black", lw=0.6))
    if arr in ("Bilateral",):
        ax.plot([4.5, 4.5, 4.0, 3.0, 2.5], [0, h * 0.7, h * 0.85, h * 0.95, h], color="black", lw=2)
        ax.add_patch(Rectangle((2.0, h - 0.05), 0.5, 0.10, color="#f4d300", ec="black", lw=0.6))
        ax.text(4.5, h * 0.5, "(1)", fontsize=8)
        ax.text(2.7, h + 0.3, "(3)", fontsize=8)
    else:
        ax.text(0.6, h * 0.5, "(1)", fontsize=8)
        ax.text(2.0, h + 0.3, "(3)", fontsize=8)
    ax.text(3.0, 0.4, "(2)", fontsize=8, ha="center")
    ax.set_xticks([]); ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)


def _draw_polar(ax, ph):
    Ng = ph.Ng; Mc = ph.Mc
    g = np.array([i * ph.Dg for i in range(Ng)])
    I_C0 = np.array([ph.I[0][i] for i in range(Ng)])
    I_C180 = np.array([ph.I[Mc // 2][i] for i in range(Ng)])
    I_C90 = np.array([ph.I[Mc // 4][i] for i in range(Ng)])
    I_C270 = np.array([ph.I[3 * Mc // 4][i] for i in range(Ng)])
    th0 = np.deg2rad(180 + g)
    th180 = np.deg2rad(180 - g)
    ax.plot(th0, I_C0, color="red", lw=1, label="C0-C180")
    ax.plot(th180, I_C180, color="red", lw=1)
    ax.plot(th0, I_C90, color="blue", lw=1, label="C90-C270")
    ax.plot(th180, I_C270, color="blue", lw=1)
    ax.set_theta_zero_location("S")
    ax.set_theta_direction(-1)
    ax.set_rlabel_position(90)
    ax.tick_params(labelsize=6)
    ax.grid(True, alpha=0.3)
    ax.set_title("cd/klm", fontsize=8, pad=8)


def page_planning(pdf, cfg, name):
    fig = plt.figure(figsize=(8.27, 11.69))
    _add_header(fig, name, "Datos de planificación")
    y = 0.77
    fig.text(0.07, y, "Perfil de la vía pública", fontsize=10, weight="bold"); y -= 0.03
    _road = cfg.get("road", "R3")
    _q0 = cfg.get("road_q0", 0.070)
    bullets = [
        ("Acera1", f"(Anchura: {cfg['Wa']:.3f} m)"),
        ("Calzada 1", f"(Anchura: {cfg['W']:.3f} m, Carriles: {cfg.get('lanes', 2)}, "
                      f"Pavimento: {_road}, q0: {_q0:.3f})"),
        ("Acera2", f"(Anchura: {cfg['Wa']:.3f} m)"),
    ]
    for label, val in bullets:
        fig.text(0.07, y, label, fontsize=9)
        fig.text(0.20, y, val, fontsize=9)
        y -= 0.020
    y -= 0.005
    fig.text(0.07, y, f"Factor mantenimiento: {cfg['mf']:.2f}", fontsize=9, weight="bold"); y -= 0.03
    fig.text(0.07, y, "Disposiciones de las luminarias", fontsize=10, weight="bold"); y -= 0.03
    ax1 = fig.add_axes([0.07, 0.32, 0.45, 0.20])
    ax2 = fig.add_axes([0.58, 0.32, 0.35, 0.20])
    _draw_plan(ax1, cfg)
    _draw_elev(ax2, cfg)
    box_y = 0.27
    rows = [
        ("Luminaria:", cfg["lum_name"]),
        ("Flujo luminoso (Luminaria):", f"{cfg['flux']:.0f} lm"),
        ("Flujo luminoso (Lámparas):", f"{cfg['flux']:.0f} lm"),
        ("Potencia de las luminarias:", f"{cfg['power']:.1f} W"),
        ("Organización:", cfg["arrangement_label"]),
        ("Distancia entre mástiles:", f"{cfg['S']:.3f} m"),
        ("Altura de montaje (1):", f"{cfg['h']:.3f} m"),
        ("Altura del punto de luz:", f"{cfg['h']:.3f} m"),
        ("Saliente sobre la calzada (2):", f"{cfg['arm']:.3f} m"),
        ("Inclinación del brazo (3):", f"{cfg['tilt']:.1f} °"),
        ("Longitud del brazo (4):", f"{cfg.get('arm_length', 1.0):.3f} m"),
    ]
    for label, val in rows:
        fig.text(0.07, box_y, label, fontsize=8.5)
        fig.text(0.30, box_y, val, fontsize=8.5)
        box_y -= 0.018
    rb_y = 0.27
    fig.text(0.55, rb_y, "Valores máximos de la intensidad lumínica", fontsize=8.5); rb_y -= 0.018
    fig.text(0.55, rb_y, f"con 70°:    {cfg['Imax70']:.0f} cd/klm", fontsize=8.5); rb_y -= 0.016
    fig.text(0.55, rb_y, f"con 80°:    {cfg['Imax80']:.0f} cd/klm", fontsize=8.5); rb_y -= 0.016
    fig.text(0.55, rb_y, f"con 90°:    {cfg['Imax90']:.2f} cd/klm", fontsize=8.5); rb_y -= 0.025
    fig.text(0.55, rb_y, "Respectivamente en todas las direcciones con las verticales inferiores.",
             fontsize=7, color="#444")
    fig.text(0.07, 0.04, "1", fontsize=7, color="#888")
    pdf.savefig(fig); plt.close(fig)


def page_lum_list(pdf, cfg, name, photometry):
    fig = plt.figure(figsize=(8.27, 11.69))
    _add_header(fig, name, "Lista de luminarias")
    y = 0.78
    lines = [
        cfg["lum_name"],
        "N° de artículo: -",
        f"Flujo luminoso (Luminaria): {cfg['flux']:.0f} lm",
        f"Flujo luminoso (Lámparas): {cfg['flux']:.0f} lm",
        f"Potencia de las luminarias: {cfg['power']:.1f} W",
        "Clasificación luminarias según CIE: 100",
        "Código CIE Flux: -",
        "Lámpara: 1 x LED 3000K (Factor de corrección 1.000).",
    ]
    for line in lines:
        fig.text(0.07, y, line, fontsize=9); y -= 0.018
    fig.text(0.45, 0.78, "Distribución polar de la luminaria", fontsize=9)
    ax = fig.add_axes([0.55, 0.55, 0.32, 0.22], projection="polar")
    _draw_polar(ax, photometry)
    pdf.savefig(fig); plt.close(fig)


def page_results(pdf, cfg, name, results):
    fig = plt.figure(figsize=(8.27, 11.69))
    _add_header(fig, name, "Resultados luminotécnicos")
    fig.text(0.07, 0.77, "Lista del recuadro de evaluación", fontsize=10, weight="bold")
    y = 0.74
    for i, fld in enumerate(results["fields"], 1):
        fig.text(0.07, y, str(i), fontsize=9)
        fig.text(0.10, y, fld["name"], fontsize=9, weight="bold"); y -= 0.018
        for ln in fld["descr"]:
            fig.text(0.10, y, ln, fontsize=8.5); y -= 0.016
        cls = fld["class"]
        msg = ("(Se cumplen todos los requerimientos fotométricos.)"
               if fld["compliant"]
               else "(No se cumplen todos los requerimientos fotométricos.)")
        fig.text(0.10, y, f"Clase de iluminación seleccionada: {cls}", fontsize=8.5)
        fig.text(0.40, y, msg, fontsize=8.5)
        y -= 0.022
        if fld["mode"] == "ME":
            cols = ["", "L_m [cd/m²]", "U0", "UI", "TI [%]", "SR"]
            row1 = ["Valores reales según cálculo:",
                    f"{fld['Lavg']:.2f}", f"{fld['Uo']:.2f}",
                    f"{fld['Ul']:.2f}", f"{fld['TI']:.0f}", f"{fld['SR']:.2f}"]
            req = fld["req"]
            row2 = ["Valores de consigna según clase:",
                    f"≥ {req['L']:.2f}", f"≥ {req['Uo']:.2f}",
                    f"≥ {req['Ul']:.2f}", f"≤ {req['TI']:.0f}", f"≥ {req['SR']:.2f}"]
            ok = ["", fld["ok_L"], fld["ok_Uo"], fld["ok_Ul"], fld["ok_TI"], fld["ok_SR"]]
            xs = [0.10, 0.42, 0.51, 0.60, 0.69, 0.78]
        else:
            cols = ["", "E_m [lx]", "U0"]
            row1 = ["Valores reales según cálculo:", f"{fld['Eavg']:.2f}", f"{fld['Uo']:.2f}"]
            req = fld["req"]
            row2 = ["Valores de consigna según clase:", f"≥ {req['Eavg']:.2f}", "-"]
            ok = ["", fld["ok_E"], True]
            xs = [0.10, 0.42, 0.55]
        for x, h_ in zip(xs, cols):
            fig.text(x, y, h_, fontsize=8, weight="bold", ha="left" if x < 0.20 else "right")
        y -= 0.016
        for x, v in zip(xs, row1):
            fig.text(x, y, v, fontsize=8, ha="left" if x < 0.20 else "right")
        y -= 0.014
        for x, v in zip(xs, row2):
            fig.text(x, y, v, fontsize=8, ha="left" if x < 0.20 else "right")
        y -= 0.014
        fig.text(0.10, y, "Cumplido/No cumplido:", fontsize=8)
        for x, ok_ in list(zip(xs, ok))[1:]:
            fig.text(x, y, "✓" if ok_ else "✗",
                     fontsize=11, color="#1a8c1a" if ok_ else "#c00000", ha="right", weight="bold")
        y -= 0.030
    pdf.savefig(fig); plt.close(fig)


def page_isolines(pdf, cfg, name, lum_grid):
    fig = plt.figure(figsize=(8.27, 11.69))
    _add_header(fig, f"{name} / Recuadro de evaluación Calzada 1 / Observer 1", "Isolíneas (L)")
    ax = fig.add_axes([0.10, 0.30, 0.78, 0.45])
    xs = np.array(lum_grid["xs"])
    ys = np.array(lum_grid["ys"])
    Lgrid = np.array(lum_grid["Lgrid"]).T
    levels = np.linspace(Lgrid.min(), Lgrid.max(), 6)
    ax.contourf(xs, ys, Lgrid, levels=levels, cmap="YlOrRd", alpha=0.6)
    cs = ax.contour(xs, ys, Lgrid, levels=levels, colors="black", linewidths=0.5)
    ax.clabel(cs, inline=True, fontsize=7, fmt="%.2f")
    ax.set_xlabel("x [m]", fontsize=8)
    ax.set_ylabel("y [m]", fontsize=8)
    ax.set_aspect("equal")
    ax.tick_params(labelsize=7)
    ax.set_title("Valores en cd/m²", fontsize=8)
    res = lum_grid["summary"]
    fig.text(0.10, 0.20, "Trama: 10 x 9 Puntos", fontsize=8)
    fig.text(0.10, 0.185,
             f"Posición del observador: ({lum_grid['obs'][0]:.3f} m, {lum_grid['obs'][1]:.3f} m, 1.500 m)",
             fontsize=8)
    _road = cfg.get("road", "R3")
    _q0 = cfg.get("road_q0", 0.070)
    fig.text(0.10, 0.170, f"Revestimiento de la calzada: {_road}, q0: {_q0:.3f}", fontsize=8)
    cols = [("L_m [cd/m²]", 0.45), ("U0", 0.58), ("UI", 0.68), ("TI [%]", 0.80)]
    fig.text(0.10, 0.140, "Valores reales según cálculo:", fontsize=8)
    for c, x in cols:
        fig.text(x, 0.155, c, fontsize=8, weight="bold", ha="right")
    for v, (_, x) in zip([f"{res['Lavg']:.2f}", f"{res['Uo']:.2f}",
                           f"{res['Ul']:.2f}", f"{res['TI']:.0f}"], cols):
        fig.text(x, 0.140, v, fontsize=8, ha="right")
    req = ME_REQ[cfg["class"]]
    fig.text(0.10, 0.122, f"Valores de consigna según clase {cfg['class']}:", fontsize=8)
    for v, (_, x) in zip([f"≥ {req['L']:.2f}", f"≥ {req['Uo']:.2f}",
                           f"≥ {req['Ul']:.2f}", f"≤ {req['TI']:.0f}"], cols):
        fig.text(x, 0.122, v, fontsize=8, ha="right")
    fig.text(0.10, 0.100, "Cumplido/No cumplido:", fontsize=8)
    for ok, (_, x) in zip([res["ok_L"], res["ok_Uo"], res["ok_Ul"], res["ok_TI"]], cols):
        fig.text(x, 0.100, "✓" if ok else "✗",
                 fontsize=11, color="#1a8c1a" if ok else "#c00000", ha="right", weight="bold")
    pdf.savefig(fig); plt.close(fig)


_ROAD_Q0 = {'R1': 0.10, 'R2': 0.07, 'R3': 0.07, 'R4': 0.08}


def make_report(cfg, photometry, out_path, name="Modelo", road='R3'):
    """Generate a 4-page DIALux-style PDF report.

    `road` selects the CIE 144 pavement reflection table ('R1'..'R4').
    The pavement class is shown in the report and used for luminance recalculation.
    """
    rL = calc_luminance(cfg, photometry, flux_scale=cfg["flux_scale"], road=road)
    SR = calc_SR(cfg, photometry, flux_scale=cfg["flux_scale"])
    req = ME_REQ[cfg["class"]]
    summary = dict(
        Lavg=rL["Lavg"], Uo=rL["Uo"], Ul=rL["Ul"], TI=rL["TI"], SR=SR,
        ok_L=rL["Lavg"] >= req["L"],
        ok_Uo=rL["Uo"] >= req["Uo"],
        ok_Ul=rL["Ul"] >= req["Ul"],
        ok_TI=rL["TI"] <= req["TI"],
        ok_SR=SR >= req["SR"],
    )
    summary["compliant"] = all(summary[k] for k in ("ok_L", "ok_Uo", "ok_Ul", "ok_TI", "ok_SR"))
    g_idx_70 = int(70 / photometry.Dg)
    g_idx_80 = int(80 / photometry.Dg)
    g_idx_90 = int(90 / photometry.Dg)
    Imax70 = max(photometry.I[c][g_idx_70] for c in range(photometry.Mc))
    Imax80 = max(photometry.I[c][g_idx_80] for c in range(photometry.Mc))
    Imax90 = max(photometry.I[c][g_idx_90] for c in range(photometry.Mc))
    cfg2 = dict(cfg)
    cfg2.update(
        Imax70=Imax70, Imax80=Imax80, Imax90=Imax90,
        flux=photometry.flux * cfg["flux_scale"],
        power=photometry.power * cfg["flux_scale"],
        road=road,
        road_q0=_ROAD_Q0[road],
        lum_name=f"SALVI {photometry.d['lum_name']}",
        arrangement_label={
            "Lineal": "unilateral",
            "Bilateral": "bilateral al tresbolillo",
            "Central Doble": "mediana doble",
            "En Isleta": "mediana central",
        }.get(cfg["arrangement"], cfg["arrangement"]),
        arm_length=cfg.get("arm_length", 1.0),
        lanes=max(1, int(round(cfg["W"] / 3.5))),
    )
    n_lanes = cfg2["lanes"]
    fields = [{
        "name": "Recuadro de evaluación Calzada 1",
        "descr": [
            f"Longitud: {cfg['S']:.3f} m, Anchura: {cfg['W']:.3f} m",
            f"Trama: 10 x {n_lanes * 3} Puntos",
            "Elemento de la vía pública respectivo: Calzada 1.",
            f"Revestimiento de la calzada: {road}, q0: {_ROAD_Q0[road]:.3f}",
        ],
        "class": cfg["class"], "mode": "ME", "req": req,
        **summary,
    }]
    with PdfPages(out_path) as pdf:
        page_planning(pdf, cfg2, name)
        page_lum_list(pdf, cfg2, name, photometry)
        page_results(pdf, cfg2, name, dict(fields=fields))
        page_isolines(pdf, cfg2, name, dict(
            xs=rL["xs"], ys=rL["ys"], Lgrid=rL["Lgrid"],
            obs=rL["obs"], summary=summary,
        ))
