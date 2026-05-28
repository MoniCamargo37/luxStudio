from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from ..schemas.models import CalculationConfig
from ..services.calculator import run_calculation
from ..services.pdf_generator import generate_pdf
from ..services.ldt_loader import get_ldt_by_id, get_all_ldts

router = APIRouter()


@router.post("/generate")
async def generate_report(config: CalculationConfig):
    """Generate a professional PDF report for the given configuration."""
    ldt_id = f"{config.optic_family}_{config.power:.0f}W".lower().replace(" ", "_")

    ldt = get_ldt_by_id(ldt_id)
    if ldt is None:
        for l in get_all_ldts():
            if l["optic_family"] == config.optic_family and abs(l["power"] - config.power) < 1:
                ldt = l
                ldt_id = l["id"]
                break

    if ldt is None:
        raise HTTPException(status_code=404, detail="LDT not found")

    result = run_calculation(config, ldt_id)
    pdf_bytes = await generate_pdf(result)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=LUX_Report_{ldt['luminaire_name'].replace(' ', '_')}.pdf"
        },
    )
