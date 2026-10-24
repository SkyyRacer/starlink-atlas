"""Original illustrative wire drawings, with mission-specific silhouettes.
Not engineering CAD or measured deployment/attitude data. References and mapping
of variants to public catalogue identifiers live in science-model-sources.json.
"""
import math

def lines(factory,profile):
 s=factory()
 def ring(x,y,z,r,n=24):
  for i in range(n):
   a,b=2*math.pi*i/n,2*math.pi*(i+1)/n
   s.line((x+r*math.cos(a),y,z+r*math.sin(a)),(x+r*math.cos(b),y,z+r*math.sin(b)))
 def cone(y1,y2,r1,r2,n=16):
  ring(0,y1,0,r1,n);ring(0,y2,0,r2,n)
  for i in range(n):
   a=2*math.pi*i/n;s.line((r1*math.cos(a),y1,r1*math.sin(a)),(r2*math.cos(a),y2,r2*math.sin(a)))
 def sphere(r=12):
  for axis in range(3):
   for j in range(-2,3):
    q=j*r/3;rr=math.sqrt(r*r-q*q)
    for i in range(24):
     a,b=i*math.pi/12,(i+1)*math.pi/12
     p=[rr*math.cos(a),rr*math.sin(a),q];v=[rr*math.cos(b),rr*math.sin(b),q]
     s.line(p[axis:]+p[:axis],v[axis:]+v[:axis])
 def booms(span=45,count=4,y=0):
  for i in range(count):
   a=i*2*math.pi/count;s.line((0,y,0),(span*math.cos(a),y,span*math.sin(a)))
 def dish(r=25,y=15):
  for j in range(1,6):ring(0,y+(j/5)**2*6,0,r*j/5)
  for i in range(16):
   a=i*math.pi/8
   for j in range(5):
    t,u=j/5,(j+1)/5;s.line((r*t*math.cos(a),y+t*t*6,r*t*math.sin(a)),(r*u*math.cos(a),y+u*u*6,r*u*math.sin(a)))
  for i in range(3):
   a=i*2*math.pi/3;s.line((r*math.cos(a),y+6,r*math.sin(a)),(0,y+20,0))
 def telescope(r=8,y=-16,h=35):
  s.cylinder(0,y,0,r,h,20);s.cylinder(0,y+h-3,0,r+1,4,20);ring(0,y+h+1,0,r*.7)
 def paddles(count=4,radius=38,y=0):
  for i in range(count):
   start=len(s.lines);s.panel(12,y-5,0,radius-12,10)
   a=i*2*math.pi/count
   for edge in s.lines[start:]:
    for p in edge:p[0],p[2]=p[0]*math.cos(a)-p[2]*math.sin(a),p[0]*math.sin(a)+p[2]*math.cos(a)
   s.line((0,y,0),(12*math.cos(a),y,12*math.sin(a)))
 def station(generation):
  s.cylinder(0,-28,0,8,34,20);cone(6,12,8,5);s.cylinder(0,12,0,5,15,16);s.cylinder(0,27,0,3,5,12);s.cylinder(0,-34,0,4,6,12)
  s.wings(37,-4)
  if generation=='early':s.wings(28,19)
  else:
   s.panel(-7,-24,10,14,19)
   if generation=='double':s.cylinder(0,-39,0,3,5,12)
   if generation=='almaz':s.box(-3,-19,-12,6,9,5);s.cylinder(0,-25,0,10,3,20)
 if profile=='aditya-l1':
  s.box(-10,-12,-8,20,22,16);s.wings(43,-7);s.cylinder(0,10,0,5,17,16);s.box(-9,10,-7,7,9,6);s.line((0,-12,0),(0,-42,0))
 elif profile=='agile':
  s.box(-10,-11,-8,20,19,16);s.wings(35,-4);s.box(-8,8,-6,16,6,12);s.box(-12,14,-9,24,2,18)
 elif profile in ['alouette','isis']:
  if profile=='alouette':sphere(12)
  else:s.cylinder(0,-10,0,11,20,12);cone(10,17,11,6);cone(-17,-10,6,11)
  booms(47);s.line((0,-29,0),(0,29,0))
 elif profile.startswith('ariel'):
  k=int(profile[-1]);s.cylinder(0,-8,0,8 if k<3 else 11,16,12);booms(35,4 if k<3 else 6)
  if k<=4:
   paddles(4,35)
  else:s.cylinder(0,8,0,5,13,16)
  s.line((0,-30,0),(0,30,0))
 elif profile=='asca':
  s.cylinder(0,-22,0,7,35,8);s.wings(42,-17)
  for x,z in [(-3,-3),(3,-3),(-3,3),(3,3)]:s.cylinder(x,13,z,2.7,8,12)
 elif profile=='bepposax':
  s.cylinder(0,-14,0,11,24,8);s.wings(41,-8)
  for x,z in [(-5,-4),(5,-4),(-5,4),(5,4)]:s.cylinder(x,10,z,3,10,12)
  s.box(-14,-3,-5,4,10,10);s.box(10,-3,-5,4,10,10)
 elif profile=='dampe':
  s.box(-12,-14,-10,24,28,20);s.wings(43,-5);s.box(-14,14,-12,28,3,24)
  for y in range(-10,14,5):s.box(-10,y,-11,20,1,22)
 elif profile=='elektron':
  s.cylinder(0,-9,0,9,18,16);cone(9,15,9,3);cone(-15,-9,3,9);paddles(6,37);s.line((0,-32,0),(0,32,0))
 elif profile=='euve':
  s.box(-8,-22,-8,16,12,16);s.wings(40,-16)
  for x,z in [(-4,-4),(4,-4),(-4,4),(4,4)]:s.cylinder(x,-10,z,3.6,30 if x<0 else 25,16)
 elif profile=='exosat':
  s.box(-14,-11,-10,28,22,20);s.wings(43,-7)
  for x in [-7,7]:s.cylinder(x,11,-3,4.5,18,16)
  s.box(-9,11,3,18,7,8)
 elif profile=='galex':
  telescope(10,-18,35);s.cylinder(0,-25,0,12,7,8);s.wings(40,-20)
 elif profile=='goce':
  cone(-40,-28,2,8);s.cylinder(0,-28,0,8,56,6);cone(28,43,8,.1,6)
  for sign in [-1,1]:
   for z in [-5,5]:s.line((sign*6,-30,z),(sign*24,-38,z));s.line((sign*24,-38,z),(sign*6,30,z))
  for y in range(-24,28,7):s.line((-7,y,4),(7,y,4))
 elif profile=='grace-fo':
  cone(-24,24,9,5,6);s.box(-8,-16,6,16,34,1);s.cylinder(0,24,0,3,4,12)
 elif profile=='gravity-probe-b':
  telescope(9,-25,42);s.cylinder(0,-30,0,12,7,16);s.wings(41,-21);s.box(-4,17,-4,8,10,8)
 elif profile=='halosat':
  s.box(-10,-15,-5,20,30,10)
  for x in [-6,0,6]:s.cylinder(x,15,0,2.5,5,12)
  for x in [-10,10]:
   for y in range(-12,14,4):s.line((x,y,-5),(x,y,5))
 elif profile.startswith('heao'):
  if profile=='heao-2':telescope(10,-27,51);s.cylinder(0,-31,0,13,7,8);s.wings(40,-25)
  else:
   s.box(-13,-20,-10,26,40,20);s.wings(42,-10)
   for x in [-8,0,8]:s.box(x-3,20,-8,6,7,16)
   if profile=='heao-3':s.cylinder(0,27,0,8,9,16)
 elif profile=='hxmt':
  s.box(-12,-15,-10,24,25,20);s.wings(43,-9)
  for x,z in [(-6,-5),(0,-5),(6,-5),(-6,4),(0,4),(6,4)]:s.cylinder(x,10,z,2.6,17 if z<0 else 9,12)
 elif profile=='iras':
  telescope(11,-20,39);s.box(-12,-28,-12,24,8,24);s.panel(-16,-27,-13,32,52)
 elif profile=='iue':
  telescope(8,-18,32);s.cylinder(0,-26,0,12,8,8);s.wings(42,-21);s.cylinder(0,12,0,11,4,16)
 elif profile=='microscope':
  s.cylinder(0,-12,0,11,24,8);s.panel(-25,-17,0,14,34);s.panel(11,-17,0,14,34);s.box(-6,12,-6,12,4,12)
 elif profile.startswith('oao'):
  s.cylinder(0,-15,0,13,30,8);s.wings(44,-7)
  if profile=='oao-3':telescope(7,15,19)
  else:
   for x,z in [(-6,-5),(6,-5),(-6,5),(6,5)]:s.cylinder(x,15,z,4,7,12)
 elif profile=='ogo':
  s.box(-10,-10,-7,20,20,14);s.wings(34,-7);s.line((0,-10,0),(0,-45,0));s.box(-3,-47,-3,6,4,6)
  for x,z in [(-35,-22),(35,-22),(0,37)]:s.line((0,6,0),(x,6,z));s.box(x-2,4,z-2,4,4,4)
 elif profile in ['oso-early','oso-7','oso-8']:
  s.cylinder(0,-9,0,17,10,9);s.cylinder(0,1,0,5,14,12)
  if profile=='oso-8':s.box(-8,15,-6,16,17,12);s.wings(38,19)
  else:
   s.panel(-27,15,0,54,15);s.cylinder(0,16,4,4,17,12);booms(27,3,-6)
 elif profile=='proton':
  s.cylinder(0,-10,0,16,20,20);s.cylinder(0,10,0,13,3,16);paddles(4,43,-3);s.line((0,-23,0),(0,28,0));booms(23,4,10)
 elif profile=='rosat':
  telescope(10,-23,41);s.box(-13,-24,-12,26,12,24);s.wings(44,-17);s.cylinder(7,12,5,3,9,12)
 elif profile=='rxte':
  s.box(-14,-13,-11,28,26,22);s.wings(45,-8)
  for x in [-8,0,8]:s.box(x-3,13,-8,6,12,16)
  for x in [-5,5]:s.cylinder(x,-23,0,4,10,12)
 elif profile in ['salyut-1','salyut-4','salyut-6','almaz']:
  station({'salyut-1':'early','salyut-4':'middle','salyut-6':'double','almaz':'almaz'}[profile])
 elif profile=='san-marco':sphere(16);booms(20,4);s.line((0,-20,0),(0,20,0))
 elif profile.startswith('sas'):
  k=int(profile[-1]);s.cylinder(0,-10,0,10,20,8);s.wings(37,-5)
  if k==1:s.box(-10,10,-7,20,5,14)
  elif k==2:s.box(-7,10,-7,14,12,14)
  else:
   for x in [-5,5]:s.cylinder(x,10,0,4,17,12)
 elif profile=='spektr-r':
  s.cylinder(0,-15,0,8,20,12);s.wings(39,-10);dish(32,5)
 elif profile=='spektr-rg':
  s.box(-12,-22,-10,24,17,20);s.wings(44,-17)
  for x in [-7,7]:s.cylinder(x,-5,0,6,30,20);s.cylinder(x,25,0,6.8,3,20)
 elif profile in ['tiangong-1','tiangong-2']:
  s.cylinder(0,-23,0,8,27,20);cone(4,10,8,5);s.cylinder(0,10,0,5,16,16);s.cylinder(0,26,0,3,4,12);s.wings(46,-9)
  if profile=='tiangong-2':s.box(-3,-21,-11,6,10,4)
 else:raise ValueError('No reviewed silhouette: '+profile)
 # Comparable model scale irrespective of the spacecraft's physical dimensions.
 pts=[p for edge in s.lines for p in edge];lo=[min(p[i] for p in pts) for i in range(3)];hi=[max(p[i] for p in pts) for i in range(3)];span=max(hi[i]-lo[i] for i in range(3));center=[(lo[i]+hi[i])/2 for i in range(3)]
 return [[[round((p[i]-center[i])*100/span,4) for i in range(3)] for p in edge] for edge in s.lines]
