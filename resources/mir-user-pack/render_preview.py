import vtk
from vtk.util.numpy_support import numpy_to_vtk, numpy_to_vtkIdTypeArray
import trimesh, numpy as np, os
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
p=Path(__file__).resolve().parent
scene=trimesh.load(p/'mir_atlas_1996_complete.glb',force='scene')
print('verify groups:',len(scene.geometry),'triangles:',sum(len(g.faces) for g in scene.geometry.values()))
print('bounds:',scene.bounds)

render=vtk.vtkRenderer();render.SetBackground(.022,.034,.065)
window=vtk.vtkRenderWindow();window.SetOffScreenRendering(1);window.SetSize(1600,1050);window.SetMultiSamples(4);window.AddRenderer(render)
for name, mesh in scene.geometry.items():
    pts=vtk.vtkPoints();pts.SetData(numpy_to_vtk(mesh.vertices.astype(np.float32),deep=True))
    cell=vtk.vtkCellArray()
    arrays=np.hstack((np.full((len(mesh.faces),1),3,dtype=np.int64),mesh.faces.astype(np.int64))).flatten()
    cell.SetCells(len(mesh.faces),numpy_to_vtkIdTypeArray(arrays,deep=True))
    poly=vtk.vtkPolyData();poly.SetPoints(pts);poly.SetPolys(cell)
    norm=vtk.vtkPolyDataNormals();norm.SetInputData(poly);norm.SplittingOff();norm.ConsistencyOn();norm.Update()
    mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(norm.GetOutputPort())
    actor=vtk.vtkActor();actor.SetMapper(mapper)
    r,g,b,a=np.array(mesh.visual.face_colors)[0,:4]/255
    actor.GetProperty().SetColor(float(r),float(g),float(b));actor.GetProperty().SetAmbient(.27);actor.GetProperty().SetDiffuse(.68)
    actor.GetProperty().SetSpecular(.13);actor.GetProperty().SetSpecularPower(20)
    render.AddActor(actor)
# lights
for pos,intensity in [((60,40,100),.8),((-40,-20,25),.42)]:
    light=vtk.vtkLight();light.SetPosition(*pos);light.SetFocalPoint(0,0,0);light.SetIntensity(intensity);render.AddLight(light)

def save_camera(name,pos,up):
    camera=render.GetActiveCamera()
    camera.SetFocalPoint(-3,0,0);camera.SetPosition(*pos);camera.SetViewUp(*up)
    camera.ParallelProjectionOn();camera.SetParallelScale(24);render.ResetCameraClippingRange()
    window.Render(); filt=vtk.vtkWindowToImageFilter();filt.SetInput(window);filt.SetInputBufferTypeToRGB();filt.ReadFrontBufferOff();filt.Update()
    writer=vtk.vtkPNGWriter();writer.SetFileName(str(p/name));writer.SetInputConnection(filt.GetOutputPort());writer.Write()
    # add typography outside of mesh
    image=Image.open(p/name).convert('RGB'); draw=ImageDraw.Draw(image)
    font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    font_path_b='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    try:
        f1=ImageFont.truetype(font_path_b,45);f2=ImageFont.truetype(font_path,19)
    except: f1=f2=ImageFont.load_default()
    draw.text((70,55),'MIR / 1996',font=f1,fill=(241,244,249))
    draw.text((72,115),'ATLAS SATELLITE OBSERVATORY  •  3D RECONSTRUCTION',font=f2,fill=(153,172,196))
    draw.text((72,980),'Conceptual reconstruction — geometry and dimensions approximated',font=f2,fill=(151,167,184))
    image.save(p/name,optimize=True)

save_camera('mir_atlas_preview.png',(51,-71,53),(0,0,1))
save_camera('mir_atlas_preview_2.png',(37,59,66),(0,0,1))
print('previews ready')
