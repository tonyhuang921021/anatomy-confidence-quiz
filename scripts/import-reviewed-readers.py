"""Import accepted, hash-pinned reader sections; never generate medical prose.
Run from the repo with the author handoff path and exported canonical question bank.
"""
import argparse, base64, hashlib, html, json, re, subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from html.parser import HTMLParser

ALLOWED=set('p h2 h3 h4 strong em b i u sup sub figure figcaption img div span table thead tbody tfoot tr th td ul ol li details summary br hr a blockquote dl dt dd caption cite'.split())
VOID={'img','br','hr'}
DIMENSIONS_PATH=Path('evidence/explanations/image-dimensions.json')
DIMENSIONS=json.loads(DIMENSIONS_PATH.read_text()) if DIMENSIONS_PATH.exists() else {}
def dimensions(path,digest):
 if digest not in DIMENSIONS:
  code="const fs=require('fs'),size=require('next/dist/compiled/image-size');const d=size(fs.readFileSync(process.argv[1]));console.log(JSON.stringify([5,6,7,8].includes(d.orientation)?{width:d.height,height:d.width}:{width:d.width,height:d.height}));"
  DIMENSIONS[digest]=json.loads(subprocess.check_output(['node','-e',code,str(path)],text=True))
 return DIMENSIONS[digest]

class Cleaner(HTMLParser):
 def __init__(self, asset_dir, prefix):
  super().__init__(convert_charrefs=True); self.parts=[]; self.asset_dir=asset_dir; self.prefix=prefix; self.assets=[]
 def handle_starttag(self,tag,attrs):
  if tag not in ALLOWED: raise ValueError('Unexpected HTML tag: '+tag)
  attrs=dict(attrs); out={}
  if tag=='img':
   src=attrs.get('src',''); match=re.fullmatch(r'data:image/(png|jpeg|jpg|gif|webp|svg\+xml);base64,([\s\S]+)',src,re.I)
   if not match: raise ValueError('Image must be a frozen embedded raster: '+src[:80])
   data=base64.b64decode(match[2],validate=True); digest=hashlib.sha256(data).hexdigest(); ext='jpg' if match[1].lower() in ['jpg','jpeg'] else match[1].lower()
   if ext=='svg+xml':
    ext='svg'
    for node in ET.fromstring(data).iter():
     assert node.tag.rsplit('}',1)[-1] not in {'script','foreignObject','iframe','object','embed'},'Active SVG content'
     for key,value in node.attrib.items():
      key=key.rsplit('}',1)[-1].lower()
      safe_reference=value.startswith('#') or re.fullmatch(r'data:image/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=\s]+',value)
      assert not key.startswith('on') and not (key in {'href','src'} and not safe_reference),'External/active SVG reference'
   filename=digest+'.'+ext; (self.asset_dir/filename).write_bytes(data)
   size=dimensions(self.asset_dir/filename,digest)
   out={'src':'/reviewed-explanations/assets/'+filename,'alt':attrs.get('alt','詳解原圖'),'loading':'lazy','decoding':'async','width':str(size['width']),'height':str(size['height'])}; self.assets.append({'path':out['src'],'sha256':digest,'bytes':len(data),'alt':out['alt']})
  if tag=='a':
   href=attrs.get('href','')
   if not (href.startswith('https://') or href.startswith('http://') or href.startswith('#')): raise ValueError('Unsafe link')
   out={'href':href,'rel':'noopener noreferrer'}
  for key in ['colspan','rowspan','type','start']:
   if key in attrs and re.fullmatch(r'[0-9AaIi]+',attrs[key]): out[key]=attrs[key]
  if tag=='div' and 'exam-table-scroll' in attrs.get('class',''): out['class']='reviewed-table-scroll'
  if tag=='p' and 'answer' in attrs.get('class','').split(): out['class']='reviewed-official-answer'
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

def explanation_only(body):
 # Remove only source-marked exam header/stem/options, never differential reasoning.
 body=re.sub(r'<p class="eyebrow"[^>]*>.*?</p>', '', body, count=1, flags=re.S)
 body=re.sub(r'<p class="stem"[^>]*>.*?</p>', lambda m: ''.join(re.findall(r'<img\b[^>]*>', m[0])), body, count=1, flags=re.S)
 body=re.sub(r'<ol class="options"[^>]*>.*?</ol>', '', body, count=1, flags=re.S)
 return body

def layout_figures(fragment):
 # Only adjacent figures form a comparison group; intervening prose stays in place.
 fragment=re.sub(r'(<figure>(?:(?!</?figure\b).)*</figure>)(\s*<figure>(?:(?!</?figure\b).)*</figure>)+', lambda m:'<div class="reviewed-figure-group">'+m[0]+'</div>',fragment,flags=re.S)
 def enlarge(m):
  opening,source,rest=m.groups()
  width=int(re.search(r'width="(\d+)"',rest)[1]);height=int(re.search(r'height="(\d+)"',rest)[1])
  frame='<span class="reviewed-image-frame" data-image-state="loading" style="--reviewed-image-width:'+str(width)+'px;--reviewed-image-ratio:'+str(width/height)+'">'+opening+source+rest+'</span>'
  return frame+'<a class="reviewed-image-link" href="'+source+'" target="_blank" rel="noopener noreferrer">放大查看原圖</a>'
 return re.sub(r'(<img src=")([^"]+)("[^>]*>)',enlarge,fragment)


def main():
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
   # Retain necessary source figures (including Q62 formulas), without repeating the exam text.
   clean=Cleaner(assets,qid);clean.feed(explanation_only(body));full=layout_figures(''.join(clean.parts))
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
 DIMENSIONS_PATH.write_text(json.dumps(DIMENSIONS,indent=2)+'\n')
 print(json.dumps({'questions':len(index),'images':sum(len(q['assets']) for q in audit['questions']),'uniqueImageFiles':len(list(assets.iterdir())),'textMismatchQuestions':len(audit['mismatches'])},ensure_ascii=False))

if __name__ == "__main__": main()
