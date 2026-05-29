import re
import os
from functools import lru_cache
from pathlib import Path
from salvi_lighting import parse_ldt, Photometry

LDT_DIR = Path(__file__).resolve().parent.parent.parent / "ldt"

def _extract_optic_family(luminaire_name: str) -> str:
    m = re.search(r'\b(F[0-9A-Z]{2,4})\b', luminaire_name)
    if not m:
        m = re.search(r'\b(F[A-Z0-9]{1,6})\b', luminaire_name)
    return m.group(1) if m else "UNKNOWN"


def _make_id(filename: str) -> str:
    return filename.replace(".ldt", "").replace(" ", "_")


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
            family = _extract_optic_family(name)
            results.append({
                "id": _make_id(ldt_file.stem),
                "filename": ldt_file.name,
                "relative_path": str(ldt_file.relative_to(ldt_dir)),
                "luminaire_name": name,
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
    return results


_LDT_CACHE = None

def get_all_ldts():
    global _LDT_CACHE
    if _LDT_CACHE is None:
        _LDT_CACHE = _load_all_ldts()
    return _LDT_CACHE


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
