"""Original exterior reconstructions, with secondary details interpreted.
References identify each spacecraft, not flight attitude telemetry. Metres, +X axis.
"""
import math
IDS={'explorer-3':6,'explorer-4':9,'explorer-6':15,'explorer-7':22,'vanguard-2':11,'vanguard-3':20}
SOURCES={
 'explorer-3':'https://www.jpl.nasa.gov/missions/explorer-3/',
 'explorer-4':'https://www.si.edu/object/satellite-explorer-4%3Anasm_A19731030000',
 'explorer-6':'https://ntrs.nasa.gov/citations/19880016045',
 'explorer-7':'https://airandspace.si.edu/collection-objects/satellite-explorer-7-replica/nasm_A19761109000',
 'vanguard-2':'https://ntrs.nasa.gov/citations/19740012427',
 'vanguard-3':'https://airandspace.si.edu/collection-objects/satellite-vanguard-3-magne-ray-replica/nasm_A19751412000'}
NOTES={
 'explorer-3':'Assemblage charge utile et dernier étage Sergeant ; finitions et petites pièces interprétées.',
 'explorer-4':'Assemblage charge utile et dernier étage Sergeant ; bandes thermiques et détecteurs distincts.',
 'explorer-6':'Trois palettes déployées et une partiellement repliée : échec de déploiement documenté. Palette concernée et angle résiduel illustratifs ; aucun suivi solaire motorisé.',
 'explorer-7':'Cellules fixées aux deux coques tronconiques ; capteurs thermiques et dipôles centraux. Aucun panneau orientable.',
 'vanguard-2':'Sphère de 50,8 cm, deux télescopes optiques ; alimentation par piles, sans panneaux solaires.',
 'vanguard-3':'Sphère de 50,8 cm et extension magnétométrique de 66 cm. Charge utile seule, sans le troisième étage resté attaché.'}
def vec(x,r,t):return (x,r*math.cos(t),r*math.sin(t))
def surface(m,name,x1,x2,r1,r2,mat,t1=0,t2=math.tau,steps=48):
 """Open conical patch, with outward normals; no coplanar decals."""
 v=[];n=[];uv=[];faces=[];slope=(r1-r2)/(x2-x1);norm=math.hypot(1,slope)
 for j,(x,r) in enumerate(((x1,r1),(x2,r2))):
  for i in range(steps+1):
   t=t1+(t2-t1)*i/steps;v.append(vec(x,r,t));n.append((slope/norm,math.cos(t)/norm,math.sin(t)/norm));uv.append((i/steps*3,j*5))
 for i in range(steps):a=i;b=i+steps+1;faces.extend(((a,a+1,b),(a+1,b+1,b)))
 m.mesh(name,v,n,uv,faces,mat)
def early_explorer(key,E):
 m=E(key);four=key=='explorer-4';r=.0762
 m.axial('Sergeant spent fourth-stage casing',-.99,-.10,r,mat='ivory')
 m.axial('Flared dark aft end',-1.015,-.94,.09,r,'dark')
 m.axial('Payload adapter collar',-.115,-.085,r+.007,mat='steel')
 m.axial('Instrument cylinder',-.085,.80,r,mat='ivory')
 m.axial('Tapered instrument nose',.80,1.015,r,.002,'ivory')
 for j in range(4):
  a=j*math.pi/2+.18
  surface(m,'Thermal-control dark stripe '+str(j),-.08,.79,r+.0005,r+.0005,'dark',a,a+.32,8)
 for x in [-.86,-.62,-.38,-.12,.02,.36,.76]:m.ring('Assembly band',x,r+.001,.0013,'steel',32)
 for j in range(4):
  t=j*math.pi/2;start=vec(.02,r,t);tip=vec(.04,.62,t)
  m.tube('Flexible turnstile antenna '+str(j),start,tip,.0014,.0007,'steel',10)
  m.disk('Antenna insulator',start,(0,math.cos(t),math.sin(t)),.006,'ivory',.008)
 for j in range(4 if four else 3):
  t=j*math.pi/2+.65;m.disk(('Radiation detector ' if four else 'Micrometeorite gauge ')+str(j),vec(.54 if four else .64,r+.0008,t),(0,math.cos(t),math.sin(t)),.013 if four else .009,'steel',.002)
 return m
def explorer6(E):
 m=E('explorer-6')
 profile=[(-.37,.09),(-.31,.21),(-.20,.29),(-.055,.33),(.055,.33),(.20,.29),(.31,.21),(.37,.09)]
 for i,((a,r),(b,s)) in enumerate(zip(profile,profile[1:])):m.axial('Spheroidal shell section '+str(i),a,b,r,s,'silver')
 m.ring('Equatorial instrument band',0,.332,.009,'steel')
 for sign in [-1,1]:
  m.axial('Polar instrument cap',sign*.37,sign*.39,.09,mat='steel')
  m.tube('Polar telemetry antenna',(sign*.39,0,0),(sign*.64,0,0),.002,mat='steel',segments=12)
 for i in range(4):
  t=i*math.pi/2;rad=(0,math.cos(t),math.sin(t));tan=(0,-math.sin(t),math.cos(t));angle=math.radians(73 if i==3 else 24);out=(math.sin(angle),math.cos(angle)*rad[1],math.cos(angle)*rad[2]);normal=(math.cos(angle),-math.sin(angle)*rad[1],-math.sin(angle)*rad[2]);hinge=vec(0,.32,t)
  end=tuple(hinge[k]+out[k]*.28 for k in range(3))
  for side in [-1,1]:m.tube('Paddle support '+str(i),tuple(hinge[k]+side*.045*tan[k] for k in range(3)),tuple(end[k]+side*.17*tan[k] for k in range(3)),.006,mat='steel',segments=12)
  center=tuple(hinge[k]+out[k]*.49 for k in range(3));basis=[normal,tan,out]
  m.box('Solar paddle frame '+str(i),center,(.012,.56,.50),'steel',basis)
  front=tuple(center[k]+normal[k]*.007 for k in range(3));m.box('Solar paddle cells '+str(i),front,(.002,.535,.475),'cells',basis)
 for j in range(6):
  t=(j+.5)*math.pi/3;m.disk('Instrument aperture '+str(j),vec(.06,.333,t),(0,math.cos(t),math.sin(t)),.018,'dark',.004)
 return m
def explorer7(E):
 m=E('explorer-7');m.axial('Central aluminium instrument section',-.055,.055,.375,mat='silver')
 m.axial('Upper fiberglass shell',.055,.375,.375,.12,'ivory');m.axial('Lower fiberglass shell',-.375,-.055,.12,.375,'ivory')
 # Separate cell sectors sit above the substrate, not in its plane.
 for sign in [-1,1]:
  for j in range(16):
   a=j*math.tau/16+.025;b=(j+1)*math.tau/16-.025
   if sign==1:surface(m,'Upper solar cell sector '+str(j),.07,.355,.365,.139,'cells',a,b,8)
   else:surface(m,'Lower solar cell sector '+str(j),-.355,-.07,.139,.365,'cells',a,b,8)
 for x in [-.055,.055]:m.ring('Shell junction',x,.377,.004,'steel')
 for i in range(5):
  t=i*math.tau/5;m.sphere('Heat balance bolometer '+str(i),vec(0,.387,t),.021,'gold' if i%2 else 'dark',12,24)
 for i in range(4):
  t=i*math.pi/2+.4;m.path('Crossed telemetry dipole '+str(i),[vec(0,.375,t),vec(-.04,.48,t),vec(-.12,.70,t)],.002,'steel',10)
 for i,t in enumerate([0,math.pi]):m.disk('Upper radiation chamber '+str(i),vec(.27,.205,t),(0,math.cos(t),math.sin(t)),.035,'steel',.035)
 m.axial('Top Geiger counter',.375,.43,.055,mat='steel');m.axial('Lower tracking antenna base',-.41,-.375,.05,mat='steel')
 return m
def vanguard2(E):
 m=E('vanguard-2');r=.254;m.sphere('Magnesium cloud-cover sphere, 50.8 cm',(0,0,0),r,'silver');m.ring('Hemisphere seam',0,r+.0005,.002,'steel')
 for i,t in enumerate([0,math.pi]):
  normal=(0,math.cos(t),math.sin(t));m.disk('Optical telescope bezel '+str(i),vec(.02,r,t),normal,.025,'steel',.01);m.disk('Cloud-cover telescope window '+str(i),vec(.02,r+.011,t),normal,.018,'glass',.002)
 for i in range(4):
  t=math.pi/4+i*math.pi/2;m.tube('Telemetry rod '+str(i),vec(-.04,.252,t),vec(-.13,.57,t),.0025,.001,'steel',12)
 for j in range(24):m.sphere('Equatorial fastener '+str(j),vec(0,r+.002,j*math.tau/24),.003,'steel',6,10)
 return m
def vanguard3(E):
 m=E('vanguard-3');r=.254;m.sphere('Magnesium lower sphere, 50.8 cm',(0,0,0),r,'silver')
 # The top quarter has a distinct non-magnetic phenolic/fiberglass skin.
 x0=.127;steps=16
 for j in range(steps):
  a=x0+(.253-x0)*j/steps;b=x0+(.253-x0)*(j+1)/steps
  surface(m,'Phenolic upper cap '+str(j),a,b,math.sqrt(r*r-a*a)+.0006,math.sqrt(r*r-b*b)+.0006,'gold')
 m.ring('Fiberglass cap seam',x0,math.sqrt(r*r-x0*x0)+.001,.002,'steel')
 m.axial('Nonmagnetic magnetometer extension',.245,.914,.069,.012,'gold')
 m.axial('Magnetometer tip housing',.914,.94,.018,mat='ivory')
 for i in range(4):
  t=math.pi/4+i*math.pi/2;m.tube('Telemetry antenna '+str(i),vec(0,.253,t),vec(-.035,.98,t),.0025,.001,'steel',12)
 m.disk('X-ray detector window',vec(-.12,.224,0),(0,1,0),.025,'dark',.003)
 return m
def build(key,E):
 if key in ('explorer-3','explorer-4'):return early_explorer(key,E)
 return {'explorer-6':explorer6,'explorer-7':explorer7,'vanguard-2':vanguard2,'vanguard-3':vanguard3}[key](E)
