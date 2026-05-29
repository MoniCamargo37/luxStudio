"""EULUMDAT (LDT) parser."""
from pathlib import Path


def parse_ldt(path):
    text = Path(path).read_text(encoding="latin-1", errors="replace")
    lines = text.splitlines()
    L = lines
    d = {}
    d["company"] = L[0].strip()
    d["Ityp"] = int(L[1].strip())
    d["Isym"] = int(L[2].strip())
    d["Mc"] = int(L[3].strip())
    d["Dc"] = float(L[4].strip())
    d["Ng"] = int(L[5].strip())
    d["Dg"] = float(L[6].strip())
    d["report"] = L[7].strip()
    d["lum_name"] = L[8].strip()
    d["lum_num"] = L[9].strip()
    d["filename"] = L[10].strip()
    d["date_user"] = L[11].strip()
    d["length_mm"] = float(L[12])
    d["width_mm"] = float(L[13])
    d["height_mm"] = float(L[14])
    d["la_length"] = float(L[15])
    d["la_width"] = float(L[16])
    d["la_h_C0"] = float(L[17])
    d["la_h_C90"] = float(L[18])
    d["la_h_C180"] = float(L[19])
    d["la_h_C270"] = float(L[20])
    d["DFF"] = float(L[21])
    d["LORL"] = float(L[22])
    d["conv"] = float(L[23])
    d["tilt"] = float(L[24])
    d["n_sets"] = int(L[25])
    base = 26
    sets = []
    for s in range(d["n_sets"]):
        b = base + s * 6
        sets.append(
            {
                "n_lamps": L[b].strip(),
                "lamp_type": L[b + 1].strip(),
                "flux_lm": float(L[b + 2]),
                "color": L[b + 3].strip(),
                "CRI": L[b + 4].strip(),
                "wattage": float(L[b + 5]),
            }
        )
    d["lamp_sets"] = sets
    base = base + d["n_sets"] * 6
    d["DR"] = [float(L[base + i]) for i in range(10)]
    base += 10
    d["C"] = [float(L[base + i]) for i in range(d["Mc"])]
    base += d["Mc"]
    d["G"] = [float(L[base + i]) for i in range(d["Ng"])]
    base += d["Ng"]
    if d["Isym"] == 0:
        n_planes = d["Mc"]
    elif d["Isym"] == 1:
        n_planes = 1
    elif d["Isym"] == 2:
        n_planes = d["Mc"] // 2 + 1
    elif d["Isym"] == 3:
        n_planes = d["Mc"] // 2 + 1
    elif d["Isym"] == 4:
        n_planes = d["Mc"] // 4 + 1
    else:
        n_planes = d["Mc"]
    d["n_planes_in_file"] = n_planes
    n_int = n_planes * d["Ng"]
    I_raw = [float(L[base + i]) for i in range(n_int)]
    d["I_raw"] = I_raw
    full_I = [[0.0] * d["Ng"] for _ in range(d["Mc"])]
    if d["Isym"] == 0:
        for c in range(d["Mc"]):
            for g in range(d["Ng"]):
                full_I[c][g] = I_raw[c * d["Ng"] + g]
    elif d["Isym"] == 1:
        for c in range(d["Mc"]):
            for g in range(d["Ng"]):
                full_I[c][g] = I_raw[g]
    elif d["Isym"] in (2, 3):
        half = d["Mc"] // 2
        for c in range(d["Mc"]):
            cf = c if c <= half else (d["Mc"] - c)
            for g in range(d["Ng"]):
                full_I[c][g] = I_raw[cf * d["Ng"] + g]
    elif d["Isym"] == 4:
        q = d["Mc"] // 4
        for c in range(d["Mc"]):
            r = c % (2 * q)
            cf = r if r <= q else (2 * q - r)
            for g in range(d["Ng"]):
                full_I[c][g] = I_raw[cf * d["Ng"] + g]
    d["I"] = full_I
    return d


if __name__ == "__main__":
    import sys
    import glob

    pattern = sys.argv[1] if len(sys.argv) > 1 else "*.ldt"
    for f in sorted(glob.glob(pattern)):
        d = parse_ldt(f)
        s = d["lamp_sets"][0]
        print(
            f"{Path(f).name}: {d['lum_name']} | "
            f"Isym={d['Isym']} Mc={d['Mc']} Ng={d['Ng']} | "
            f"{s['flux_lm']:.0f} lm {s['wattage']:.0f} W "
            f"({s['flux_lm']/s['wattage']:.1f} lm/W)"
        )
