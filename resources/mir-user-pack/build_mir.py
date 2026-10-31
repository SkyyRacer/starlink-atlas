#!/usr/bin/env python3
"""Atlas — original modular Mir reconstruction, 1996 complete configuration.

All geometry generated procedurally from primitives: no extracted third-party
3D model or textures. Geometries approximate, not aerospace engineering CAD.
Coordinates are metres; X core aft, Y Kvant-2, Z Priroda.
"""
from __future__ import annotations
import math, json, collections, os
from pathlib import Path
import numpy as np
import trimesh
from trimesh.transformations import rotation_matrix

OUT = Path(__file__).resolve().parent
LOW = os.environ.get('MIR_LOD', '').lower() in ('low', 'mobile', '1')
PALETTE = {
    'ceramic': [196,200,195,255],
    'ceramic_light': [231,227,207,255],
    'metal': [124,134,142,255],
    'metal_light': [173,181,185,255],
    'metal_dark': [76,85,97,255],
    'graphite': [29,36,47,255],
    'black': [20,26,32,255],
    'gold': [182,135,66,255],
    'gold_light': [220,180,91,255],
    'solar': [19,44,95,255],
    'solar_mid': [28,57,110,255],
    'solar_bright': [41,70,124,255],
    'grid': [130,157,182,255],
    'solar_frame': [89,104,117,255],
    'window': [29,44,66,255],
    'red': [159,49,44,255],
    'orange': [193,93,42,255],
    'white': [238,237,218,255],
    'foil': [174,159,137,255],
}

# Use compact scene: merge by module and material.
group = collections.defaultdict(list)
counts = collections.Counter()

def vec(p): return np.array(p, dtype=np.float64)

def push(name, mat, mesh):
    if mesh is None: return
    group[(name,mat)].append(mesh)
    counts[name] += len(mesh.faces)

def cyl(name, mat, a, b, rad, n=20, sections=1):
    a,b=vec(a),vec(b); d=b-a; l=np.linalg.norm(d)
    if l <= 1e-7: return
    mesh = trimesh.creation.cylinder(radius=rad, height=l, sections=n)
    mesh.apply_transform(trimesh.geometry.align_vectors([0,0,1],d/l))
    mesh.apply_translation((a+b)/2)
    push(name,mat,mesh)

def conical(name, mat, a, b, r0, r1, n=24):
    a,b=vec(a),vec(b); v=b-a; v/=np.linalg.norm(v)
    w=np.cross(v,[1,0,0]);
    if np.linalg.norm(w)<1e-5: w=np.cross(v,[0,1,0])
    w/=np.linalg.norm(w); t=np.cross(v,w)
    vertices=[]
    for ctr,r in ((a,r0),(b,r1)):
        for k in range(n):
            phi=2*np.pi*k/n
            vertices.append(ctr+r*(w*np.cos(phi)+t*np.sin(phi)))
    vertices.extend([a,b])
    faces=[]
    for k in range(n):
        j=(k+1)%n
        faces.extend([(k,j,n+j),(k,n+j,n+k), (2*n,j,k), (2*n+1,n+k,n+j)])
    push(name,mat,trimesh.Trimesh(vertices=vertices,faces=faces,process=False))

def box(name, mat, center, size):
    mesh=trimesh.creation.box(extents=np.array(size, dtype=float)); mesh.apply_translation(center);push(name,mat,mesh)

def sphere(name,mat,center,rad,subdiv=1,scale=(1,1,1)):
    mesh=trimesh.creation.icosphere(subdivisions=subdiv, radius=rad)
    mesh.apply_scale(scale); mesh.apply_translation(center);push(name,mat,mesh)

def axis_vec(axis):
    if isinstance(axis,(int,np.integer)) and axis==0: return vec([1,0,0])
    if isinstance(axis,(int,np.integer)) and axis==1: return vec([0,1,0])
    if isinstance(axis,(int,np.integer)) and axis==2: return vec([0,0,1])
    return vec(axis)

def ring(name, mat, center, axis, radius, tube=.10, steps=24):
    if LOW: steps=max(10, steps//2)
    c=vec(center);u=axis_vec(axis); u=u/np.linalg.norm(u)
    p=np.cross(u,[0,0,1]);
    if np.linalg.norm(p)<.001: p=np.cross(u,[0,1,0])
    p/=np.linalg.norm(p);q=np.cross(u,p)
    for i in range(steps):
        th=2*np.pi*i/steps; nxt=2*np.pi*(i+1)/steps
        cyl(name,mat,c+radius*(p*np.cos(th)+q*np.sin(th)),
            c+radius*(p*np.cos(nxt)+q*np.sin(nxt)),tube,6)

def pipe(name,mat,points,rad=.04, n=8):
    for a,b in zip(points[:-1],points[1:]): cyl(name,mat,a,b,rad,n)

def lathe_hull(name,mat,start,end,radii,axis=(1,0,0),sides=20):
    # radii defined by [(fraction, radius)...]
    a=vec(start);b=vec(end);d=b-a; u=d/np.linalg.norm(d)
    p=np.cross(u,[0,0,1]);
    if np.linalg.norm(p)<1e-5:p=np.cross(u,[0,1,0])
    p/=np.linalg.norm(p);q=np.cross(u,p)
    vertex=[]
    for t,r in radii:
        o=a+d*t
        for j in range(sides):
            phi=2*math.pi*j/sides;vertex.append(o+r*(p*np.cos(phi)+q*np.sin(phi)))
    faces=[]
    for i in range(len(radii)-1):
        for j in range(sides):
            jj=(j+1)%sides; aa=i*sides+j;ab=i*sides+jj;ba=(i+1)*sides+j;bb=(i+1)*sides+jj
            faces.extend([(aa,ab,bb),(aa,bb,ba)])
    v=len(vertex);vertex.extend([a,b])
    for j in range(sides):
        jj=(j+1)%sides; faces.append((v,jj,j));faces.append((v+1,(len(radii)-1)*sides+j,(len(radii)-1)*sides+jj))
    push(name,mat,trimesh.Trimesh(vertices=vertex,faces=faces,process=False))

def panel_mesh(center, span, width, thick):
    # oriented parallelepiped using arbitrary span and width axes
    c=vec(center);s=vec(span);w=vec(width)
    n=np.cross(s,w);n/=np.linalg.norm(n)
    points=[]
    for h in (-thick/2,thick/2):
        for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]:
            points.append(c+a*s/2+b*w/2+h*n)
    faces=[(0,2,1),(0,3,2),(4,5,6),(4,6,7),(0,1,5),(0,5,4),
           (1,2,6),(1,6,5),(2,3,7),(2,7,6),(3,0,4),(3,4,7)]
    return trimesh.Trimesh(vertices=points,faces=faces,process=False)

def panel(name,mat,center,span,width,thick): push(name,mat,panel_mesh(center,span,width,thick))

def solar_wing(name, root, along, breadth, distance, width=2.8, panels=5, twist=.0):
    root=vec(root); v=vec(along);v/=np.linalg.norm(v);w=vec(breadth);w-=v*np.dot(w,v);w/=np.linalg.norm(w)
    if abs(twist) >1e-6:
        r=rotation_matrix(twist,v)[:3,:3];w=r@w
    n=np.cross(v,w); n/=np.linalg.norm(n)
    # attachment support and boom
    cyl(name,'metal',root,root+v*.95,.085,9)
    for seg in range(panels):
        ss=distance/panels;center=root+v*(.9+(seg+.5)*ss)
        panel(name,'solar_frame',center,v*(ss-.045),w*width,.08)
        panel(name,'solar_mid',center+n*.046,v*(ss-.18),w*(width-.17),.018)
        panel(name,'solar',center-n*.046,v*(ss-.18),w*(width-.17),.012)
        # Many distinct photovoltaic cells on the visible face, and lighter grid
        nx=5;ny=3
        for j in range(0 if LOW else nx):
            for k in range(ny):
                xx=((j+.5)/nx-.5)*(ss-.24)
                yy=((k+.5)/ny-.5)*(width-.23)
                cell_center=center+n*.066+v*xx+w*yy
                cell_span=v*((ss-.25)/nx-.012);cell_width=w*((width-.24)/ny-.012)
                panel(name,'solar_bright' if (j*3+k+seg)%7==0 else 'solar',cell_center,cell_span,cell_width,.006)
        for offset in [-width/2, width/2]:
            cyl(name,'solar_frame',center-w*offset-v*(ss-.025)/2,
                center-w*offset+v*(ss-.025)/2,.027,6)
        if seg>0:
            cyl(name,'metal_light',center-w*width*.5-v*(ss/2),
                center+w*width*.5-v*(ss/2),.045,7)
    tip=root+v*(distance+.9)
    cyl(name,'metal_dark',root,tip,.043,8)
    # triangular root struts
    for sg in (-1,1):
        cyl(name,'metal_light',root+v*.25, root+v*(distance/panels+.9)+w*(sg*width*.45),.043,7)

def exterior_details(name,a,b,rad,colors=('metal_dark','metal_light'),windows=8):
    a=vec(a);b=vec(b);u=(b-a)/np.linalg.norm(b-a);v=np.cross(u,[0,0,1]);
    if np.linalg.norm(v)<.01:v=np.cross(u,[0,1,0])
    v/=np.linalg.norm(v);w=np.cross(u,v)
    length=np.linalg.norm(b-a)
    for f in ((.12,.5,.85) if LOW else (.12,.28,.5,.7,.85)):
        ring(name,'metal_light',a+(b-a)*f,u,rad+.03,.044,24)
    # structural strapped rectangular thermal blanket sections
    for j in range(18):
        th=2*math.pi*j/18
        surf=v*np.cos(th)+w*np.sin(th)
        p=a+(b-a)*(.2+.6*((j%4)/4)) +surf*(rad+.025)
        for delta in (-.13,.13):
            cyl(name,colors[j%2],p+u*delta-surf*.015,p+u*(delta+.10)-surf*.015,.03,6)
    for j in range(windows if not LOW else max(3,windows//2)):
        theta=2*math.pi*(j%8)/8
        pos=a+(b-a)*(.20 + .60*(j//8+.5)/max(1,math.ceil(windows/8))) + (v*math.cos(theta)+w*math.sin(theta))*(rad+.02)
        sphere(name,'window',pos,.16,subdiv=1,scale=(.65,.65,.22))
        sphere(name,'metal_light',pos+.04*(v*math.cos(theta)+w*math.sin(theta)),.08,subdiv=1)
    # rails alongside length
    for theta in (0,math.pi*.5,math.pi,math.pi*1.5):
        normal=v*np.cos(theta)+w*np.sin(theta)
        p1=a+u*.6+normal*(rad+.18);p2=b-u*.55+normal*(rad+.18)
        cyl(name,'metal_light',p1,p2,.033,6)
        for frac in [.14,.4,.66,.88]:
            x=p1+(p2-p1)*frac
            cyl(name,'metal_dark',x,x-normal*.17,.023,6)

def module_body(name,start,end,r=.98,style='ceramic',windows=9):
    start=vec(start);end=vec(end);d=end-start;u=d/np.linalg.norm(d)
    # variable radius, rounded endcaps and thermal wrap
    t=[(.0,r*.60),(.065,r*.81),(.15,r),(.80,r),(.91,r*.89),(1,r*.57)]
    lathe_hull(name,style,start,end,t,sides=28)
    exterior_details(name,start+u*(.1*np.linalg.norm(d)),end-u*(.1*np.linalg.norm(d)),r,windows=windows)
    for frac in (.03,.95):
        ring(name,'metal_dark',start+d*frac,u,r*.80,.09,26)
    # circular docking node at far end
    cyl(name,'metal_dark',end-u*.10,end+u*.25,r*.46,24)
    ring(name,'metal_light',end+u*.22,u,r*.46,.065,28)
    ring(name,'black',end+u*.26,u,r*.34,.045,28)

def dish(name, center, forward, radius=.55, offset=.22):
    c=vec(center);u=vec(forward);u/=np.linalg.norm(u)
    p=np.cross(u,[0,0,1]);
    if np.linalg.norm(p)<1e-5:p=np.cross(u,[0,1,0])
    p/=np.linalg.norm(p);q=np.cross(u,p)
    vertex=[];faces=[];N=24;M=5
    for i in range(M+1):
        r=radius*i/M
        depth=(r/radius)**2 * .2
        for j in range(N):
            th=2*math.pi*j/N
            vertex.append(c+r*(p*math.cos(th)+q*math.sin(th))+u*depth)
    for i in range(M):
        for j in range(N):
            k=(j+1)%N
            faces.extend([(i*N+j,i*N+k,(i+1)*N+k),(i*N+j,(i+1)*N+k,(i+1)*N+j)])
    push(name,'metal_light',trimesh.Trimesh(vertices=vertex,faces=faces,process=False))
    cyl(name,'metal_dark',c,c+u*(offset+.25),.026,8)
    sphere(name,'graphite',c+u*(offset+.25),.10,1)
    ring(name,'metal_dark',c+u*.20,u,radius,.023,24)

# Construction ----------------------------------------------------------------
# 1. Base / DOS-7, length 13.13 m, major diameter ~4.15 m
name='MIR_CORE_1986'
module_body(name,(-5.6,0,0),(6.7,0,0),r=1.96,style='ceramic_light',windows=13)
# Rear conical skirt and two tone base
conical(name,'metal_light',(4.3,0,0),(6.2,0,0),1.9,1.1,36)
cyl(name,'metal_dark',(4.25,0,0),(4.4,0,0),1.95,28)
# forward spherical five-port docking node
sphere(name,'metal_light',(-6.55,0,0),1.65,subdiv=2,scale=(.84,1,1))
for direction in [vec([-1,0,0]),vec([0,1,0]),vec([0,-1,0]),vec([0,0,1]),vec([0,0,-1])]:
    c=vec([-6.55,0,0])+direction*1.37
    cyl(name,'metal_dark',c,c+direction*.40,.71,24)
    ring(name,'metal_light',c+direction*.42,direction,.63,.07,24)
# core top radiator grids
for xi in np.linspace(-3.5,3.7,10):
    box(name,'foil',(xi,0,2.02),(.48,1.25,.075))
for x in (-3.2,1.5):
    dish(name,(x,1.8,1),(.2,.5,1),.5)
# central solar wing pairs mounted toward rear
solar_wing(name,(.9, 1.72, 0),(0,1,0),(1,0,0),9.0,2.9,panels=8,twist=.09)
solar_wing(name,(.9,-1.72, 0),(0,-1,0),(1,0,0),9.0,2.9,panels=8,twist=-.09)
# Core deployed additional array along Z at aft
solar_wing(name,(2.3,0,1.72),(0,0,1),(1,0,0),7.4,2.2,panels=7)

# 2. Kvant-1 1987 aft extension on +X axis
name='KVANT_1_1987'
module_body(name,(6.55,0,0),(12.0,0,0),1.71,'ceramic',windows=8)
conical(name,'metal',(11.0,0,0),(12.4,0,0),1.60,.9)
cyl(name,'metal_dark',(12,0,0),(12.8,0,0),.89,24)
ring(name,'metal_light',(12.8,0,0),0,.86,.10)
# long folding mounted solar panels
solar_wing(name,(9.4,0,1.4),(0,0,1),(1,0,0),10.5,2.9,9,twist=.055)
solar_wing(name,(9.4,0,-1.4),(0,0,-1),(1,0,0),10.5,2.9,9,twist=-.06)
# Sofia trusses, gyrodynes
for y in (-1.15,1.15):
    for z in (-.75,.75):
        sphere(name,'metal_dark',(10.5,y,z),.32,1)
# aft communication line booms
pipe(name,'metal_light',[(10,0,-1.5),(11.5,.6,-3.5),(12.5,.8,-4)],.04)
dish(name,(11.5,1.1,-2.0),(.6,0,-.6),.55)

# 3. Kvant-2 toward +Y
name='KVANT_2_1989'
module_body(name,(-6.55,1.2,0),(-6.55,14.8,0),1.66,'ceramic',windows=14)
# airlock beyond end, with hatch / handrails
cyl(name,'metal_dark',(-6.55,14.7,0),(-6.55,15.6,0),.93,28)
conical(name,'metal_light',(-6.55,15.6,0),(-6.55,16.2,0),.85,.54)
for offset in (-1,1):
    solar_wing(name,(-6.55,9.5,offset*1.45),(0,0,offset),(0,1,0),7.9,2.55,7)
dish(name,(-5.2,12.2,1.3),(1,0,1),.42)
# different thermal segments
for y in [4,5.4,8.2,11]:
    ring(name,'metal_dark',(-6.55,y,0),(0,1,0),1.70,.065)

# 4. Kristall toward -Z
name='KRISTALL_1990'
module_body(name,(-6.55,0,-1.3),(-6.55,0,-14.7),1.68,'ceramic_light',windows=12)
# dish on module surface
for j in (-1,1):
    solar_wing(name,(-6.55,j*1.52,-9.0),(0,j,0),(0,0,1),7.0,2.7,6,twist=.08*j)
for z in (-5,-11):
    ring(name,'metal_dark',(-6.55,0,z),(0,0,1),1.78,.11)
# APAS docking port
cyl(name,'metal_dark',(-6.55,0,-14.6),(-6.55,0,-15.05),.72,24)

# 5. Spektr toward -Y
name='SPEKTR_1995'
module_body(name,(-6.55,-1.3,0),(-6.55,-15.6,0),1.67,'ceramic',windows=12)
# major broad blue wings near far end
for sign in (-1,1):
    solar_wing(name,(-6.55,-11.3,sign*1.4),(0,0,sign),(0,1,0),11.0,3.0,9,twist=.02*sign)
for sign in (-1,1):
    solar_wing(name,(-6.55+sign*1.3,-8.5,0),(sign,0,0),(0,1,0),7.0,2.5,6)
# radiator and power distribution
box(name,'metal_dark',(-6.55,-9.7,1.75),(1.6,1.8,.24))

# 6. Shuttle docking module 1995 on end of Kristall
name='SHUTTLE_DOCKING_MODULE_1995'
cyl(name,'metal_dark',(-6.55,0,-15.1),(-6.55,0,-19.8),1.08,24)
for z in (-15.3,-15.8,-17,-18.7,-19.5):
    ring(name,'metal_light',(-6.55,0,z),(0,0,1),1.10,.08)
for x in [-7.45,-5.65]:
    for z in [-16.25,-18.7]:
        box(name,'foil',(x,0,z),(.23,1.1,.5))
cyl(name,'graphite',(-6.55,0,-19.72),(-6.55,0,-20.2),.70,24)
ring(name,'metal_light',(-6.55,0,-20.23),(0,0,1),.66,.085)

# 7. Priroda 1996 toward +Z (not large array wings)
name='PRIRODA_1996'
module_body(name,(-6.55,0,1.25),(-6.55,0,11.2),1.72,'ceramic_light',windows=10)
for z in (3.0,5.0,7.8,9.0):
    ring(name,'metal_dark',(-6.55,0,z),(0,0,1),1.76,.078)
for z in (5,8.6):
    for phi in (0,math.pi*.5,math.pi,1.5*math.pi):
        xx=-6.55+math.cos(phi)*1.65; yy=math.sin(phi)*1.65
        box(name,'foil',(xx,yy,z),(.25,.25,1.15))
dish(name,(-6.55,1.3,8.7),(0,1,1),.6)
dish(name,(-5.25,0,5.2),(1,1,0),.48)
# Priroda weather radar beam standoff
pipe(name,'metal', [(-6.5,0,10.5),(-6.1,.3,12.9),(-6.0,.6,13.6)],.07)
sphere(name,'white',(-6.0,.6,13.6),.4,2)

# 8. Other historical station external systems
name='MIR_TRUSSES_AND_ANTENNAE'
# Large docking/approach antennas attached to core aft
for sign in (-1,1):
    pipe(name,'metal_light',[(5,sign*1.2,.5),(7.0,sign*2.5,1.8),(8.3,sign*3.2,2.2)],.045)
    dish(name,(8.3,sign*3.2,2.2),(.5,sign,1),.45)
# S-shaped communication masts / handrails
for ang in (0,math.pi,math.pi*.5):
    y=math.cos(ang);z=math.sin(ang)
    pipe(name,'metal_light',[(3,1.9*y,1.9*z),(3.3,3.9*y,2.6*z),(4.0,4.6*y,4.2*z)],.05)
    sphere(name,'black',(4.0,4.6*y,4.2*z),.16,1)
# A few free-floating angled observational experiment platforms next to aft core
for sign in (-1,1):
    origin=vec([5.4,sign*1.1,-.9]); end=vec([7.6,sign*3.4,-2.6]);cyl(name,'metal',origin,end,.04,8)
    panel(name,'ceramic_light',end,[1.0,0,0],[0,sign*.85,.35],.05)

# Export scene. Preserve original coordinate system and meaningful node names.
scene=trimesh.Scene()
total=0
for (name,mat),meshes in sorted(group.items()):
    merged=trimesh.util.concatenate(meshes)
    merged.visual.face_colors=np.tile(np.array(PALETTE[mat],dtype=np.uint8),(len(merged.faces),1))
    total+=len(merged.faces)
    scene.add_geometry(merged,geom_name=f'{name}__{mat}',node_name=f'{name}__{mat}')

outfile=OUT/('mir_atlas_1996_mobile.glb' if LOW else 'mir_atlas_1996_complete.glb')
with outfile.open('wb') as f:
    f.write(trimesh.exchange.gltf.export_glb(scene,include_normals=True))

# JSON with metadata for Atlas and reuse tracking
meta={
 'name':'Mir — Atlas Complete 1996',
 'source_geometry':'Original procedural geometry; no third-party meshes or textures embedded',
 'description':'Reconstruction for realtime visualization, not metrological / CAD accuracy',
 'unit':'metre',
 'coordinate_system':'X core aft, Y Kvant-2, Z Priroda (before optional engine transform)',
 'configuration':'1996 after Priroda assembly; no visiting ships included',
 'components':[{ 'id':k,'triangles':int(v)} for k,v in counts.items()],
 'triangles':int(total),
 'bounds_m':scene.bounds.tolist(),
 'rights_note':'Original geometry created procedurally for this request, no third-party mesh or texture included. Historical configuration and dimensions are reference information. No guarantees of aerospace CAD fidelity.',
 'date':'2026-10-31',
 'variant':'mobile' if LOW else 'complete',
 'reference_sources':[
  'https://www.nasa.gov/history/SP-4225/diagrams/mir/mir-diagram.htm',
  'https://rdataspace.github.io/station_mir/mir-components.html',
  'https://science.nasa.gov/3d-resources/mir/',
 ]
}
(OUT/('mir_atlas_mobile_metadata.json' if LOW else 'mir_atlas_metadata.json')).write_text(json.dumps(meta,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'glb':str(outfile),'bytes':outfile.stat().st_size,'triangle_count':total,'bounds':meta['bounds_m'],'groups':len(group),'by_component':dict(counts)},indent=2))
