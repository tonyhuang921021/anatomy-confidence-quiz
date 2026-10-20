"""Import accepted, hash-pinned reader sections; never generate medical prose.
Run from the repo with the author handoff path and exported canonical question bank.
"""
import argparse, base64, hashlib, html, json, re
from pathlib import Path
from html.parser import HTMLParser

ALLOWED=set('p h2 h3 h4 strong em b i u sup sub figure figcaption img div span table thead tbody tfoot tr th td ul ol li details summary br hr a blockquote'.split())
VOID={'img','br','hr'}
class Cleaner(HTMLParser):
 def __init__(self, asset_dir, prefix):
  super().__init__(convert_charrefs=True); self.parts=[]; self.asset_dir=asset_dir; self.prefix=prefix; self.assets=[]
 def handle_starttag(self,tag,attrs):
  if tag not in ALLOWED: raise ValueError('Unexpected HTML tag: '+tag)
  attrs=dict(attrs); out={}
  if tag=='img':
   src=attrs.get('src',''); match=re.fullmatch(r'data:image/(png|jpeg|jpg|gif|webp);base64,([\s\S]+)',src,re.I)
   if not match: raise ValueError('Image must be a frozen embedded raster: '+src[:80])
   data=base64.b64decode(match[2],validate=True); digest=hashlib.sha256(data).hexdigest(); ext='jpg' if match[1].lower() in ['jpg','jpeg'] else match[1].lower()
   filename=digest+'.'+ext; (self.asset_dir/filename).write_bytes(data)
   out={'src':'/reviewed-explanations/assets/'+filename,'alt':attrs.get('alt','詳解原圖'),'loading':'lazy','decoding':'async'}; self.assets.append({'path':out['src'],'sha256':digest,'bytes':len(data),'alt':out['alt']})
  if tag=='a':
   href=attrs.get('href','')
   if not (href.startswith('https://') or href.startswith('http://') or href.startswith('#')): raise ValueError('Unsafe link')
   out={'href':href,'rel':'noopener noreferrer'}
  for key in ['colspan','rowspan','type','start']:
   if key in attrs and re.fullmatch(r'[0-9AaIi]+',attrs[key]): out[key]=attrs[key]
  if tag=='div' and 'exam-table-scroll' in attrs.get('class',''): out['class']='reviewed-table-scroll'
  self.parts.append('<'+tag+''.join(' '+k+'="'+html.escape(v,quote=True)+'"' for k,v in out.items())+'>')
 def handle_startendtag(self,tag,attrs): self.handle_starttag(tag,attrs)
 def handle_endtag(self,tag):
  if tag not in ALLOWED: raise ValueError('Unexpected end tag '+tag)
  if tag not in VOID:self.parts.append('</'+tag+'>')
 def handle_data(self,data): self.parts.append(html.escape(data))
 def handle_comment(self,data): pass

def text(s):return html.unescape(re.sub('<[^>]+>','',s))
def normalize(s):return re.sub(r'\s+','',text(s)).replace('－','-').replace('–','-').replace('（','(').replace('）',')')
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()

parser=argparse.ArgumentParser();parser.add_argument('handoff');args=parser.parse_args()
root=Path.cwd();handoff=Path(args.handoff);m=json.loads((handoff/'SOURCE_MANIFEST.json').read_text());bank=json.loads((root/'evidence/explanations/canonical-question-bank.json').read_text());byid={q['id']:q for q in bank}
out=root/'public/reviewed-explanations';assets=out/'assets';assets.mkdir(parents=True,exist_ok=True)
index={};audit={'release':'accepted-readers-20261020','siteUse':'noncommercial: explicitly confirmed by user','sources':[],'questions':[],'mismatches':[]}
for batch in m['current_local_completed_batches']:
 source=Path(batch['canonical_HTML']['path']);sha=digest(source)
 assert sha==batch['canonical_HTML']['sha256_from_existing_record'],('Source hash mismatch',source)
 sections=re.findall(r'<section\s+id="q(\d+)"[^>]*>(.*?)</section>',source.read_text(),re.S)
 assert sorted(int(n) for n,_ in sections)==batch['question_numbers']
 audit['sources'].append({'batch':batch['batch_id'],'version':batch['final_version'],'sha256':sha,'file':source.name,'licenseManifest':batch['image_license_manifest']['path']})
 for number,body in sections:
  paper='1301' if batch['subject_number']==1 else '2301';qid=f'MOEX-112100-{paper}-Q{int(number):03d}';q=byid[qid]
  stem=re.search(r'<p class="stem">(.*?)</p>',body,re.S);opts=re.search(r'<ol class="options"[^>]*>(.*?)</ol>',body,re.S);answer=re.search(r'<p class="answer">(.*?)</p>',body,re.S)
  assert stem and opts and answer,(qid,'missing source identity')
  source_opts=re.findall(r'<li[^>]*>(.*?)</li>',opts[1],re.S)
  differences=[]
  if normalize(stem[1])!=normalize(q['stem']):differences.append({'field':'stem','source':text(stem[1]),'site':q['stem']})
  for i,v in enumerate(source_opts):
   key=chr(65+i)
   if normalize(v)!=normalize(q['options'].get(key,'')):differences.append({'field':'option'+key,'source':text(v),'site':q['options'].get(key,'')})
  final=text(answer[1]);expected=q.get('acceptedAnswers') or [q['answer']]
  if '一律給分' in final: assert q.get('answerCreditType')=='all_credit',(qid,'scoring differs')
  elif not all(a in final for a in expected):differences.append({'field':'answer','source':final,'site':expected})
  if differences:audit['mismatches'].append({'id':qid,'differences':differences})
  title=text(re.search(r'<h2[^>]*>(.*?)</h2>',body,re.S)[1])
  # Preserve original question media (including Q62 formula symbols) in the full reader.
  clean=Cleaner(assets,qid);clean.feed(body);full=''.join(clean.parts)
  # Add only required credit metadata; leave accepted medical prose and image bytes intact.
  if paper=='1301' and int(number) in {7,15,18,19,21,26,40,41}:
   edition='anatomy-and-physiology-2e' if int(number)==19 else 'anatomy-and-physiology'
   url='https://openstax.org/books/'+edition+'/pages/1-introduction'
   def add_credit(match):
    caption=match[1]
    if 'OpenStax' in caption and 'Access for free at' not in caption:
     caption+=' <span>Access for free at <a href="'+url+'" rel="noopener noreferrer">'+url+'</a></span>'
    return '<figcaption>'+caption+'</figcaption>'
   full=re.sub(r'<figcaption>(.*?)</figcaption>',add_credit,full,flags=re.S)
  explanation=body[answer.end():];para=re.search(r'<p(?:\s[^>]*)?>(.*?)</p>',explanation,re.S);assert para,(qid,'missing accepted opening paragraph')
  shortclean=Cleaner(assets,qid);shortclean.feed('<p>'+para[1]+'</p>');short=''.join(shortclean.parts)
  item={'id':qid,'title':title,'version':batch['final_version'],'batch':batch['batch_id'],'sourceSha256':sha,'shortHtml':short,'html':full,'imageCount':len(clean.assets),'sourceAnswer':final}
  (out/(qid+'.json')).write_text(json.dumps(item,ensure_ascii=False,separators=(',',':')))
  index[qid]={'title':title,'version':batch['final_version'],'batch':batch['batch_id']}
  audit['questions'].append({'id':qid,'sourceNumber':int(number),'batch':batch['batch_id'],'sourceSha256':sha,'assets':clean.assets,'finalAnswer':final,'matchesCanonicalText':not differences})
(root/'data/reviewedExplanationIndex.json').write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n')
(root/'evidence/explanations/import-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'questions':len(index),'images':sum(len(q['assets']) for q in audit['questions']),'uniqueImageFiles':len(list(assets.iterdir())),'textMismatchQuestions':len(audit['mismatches'])},ensure_ascii=False))
