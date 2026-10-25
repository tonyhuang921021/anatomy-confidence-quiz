"""Rebuild reviewed classification tuples from the source-bound, per-question CSV.

No question text, answer, image, identity or historical paper field is rewritten.
Run from the repository root with Python 3.10+.
"""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'data/sources/moex_98_99_official_questions.json'
questions = {q['id']: q for q in json.loads(source.read_text())['questions']}
taxonomy = {t['id']: t for t in json.loads((ROOT / 'data/analysisPrimaryTagTaxonomy.json').read_text())['primaryTags']}
rows = list(csv.DictReader((ROOT / 'docs/moex-98-99/classification-review.csv').open()))
assert len(rows) == len(questions) == len({r['id'] for r in rows}) == 800
assert {r['id'] for r in rows} == set(questions)
assignments, pending = {}, []
subjects = {t['subject'] for t in taxonomy.values()}
for r in rows:
    q = questions[r['id']]
    fingerprint = hashlib.sha256(json.dumps(q, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    assert fingerprint == r['sourceQuestionSha256'], r['id'] + ': original question changed; re-review required'
    assert r['sourceUrl'] == q['officialSource']['questionUrl']
    assert int(r['physicalPage']) == q['officialSource']['page']
    if r['subjectStatus'] == 'needs_review':
        assert r['primaryTagStatus'] == 'taxonomy_gap' and not r['primaryTagId'] and not r['primaryTag']
        pending.append(r['id'])
        continue
    assert r['subjectStatus'] == 'reviewed' and r['subject'] in subjects
    if r['primaryTagStatus'] == 'reviewed':
        tag = taxonomy[r['primaryTagId']]
        assert tag['subject'] == r['subject'] and tag['name'] == r['primaryTag']
    else:
        assert r['primaryTagStatus'] == 'taxonomy_gap' and not r['primaryTagId'] and not r['primaryTag']
    assignments[r['id']] = [r['subject'], r['primaryTag'] or None]
result = {'reviewedAt': '2026-10-26', 'sourceFileSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'questions': assignments, 'pendingQuestionIds': pending}
output = ROOT / 'data/sources/moex_98_99_classification_review.json'
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'{len(rows)} source-bound rows; {len(assignments)} reviewed subjects; {len(pending)} pending')
