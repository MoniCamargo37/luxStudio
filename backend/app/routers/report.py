from fastapi import APIRouter
from fastapi.responses import Response
from ..schemas.models import CalculationConfig
from ..services.calculator import run_calculation
from ..services.excel_generator import generate_excel
from ..services.ldt_matcher import require_ldt_for_config
from ..services.pdf_generator import generate_pdf

router = APIRouter()


@router.post("/generate")
async def generate_report(config: CalculationConfig):
    """Generate a professional PDF report for the given configuration."""
    ldt_id, ldt = require_ldt_for_config(config)
    result = run_calculation(config, ldt_id)
    pdf_bytes = await generate_pdf(result)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=LUX_Report_{ldt['luminaire_name'].replace(' ', '_')}.pdf"
        },
    )


@router.post("/excel")
async def generate_excel_report(config: CalculationConfig):
    """Generate a DIALux-style Excel output for the given configuration."""
    ldt_id, ldt = require_ldt_for_config(config)
    result = run_calculation(config, ldt_id)
    excel_bytes = generate_excel(result)

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=LUX_Results_{ldt['luminaire_name'].replace(' ', '_')}.xlsx"
        },
    )
