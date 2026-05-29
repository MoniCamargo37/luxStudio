import re
from functools import lru_cache
from pathlib import Path
from ..salvi_lighting import parse_ldt, Photometry

LDT_DIR = Path(__file__).resolve().parent.parent.parent / "ldt"

def _extract_optic_family(luminaire_name: str) -> str:
    m = re.search(r'\b(F[0-9A-Z]{2,4})\b', luminaire_name)
    if not m:
        m = re.search(r'\b(F[A-Z0-9]{1,6})\b', luminaire_name)
    return m.group(1) if m else "UNKNOWN"


def _make_id(filename: str) -> str:
    return filename.replace(".ldt", "").replace(" ", "_")


def _extract_cct(text: str) -> int:
    match = re.search(r"\b(\d{2})K\b", text.upper())
    return int(match.group(1)) * 100 if match else 4000


def _extract_model_family(text: str) -> str:
    normalized = text.upper().replace("_", " ")
    for token in ("KRONOS", "CLAP", "SIL", "TECEO", "TERESA", "FRANCESCO"):
        if token in normalized:
            return token
    parts = re.findall(r"[A-Z0-9]+", normalized)
    return parts[0] if parts else "UNKNOWN"


def _extract_manufacturer(relative_path: Path) -> str:
    if len(relative_path.parts) > 1:
        return relative_path.parts[0]
    return "Salvi"


def _load_all_ldts():
    ldt_dir = LDT_DIR
    if not ldt_dir.exists():
        return []

    results = []
    for ldt_file in sorted(ldt_dir.rglob("*.ldt")):
        try:
            d = parse_ldt(str(ldt_file))
            ph = Photometry(d)
            name = d["lum_name"]
            relative_path = ldt_file.relative_to(ldt_dir)
            family = _extract_optic_family(name)
            results.append({
                "id": _make_id(ldt_file.stem),
                "filename": ldt_file.name,
                "relative_path": str(relative_path),
                "luminaire_name": name,
                "manufacturer": _extract_manufacturer(relative_path),
                "model_family": _extract_model_family(name or ldt_file.stem),
                "cct": _extract_cct(name or ldt_file.stem),
                "optic_family": family,
                "power": d["lamp_sets"][0]["wattage"],
                "flux": d["lamp_sets"][0]["flux_lm"],
                "efficiency": round(d["lamp_sets"][0]["flux_lm"] / d["lamp_sets"][0]["wattage"], 1),
                "LORL": d["LORL"],
                "isym": d["Isym"],
                "Mc": d["Mc"],
                "Ng": d["Ng"],
                "C": d["C"],
                "G": d["G"],
                "I": d["I"],
            })
        except Exception as e:
            print(f"Error loading {ldt_file}: {e}")
    deduped = {}
    for item in results:
        key = (
            item["id"],
            item["manufacturer"],
            item["model_family"],
            item["cct"],
            item["optic_family"],
            round(float(item["power"]), 3),
        )
        current = deduped.get(key)
        if current is None:
            deduped[key] = item
            continue

        current_depth = len(Path(current["relative_path"]).parts)
        item_depth = len(Path(item["relative_path"]).parts)
        if item_depth > current_depth:
            deduped[key] = item

    return sorted(deduped.values(), key=lambda item: (
        item["manufacturer"],
        item["model_family"],
        item["cct"],
        item["power"],
        item["optic_family"],
        item["filename"],
    ))


_LDT_CACHE = None

def get_all_ldts():
    global _LDT_CACHE
    if _LDT_CACHE is None:
        _LDT_CACHE = _load_all_ldts()
    return _LDT_CACHE


def refresh_ldt_cache():
    global _LDT_CACHE
    _LDT_CACHE = None
    get_photometry.cache_clear()
    return get_all_ldts()


def save_uploaded_ldt(filename: str, data: bytes, manufacturer: str = "Custom"):
    safe_filename = Path(filename).name
    target_dir = LDT_DIR / (manufacturer.strip() or "Custom")
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / safe_filename
    target_path.write_bytes(data)
    refresh_ldt_cache()
    return target_path


def get_families():
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
    for ldt in get_all_ldts():
        if ldt["id"] == ldt_id:
            return ldt
    return None


def get_ldt_path(ldt_id: str):
    info = get_ldt_by_id(ldt_id)
    if info is None:
        return None
    return str(LDT_DIR / info["relative_path"])


@lru_cache(maxsize=128)
def get_photometry(ldt_id: str):
    path = get_ldt_path(ldt_id)
    if path is None:
        return None
    d = parse_ldt(path)
    return Photometry(d)
