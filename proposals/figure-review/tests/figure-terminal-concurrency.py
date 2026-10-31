import subprocess
base=['/opt/homebrew/opt/postgresql@17/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','/tmp/figure-review-socket','-p','55493','-d','figure_terminal_v2']
first=subprocess.Popen(base,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
first.stdin.write("begin;select public.figure_guard_reserve('00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000099','Q8','h','c');\n\\echo LOCKED\nselect pg_sleep(2);commit;\n");first.stdin.flush()
assert first.stdout.readline().strip()=='reserved';assert first.stdout.readline().strip()=='LOCKED'
second=subprocess.run(base,input="select public.figure_guard_reserve('00000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000099','Q9','h','c');",capture_output=True,text=True,check=True)
first.stdin.close();first.wait(timeout=10);assert first.returncode==0,first.stderr.read()
assert second.stdout.strip()=='figure_queue_capacity',second.stdout
check=subprocess.run(base,input="select (select count(*) from public.figure_queue_jobs)||':'||(select count(*) from public.test_guard_requests where question='Q9')||':'||(select reclaimed_cancelled from public.figure_queue_config where id=true);",capture_output=True,text=True,check=True).stdout.strip()
assert check=='2:0:1',check
print('PASS concurrent terminal reclaim preserves active jobs and rolls back denied reserve')
