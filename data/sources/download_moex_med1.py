#!/usr/bin/env python3
"""Download MOEX 醫師一階醫學（一） official PDFs from a manifest.
Usage:
  python download_moex_med1.py
"""
import json
from pathlib import Path
from urllib.request import Request, urlopen

OUT = Path('moex_med1_pdfs')
OUT.mkdir(exist_ok=True)
manifest_path = Path('moex_med1_source_manifest.json')
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))

for item in manifest['sources']:
    for kind, key in [('Q','questionPdfUrl'), ('S','answerPdfUrl'), ('M','amendedAnswerPdfUrl')]:
        url = item[key]
        filename = f"{item['label']}-med1-{kind}.pdf"
        dest = OUT / filename
        req = Request(url, headers={'User-Agent':'Mozilla/5.0'})
        try:
            with urlopen(req, timeout=30) as r:
                data = r.read()
            dest.write_bytes(data)
            print('OK', filename, len(data))
        except Exception as e:
            print('FAIL', filename, e)
