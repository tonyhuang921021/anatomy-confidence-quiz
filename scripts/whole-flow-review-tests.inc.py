proposal=root/'proposals/figure-review/guarded-new-image-review.sql'
real("create role ai_guard_owner nologin;grant create on schema public to ai_guard_owner;grant select on ai_guard_requests,ai_guard_reviewed_questions,ai_guard_reviewed_state,question_explanation_overrides to ai_guard_owner;alter table ai_guard_requests add column action_kind text default 'explanation';")
real('alter table ai_guard_requests owner to ai_guard_owner;alter table ai_guard_reviewed_questions owner to ai_guard_owner;alter table ai_guard_reviewed_state owner to ai_guard_owner;')
real(proposal.read_text())
assert real("select has_function_privilege('anon','ai_guard_image_eligible(text,text)','execute')")=='f'
question=real(f"select question_id from explanation_figure_candidates where id='{images[0]}'")
real(f"""update question_explanation_overrides set question_id='MOEX-106100-1301-Q093' where question_id='{question}';
update ai_guard_requests set question_id='MOEX-106100-1301-Q093' where question_id='{question}';
update figure_queue_jobs set question_id='MOEX-106100-1301-Q093',figure_needs=jsonb_set(figure_needs,'{{items,0,sectionHash}}',to_jsonb((select encode(sha256(convert_to(explanation,'UTF8')),'hex') from question_explanation_overrides where question_id='MOEX-106100-1301-Q093'))) where question_id='{question}';
update explanation_figure_candidates set question_id='MOEX-106100-1301-Q093',section_sha256=(select encode(sha256(convert_to(explanation,'UTF8')),'hex') from question_explanation_overrides where question_id='MOEX-106100-1301-Q093') where id='{images[0]}';""")
def check():return real(f"set role service_role;select review_explanation_figure(id,'approved','11111111-1111-4111-8111-111111111111',true,(select explanation from question_explanation_overrides o where o.question_id=c.question_id),explanation_sha256,image_sha256,image_bytes) from explanation_figure_candidates c where id='{images[0]}';")
assert real("select ai_guard_image_eligible('MOEX-106100-1301-Q093',(select encode(sha256(convert_to(explanation,'UTF8')),'hex') from question_explanation_overrides where question_id='MOEX-106100-1301-Q093'))")=='t'
real("insert into ai_guard_reviewed_questions values('MOEX-106100-1301-Q093',1)");assert check()=='out_of_scope'
real("delete from ai_guard_reviewed_questions where question_id='MOEX-106100-1301-Q093'")
real(f"update explanation_figure_candidates set section_heading='forged' where id='{images[0]}'");assert check()=='invalid_binding'
real(f"update explanation_figure_candidates set section_heading='Test' where id='{images[0]}'");assert check()=='approved';assert check()=='not_pending'
print('PASS Q093 generated origin, locked snapshot denied, forged paragraph denied, exact binding accepted once, anon denied')

real("update question_explanation_overrides set question_id='NEW-OTHER' where question_id='MOEX-106100-1301-Q093';update ai_guard_requests set question_id='NEW-OTHER' where question_id='MOEX-106100-1301-Q093';update figure_queue_jobs set question_id='NEW-OTHER' where question_id='MOEX-106100-1301-Q093';update explanation_figure_candidates set question_id='NEW-OTHER',status='pending',reviewer_id=null,reviewed_at=null where question_id='MOEX-106100-1301-Q093';")
assert check()=='approved'
print('PASS second non-allowlisted new explanation also accepted with the same exact provenance checks')
out=real(f"set role service_role;select review_explanation_figure(id,'rejected','11111111-1111-4111-8111-111111111111',false,(select explanation from question_explanation_overrides o where o.question_id=c.question_id),explanation_sha256,image_sha256,image_bytes) from explanation_figure_candidates c where id='{images[0]}';")
assert out=='rejected',out
assert real("select count(*) from figure_review_events")=='3'
assert real("select has_table_privilege('service_role','figure_review_events','update')")=='f'
assert real("select has_table_privilege('anon','figure_review_events','select')")=='f'
print('PASS withdraw removes approved image with preserved append-only decisions; service cannot edit history, anon cannot read')
