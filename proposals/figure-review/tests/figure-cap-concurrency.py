import subprocess
base=['/opt/homebrew/opt/postgresql@17/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h','/tmp/figure-review-socket','-p','55493','-d','figure_queue_v10']
def run(sql):return subprocess.run(base,input=sql,capture_output=True,text=True,check=True).stdout.strip()
run('update public.figure_queue_config set max_image_bytes=16;')
def insert(uid,q,text,sha):return f"insert into public.explanation_figure_candidates(id,question_id,explanation_sha256,image_sha256,image_mime,image_bytes,source_url,license_url,license,attribution,section_title) values('{uid}','{q}',encode(sha256(convert_to('{text}','UTF8')),'hex'),encode(sha256(decode('89504e470d0a1a0a','hex')),'hex'),'image/png',decode('89504e470d0a1a0a','hex'),'https://commons.wikimedia.org/wiki/File:x','https://creativecommons.org/licenses/by/4.0/','CC BY 4.0','author','section');"
first=subprocess.Popen(base,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
first.stdin.write('begin;'+insert('00000000-0000-4000-8000-000000000030','Q3','saved three','c')+'\n\\echo INSERTED\nselect pg_sleep(2);commit;\n');first.stdin.flush()
assert first.stdout.readline().strip()=='INSERTED'
second=subprocess.run(base,input=insert('00000000-0000-4000-8000-000000000031','Q4','saved four','d'),capture_output=True,text=True)
first.stdin.close();first.wait(timeout=10)
assert first.returncode==0,first.stderr.read()
assert second.returncode!=0 and 'figure byte capacity' in second.stderr,second.stderr
assert run('select sum(octet_length(image_bytes)) from public.explanation_figure_candidates;')=='16'
print('PASS concurrent image writers cannot exceed byte ceiling')
