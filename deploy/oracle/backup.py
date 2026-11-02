"""Run with app and maintenance stopped; copy the archive off-server afterwards."""
import datetime as dt,os,pathlib,tarfile

def backup(destination,folders):
    destination.mkdir(parents=True,exist_ok=True)
    name='atlas-'+dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.tar.gz'
    target=destination/name;temporary=destination/(name+'.tmp')
    def keep(info):
        parts=pathlib.PurePosixPath(info.name).parts
        if any(p in {'history-work','__pycache__'} for p in parts) or info.name.endswith(('.tmp','.lock')):return None
        return info
    try:
        with tarfile.open(temporary,'w:gz') as archive:
            for name,folder in folders.items():
                if folder.is_dir():archive.add(folder,arcname=name,filter=keep)
        with tarfile.open(temporary,'r:gz') as archive:
            if not archive.getmembers():raise RuntimeError('Refus de créer une sauvegarde vide')
        temporary.chmod(0o600);os.replace(temporary,target)
        return target
    finally:temporary.unlink(missing_ok=True)

if __name__=='__main__':
    os.umask(0o077)
    print(backup(pathlib.Path('/app/backups'),{'data':pathlib.Path('/app/data'),'ephemerides':pathlib.Path('/app/static/ephemerides')}),flush=True)
