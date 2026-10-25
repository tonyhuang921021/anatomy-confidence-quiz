#!/usr/bin/env python3
"""Reproducible, offline import of verified MOEX 98/99 PDFs. No AI content."""
import csv
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import unicodedata
from collections import Counter
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'data/sources/moex_98_99_source_manifest.json'
REVISIONS = ROOT / 'data/sources/moex_98_99_verified_revisions.json'
MEDIA = ROOT / 'public/question-media/moex-98-99'
TEMP_IMAGES = ROOT / 'reports/moex-98-99/png-staging'
OPTION = dict(zip('\ue18c\ue18d\ue18e\ue18f', 'ABCD'))
GLYPHS = {'\ue000': '①', '\ue001': '②', '\ue002': '③', '\ueee7': '𧿹'}
SCOPES = {
    '1101': '解剖學、胚胎學、組織學、微生物免疫學、寄生蟲學、公共衛生學等科目及其臨床相關知識',
    '2101': '生理學、生化學、藥理學、病理學等科目及其臨床相關知識',
}
SHARED_CONTEXTS = {
    '098140-1101': {49: 48, 61: 60},
    '099130-1101': {50: 49, 61: 60},
}
CASE_GROUPS = {
    '098020-1101': {62: [63, 64, 65]},
    '098020-2101': {22: [23, 24], 75: [76, 77]},
    '098140-1101': {1: [2, 3, 4]},
}

def clean(text):
    text = ''.join(GLYPHS.get(c, unicodedata.normalize('NFKC', c) if '\uf900' <= c <= '\ufaff' else c) for c in text)
    return re.sub(r'\s+', ' ', text).strip()

def pdf_text(path):
    return subprocess.check_output(['pdftotext', '-layout', str(path), '-']).decode('utf-8')

def answers(path):
    text = unicodedata.normalize('NFKC', pdf_text(path))
    count = re.search(r'題\s*數\s*[:：]\s*(\d+)\s*題', text)
    if not count:
        raise ValueError(f'Missing official count: {path}')
    tokens = [v for line in text.splitlines() if re.match(r'^\s*答案\s', line)
              for v in re.findall(r'[ABCD#]', line)]
    assert len(tokens) == int(count[1]), (path, len(tokens), count[1])
    notes = re.sub(r'\s+', '', text.split('註', 1)[-1])
    corrections = {}
    for match in re.finditer(r'第(\d+)題(.*?)(?=[,，。]|$)', notes):
        number, note = int(match[1]), match[2]
        if '一律給分' in note:
            corrections[number] = dict(acceptedAnswers=list('ABCD'), answerCreditType='all_credit', note=f'第{number}題{note}')
        elif '給分' in note:
            values = re.findall(r'[ABCD]', note)
            assert values, (path, note)
            corrections[number] = dict(acceptedAnswers=values, answerCreditType='multiple_accepted', note=f'第{number}題{note}')
    assert {i+1 for i,v in enumerate(tokens) if v == '#'} == set(corrections), (path, corrections)
    return tokens, corrections

def question_starts(doc):
    starts = []
    expected = 1
    for page_no, page in enumerate(doc):
        for word in sorted(page.get_text('words'), key=lambda w: (round(w[1]/3), w[0])):
            if word[0] < 61 and word[4] == str(expected):
                starts.append((expected, page_no, word[1]))
                expected += 1
    return starts

def regions(doc, start, following):
    _, page_no, y = start
    end_page = following[1] if following else len(doc)-1
    result = []
    for index in range(page_no, end_page+1):
        page = doc[index]
        top = y-1 if index == page_no else 81
        bottom = following[2]-0.1 if following and index == following[1] else min(810, page.rect.height-25)
        if bottom <= top:
            continue
        # Trim blank continuations, e.g. 99-1 II's final blank physical page.
        words = [w for w in page.get_text('words') if w[0] < 554 and w[1] >= top and (w[1]+w[3])/2 < bottom]
        if ''.join(w[4] for w in words).strip() == '以下空白':
            continue
        images = [fitz.Rect(i['bbox']) for i in page.get_image_info() if i['bbox'][1] >= top and i['bbox'][3] <= bottom]
        if not words and not images:
            continue
        content_bottom = max([w[3] for w in words] + [r.y1 for r in images])
        result.append((index, fitz.Rect(39, top, 554, min(bottom, content_bottom+3))))
    return result

def parse_question(doc, rects, number):
    lines = []
    for page_no, rect in rects:
        for block in doc[page_no].get_text('rawdict')['blocks']:
            for line in block.get('lines', []):
                chars = [c for span in line['spans'] for c in span['chars']
                         if rect.contains(fitz.Point((c['bbox'][0]+c['bbox'][2])/2, (c['bbox'][1]+c['bbox'][3])/2))]
                if not chars:
                    continue
                if re.match(r'^\s*(代號|頁次)', ''.join(c['c'] for c in chars)):
                    continue
                lines.append((page_no, line['bbox'][1], chars))
    markers = [(p, c['bbox'][1], c['bbox'][0], OPTION[c['c']])
               for p,y,chars in lines for c in chars if c['c'] in OPTION]
    assert Counter(m[3] for m in markers) == Counter('ABCD'), (number, markers)
    parts = {key: [] for key in ['stem', 'A', 'B', 'C', 'D']}
    first = min(markers, key=lambda m:(m[0],m[1]))
    for page_no, y, chars in sorted(lines, key=lambda row:(row[0],round(row[1]/3),row[2][0]['bbox'][0])):
        current = None
        chunk = []
        for char in chars:
            if char['c'] in OPTION:
                continue
            x, cy = char['bbox'][0], char['bbox'][1]
            if (page_no, cy+2) < (first[0], first[1]):
                key = 'stem'
            else:
                preceding = [m for m in markers if m[0] < page_no or (m[0] == page_no and m[1] <= cy+3)]
                if not preceding:
                    key = 'stem'
                else:
                    last = max(preceding, key=lambda m:(m[0],m[1]))
                    row_markers = [m for m in preceding if m[0] == last[0] and abs(m[1]-last[1])<4]
                    candidates = [m for m in row_markers if m[2] <= x+3]
                    key = max(candidates or row_markers, key=lambda m:m[2] if candidates else -m[2])[3]
            if current != key:
                if chunk:
                    parts[current].append(''.join(chunk))
                current, chunk = key, []
            chunk.append(char['c'])
        if chunk:
            parts[current].append(''.join(chunk))
    result = {key: clean(' '.join(value)) for key,value in parts.items()}
    result['stem'] = re.sub(r'^'+str(number)+r'\s*', '', result['stem']).strip()
    assert all(result.values()), (number, result)
    assert not re.search('[\ue000-\uf8ff]', ''.join(result.values())), (number, result)
    return result

def split_following_case(doc, rects):
    """A shared case printed before the next number belongs to that next group."""
    for page_no, rect in rects:
        for block in doc[page_no].get_text('dict')['blocks']:
            for line in block.get('lines', []):
                text=''.join(span['text'] for span in line['spans']).strip()
                if text.startswith('情況：') and rect.y0 <= line['bbox'][1] < rect.y1:
                    boundary=line['bbox'][1]-0.1
                    before=[(p,r) for p,r in rects if p<page_no]
                    before.append((page_no,fitz.Rect(rect.x0,rect.y0,rect.x1,boundary)))
                    after=[(page_no,fitz.Rect(rect.x0,boundary,rect.x1,rect.y1))]
                    after.extend((p,r) for p,r in rects if p>page_no)
                    stem=clean(' '.join(doc[p].get_text('text',clip=r,sort=True) for p,r in after))
                    return before,dict(stem=stem,rects=after)
    return rects,None

def apply_verified_revision(parts, question_id):
    """Apply only source-reviewed exceptions; fail if extraction has since changed."""
    revision = next((r for r in json.loads(REVISIONS.read_text())['revisions']
                     if r['id'] == question_id), None)
    if not revision:
        return parts, False
    for field, expected in revision['expected'].items():
        if field == 'options':
            assert all(parts[key] == value for key, value in expected.items()), question_id
        else:
            assert parts[field] == expected, question_id
    for field, replacement in revision['replacement'].items():
        if field == 'options':
            parts.update(replacement)
        else:
            parts[field] = replacement
    return parts, revision['showOriginal']

def render(doc, rects, destination):
    canvas = fitz.open()
    page = canvas.new_page(width=max(r.width for p,r in rects), height=sum(r.height for p,r in rects))
    y = 0
    for page_no, rect in rects:
        page.show_pdf_page(fitz.Rect(0,y,rect.width,y+rect.height),doc,page_no,clip=rect)
        y += rect.height
    pix = page.get_pixmap(matrix=fitz.Matrix(2,2), alpha=False)
    pix.save(TEMP_IMAGES / (destination.stem+'.png'))
    return pix.width,pix.height

def has_graphics(doc, rects):
    for page_no, rect in rects:
        page = doc[page_no]
        if any(rect.intersects(fitz.Rect(i['bbox'])) for i in page.get_image_info()):
            return True
        for drawing in page.get_drawings():
            r=drawing['rect']
            if r.y0>81 and r.x1<554 and r.height>3 and rect.intersects(r):
                return True
    return False

def main():
    sources = json.loads(MANIFEST.read_text())['sources']
    MEDIA.mkdir(parents=True, exist_ok=True)
    TEMP_IMAGES.mkdir(parents=True, exist_ok=True)
    questions, papers, mapping = [], [], []
    for source in [s for s in sources if s['kind']=='Q']:
        key = f"{source['examCode']}-{source['paperCode']}"
        answer_source = next(s for s in sources if s['examCode']==source['examCode'] and s['paperCode']==source['paperCode'] and s['kind']=='M' and s['available'])
        tokens, corrections = answers(ROOT / answer_source['localPath'])
        doc = fitz.open(ROOT / source['localPath'])
        header = clean(doc[0].get_text())
        count = re.search(r'共\s*(\d+)\s*題', header)
        assert count and int(count[1]) == len(tokens), (key, header)
        assert '2' in header and ('小時' in header) and all(v in header.replace(' ','') for v in (['解剖學', '公共衛生'] if source['paperCode']=='1101' else ['生理學', '病理學'])), key
        starts = question_starts(doc)
        assert len(starts)==len(tokens), (key,len(starts),len(tokens))
        graphics = []
        cases = {}
        for index, start in enumerate(starts):
            no = index+1
            rects = regions(doc,start,starts[index+1] if index+1<len(starts) else None)
            rects, following_case = split_following_case(doc,rects)
            if following_case:
                assert no in CASE_GROUPS.get(key,{}), (key,no,following_case['stem'])
                cases[no]=following_case
            parts = parse_question(doc,rects,no)
            qid = f'MOEX-{key}-Q{no:03}'
            parts, show_original = apply_verified_revision(parts, qid)
            filename = qid+'.webp'
            case_source=next((previous for previous,targets in CASE_GROUPS.get(key,{}).items() if no in targets),None)
            image_rects=(cases[case_source]['rects'] if case_source else [])+rects
            size = render(doc,image_rects,MEDIA/filename)
            graphic = has_graphics(doc,rects) or show_original
            if graphic: graphics.append(no)
            correction = corrections.get(no)
            accepted = correction['acceptedAnswers'] if correction else [tokens[index]]
            official_source = dict(questionUrl=source['url'], answerUrl=answer_source['url'],
                                   page=rects[0][0]+1, endPage=rects[-1][0]+1,
                                   image='/question-media/moex-98-99/'+filename, width=size[0], height=size[1],
                                   scope=SCOPES[source['paperCode']], answerNote=correction['note'] if correction else None)
            question = dict(id=qid, subject=source['subject'], chapter='舊制官方原卷', section=source['subject'],
                            stem=parts.pop('stem'), options=parts, answer=accepted[0],
                            acceptedAnswers=accepted, answerCreditType=correction['answerCreditType'] if correction else 'standard',
                            explanation='官方最終答案：'+('一律給分' if correction and correction['answerCreditType']=='all_credit' else '、'.join(accepted))+'。'+(correction['note']+'。' if correction else '')+'陽明詳解請由原站查閱對應年度、期別、醫學卷別與題號。',
                            testedConcept=source['subject']+'（舊制原卷）', sourceType='MOEX_PAST_EXAM',
                            sourceCitation=f"考選部 民國{source['rocYear']}年 第{source['round']}次 醫師第一階段 {source['subject']} {source['paperCode']}（舊制）",
                            sourceYear=source['rocYear']+1911, sourceRound=source['round'],
                            originalQuestionNumber=no, examCode=source['examCode'], paperCode=source['paperCode'],
                            examSessionLabel='第一次' if source['round']==1 else '第二次', officialSource=official_source)
            # Show the full original question automatically for figures/tables; every other question retains an expandable original.
            if graphic: question['stemImage']=official_source['image']
            if case_source:
                question['sharedContext']=dict(stem=cases[case_source]['stem'],questionNumbers=CASE_GROUPS[key][case_source])
            questions.append(question)
            mapping.append(dict(questionId=qid,rocYear=source['rocYear'],round=source['round'],paper=source['subject'],questionNumber=no,
                                book='96～100年國考詳解書籤版',page=None,status='source_link_only_page_unverified',
                                erratum='D→A（陽明勘誤，官方最終答案另核）' if key=='099010-1101' and no==41 else None))
        papers.append(dict(key=key, **source, questionCount=len(starts), pointsPerQuestion=1, durationMinutes=120,
                           scope=SCOPES[source['paperCode']], physicalPdfPages=len(doc), answerUrl=answer_source['url'],
                           graphicQuestions=graphics, corrections=corrections))
    # One Pillow process avoids launching 800 external encoders on the Mac.
    subprocess.run([os.environ.get('MOEX_IMAGE_PYTHON','/opt/homebrew/bin/python3'), '-c',
        'from pathlib import Path\nfrom PIL import Image\nimport sys\n'
        'for p in Path(sys.argv[1]).glob("*.png"):\n'
        ' target=Path(sys.argv[2])/(p.stem+".webp")\n'
        ' temporary=target.with_suffix(".webp.tmp")\n'
        ' Image.open(p).convert("RGB").save(temporary,"WEBP",quality=91,method=5)\n'
        ' temporary.replace(target)\n',
        str(TEMP_IMAGES),str(MEDIA)],check=True)
    for image in TEMP_IMAGES.glob('*.png'):
        image.unlink()
    if '--images-only' in sys.argv:
        print('Rendered official source images only; question data unchanged.')
        return
    by_id = {q['id']: q for q in questions}
    for key, contexts in SHARED_CONTEXTS.items():
        for number, context_number in contexts.items():
            by_id[f'MOEX-{key}-Q{number:03}']['sharedContext'] = dict(
                sourceQuestionNumber=context_number, stem=by_id[f'MOEX-{key}-Q{context_number:03}']['stem'])
    payload=dict(papers=papers,questions=questions)
    (ROOT/'data/sources/moex_98_99_official_questions.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'data/sources/yangming_98_99_source_links.json').write_text(json.dumps(dict(
        sourceUrl='https://sites.google.com/view/ymmedexam/ans',
        bookUrl='https://drive.google.com/uc?export=view&id=0B1fUmKbhv5stWlNHYWJ6eVB3OGs&resourcekey=0-4fO35WGRM9dAKE-kxKsEoA',
        errataUrl='https://sites.google.com/view/ymmedexam/ans/93103%E8%A9%B3%E8%A7%A3%E5%8B%98%E8%AA%A4',
        rights='原站供考生參考，未經原作者許可請勿挪作他用；本匯入僅保存來源及查找對照，不重製詳解全文。',
        bookVerified=False, questions=mapping),ensure_ascii=False,indent=2)+'\n')
    with (ROOT/'reports/moex-98-99/question-source-map.csv').open('w') as stream:
        writer=csv.DictWriter(stream,fieldnames=list(mapping[0]));writer.writeheader();writer.writerows(mapping)
    print(json.dumps([dict(key=p['key'],count=p['questionCount'],graphics=p['graphicQuestions'],corrections=len(p['corrections'])) for p in papers],ensure_ascii=False))

if __name__=='__main__': main()
