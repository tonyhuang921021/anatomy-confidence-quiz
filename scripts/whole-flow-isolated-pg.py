"""Local-only PostgreSQL test. Never connects to an existing database or installs tools."""
from pathlib import Path
import os, shutil, subprocess, tempfile, sys
root=Path(__file__).resolve().parents[1]
bin_dir=Path(os.environ.get('LOCAL_TEST_PG_BIN','/opt/homebrew/opt/postgresql@17/bin'))
needed=['initdb','pg_ctl','psql']
if any(not (bin_dir/x).is_file() for x in needed):
 print('BLOCKED: existing local initdb/pg_ctl/psql not available; no SQL executed, nothing installed.')
 sys.exit(2)
work=Path(tempfile.mkdtemp(prefix='new-images-pg-',dir='/tmp'));socket=work/'socket';socket.mkdir();data=work/'data'
def run(name,args): subprocess.run([str(bin_dir/name),*map(str,args)],check=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
def sql(text): subprocess.run([str(bin_dir/'psql'),'-X','-v','ON_ERROR_STOP=1','-h',str(socket),'-p','55439','-d','postgres'],input=text,text=True,check=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
run('initdb',['-D',data,'-A','trust','--no-locale','-E','UTF8'])
run('pg_ctl',['-D',data,'-l',work/'postgres.log','-o',f"-k {socket} -p 55439 -h ''",'-w','start'])
try:
 sql('create role anon; create role authenticated; create role service_role bypassrls;')
 fixture=(root/'proposals/figure-review/tests/figure-queue-fixture.sql').read_text().replace('insert into public.question_explanation_overrides as o values(q,p_explanation)','insert into public.question_explanation_overrides as o(question_id,explanation) values(q,p_explanation)')
 sql(fixture)
 for name in ['proposal.sql','durable-queue-proposal.sql']:sql((root/'proposals/figure-review'/name).read_text())
 # Reproduce the already-installed needs columns. Uses stub AI guard only;
 # full real-guard concurrency suite remains a separate release requirement.
 sql("alter table public.figure_queue_jobs add column figure_needs jsonb, add column needs_reviewer uuid, add column needs_reviewed_at timestamptz, add column needs_state text not null default 'awaiting';")
 sql((root/'proposals/figure-review/new-explanation-images.sql').read_text())
 sql((root/'proposals/figure-review/new-explanation-images-assert.sql').read_text())
 print('PASS isolated schema/RPC assertions (stub AI guard); database preserved at',work)
 exec((root/'scripts/new-images-real-pg.inc.py').read_text())
 exec((root/'scripts/whole-flow-review-tests.inc.py').read_text())
except subprocess.CalledProcessError as e:
 print(e.stdout.decode() if isinstance(e.stdout,bytes) else e.stdout)
 raise
finally:run('pg_ctl',['-D',data,'-m','fast','-w','stop'])
