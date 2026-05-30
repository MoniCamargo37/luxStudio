import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from ..database import LDT_DIR
from ..models import Manufacturer, Luminaire
from ..salvi_lighting import parse_ldt


def _extract_optic_family(name: str) -> str:
    m = re.search(r"\b(F[0-9A-Z]{2,4})\b", name)
    if not m:
        m = re.search(r"\b(F[A-Z0-9]{1,6})\b", name)
    return m.group(1) if m else "UNKNOWN"


def _extract_model_family(text: str) -> str:
    normalized = text.upper().replace("_", " ")
    for token in ("KRONOS", "CLAP", "SIL", "TECEO", "TERESA", "FRANCESCO"):
        if token in normalized:
            return token
    parts = re.findall(r"[A-Z0-9]+", normalized)
    return parts[0] if parts else "UNKNOWN"


def _extract_cct(text: str) -> int:
    match = re.search(r"\b(\d{2})K\b", text.upper())
    return int(match.group(1)) * 100 if match else 4000


def parse_ldt_preview(data: bytes, filename: str) -> dict:
    """Parse an LDT file and return extracted fields for admin form preview."""
    tmp = LDT_DIR / "__preview__.ldt"
    tmp.write_bytes(data)
    try:
        d = parse_ldt(str(tmp))
    finally:
        tmp.unlink(missing_ok=True)

    name = d.get("lum_name", Path(filename).stem)
    lamp = d["lamp_sets"][0]
    return {
        "filename": filename,
        "luminaire_name": name,
        "manufacturer": d.get("company", "").strip() or "Unknown",
        "model_family": _extract_model_family(name),
        "optic_family": _extract_optic_family(name),
        "cct": _extract_cct(name or Path(filename).stem),
        "power": lamp["wattage"],
        "flux": lamp["flux_lm"],
        "efficiency": round(lamp["flux_lm"] / lamp["wattage"], 1) if lamp["wattage"] > 0 else 0,
        "LORL": d["LORL"],
        "isym": d["Isym"],
    }


def _get_or_create_manufacturer(db: Session, name: str) -> Manufacturer:
    m = db.query(Manufacturer).filter(Manufacturer.name == name).first()
    if m:
        return m
    m = Manufacturer(name=name)
    db.add(m)
    db.flush()
    return m


def create_luminaire(db: Session, data: dict) -> Luminaire:
    """Create a luminaire in DB and copy LDT file to ldt/ directory."""
    manufacturer = _get_or_create_manufacturer(db, data["manufacturer"])
    safe_filename = Path(data["filename"]).name
    ldt_relative = str(Path(manufacturer.name) / safe_filename)
    src = Path(data["ldt_temp_path"])
    dst = LDT_DIR / ldt_relative
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(str(src), str(dst))

    lum = Luminaire(
        manufacturer_id=manufacturer.id,
        type=data["model_family"],
        optic_family=data["optic_family"],
        name=data["luminaire_name"],
        power=float(data["power"]),
        cct=int(data["cct"]),
        flux=float(data["flux"]),
        efficiency=float(data["efficiency"]),
        LORL=float(data["LORL"]),
        isym=int(data["isym"]),
        ldt_path=ldt_relative,
    )
    db.add(lum)
    db.commit()
    db.refresh(lum)
    return lum


def update_luminaire(db: Session, lum_id: int, data: dict) -> Optional[Luminaire]:
    lum = db.query(Luminaire).filter(Luminaire.id == lum_id).first()
    if not lum:
        return None

    if "manufacturer" in data:
        manufacturer = _get_or_create_manufacturer(db, data["manufacturer"])
        lum.manufacturer_id = manufacturer.id
    if "model_family" in data:
        lum.type = data["model_family"]
    if "optic_family" in data:
        lum.optic_family = data["optic_family"]
    if "luminaire_name" in data:
        lum.name = data["luminaire_name"]
    if "power" in data:
        lum.power = float(data["power"])
    if "cct" in data:
        lum.cct = int(data["cct"])
    if "flux" in data:
        lum.flux = float(data["flux"])
    if "efficiency" in data:
        lum.efficiency = float(data["efficiency"])
    if "LORL" in data:
        lum.LORL = float(data["LORL"])
    if "isym" in data:
        lum.isym = int(data["isym"])

    # Handle LDT file replacement
    if "ldt_temp_path" in data:
        manufacturer_name = data.get("manufacturer")
        if not manufacturer_name:
            mfr = db.query(Manufacturer).filter(Manufacturer.id == lum.manufacturer_id).first()
            manufacturer_name = mfr.name if mfr else "Custom"
        safe_filename = Path(data.get("filename", Path(lum.ldt_path).name)).name
        new_relative = str(Path(manufacturer_name) / safe_filename)
        dst = LDT_DIR / new_relative
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(Path(data["ldt_temp_path"])), str(dst))

        # Remove old LDT if path changed
        old_path = LDT_DIR / lum.ldt_path
        if old_path.exists() and str(old_path) != str(dst):
            old_path.unlink(missing_ok=True)

        lum.ldt_path = new_relative
        if "filename" in data:
            lum.name = data.get("luminaire_name", lum.name)

    lum.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lum)
    return lum


def delete_luminaire(db: Session, lum_id: int) -> bool:
    lum = db.query(Luminaire).filter(Luminaire.id == lum_id).first()
    if not lum:
        return False

    ldt_file = LDT_DIR / lum.ldt_path
    if ldt_file.exists():
        ldt_file.unlink(missing_ok=True)

    db.delete(lum)
    db.commit()
    return True


def get_manufacturers(db: Session) -> list[Manufacturer]:
    return db.query(Manufacturer).order_by(Manufacturer.name).all()


def get_all_luminaires(db: Session) -> list[Luminaire]:
    return db.query(Luminaire).order_by(Luminaire.name).all()


def get_luminaire_by_id(db: Session, lum_id: int) -> Optional[Luminaire]:
    return db.query(Luminaire).filter(Luminaire.id == lum_id).first()
