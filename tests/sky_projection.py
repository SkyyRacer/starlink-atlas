import importlib.util
from pathlib import Path
import numpy as np
from PIL import Image
spec=importlib.util.spec_from_file_location('sky',Path(__file__).resolve().parents[1]/'scripts/build_sky.py')
sky=importlib.util.module_from_spec(spec);spec.loader.exec_module(sky)
# NASA's documented equatorial orientation: RA=0 centre, RA increases left.
for direction, expected in [([1,0,0],(.5,.5)),([0,1,0],(.25,.5)),([0,-1,0],(.75,.5)),([0,0,1],(.5,0)),([0,0,-1],(.5,1))]:
 assert np.allclose(sky.equatorial_uv(np.array(direction)), expected)
# Consistent native Cesium cube axes: uploaded DOM images are flipped vertically.
a=sky.face_directions('positiveX',3)
assert a[-1,1,1]>0 and a[0,1,1]<0
assert np.allclose(a[1,1],[1,0,0])
assert np.all(np.isfinite(sky.srgb(np.array([0,.003,.1,1,10]))))
files=list((Path(__file__).resolve().parents[1]/'static/images/sky').glob('nasa-2020-light-v3-*.webp'))
assert len(files)==6
for p in files:
 with Image.open(p) as image: assert image.size==(1024,1024)
print('NASA sky: RA/declination axes, cube upload orientation, linear-to-sRGB and six lightweight 1K images OK.')
