# Système solaire — version locale

Le site publié reste à la révision `9d2c3d3`. Ces nouvelles pages et leurs données ne sont pas publiées.

## Démarrer

Depuis le dépôt, `bash scripts/restart_local.sh` reconstruit et relance la version locale habituelle sur le port 3003. Python 3 est nécessaire pour le cache des nouvelles éphémérides. Une prévisualisation distincte est également ouverte sur http://127.0.0.1:3004/soleil/ pendant le développement.

## Données et précision

Le catalogue importé de JPL comporte le Soleil, les huit planètes et 456 lunes : Terre 1, Mars 2, Jupiter 115, Saturne 293, Uranus 29, Neptune 16. Les noms et identifiants viennent de la liste officielle des découvertes et du catalogue des corps majeurs de Horizons. Deux entrées n'ont pas d'identifiant Horizons associé : S/2009 S1 et S/2025 U1. Elles restent consultables dans la liste, sans position inventée. Daphnis dispose dans Horizons d’une trajectoire limitée aux observations de Cassini, se terminant le 16 janvier 2018 : elle n’est donc pas affichée à la date actuelle. Une autre lune peut ne pas disposer d'une trajectoire pour la date demandée : sa ligne l'indique.

Les positions et vitesses sont téléchargées depuis NASA/JPL Horizons au besoin, puis conservées dans `data/solar`. Une seule requête distante est autorisée à la fois, même avec plusieurs pages ouvertes. Les planètes utilisent des blocs de 32 jours à pas de six heures ; les lunes des blocs de quatre jours à pas de dix minutes. Interpolation Hermite à l'intérieur des bornes uniquement. Aucun calcul de position au-delà des éphémérides. Les données indisponibles ne sont pas remplacées par une orbite dessinée arbitrairement.

Le repère source est géocentrique ICRF, en kilomètres, avec instants UTC. Les positions sont soustraites en double précision avant leur conversion dans le repère d'affichage : la caméra reste proche du centre choisi même pour Neptune. Les rayons, aplatissements, pôles et rotations sont issus du noyau PCK IAU de NAIF. La Terre réutilise le repère terrestre de l'application. Les tailles des sphères ne sont pas amplifiées. Les petits points et leurs étiquettes servent seulement au repérage ; les lunes sans rayon publié ont un point, sans diamètre inventé.

Les anneaux principaux C/B/A de Saturne respectent les rayons du tableau NASA NSSDC. Les anneaux très ténus ne sont pas simulés. Le Soleil est auto-éclairé ; son commutateur d'ombres est désactivé. En haute résolution, son animation orange de surface/couronne est illustrative, inspirée d'imagerie solaire, sans prétention d'observation en direct ni de reproduction historique de l'activité solaire.

Les cartes Solar System Scope sont des assemblages et des traitements de sources observationnelles. Certaines zones non cartographiées sont complétées artistiquement. Elles représentent une surface de référence, et non une photographie à la date choisie. Les cartes détaillées disponibles atteignent 8192 pixels ; Vénus utilise une carte nuageuse de 4096 pixels, Uranus et Neptune 2048 pixels. La vue standard utilise des aperçus de 512 pixels. Les lunes sans carte locale ont une surface neutre, sans géographie inventée.

Les missions existantes réutilisent leurs archives ICRF annuelles et les bornes de validité déjà présentes dans Atlas. Les points sont à leur position et à leur taille de repère d'interface ; un clic ouvre leur page 3D à la date consultée. Une mission sans archive à cette date n'est pas affichée. La page Terre réutilise les positions du catalogue orbital local.

## Sources

- Découvertes et noms : https://ssd.jpl.nasa.gov/sats/discovery.html
- Rayons : https://ssd.jpl.nasa.gov/sats/phys_par/
- Éphémérides : https://ssd.jpl.nasa.gov/horizons/ ; API https://ssd-api.jpl.nasa.gov/doc/horizons.html
- Conditions d'utilisation de l'API : https://ssd-api.jpl.nasa.gov/doc/
- Pôles, rotations, rayons IAU : https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
- Anneaux : https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html
- Cartes : https://play.solarsystemscope.com/textures/ — CC BY 4.0, sources NASA et traitements Solar System Scope ; cartes réduites et animation dérivées dans Atlas. Attribution affichée dans les pages.

Les empreintes SHA-256 du catalogue source sont conservées dans `static/solar/catalog.json`. Les réponses Horizons mises en cache comportent leur URL de requête, leur empreinte et leur repère.

## Vérification

`tests/solar.cjs` vérifie les bornes, le repère, le catalogue, l'orthogonalité des axes IAU et les documents. `tests/solar-page.cjs` exécute les neuf pages avec les vrais constructeurs Cesium de matériaux et de géométries, un affichage et un réseau substitués : démarrage, haute résolution, ombres, recentrage, zoom, liste. Ce dernier test ne remplace pas une vérification visuelle sur GPU. Le lancement automatisé de Chrome est indisponible dans cet environnement ; aucune capture GPU n'est présentée comme validée.

## Réglages d’ouverture

La Lune et les planètes utilisent une vue réaliste permanente ; aucun commutateur ne permet de revenir à la carte stylisée sur ces pages. Le choix « Terre réaliste » reste disponible sur Terre/Atlas et agit uniquement sur la Terre. Les vues du Système solaire démarrent avec le ciel étoilé ; Atlas de base démarre sans étoiles. L’entrée Terre ouvre Atlas (`?view=earth`) avec la Terre réaliste, les étoiles et toutes les familles d’objets masquées. Les pages partagent les Actualités et le même composant Missions lointaines : catégories, recherche et navigation Tab/flèches/Entrée.

## Ouverture progressive

Le chargement d’entrée attend seulement la planète, la direction du Soleil, sa texture réaliste, le ciel et le premier rendu. Les lunes et missions se chargent ensuite en arrière-plan ; la caméra et la chronologie restent utilisables. Une source de lune lente ne bloque donc pas l’ouverture de Jupiter ou Saturne. Les blocs déjà présents dans le cache sont lus sans attendre le verrou réseau Horizons. Une seule requête distante reste autorisée à la fois ; aucune position n’est extrapolée.

Les tests `tests/solar-page.cjs` simulent des requêtes lunaires qui ne répondent jamais pour Jupiter et Saturne et vérifient que l’entrée se termine malgré cela. `tests/solar-cache.py` vérifie qu’un bloc présent est accessible même quand le verrou distant est occupé.

## Vues des missions lointaines

Le sélecteur des missions propose **Vue isolée** et **Vue système solaire**. La seconde réutilise le même moteur planétaire dans un cadre intégré, avec la chronologie de la page de mission comme horloge unique. Les planètes et la sonde sont montrées dans un repère héliocentrique ICRF à tailles et distances physiques ; leurs petits repères facilitent leur repérage. La caméra de cette vue conserve une orientation liée à l’écliptique lorsque la date change.

Les courbes d’orbite sont des coniques osculatrices à deux corps autour du Soleil, calculées sur l’état position/vitesse à la date consultée : elles servent uniquement aux orbites planétaires et restent des approximations. L’option d’orbite instantanée de la sonde est supprimée. Le trajet archivé provient des fichiers annuels Horizons de la mission ; chaque échantillon géocentrique est converti en héliocentrique avec la position solaire à son propre instant, jamais avec le Soleil de la date actuelle. Le vert montre uniquement le trajet effectué avant la date consultée. Les archives commençant près de la Terre portent un repère « Terre au départ » à sa position à l’époque du lancement. Aucun point n’est créé au-delà de la couverture. Une mission sans vecteur valide n’affiche aucun repère ; le message technique de position indisponible est supprimé.

Sur une page de planète, une sonde n’est affichée que si son vecteur est valide à la date consultée et si sa distance réelle à la planète est inférieure à deux rayons de Hill instantanés. Ce voisinage explicite inclut les sondes proches de L1/L2 terrestres ; il ne dépend pas de la projection à l’écran. La page du Soleil utilise un voisinage de 0,1 UA. La vue globale du Système solaire, elle, montre la mission sélectionnée où qu’elle se trouve dans les données disponibles. Les GM planétaires viennent du tableau NASA/JPL : https://ssd.jpl.nasa.gov/sats/phys_par/ ; GM solaire 132712440041,9394 km³/s².

## Éclairage et occultations

Les matériaux utilisent le vecteur réel allant du corps vers le Soleil à l’instant affiché, dans le même repère que sa rotation IAU. Le Soleil est auto-éclairé. La rotation de la caméra ne change pas la zone jour/nuit. Les occultations tiennent compte de la taille angulaire du Soleil et distinguent ombre totale, partielle et annulaire. Les quatre occultants documentés les plus pertinents sont retenus par surface. Leur rayon apparent est dérivé de la section projetée de l’ellipsoïde ; les zones de pénombre utilisent une approximation en disques. Les ombres des anneaux principaux de Saturne sur la planète et de la planète sur ses anneaux sont géométriques. Les atmosphères réfractives, le rougissement des éclipses et la diffusion multiple dans les anneaux ne sont pas simulés.

## Lunes détaillées au clic

Toutes les lunes restent d’abord des points. Le clic charge uniquement la carte de la lune demandée et sa forme ellipsoïdale documentée, avec une progression liée au transfert, au décodage et au rendu. Le retour sur une lune déjà chargée réutilise cette ressource. Les données restent à leurs dimensions physiques ; les cartes ne constituent pas un relief topographique détaillé.

`static/solar/moon-surfaces.json` répertorie **20 surfaces documentées**. La Lune utilise une mosaïque LRO de 4096 × 2048, Titan une mosaïque Cassini infrarouge de 5760 × 2880. Les autres mosaïques intégrées ont une définition de 1440 × 720 ; elles ne sont pas artificiellement agrandies ni présentées comme des levés haute résolution récents. Elles peuvent contenir des lacunes ou des traitements de couleur signalés dans leurs sources. Les lunes non couvertes par ce catalogue restent des points avec un message explicite ; aucune surface ni dimension n’est inventée.

Sources des mosaïques : https://space.jpl.nasa.gov/tmaps/ (NASA/JPL/Caltech/USGS, Voyager/Viking/Galileo), https://svs.gsfc.nasa.gov/4720/ (LRO), https://science.nasa.gov/resource/titan-mosaic-the-surface-under-the-haze/ (Cassini). Les URL, définitions et empreintes sont conservées par surface.

## Navigation et rendu du 27 octobre 2026

Les en-têtes partagent une hauteur de 36 px et la même typographie. Les deux onglets des missions occupent deux cellules égales. Les orbites planétaires sont actives à l’ouverture, nommées et cliquables : elles cadrent la planète ; un clic dans le vide rétablit le système complet. L’origine de calcul se déplace avec la planète cadrée pour conserver la précision lors des forts zooms. La sonde conserve un repère vert et un nom lisible ; son clic ouvre la vue isolée et son modèle détaillé disponible.

Les lunes disposent d’une sélection à 22 pixels CSS autour de leur point, corrigée pour l’échelle de l’affichage. Le cadrage est immédiat, avec une petite progression centrée pendant le chargement, puis un bouton de retour nommé d’après la planète. Une nouvelle sélection annule les effets d’un chargement précédent. Les consignes de manipulation 3D ne sont plus affichées.

Le Soleil utilise un bruit sphérique animé, sans couture UV, superposé à sa carte de surface. Le disque orange lumineux conserve un bord net : les protubérances et le halo extérieur ont été supprimés selon la référence fournie. Il s’agit d’une animation illustrative inspirée du rendu ultraviolet demandé, pas d’observations solaires à l’instant consulté.

## Courbes, zoom et noms

Les orbites et trajets du système solaire utilisent des segments natifs `LINES`, en double précision encodée, dans une scène exclusivement 3D. Ils n’utilisent plus les rubans de `PolylineCollection`, leurs raccords en biseau ni leur découpage terrestre de longitude. Les limites du champ de caméra coupent donc chaque segment indépendamment, sans prolonger artificiellement un raccord. Les coniques planétaires adaptent leur finesse au zoom (720 à 32768 segments).

La molette déplace la caméra suivant le rayon du pointeur, avec compensation latérale conservant la projection du point visé. Chaque planète possède une couleur propre, partagée par son orbite, son point et son unique nom placé au-dessus. Les collisions de noms sont recalculées à chaque zoom, rotation, changement de date et redimensionnement : priorité à la sonde observée, puis à la planète la plus distante de la caméra. Les noms écartés reviennent dès que leurs rectangles ne se chevauchent plus.

## Fiches des corps et sélection des lunes

Le clic sur une planète ou une lune cadre l’hémisphère éclairé à partir du vecteur réel corps→Soleil, puis ouvre une fiche réductible. Le clic dans le vide et la croix réduisent la fiche sans déplacer la caméra. Un double-clic dans le vide restaure le système solaire de la mission observée (ou la planète principale sur une page de planète). La fiche réduite permet de rouvrir les informations.

`import_solar_facts.py` complète le catalogue avec les tableaux officiels JPL des planètes, paramètres physiques des satellites et éléments moyens. Les masses non publiées restent absentes. Les diamètres sont moyens, comparés au diamètre moyen terrestre. La journée affichée est solaire moyenne, dérivée de la rotation sidérale et de l’année ; pour une lune, l’année se rapporte au Soleil et une ligne distincte donne son tour de la planète. Les périodes moyennes du tableau descriptif ne servent jamais à générer les positions. Les distances sont recalculées depuis les éphémérides de l’instant affiché.

Les sélections restent possibles sur la lune déjà cadrée après un échec, avec une tolérance de déplacement de clic de 5 pixels. Les téléchargements lunaires sont annulables, limités à 25 secondes avant proposition de réessai et les textures sont adaptées à la limite réelle du GPU. Une absence de carte détaillée est distinguée d’un échec de téléchargement. Le matériau solaire n’utilise plus le mot réservé GLSL `active`, incompatible avec certains navigateurs.

## Aller-retour entre vue isolée et système solaire

La vue intégrée conserve son emprise de mise en page lorsqu’elle est masquée (`visibility:hidden` plutôt qu’un retrait `display:none`). Un message d’activation suspend ou relance explicitement le rendu et force le redimensionnement Cesium après le retour. Une notification de disponibilité et l’observation de la taille de la vue couvrent aussi la fin de chargement et le redimensionnement de la fenêtre. La caméra et la chronologie sont préservées.

Le clic sur la sonde libère la capture du pointeur et efface le glissement avant de demander la vue isolée. Une restauration asynchrone de celle-ci ne peut plus la réactiver lorsque l’utilisateur a déjà rouvert le système solaire. Les tests simulent plusieurs cycles sur neuf missions, dont Gaia, et vérifient la réactivation de la vue intégrée et l’absence de glissement résiduel.

## Navigation et ressources Eyes

La vue système solaire utilise désormais un amortissement des mouvements de rotation, déplacement et zoom, indépendant de la fréquence d’affichage. La molette conserve l’ancrage sous le pointeur. W/S zooment, A/D tournent, Q/E inclinent ; X ou Alt ralentissent, Maj accélère le clavier et conserve le déplacement latéral à la souris. Masquer la vue ou recadrer un objet annule les mouvements résiduels. Les contrôles ne modifient jamais les positions physiques.

Les modèles, données de secours et le nouveau ciel NASA Eyes commun sont documentés dans `resources/nasa-eyes/README.md`. La fiche du télescope Webb porte le nom complet « James Webb Space Telescope (JWST) ».

Le fond étoilé précédent (`reference-starmap-8k.jpg`) est restauré à la demande de l’utilisateur. Le rendu du Soleil reste inchangé ; le catalogue Eyes est archivé mais ne sert plus au fond affiché.
