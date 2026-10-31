"""Add sourced mission-specific milestones; don't invent unreported staging times."""
from pathlib import Path
import datetime as dt,json
ROOT=Path(__file__).resolve().parents[1];p=ROOT/'static/mission-events/catalog.json';cat=json.loads(p.read_text());missions=cat['missions'];UTC=dt.timezone.utc
def add(key,ident,date,title,target,source,kind='milestone',hours=12):
 if any(e['id']==ident for e in missions[key]):return
 t=dt.datetime.fromisoformat(date.replace('Z','+00:00')) if 'T' in date else dt.datetime.fromisoformat(date).replace(tzinfo=UTC)+dt.timedelta(hours=12)
 missions[key].append({'id':ident,'date':date,'precision':'minute' if 'T' in date else 'day','title':title,'target':target,'kind':kind,'source':source,'at':int(t.timestamp()*1000),'before_hours':hours,'after_hours':hours})
esa='https://www.cosmos.esa.int/web/juice/payload'
add('juice','juice-solar','2023-04-14T13:30:00Z','Déploiement des panneaux solaires','terre','https://www.sciencedirect.com/science/article/pii/S0094576524005496',hours=1)
add('juice','juice-separation','2023-04-14T12:42:17Z','Séparation du lanceur Ariane 5','terre',esa,hours=1)
add('juice','juice-mag','2023-04-21T14:29:00Z','Déploiement du mât magnétométrique','terre','https://www.sciencedirect.com/science/article/pii/S0094576524005496',hours=1)
add('juice','juice-rime','2023-05-12','Déploiement complet de l’antenne RIME','terre',esa)
# The lunar encounter needs its own centred view, not an Earth flyby surrogate.
next(e for e in missions['juice'] if e['id']=='juice-2')['target']='lune'
add('jwst','jwst-separation','2021-12-25T12:47:00Z','Séparation du lanceur Ariane 5','terre','https://science.nasa.gov/asset/webb/jwst-with-solar-panel-deployed/',hours=.5)
add('jwst','jwst-solar','2021-12-25T12:50:00Z','Déploiement du panneau solaire','terre','https://science.nasa.gov/blogs/webb/2021/12/25/solar-array-deployed/',hours=.5)
add('jwst','jwst-sunshield','2022-01-04','Déploiement du pare-soleil','terre','https://www.nasa.gov/news-release/sunshield-successfully-deploys-on-nasas-next-flagship-telescope/')
add('jwst','jwst-mirror','2022-01-08T18:17:00Z','Déploiement complet du miroir primaire','terre','https://science.nasa.gov/blogs/webb/2022/01/08/primary-mirror-wings-deployed-all-major-deployments-complete/',hours=1)
add('juno','juno-earth','2013-10-09','Assistance gravitationnelle de la Terre','terre','https://www.jpl.nasa.gov/news/juno-status-report/','flyby',24)
for ident,date,title in [('juno-burn1','2012-08-30','Première manœuvre en espace profond'),('juno-burn2','2012-09-14','Deuxième manœuvre en espace profond')]:add('juno',ident,date,title,'soleil','https://www.nasa.gov/history/10-years-ago-juno-launched-to-observe-jupiter/')
source='https://www.esa.int/ESA_Multimedia/Images/2017/07/Bepicolombo_spacecraft_facts'
for ident,date,title,target in [('bepi-earth','2020-04-10','Assistance gravitationnelle de la Terre','terre'),('bepi-venus1','2020-10-15','Premier survol de Vénus','venus'),('bepi-venus2','2021-08-10','Deuxième survol de Vénus','venus'),('bepi-mercury1','2021-10-01','Premier survol de Mercure','mercure'),('bepi-mercury2','2022-06-23','Deuxième survol de Mercure','mercure'),('bepi-mercury3','2023-06-19','Troisième survol de Mercure','mercure'),('bepi-mercury4','2024-09-04','Quatrième survol de Mercure','mercure'),('bepi-mercury5','2024-12-01','Cinquième survol de Mercure','mercure')]:add('bepicolombo',ident,date,title,target,source,'flyby',24)
for e in missions['bepicolombo']:
 if e['id']=='bepi-venus2':e['source']='https://doi.org/10.1007/s11214-021-00797-9'
for e in missions['new-horizons']:
 if 'Pluton' in e['title']:e['target']='pluton'
 if 'Arrokoth' in e['title']:e['target']='arrokoth'
add('cassini','cassini-ring-orbit','2017-04-26','Première orbite du Grand Finale','saturne','https://science.nasa.gov/mission/cassini/faq/','orbit',84)
add('juno','juno-first-orbit','2016-08-27','Première orbite complète de Jupiter','jupiter','https://science.nasa.gov/mission/juno/juno-orbits/','orbit',648)
for key,date in [('voyager-1','1977-09-05T12:56:01Z'),('voyager-2','1977-08-20T14:29:44Z')]:
 event=next(e for e in missions[key] if e['kind']=='launch');event.update(date=date,precision='second',at=int(dt.datetime.fromisoformat(date.replace('Z','+00:00')).timestamp()*1000),source='https://science.nasa.gov/mission/voyager/'+key+'/')
for key in ['voyager-1','voyager-2','juno','new-horizons']:
 next(e for e in missions[key] if e['kind']=='launch')['pad']={'name':'Cap Canaveral · LC-41','lat':28.5833,'lon':-80.5831,'source':'https://www.planet4589.org/space/gcat/data/tables/lp.html'}
for key in ['juice','jwst','bepicolombo','herschel','planck']:
 next(e for e in missions[key] if e['kind']=='launch')['pad']={'name':'Kourou · ELA-3','lat':5.2375,'lon':-52.7687,'source':'https://www.planet4589.org/space/gcat/data/tables/lp.html'}
next(e for e in missions['cassini'] if e['kind']=='launch')['pad']={'name':'Cap Canaveral · LC-40','lat':28.5620,'lon':-80.5772,'source':'https://www.planet4589.org/space/gcat/data/tables/lp.html'}
for key in ['gaia']:
 next(e for e in missions[key] if e['kind']=='launch')['pad']={'name':'Kourou · ELS','lat':5.3050,'lon':-52.8344,'source':'https://www.planet4589.org/space/gcat/data/tables/lp.html'}
for events in missions.values():events.sort(key=lambda e:e['at'])
p.write_text(json.dumps(cat,ensure_ascii=False,indent=2)+'\n');print(sum(map(len,missions.values())),'documented events')
