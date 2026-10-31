import subprocess,time
base=['/opt/homebrew/opt/postgresql@17/bin/psql','-h','/tmp/figure-review-pg17-socket','-p','55440','-d','postgres','-v','ON_ERROR_STOP=1','-At']
setup="insert into public.question_explanation_overrides values ('Q2','saved2'); insert into public.explanation_figure_candidates(id,question_id,explanation_sha256,image_sha256,image_mime,image_bytes,source_url,license_url,license,attribution,section_title) values ('00000000-0000-4000-8000-000000000003','Q2',repeat('a',64),repeat('b',64),'image/png',decode('89504e470d0a1a0a','hex'),'https://commons.wikimedia.org/wiki/File:x','https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','author','section');"
subprocess.run(base+['-c',setup],check=True,capture_output=True)
writer=subprocess.Popen(base+['-c',"begin; update public.question_explanation_overrides set explanation='new text' where question_id='Q2'; select pg_sleep(3); commit;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
time.sleep(.7)
query="set role service_role; select public.review_explanation_figure('00000000-0000-4000-8000-000000000003','approved','00000000-0000-4000-8000-000000000002',true,'saved2',repeat('a',64),repeat('b',64),decode('89504e470d0a1a0a','hex'));"
r=subprocess.run(base+['-c',query],capture_output=True,text=True,check=True,timeout=15);writer.communicate(timeout=15)
assert writer.returncode==0,(writer.returncode,r.stdout);assert r.stdout.strip().endswith('stale'),r.stdout
print('PASS concurrent writer commits changed text; approval waits and returns stale')
