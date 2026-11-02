"""Periodic imports; the Rust service handles live orbital collection itself."""
import datetime as dt,json,os,pathlib,subprocess,sys,time

def cycle(root,data):
    commands=[
        ('missions',1800,['scripts/import_mission_ephemerides.py','--recent','--if-needed','--keep-on-error','--cache-dir',str(data/'horizons-cache')]),
        ('crew',600,['scripts/import_crew_archive.py','--source-dir',str(data/'crew-source'),'--download','--output',str(data/'generated/crew-archive.json')]),
        ('history',900,['scripts/import_recent_history.py','--data-dir',str(data),'--work-dir',str(data/'history-work'),'--days','14','--min-interval','86400']),
        ('health',600,['scripts/ensure_data.py','--check-only','--data-dir',str(data),'--history-dir',str(data/'history')]),
    ]
    report={'at':dt.datetime.now(dt.timezone.utc).isoformat(),'tasks':[]}
    for name,timeout,args in commands:
        print('Atlas maintenance:',name,flush=True)
        try:
            result=subprocess.run([sys.executable,*args],cwd=root,timeout=timeout,check=False)
            report['tasks'].append({'task':name,'exit_code':result.returncode})
        except (OSError,subprocess.TimeoutExpired) as error:
            report['tasks'].append({'task':name,'error':str(error)})
    target=data/'server-maintenance.json';temporary=target.with_suffix('.tmp')
    temporary.write_text(json.dumps(report,ensure_ascii=False,indent=2));os.replace(temporary,target)
    return report

if __name__=='__main__':
    while True:
        cycle(pathlib.Path('/app'),pathlib.Path(os.environ.get('DATA_DIR','/app/data')))
        time.sleep(21600)
