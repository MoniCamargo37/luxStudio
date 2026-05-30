from functools import lru_cache
from pathlib import Path
import re
from uuid import uuid4

from sqlalchemy.orm import Session

from ..database import DATA_DIR, LDT_DIR, SessionLocal
from ..models import Luminaire, Manufacturer
from ..salvi_lighting import parse_ldt, Photometry

TEMP_LDT_DIR = DATA_DIR / "temp_ldt"
TEMP_LDT_DIR.mkdir(parents=True, exist_ok=True)
_TEMP_LDTS: dict[str, dict] = {}


def _lum_to_dict(lum: Luminaire) -> dict:
    """Convert a DB Luminaire model to the dict format used by existing code."""
    return {
        "id": str(lum.id),
        "filename": Path(lum.ldt_path).name,
        "relative_path": lum.ldt_path,
        "luminaire_name": lum.name,
        "manufacturer": lum.manufacturer.name if lum.manufacturer else "Unknown",
        "model_family": lum.type,
        "cct": lum.cct,
        "optic_family": lum.optic_family,
        "power": lum.power,
        "flux": lum.flux,
        "efficiency": lum.efficiency,
        "LORL": lum.LORL,
        "isym": lum.isym,
    }


def _extract_optic_family(name: str) -> str:
    match = re.search(r"\b(F[0-9A-Z]{2,4})\b", name)
    if not match:
        match = re.search(r"\b(F[A-Z0-9]{1,6})\b", name)
    return match.group(1) if match else "UNKNOWN"


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


def _parsed_to_info(parsed: dict, filename: str, temp_id: str, path: Path) -> dict:
    name = parsed.get("lum_name") or Path(filename).stem
    lamp = parsed["lamp_sets"][0]
    power = float(lamp["wattage"])
    flux = float(lamp["flux_lm"])
    return {
        "id": temp_id,
        "filename": Path(filename).name,
        "relative_path": str(path),
        "absolute_path": str(path),
        "luminaire_name": name,
        "manufacturer": parsed.get("company", "").strip() or "External",
        "model_family": _extract_model_family(name or filename),
        "cct": _extract_cct(name or filename),
        "optic_family": _extract_optic_family(name),
        "power": power,
        "flux": flux,
        "efficiency": round(flux / power, 1) if power > 0 else 0,
        "LORL": parsed["LORL"],
        "isym": parsed["Isym"],
    }


def _load_all() -> list[dict]:
    """Load all luminaires from the database. Returns [] when empty."""
    db: Session = SessionLocal()
    try:
        luminaires = db.query(Luminaire).order_by(Luminaire.name).all()
        return [_lum_to_dict(l) for l in luminaires]
    finally:
        db.close()


def get_all_ldts():
    """Get all luminaire entries from the database."""
    return _load_all()


def refresh_ldt_cache():
    """Clear derived caches so data is re-fetched on next call."""
    get_photometry.cache_clear()
    return get_all_ldts()


def save_temporary_ldt(filename: str, data: bytes) -> dict:
    """Validate and store an external LDT for this backend process only."""
    safe_filename = Path(filename or "external.ldt").name
    temp_id = f"temp-{uuid4().hex}"
    temp_path = TEMP_LDT_DIR / f"{temp_id}_{safe_filename}"
    temp_path.write_bytes(data)
    try:
        parsed = parse_ldt(str(temp_path))
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise

    info = _parsed_to_info(parsed, safe_filename, temp_id, temp_path)
    _TEMP_LDTS[temp_id] = info
    get_photometry.cache_clear()
    return info


def get_families():
    """List LDTs grouped by optic family."""
    ldts = get_all_ldts()
    families: dict[str, list] = {}
    for ldt in ldts:
        families.setdefault(ldt["optic_family"], []).append(ldt)
    result = []
    for code, members in sorted(families.items()):
        members.sort(key=lambda x: x["power"])
        result.append({
            "code": code,
            "description": f"Optical family {code} ({len(members)} variants)",
            "ldts": [_ldt_to_info(m) for m in members],
        })
    return result


def _ldt_to_info(m):
    return {
        "id": m["id"],
        "filename": m["filename"],
        "luminaire_name": m["luminaire_name"],
        "manufacturer": m.get("manufacturer", "Unknown"),
        "model_family": m.get("model_family", "UNKNOWN"),
        "cct": m.get("cct", 4000),
        "optic_family": m["optic_family"],
        "power": m["power"],
        "flux": m["flux"],
        "efficiency": m["efficiency"],
        "LORL": m["LORL"],
        "isym": m["isym"],
    }


def get_ldt_by_id(ldt_id: str):
    """Get LDT info dict by ID. Loads photometric data from LDT file on demand."""
    if ldt_id in _TEMP_LDTS:
        result = dict(_TEMP_LDTS[ldt_id])
        path = Path(result["absolute_path"])
        if path.exists():
            try:
                d = parse_ldt(str(path))
                result["Mc"] = d["Mc"]
                result["Ng"] = d["Ng"]
                result["C"] = d["C"]
                result["G"] = d["G"]
                result["I"] = d["I"]
            except Exception:
                pass
        return result

    for ldt in get_all_ldts():
        if ldt["id"] == ldt_id:
            result = dict(ldt)
            path = LDT_DIR / result["relative_path"]
            if path.exists():
                try:
                    d = parse_ldt(str(path))
                    result["Mc"] = d["Mc"]
                    result["Ng"] = d["Ng"]
                    result["C"] = d["C"]
                    result["G"] = d["G"]
                    result["I"] = d["I"]
                except Exception:
                    pass
            return result
    return None


def get_ldt_path(ldt_id: str):
    """Get full filesystem path to an LDT file by ID."""
    info = get_ldt_by_id(ldt_id)
    if info is None:
        return None
    if "absolute_path" in info:
        return info["absolute_path"]
    return str(LDT_DIR / info["relative_path"])


@lru_cache(maxsize=128)
def get_photometry(ldt_id: str):
    """Get Photometry object for a given LDT ID (cached in memory)."""
    path = get_ldt_path(ldt_id)
    if path is None:
        return None
    d = parse_ldt(path)
    return Photometry(d)
