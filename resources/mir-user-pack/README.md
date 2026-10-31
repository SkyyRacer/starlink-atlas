# Mir 1996 — modèle 3D pour Atlas Satellite Observatory

## Livrables

- `mir_atlas_1996_complete.glb` : 107 632 triangles, environ 3 Mo ; GLB prêt à charger dans Three.js / Babylon.js / Blender.
- `mir_atlas_1996_mobile.glb` : 56 060 triangles, environ 1,5 Mo ; version allégée.
- `index.html` : visionneuse 3D (Three.js) avec rotation, sélection des modules et choix de la qualité.
- `mir_atlas_preview.png` et `mir_atlas_preview_2.png` : aperçus fixes.
- `build_mir.py` : générateur intégral de géométrie originale (Python, numpy, trimesh).
- `render_preview.py` : script de rendu des aperçus (VTK).
- `mir_atlas_metadata.json` et `mir_atlas_mobile_metadata.json` : statistiques et métadonnées.

## Lancer la visionneuse

Sur un ordinateur disposant de Python, ouvrir un terminal dans ce dossier :

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000` dans le navigateur. Une connexion internet est nécessaire pour télécharger Three.js via CDN (ou remplacer les dépendances CDN par une installation locale).

## Intégration à Atlas / Three.js

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const loader = new GLTFLoader();
loader.load('/models/mir_atlas_1996_complete.glb', (gltf) => {
  const mir = gltf.scene;
  mir.scale.setScalar(1); // unités du modèle : mètres
  scene.add(mir);
});
```

**Système d'axes interne :** X : axe principal de Mir vers Kvant-1, Y : vers Kvant-2, Z : vers Priroda. La position de la station spatiale dans la scène doit être pilotée séparément par les données orbitales. Le modèle ne fournit pas de coordonnées orbitales ou d'orientation historique d'attitude.

**Sélection des modules :** les noms de nœuds commencent par `MIR_CORE_1986`, `KVANT_1_1987`, `KVANT_2_1989`, `KRISTALL_1990`, `SPEKTR_1995`, `SHUTTLE_DOCKING_MODULE_1995`, `PRIRODA_1996` et `MIR_TRUSSES_AND_ANTENNAE`.

## Historique et limites

La station représentée correspond schématiquement à sa configuration achevée en 1996, après l'installation de Priroda. Les modules de base, les radiateurs, les ailes solaires, les antennes et le docking module sont présents. Les vaisseaux visiteurs Soyouz, Progress et Shuttle ne sont **pas** intégrés, car ils changeaient selon les missions.

Les dimensions générales et les orientations des modules s'appuient sur les schémas historiques cités ci-dessous. Les proportions des accessoires, le positionnement exact des panneaux et les détails externes sont **approximatifs**. Ce modèle est destiné à une visualisation pédagogique ou artistique dans Atlas, **pas** à une restitution photoréaliste ni à une validation d'ingénierie.

## Droits et provenance

Toutes les géométries ont été **créées ici procéduralement** : aucun fichier 3D ou texture de NASA, CGTrader, Sketchfab ou Celestia n'a été téléchargé, copié ou incorporé. Il ne s'agit donc pas d'un assemblage de modèles tiers. Aucune attribution d'un auteur de modèle 3D tiers n'est requise pour ce GLB, mais le crédit des sources historiques est recommandé.

Sources historiques utilisées :

- NASA, schémas des modules Mir : https://www.nasa.gov/history/SP-4225/diagrams/mir/mir-diagram.htm
- Mir Station — assemblage : https://rdataspace.github.io/station_mir/mir-components.html
- NASA, ressource 3D de Mir : https://science.nasa.gov/3d-resources/mir/

## Pour augmenter le photoréalisme

1. Remplacer la géométrie de chaque module par un asset haute précision dont les droits permettent le web public.
2. Refaire les matériaux PBR (textures métal, normal maps, roughness, panneaux solaires).
3. Ajouter des decals et antennes spécifiques ainsi qu'une configuration historiquement correcte à une date donnée.
4. Ajouter les vaisseaux amarrés via des assets distincts, datés et sourcés.
