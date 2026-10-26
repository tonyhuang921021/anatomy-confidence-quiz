"""Generate additive pedagogical placement; never rewrite official source papers.
Run after classification-review.csv has been source-bound and reviewed.
"""
from pathlib import Path
import csv,hashlib,json
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
rules=read('docs/moex-98-99/learning-placement-rules.json')
rawpath=ROOT/'data/sources/moex_98_99_official_questions.json';raw=json.loads(rawpath.read_text())['questions']
review=read('data/sources/moex_98_99_classification_review.json')['questions']
tags={t['name']:t for t in read('data/analysisPrimaryTagTaxonomy.json')['primaryTags']}
chapters={c['chapter']:list(c['sections'])for c in rules['anatomyOriginalOutline']}
for c in rules['anatomyOutlineAdditions']:
 ss=chapters.setdefault(c['chapter'],[])
 for s in c['sections']:
  assert s not in ss,(c,s)
  ss.append(s)
placements={};rows=[]
for q in raw:
 i=q['id'];subject,name=review[i];tag=tags[name];assert tag['subject']==subject
 if subject=='解剖學':
  chapter,section=rules['anatomyByQuestionId'][i];assert section in chapters[chapter];origin='existing_outline'if any(c['chapter']==chapter and section in c['sections']for c in rules['anatomyOriginalOutline'])else'necessary_outline_addition';witness='data/anatomyQuestions.ts:anatomyOutline'if origin=='existing_outline'else'declared additive outline node'
 else:
  chapter,section=rules['questionExceptions'].get(i,rules['byPrimaryTagId'][tag['id']]);assert chapter==subject
  pair=rules['existingPairWitnesses'][subject+'|'+chapter+'|'+section]
  assert pair['existingQuestionId'] or pair['newReason'];origin='existing_pair'if pair['existingQuestionId']else'necessary_section_addition';witness=pair['existingQuestionId']or pair['newReason']
 assert chapter!='舊制官方原卷'and section not in ['醫學（一）','醫學（二）']
 placements[i]=[chapter,section]
 rows.append({'id':i,'subject':subject,'primaryTagId':tag['id'],'chapter':chapter,'section':section,'placementBasis':origin,'existingPairWitnessOrReason':witness,'sourceUrl':q['officialSource']['questionUrl'],'sourcePage':q['officialSource']['page'],'originalSourceChapter':q['chapter'],'originalSourceSection':q['section']})
assert len(placements)==800
out={'reviewedAt':'2026-10-26','sourceFileSha256':hashlib.sha256(rawpath.read_bytes()).hexdigest(),'questions':placements,'anatomyOutlineAdditions':rules['anatomyOutlineAdditions']}
(ROOT/'data/sources/moex_98_99_learning_placement.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
with (ROOT/'docs/moex-98-99/learning-placement-review.csv').open('w',newline='')as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n');w.writeheader();w.writerows(rows)
from collections import Counter
print('800 pedagogical placements; official source unchanged;',dict(Counter(r['placementBasis']for r in rows)))
