"""Optional online check of illustrative-model references; never runs in the browser."""
import concurrent.futures,hashlib,json,pathlib,re,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
def check(url):
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Atlas-model-reference-review/1.0'})
  with urllib.request.urlopen(req,timeout=12) as response:
   raw=response.read(2000000);text=raw.decode('utf-8','replace');title=re.search(r'<title[^>]*>(.*?)</title>',text,re.S|re.I);label=re.sub(r'\s+',' ',title[1]).strip() if title else ''
   return {'url':url,'status':response.status,'resolved':response.url,'title':label,'usable':not bool(re.search('Errors and Messages|not found',label,re.I)),'sha256_prefix_up_to_2mb':hashlib.sha256(raw).hexdigest()}
 except Exception as error:return {'url':url,'usable':False,'error':str(error)}
def main():
 sources=json.loads((ROOT/'resources/science-model-sources.json').read_text());urls=sorted({s['page'] for s in sources.values() if s['kind']=='original-schematic'})
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:result=list(pool.map(check,urls))
 (ROOT/'resources/model-reference-audit-2026-10-24.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print('References:',len(result),'; currently reachable:',sum(r['usable'] for r in result))
if __name__=='__main__':main()
