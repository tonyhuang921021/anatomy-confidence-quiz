-- Retain rooms in place; unchanged function owner, ACL, ledger and two-active-room cap.
BEGIN;
CREATE OR REPLACE FUNCTION undercover_runtime_v2.commit(p_expected bigint, p_versions jsonb, p_changes jsonb, p_meta jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare c undercover_runtime_v2.control%rowtype; current_versions jsonb; item record; n integer; previous jsonb; deadline_ms numeric; now_ms numeric:=extract(epoch from clock_timestamp())*1000;
begin
 select * into strict c from undercover_runtime_v2.control where singleton for update;
 select coalesce(jsonb_object_agg(code,version),'{}') into current_versions from undercover_runtime_v2.rooms;
 if c.revision<>p_expected or current_versions is distinct from p_versions then return jsonb_build_object('applied',false); end if;
 if jsonb_typeof(p_changes) is distinct from 'object' or jsonb_typeof(p_meta) is distinct from 'object'
 or not(p_meta ?& array['schema','creates','aiReserved','aiUnknown','aiPaused']) or p_meta ? 'rooms'
 or p_meta->>'schema' is distinct from '1' or jsonb_typeof(p_meta->'creates') is distinct from 'object'
 or jsonb_typeof(p_meta->'aiReserved') is distinct from 'number' or jsonb_typeof(p_meta->'aiUnknown') is distinct from 'number'
 or coalesce(p_meta->>'aiReserved','') !~ '^[0-9]+$' or coalesce(p_meta->>'aiUnknown','') !~ '^[0-9]+$'
 or jsonb_typeof(p_meta->'aiPaused') is distinct from 'boolean' or octet_length(p_meta::text)>65536 then raise exception 'STATE_INVALID'; end if;
 if (p_meta->>'aiReserved')::bigint<(c.payload->>'aiReserved')::bigint
 or (p_meta->>'aiUnknown')::bigint<(c.payload->>'aiUnknown')::bigint or (p_meta->>'aiUnknown')::bigint>(p_meta->>'aiReserved')::bigint
 or ((c.payload->>'aiPaused')::boolean and not(p_meta->>'aiPaused')::boolean) then raise exception 'GUARD_CANNOT_RESET'; end if;
 for item in select key,value from jsonb_each(p_changes) loop
  if item.key !~ '^[A-Z2-9]{6}$' then raise exception 'ROOM_CODE_INVALID'; end if;
  select payload into previous from undercover_runtime_v2.rooms where code=item.key;
  if item.value='null'::jsonb then
   -- Compatibility with old create cleanup: close in place, never erase history.
   if previous is not null and previous->>'phase'<>'closed' then
    update undercover_runtime_v2.rooms set payload=payload||jsonb_build_object('phase','closed','closedFrom',payload->>'phase','closedAt',now_ms,'closeReason','legacy_cleanup','deadline',null),version=version+1,updated_at=clock_timestamp() where code=item.key;
   end if;
  else
   if jsonb_typeof(item.value) is distinct from 'object' or item.value->>'protocol' is distinct from '3' or item.value->>'code' is distinct from item.key then raise exception 'ROOM_INVALID'; end if;
   if previous is not null then
    deadline_ms:=case when previous->>'phase'='ended' and jsonb_typeof(previous->'closesAt')='number' then (previous->>'closesAt')::numeric else (previous->>'expires')::numeric end;
    if (previous->>'phase'='closed' or deadline_ms<=now_ms) and item.value->>'phase'<>'closed' then raise exception 'ROOM_CLOSED'; end if;
    if (previous ? 'history') and not (coalesce(item.value->'history','[]'::jsonb) @> (previous->'history')) then raise exception 'HISTORY_CANNOT_DELETE'; end if;
   end if;
   insert into undercover_runtime_v2.rooms(code,payload) values(item.key,item.value)
   on conflict(code) do update set payload=excluded.payload,version=undercover_runtime_v2.rooms.version+1,updated_at=clock_timestamp();
  end if;
 end loop;
 select count(*) into n from undercover_runtime_v2.rooms where payload->>'phase'<>'closed' and
  (case when payload->>'phase'='ended' and jsonb_typeof(payload->'closesAt')='number' then (payload->>'closesAt')::numeric else (payload->>'expires')::numeric end)>now_ms;
 if n>2 then raise exception 'PREVIEW_ROOM_CAP'; end if;
 update undercover_runtime_v2.control set payload=p_meta,revision=revision+1 where singleton;
 return jsonb_build_object('applied',true);
end$function$
;
COMMIT;
