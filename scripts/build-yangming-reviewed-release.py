from pathlib import Path
import json, hashlib
root=Path(__file__).resolve().parents[1]
task=root.parent
handoff=task.parent/'task-2/handoff'
read=lambda p:json.loads(p.read_text())
rows=read(handoff/'delivery/reviewed-rows.json')
pairs=[json.loads(x) for x in (handoff/'question-explanation-pairs.jsonl').read_text().splitlines()]
pairmap={x['question_id']:x for x in pairs}
audit=read(task/'output/explanation-results/陽明canonical配對檢查.json')
ids={x['sourceQuestionId']:x['canonicalQuestionId'] for x in audit['rows']}
notes=read(handoff/'source-notes-for-writer.json')
current=read(task/'diagnosis/yangming-current-672-read-only.json')
protected=read(handoff/'preserve-human-bodies.json')
assets=[]
for r in rows:
    for a in r['assets']:
        file=handoff/'delivery'/a['src']
        sha=hashlib.sha256(file.read_bytes()).hexdigest()
        expected=next(x['sha256'] for x in pairmap[r['question_id']]['images'] if x['src']==a['src'])
        assert sha==expected, a['src']
        assets.append({'relativePath':a['src'],'sha256':sha,'bytes':file.stat().st_size})
release='ym-reviewed-20261011-'+hashlib.sha256(json.dumps([(x['relativePath'],x['sha256']) for x in assets],sort_keys=True).encode()).hexdigest()[:12]
prefix='reviewed-releases/'+release
for a in assets:a['storagePath']=prefix+'/'+a['relativePath']
payload=[]
for r in rows:
    sid=r['question_id']; pair=pairmap[sid]
    assert pair['status'] in ['replacement_ready','keep_existing']
    canonical=ids[sid]
    image_rows=[{**a,'src':prefix+'/'+a['src']} for a in r['assets']]
    matching=[x for x in current if x['question_id'] in [sid,canonical] and x['source_file']==r['source_file'] and x['source_page_start']==r['source_page_start']]
    matching.sort(key=lambda x:x['updated_at'],reverse=True)
    attribution=next((x for x in matching if x['author'] or x['reviewer']),{})
    human=[]
    for x in current:
        if x['question_id'] in [sid,canonical] and x['nonempty_body'] and not any(y['body']==x['nonempty_body'] for y in human):
            human.append({'body':x['nonempty_body'],'recordLayer':x['source'],'updatedAt':x['updated_at']})
    payload.append({'questionId':canonical,'sourceQuestionId':sid,'status':pair['status'],'body':'','humanNotes':human,
        'author':attribution.get('author'),'reviewer':attribution.get('reviewer'),
        'sourceLabel':'長庚117級原稿詳解' if r['source_file']=='115-1醫學一合併總檔.pdf' else '原稿詳解（署名見原圖）',
        'sourceFile':r['source_file'],'sourcePageStart':r['source_page_start'],'sourcePageEnd':r['source_page_end'],
        'sections':r['sections'],'assets':image_rows,'sourceNotes':[n['source_note'] for n in notes if n['question_id']==sid]})
pending=read(handoff/'pending-reason-classification.json')['questions']
for p in pending:
    payload.append({'questionId':ids[p['question_id']],'sourceQuestionId':p['question_id'],'status':'pending_source','body':p['fallback_display_suggestion']+'\n'+p['evidence_conclusion'],
        'pendingSource':True,'sourceNotes':[],'assets':[],'humanNotes':[],
        'sourceFile':p['source_file_checked'],'sourceLabel':'原稿詳解待補','sourcePageStart':None,'sourcePageEnd':None})
assert len(payload)==672 and len({x['questionId'] for x in payload})==672 and len(assets)==1087
for p in protected:
    row=next(x for x in payload if x['sourceQuestionId']==p['question_id'])
    assert any(hashlib.sha256(n['body'].encode()).hexdigest()==p['body_sha256'] for n in row['humanNotes'])
manifest={'releaseId':release,'storageBucket':'yangming-explanations','storagePrefix':prefix,'summary':{'total':672,'ready':636,'replacementReady':555,'keepExisting':81,'pending':36,'images':1087},'rows':payload}
(root/'data/sources/yangming_reviewed_release.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
(root/'docs/yangming-reviewed-release/upload-manifest.json').write_text(json.dumps({'releaseId':release,'bucket':'yangming-explanations','assets':assets},ensure_ascii=False,indent=2)+'\n')
(root/'docs/yangming-reviewed-release/source-identity-manifest.json').write_text(json.dumps({'sourceHandoffSha256':hashlib.sha256((handoff/'handoff-file-manifest.json').read_bytes()).hexdigest(),'sourcePdfs':48,'originalImagesShaUnchanged':True,'protectedBodies':protected,'canonicalMap':ids,'pendingReasonCounts':read(handoff/'pending-reason-classification.json').get('summary')},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'releaseId':release,'rows':len(payload),'images':len(assets),'bytes':sum(x['bytes'] for x in assets),'attributionNames':sum(bool(x.get('author') or x.get('reviewer')) for x in payload)},ensure_ascii=False))
