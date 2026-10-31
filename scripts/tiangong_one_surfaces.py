"""Tiangong-1 standalone reconstruction, +X docking end, +Z nadir.
Main dimensions: CNSA/ESA, references in historical-station-models.json.
Surface partitions, small equipment, flag position and static antenna/array
angles are visual interpretation of the supplied model/render references.
No Shenzhou is built into this target vehicle.
"""
import math

def finish(m,png):
 def cells(x,y):
  seam=x%64<2 or y%64<2;bus=x%64==32;n=(x*13+y*7)%3
  return (138,135,120) if seam else (157,139,94) if bus else (51+n,43+n,108+n)
 data=png(512,512,cells);m.g['images'].append({'bufferView':m.view(data),'mimeType':'image/png'});m.g['textures'].append({'source':len(m.g['images'])-1,'sampler':0});texture=len(m.g['textures'])-1
 for name,color,metal,rough in [('tg-white',[.91,.92,.9,1],.07,.54),('tg-grey',[.64,.66,.68,1],.25,.43),('tg-frame',[.43,.45,.46,1],.7,.27),('tg-cells',[1,1,1,1],.5,.26)]:
  pbr={'baseColorFactor':color,'metallicFactor':metal,'roughnessFactor':rough}
  if name=='tg-cells':pbr['baseColorTexture']={'index':texture}
  m.materials[name]=len(m.g['materials']);m.g['materials'].append({'name':name,'pbrMetallicRoughness':pbr,'doubleSided':False})
 def star(px,py,cx,cy,r,angle):
  vertices=[(cx+math.cos(angle+i*math.pi/5)*(r if i%2==0 else r*.382),cy+math.sin(angle+i*math.pi/5)*(r if i%2==0 else r*.382)) for i in range(10)];inside=False;j=9
  for i,(x,y) in enumerate(vertices):
   a,b=vertices[j]
   if (y>py)!=(b>py) and px<(a-x)*(py-y)/(b-y)+x:inside=not inside
   j=i
  return inside
 def flag(x,y):
  stars=[(32,32,19.2,-math.pi/2)]+[(cx,cy,6.4,math.atan2(32-cy,32-cx)) for cx,cy in [(64,12.8),(76.8,25.6),(76.8,44.8),(64,57.6)]]
  return (249,216,40) if any(star(x,y,*s) for s in stars) else (174,29,27)
 m.g['images'].append({'bufferView':m.view(png(192,128,flag)),'mimeType':'image/png'});m.g['textures'].append({'source':len(m.g['images'])-1,'sampler':0});m.materials['tg-flag']=len(m.g['materials']);m.g['materials'].append({'name':'tg-flag','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'baseColorTexture':{'index':len(m.g['textures'])-1},'metallicFactor':0,'roughnessFactor':.7}})
 m.g['asset']['generator']='Atlas Tiangong-1 reconstruction v2 · CNSA/ESA dimensions, white/grey finish'
 if m.key in ('tiangong-1','tiangong-2'):
  from tiangong_lab_detail import materials
  materials(m)

def dish(m):
 axis=(-.15,-.2,-.9682458);n=math.sqrt(sum(v*v for v in axis));axis=tuple(v/n for v in axis);u=(.8,-.6,0);v=(axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]);center=(-3.45,0,-2.18);radius=.5;depth=.13
 def point(r,t,offset=0):return tuple(center[k]+r*(u[k]*math.cos(t)+v[k]*math.sin(t))+axis[k]*(depth*(r/radius)**2+offset) for k in range(3))
 for back in [False,True]:
  verts=[point(0,0,-.009 if back else 0)];norms=[tuple(x*(-1 if back else 1) for x in axis)];uv=[(.5,.5)];faces=[]
  for j in range(1,11):
   r=radius*j/10
   for i in range(49):
    t=math.pi*2*i/48;verts.append(point(r,t,-.009 if back else 0));gradient=tuple(axis[k]-2*depth*r/radius**2*(u[k]*math.cos(t)+v[k]*math.sin(t)) for k in range(3));length=math.sqrt(sum(x*x for x in gradient));norms.append(tuple(x/length*(-1 if back else 1) for x in gradient));uv.append((.5+.5*r/radius*math.cos(t),.5+.5*r/radius*math.sin(t)))
  for i in range(48):faces.append((0,1+i,2+i))
  for j in range(9):
   for i in range(48):
    a=1+j*49+i;b=a+49;faces.extend([(a,b,b+1),(a,b+1,a+1)])
  if back:faces=[(a,c,b) for a,b,c in faces]
  m.mesh('S-band parabola '+('back' if back else 'reflector'),verts,norms,uv,faces,'tg-grey' if back else 'tg-white')
 for i in range(48):m.tube('Parabola rim',point(radius,i*math.pi/24),point(radius,(i+1)*math.pi/24),.012,mat='tg-frame',segments=8)
 tip=tuple(center[k]+axis[k]*.43 for k in range(3))
 for i in range(3):m.tube('Dish feed strut',point(radius,i*math.pi*2/3),tip,.012,mat='tg-frame',segments=8)
 m.tube('Dish receiver',tip,tuple(tip[k]+axis[k]*.09 for k in range(3)),.045,mat='gold',segments=16)
 m.tube('Antenna gimbal pedestal',(-3.45,0,-1.38),(-3.45,0,-2.18),.085,mat='tg-frame',segments=32)

def wing(m,index,side):
 first=len(m.g['nodes']);x=-2.7;lo=1.5;hi=9.2 if m.key=='tiangong-2' else 8.5;width=3.;basis=[(1,0,0),(0,side,0),(0,0,side)];cells=[]
 m.tube(f'Array {index} rotary drive',(x,side*1.25,0),(x,side*1.6,0),.14,mat='tg-frame',segments=32)
 for j in range(4):
  a=lo+(hi-lo)*j/4+.025;b=lo+(hi-lo)*(j+1)/4-.025;d=(a+b)/2
  m.box(f'Array {index} section {j+1} rear',(x,side*d,0),(width,b-a,.045),'dark',basis)
  m.box(f'Array {index} section {j+1} dark cells',(x,side*d,-.027),(width-.04,b-a-.04,.008),'tg-cells',basis,repeat=(2.5,2));cells.append(len(m.g['nodes'])-1)
  for end in [a,b]:m.tube('Panel hinge bar',(x-width/2,side*end,0),(x+width/2,side*end,0),.03,mat='tg-frame',segments=10)
  for sign in [-1,1]:m.tube('Diagonal panel tension brace',(x-sign*(width/2-.05),side*(a+.04),-.04),(x+sign*(width/2-.05),side*(b-.04),-.04),.012,mat='gold',segments=8)
  for edge in [-width/2,width/2]:m.tube('Solar panel edge',(x+edge,side*a,0),(x+edge,side*b,0),.018,mat='tg-frame',segments=8)
  for px in [-1,0,1]:
   for yy in [a+.08,b-.08]:m.tube('Panel fastening',(x+px,side*yy,-.027),(x+px,side*yy,-.04),.025,mat='gold',segments=10)
 roots=m.g['scenes'][0]['nodes'];roots[:]=[i for i in roots if i not in cells];roots.append(len(m.g['nodes']));m.g['nodes'].append({'name':f'Solar array {index} cells','children':cells});m.parts.append({'part':'solar_array','index':index,'span_from_axis_m':hi,'width_m':width,'leaf_sections':4})
 from tiangong_solar_rig import single_axis
 single_axis(m,first,'Lab solar drive '+str(index),(x,side*1.4,0),side)

def build(m):
 # 10.4 m end-to-end; 3.35 m experiment cabin, 2.8 m resource section.
 m.axial('TG-1 resource module',-4.95,-1.0,1.4,mat='tg-white');m.axial('TG-1 aft engine deck',-5.05,-4.95,1.4,mat='dark');m.axial('TG-1 aft cone',-1,.0,1.4,1.675,'tg-grey');m.axial('TG-1 experiment cabin',0,4,1.675,mat='tg-grey');m.axial('TG-1 central white blanket',1.1,2.75,1.68,mat='tg-white');m.axial('TG-1 forward shoulder',4,4.7,1.675,.79,'tg-white');m.tube('TG-1 docking neck',(4.7,0,0),(5.03,0,0),.79,mat='tg-grey',caps=False)
 # Concentric open docking ring and three guide petals, not a featureless cap.
 for radius in [.77,.57]:m.tube('Docking collar',(5.03,0,0),(5.19,0,0),radius,mat='steel',segments=96,caps=False)
 verts=[];norms=[];uv=[];faces=[]
 for r in [.57,.77]:
  for i in range(97):
   a=i*math.pi/48;verts.append((5.19,r*math.cos(a),r*math.sin(a)));norms.append((1,0,0));uv.append((i/96,0 if r==.57 else 1))
 for i in range(96):faces.extend([(i,97+i,98+i),(i,98+i,i+1)])
 m.mesh('Docking annular face',verts,norms,uv,faces,'steel');m.axial('Recessed docking target',4.97,4.985,.55,mat='dark')
 for i in range(3):
  t=i*math.pi*2/3;y,z=math.cos(t),math.sin(t);rad=(0,y,z);tan=(0,-z,y);m.box('Docking guide petal',(5.11,.52*y,.52*z),(.15,.16,.22),'steel',[(1,0,0),rad,tan])
 for x,r in [(-4.8,1.415),(-1.1,1.415),(.12,1.69),(1.13,1.695),(2.74,1.695),(3.96,1.69)]:m.axial('Module joint band',x-.022,x+.022,r,mat='tg-frame')
 for x,r in [(-4.35,1.4),(-3.6,1.4),(-1.7,1.4),(.6,1.68),(3.4,1.68)]:
  for t in [.2,1.1,2.8,4.1,5.4]:
   y,z=math.cos(t),math.sin(t);a=(x,r*y,r*z);b=(x,(r+.055)*y,(r+.055)*z);m.tube('Thermal cover fastener',a,b,.035,mat='tg-frame',segments=12)
 for side in [-1,1]:
  for z in [-.65,.65]:m.engine((-4.9,side*.7,z),(-5.2,side*.7,z),.13)
 # Docking cameras, reflectors, lights and small alignment targets on the cone.
 for i in range(6):
  t=i*math.pi/3;y,z=math.cos(t),math.sin(t);m.tube('Gold rendezvous light housing',(4.29,1.38*y,1.38*z),(4.47,1.38*y,1.38*z),.105,mat='gold',segments=24);m.tube('Rendezvous light aperture',(4.475,1.38*y,1.38*z),(4.48,1.38*y,1.38*z),.066,mat='dark',segments=24)
 m.box('Docking optical camera',(4.2,-.4,-1.35),(.25,.19,.16),'tg-frame');m.tube('Docking camera lens',(4.33,-.4,-1.35),(4.35,-.4,-1.35),.055,mat='glass',segments=24)
 # CAST's 2016-09-18 TG-2 illustration places the flag on this forward flank.
 # Remove the invented viewport that pierced this marking on both TG labs.
 for x,r,t in [(.7,1.675,math.pi/2),(-3.1,1.4,math.pi)]:m.window(x,r,t)
 for x,r in [(-3.1,1.4),(.55,1.675),(3.25,1.675)]:
  for t in [.7,3.8]:
   y,z=math.cos(t),math.sin(t);m.tube('Grab rail',(x-.22,(r+.055)*y,(r+.055)*z),(x+.22,(r+.055)*y,(r+.055)*z),.017,mat='tg-white',segments=10)
 # Painted seams and equipment bands on the smaller resource compartment.
 for t in [0,math.pi]:
  y,z=math.cos(t),math.sin(t);m.tube('Resource module seam',(-4.6,1.405*y,1.405*z),(-1.3,1.405*y,1.405*z),.015,mat='tg-grey',segments=8)
 for x in [1.3,1.6,1.9,2.2,2.5,3.15,3.55]:m.axial('Fine thermal blanket circumferential seam',x-.009,x+.009,1.686,mat='tg-grey')
 for side in [-1,1]:
  points=[(-1.6,side*1.40,.25),(-1.3,side*1.45,.25),(-.4,side*1.68,.25),(.15,side*1.70,.25)]
  for a,b in zip(points,points[1:]):m.tube('Bent thermal harness',a,b,.038,mat='tg-frame',segments=12)
 m.box('Docking gold insulation housing',(4.78,-.60,.78),(.46,.48,.32),'gold')
 wing(m,1,1);wing(m,2,-1);dish(m)
 from tiangong_lab_detail import geometry
 geometry(m)


def attach_shenzhou(m):
 """Representative Shenzhou VIII/IX/X docking configuration, not telemetry.
 9 m end-to-end and 2.8 m maximum body diameter per CNSA. Wing span, surface
 details and deployment angles are illustrative; orbital module has no arrays.
 """
 dock=5.19;start=len(m.g['nodes']);at=lambda x:(dock+x,0,0)
 def axial(name,a,b,r1,r2=None,mat='tg-grey'):m.tube(name,at(a),at(b),r1,r2,mat)
 axial('Active docking adapter',.02,.35,.65,.75,'steel');axial('Orbital forward cone',.35,.75,.75,1.1);axial('Orbital cabin',.75,2.9,1.1);axial('Orbital aft shoulder',2.9,3.2,1.1,.57);axial('Capsule upper shoulder',3.2,3.65,.57,.95);axial('Reentry capsule',3.65,5.2,.95,1.25);axial('Capsule heat shield edge',5.2,5.35,1.25,mat='dark');axial('Service connecting tunnel',5.35,5.6,.75,mat='tg-frame');axial('Propulsion module',5.6,8.35,1.25,mat='tg-white');axial('Propulsion aft skirt',8.35,8.8,1.25,1.4,'tg-white');m.engine(at(8.72),at(9.02),.34)
 for x,r in [(.76,1.12),(2.86,1.12),(3.67,.97),(5.15,1.26),(5.65,1.27),(8.30,1.27)]:axial('Module connection band',x-.025,x+.025,r,mat='tg-frame')
 m.hatch(dock+1.65,1.1,math.pi/2)
 for x,r in [(1.4,1.1),(4.4,1.15)]:m.window(dock+x,r,math.pi)
 for x in [1.15,2.15]:
  for t in [.4,2.6,4.2]:
   y,z=math.cos(t),math.sin(t);m.tube('Orbital cabin grab rail',(dock+x-.25,1.17*y,1.17*z),(dock+x+.25,1.17*y,1.17*z),.023,mat='tg-white',segments=12)
 for side in [-1,1]:
  m.tube('Solar wing drive',(dock+6.65,side*1.15,0),(dock+6.65,side*1.65,0),.13,mat='tg-frame',segments=24)
  basis=[(1,0,0),(0,side,0),(0,0,side)]
  for j in range(4):
   a=1.65+j*1.75+.025;b=1.65+(j+1)*1.75-.025;center=(dock+6.65,side*(a+b)/2,0);m.box('Solar leaf rear',center,(2,b-a,.045),'dark',basis);m.box('Solar leaf cells',(center[0],center[1],-.027),(1.96,b-a-.04,.008),'tg-cells',basis,repeat=(1.5,1.5))
   for end in [a,b]:m.tube('Solar panel hinge',(center[0]-1,side*end,0),(center[0]+1,side*end,0),.023,mat='tg-frame',segments=8)
  for z in [-.65,.65]:m.engine((dock+8.2,side*.7,z),(dock+8.7,side*1.15,z),.12)
 for t in [0,math.pi]:
  y,z=math.cos(t),math.sin(t);m.tube('Service radiator edge',(dock+5.9,1.26*y,1.26*z),(dock+8.1,1.26*y,1.26*z),.025,mat='tg-grey',segments=10)
 m.tube('Orbital rendezvous antenna',(dock+1,0,-1.05),(dock+.85,0,-1.8),.025,mat='steel',segments=12)
 children=list(range(start,len(m.g['nodes'])));name='Atlas docked Shenzhou front'
 for i in children:m.g['nodes'][i]['name']=name+' / '+m.g['nodes'][i]['name']
 roots=m.g['scenes'][0]['nodes'];roots[:]=[i for i in roots if i not in children];roots.append(len(m.g['nodes']));m.g['nodes'].append({'name':name,'children':children,'extras':{'atlasDockedVisitor':True,'vehicle':'Shenzhou'}})
 return {'node':name,'name':'Shenzhou · composition visuelle','vehicle':'shenzhou','port':'front','variant':'shenzhou-8-10','visibility':'always','illustrative':True,'intervals':[],'body_length_m':9,'max_body_diameter_m':2.8,'source':'https://www.cnsa.gov.cn/english/n6465715/n6465717/c6840345/content.html'}
