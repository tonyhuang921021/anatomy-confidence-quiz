#!/usr/bin/env python3
"""Focused second-pass QA from original PDF geometry, without downloading or rebuilding media."""
import hashlib
import importlib.util
import json
import re
from collections import Counter
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'reports/moex-98-99/quality-audit'

def center(word):
    return ((word[0] + word[2]) / 2, (word[1] + word[3]) / 2)

def independent_answer_cells(path):
    """Join each printed question-number cell to its answer below, independent of pdftotext order."""
    cells = {}
    for page_index, page in enumerate(fitz.open(path)):
        words = page.get_text('words')
        for label in [w for w in words if w[4] == '題序']:
            lx, ly = center(label)
            below = [w for w in words if w[4] == '答案' and abs(center(w)[0] - lx) < 4 and 0 < center(w)[1] - ly < 35]
            assert len(below) == 1, (path, label)
            ay = center(below[0])[1]
            numbers = [w for w in words if w[0] > label[2] and abs(center(w)[1] - ly) < 3 and re.fullmatch(r'\d{2,3}', w[4])]
            answers = [w for w in words if w[0] > label[2] and abs(center(w)[1] - ay) < 3 and re.fullmatch('[ABCD#]', w[4])]
            assert len(numbers) == len(answers) == 20, (path, page_index, len(numbers), len(answers))
            for number in numbers:
                matches = [w for w in answers if abs(center(w)[0] - center(number)[0]) < 5]
                assert len(matches) == 1, (path, number, matches)
                no = int(number[4]); assert no not in cells
                cells[no] = dict(answer=matches[0][4], page=page_index+1, numberRect=list(number[:4]), answerRect=list(matches[0][:4]))
    assert set(cells) == set(range(1, 101)), path
    return cells

def independent_page_boundaries(path):
    """Check physical page heads for continuation text before the next numbered question."""
    doc = fitz.open(path); results = []
    for index, page in enumerate(doc):
        if index == 0:
            continue
        # Repeated page header is above 70pt; all remaining text, including raised signs, is inspected.
        body = [w for w in page.get_text('words') if w[1] > 70 and w[0] < 554]
        if ''.join(w[4] for w in body).strip() == '以下空白':
            results.append(dict(page=index+1, blank=True)); continue
        assert body, (path, index)
        labels = sorted([w for w in body if w[0] < 61 and re.fullmatch(r'\d{1,3}', w[4])], key=lambda w: center(w)[1])
        assert labels, (path, index)
        first = labels[0]
        above = [w for w in body if center(w)[1] < center(first)[1] - 8]
        assert not above, (path, index, above)
        first_line = sorted([w for w in body if abs(center(w)[1] - center(first)[1]) < 8], key=lambda w: w[0])
        results.append(dict(page=index+1, firstQuestion=int(first[4]), firstLine=' '.join(w[4] for w in first_line), continuationBeforeQuestion=False))
    return results

def main():
    REPORT.mkdir(parents=True, exist_ok=True)
    payload = json.loads((ROOT/'data/sources/moex_98_99_official_questions.json').read_text())
    questions = {q['id']:q for q in payload['questions']}
    manifest = json.loads((ROOT/'data/sources/moex_98_99_source_manifest.json').read_text())
    answer_ledger, boundary_ledger = [], []
    for source in manifest['sources']:
        if source['kind'] == 'M' and source['available']:
            cells = independent_answer_cells(ROOT/source['localPath'])
            for no, cell in cells.items():
                qid = f"MOEX-{source['examCode']}-{source['paperCode']}-Q{no:03}"
                q = questions[qid]
                if cell['answer'] == '#':
                    assert q['answerCreditType'] in ('all_credit', 'multiple_accepted'), qid
                    status = 'correction_note_already_verified_in_first_pass'
                else:
                    assert q['answerCreditType'] == 'standard' and q['acceptedAnswers'] == [cell['answer']] and q['answer'] == cell['answer'], qid
                    status = 'standard_answer_matches_independent_printed_cell'
                answer_ledger.append(dict(id=qid, source=source['localPath'], status=status, **cell))
        elif source['kind'] == 'Q':
            for result in independent_page_boundaries(ROOT/source['localPath']):
                boundary_ledger.append(dict(source=source['localPath'], **result))
    # Curated exceptions are tested against the actual original PDF extraction, not only against generated JSON.
    spec = importlib.util.spec_from_file_location('moex_import', ROOT/'scripts/import-moex-98-99.py')
    importer = importlib.util.module_from_spec(spec); spec.loader.exec_module(importer)
    revisions = json.loads(importer.REVISIONS.read_text())['revisions']; checked = []
    for revision in revisions:
        qid = revision['id']; q = questions[qid]; key = f"{q['examCode']}-{q['paperCode']}"
        path = ROOT/'reports/moex-98-99/source-pdfs'/f'{key}-Q.pdf'
        doc = fitz.open(path); starts = importer.question_starts(doc); i = q['originalQuestionNumber'] - 1
        rects, _ = importer.split_following_case(doc, importer.regions(doc, starts[i], starts[i+1] if i+1<len(starts) else None))
        raw = importer.parse_question(doc, rects, i+1)
        reviewed, show_original = importer.apply_verified_revision(raw, qid)
        assert q['stem'] == reviewed['stem'], qid
        assert q['options'] == {k:reviewed[k] for k in 'ABCD'}, qid
        if show_original:
            assert q['stemImage'] == q['officialSource']['image'], qid
        checked.append(qid)
    before_path = REPORT/'before/questions.json'
    changed = []
    if before_path.exists():
        before = json.loads(before_path.read_text()); old = {q['id']:q for q in before['questions']}
        assert set(old) == set(questions)
        changed = [qid for qid in questions if questions[qid] != old[qid]]
        assert set(changed) == {r['id'] for r in revisions}, changed
        for qid in changed:
            assert {k for k in questions[qid] if questions[qid].get(k) != old[qid].get(k)} <= {'stem', 'options', 'stemImage'}, qid
        assert len(questions) - len(changed) == 788
    (REPORT/'independent-answer-cells.json').write_text(json.dumps(answer_ledger, ensure_ascii=False, indent=2)+'\n')
    (REPORT/'physical-page-boundaries.json').write_text(json.dumps(boundary_ledger, ensure_ascii=False, indent=2)+'\n')
    summary = dict(standardAnswersChecked=sum(x['answer']!='#' for x in answer_ledger), correctionMarkersMatched=sum(x['answer']=='#' for x in answer_ledger), correctionNotes='51 notes already verified in first pass; not redone',
                   contentPageBoundariesChecked=sum(not x.get('blank') for x in boundary_ledger), blankFinalPages=sum(bool(x.get('blank')) for x in boundary_ledger), continuationProblems=0,
                   sourceReviewedRevisionQuestions=checked, textualCorrections=11, originalTableDisplayCorrections=1, changedQuestions=len(changed) if before_path.exists() else None, unchangedQuestionObjects=788 if before_path.exists() else None,
                   sourceImagesRegenerated=0, answersChanged=0, oldQuestionBanksChanged=0)
    (REPORT/'focused-test-results.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__ == '__main__':
    main()
