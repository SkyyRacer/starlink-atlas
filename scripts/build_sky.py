#!/usr/bin/env python3
"""NASA Deep Star Maps 2020 (8K celestial EXR) -> sharp Cesium skybox.
Usage: python3 scripts/build_sky.py /path/to/starmap_2020_8k.exr
Build dependencies: numpy, Pillow, OpenEXR. No Python dependency at runtime.
Source and credit: static/images/sky/README.md.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

FACES = ['positiveX','negativeX','positiveY','negativeY','positiveZ','negativeZ']

def equatorial_uv(directions):
    x, y, z = np.moveaxis(directions, -1, 0)
    ra = np.arctan2(y, x)
    dec = np.arctan2(z, np.hypot(x, y))
    # NASA celestial map: RA=0 at centre, RA increases to the left.
    return (.5 - ra / (2 * np.pi)) % 1, .5 - dec / np.pi

def face_directions(face, size):
    axis = 2 * (np.arange(size) + .5) / size - 1
    s, t = np.meshgrid(axis, axis)
    t = -t  # Cesium CubeMap uploads HTML images with flipY=true.
    one = np.ones_like(s)
    faces = {
        'positiveX': (one, -t, -s), 'negativeX': (-one, -t, s),
        'positiveY': (s, one, t), 'negativeY': (s, -one, -t),
        'positiveZ': (s, -t, one), 'negativeZ': (-s, -t, -one),
    }
    return np.stack(faces[face], axis=-1)

def srgb(linear):
    x = np.clip(linear * 1.3, 0, 1)
    return np.where(x <= .0031308, 12.92*x, 1.055*x**(1/2.4)-.055)

def build(source, output, size=2048):
    if source.suffix == '.npy':
        pixels = np.load(source, mmap_mode='r')
    else:
        import OpenEXR
        pixels = OpenEXR.File(str(source)).channels()['RGB'].pixels
    h, w, _ = pixels.shape
    if (w, h) != (8192, 4096):
        raise ValueError('The NASA 8K celestial source (8192 x 4096) is required.')
    output.mkdir(parents=True, exist_ok=True)
    for face in FACES:
        u, v = equatorial_uv(face_directions(face, size))
        x, y = u*w-.5, np.clip(v*h-.5, 0, h-1)
        x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
        dx, dy = (x-x0)[...,None], (y-y0)[...,None]
        x1, y1 = (x0+1)%w, np.minimum(y0+1,h-1)
        x0 %= w
        # Bilinear sampling in linear light, before display conversion.
        sample = (pixels[y0,x0].astype(np.float32)*(1-dx)+pixels[y0,x1].astype(np.float32)*dx)*(1-dy)+(pixels[y1,x0].astype(np.float32)*(1-dx)+pixels[y1,x1].astype(np.float32)*dx)*dy
        display = srgb(sample)
        luminance = display @ np.array([.2126, .7152, .0722])
        # Separate diffuse galactic light from stellar cores. Compact cores avoid
        # magnifying the broad stellar halos baked into the original survey.
        broad = np.asarray(Image.fromarray(np.uint8(np.clip(display*255,0,255))).filter(ImageFilter.GaussianBlur(5)), dtype=np.float32)/255
        background = np.maximum(broad-.018,0)*.20
        image = Image.fromarray(np.uint8(np.clip(background*255,0,255)))
        maxima = luminance > .16
        for dy in [-1,0,1]:
            for dx in [-1,0,1]:
                if dx or dy:
                    maxima &= luminance >= np.roll(np.roll(luminance,dy,axis=0),dx,axis=1)
        ys,xs = np.nonzero(maxima)
        draw = ImageDraw.Draw(image)
        for y,x in zip(ys,xs):
            # One compact core, with only the brightest stars spanning two pixels.
            color = tuple(np.uint8(np.clip(display[y,x]*.72*255,0,190)))
            draw.point((int(x),int(y)),fill=color)
            if luminance[y,x] > .8:
                dim = tuple(int(c*.20) for c in color)
                for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                    if 0<=x+dx<size and 0<=y+dy<size:
                        draw.point((int(x+dx),int(y+dy)),fill=dim)
        # High-quality WebP keeps stellar detail at a reasonable download size.
        path=output/f'nasa-2020-pinpoint-v5-{face}.webp'
        image.save(path, quality=95, method=6)
        print(path.name, path.stat().st_size, flush=True)

if __name__ == '__main__':
    build(Path(sys.argv[1]), Path(__file__).resolve().parents[1]/'static/images/sky')
