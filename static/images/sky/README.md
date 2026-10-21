> Option « Ciel étoilé », désactivée par défaut. Textures chargées à la première activation et conservées pour les activations suivantes. Halo solaire discret (glowFactor=1.1), bloom désactivé.

# Ciel NASA — Deep Star Maps 2020

Source officielle : https://svs.gsfc.nasa.gov/4851/
Crédit : NASA/Goddard Space Flight Center Scientific Visualization Studio, Ernie Wright.
Carte issue des catalogues Hipparcos-2, Tycho-2 et Gaia DR2 (et compléments documentés par la NASA).

Source téléchargée : starmap_2020_8k.exr (8192 × 4096, HDR linéaire, coordonnées célestes ICRF/J2000).
https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_8k.exr

Adaptation Atlas avec scripts/build_sky.py : reprojection en six faces cubiques 1024², échantillonnage bilinéaire en lumière linéaire, exposition ×1,3, conversion sRGB, luminosité réduite à 60 % et compression WebP qualité 80. Pas de flou ajouté, ni de remplacement par une miniature. Les positions et les couleurs relatives proviennent de la carte NASA.

La prévisualisation ESA/Gaia EDR3 2000 × 1000 précédemment utilisée a été retirée.

Le SkyBox natif Cesium oriente le fond dans les axes TEME à la date consultée. L’écart de précession ICRF/J2000–TEME n’est pas corrigé : fond astronomique de visualisation, non outil de pointage astrométrique.
https://cesium.com/learn/cesiumjs/ref-doc/SkyBox.html

Le Soleil est explicitement créé avec Cesium.Sun (le moteur n’en crée pas lorsque skyBox=false). Sa direction dépend de la date de la scène. Il peut être hors champ ou occulté par la Terre ; aucun faux Soleil n’est collé à un coin de l’écran.

Conditions de réutilisation NASA SVS : https://svs.gsfc.nasa.gov/help/
Aucun logo NASA utilisé, ni aucune approbation de l’application par la NASA suggérée.

Profil léger : environ 334 ko pour les six faces, contre 8 Mo pour le précédent profil 2048² / qualité 95. La résolution et la mémoire GPU des faces sont divisées par quatre. Le halo natif du Soleil est renforcé (glowFactor=2) et son bloom activé.

## Révision clean-v4

Six faces 2048², WebP qualité 90, environ 2,15 Mo au total. Atténuation progressive des étoiles faibles pour réduire le grain, conservation des positions et couleurs de la carte NASA. Fond sombre et Voie lactée discrète. Chargement à la demande uniquement. Remplace le profil light-v3 décrit ci-dessus. Soleil natif avec halo 1,1 et bloom désactivé.

## Révision pinpoint-v5

Séparation du fond galactique diffus et des maxima stellaires de la carte NASA. Les étoiles sont représentées par des noyaux compacts (un pixel, léger voisinage pour les plus brillantes) pour éviter les disques flous grossis. Fond diffus atténué, faces 2048², WebP qualité 95. Projection céleste et caméra terrestre conservées. Stylisation de la taille et de la luminosité, pas une reproduction photométrique.

## Rendu de référence

Texture active : reference-starmap-8k.jpg, copie sans retouche de https://satellitemap.space/images/starmap-4k.jpg (8192 × 4096, téléchargée le 21 octobre 2026). Les anciennes faces cubiques ne sont plus utilisées. Projection céleste indépendante de 68° vertical, luminosité ×0,9, comme les paramètres du site de référence. Implémentation Atlas indépendante dans sky.js, Soleil dessiné dans la même projection à partir de la direction solaire Cesium. Texture chargée uniquement à activation.

## Alignement astronomique

Le ciel et le Soleil utilisent désormais la projection native de la caméra terrestre (remplace le cadrage indépendant 68°), afin de coïncider avec la Lune native Cesium. Positions et illumination Simon 1994 selon la date simulée. Rayon solaire 695 700 km et rayon lunaire Cesium sans amplification. Positions calculées, non exactitude astronomique absolue ; flares artistiques et occultation terrestre du flare approximée par une sphère.
