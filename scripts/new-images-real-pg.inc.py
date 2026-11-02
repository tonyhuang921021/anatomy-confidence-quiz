# Executed by the isolated harness with its private socket; no remote DB access.
import concurrent.futures, uuid, json
sql('create database new_images_real;')
base=[str(bin_dir/'psql'),'-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(socket),'-p','55439','-d','new_images_real']
def real(q):
 r=subprocess.run(base,input=q,text=True,capture_output=True)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
real((root/'proposals/figure-review/tests/figure-real-guard-fixture.sql').read_text())
for name in ['proposal.sql','durable-queue-proposal.sql']:real((root/'proposals/figure-review'/name).read_text())
for name in ['pilot-needs-incremental.sql','pdm-incremental-candidate.sql','pdm-manual-evidence-candidate.sql']:
 real((root.parent/'candidate/proposals/figure-review'/name).read_text())
real((root/'proposals/figure-review/new-explanation-images.sql').read_text())
real("""
insert into public.ai_guard_budget(id,enabled,verified_credit_expires_at,cap_microusd,envelope_microusd,max_calls,per_call_ceiling_microusd,max_parallel,max_actor_parallel,cooldown_seconds,hourly_limit,daily_limit,model,pricing_revision)
values(true,true,clock_timestamp()+interval '1 hour',10000,100,1,100,5,5,1,100,100,'gpt-6.1-terra','test');
insert into public.ai_guard_reviewed_state(id,generation,manifest_sha256,source_commit) values(true,1,repeat('a',64),repeat('b',40));
grant select,update on public.question_explanation_overrides to service_role;
update public.figure_image_limits set capture=true,enabled=true,max_new=5,max_searches=1 where id=true;
update public.figure_queue_config set enabled=true;
""")
actor=str(uuid.uuid4()); requests=[]
for i in range(2):
 req=str(uuid.uuid4());requests.append(req)
 out=real(f"""set role service_role;
 select public.ai_guard_reserve('{req}','{uuid.uuid4()}','REAL-{i}',repeat('a',64),repeat('b',40));""")
 assert out=='reserved',out
 # get actual actor generated above via read-only synthetic metadata
 a=real(f"select actor_id from public.ai_guard_requests where id='{req}'")
 out=real(f"""set role service_role;
 select public.ai_guard_start_call('{req}',1);
 select public.ai_guard_settle_call('{req}',1,70,10,10);
 select status from public.figure_guard_commit_new_images('{req}','{a}',E'## Test\\nSaved text','{{}}','',jsonb_build_object('explanationHash',encode(sha256(convert_to(E'## Test\\nSaved text','UTF8')),'hex'),'revision',repeat('a',64),'items',jsonb_build_array(jsonb_build_object('sectionAnchor','section-0','sectionTitle','Test','sectionHash',repeat('c',64),'caption','Test','conceptId','carotid-sheath'))));
 select public.ai_guard_close('{req}');""")
 assert out.splitlines()==['started','settled','inserted','closed'],out
real("""do $$begin
 if (select spent_microusd from public.ai_guard_budget where id=true)<>140 or (select reserved_microusd from public.ai_guard_budget where id=true)<>0 then raise exception 'accounting mismatch';end if;
end $$;
update public.figure_queue_jobs set needs_state='approved',figure_needs=jsonb_set(figure_needs,'{status}','"approved"'),image_status='ready_to_search';""")
leases=[str(uuid.uuid4()),str(uuid.uuid4())]
with concurrent.futures.ThreadPoolExecutor(2) as ex:
 claims=list(ex.map(lambda lease:real(f"set role service_role;select request_id from public.figure_queue_claim('{lease}',60);"),leases))
assert len(set(claims))==2 and all(claims),claims
with concurrent.futures.ThreadPoolExecutor(2) as ex:
 reservations=list(ex.map(lambda t:real(f"set role service_role;select public.figure_image_reserve('{t[0]}','{t[1]}',repeat('{t[2]}',64),'search');"),zip(claims,leases,['c','d'])))
assert sorted(reservations)==['f','t'],reservations
assert real('select searches from public.figure_image_limits where id=true')=='1'
assert real(f"set role service_role;select public.figure_image_reserve('{claims[0]}','{uuid.uuid4()}',repeat('e',64),'download');")=='f'
real(f"update public.question_explanation_overrides set explanation='changed synthetic text' where question_id=(select question_id from public.figure_queue_jobs where request_id='{claims[0]}');")
assert real(f"select public.figure_image_active('{claims[0]}','{leases[0]}');")=='f'
assert real("select has_function_privilege('anon','public.figure_image_reserve(uuid,uuid,text,text)','execute');")=='f'
print('PASS real AI guard reserve/start/settle/commit/close under service_role; exact accounting; concurrent distinct leases; atomic shared search cap; wrong lease and changed text stopped; anon denied')

# Real pending-stage dedupe with the installed PDM constraints also present.
j,l=claims[1],leases[1]
question=real(f"select question_id from public.figure_queue_jobs where request_id='{j}'")
digest=real(f"select explanation_sha256 from public.figure_queue_jobs where request_id='{j}'")
def stage_sql(image_id):return f"set role service_role;select public.figure_image_stage('{j}','{l}','{image_id}','{question}','{digest}',encode(sha256(decode('89504e470d0a1a0a','hex')),'hex'),'image/png',decode('89504e470d0a1a0a','hex'),'https://commons.wikimedia.org/wiki/File:Fixture.png','https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','Synthetic fixture','Test','section-0','Test',repeat('c',64));"
with concurrent.futures.ThreadPoolExecutor(2) as ex:
 images=list(ex.map(lambda x:real(stage_sql(str(x))),[uuid.uuid4(),uuid.uuid4()]))
assert len(set(images))==1,images
assert real('select count(*) from public.explanation_figure_candidates')=='1'
assert real("select count(*) from public.explanation_figure_candidates where status='approved'")=='0'
print('PASS installed pilot/PDM migration compatibility; concurrent staging deduplicates to one pending image; no automatic approval')
