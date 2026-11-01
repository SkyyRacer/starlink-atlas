"""Export validated, bounded JPL blocks; warm major moons once per cache block."""
import gzip,hashlib,json,math,pathlib,time

def export(out,cache,seed):
    folder=out/'solar/vectors';folder.mkdir(parents=True,exist_ok=True)
    index={'origin':399,'frame':'ICRF','time_scale':'UTC','bodies':{}}
    for root in [seed,cache]:
        for path in sorted(root.glob('*.json*')):
            try:
                original=gzip.decompress(path.read_bytes()) if path.suffix=='.gz' else path.read_bytes()
                data=json.loads(original);rows=data.get('samples',[])
                if not rows or any(len(row)!=7 or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in row) for row in rows) or any(b[0]<=a[0] or b[0]-a[0]>data.get('max_interval_seconds',0)+1 for a,b in zip(rows,rows[1:])):continue
                if data.get('origin')!=399 or data.get('frame')!='ICRF' or data.get('time_scale')!='UTC':continue
                name=hashlib.sha256(original).hexdigest()[:24]+'.json.gz'
                (folder/name).write_bytes(gzip.compress(original,mtime=0))
                key=str(data['id']);index['bodies'].setdefault(key,{})[str(rows[0][0])]={'file':'solar/vectors/'+name,'first_epoch':rows[0][0],'last_epoch':rows[-1][0]}
            except (OSError,ValueError,KeyError,TypeError):continue
    (folder/'index.json').write_text(json.dumps(index,separators=(',',':')))

if __name__=='__main__':
    import argparse,subprocess,sys
    p=argparse.ArgumentParser();p.add_argument('--cache',type=pathlib.Path,required=True);p.add_argument('--budget',type=int,default=180);a=p.parse_args()
    a.cache.mkdir(parents=True,exist_ok=True);start=time.monotonic();now=time.time()
    # Other moons are retained in the seed at their actual archived dates.
    for ident in [301,401,402,501,502,503,504,601,602,603,604,605,606,607,608,609,701,702,703,704,705,801]:
        left=a.budget-(time.monotonic()-start)
        if left<5:break
        code="from scripts import solar_vectors as s;import pathlib,json;s.CACHE=pathlib.Path("+repr(str(a.cache))+ ");print(json.dumps(s.vectors({'id':"+str(ident)+",'kind':'moon'},"+str(now)+")))"
        try:
            result=subprocess.run([sys.executable,'-c',code],timeout=min(55,left),capture_output=True,text=True,check=True)
            data=json.loads(result.stdout)
            if not data.get('samples'):print('Éphémérides non disponibles :',ident,flush=True)
        except (OSError,ValueError,subprocess.SubprocessError):print('Cache conservé après échec JPL :',ident,flush=True)
