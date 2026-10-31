"""Deliver the original recreations as portable GLBs, in metres, for the user."""
from pathlib import Path
import shutil,json
from build_historical_stations import Model
from tiangong_one_surfaces import build
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'resources/atlas-reference-recreations';OUT.mkdir(exist_ok=True)
m=Model('tiangong-1');build(m);m.g['extras']={'atlasOriginalRecreation':{'key':'tiangong-1-standalone','reference':'https://sketchfab.com/3d-models/tiangong-1-686ce97cc8fe42f4afb5988df95fcc48','length_m':10.4,'max_body_diameter_m':3.35,'solar_arrays':2,'interpretation':'Original Atlas geometry and textures, public dimensions and reference appearance, no extracted asset data.'}};m.save(OUT/'tiangong-1.glb')
m=Model('tiangong-2');build(m);m.save(OUT/'tiangong-2.glb')
shutil.copyfile(ROOT/'resources/detailed-originals/tiangong-2-atlas.glb',OUT/'tiangong-2-shenzhou.glb')
shutil.copyfile(ROOT/'resources/detailed-originals/tiangong-atlas.glb',OUT/'tiangong.glb');shutil.copyfile(ROOT/'resources/detailed-originals/tiangong-1-atlas.glb',OUT/'tiangong-1-shenzhou.glb')
(OUT/'README.md').write_text('''# Reconstitutions GLB originales Atlas

- `tiangong.glb` : station actuelle en T, modules Tianhe/Wentian/Mengtian, six ailes, bras robotique, deux Shenzhou et un Tianzhou dans une composition fixe illustrative.
- `tiangong-1.glb` : laboratoire Tiangong-1 seul, aspect inspiré de la référence fournie.
- `tiangong-2.glb` et `tiangong-2-shenzhou.glb` : laboratoire Tiangong-2, seul ou amarré.
- `tiangong-1-shenzhou.glb` : même laboratoire avec Shenzhou amarré, conservé sur sa page Atlas.

Géométries et textures originales Atlas, CC BY 4.0, en mètres. Aucun fichier Sketchfab original n’a été extrait. Références visuelles : thaweverything, modèle 205e0d24d4994eb9a232abe728e10a0f ; tashtego, modèle 686ce97cc8fe42f4afb5988df95fcc48. Cotes principales issues des documents publics CNSA/CMSE/ESA. Les détails secondaires, les finitions, les poses et les amarrages sont interprétés. Le résultat ne prétend pas reproduire exactement leurs maillages, textures ou animations. Extérieurs uniquement ; articulations solaires intégrées pour Tiangong actuelle ; pas de reconstruction d’intérieur.

Sources et scripts de génération documentés dans `SOURCES.md`.
''');print('\n'.join(str(p) for p in OUT.glob('*.glb')))
