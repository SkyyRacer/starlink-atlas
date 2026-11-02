"""Report every stopped collector, grouping shared-provider failures once in logs."""
import argparse,collections,datetime as dt,json,pathlib,re

def report(directory):
    rows=[];groups=collections.defaultdict(list)
    for path in sorted(directory.glob('*-stopped.txt')):
        reason=path.read_text(errors='replace').strip();key=path.name.removesuffix('-stopped.txt')
        rows.append({'source':key,'reason':reason})
        common=re.sub(r'https?://\S+','[URL]',reason)
        groups[common].append(key)
    result={'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'stopped':rows}
    (directory/'collection-health.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    for reason,keys in groups.items():
        label=', '.join(keys[:8])+('…' if len(keys)>8 else '')
        print('::warning::'+str(len(keys))+' collecte(s) suspendue(s) : '+label+' · '+reason.replace('\n',' ')+' · Détails complets : collection-health.json. Les observations de secours gardent leurs dates réelles.')
    if not rows:print('Aucune collecte suspendue.')
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--data-dir',type=pathlib.Path,required=True);p.add_argument('--strict',action='store_true');a=p.parse_args();result=report(a.data_dir)
    if a.strict and result['stopped']:raise SystemExit('Publication bloquée : une ou plusieurs collectes restent suspendues. Les avertissements ne sont pas masqués.')
