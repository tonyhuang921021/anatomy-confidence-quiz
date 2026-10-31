import subprocess
base=['/opt/homebrew/opt/postgresql@17/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','/tmp/figure-review-socket','-p','55493','-d','figure_queue_v10']
first=subprocess.Popen(base,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
first.stdin.write("begin; select request_id from public.figure_queue_claim('10000000-0000-4000-8000-000000000010',30);\n\\echo LOCKED\nselect pg_sleep(2);commit;\n")
first.stdin.flush()
first_id=first.stdout.readline().strip()
assert first.stdout.readline().strip()=='LOCKED'
other=subprocess.run(base,input="select request_id from public.figure_queue_claim('10000000-0000-4000-8000-000000000011',30);",capture_output=True,text=True,check=True).stdout.strip()
first.stdin.close();first.wait(timeout=10)
assert first.returncode==0,(first.stderr.read())
assert first_id and other and first_id!=other,(first_id,other)
print('PASS concurrent SKIP LOCKED claims distinct jobs', first_id, other)
