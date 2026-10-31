"""Single-axis lab solar drives. Original world-baked meshes remain unchanged
in bind pose; only the array hierarchy is articulated at its real root pivot.
The control-centre patent CN119440107A describes the preceding Tiangong labs
as using single-degree continuous Sun pointing. No historical motor telemetry.
"""
def single_axis(m,first,name,pivot,side):
 normal=[0,0,-1];base=[0,0,-1,0,-side,0,0,0,0,side,0,0,*pivot,1]
 inverse=[base[i*4+j] if i<3 and j<3 else 0 for j in range(4) for i in range(4)];inverse[15]=1
 for i in range(3):inverse[12+i]=-sum(inverse[k*4+i]*pivot[k] for k in range(3))
 roots=m.g['scenes'][0]['nodes'];children=[i for i in roots if i>=first];roots[:]=[i for i in roots if i not in children]
 cancel=len(m.g['nodes']);m.g['nodes'].append({'name':name+' bind geometry','matrix':inverse,'children':children})
 joint=len(m.g['nodes']);m.g['nodes'].append({'name':name,'matrix':base,'children':[cancel]});roots.append(joint)
 if not hasattr(m,'solar_rig'):m.solar_rig=[]
 m.solar_rig.append({'name':name,'kind':'beta','body_from_joint':base,'base_matrix':base,'normal_body':normal})
