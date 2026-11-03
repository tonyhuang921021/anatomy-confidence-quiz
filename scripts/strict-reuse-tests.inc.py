# This fixture only runs in the isolated database created by its harness.
real((root/'proposals/figure-review/strict-reuse.sql').read_text())
# Clone only synthetic accepted-origin fixture rows, never production data.
source_id=images[0]
real(f"update explanation_figure_candidates set status='approved',image_bytes=decode('89504e470d0a1a0a','hex'),image_sha256=encode(sha256(decode('89504e470d0a1a0a','hex')),'hex') where id='{source_id}';")
def clone(q):
 ident=str(uuid.uuid4());req=str(uuid.uuid4())
 real(f"insert into question_explanation_overrides select (jsonb_populate_record(null::question_explanation_overrides,to_jsonb(o)||jsonb_build_object('question_id','{q}'))).* from question_explanation_overrides o where question_id='NEW-OTHER';")
 real(f"insert into ai_guard_requests select (jsonb_populate_record(null::ai_guard_requests,to_jsonb(r)||jsonb_build_object('id','{req}','question_id','{q}','idempotency_key','{uuid.uuid4()}'))).* from ai_guard_requests r where question_id='NEW-OTHER' limit 1;")
 real(f"insert into figure_queue_jobs select (jsonb_populate_record(null::figure_queue_jobs,to_jsonb(j)||jsonb_build_object('request_id','{req}','question_id','{q}'))).* from figure_queue_jobs j where question_id='NEW-OTHER';")
 real(f"insert into explanation_figure_candidates select (jsonb_populate_record(null::explanation_figure_candidates,to_jsonb(c)||jsonb_build_object('id','{ident}','question_id','{q}','status','pending','reviewer_id',null,'reviewed_at',null))).* from explanation_figure_candidates c where id='{source_id}';")
 return ident
def review_id(ident,decision,visual=True):
 return real(f"set role service_role;select review_explanation_figure(id,'{decision}','11111111-1111-4111-8111-111111111111',{str(visual).lower()},(select explanation from question_explanation_overrides o where o.question_id=c.question_id),explanation_sha256,image_sha256,image_bytes) from explanation_figure_candidates c where id='{ident}';")
target=clone('REUSE-EXACT')
assert review_id(target,'reuse',False)=='invalid'
for column in ['section_title','attribution']:
 real(f"update explanation_figure_candidates set {column}='mismatch' where id='{target}'")
 assert review_id(target,'reuse') in ['reuse_not_exact','invalid_binding']
 real(f"update explanation_figure_candidates c set {column}=s.{column} from explanation_figure_candidates s where c.id='{target}' and s.id='{source_id}'")
assert review_id(target,'reuse')=='approved'
assert real(f"select reused_from_candidate_id from figure_review_events where candidate_id='{target}' and decision='approved'")==source_id
assert review_id(target,'reuse')=='not_pending'
assert review_id(source_id,'rejected')=='rejected'
assert real(f"select status||':'||(image_bytes is null)::text from explanation_figure_candidates where id='{target}'")=='rejected:true'
assert real(f"select count(*) from figure_review_events where candidate_id='{target}' and decision='rejected'")=='1'
assert real("select has_table_privilege('anon','figure_review_events','select')")=='f'
assert real("select has_table_privilege('authenticated','figure_review_events','select')")=='f'
assert real("select has_table_privilege('service_role','figure_review_events','update')")=='f'
print('PASS exact reuse, visual confirmation, purpose/license mismatch denial, append-only provenance, source withdrawal cascades, private ACL unchanged')
# Serialize reuse vs. source withdrawal: either ordering leaves no approved child.
real(f"update explanation_figure_candidates set status='approved',image_bytes=decode('89504e470d0a1a0a','hex') where id='{source_id}';")
race_target=clone('REUSE-RACE')
with concurrent.futures.ThreadPoolExecutor(2) as ex:
 results=list(ex.map(lambda op:review_id(*op),[(race_target,'reuse'),(source_id,'rejected')]))
assert results[0] in ['approved','reuse_not_exact'],results
assert results[1]=='rejected',results
assert real(f"select count(*) from explanation_figure_candidates where id='{race_target}' and status='approved'")=='0'
print('PASS concurrent source withdrawal/reuse never leaves an approved dependent')
