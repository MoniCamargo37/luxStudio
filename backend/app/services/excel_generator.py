from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

from ..schemas.models import CalculationResult


HEADERS = [
    "IDENTIFICADOR\nMODELO",
    "DISPOSICIÓN",
    "ALTURA\n(m)",
    "INTERDISTANCIA\n(m)",
    "ANCHO ACERA\n(m)",
    "ANCHO CALZADA\n(m)",
    "ARM LENGTH\n(m)",
    "LIGHTING CLASS",
    "FACTOR DE MANTENIMIENTO",
    "TEMPERATURA DE COLOR",
    "LUMINARIA PROPUESTA",
    "ÓPTICA",
    "ANGULO INCLINACIÓN\n(°)",
    "POTENCIA PROPUESTA\n(W)",
    "Lm (cd/m²)\nEm (lux)",
    "UNIFORMIDAD\nUo\nEmin (Lux)",
    "UI",
    "TI",
    "SR",
    "eficiencia proyecto",
    "int/h",
    "h/a",
    None,
    "P_calc\n(W)",
    "Φ_calc\n(lm)",
    "LDT base\n/interp",
    "Lm/Em\ncalc",
    "Uo\ncalc",
    "UI/Ul\ncalc",
    "TI\ncalc",
    "SR\ncalc",
    "Cumple",
    "Notas",
]


def _metric(result: CalculationResult, key: str):
    value = getattr(result, key, None)
    return round(value, 3) if value is not None else None


def _notes(result: CalculationResult) -> str:
    failed = [c.name for c in result.criteria if not c.passed]
    return ", ".join(failed) if failed else "OK"


def _spacing_note(lighting_class: str, spacing: float, road_width: float) -> str:
    if road_width <= 0:
        return ""
    ratio = spacing / road_width
    if lighting_class in ("M1", "M2"):
        return "OK m1-m2" if ratio < 4 else "Interdistancia excesiva"
    if lighting_class in ("M3", "M4", "M5"):
        return "OK m3-m4-m5" if ratio < 4.5 else "Interdistancia excesiva"
    return ""


def _optic_note(height: float, road_width: float) -> str:
    if road_width <= 0:
        return ""
    ratio = height / road_width
    if ratio <= 1:
        return "f151"
    if ratio > 1.5:
        return "ojo"
    return "f2md"


def _sidewalk_value(left: float, right: float):
    return left if abs(left - right) < 0.001 else f"L {left:.1f} / R {right:.1f}"


def _row_values(result: CalculationResult):
    cfg = result.config
    lum = result.luminaire
    main_metric = result.Lavg if result.mode == "ME" else result.Eavg
    uniformity = result.Uo if result.mode == "ME" else result.Emin

    return [
        "MODELO 1",
        cfg.arrangement,
        cfg.height,
        cfg.spacing,
        _sidewalk_value(cfg.sidewalk_left, cfg.sidewalk_right),
        cfg.road_width,
        cfg.arm_length,
        cfg.lighting_class,
        cfg.mf,
        f"{cfg.cct}K",
        lum.luminaire_name,
        lum.optic_family,
        cfg.tilt,
        cfg.power,
        _metric(result, "Lavg") if result.mode == "ME" else _metric(result, "Eavg"),
        _metric(result, "Uo") if result.mode == "ME" else _metric(result, "Emin"),
        _metric(result, "Ul"),
        _metric(result, "TI"),
        _metric(result, "SR"),
        None,
        _spacing_note(cfg.lighting_class, cfg.spacing, cfg.road_width),
        _optic_note(cfg.height, cfg.road_width),
        None,
        lum.power,
        round(lum.flux, 0),
        lum.filename,
        round(main_metric, 3) if main_metric is not None else None,
        round(uniformity, 3) if uniformity is not None else None,
        _metric(result, "Ul"),
        _metric(result, "TI"),
        _metric(result, "SR"),
        "SI" if result.compliant else "NO",
        _notes(result),
    ]


def generate_excel(result: CalculationResult) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Hoja1"

    ws.append(HEADERS)
    ws.append(_row_values(result))
    ws["T2"] = '=IFERROR(D2*F2*O2*15/N2,"")'

    ws.freeze_panes = "A2"
    ws.sheet_view.showGridLines = False

    fills = {
        "input": PatternFill("solid", fgColor="C6E0B4"),
        "selection": PatternFill("solid", fgColor="FFD966"),
        "spacer": PatternFill("solid", fgColor="FFFFFF"),
        "calc": PatternFill("solid", fgColor="2F5597"),
    }
    thin = Side(style="thin", color="A6A6A6")
    border = Border(top=thin, bottom=thin, left=thin, right=thin)

    for col in range(1, len(HEADERS) + 1):
        cell = ws.cell(1, col)
        if col <= 8:
            cell.fill = fills["input"]
            font_color = "000000"
        elif col <= 22:
            cell.fill = fills["selection"]
            font_color = "000000"
        elif col == 23:
            cell.fill = fills["spacer"]
            font_color = "000000"
        else:
            cell.fill = fills["calc"]
            font_color = "FFFFFF"
        cell.font = Font(name="Calibri", size=8, bold=True, color=font_color)
        cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
        cell.border = border

        value_cell = ws.cell(2, col)
        value_cell.font = Font(name="Calibri", size=9, bold=col in (31, 32, 33))
        value_cell.alignment = Alignment(wrap_text=True, vertical="center")
        value_cell.border = border
        if col == 32:
            value_cell.fill = PatternFill("solid", fgColor="E2F0D9" if result.compliant else "F4CCCC")

    number_formats = {
        "C": "0.00",
        "D": "0.0",
        "E": "0.0",
        "F": "0.0",
        "G": "0.0",
        "I": "0.00",
        "M": "0",
        "N": "0",
        "O": "0.000",
        "P": "0.000",
        "Q": "0.000",
        "R": "0.0",
        "S": "0.000",
        "T": "0.00",
        "X": "0.0",
        "Y": "#,##0",
        "AA": "0.000",
        "AB": "0.000",
        "AC": "0.000",
        "AD": "0.0",
        "AE": "0.000",
    }
    for col, number_format in number_formats.items():
        ws[f"{col}2"].number_format = number_format

    widths = {
        "A": 16, "B": 14, "C": 10, "D": 15, "E": 15, "F": 15, "G": 13,
        "H": 14, "I": 18, "J": 18, "K": 28, "L": 14, "M": 16, "N": 16,
        "O": 14, "P": 16, "Q": 10, "R": 8, "S": 8, "T": 16, "U": 22,
        "V": 12, "W": 5, "X": 11, "Y": 13, "Z": 30, "AA": 13, "AB": 12,
        "AC": 12, "AD": 10, "AE": 10, "AF": 10, "AG": 30,
    }
    for col, width in widths.items():
        ws.column_dimensions[col].width = width
    ws.row_dimensions[1].height = 48
    ws.row_dimensions[2].height = 38
    ws.auto_filter.ref = "A1:AG2"

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
