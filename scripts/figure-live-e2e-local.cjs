// Local-only demonstrator. It writes synthetic data to an explicitly named
// local PostgreSQL database; it never connects to the production project.
const {execFileSync}=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {runOne}=require('../lib/durableFigureWorker.cjs');const {commonsSearch,readBoundedImage}=require('../lib/localFigureDiscovery.cjs');const {review}=require('../lib/figureReviewService.cjs');
const socket='/tmp/figure-review-socket',db=process.env.FIGURE_E2E_DB||'figure_queue_e2e7',psql='/opt/homebrew/opt/postgresql@17/bin/psql';
if(!/^figure_queue_e2e[a-z0-9_]*$/.test(db))throw Error('isolated test database name required');
function sql(s){return execFileSync(psql,['-X','-qAt','-v','ON_ERROR_STOP=1','-h',socket,'-p','55493','-d',db],{input:s,encoding:'utf8',maxBuffer:5*1024*1024}).trim()}
const q=x=>"'"+String(x).replace(/'/g,"''")+"'", obj=s=>{let v=sql(s);return v?JSON.parse(v):null};
const request='20000000-0000-4000-8000-000000000001',actor='20000000-0000-4000-8000-000000000002';
const text='## hip flexion anatomy\n髖屈肌群包含髂腰肌；肌群位置與髖屈肌拉傷，應和關節運動方向分別理解。\n| 項目 | 說明 |\n|---|---|\n| 肌群 | 髂腰肌等 |';
const repo={
 forLease(requestId,leaseId){return {...this,async insertPending(row){const id=crypto.randomUUID();const result=sql(`select public.figure_queue_stage(${q(requestId)},${q(leaseId)},${q(id)},${q(row.question_id)},${q(row.explanation_sha256)},${q(row.image_sha256)},${q(row.image_mime)},decode(${q(row.image_bytes.toString('hex'))},'hex'),${q(row.source_url)},${q(row.license_url)},${q(row.license)},${q(row.attribution)},${q(row.section_title)});`);if(!result)throw Error('fenced stage failed');return {id:result}}}},
 async readCommitted(id){const r=obj(`select row_to_json(t) from (select explanation from public.question_explanation_overrides where question_id=${q(id)}) t;`);return r?.explanation??null},
 async insertPending(row){const id=crypto.randomUUID();const h=row.image_bytes.toString('hex');sql(`insert into public.explanation_figure_candidates(id,question_id,explanation_sha256,image_sha256,image_mime,image_bytes,source_url,license_url,license,attribution,section_title) values(${q(id)},${q(row.question_id)},${q(row.explanation_sha256)},${q(row.image_sha256)},${q(row.image_mime)},decode(${q(h)},'hex'),${q(row.source_url)},${q(row.license_url)},${q(row.license)},${q(row.attribution)},${q(row.section_title)});`);return {id}},
 async getPending(id){const r=obj(`select row_to_json(t) from (select id,question_id,explanation_sha256,image_sha256,image_mime,encode(image_bytes,'hex') image_hex,source_url,license_url,license,attribution,section_title,status from public.explanation_figure_candidates where id=${q(id)} and status='pending') t;`);return r?{...r,image_bytes:Buffer.from(r.image_hex,'hex')}:null},
 async compareAndSetPendingWithCommittedExplanation(id,x){const result=sql(`select public.review_explanation_figure(${q(id)},${q(x.status)},${q(x.reviewer_id)},true,${q(x.expected_explanation)},${q(x.expected_explanation_sha256)},${q(x.expected_image_sha256)},decode(${q(x.expected_image_bytes.toString('hex'))},'hex'));`);return result===x.status?{status:result}:null}
};
const queue={async claim(lease,seconds){return obj(`select row_to_json(t) from public.figure_queue_claim(${q(lease)},${seconds}) t;`)},async enabled(){return sql('select enabled from public.figure_queue_config where id=true;')==='t'},async finish(id,lease,ok){return sql(`select public.figure_queue_finish(${q(id)},${q(lease)},${ok});`)}};
(async()=>{
 assert.equal(sql(`select public.figure_guard_reserve(${q(request)},${q(actor)},'LOCAL-E2E-HIP','synthetic','synthetic');`),'reserved');
 assert.equal(sql(`select status from public.figure_guard_commit(${q(request)},${q(actor)},${q(text)},'{}','');`),'inserted');
 const result=await runOne({queue,repository:repo,search:commonsSearch,loadImage:readBoundedImage});assert.equal(result.status,'pending_review');
 const item=obj("select row_to_json(t) from (select id,source_url,license,attribution,section_title,status from public.explanation_figure_candidates limit 1) t;");
 assert.equal(item.source_url,'https://commons.wikimedia.org/wiki/File:Hip_flexor_strain.svg');assert.equal(item.status,'pending');
 // The operator actually inspected this image and its Commons/CC BY-SA page.
 // The synthetic explanation explicitly discusses flexor anatomy and strain.
 await review({actor:{verifiedAdminId:actor},candidateId:item.id,decision:'approved',visualConfirmed:true,repository:repo,readCommitted:repo.readCommitted});
 const listed=obj("select row_to_json(t) from public.list_approved_explanation_figures('LOCAL-E2E-HIP') t;");assert.equal(listed.id,item.id);
 const image=obj(`select row_to_json(t) from (select image_mime,image_sha256,encode(image_bytes,'base64') image_base64 from public.read_approved_explanation_figure(${q(item.id)})) t;`);assert.equal(image.image_mime,'image/png');
 const bytes=Buffer.from(image.image_base64,'base64');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),image.image_sha256);
 require('node:fs').writeFileSync('/tmp/figure-live-approved.json',JSON.stringify({metadata:listed,imageBase64:bytes.toString('base64')}),{mode:0o600});
 console.log(JSON.stringify({result:'PASS search -> saved pending -> human-verified approval -> approved bytes',question:'LOCAL-E2E-HIP',source:item.source_url,license:item.license,attribution:item.attribution,bytes:bytes.length,sha256:image.image_sha256,modelCalls:0}));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
