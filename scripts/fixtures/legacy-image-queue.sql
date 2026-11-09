drop function public.figure_guard_commit_new_images(uuid,uuid,text,jsonb,text,jsonb);
CREATE OR REPLACE FUNCTION public.figure_guard_commit_new_images(p_id uuid, p_actor uuid, p_explanation text, p_option_analysis jsonb, p_memory_tip text, p_needs jsonb)
 RETURNS TABLE(status text, question_id text, explanation text, option_analysis jsonb, memory_tip text, model text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare saved record; lim public.figure_image_limits%rowtype; cfg public.figure_queue_config%rowtype; digest text;
begin
 select * into saved from public.ai_guard_commit(p_id,p_actor,p_explanation,p_option_analysis,p_memory_tip);
 if saved.status='inserted' then
  update public.question_explanation_overrides o set figure_status='awaiting_image_plan' where o.question_id=saved.question_id;
  -- A failed image plan cannot roll back an already paid, valid explanation.
  begin
   select * into lim from public.figure_image_limits where id=true for update;
   select * into cfg from public.figure_queue_config where id=true for update;
   digest:=encode(sha256(convert_to(saved.explanation,'UTF8')),'hex');
   if lim.capture and lim.captured<lim.max_new and (select count(*) from public.figure_queue_jobs)<cfg.max_rows
    and jsonb_typeof(p_needs)='object' and octet_length(p_needs::text)<=4096
    and p_needs->>'explanationHash'=digest and p_needs->>'revision' ~ '^[0-9a-f]{64}$'
    and jsonb_typeof(p_needs->'items')='array' and jsonb_array_length(p_needs->'items') between 1 and 3 then
    insert into public.figure_queue_jobs(request_id,question_id,explanation_sha256,state,figure_needs,needs_state,image_status)
    values(p_id,saved.question_id,digest,'pending',p_needs,'awaiting','awaiting_concept_review') on conflict do nothing;
    if found then
     update public.figure_image_limits set captured=captured+1 where id=true;
     update public.question_explanation_overrides o set figure_status='awaiting_concept_review' where o.question_id=saved.question_id;
    end if;
   end if;
  exception when others then
   update public.question_explanation_overrides o set figure_status='awaiting_image' where o.question_id=saved.question_id;
  end;
 end if;
 return query select saved.status,saved.question_id,saved.explanation,saved.option_analysis,saved.memory_tip,saved.model,saved.updated_at;
end $function$
;
alter table public.figure_queue_jobs add constraint figure_single_q020_batch CHECK (((state = 'done'::text) OR ((question_id = 'MOEX-C217-091030-S4004-STAGE1-Q001'::text) AND (explanation_sha256 = 'f0466d93226044af9ea384b5c96665e8087ab0094c2d5446c9cfebd945cd6ca7'::text)) OR ((question_id = 'MOEX-C217-091030-S4004-STAGE1-Q002'::text) AND (explanation_sha256 = '95cce750da4bad5a2b3ce3edbb9c48de4c3bfc1a364e38e97e4594a1cf8082a9'::text)) OR ((question_id = 'MOEX-C217-091030-S4004-STAGE1-Q003'::text) AND (explanation_sha256 = 'c1829810209699bdf5ada7c6c6d1109d363ca6862e609b53e216510c73af4549'::text))));

