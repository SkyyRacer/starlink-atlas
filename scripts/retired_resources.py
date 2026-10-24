"""Refresh last-position actions from new provider archives during each export."""
import datetime as dt,json
UTC=dt.timezone.utc
def instant(value):
 value=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
 return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
def refresh(out,catalog,observations):
 path=out/'retired-positions.json';document=json.loads(path.read_text()) if path.exists() else {'objects':{}}
 now=dt.datetime.now(UTC);decayed={s['id']:s for s in catalog if s.get('decay') and instant(s['decay'])<=now};folder=out/'retired-observations'
 for row in observations:
  element=row.get('elements',row);ident=element.get('NORAD_CAT_ID');satellite=decayed.get(ident)
  if not satellite or not element.get('EPOCH'):continue
  epoch=instant(element['EPOCH'])
  if epoch>=instant(satellite['decay']) or (satellite.get('launch') and epoch<instant(satellite['launch'])):continue
  previous=document['objects'].get(str(ident))
  if previous and instant(previous['at'])>=epoch:continue
  document['objects'][str(ident)]={'at':epoch.isoformat().replace('+00:00','Z'),'source':row.get('source','Archive publique Julien Simon / Space-Track')}
  folder.mkdir(exist_ok=True);(folder/(str(ident)+'.json')).write_text(json.dumps(row,separators=(',',':')))
 document['generated_at']=now.isoformat();path.write_text(json.dumps(document,separators=(',',':')))
 return document
