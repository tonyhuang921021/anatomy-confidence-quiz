from pathlib import Path
import subprocess,tempfile,uuid,concurrent.futures
root=Path(__file__).resolve().parents[1]; b=Path('/opt/homebrew/opt/postgresql@17/bin'); w=Path(tempfile.mkdtemp(prefix='terra-five-pg-',dir='/tmp')); sock=w/'socket';sock.mkdir();data=w/'data'
def run(n,args):return subprocess.run([str(b/n),*map(str,args)],check=True,capture_output=True,text=True)
def sql(s):return subprocess.run([str(b/'psql'),'-XAt','-v','ON_ERROR_STOP=1','-h',str(sock),'-p','55441','-d','postgres'],input=s,text=True,capture_output=True,check=True).stdout.strip()
actor=str(uuid.uuid4());ids=['MOEX-111020-1301-Q010','MOEX-C217-093030-S4001-STAGE1-Q019','MOEX-097140-1101-Q028','MOEX-097140-1101-Q004','MOEX-108100-1301-Q018']
def begin(i,a):return sql(f"set role service_role;select public.terra_five_trial_begin('{i}','{a}','{actor}');").splitlines()[-1]
def finish(i,a):return sql(f'''set role service_role;select public.terra_five_trial_finish('{i}','{a}','{actor}','complete','{{"model":"gpt-6.1-terra","explanation":"test"}}','{{"inputTokens":10,"outputTokens":20}}','{{}}');''').splitlines()[-1]
run('initdb',['-D',data,'-A','trust','--no-locale','-E','UTF8']);run('pg_ctl',['-D',data,'-l',w/'postgres.log','-o',f"-k {sock} -p 55441 -h ''",'-w','start'])
try:
 sql('create role anon;create role authenticated;create role service_role bypassrls;create table public.question_explanation_overrides(question_id text primary key);grant select on public.question_explanation_overrides to service_role;')
 sql((root/'proposals/terra-trial/disabled-trial.sql').read_text())
 assert begin(ids[0],uuid.uuid4())=='disabled'
 assert sql("select has_function_privilege('anon','public.terra_five_trial_begin(text,uuid,uuid)','EXECUTE');")=='f'
 sql("update public.terra_five_trial_config set enabled=true,expires_at=now()+interval '1 hour';")
 assert begin('unexpected',uuid.uuid4())=='invalid'
 attempts=[str(uuid.uuid4()),str(uuid.uuid4())]
 with concurrent.futures.ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda a:begin(ids[0],a),attempts))
 assert sorted(results)==['already_attempted','started'],results
 winner=attempts[results.index('started')]
 assert begin(ids[1],uuid.uuid4())=='busy'
 assert finish(ids[0],uuid.uuid4())=='stale'
 assert finish(ids[0],winner)=='complete'
 assert finish(ids[0],winner)=='stale'
 sql(f"insert into public.question_explanation_overrides values('{ids[1]}');")
 assert begin(ids[1],uuid.uuid4())=='existing_explanation'
 sql('truncate public.question_explanation_overrides;') # isolated fixture only
 for i in ids[1:]:
  a=uuid.uuid4();assert begin(i,a)=='started';assert finish(i,a)=='complete'
 assert sql("select calls||'|'||held_ceiling_microusd||'|'||enabled from public.terra_five_trial_config;")=='5|500000|false'
 assert begin(ids[0],uuid.uuid4())=='disabled'
 print('PASS concurrent dedupe, serial calls, actor/attempt fences, existing text, five-call cap, RLS/ACL')
 # Reset only this disposable test fixture to exercise unknown and expiry.
 sql("truncate public.terra_five_trial_items;update public.terra_five_trial_config set calls=0,held_ceiling_microusd=0,enabled=true,expires_at=now()-interval '1 minute';")
 assert begin(ids[0],uuid.uuid4())=='disabled'
 sql("update public.terra_five_trial_config set expires_at=now()+interval '1 hour';")
 a=uuid.uuid4();assert begin(ids[0],a)=='started'
 sql(f"set role service_role;select public.terra_five_trial_unknown('{ids[0]}','{a}','{actor}');")
 assert begin(ids[1],uuid.uuid4())=='disabled'
 assert sql('select state from public.terra_five_trial_items;')=='unknown'
 assert sql('select held_ceiling_microusd from public.terra_five_trial_config;')=='100000'
 print('PASS expiry, unknown stops batch without refund or retry; preserved',w)
except subprocess.CalledProcessError as e:
 print(e.stdout,e.stderr);raise
finally:run('pg_ctl',['-D',data,'-m','fast','-w','stop'])
