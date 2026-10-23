# Lune Atlas

Texture photographique 4K : NASA Scientific Visualization Studio / Ernie Wright,
CGI Moon Kit, mosaïque LRO WAC (2019), https://svs.gsfc.nasa.gov/4720/
Original : https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif
Conversion WebP qualité 92, résolution conservée 4096 × 2048. Surface sphérique,
pas un terrain avec relief géométrique local ; aucun voile atmosphérique lunaire.

Carte stylisée : même mosaïque recolorée bleu-gris, graticule 30°.
Noms et positions : UAI / USGS Gazetteer of Planetary Nomenclature,
https://planetarynames.wr.usgs.gov/Page/MOON/target
https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz
Sélection des mers, océans, lacs, marais, baies et grands cratères, plus quelques cratères remarquables.
Noms des grandes mers en français, cratères et autres régions selon la nomenclature UAI.
`map-names.webp` est un atlas de textes 2K partagé, précalculé avec
`scripts/build-lunar-map-labels.py`. `map-names.json` contient les positions UAI,
les empreintes et les rectangles de texture. Les textes sont posés sur 110 petites
surfaces sphériques réunies en un seul maillage : leurs UV sont locaux, réguliers,
sans singularité en longitude/latitude, y compris aux pôles et au méridien zéro.
La compression des attributs de ce maillage est désactivée pour conserver les
coordonnées fines des lettres. Aucun placement ni maillage n’est refait en tournant
la caméra. Les canaux de texture codent trois niveaux de zoom. Aucun numéro.
La légende est décochée à l’arrivée et activable en mode classique ou réaliste.
Sources récupérées le 21 octobre 2026.

Rayon : 1737,4 km, sans amplification. Position et orientation : Cesium Simon 1994 / IAU.
Phases à venir : Astronomy Engine (Don Cross, MIT), copie locale conservant sa licence,
https://github.com/cosinekitty/astronomy
Horaires affichés dans le fuseau local. Distance entre les centres, pour la date simulée.
Orbite indicative sur 27,321661 jours, positions échantillonnées dans un repère inertiel
puis orientées dans le repère terrestre à la date affichée. Ce n'est pas une trace au sol.
L’orbite est une ligne fixe, sans animation décorative.

Optimisation : l’orbite est désactivée par défaut. La couche des noms est chargée à son activation en vue lunaire et réutilisée entre les changements de mode. La texture photographique 4K ne se charge qu’en vue lunaire. Depuis la Terre, le nom de la Lune apparaît au survol ; le clic ouvre un bouton de déplacement, puis la fiche est affichée à l’arrivée.
