"""Keep current downloads small while retaining actual daily orbital observations."""
import collections,datetime as dt,gzip,json,pathlib,os
UTC=dt.timezone.utc
def compact(bundle,data_dir,prune=False):
    directory=pathlib.Path(data_dir)/'history-updates';directory.mkdir(exist_ok=True)
    groups=collections.defaultdict(dict)
    for row in bundle['orbits']:
        e=row['elements'];date=dt.datetime.fromisoformat(e['EPOCH'].replace('Z','+00:00'));date=date.replace(tzinfo=UTC) if date.tzinfo is None else date
        key=date.date().isoformat();identity=(e['NORAD_CAT_ID'],row['source']);noon=date.replace(hour=12,minute=0,second=0,microsecond=0);rank=abs((date-noon).total_seconds())
        if identity not in groups[key] or rank<groups[key][identity][0]:groups[key][identity]=(rank,row)
    for day,items in groups.items():
        file=directory/(day+'.json.gz')
        if file.exists():
            for row in json.loads(gzip.decompress(file.read_bytes())):
                e=row['elements'];date=dt.datetime.fromisoformat(e['EPOCH'].replace('Z','+00:00'));noon=date.replace(hour=12,minute=0,second=0,microsecond=0);rank=abs((date-noon).total_seconds());identity=(e['NORAD_CAT_ID'],row['source'])
                if identity not in items or rank<items[identity][0]:items[identity]=(rank,row)
        rows=[value[1] for _,value in sorted(items.items())];temp=file.with_name(file.name+'.'+str(os.getpid())+'.tmp');temp.write_bytes(gzip.compress(json.dumps(rows,separators=(',',':'),ensure_ascii=False).encode(),mtime=0));os.replace(temp,file)
    # At most the two latest observations per satellite/source are downloaded at arrival.
    latest=collections.defaultdict(list)
    for row in bundle['orbits']:latest[(row['elements']['NORAD_CAT_ID'],row['source'])].append(row)
    bundle['orbits']=[r for rows in latest.values() for r in sorted(rows,key=lambda r:r['elements']['EPOCH'])[-2:]]
    # Source downloads are only a temporary cache; daily files retain real epochs.
    for prefix in ['gp-','supgp-']:
        files=sorted((f for f in pathlib.Path(data_dir).glob(prefix+'*.json') if f.stem.removeprefix(prefix).isdigit()),key=lambda f:f.stat().st_mtime,reverse=True)
        if prune:
            for file in files[2:]:file.unlink()
    return directory
