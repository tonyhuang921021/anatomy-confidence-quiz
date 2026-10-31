\set ON_ERROR_STOP on
set role service_role;
insert into public.explanation_figure_candidates(id,question_id,explanation_sha256,image_sha256,image_mime,image_bytes,source_url,license_url,license,attribution,section_title) values ('00000000-0000-4000-8000-000000000004','Q1',encode(sha256(convert_to('saved text','UTF8')),'hex'),encode(sha256(decode('89504e470d0a1a0a','hex')),'hex'),'image/png',decode('89504e470d0a1a0a','hex'),'https://commons.wikimedia.org/wiki/File:x','https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','author','section');
select count(*)=0 as pending_not_listed from public.list_approved_explanation_figures('Q1');
select count(*)=0 as pending_not_served from public.read_approved_explanation_figure('00000000-0000-4000-8000-000000000004');
select public.review_explanation_figure('00000000-0000-4000-8000-000000000004','approved','00000000-0000-4000-8000-000000000002',true,'saved text',encode(sha256(convert_to('saved text','UTF8')),'hex'),encode(sha256(decode('89504e470d0a1a0a','hex')),'hex'),decode('89504e470d0a1a0a','hex'))='approved' as approved;
select count(*)=1 as approved_listed from public.list_approved_explanation_figures('Q1');
select count(*)=1 as approved_served from public.read_approved_explanation_figure('00000000-0000-4000-8000-000000000004');
update public.question_explanation_overrides set explanation='changed' where question_id='Q1';
select count(*)=0 as stale_not_listed from public.list_approved_explanation_figures('Q1');
select count(*)=0 as stale_not_served from public.read_approved_explanation_figure('00000000-0000-4000-8000-000000000004');
reset role;
select not has_function_privilege('anon','public.read_approved_explanation_figure(uuid)','execute') and not has_function_privilege('authenticated','public.list_approved_explanation_figures(text)','execute') as public_rpc_denied;
