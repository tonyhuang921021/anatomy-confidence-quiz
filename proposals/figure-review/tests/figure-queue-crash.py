import subprocess
base=['/opt/homebrew/opt/postgresql@17/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','/tmp/figure-review-socket','-p','55493','-d','figure_queue_v10']
def run(sql): return subprocess.run(base,input=sql,capture_output=True,text=True,check=True).stdout.strip()
run("update public.figure_queue_jobs set state='done',lease_id=null,lease_until=null where question_id in ('Q3','Q4'); select public.figure_guard_reserve('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000099','Q5','h','c'); select status from public.figure_guard_commit('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000099','saved five','{}','');")
worker=subprocess.Popen(base,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
worker.stdin.write("begin;select request_id from public.figure_queue_claim('10000000-0000-4000-8000-000000000021',30);commit;\n\\echo LEASED\nselect pg_sleep(60);\n");worker.stdin.flush()
job=worker.stdout.readline().strip();assert job=='00000000-0000-4000-8000-000000000005',job
assert worker.stdout.readline().strip()=='LEASED';worker.kill();worker.wait(timeout=5)
run("update public.figure_queue_jobs set lease_until=clock_timestamp()-interval '1 second' where request_id='00000000-0000-4000-8000-000000000005';")
result=run("select request_id||':'||attempts from public.figure_queue_claim('10000000-0000-4000-8000-000000000022',30);")
assert result.endswith(':2'),result
print('PASS process death after committed claim; expired lease recovered without duplicate',result)
