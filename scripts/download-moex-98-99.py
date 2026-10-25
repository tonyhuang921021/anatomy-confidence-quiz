#!/usr/bin/env python3
"""Download only the eight verified 98/99 stage-one papers; never uploads."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/moex-98-99/source-pdfs'

def sources():
    for year, round_no, code, category, subjects in [
        (98, 1, '098020', '103', ['c011', 'c021']),
        (98, 2, '098140', '103', ['c011', 'c021']),
        (99, 1, '099010', '101', ['100', '200']),
        (99, 2, '099130', '101', ['100', '200']),
    ]:
        for index, subject in enumerate(subjects):
            paper = '1101' if index == 0 else '2101'
            yield dict(rocYear=year, round=round_no, examCode=code, paperCode=paper,
                       subject='醫學（一）' if index == 0 else '醫學（二）',
                       category=category, subjectCode=subject)

def download(job):
    source, kind = job
    url = 'https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?' + urlencode(
        dict(t=kind, code=source['examCode'], c=source['category'], s=source['subjectCode'], q=1))
    dest = OUT / f"{source['examCode']}-{source['paperCode']}-{kind}.pdf"
    if not dest.exists():
        with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=45) as response:
            data = response.read()
        if not data.startswith(b'%PDF'):
            if kind == 'Q':
                raise ValueError(f'Not a PDF: {url}')
            return dict(**source, kind=kind, url=url, available=False,
                        responseSha256=hashlib.sha256(data).hexdigest())
        dest.write_bytes(data)
    data = dest.read_bytes()
    return dict(**source, kind=kind, url=url, available=True, localPath=str(dest.relative_to(ROOT)),
                bytes=len(data), sha256=hashlib.sha256(data).hexdigest())

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        rows = list(pool.map(download, [(source, kind) for source in sources() for kind in ['Q', 'S', 'M']]))
    target = ROOT / 'data/sources/moex_98_99_source_manifest.json'
    target.write_text(json.dumps(dict(sources=rows), ensure_ascii=False, indent=2) + '\n')
    print(f'Checked {len(rows)} official URLs; {sum(row.get("bytes", 0) for row in rows):,} bytes')
    print(json.dumps([{k: v for k, v in row.items() if k in ['examCode', 'paperCode', 'kind', 'available']} for row in rows]))
