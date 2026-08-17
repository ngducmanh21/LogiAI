#!/usr/bin/env python3
"""
Clean & normalize BIEU THUE XNK Excel (sheet BT2026) -> data/clean/

Outputs:
  - data/clean/hs_codes.csv        : bảng biểu thuế phẳng (mọi mã HS 4/6/8 số)
  - data/clean/hs_codes.jsonl      : bản ghi đầy đủ (preferential_rates dạng dict, mô tả đầy đủ theo cây)
  - data/clean/hs_notes.jsonl      : chú giải Phần/Chương nhúng trong sheet
  - data/clean/quality_report.json : báo cáo chất lượng dữ liệu

Usage: python scripts/clean_bieu_thue.py
"""

import csv
import json
import re
from collections import Counter
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "BieuthueXNK" / "BIEU THUE XNK 2026.04.05.xlsx"
OUT = ROOT / "data" / "clean"
SHEET = "BT2026"
DATA_START_ROW = 8  # rows 1-7 = header/meta

# 1-based column map (rate column; văn bản = +1, ngày hiệu lực = +2)
COL_MARKER = 2
COL_HS = 6
COL_DESC_VI = 7
COL_DESC_EN = 8
COL_UNIT_VI = 9
COL_UNIT_EN = 10
COL_NK_TT = 11      # NK thông thường
COL_NK_UD = 14      # NK ưu đãi (MFN)
COL_VAT = 17
FTA_COLS = {
    "ACFTA": 20, "ATIGA": 23, "AJCEP": 26, "VJEPA": 29, "AKFTA": 32,
    "AANZFTA": 35, "AIFTA": 38, "VKFTA": 41, "VCFTA": 44, "VN-EAEU": 47,
    "CPTPP": 50, "AHKFTA": 53, "VNCU": 56, "EVFTA": 59, "UKVFTA": 62,
    "VN-LAO": 65, "VN-CAM": 68, "VIFTA": 71,
}
# RCEPT: 6 nhóm nước A-F (cols 74-79), chung văn bản (80) + ngày (81)
RCEPT_COLS = {"RCEPT-A": 74, "RCEPT-B": 75, "RCEPT-C": 76,
              "RCEPT-D": 77, "RCEPT-E": 78, "RCEPT-F": 79}
COL_TTDB = 85       # thuế tiêu thụ đặc biệt
COL_XK = 88         # thuế xuất khẩu
COL_XK_CPTPP = 91
COL_XK_EV = 94
COL_XK_UKV = 97
COL_BVMT = 100      # thuế bảo vệ môi trường
COL_POLICY = 103    # chính sách mặt hàng theo mã HS
COL_VAT_REDUCTION = 104  # giảm VAT

ROMAN_RE = re.compile(r"PH\u1ea6N\s+([IVXLCDM]+)", re.IGNORECASE)
CHAPTER_RE = re.compile(r"Ch\u01b0\u01a1ng\s+(\d+)", re.IGNORECASE)

STRUCT_MARKERS = {"Phần", "Phần 2", "Chương", "Chương 2",
                  "Chú giải", "Chú giải phần", "123.", "(abc)", "SEN"}


def cell(row, col_1based):
    v = row[col_1based - 1] if col_1based - 1 < len(row) else None
    if v is None:
        return ""
    s = str(v).replace("\xa0", " ").strip()
    return s


def parse_rate(raw: str):
    """'5' -> 5.0 ; '7.5' -> 7.5 ; '*', '', '*/8/10' -> None (giữ raw riêng)."""
    if not raw:
        return None
    try:
        return float(raw.replace(",", "."))
    except ValueError:
        return None


def normalize_hs(raw: str):
    code = re.sub(r"[^0-9]", "", raw)
    return code if code else None


def dash_level(desc: str) -> int:
    m = re.match(r"^((?:-\s*)+)", desc)
    if not m:
        return 0
    return m.group(1).count("-")


def clean_desc(desc: str) -> str:
    return re.sub(r"^(?:-\s*)+", "", desc).strip()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.load_workbook(SRC, read_only=True)
    ws = wb[SHEET]

    records = []
    notes = []

    section_code = section_name = None
    chapter_code = chapter_name = None
    heading_code = heading_desc = None
    note_ctx = None          # 'section' | 'chapter'
    note_buf_vi, note_buf_en = [], []
    desc_stack = []          # [(dash_level, cleaned_desc)] trong heading hiện tại

    def flush_note():
        nonlocal note_buf_vi, note_buf_en
        if note_buf_vi:
            notes.append({
                "note_for": note_ctx,
                "section_code": section_code,
                "section_name": section_name,
                "chapter_code": chapter_code if note_ctx == "chapter" else None,
                "chapter_name": chapter_name if note_ctx == "chapter" else None,
                "content_vi": "\n".join(note_buf_vi),
                "content_en": "\n".join(note_buf_en),
            })
        note_buf_vi, note_buf_en = [], []

    for row in ws.iter_rows(min_row=DATA_START_ROW, values_only=True):
        marker = cell(row, COL_MARKER)
        desc_vi = cell(row, COL_DESC_VI)
        desc_en = cell(row, COL_DESC_EN)

        # --- structural rows ---
        if marker == "Phần":
            flush_note()
            m = ROMAN_RE.search(desc_vi)
            section_code = m.group(1) if m else desc_vi
            section_name = None
            chapter_code = chapter_name = None
            continue
        if marker == "Phần 2":
            section_name = desc_vi
            continue
        if marker == "Chương" or (not marker and re.fullmatch(r"Ch\u01b0\u01a1ng\s+\d+", desc_vi)):
            flush_note()
            m = CHAPTER_RE.search(desc_vi)
            chapter_code = m.group(1).zfill(2) if m else desc_vi
            chapter_name = None
            continue
        if marker == "Chương 2":
            chapter_name = desc_vi
            continue
        if marker == "Chú giải phần":
            flush_note()
            note_ctx = "section"
            continue
        if marker == "Chú giải":
            flush_note()
            note_ctx = "chapter"
            continue
        if marker in ("123.", "(abc)", "SEN"):
            if desc_vi:
                note_buf_vi.append(desc_vi)
            if desc_en:
                note_buf_en.append(desc_en)
            continue

        # --- data rows ---
        hs_raw = cell(row, COL_HS)
        if not hs_raw and not desc_vi:
            continue

        level = dash_level(desc_vi)
        cleaned = clean_desc(desc_vi)

        hs_code = normalize_hs(hs_raw) if hs_raw else None
        if hs_code and len(hs_code) == 4:
            # heading row (nhóm 4 số)
            flush_note()
            heading_code = hs_code
            heading_desc = cleaned
            desc_stack = []
        else:
            # cập nhật stack mô tả phân cấp theo số gạch đầu dòng
            desc_stack = [(lv, d) for lv, d in desc_stack if lv < level]
            desc_stack.append((level, cleaned))

        if not hs_code:
            continue  # dòng nhóm mô tả trung gian không có mã

        # mô tả đầy đủ: heading > các cấp cha > chính nó
        path = [heading_desc] if heading_desc and hs_code != heading_code else []
        path += [d for _, d in desc_stack]
        if hs_code == heading_code:
            path = [heading_desc]
        description_full_vi = " > ".join(p for p in path if p)

        fta_rates = {}
        for fta, c in FTA_COLS.items():
            rate = cell(row, c)
            if rate:
                fta_rates[fta] = {
                    "rate": rate,
                    "doc": cell(row, c + 1),
                    "effective_date": cell(row, c + 2),
                }
        rcept_doc = cell(row, 80)
        rcept_date = cell(row, 81)
        for fta, c in RCEPT_COLS.items():
            rate = cell(row, c)
            if rate:
                fta_rates[fta] = {"rate": rate, "doc": rcept_doc,
                                  "effective_date": rcept_date}

        rec = {
            "hs_code": hs_code,
            "level": len(hs_code),
            "section_code": section_code,
            "section_name": section_name,
            "chapter_code": hs_code[:2] if len(hs_code) >= 2 else chapter_code,
            "chapter_name": chapter_name,
            "heading_code": heading_code,
            "description_vi": cleaned,
            "description_en": clean_desc(desc_en),
            "description_full_vi": description_full_vi,
            "unit_vi": cell(row, COL_UNIT_VI),
            "unit_en": cell(row, COL_UNIT_EN),
            "nk_tt_rate_raw": cell(row, COL_NK_TT),
            "nk_tt_rate": parse_rate(cell(row, COL_NK_TT)),
            "mfn_rate_raw": cell(row, COL_NK_UD),
            "mfn_rate": parse_rate(cell(row, COL_NK_UD)),
            "mfn_doc": cell(row, COL_NK_UD + 1),
            "vat_rate_raw": cell(row, COL_VAT),
            "vat_rate": parse_rate(cell(row, COL_VAT)),
            "ttdb_rate_raw": cell(row, COL_TTDB),
            "xk_rate_raw": cell(row, COL_XK),
            "xk_cptpp_rate_raw": cell(row, COL_XK_CPTPP),
            "xk_ev_rate_raw": cell(row, COL_XK_EV),
            "xk_ukv_rate_raw": cell(row, COL_XK_UKV),
            "bvmt_rate_raw": cell(row, COL_BVMT),
            "policy": cell(row, COL_POLICY),
            "vat_reduction": cell(row, COL_VAT_REDUCTION),
            "preferential_rates": fta_rates,
        }
        records.append(rec)

    flush_note()
    wb.close()

    # ---------- write hs_codes.jsonl ----------
    with open(OUT / "hs_codes.jsonl", "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    # ---------- write hs_codes.csv (flatten FTA -> cột riêng) ----------
    fta_names = list(FTA_COLS) + list(RCEPT_COLS)
    csv_fields = [
        "hs_code", "level", "section_code", "chapter_code", "heading_code",
        "description_vi", "description_en", "description_full_vi",
        "unit_vi", "unit_en", "nk_tt_rate_raw", "mfn_rate_raw", "vat_rate_raw",
        "ttdb_rate_raw", "xk_rate_raw", "bvmt_rate_raw",
    ] + [f"fta_{n}" for n in fta_names] + ["policy", "vat_reduction"]
    with open(OUT / "hs_codes.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=csv_fields)
        w.writeheader()
        for r in records:
            row_out = {k: r.get(k, "") for k in csv_fields if not k.startswith("fta_")}
            for n in fta_names:
                row_out[f"fta_{n}"] = r["preferential_rates"].get(n, {}).get("rate", "")
            w.writerow(row_out)

    # ---------- write hs_notes.jsonl ----------
    with open(OUT / "hs_notes.jsonl", "w", encoding="utf-8") as f:
        for n in notes:
            f.write(json.dumps(n, ensure_ascii=False) + "\n")

    # ---------- quality report ----------
    leaf = [r for r in records if r["level"] == 8]
    issues = []
    warnings = []
    bad_fmt = sorted({r["hs_code"] for r in records if len(r["hs_code"]) not in (4, 6, 8)})
    if bad_fmt:
        warnings.append(f"{len(bad_fmt)} HS codes with unusual length (source typos, kept as-is): {bad_fmt[:10]}")
    missing_desc = [r["hs_code"] for r in leaf if not r["description_vi"]]
    if missing_desc:
        issues.append(f"{len(missing_desc)} leaf records missing description_vi")
    missing_mfn = [r["hs_code"] for r in leaf
                   if r["mfn_rate"] is None and not r["mfn_rate_raw"]]
    if missing_mfn:
        issues.append(f"{len(missing_mfn)} leaf records missing MFN rate (sample: {missing_mfn[:5]})")
    weird_mfn = [r["hs_code"] for r in leaf
                 if r["mfn_rate"] is not None and not (0 <= r["mfn_rate"] <= 200)]
    if weird_mfn:
        issues.append(f"{len(weird_mfn)} leaf records with suspicious MFN rate")
    # Chương 98 là chương đặc thù VN: 1 mã 98xx có thể áp cho nhiều dòng -> không tính là lỗi
    dup = [c for c, n in Counter(r["hs_code"] for r in leaf
                                 if r["chapter_code"] != "98").items() if n > 1]
    if dup:
        issues.append(f"{len(dup)} duplicate 8-digit HS codes outside chapter 98 (sample: {dup[:5]})")
    chapters = sorted({r["chapter_code"] for r in records if r["chapter_code"]})
    expected = {str(i).zfill(2) for i in range(1, 99)} - {"77"}  # 77 dự trữ trong HS
    missing_ch = sorted(expected - set(chapters))
    if missing_ch:
        issues.append(f"Missing chapters: {missing_ch}")

    report = {
        "source_file": SRC.name,
        "sheet": SHEET,
        "total_records": len(records),
        "by_level": dict(Counter(r["level"] for r in records)),
        "leaf_8digit": len(leaf),
        "notes_chunks": len(notes),
        "chapters_found": len(chapters),
        "issues": issues,
        "warnings": warnings,
        "passed": not issues,
    }
    with open(OUT / "quality_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
