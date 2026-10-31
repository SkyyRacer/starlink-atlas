# Ressources NASA Eyes intégrées localement — 27 octobre 2026

Source : https://eyes.nasa.gov/apps/solar-system/ et ses répertoires publics `https://eyes.nasa.gov/assets/static` / `https://eyes.nasa.gov/assets/dynamic`.

Le code de l’application Eyes n’est pas intégré. Les commandes de caméra sont une implémentation Atlas des principes observés : rotation amortie, zoom progressif sous le pointeur, déplacement latéral, commandes W/S/A/D/Q/E et ralentissement avec X ou Alt. Maj conserve le déplacement latéral demandé précédemment à la souris et accélère les commandes clavier.

## Modèles

Onze exports glTF ont été téléchargés avec leurs dépendances et regroupés en GLB autonomes. Géométrie, matériaux PBR, couleurs et textures restent ceux des fichiers sources. Les URL et empreintes de chaque dépendance sont conservées dans les dossiers `models/*/provenance.json`.

Sept nouveaux modèles sont proposés à la demande : New Horizons, Euclid, SOHO, ACE, Cassini, Juno et DSCOVR. Les versions détaillées déjà intégrées de Voyager, Webb, Kepler et Spitzer sont conservées ; les variantes Eyes restent des sources archivées. Les exports sont normalisés par le pipeline habituel `build_detailed_models.py`. Aucun modèle n’est téléchargé par le navigateur avant d’être nécessaire.

Les missions non présentes dans le registre Eyes examiné ne sont pas présentées comme récupérées. Les essais complémentaires documentés dans `additional-model-checks.json` ne constituent pas une preuve que ces objets n’existent nulle part ailleurs.

## Données de missions

`manifest.json` contient les 56 définitions publiques de trajectoires et d’orientations repérées, avec provenance et empreintes. Les pages binaires nécessaires aux extractions ont également été conservées sous `dynamo/`.

`import_eyes_ephemerides.py` décode les formats Dynamo position/orbite et leur arborescence, convertit le temps ET utilisé par Eyes vers UTC et compose les positions relatives dans le repère géocentrique ICRF. Les interpolations restent à l’intérieur des intervalles publiés. Les quaternions et autres données non utilisés ne sont pas présentés comme des mesures d’attitude intégrées.

Les échantillons ont été comparés aux archives Horizons du site. Cinq secours 2026 ont été retenus : JWST, Euclid, SOHO, ACE et DSCOVR, avec des écarts maximaux aux points de contrôle d’environ 1 500 à 2 200 km. Ils restent des secours approximatifs : Horizons est prioritaire. Les courbes Eyes de Voyager, New Horizons, Cassini et Juno divergeant davantage n’ont pas été activées ; Spitzer ne couvrait pas l’année testée. Les résultats, dates de couverture et exclusions sont dans `ephemeris-validation.json`.

Les fichiers utilisables sont sous `static/ephemerides/nasa-eyes/`. Une panne d’une source secondaire ne bloque pas l’affichage d’une autre mission dont les données sont déjà disponibles. Aucune extrapolation n’est ajoutée au-delà des couvertures.

## Ciel commun

Les six fichiers d’étoiles et le fichier de galaxies Eyes contiennent **43 878 objets**. Ils sont conservés dans `static/images/sky/nasa-eyes/`. `build_eyes_sky.py` convertit leur repère écliptique vers J2000 et produit une projection de 8192 × 4096, réutilisable par le moteur de ciel existant. Il s’agit du catalogue Eyes rasterisé, pas d’une capture de son interface ni d’une carte inventée. La carte sphérique optionnelle `starmap_*.jpg` d’Eyes n’était pas accessible ; elle n’est pas utilisée.

Le Soleil, sa position, ses rayons, ses occultations et ses reflets continuent d’être dessinés séparément par le matériau Atlas existant. Les choix d’activation du ciel propres aux pages sont conservés. Le fichier `projection.json` fournit l’orientation, la définition et l’empreinte de la carte générée.

## Reproduire

```sh
python3 scripts/import_nasa_eyes_assets.py --metadata resources/nasa-eyes/scene-missions.json
python3 scripts/import_eyes_ephemerides.py
python3 scripts/build_eyes_sky.py
python3 scripts/build_detailed_models.py
```

Le générateur de ciel nécessite Pillow. Les téléchargements sont réutilisés lorsque les fichiers existent ; les ressources de la scène examinée sont identifiées dans `scene-source.json`.
