"""Concurrent cold edition downloads, without calling an orbital backend."""
import argparse,concurrent.futures,json,time,urllib.request,urllib.parse
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--users',type=int,default=50);p.add_argument('--output');a=p.parse_args();base=a.url.rstrip('/')+'/'
with urllib.request.urlopen(base+'edition.json',timeout=60) as r:edition=json.load(r)
url=urllib.parse.urljoin(base,edition['bundle'])
def visit(i):
 start=time.monotonic()
 with urllib.request.urlopen(url,timeout=60) as r:
  body=r.read();assert r.status==200
 assert body[:2]==b'\x1f\x8b'
 return time.monotonic()-start,len(body)
start=time.monotonic()
with concurrent.futures.ThreadPoolExecutor(max_workers=a.users) as pool:rows=list(pool.map(visit,range(a.users)))
elapsed=time.monotonic()-start;times=sorted(row[0] for row in rows)
report={'url':base,'users':a.users,'success':len(rows),'elapsed_s':round(elapsed,3),'p95_s':round(times[min(len(times)-1,int(.95*len(times)))],3),'bytes_per_user':rows[0][1],'orbital_server_requests':0,'scope':'Concurrent edition downloads; not a guarantee of hosting availability or browser rendering performance.'}
if a.output:open(a.output,'w').write(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
