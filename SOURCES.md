# Recherche des sources — 12 octobre 2026

| Besoin | Source choisie | Disponibilité / limite |
|---|---|---|
| Éléments orbitaux actuels | [CelesTrak GP JSON Starlink](https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json) | Sans compte ; objets disposant d’éléments publiés, pas tous les objets lancés |
| Catalogue, dates, désorbitation | [SATCAT JSON par nom](https://celestrak.org/satcat/records.php?NAME=STARLINK&FORMAT=JSON), [schéma](https://celestrak.org/satcat/satcat-format.php) | Recherche par nom, incluant les objets désorbités ; exhaustivité et dates non garanties |
| Éléments historiques officiels | [Space-Track GP_HISTORY](https://www.space-track.org/documentation), [archives CelesTrak](https://celestrak.org/NORAD/archives/request.php) | Compte/conditions ou demande d’archives ; pas de récupération massive automatique dans ce projet |
| Orbites opérateur alternatives | [CelesTrak SupGP](https://celestrak.org/NORAD/elements/supplemental/) | Éléments ajustés à partir de données opérateur ; intégrés depuis le 13 octobre 2026 ; identité NORAD + nom + identifiant international recoupée avec SATCAT |
| Cartographie | [OSM](https://www.openstreetmap.org/copyright) | ODbL avec attribution ; données ouvertes mais service de tuiles limité |

## Choix et précautions

[Les formats GP modernes](https://celestrak.org/NORAD/documentation/gp-data-formats.php) évitent les limitations des numéros TLE à cinq chiffres. Le projet emploie des identifiants entiers u64 et JSON OMM. La liste courante n’est pas un historique ni une preuve d’état opérationnel.

SATCAT expose un code opérationnel actuel, une date de lancement et, si renseignée, une date de désorbitation. Il ne fournit pas une chronologie certaine de pannes Starlink. Une rentrée atmosphérique ne permet pas de dater la fin du service. Les fiches montrent ce code comme information actuelle uniquement ; les filtres historiques utilisent la présence en orbite et les dates de vie. Le lancement est groupé par les huit premiers caractères de l’identifiant international. Aucun nom commercial de mission n’est déduit sans table vérifiée.

[La politique CelesTrak](https://celestrak.org/usage-policy.php) demande une collecte adaptée aux mises à jour, un cache partagé et l’arrêt des clients automatiques après une réponse HTTP non-200. Le serveur respecte deux heures entre tentatives GP, garde les données sur disque et exige une intervention après erreur. SATCAT est récupéré au plus quotidiennement. Ne pas multiplier les instances.

Space-Track fournit GP_HISTORY avec des règles particulières pour les grands volumes : préférer les archives annuelles proposées par le fournisseur, stocker les historiques déjà obtenus, respecter les conditions de compte et de redistribution. L’application accepte les imports officiels locaux et les archives publiques dérivées décrites ci-dessous, sans stocker d’identifiants Space-Track.

## Précision

[SGP4 2.4](https://docs.rs/sgp4/2.4.0/sgp4/) propage les éléments moyens ; ce n’est pas de la télémétrie. Position/vitesse TEME sont converties avec un angle sidéral GMST approximatif en longitude et latitude géodésiques WGS84. UT1, mouvement polaire et corrections d’orientation terrestre précises ne sont pas inclus. SGP4, la traînée, les manœuvres, l’âge des éléments et les erreurs d’identification peuvent dégrader les positions ; aucune erreur maximale en kilomètres n’est annoncée.

La fenêtre ±72 h est une barrière produit, pas une certification scientifique. Un élément récent peut être mauvais après une manœuvre. Pour les usages de navigation, sécurité ou collision : employer des éphémérides et incertitudes opérateur adaptées. L’ombre terrestre est calculée par une approximation de la position solaire et une séparation jour/nuit géométrique ; elle n’indique pas l’éclipse du satellite.

## Droits et disponibilité

[Politique des tuiles OSM](https://operations.osmfoundation.org/policies/tiles/) : attribution permanente, Referer valide, cache navigateur normal, pas de préchargement massif ni carte hors ligne. Service sans garantie de disponibilité. Pour une charge importante, prévoir un fournisseur approprié ou ses propres tuiles.

Les bibliothèques libres n’impliquent pas que les services ou toutes les données soient libres de toute obligation. Aucun engagement de disponibilité ininterrompue ni licence générale de redistribution CelesTrak/Space-Track n’a été établi. Vérifier les conditions applicables avant de publier des archives ou de commercialiser le service. Les sources restent citées dans l’application et leur date de collecte est visible.

## Archive dérivée ajoutée

[Space-Track TLE History, Julien Simon](https://huggingface.co/datasets/juliensimon/space-track-tle-history) : archive Parquet publique, licence déclarée CC BY 4.0, provenance Space-Track. Révision épinglée et compte rendu dans data/history/manifest.json. Les importations conservent une observation réelle par satellite/jour disponible ; certains champs float32 réduisent la précision. Les limites des fichiers annuels sont mesurées, les trous ne sont pas comblés artificiellement. Détails dans HISTORIQUE.md.

Pour les prototypes, catalogue complémentaire [CelesTrak SATCAT : TINTIN](https://celestrak.org/satcat/records.php?NAME=TINTIN&FORMAT=JSON), consulté le 12 octobre 2026. Les métadonnées originales sont conservées dans resources/prototypes-catalog.json (champ SOURCE_NAME pour le nom non préfixé).

Affichage local : les instants UTC sont convertis avec Date/Intl selon le navigateur et le décalage de la date concernée (été/hiver), documentation https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset. Les jours SATCAT sans heure ne constituent pas des instants convertibles : précision indiquée dans la fiche.


## Sources supplémentaires intégrées le 13 octobre 2026

- CelesTrak SupGP, entrée **SpaceX-E**, JSON OMM : https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?SOURCE=SpaceX-E&FORMAT=JSON. Dérivé des éphémérides publiques SpaceX (https://api.starlink.com/public-files/ephemerides/MANIFEST.txt). Ce sont deux étapes d’une même provenance opérateur, pas deux observations indépendantes. 11 154 entrées reçues, 11 101 recoupées ; 53 entrées écartées pour identité absente ou discordante. La source est affichée dans chaque fiche et la date de réception dans Sources & fiabilité.
- GCAT / Jonathan McDowell : https://planet4589.org/space/gcat/tsv/derived/launchlog.tsv, CC BY 4.0, attribution https://planet4589.org/space/gcat/. 12 196 satellites recoupés par pièce internationale, nom normalisé et jour de lancement identique à SATCAT. Les heures publiées sans marque d’incertitude et noms de lancement enrichissent la fiche. Les jours UTC seuls restent des jours ; aucune heure n’est inventée. La limite de présence en orbite emploie l’heure enrichie.
- Archive Julien Simon / Space-Track déjà importée : historique GP quotidien. Elle reste distincte des sources opérateur ; la copie publique ne constitue pas une mesure indépendante de Space-Track.
- Archives ciblées CelesTrak : https://celestrak.org/NORAD/archives/request.php?FORMAT=json-pretty. Accès par demande et livraison par courriel, pas une API anonyme de téléchargement massif. Lien disponible dans l’interface ; aucune demande envoyée automatiquement. Les JSON OMM reçus peuvent être importés par la commande existante --import.
- Archive Starlink Fleet examinée : https://huggingface.co/datasets/juliensimon/starlink-fleet-data, révision 6680e701c5e4ff16aeeba54534bffd813a669af2. tle_snapshots.parquet ne contient ni anomalie moyenne, ni argument du périgée, ni BSTAR ; elle ne permet pas une reconstruction SGP4 complète et est exclue des positions. Le dataset quotidien agrégé n’est pas une éphéméride individuelle.

SupGP est ajusté vers l’avenir selon la documentation CelesTrak : aucune utilisation avant son époque, limite conservatrice de 24 heures après. GP garde sa fenêtre ±72 h. Le jeu valide dont l’époque est la plus proche est utilisé ; aucun mélange de paramètres ni interpolation entre fournisseurs. Trajectoires et point utilisent le même jeu, les tronçons hors validité sont omis. Ces fenêtres sont des règles du produit, pas une garantie de précision.

Collecte SupGP toutes les deux heures au maximum, GCAT une fois par jour ; fichiers de tentative et d’erreur séparés. Une erreur d’une source supplémentaire arrête sa collecte sans supprimer le cache ni arrêter les autres. Les téléchargements sont validés avant remplacement. OFFLINE=1 interdit toutes les collectes. Les deux nouveaux caches se trouvent dans data/ et sont exclus de l’archive de code source.

Limite vérifiée : aucune observation historique pour NORAD 100753 le 21 septembre 2026 dans le cache disponible. L’ajout des sources actuelles ne comble pas ce trou. La fiche explique désormais ce manque plutôt que de laisser croire que la date de lancement suffit.

Fond mondial à faible zoom : Natural Earth II, textures locales distribuées avec Cesium, domaine public. https://www.naturalearthdata.com/about/terms-of-use/ . Reprojection en Web Mercator au chargement ; OSM conservé aux niveaux de détail supérieurs.

Moteur navigateur : même code orbital Rust que le serveur, compilé en WebAssembly. Les archives historiques initiales sont accessibles à la demande depuis le dépôt GitHub public à une révision immuable. Les observations collectées ultérieurement conservent leur source et leurs limites de validité, avec échantillonnage quotidien.


## ISS · Station spatiale internationale

L’objet NORAD **25544**, identifiant international **1998-067A**, est récupéré via [CelesTrak GP JSON](https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=JSON), avec les métadonnées [SATCAT](https://celestrak.org/satcat/records.php?CATNR=25544&FORMAT=JSON). Le jour de lancement correspond au premier module Zarya, et non à une station assemblée en un seul vol. Aucun horaire absent n’est inventé.

Collecte indépendante toutes les deux heures au minimum ; métadonnées au plus une fois par jour. Une erreur conserve les caches validés et bloque la source jusqu’à intervention, comme les autres sources. La source n’est pas interrogée par chaque visiteur : le calcul Rust/SGP4 utilise l’édition chargée à l’ouverture.

Les archives ISS quotidiennes commencent avec cette intégration. Les archives Starlink préexistantes ne contiennent pas l’ISS. Les positions ne sont calculées que dans la fenêtre de validité des éléments disponibles (±72 h pour GP), sans recréer les années manquantes. Ce seuil ne garantit pas la précision ; les rehaussements d’orbite peuvent produire des écarts.

Le dessin 2D et le modèle GLB blanc sont des créations schématiques originales du projet, sous sa licence MIT, générées par `scripts/build_iss_model.py`. Taille amplifiée à l’écran, orientation illustrative : ce modèle ne représente pas une attitude mesurée, ni une configuration précise des véhicules amarrés. Aucun modèle NASA tiers n’est incorporé.

« Tous les satellites » désigne les familles actuellement intégrées à Atlas : **ISS et Starlink**, et non l’intégralité des objets du catalogue NORAD.

## Missions et équipage ISS (version locale)

Les faits textuels proviennent de [Launch Library 2 — The Space Devs](https://thespacedevs.com/llapi), API publique v2.3.0 : `space_stations/4`, `expeditions/{id}` et `spacecraft_flights` en mode détaillé. La liste comprend les vols vers l’ISS (habités, cargo et vols prévus), identifiés par destination ou amarrage à la station n°4. Ce catalogue peut comporter des omissions ; il ne représente pas toutes les expéditions, sorties extravéhiculaires ou lancements de composants indépendants. Les fiches renvoient au dossier source. Aucune photographie, biographie ou écusson tiers n’est incorporé.

Collecte côté serveur toutes les 6 heures (3 requêtes), avec reprise intégrale de l’historique chaque semaine ou à la première installation (12 requêtes maximum par passage ; quota public de 15/heure/IP). Aucun appel fournisseur par visiteur. Un échec préserve le dernier cache ; sa date de réception reste affichée. Après 24 heures, l’interface signale une ancienne collecte. Le serveur doit rester en marche pour collecter ; un Mac éteint ne collecte pas.

L’équipage est celui de l’expédition active dont les membres sont signalés dans l’espace, recoupé avec les vols documentés vers l’ISS pour retrouver la dernière arrivée à bord. La durée à bord part de l’amarrage, pas du décollage ni du temps de carrière cumulé. Les missions de retour peuvent avoir un équipage différent : il est présenté séparément. Une information absente reste non renseignée. Les dates futures restent prévisionnelles et leur précision est indiquée. Les faits sont chargés une seule fois par visite ; la chronologie passée de la carte ne transforme pas la rubrique « équipage actuel » en historique d’équipage.

Références de contrôle : [documentation API](https://ll.thespacedevs.com/docs/), [FAQ et limites](https://github.com/TheSpaceDevs/Tutorials/blob/main/faqs/faq_LL2.md), [arrivée de Crew-13 — NASA](https://www.nasa.gov/blogs/spacestation/2026/10/01/crew-13-members-enter-station-join-expedition-75/).

### Sorties extravéhiculaires dans les fiches astronautes

L’endpoint public Launch Library 2 `spacewalks?mode=normal` fournit les participants, dates, lieux et durées communes des sorties (ISS et autres missions de carrière documentées). Le serveur conserve un cache séparé `data/iss-evas.json`, rafraîchi toutes les 6 h avec reprise historique hebdomadaire ; une reprise initiale de l’historique EVA attend au moins une heure après la reprise complète des missions pour respecter le quota public. Les indisponibilités conservent le cache. Les archives initiales partielles restent explicitement signalées ; absence de résultat ne signifie pas absence certaine de sortie dans la carrière.

Le compteur et le cumul portent sur les sorties terminées documentées de l’astronaute. Les durées sont des durées de sortie selon les conventions de l’agence, et non un chronométrage individuel hors du sas. Une sortie de 6 h avec deux participants compte pour 6 h dans la fiche de chacun, et non pour 12 h. Aucune durée n’est inventée : une durée absente est signalée, avec repli sur la différence des dates début/fin lorsqu’elles sont présentes et cohérentes. Les sorties futures sont exclues du bilan ; les sorties en cours sont présentées séparément sans durée finale.

## Extension des pages et classification thématique

Les 75 pages supplémentaires s’appuient sur le catalogue public CelesTrak SATCAT (https://celestrak.org/pub/satcat.csv) et les éléments GP du groupe public `active` (https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=JSON). Le registre `resources/constellations.json` conserve les identifiants NORAD et les alias des programmes. Les objets classés DEB / R/B sont séparés des charges utiles ; une charge utile attachée à un étage, telle IRNSS-1H, conserve son identité SATCAT.

Précisions d’identité : Amazon Leo comprend les objets catalogués KUIPER ; PlanetScope comprend FLOCK / Dove ; BlackSky Gen-2 et Gen-3 correspondent aux séries GLOBAL vérifiées ; les identifiants distinguent le PACE NASA des homonymes. EDRS-A est une charge hébergée par Eutelsat 9B (https://www.esa.int/Applications/Connectivity_and_Secure_Communications/EDRS/Infrastructure). Les instruments Sentinel hébergés ne sont pas inventés comme objets indépendants.

Les pages ciblées Meteosat MTG, GOES-18 / 19 et Sentinel-5P / 6 restent aussi accessibles au sein de leurs familles générales, avec un seul identifiant dans la vue Atlas. Les effectifs affichés reflètent les enregistrements publics disponibles, pas des nombres de lancements repris comme positions supposées. Les éléments orbitaux restent limités à ±72 h : cela peut tronquer le tracé d’une orbite très longue, signalé sur le planisphère.

## Tiangong et extension des objets non identifiés

Tiangong utilise le groupe public CelesTrak `stations`, filtré sur NORAD 48274. Le modèle GLB et son dessin 2D sont des schémas originaux, générés par `scripts/build_tiangong_model.py` ; aucune attitude réelle ou configuration d’amarrage n’est affirmée. Les vols sont filtrés sur la station LL2 18 et la destination « Tiangong space station ». La station ISS reste LL2 4. Les membres courants sont associés à un vol habité effectivement arrivé, non reparti, et déclarés en vol. L’équipage Shenzhou 23 a été recoupé avec CMSA : https://www.cmse.gov.cn/fxrw/SZ23/ ; arrivée : https://www.cmse.gov.cn/xwzx/202605/t20260525_57570.html ; sortie : https://www.cmse.gov.cn/xwzx/202608/t20260828_57758.html. Les 21 vols et 27 EVA Tiangong présents dans l’import correspondent à la couverture publiée disponible, pas à une promesse d’exhaustivité biographique.

Audit Débris : 42 703 fragments / étages au catalogue cumulé, dont 14 835 sans rentrée signalée, dans le SATCAT importé. Certains n’ont aucun élément public ; d’autres ont une époque trop ancienne pour la fenêtre de 72 h. Le groupe public Analyst (https://celestrak.org/NORAD/elements/gp.php?GROUP=analyst&FORMAT=JSON) ajoute 599 objets non identifiés à cet import. Leur identité et nature ne sont pas supposées : https://celestrak.org/NORAD/documentation/gp-data-formats.php. La population statistique est distincte de ce catalogue individuellement calculable : https://sdup.esoc.esa.int/discosweb/statistics/. Les estimations ne sont pas transformées en faux points. Les satellites intacts hors service gardent leur classification de charge utile dans leurs pages respectives.

## Représentations scientifiques

Le détail de provenance et des droits est dans THIRD-PARTY.md et `resources/science-model-sources.json`. Les modèles actifs et ceux en attente de vérification sont décrits dans `resources/model-coverage.json`. Les nouvelles silhouettes procédurales non vérifiées sont exclues de l’affichage. Les modèles NASA et les dessins originaux existants restent distingués ; aucune représentation ne crée de position orbitale.

### TESS : trajectoire NASA/JPL Horizons

Les vecteurs géocentriques ICRF de TESS (NAIF −95, NORAD 43435) sont récupérés via l’API officielle Horizons, centre Terre 399, positions/vitesses en km et km/s, dates UTC explicites. Réponse originale de validation : `resources/tess-horizons-sample.json`. Le cache `static/ephemerides/tess.json` est renouvelé chaque jour par le serveur local ou lors d’une collecte de publication ; un échec conserve le cache. La réponse obtenue le 20 octobre 2026 décrit une trajectoire prédite à partir du suivi du 27 septembre 2026 et couvre jusqu’en mars 2028. L’extrait fourni couvre du 30 septembre au 15 novembre 2026.

Le navigateur charge ce petit cache une seule fois par visite sur Atlas/TESS. Interpolation Hermite des positions et vitesses à pas horaire ; aucune extrapolation hors des bornes publiées. Conversion ICRF vers l’équateur de date par précession IAU 1976 puis rotation sidérale et géodésie WGS84 ; la nutation et le mouvement polaire ne sont pas appliqués. Affichage d’observation, sans précision de navigation revendiquée. Les trajectoires 2D/3D sont échantillonnées dans ces mêmes données, sans remplacer les vecteurs par de faux TLE.

Documentation : https://ssd-api.jpl.nasa.gov/doc/horizons.html et https://ssd.jpl.nasa.gov/horizons/manual.html.

### XPoSat : disponibilité vérifiée le 20 octobre 2026

Le TLE accessible via N2YO et le miroir public TLE est daté du 9 octobre 2026 à 22:27:47 UTC. SatNOGS ne retourne pas de TLE pour cet objet. Aucun TLE frais exploitable trouvé lors de cette recherche ; le seuil de validité de 72 h reste inchangé. La page indique la date disponible et permet sa consultation historique ; elle ne présente pas cette archive comme une position actuelle. Le collecteur tente également les sources de secours lors des cycles suivants.

### LAGEOS : correction géométrique

Le modèle schématique partagé par LAGEOS-1/2 représente une sphère de 60 cm avec 426 ouvertures circulaires de réflecteurs de 3,81 cm intégrées à la surface. La disposition sphérique est illustrative ; les anciens cubes externes ont été supprimés. Dimensions : https://earth.gsfc.nasa.gov/geo/missions/lageos/design et https://ntrs.nasa.gov/citations/19760006091.

### Modèles 3D détaillés à la demande

Les représentations en couleur de Hubble, Chandra, Fermi et TESS conservent les maillages, matériaux et textures des originaux NASA précédemment référencés. L’ISS utilise « International Space Station (ISS) (B) » du même dépôt officiel NASA-3D-Resources, révision `11ebb4ee043715aefbba6aeec8a61746fad67fa7`. SHA-256, URL, taille et crédits figurent dans `resources/detailed-model-manifest.json`. Le constructeur `scripts/build_detailed_models.py` ne modifie que la transformation racine pour conserver le centrage et le cadrage de la version filaire. Il conserve intégralement les données binaires, matériaux et images embarquées. Les versions sont artistiques, ne constituent pas des configurations de vol exactes et n’indiquent pas l’attitude réelle.

Les 5 fichiers totalisent environ 4,8 Mo et ne sont chargés qu’après activation de l’option. La barre reflète les octets reçus puis la préparation du rendu ; aucune extrapolation de pourcentage. Décocher ou changer de cible annule la demande et rend le dessin blanc immédiatement ; un modèle déjà prêt est réutilisé. Une erreur conserve le dessin blanc. Les autres objets signalent explicitement l’indisponibilité d’un modèle détaillé, sans recolorer leur schéma pour le faire passer pour un modèle fidèle.

Sources et règles d’utilisation : https://github.com/nasa/NASA-3D-Resources et https://www.nasa.gov/nasa-brand-center/images-and-media/.

### Révision des modèles détaillés et des étiquettes (20 octobre 2026)

- ISS : NASA IGOAL D, 2 707 621 triangles et 555 maillages. Export compatible conservant les 110 textures PNG originales, sans extension WebP ; maillages compressés conservés octet pour octet. Les découpes opaques écrivent dans le tampon de profondeur, le vitrage de la Cupola conserve sa transparence. Couche de couleur principale blanche neutre vérifiée sur 45 primitives, puis couches de couleurs inutilisées retirées. Source, réglages, empreinte et audit dans `resources/detailed-model-sources.json` et `resources/iss-vertex-colour-audit.json`.
- Hubble : remplacement de la variante A de 7 672 triangles par le modèle NASA VTAD texturé de 21 129 triangles, 10 matériaux et 10 images, publié sur https://science.nasa.gov/resource/hubble-space-telescope-3d-model/. La variante B du dépôt GitHub, bien que plus dense, a été écartée car dépourvue de matériaux et textures.
- TESS : remplacement de la variante A sans textures par la variante B officielle, avec six images embarquées. Chandra et Fermi conservent leurs originaux NASA.
- Les surfaces et textures originales restent intégralement conservées par le constructeur. Un éclairage PBR par objet est ajouté pour rendre les métaux lisibles : environnement Kiara 6 Afternoon de Greg Zaal / Poly Haven, CC0 (https://polyhaven.com/a/kiara_6_afternoon ; https://polyhaven.com/license), version KTX2 préfiltrée distribuée avec Cesium 1.130. URL et empreinte dans `resources/detailed-environment-source.json`. Les coefficients SH proviennent de l’exemple officiel « Image-Based Lighting » de Cesium (Apache-2.0). Cet éclairage de présentation ne simule pas l’éclairage orbital réel.
- L’environnement est chargé uniquement avec un modèle détaillé, indépendamment de l’éclairage du globe. Le rendu détaillé active le lissage et une densité maximale de deux pixels par pixel CSS ; décocher restaure la résolution habituelle. La taille du téléchargement est indiquée dans les commandes avant activation.
- Les noms sont positionnés en fonction de la sphère englobante réellement projetée du modèle, de son agrandissement à l’écran et de la largeur du texte. En très gros plan sans marge libre, le nom reste dans une zone sombre lisible au bord de l’image.

### Correction de compatibilité du modèle Hubble VTAD

Le maillage `Cube.004` (mesh 10, primitive 0, 24 sommets) du fichier officiel Hubble VTAD référence `clear.png.001` via le matériau `transparent` sans attribut `TEXCOORD_0`. Cette image PNG 128×128 est uniformément RGBA (255,255,255,0). Le constructeur ajoute des UV constants (0,0) pour ces seuls sommets : les matériaux, les textures, la transparence et toutes les données géométriques originales sont conservés. La réparation est déclarée dans `resources/detailed-model-sources.json` et journalisée dans le manifeste généré. Toute référence de texture sans UV provoque désormais un échec de construction. La suppression de la texture aurait rendu ce cube opaque et a donc été écartée.


### Tiangong — modèle détaillé (20 octobre 2026)

« tianGong », par **w29572227**, [source originale Sketchfab](https://sketchfab.com/3d-models/tiangong-aca22b1dd6d242c1ae7b88de2f483b77), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Licence et auteur vérifiés dans l’API publique du modèle. GLB redistribué par earth-pulse, téléchargement épinglé et SHA-256 dans `resources/detailed-model-sources.json`. Atlas conserve géométrie, matériaux, texture et crédit intégrés ; seule la transformation de présentation est ajoutée. Taille illustrative ; configuration et orientation ne représentent pas la station en temps réel. Chargement à la demande uniquement.

Les modèles ESA CHEOPS et XMM-Newton trouvés sur SciFleet restent dans les fichiers de recherche, hors `static/`, car les conditions générales liées par le site ne suffisent pas à autoriser leur redistribution dans Atlas. Aucun de ces fichiers n’est proposé comme modèle détaillé. État des autres recherches : `resources/model-search-2026-10-20.json`.


### Historique toutes rubriques et stations — 20 octobre 2026

L’import `scripts/import_public_history.py` sélectionne désormais tous les identifiants du catalogue fourni, dont les stations, satellites scientifiques, constellations et débris. Archives publiques Julien Simon / Space-Track (CC BY 4.0 déclarée), révision épinglée dans `data/history/manifest.json`. Une observation réelle proche de midi UTC par objet et journée disponible ; champs arrondis du jeu source conservés. Le manifeste distingue les objets demandés, ceux trouvés et les années traitées. Aucune couverture de 100 % des dates n’est déduite de la seule présence au catalogue.

ISS et Tiangong : complément d’archives publiques IAU CPS SatChecker, provenant de CelesTrak / Space-Track. Documentation : https://satchecker.readthedocs.io/en/latest/tools_data_access.html . Provenance, empreintes des réponses et couverture dans `data/station-history-source.json`. Le script `scripts/import_station_history.py` contrôle les checksums TLE et convertit les champs en OMM ; aucun élément orbital synthétique.

Les séjours historiques sont reconstruits depuis les arrivées et les équipages de retour documentés par Launch Library 2, en tenant compte des changements de véhicule et des retours sans équipage (Starliner CFT, Soyuz MS-22). Les expéditions courantes ne sont pas réutilisées comme des numéros d’expédition passés. Historique d’équipage signalé partiel lorsque les informations de départ manquent.

## Extension historique et missions publiques (23 octobre 2026)

Le registre ajoute des familles vérifiées dans le [SATCAT CelesTrak](https://celestrak.org/pub/satcat.csv) et les tables publiques [GCAT de Jonathan McDowell](https://planet4589.org/space/gcat/web/cat/index.html). Les empreintes et identités ayant servi à la sélection sont conservées dans `resources/mission-identities.json` et `resources/mission-catalog-audit.json`. Une identité de charge utile est exigée : un étage ou un débris portant un nom voisin ne devient pas un satellite du programme. Plusieurs rubriques peuvent désigner le même objet sans créer plusieurs points dans Atlas.

Les noms génériques Cosmos/USA ne permettent pas de déduire une fonction classifiée. Les séries techniques sont rattachées uniquement aux identités publiques recensées. EGNOS/WAAS désignent leurs satellites hôtes documentés, et ne prouvent pas que le relais fonctionne à toutes les dates historiques.

Les dates de fin des opérations GCAT (`TOp`) sont distinctes des dates de rentrée SATCAT. Les horaires exacts de lancement et de retour GCAT sont utilisés uniquement si leur jour concorde avec le SATCAT ; une date vague ou incertaine ne reçoit pas d’heure inventée. Un retour au sol peut être la borne publiée pour un véhicule récupéré. `TLast` signifie uniquement « encore actif à cette date » et n'est jamais présenté comme une fin de mission. La précision des dates vagues et les incertitudes sont conservées : [définition des colonnes GCAT](https://planet4589.org/space/gcat/web/cat/pcols.html). Les pages entièrement désorbitées proposent la dernière observation réellement importée, séparément de la date et du lieu de rentrée. Aucun point n'est fabriqué si les archives manquent.

Spitzer, Kepler, DSCOVR et Aditya-L1 utilisent les vecteurs géocentriques ICRF officiels de [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html), et non une propagation TLE terrestre. Les fichiers annuels sont chargés à la demande. Interpolation de Hermite avec les vitesses publiées entre deux échantillons espacés de six heures, sans extrapolation hors de la couverture. Les tracés sont des segments ouverts, sans ellipse fermée artificielle. Certaines éphémérides publiées sont des prédictions après la fin des opérations, pas des mesures de télémétrie. Pour Spektr-RG et IKAROS, aucune éphéméride officielle vérifiée n'a été intégrée : la page le signale et ne représente pas une fausse orbite terrestre.

L'archive publique quotidienne commence en 1959. Elle ne reconstitue donc pas les vols de Spoutnik 1/2 ni les lacunes précédant les premières observations d'autres objets. Les dates et les métadonnées restent consultables. Le SATCAT et l'historique NASA diffèrent d'un jour pour la rentrée de Spoutnik 1 ; cette divergence est indiquée sur sa page.


### Extension des modèles scientifiques et des stations — 24 octobre 2026

Les adaptations filaires NASA ajoutées couvrent Kepler, Spitzer, Swift, Suzaku, GRACE-1/2, FUSE, Compton GRO, Mir, Skylab et GRACE-FO. GRACE-FO utilise son propre modèle officiel NASA VTAD : https://gracefo.jpl.nasa.gov/resources/86/grace-fo-3d-model/ . Il n’est jamais confondu avec GRACE-1/2.

Les modèles détaillés nouvellement retenus sont Kepler, Spitzer, GRACE-1/2 et GRACE-FO, avec matériaux et textures sources. Les variantes simplifiées sans textures de Swift, Suzaku, FUSE, Compton GRO, Mir et Skylab sont désactivées comme options détaillées. Les six modèles détaillés existants sont conservés. Spitzer garde sa réparation UV transparente vérifiée.

Les 48 nouvelles silhouettes procédurales sans géométrie suffisamment validée, dont Saliout, Almaz, Tiangong-1/2 et les variantes Ariel, HEAO, OAO, OSO et SAS, sont mises en attente dans les sources et exclues des manifestes d’affichage. Les références documentaires ne valent pas une validation de la silhouette. Les modèles déjà disponibles ISS et Tiangong actuelle restent accessibles. Aucun modèle d’un autre véhicule n’est substitué à un objet manquant.

Les fichiers `resources/model-coverage.json` et `resources/model-reference-audit-2026-10-24.json` distinguent disponibilité réelle et références de recherche. Les modèles restent chargés à la demande ; un modèle détaillé activé remplace le dessin blanc et son cache est libéré au changement de cible.

### Essai Mir Celestia — 24 octobre 2026

La nouvelle option détaillée Mir utilise désormais le modèle CC BY 4.0 de DaveBowman2001 : 446 331 triangles, 433 434 sommets, 60 matériaux et neuf textures originales. Le GLB pèse environ 21 Mo et reste chargé à la demande. Le schéma blanc initial reste disponible lorsque le détail est désactivé. `scripts/convert_mir_celestia.py` reconstruit le GLB depuis le CMOD épinglé ; `tests/mir_conversion.py` compare directement géométrie, UV, affectations de matériaux et pixels source. Provenance dans THIRD-PARTY.md et `resources/mir-conversion-audit.json`. Le validateur glTF signale zéro erreur ; un avertissement sur les métadonnées PNG d’une texture source est conservé avec le fichier original.

### Rendu détaillé et missions lointaines — 24 octobre 2026

L’ISS conserve l’assemblage complet NASA IGOAL D et ses textures PNG originales. Le mode détaillé rend désormais jusqu’à deux pixels par pixel CSS selon la densité de l’écran, sans baisse adaptative de résolution pendant son activation. MSAA 4 lorsque le moteur le permet, avec repli FXAA ; budget et réglages ordinaires restaurés à la désactivation. Éclairage de présentation ISS ajusté, sans modifier son maillage ni ses textures.

Les pages de missions utilisant Horizons centrent directement leur cible disposant d’une position valide même après la fin des opérations (exemple Kepler). Portée de caméra adaptée aux distances héliocentriques. Hors couverture, une date effectivement couverte est proposée, sans extrapolation de position.

JWST and Voyager colour models: NASA 3D Resources, pinned revision 11ebb4ee043715aefbba6aeec8a61746fad67fa7. JWST: NASA / Christopher R. Meaney, https://science.nasa.gov/3d-resources/james-webb-space-telescope-b/ . Voyager 1 and 2: NASA / Michael D. Carbajal, https://science.nasa.gov/3d-resources/voyager-probe-b/ . Original geometry and textures preserved; reflective material parameters are recorded in resources/detailed-model-sources.json. Use follows NASA Images and Media Usage Guidelines.

### Orientation des modèles — 25 octobre 2026

Les positions SGP4/Horizons ne fournissent pas l’attitude d’un véhicule. Aucun modèle n’est présenté comme une mesure de rotation en direct. Seule l’ISS détaillée est calibrée dans le repère de corps : +X avant, +Z nadir. La calibration utilise les transformations cumulées de tous les parents dans le fichier IGOAL : Unity→Harmony est l’avant (−X source), Tranquility→Cupola est le nadir (−Y source). Un test contrôle ces directions sur les nœuds réellement assemblés et vérifie le pointage Terre après la transformation orbitale. Sans vitesse dans une ancienne édition, le nadir reste respecté et le cap est signalé indisponible. Le moteur fournit le vecteur vitesse inertielle exprimé dans les axes terrestres, pour construire le repère LVLH nominal à la date consultée. Les dessins blancs conservent leur présentation illustrative et ne passent jamais par ce calcul. Cela ne reproduit ni les manœuvres, ni TEA, ni le braquage instantané des panneaux. Les autres modèles restent illustratifs jusqu’à disponibilité de données d’attitude et d’une calibration de leurs axes. Cette limite apparaît dans la fiche.

Références : [NASA, Operating an Outpost, chapitre Motion Control](https://www.nasa.gov/wp-content/uploads/2018/04/iss-operating_an_outpost-tagged.pdf), [NASA/JPL, SPICE kernels : CK pour l’orientation, SPK pour la trajectoire](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/kernel.html).

Correction Cupola : les exports calibrés utilisent déjà +X avant / +Z nadir. Le chargeur Cesium doit recevoir `upAxis: Axis.Z` et `forwardAxis: Axis.X` ; ses valeurs par défaut Y/Z ajoutaient une seconde conversion, rendant la direction de visée perpendiculaire au nadir. Le test de régression utilise désormais `Cesium.ModelUtility.getAxisCorrectionMatrix`, puis l’axe de visée réel du nœud Cupola et la matrice orbitale, à plusieurs positions terrestres. Les autres modèles conservent les axes par défaut.

ISS — présentation des panneaux : les huit articulations bêta du modèle IGOAL sont tournées autour de leur propre mât pour aligner les grandes ailes dans un plan déployé, côté zénith. Les fixations, la Cupola, la poutre, les radiateurs et l’inclinaison relative des supports iROSA sont conservés. La symétrie négative du repère source est prise en compte lors du calcul des rotations. Il s’agit d’une configuration de présentation, sans télémétrie d’orientation des panneaux.

Boussole — en suivi, le repère géographique est calculé à la position de l’objet suivi. Nord/sud et est/ouest sont projetés séparément dans les axes réels de la caméra, ce qui conserve la bonne chiralité lorsqu’on regarde la station par dessous. La remise au nord agit sur le roulis de la caméra, sans changer l’attitude du modèle.

Suivi solaire ISS (modèle réaliste uniquement) : à l’heure affichée dans la chronologie, la position géocentrique du Soleil provient du même calcul astronomique que le ciel et l’éclairage terrestres (`AtlasCelestialFrame.sun`). Le modèle comporte deux articulations alpha SARJ indépendantes (port et tribord), chacune portant quatre articulations bêta BGA. Les alpha font tourner les segments porteurs extérieurs et leurs panneaux autour de la poutre. Les bêta orientent individuellement les ailes autour de leur mât. Les positions à 90° et la rotation continue à 360° sont conservées ; les pivots et la hiérarchie d’origine du modèle IGOAL sont utilisés, y compris sa symétrie négative. Le corps central, la Cupola, les segments intérieurs P1/S1 et la caméra restent fixes. Les iROSA et équipements extérieurs suivent leurs supports sans modification de leurs attaches.

Le pointage alpha vise la projection du Soleil autour de la poutre ; les bêta complètent ensuite le pointage dans la pose alpha courante. Le mouvement est lissé et les angles sont déroulés sans saut au passage ±180°. La date en pause n’ajoute aucun mouvement décoratif une fois la position atteinte. Les tests parcourent un tour complet, les configurations verticales à 90°, plusieurs directions solaires, les positions des attaches et la stabilité des modules centraux.

Limites : les deux axes simulent un suivi nominal du Soleil ; il ne s’agit pas de télémétrie. Les angles de parking, contraintes d’ombrage, pannes et manœuvres d’éclipse propres à chaque date ne sont pas reconstruits. Les radiateurs thermiques ne reçoivent pas une animation de suivi solaire ; ceux fixés aux ensembles extérieurs accompagnent mécaniquement leur support. Références : [NASA, Operating an Outpost, EPS et systèmes de pointage](https://www.nasa.gov/wp-content/uploads/2018/04/iss-operating_an_outpost-tagged.pdf), [NASA, DOUG : commandes Solar Array Alpha / Beta](https://www.nasa.gov/wp-content/uploads/2022/06/doug_user_guide_doc_final_0.pdf).

ISS : correction du miroir latéral de l’assemblage IGOAL par réflexion de l’axe corps Y dans la transformation de présentation. Les axes avant (+X) et nadir (+Z) sont conservés ; la réflexion annule le changement de parité du fichier source. Géométrie et textures PNG restent intactes. Contrôles : parité du module central, visée Cupola vers la Terre, suivi solaire alpha/bêta.


Fiches : `static/object-facts.js` reprend les catégories du registre Atlas et conserve
les dimensions physiques vérifiées par identifiant NORAD, avec la source primaire
et le périmètre de mesure (corps, antenne, panneaux ou pare-soleil déployés).
Les lignes sans donnée sont masquées ; les dimensions ne sont
jamais déduites de l'échelle amplifiée ou normalisée des modèles d'affichage.
Sources initiales : NASA ISS Facts and Figures, NASA Hubble Overview, Chandra
Specifications, NASA Webb Telescope Overview, dossier de presse NASA/JPL Kepler,
NASA Voyager FAQ, ESA Gaia et Euclid, NASA Goddard LAGEOS et NASA History Sputnik.
Les URL exactes sont conservées auprès de chaque mesure dans ce fichier de données.

Fond cartographique rapproché : un seul fournisseur cartographique natif Cesium
est conservé pendant le zoom, le suivi orbital et les mouvements de caméra.
La précédente recomposition de mosaïques régionales a été retirée : elle remplaçait
les couches pendant le rendu et provoquait des coupures et du clignotement.
La géométrie, les coordonnées de texture et le chargement des tuiles restent gérés
par Cesium. Le suivi rapproché affine le niveau de détail et conserve le cache,
sans couper le fond pendant le chargement ni mélanger une seconde carte.
En planisphère, la sélection d'un objet retire le fond Natural Earth sous les tuiles
cartographiques. Attribution et règles de cache du fournisseur conservées.


Complément GCAT des fiches (26 octobre 2026) : import local du catalogue principal
`https://planet4589.org/space/gcat/tsv/cat/satcat.tsv`, édition du 13 octobre 2026.
Empreinte, ordre des champs, compteurs et noms des fragments dans
`resources/object-physical-facts-manifest.json`. 30 313 objets ont des mesures
exploitables, dont 12 401 Starlink avec variante identifiée. Les correspondances
utilisent NORAD et identifiant international ; les anciens identifiants sont
recoupés par nom. Les champs zéro ou absents ne produisent aucune ligne.
Les indicateurs d'estimation GCAT sont conservés et affichés par « ≈ ».
Les variantes proviennent du champ Bus et du lot PLName (V0.9, V1.0, groupes V1.5,
V2M, V2MO, V2MD), jamais d'un simple seuil de date : les générations se chevauchent.
La masse propre à chaque objet est conservée, notamment les différentes séries V1.5
et les V2 Mini optimisés. Le rapport opérateur
https://starlink.com/public-files/starlinkProgressReport_2024.pdf confirme la
masse de référence d'environ 575 kg du V2 Mini optimisé. Les dimensions de référence
V1.5 et V2 Mini sont également présentées dans le dépôt SpaceX du 4 octobre 2022,
https://planet4589.org/astro/starsim/papers/StarGen2.pdf (annexe B) ; les masses DAS
conservatrices de ce dépôt ne remplacent pas les masses individuelles du catalogue.

Le premier module ne doit pas représenter la taille ou la masse d'une station
assemblée : les valeurs GCAT de Zarya, Tianhe et du module central Mir sont exclues
de cet import. Les mesures de l'ISS sont celles de l'ensemble déployé, avec masse
de référence variable selon la configuration. Une masse de référence ou au lancement
ne constitue pas une estimation du carburant restant à l'heure de la chronologie.
Le satellite Spoutnik 1 est identifié par NORAD 2 ; NORAD 1 est l'étage associé.
Les sites SATCAT sont libellés d'après https://celestrak.org/satcat/launchsites.php.
Les fiches ne contiennent que la liste demandée, dans l'ordre, vitesse en km/h,
masse en kg sous 1 000 kg et en tonnes à partir de 1 000 kg. Pour les missions
lointaines, la distance géocentrique conserve son libellé physique plutôt qu'altitude.


Disponibilité : `scripts/ensure_data.py` contrôle les fichiers et conserve des copies
validées pour la récupération ; détails et limites dans `DATA-FIABILITE.md`.
Les missions lointaines sont actualisées avec NASA/JPL Horizons avant leur expiration.
Les limites effectives de chaque noyau restent respectées. Les index expirés ou
momentanément indisponibles peuvent être relus après 30 secondes dans le navigateur,
et les fichiers annuels sont versionnés par la provenance de l'index pour éviter
le réemploi d'un ancien contenu après actualisation.

### Équipages historiques et temps de carrière

Les panneaux des stations utilisent Launch Library 2 pour les collectes ISS/Tiangong et les tables publiques de [GCAT Human Spaceflight](https://planet4589.org/space/astro/web/) (J. McDowell, CC BY 4.0) pour les séjours historiques, vols individuels et participations aux EVA. `scripts/import_crew_archive.py` produit `static/crew-archive.json` à partir de sept tables, avec leurs URL, dates et empreintes SHA-256 ; la publication tente une actualisation quotidienne et conserve l’archive livrée si la source échoue.

Les temps de vol portent sur toute la carrière documentée, arrêtée à la date consultée ; ils ne sont pas la somme des séjours à bord de la seule station. Les changements de véhicule et intervalles qui se recouvrent ne comptent qu’une fois. Les participations aux sorties spatiales restent séparées du temps de vol. Les identités incertaines ne sont pas fusionnées ; un cumul issu des seuls vols LL2 de la station est signalé comme minimum documenté. Les arrivées, départs et nationalités manquants ne sont pas inventés. Les dates GCAT marquées comme incertaines restent des observations de catalogue ; les couvertures partielles sont signalées dans le panneau. Soyouz 10 n’est pas compté comme un équipage ayant occupé Saliout 1.

### Nationalités et drapeaux des voyageurs spatiaux

Les codes nationaux GCAT sont normalisés vers les fichiers de drapeaux locaux, selon [la table des États GCAT](https://planet4589.org/space/gcat/tsv/tables/orgs.tsv). Les correspondances et corrections individuelles sourcées figurent dans `resources/astronaut-nationalities.json`. Les libellés historiques de la Tchécoslovaquie et de la RDA sont conservés ; le drapeau RDA provient de [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Flag_of_East_Germany.svg), œuvre officielle dans le domaine public selon sa fiche. Le drapeau tchèque conserve le dessin du drapeau tchécoslovaque. Ephraim Rabin reçoit les deux nationalités américaine et israélienne d’après [sa biographie Blue Origin](https://www.blueorigin.com/ja-JP/news/new-shepard-ns-26-mission). Le code GCAT `PAR` désigne Panama, confirmé pour Jaime Alemán par [Blue Origin NS-32](https://www.blueorigin.com/news/new-shepard-ns-32-mission). Les mannequins et mascottes sans nationalité ne reçoivent pas un pays inventé.

### Lanceurs et catégories individuelles de mission

La ligne Lanceur utilise GCAT launchlog (identifiant international de lancement ; valeur absente en cas d’ambiguïté). Les catégories individuelles sont enrichies par GCAT psatcat. L’import, les sources datées et leurs empreintes sont documentés dans `RECHERCHE-DONNEES-PHYSIQUES.md` et `resources/object-physical-facts-manifest.json`.

### Système solaire (extension locale)

Catalogue de lunes, rayons et rotations : NASA/JPL SSD, Horizons, NAIF PCK IAU. Les empreintes des sources sont conservées dans `static/solar/catalog.json`. Les réponses d'éphémérides datées sont mises en cache localement, sans extrapolation. Les cartes planétaires Solar System Scope, CC BY 4.0, sont réduites pour les aperçus ; leurs compléments artistiques ne constituent pas une observation datée. Animation de plasma solaire illustrative. Les provenances, limites, rayons des anneaux et commandes locales sont détaillés dans `SYSTEME-SOLAIRE.md`. Aucun fichier de cette extension n'a été publié.

### Extension locale : missions dans le Système solaire et surfaces des lunes

Les positions et trajectoires reprennent les archives NASA/JPL Horizons existantes, sans extrapolation. Les orbites instantanées affichées sont des coniques osculatrices explicitement présentées comme approximations. Les masses/GM permettant de définir un voisinage planétaire proviennent de NASA/JPL SSD : https://ssd.jpl.nasa.gov/sats/phys_par/. Les 20 cartes de lunes intégrées, leur crédit, leur définition et leurs limites sont détaillés dans `static/solar/moon-surfaces.json` et `SYSTEME-SOLAIRE.md`. Des mosaïques anciennes ou partielles ne sont pas assimilées à une observation à la date simulée. Les autres lunes restent des repères, sans surface inventée.

Les fiches d’astronautes utilisent désormais le cumul de carrière et la liste de tous les vols documentés, indépendamment de la station et de sa date de consultation. Le cumul conserve l’union des intervalles pour éviter de compter deux fois les transferts ou les EVA. Les identités, vols et cumuls GCAT restent rattachés aux sources et limites déjà consignées ; un total de carrière plus récent publié dans la fiche du fournisseur est identifié comme tel.

## NASA Eyes — import local du 27 octobre 2026

Les ressources publiques de https://eyes.nasa.gov/apps/solar-system/ ont fourni onze modèles glTF archivés, dont sept nouveaux modèles détaillés activés, 56 définitions Dynamo et un catalogue de 43 878 étoiles/galaxies. La carte du ciel Atlas est désormais une projection de ce catalogue, tandis que le rendu indépendant du Soleil est conservé. Le code Eyes n’est pas embarqué. Provenances par fichier, contrôles d’intégrité, couverture et limites des cinq secours orbitaux retenus : `resources/nasa-eyes/README.md`, `manifest.json` et `ephemeris-validation.json`. Horizons reste la source prioritaire ; les trajectoires Eyes divergent trop pour remplacer certaines archives actuelles.

### Événements des missions et JUICE (27 octobre 2026)

- Les événements affichés sont sourcés individuellement dans `static/mission-events/catalog.json`. Une date publiée sans heure reste présentée au jour près ; la fenêtre de lecture ne prétend pas fournir l'heure exacte de l'événement. La séparation de Huygens représente la position de Cassini, pas une trajectoire inventée pour Huygens.
- Les fenêtres de lecture Horizons conservent les vecteurs position/vitesse géocentriques ICRF en km et km/s, et les dates UTC. Cadence d'une minute pour les survols, dix minutes pour les autres fenêtres ; aucune extrapolation. Les réponses originales et empreintes sont conservées dans `resources/mission-event-sources`. Cassini dispose aussi d'archives annuelles horaires ; la cadence est conservée lors des futurs imports.
- Spektr-RG : [fichiers orbitaux officiels eROSITA EDR, MPE/NPOL](https://erosita.mpe.mpg.de/edr/eROSITAObservations/OrbitFiles/). Les trois mois publiés couvrent du 1er octobre 2019 au 1er janvier 2020. FITS J2000/ICRS géocentriques : m→km, m/s→km/s ; colonnes UTC vérifiées contre MJD(TT), TT−UTC=69,184 s. Aucun prolongement jusqu'à aujourd'hui. Les fichiers d'origine et empreintes sont archivés dans `resources/spektr-rg`.
- JUICE : [mission ESA](https://www.esa.int/Science_Exploration/Space_Science/Juice), NORAD 56176 / 2023-053A vérifié dans SATCAT. Trajectoire officielle JPL Horizons, cible −28, issue des données ESA. Les événements futurs ne sont pas présentés comme déjà accomplis.
- JUICE 3D : [modèle technique public ESA/Airbus et documentation de ses composants](https://juicesoc.esac.esa.int/help/82_spacecraft_model.html), [fichiers OBJ officiels](https://spiftp.esac.esa.int/data/SPICE/JUICE/misc/models/). Assemblage des 31 composants, km→m et translations structurelles publiées, déploiement de l'aile −Y, simplification du maillage pour le navigateur. Couleurs, texture des cellules et finitions PBR illustratives produites pour Atlas ; aucune télémétrie d'attitude revendiquée. Sources compressées, empreintes et audit de simplification dans `resources/juice-cad`. Le modèle Sketchfab proposé est marqué non téléchargeable et n'a pas été extrait.
- IKAROS : [chronologie de l'équipe de mission JAXA](https://www.isas.jaxa.jp/e/forefront/2011/tsuda/). Les événements sont documentés ; aucune trajectoire vectorielle officielle exploitable n'a été identifiée dans les sources consultées. L'animation est indisponible plutôt que reconstruite à partir d'éléments terrestres.

### Vue système solaire : approche des sondes (28 octobre 2026)

La sélection d'une sonde conserve la scène du système solaire et active son trajet archivé. Les mêmes modèles détaillés que dans les vues isolées sont chargés à l'approche, avec leurs matériaux et reflets. Le catalogue `static/solar/probe-models.json` est régénéré avec les modèles : échelle physique issue des dimensions GCAT déjà intégrées, ou de la documentation JAXA pour JUICE ; les dimensions estimées restent identifiées dans ce catalogue. Aucun modèle n'est téléchargé à l'ouverture de la vue d'ensemble.

La caméra et les modèles utilisent l'origine flottante de la sonde pour conserver la précision à quelques mètres malgré les distances interplanétaires. Une portion interpolée du trajet rejoint sa position courante sans espace entre le trait et le modèle. Le zoom traverse rapidement les distances interplanétaires et accélère à l’approche de la sonde, en gardant une distance minimale hors du modèle.

Le Soleil conserve à distance l'apparence lumineuse du ciel étoilé, avec une transition progressive vers la surface orange lorsque son disque devient suffisamment grand. Les positions du Soleil et de la Terre utilisées par le halo sont exprimées dans le même repère flottant que la scène ; le ciel des autres pages conserve son comportement habituel.

Le clic sur la sonde cadre directement son modèle, à environ 5–7 % de la largeur de la vue, sans quitter le système solaire. Le Soleil reste légèrement à gauche et au-dessus du cadrage ; les positions réelles, les orbites et le trajet sont conservés. La molette permet ensuite d’ajuster la distance.

### Simulation cinématique des trajets (28 octobre 2026)

- « Simuler le trajet » remplace le menu des événements. Chaque film utilise une durée adaptée au nombre de survols et de phases importantes, une horloge non linéaire et les mêmes états de lecture/pause que la chronologie. Les croisières sont accélérées ; les approches et les passages près du périastre sont ralentis. La barre espace et le bouton Pause fonctionnent également lorsque la scène est dans son cadre intégré.
- Les trajectoires annuelles et les fenêtres fines des événements sont fusionnées en conservant les vecteurs position/vitesse UTC géocentriques ICRF. Les fenêtres fines remplacent les échantillons plus espacés. Aucune portion manquante n'est interpolée au-delà de la cadence autorisée, et aucune orbite de parking ou phase de lanceur absente des archives n'est inventée.
- Les positions historiques quotidiennes du Soleil et des planètes sont importées depuis [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html), dans le même référentiel, puis préparées avant la lecture. Le survol lunaire de JUICE et le passage d'Arrokoth utilisent des fenêtres dédiées à dix minutes. Les états sources sont conservés dans `resources/cinematic-planets` ; les fichiers de lecture sont dans `static/solar/history`.
- Les rapprochements connus au jour près sont recentrés sur le minimum de distance calculé à partir des vecteurs publiés. L'interface conserve la date publiée de l'événement. Les orbites relatives à Saturne et Jupiter sont présentées dans le repère de la planète, avec une caméra inclinée pour rendre la courbure visible. Le tracé héliocentrique de la mission reste issu des mêmes états ; il ne reçoit pas de boucles décoratives.
- Les repères incluent, lorsqu'ils sont documentés, lancement, séparation, déploiements, manœuvres en espace profond et survols. Sources supplémentaires : [déploiements JUICE, ESA](https://www.cosmos.esa.int/web/juice/payload), [opérations de déploiement JUICE, équipe de mission](https://www.sciencedirect.com/science/article/pii/S0094576524005496), [déploiement du pare-soleil JWST, NASA](https://www.nasa.gov/news-release/sunshield-successfully-deploys-on-nasas-next-flagship-telescope/), [miroir JWST, NASA](https://science.nasa.gov/blogs/webb/2022/01/08/primary-mirror-wings-deployed-all-major-deployments-complete/), [manœuvres et survol terrestre de Juno](https://www.nasa.gov/history/10-years-ago-juno-launched-to-observe-jupiter/), [orbites de Juno](https://science.nasa.gov/mission/juno/juno-orbits/), [Grand Finale de Cassini](https://science.nasa.gov/mission/cassini/faq/). Les dates de coiffe ou de poussée non trouvées ne sont pas remplacées par des horaires supposés.
- Les missions encore suivies arrivent à la date de préparation du film. Une mission détruite ou sans couverture récente s'arrête à sa dernière position archivée, avec une indication explicite dans le lecteur. IKAROS reste sans film de trajectoire tant qu'aucune archive exploitable n'est disponible.
- La Terre de la vue système solaire utilise désormais le matériau réaliste Atlas : composites NASA Blue Marble, Black Marble et nuages, ombres calculées à la date consultée et atmosphère de bord. La reconstruction du matériau soustrait le centre terrestre dans le repère flottant ; l'éclairage ne suppose pas que la Terre est à l'origine du cadre de la caméra. Il ne s'agit pas de météo historique ou en direct.

Les archives annuelles des sondes sont également affinées avec ces fenêtres, pour conserver les mêmes survols dans les vues ordinaires et la simulation. Pour Arrokoth, la cible Horizons `2486958` utilise la reconstruction de navigation `NavSBE_2014MU69_od159` compatible avec New Horizons ; la solution astrométrique générale `486958;` ne sert pas au passage rapproché. Le contrôle donne environ 3 552 km de distance minimale sur la grille à une minute, cohérent avec le survol de 3 538 km publié par [la NASA](https://science.nasa.gov/solar-system/kuiper-belt/arrokoth-2014-mu69/facts/).

Le rendu du trajet utilise des tampons locaux de 256 segments. Seuls les segments antérieurs à la date consultée et un éventuel segment final partiel sont soumis au rendu. Le masquage temporel dans le fragment shader a été retiré : aucun sommet futur ne peut traverser le plan proche de la caméra pendant les rotations. Chaque tampon soustrait son origine avant conversion en mètres, et le raccord proche de la sonde utilise les mêmes archives.

Le rythme est désormais alloué par événement : 11 secondes par survol, 14 par orbite, dont 60 % du temps sur la demi-heure centrale des survols. Voyager 2 dure environ 75 secondes avec son introduction. Les survols alternent cadrage planétaire et modèle 3D à son échelle physique avec la planète en arrière-plan. Les premières archives de Voyager étant postérieures au lancement (environ 1 500 km d’altitude), une introduction de cinq secondes, explicitement schématique, montre un point quittant la surface terrestre dans la direction de la première position archivée. Cette liaison illustrative ne représente ni le pas de tir exact ni une télémétrie d’ascension, n’ajoute aucun vecteur aux archives et garde la chronologie au premier état disponible. Les heures de décollage de Voyager sont corrigées selon les pages NASA [Voyager 1](https://science.nasa.gov/mission/voyager/voyager-1/) et [Voyager 2](https://science.nasa.gov/mission/voyager/voyager-2/).

### Départ terrestre, rythme et anneaux de Saturne

- Le départ utilise le pas de tir GCAT lorsqu’il est documenté : LC-41 pour Voyager 1/2, Juno et New Horizons ; LC-40 pour Cassini ; ELA-3 pour JUICE, JWST, BepiColombo, Herschel et Planck. Coordonnées : [table des pas de tir, GCAT / J. McDowell](https://www.planet4589.org/space/gcat/data/tables/lp.html), CC BY 4.0. La carte et le point sont dans le même repère terrestre. L’ascension manquante reste une liaison illustrative, explicitement schématique, entre le lieu réel et les premières archives ; aucune télémétrie n’est fabriquée.
- Pendant la phase terrestre, le trajet est géocentrique et le tracé héliocentrique est masqué. Il évite ainsi de montrer un départ resté à l’ancienne position de la Terre pendant que celle-ci avance sur son orbite. Les transits disposent chacun de 12 à 30 secondes selon leur durée ; Voyager 2 dure environ 169 secondes. Les gros plans gardent la sonde au centre, et les orbites planétaires sont masquées sous vingt rayons du corps observé, puis rétablies en vue d’ensemble sans changer le choix de l’utilisateur.
- Les messages de rendu sont regroupés : une seule image récente par rafraîchissement, et la pause vide les images devenues obsolètes. La pause automatique après manipulation demande explicitement un arrêt plutôt qu’une bascule susceptible de relancer la lecture.
- Saturne conserve une géométrie annulaire physique mais utilise désormais la texture radiale RGBA `2k_saturn_ring_alpha.png`, déjà fournie par [Solar System Scope / INOVE](https://www.solarsystemscope.com/textures/), CC BY 4.0. Les trois bandes unies sont remplacées par un anneau détaillé à transparence variable, visible des deux côtés, éclairé selon le Soleil et ombré par Saturne. Cette texture est une représentation cartographique, pas une simulation individuelle de chaque particule de glace. Ce changement ne télécharge pas un modèle tiers opaque et ne modifie pas l’orientation astronomique de Saturne.

### Suivi continu et commandes de pause

La cible de caméra reste désormais la position de la sonde dans toutes les phases du film, y compris pendant les transitions (le point illustratif pendant l’introduction). Les changements de distance et d’angle s’étalent sur trois secondes, jusqu’à cinq secondes au départ d’un survol ; les directions sont interpolées sur la sphère unité pour éviter une bascule lors de directions opposées. L’inertie manuelle est annulée quand le film reprend le contrôle.

Tous les tracés (trajet global, trajet local, raccord proche et orbites planétaires) sont masqués pendant les événements et gros plans. Ils ne réapparaissent qu’après la transition vers le transit. Le lecteur conserve les préférences des cases d’affichage. La commande souris de lecture est activée au relâchement du pointeur et déduplique le clic natif ; le clavier reste utilisable. Le libellé du bouton n’est plus remplacé chaque image et affiche « En pause · Reprendre » à l’arrêt, y compris après un clic sur la carte.

Le [rapport de vol NASA TC-6 / Voyager 1](https://www1.grc.nasa.gov/wp-content/uploads/TC-6-Voyager-Flight-Data-Report-1976.pdf), page imprimée 29, rapporte 43,4 minutes de vol balistique en orbite de parking avant le deuxième allumage du Centaur à T+3199,8 s. Cela confirme une phase de parking, mais ne fournit pas ici une série de positions couvrant l’ascension. Aucune révolution complète supplémentaire n’a été ajoutée aux archives par déduction.

Le réaffichage des lignes en transit ne dépend plus de la fin du fondu de cinq secondes : dès que la caméra dépasse vingt rayons du corps quitté, orbites et trajet réapparaissent ensemble. Les gros plans et les événements gardent leurs lignes masquées.

Le retour des orbites et du trajet en vue large est accompagné d’un fondu d’opacité de 700 ms. Il est appliqué aux attributs couleur de tous les tampons de lignes, avec rendu transparent Cesium standard, et ne dépend pas de l’avancement de la chronologie ; il continue donc lorsque le film est en pause.

### Survols lisibles, modèles des corps rencontrés et récupération des archives

- La caméra vérifie la ligne de vue de la sonde par rapport aux corps proches, évite les positions à l’intérieur des planètes et élargit le cadrage au limbe. Cette correction entre progressivement en action à l’approche d’une planète. Les rotations sont limitées à environ 18 degrés par seconde et les zooms à un facteur six par seconde, hors déplacement explicite dans la chronologie et correction nécessaire pour éviter une occultation. Les positions des objets et la direction solaire ne sont pas déplacées pour produire cet effet.
- Les modèles de sondes restent lisibles pendant les événements avec une taille minimale de 64 pixels. Il s’agit d’un agrandissement visuel limité au contexte cinématique, sans modifier leur position. La navigation manuelle revient à l’échelle physique ; le rayon physique utilisé par la caméra est conservé séparément.
- Les phases identifiées comme des orbites utilisent une caméra reculée centrée sur la planète, avec angle inertiel et distance fixes. Le plan d’orbite sert à choisir l’angle pour montrer la révolution sans rotation de caméra.
- Pluton reçoit la [mosaïque couleur globale NASA/JHUAPL/SwRI](https://science.nasa.gov/resource/pluto-global-color-map/) de New Horizons (5926 × 2963 pixels) et une sphère au rayon IAU de 1188,3 km. La rotation et le pôle proviennent du PCK NAIF `pck00011.tpc`. La couverture et la résolution de l’image varient selon les régions.
- Arrokoth reçoit le modèle scientifique [NASA/PDS MU69_MERGED](https://pds-smallbodies.astro.umd.edu/holdings/pds4-nh_derived%3Aarrokoth_geophysics-v1.0/shape_models/mu69_merged.obj), 53 755 sommets et 107 506 faces, conservé à ses dimensions kilométriques et transformé en tampons locaux de positions/normales/indices. La rotation utilise `nh_arrokoth_001.tpc` du [jeu de noyaux New Horizons](https://naif.jpl.nasa.gov/pub/naif/pds/data/nh-j_p_ss-spice-6-v1.0/nhsp_1000/data/pck/), pour le repère MU69_FIXED de cette génération de forme. Le modèle inclut des zones non observées estimées par ses auteurs. La teinte rouge est uniforme et illustrative ; aucune texture globale photographique d’Arrokoth n’est inventée.
- Les lunes citées dans les événements (notamment Titan et la Lune) réutilisent les cartes déjà sourcées du catalogue des surfaces. L’éclairage des surfaces est calculé avec le Soleil historique et les orientations PCK à la date consultée. La météo historique, les nuages variables et l’attitude télémesurée des sondes ne sont pas reconstruits.
- Les pages de missions dont les éphémérides sont locales lisent ces archives directement pour leurs positions ; elles ne dépendent plus d’une réponse préalable réussie du moteur natif. Les tests contrôlent les positions actuelles ou finales de toutes les missions disposant d’archives. La dernière position de Cassini est au 15 septembre 2017 à 10:30 UTC, à environ 62 112 km du centre de Saturne, et non près de Jupiter. La récupération retourne à la vue isolée et reste en pause à la limite des archives, pour ne pas faire disparaître la sonde en lisant au-delà de la couverture.
- Les fiches de corps célestes gardent nom et croix dans un en-tête non défilant ; seul le contenu des données défile. Réduction, réouverture et clic dans le vide restent disponibles. « Simuler le trajet » est un bouton d’action sans flèche de menu.
- Mir, Skylab et Tiangong ont fait l’objet d’un audit des axes des actifs présents. Les rotations de présentation de 45 degrés sont neutralisées pour les modèles concernés, et le modèle filaire Tiangong conserve son repère original Z vertical. L’ISS est préservée. Les autres pages de stations sans modèle 3D dans le registre courant n’ont pas d’axes de maillage à corriger. Ces ajustements ne fournissent pas d’attitude réelle historique ; détail dans `resources/station-model-orientation-audit.json`.


### Cadrage rapproché et repères des stations — 28 octobre 2026

Les survols courts approchent désormais le modèle de la sonde à son échelle physique, avec une direction visant le limbe planétaire. La protection contre les collisions reste active, mais le cadrage rapproché ne force plus la planète entière dans le champ. Le modèle contextuel reste visible avec un minimum de 160 pixels pendant le film. La variation de distance est accélérée pendant ces approches pour atteindre effectivement le gros plan pendant la lecture continue. Les phases orbitales répétitives longues détectées dans les archives gardent au contraire une caméra fixe reculée. Gaia dispose maintenant du pas ELS de Kourou pour son introduction schématique, sans inventer les positions manquantes avant la première archive.

Pour les stations hors ISS, les repères des exports blancs et texturés ont été calibrés séparément après transformation glTF. Mir utilise un repère gravitationnel de référence, Skylab un pointage solaire de référence et Tiangong une orientation nominale vers la Terre. Sources : [axes de Mir décrits par Thomas Reiter, ESA](https://www.esa.int/esapub/bulletin/bullet88/reite88.htm), [modes de Mir, NASA](https://ntrs.nasa.gov/api/citations/20020050384/downloads/20020050384.pdf), [repère solaire de Skylab, NASA TM-82412](https://ntrs.nasa.gov/api/citations/19810013544/downloads/19810013544.pdf), [configuration et stabilisation de Tiangong, CMSE](https://www.cmse.gov.cn/fxrw/mengtian/mtjj/202211/t20221106_51269.html). Ces modes documentés ne fournissent pas l’attitude réelle à chaque instant, notamment lors des changements de mode et pertes de contrôle. L’ISS est conservée sans changement. Détails et périmètre : `resources/station-model-orientation-audit.json`.


### Stations historiques : reconstitutions Atlas — 29 octobre 2026

Neuf nouveaux modèles couleur sont disponibles à la demande : Saliout 1, 2, 3, 4, 5, 6, 7 et Tiangong-1/2. Les stations Almaz/OPS utilisent les variantes Saliout 2, 3 et 5, sans confusion avec le satellite radar Almaz-1 des années 1990. Mir, Skylab, l’ISS et la station chinoise actuelle conservent leurs modèles précédents.

Les silhouettes et cotes principales des stations soviétiques suivent les figures 2-3, 2-7, 2-8, 2-9 et les tableaux du rapport NASA RP-1357, [Mir Hardware Heritage, partie 2](https://www.nasa.gov/wp-content/uploads/static/history/SP-4225/documentation/mhh/mirhh-part2.pdf). Saliout 1 dispose de quatre panneaux ; les Almaz de deux ; Saliout 4, 6 et 7 de trois panneaux, dont le panneau supérieur. Un seul port pour la première génération, deux pour Saliout 6/7. Saliout 7 est représentée dans sa configuration initiale, sans les extensions installées lors des EVA ultérieures. Les envergures Almaz sont approximatives, contrairement aux cotes documentées de longueur et de diamètre. Les petits équipements, raccords, couleurs et finitions sont des interprétations visuelles, pas une restitution de plans industriels.

Tiangong-1 suit la [description ESA des deux compartiments et des deux panneaux](https://blogs.esa.int/rocketscience/2018/03/26/tiangong-1-frequently-asked-questions-2/). Tiangong-2 reprend les dimensions publiées par [CMSE](https://en.cmse.gov.cn/news/201907/t20190713_44588.html), avec ses équipements extérieurs distincts. Les visiteurs Soyouz/Shenzhou/Progress/TKS visibles sur certaines illustrations ne sont pas attachés en permanence aux modèles : leurs présences dépendent de la date. Les animations de panneaux et changements matériels historiques ne sont pas inférés par ces modèles.

Géométries, textures de cellules solaires et revêtements thermiques créés dans `scripts/build_historical_stations.py` ; sources originales en mètres et fichiers GLB autonomes sous `resources/detailed-originals/` et `static/images/detailed/`. Matériaux glTF PBR : aluminium, isolant multicouche argent/or, revêtement clair, vitrage et cellules solaires. Les surfaces métalliques utilisent l’éclairage ambiant et la carte de reflets locale déjà employés sur les autres modèles. Les textures de relief fournissent leurs tangentes pour un rendu portable. Modèles originaux Atlas sous CC BY 4.0 ; les références historiques ne sont pas présentées comme leurs auteurs.

Inventaire des cotes, variantes et incertitudes : `resources/historical-station-models.json`. Validation Khronos glTF Validator : `resources/historical-stations-gltf-validation.json`. Aperçu hors navigateur des géométries et matériaux : `resources/historical-stations-preview.jpg` ; ce rendu de contrôle ne remplace pas une vérification visuelle dans Cesium. L’orientation utilise un repère orbital de référence, jamais une attitude historique prétendument mesurée. Les fichiers de l’ISS sont conservés.


### Saliout : reprise visuelle des coques et panneaux — 29 octobre 2026

La deuxième version remplace les coques uniformément claires par des textures UV propres à chaque variante : textile vert sombre, plages thermiques claires et raccords métalliques pour DOS-1 ; revêtements différenciés pour les Almaz ; enveloppes claires avec zones brun-rouge pour les dernières DOS. Les deux premiers exemples fournis par l’utilisateur sont des rendus 3D, utilisés comme guides de détail, et le troisième une photographie de la station avec un visiteur amarré. Ils ne sont pas assimilés à des plans industriels.

Le [récit historique NASA du lancement de Saliout](https://www.nasa.gov/missions/station/50-years-ago-launch-of-salyut-the-worlds-first-space-station/) confirme le maintien du marquage « ЗАРЯ » après le changement du nom de la station et fournit les photographies de référence des générations successives. Les volumes principaux restent fondés sur RP-1357. Placement précis des inscriptions, coutures, détails de surface et teintes est interprété ; aucune photographie trouvée en ligne n’est copiée dans les textures. Textures originales 2048×1024 générées par `scripts/build_salyut_textures.py` ; panneaux modélisés en quatre ou six feuilles découpées, charnières, raidisseurs et faces avant/arrière distinctes. Les équipements avant ont été enrichis et les rails/hublots replacés au rayon effectif de leur compartiment. Les visiteurs ne sont pas attachés en permanence.

Les sept modèles Saliout occupent maintenant environ 2,5 à 2,9 Mo chacun ; chargement à la demande conservé. Tiangong-1 et Tiangong-2, les modèles existants et l’ISS ne sont pas modifiés par cette révision. Aperçu hors navigateur : `resources/salyut-rework-preview.jpg`.


### Soyouz amarrés aux Saliout — 29 octobre 2026

Ajout de sous-ensembles Soyouz indépendants dans les modèles historiques, visibles uniquement pendant les intervalles d’amarrage. Les trois modules, les tuyères, les hublots, les antennes et les panneaux sont modélisés ; la variante 7K-T « Ferry » est représentée sans panneaux, contrairement aux versions Saliout-1 et Soyouz-T. Sources de forme et d’évolution : [NASA RP-1357, partie 1](https://historycollection.jsc.nasa.gov/history/shuttle-mir/references/documents/mirhh-part1.pdf). Configurations et ports : [partie 2](https://historycollection.jsc.nasa.gov/history/shuttle-mir/references/documents/mirhh-part2.pdf), sections 2.2 à 2.8, y compris les transferts de ports documentés. Les séjours des équipages ne sont pas utilisés comme substituts aux présences des véhicules : les équipages pouvaient changer de Soyouz.

`resources/salyut-soyuz-dockings.json` enregistre les intervalles et leur précision. Les dates connues uniquement au jour sont représentées avec des limites de journée UTC ; aucune heure exacte n’est prétendue pour ces cas. Soyouz 11 est borné du 7 juin 1971 07:49 UTC au 29 juin 18:28 UTC. Les tentatives infructueuses et accostages temporaires de Soyouz 10/25 ne sont pas montrés comme des séjours amarrés. Saliout 2 ne reçoit aucun Soyouz. Les modules orbitaux abandonnés et les visiteurs Progress/TKS ne sont pas modélisés dans cet ajout.

Saliout 6/7 disposent des géométries aux deux ports ; jusqu’à deux véhicules sont montrés simultanément selon les archives, avec bascule après les transferts. L’origine, les proportions et la normalisation de la station sont calculées avant l’ajout des visiteurs. Les positions des vaisseaux restent rigidement attachées au repère de leur station. La visibilité est recalculée avec l’horloge du globe, y compris en lecture arrière. Géométries et finitions interprétées, sans télémétrie d’attitude des véhicules. Chargement à la demande et validation glTF conservés.


### Choix de présentation : un Soyouz permanent sur chaque Saliout — 29 octobre 2026

À la demande explicite de l’utilisateur, le rendu des sept Saliout montre désormais un Soyouz en permanence, indépendamment de la chronologie. Un seul vaisseau est inclus par modèle : version Saliout-1 à l’avant de DOS-1 ; Ferry sans panneaux sur DOS-4 et les trois Almaz ; Soyouz-T à l’avant des DOS-5/6. Pour les Almaz il se trouve au port arrière. Cette composition est illustrative : elle inclut Saliout 2, qui n’a jamais reçu de Soyouz. Les fichiers de dates historiques ne sont pas modifiés et ne servent pas à justifier cet assemblage. Le comportement permanent est explicitement signalé dans les métadonnées des modèles et limité à Saliout. Il remplace pour ces modèles la visibilité précédemment asservie aux dates.


### Tiangong-1 : reprise du modèle cible — 29 octobre 2026

Le modèle Tiangong-1 est repris séparément dans `scripts/tiangong_one_surfaces.py` : deux cylindres de diamètres différents, enveloppes blanches/grises, arrière sombre, deux ailes de trois feuilles rectangulaires sombres, parabole avec réflecteur et support de réception, anneau d’amarrage ouvert avec trois guides et équipements de rendez-vous. Le bloc doré générique du modèle précédent est retiré ; l’or reste limité à de petits équipements. Le drapeau et les textures des cellules sont des dessins originaux intégrés au GLB.

Sources : [CNSA, fiche Tiangong-1](https://www.cnsa.gov.cn/n6758824/n6759008/n6759013/c6794314/content.html) pour les compartiments, la longueur de 10,4 m, le diamètre maximal de 3,35 m et les équipements avant ; [ESA, description et ailes d’environ 3 × 7 m](https://blogs.esa.int/rocketscience/2018/03/26/tiangong-1-frequently-asked-questions-2/) ; [analyse CNR du véhicule](https://iris.cnr.it/retrieve/7467f47c-e5c8-4139-a9f4-9727d8630997/prod_429945-doc_159801.pdf) pour le compartiment de service de 2,8 m et l’envergure de 17 m. Les photos/rendus fournis par l’utilisateur guident les finitions et l’agencement visuel, avec des différences selon les représentations. Les petits équipements, surfaces, positions du drapeau, orientation de la parabole et angles de panneaux restent interprétés, sans prétention d’attitude mesurée. Le Shenzhou de la première maquette fournie est un véhicule distinct et n’est pas incorporé au modèle cible.

L’axe +X reste côté amarrage et +Z côté nadir nominal. Les autres fichiers GLB ont été comparés par SHA-256 avant/après et sont identiques. Aperçu de contrôle hors navigateur : `resources/tiangong-one-preview.jpg`. Tests dédiés : `tests/tiangong-one-model.cjs`, et validation glTF sans erreurs ni avertissements.


### Tiangong-1 avec Shenzhou amarré — 29 octobre 2026

Ajout d’un Shenzhou représentatif des versions VIII/IX/X sur le port avant de Tiangong-1, à la demande de l’utilisateur. La composition est permanente et illustrative, dans le même principe que les Soyouz des Saliout ; elle ne représente pas l’état historique à chaque date. Les trois modules sont distincts : compartiment orbital cylindrique côté amarrage, capsule de retour et module de propulsion, avec deux ailes solaires sur ce dernier, des hublots, une trappe, des antennes et des tuyères.

La [fiche CNSA de Shenzhou VIII](https://www.cnsa.gov.cn/english/n6465715/n6465717/c6840345/content.html) et la [conférence de mission CMSE du 31 octobre 2011](https://www.cmse.gov.cn/fxrw/tgyhyszbhrw/rwgk/201110/t20111031_38221.html) donnent la longueur de 9 m, le diamètre maximal de 2,8 m et les fonctions des trois modules. Le compartiment orbital modifié pour l’amarrage n’a pas les ailes des premières versions Shenzhou. Les dimensions secondaires des ailes, détails et finitions restent interprétés à partir des références visuelles ; aucun Soyouz n’est substitué au véhicule chinois.

Le sous-ensemble est séparé dans le GLB et les métadonnées (`vehicle: shenzhou`, `visibility: always`). Il utilise le même repère rigide que la station. La normalisation et l’origine de Tiangong-1 sont conservées à partir des bornes de la station seule. Le modèle assemblé fait environ 1,24 Mo et reste chargé à la demande. Les autres fichiers GLB restent identiques. La fonction `attach_shenzhou` de `scripts/tiangong_one_surfaces.py` conserve la génération reproductible du modèle.


### Tiangong-1 : correction du repère orbital — 29 octobre 2026

Le moteur ne sérialisait le vecteur de vitesse inertielle exprimé dans le repère terrestre que pour l’ISS. Tiangong-1 n’atteignait donc jamais son calcul d’orientation nominale en vol : il reprenait le repère local est/nord/haut, alors que la géométrie est calibrée avec +Z côté nadir. `src/orbit_math.rs` transmet maintenant ce vecteur également pour NORAD 37820, dans le moteur natif et le moteur navigateur partagé. Son calcul SGP4 et ses coordonnées ne changent pas. L’ISS conserve le même calcul.

Les données d’anciennes éditions ou privées de vitesse gardent désormais le côté +Z de Tiangong-1 orienté vers le bas ; le cap de secours reste illustratif. La géométrie du Shenzhou a été vérifiée séparément : le compartiment orbital est côté station et le module de propulsion côté extérieur ; le plan de contact est à 2 cm de la face d’amarrage avant dans cette reconstruction. Aucune rotation arbitraire de la capsule ni des panneaux n’est ajoutée. La présence permanente de Shenzhou reste une composition visuelle, sans prétention d’attitude historique mesurée.

Tests ajoutés : émission et rotation du vecteur de vitesse dans les deux moteurs ; absence d’inversion du modèle avec données anciennes ; interface et ordre des modules du Shenzhou ; régressions de l’ISS conservées.


### GLB originaux d’après les références Tiangong / Tiangong-1 — 29 octobre 2026

L’utilisateur a explicitement demandé de créer de nouveaux fichiers GLB à partir des références visuelles, plutôt que d’obtenir les fichiers Sketchfab originaux. Les aperçus publics des modèles [Tiangong Space Station de thaweverything](https://sketchfab.com/3d-models/tiangong-space-station-205e0d24d4994eb9a232abe728e10a0f) et [Tiangong-1 de tashtego](https://sketchfab.com/3d-models/tiangong-1-686ce97cc8fe42f4afb5988df95fcc48) ont été examinés comme références de configuration et d’aspect. Aucun tampon de la visionneuse, maillage, texture, fichier original ou animation de ces auteurs n’a été extrait ou redistribué. Les nouvelles géométries et textures sont générées par les scripts Atlas ; la ressemblance visuelle ne constitue pas une promesse d’identité avec les originaux. Les fichiers sont des extérieurs, sans les aménagements intérieurs ni animations des modèles commerciaux.

La nouvelle Tiangong est construite dans `scripts/build_tiangong_recreation.py` : Tianhe, Wentian et Mengtian en T, six ailes solaires (les quatre ailes des laboratoires comportent deux couvertures parallèles et une structure de déploiement), revêtements clairs, conduites, hublots, drapeaux, plateformes extérieures et un bras avec sept articulations visibles. Deux Shenzhou et un Tianzhou sont inclus en configuration fixe illustrative. Les poses du bras, déploiements, accessoires et vaisseaux ne sont pas une reconstitution de l’état exact à la date consultée. Les cotes principales proviennent de [CNSA, présentation du directeur du système](https://www.cnsa.gov.cn/n6758823/n6758838/c10087703/content.html) : Tianhe 16,6 m, laboratoires 17,9 m et diamètre maximal 4,2 m. L’ordre de grandeur de l’envergure des laboratoires et de leurs surfaces suit la [présentation gouvernementale des ailes Wentian](https://english.www.gov.cn/news/topnews/202208/15/content_WS62fa3750c6d02e533532f2f2.html). Toutes les dimensions secondaires sont interprétées. L’ancien fichier CC BY de w29572227 est conservé dans les sources, mais n’est plus le modèle diffusé sous `tiangong.glb`.

Tiangong-1 reprend les couleurs bleues/violettes des cellules, quatre feuilles par aile, les renforts diagonaux dorés et un cerclage plus fin de la coque. Son fichier autonome ne contient pas Shenzhou. La page Atlas conserve séparément la composition avec Shenzhou demandée précédemment. Géométries et shaders standards glTF PBR ; aucune texture de référence copiée.

Fichiers portables en mètres et notice : `resources/atlas-reference-recreations/`. Génération reproductible : `python3 scripts/build_historical_stations.py`, puis `python3 scripts/build_tiangong_recreation.py`, puis `python3 scripts/export_tiangong_reference_glbs.py`. Les GLB de Tiangong et Tiangong-1 ont été intégrés aux registres de chargement à la demande. Repère réaliste Tiangong calibré +X côté amarrage avant / +Z nadir, sans double rotation glTF. Le moteur transmet aussi sa vitesse inertielle ; les anciennes éditions gardent un nadir cohérent. La présentation blanche et l’ISS sont préservées.

Validation Khronos : `resources/tiangong-reference-glb-validation.json` (zéro erreur et zéro avertissement sur les fichiers diffusés et les exports). Tests : `tests/tiangong-recreation.cjs`, `tests/tiangong-one-model.cjs`, les contrôles des matériaux et de l’attitude. Aperçus de contrôle hors navigateur : `resources/tiangong-recreation-preview.jpg` et `resources/tiangong-1-recreation-preview.jpg`. Les autres GLB ont été comparés par empreintes avant/après et sont identiques.

### Tiangong 1, 2 et CSS : surfaces et articulations solaires (29 octobre 2026)

- ESA, [Tiangong-1 FAQ](https://blogs.esa.int/rocketscience/2018/03/26/tiangong-1-frequently-asked-questions-2/) : dimensions, architecture et illustration CMSE.
- CNSA, [Tiangong-2](https://www.cnsa.gov.cn/english/n6465652/n6465653/c6806880/content.html) : dérivé de Tiangong-1, corps 10,4 m / 3,35 m, envergure 18,4 m. La base GLB est commune, avec identification et équipements TG-2 distincts. [CMSE](https://en.cmse.gov.cn/missions/TG2SL/) confirme POLAR ; ses détails extérieurs sont interprétés.
- CNSA, [conception de Tiangong](https://www.cnsa.gov.cn/n6758823/n6758838/c10087703/content.html), et article des concepteurs [Design and Application Prospect](https://spj.science.org/doi/abs/10.34133/space.0035) : structure Tianhe/Wentian/Mengtian, plateformes, bras ; panneaux Tianhe à un degré de liberté, laboratoires actuels à deux.
- Centre de contrôle spatial de Pékin, [brevet CN119440107A, contexte technique](https://patents.google.com/patent/CN119440107A/zh), paragraphes sur les laboratoires Tiangong antérieurs : suivi solaire continu à un degré de liberté ; deux axes pour les laboratoires de la CSS. Le brevet décrit aussi des modes de stationnement et de servo par paliers : ces états opérationnels ne sont pas disponibles en télémétrie et ne sont pas reconstitués.

Les trois modèles utilisent des textures originales de revêtement, rugosité, micro-normales, drapeaux et noms lisibles sur surfaces conformes. Dimensions et disposition principale sont documentées ; les petites fixations, les plaques et la disposition des inscriptions restent une interprétation visuelle, pas un relevé photographique exhaustif. Les GLB ne proviennent pas de l’extraction des modèles Sketchfab. Les articulations suivent la direction astronomique du Soleil et la date consultée avec transitions lissées ; ce sont des orientations nominales calculées, pas des angles moteurs mesurés. Seuls les ensembles solaires tournent ; station, vaisseaux et caméra restent fixes. L’ISS et ses articulations sont conservées.

### Correctif des drapeaux Tiangong-1/2 (29 octobre 2026)

Contrôle des illustrations primaires : [CMSE Tiangong-1, 20 septembre 2011](https://www.cmse.gov.cn/art/2011/9/20/art_1401_23997.html), [illustration CMSE reprise par ESA](https://www.esa.int/ESA_Multimedia/Images/2017/11/Tiangong-1), [CMSE dossier Tiangong-2, 15 septembre 2016](https://www.cmse.gov.cn/dmt/tj/tgehhszsyh/201609/t20160915_41619.html), et surtout [CAST, constructeur, 18 septembre 2016](https://www.cast.cn/3g/news/5162), illustration `14741643603858884.jpg` montrant le drapeau sur le flanc avant du compartiment d’expérience, dégagé de hublot. Les vues ne fournissent pas de coordonnées métriques précises des marquages. La position du drapeau est conservée dans cette zone ; le hublot inventé à x=3,25 m et theta=pi, qui traversait le drapeau dans nos deux reconstitutions, est supprimé. Les drapeaux restent des surfaces conformes à la coque et ne sont pas artificiellement remontés devant le verre. Régression géométrique : aucun hublot ne peut intersecter leurs limites. Les modèles CSS/ISS et les articulations solaires restent inchangés.

### Versions blanches des trois Tiangong (30 octobre 2026)

`scripts/build_tiangong_white.py` extrait les arêtes de forme directement des trois GLB réalistes Atlas actuels. Corps, transitions coniques, anneaux, panneaux, antennes, bras et vaisseaux amarrés proviennent donc de la même géométrie. Textures, drapeaux, inscriptions et petites fixations sont retirés pour garder une représentation blanche lisible. Les poses blanches restent schématiques et fixes, sans suivi solaire ni affirmation d’attitude mesurée. Les axes du chargement GLB sont explicités pour les deux anciens laboratoires, désormais présents dans le registre des modèles blancs. Les dessins de repli sont dérivés des mêmes arêtes, avec une limite de 1 600 segments pour éviter d’alourdir l’affichage des symboles. Aucun modèle réaliste ni fichier ISS n’est modifié par cette génération.

### ISS blanche dérivée de l’assemblage NASA IGOAL (30 octobre 2026)

Le nouveau modèle blanc est produit par `scripts/build_iss_model.py` à partir du modèle détaillé NASA IGOAL déjà référencé dans `resources/detailed-model-sources.json`. Le fichier réaliste, sa calibration, ses textures et ses articulations ne sont pas modifiés. Un cache de géométrie de fabrication est décodé par `scripts/decode_iss_white.cjs` (draco3dgltf), puis soudé et simplifié par `scripts/simplify_iss_white.py` (numpy et fast-simplification). Le cache réduit portable permet de régénérer la version blanche avec Python standard uniquement. Les modules, Cupola, poutre, huit ailes principales, radiateurs et panneaux iROSA suivent l’assemblage NASA ; les arêtes sont extraites dans son repère calibré, sans textures ni mécanisme solaire en mode blanc. La pose reste une représentation schématique de cet assemblage, pas une configuration matérielle historique reconstituée date par date. Les symboles 2D gardent un budget de 1 600 segments. Crédit : NASA IGOAL, adaptation filaire Atlas.

### Orientation blanche et affichage Atlas (30 octobre 2026)

Les blancs ISS et Tiangong/CSS/TG-1/TG-2 sont extraits des modèles détaillés calibrés : ils partagent désormais leur orientation de corps nominale. Les deux chemins de mise à jour de l’ISS blanche passent par `AtlasModelAttitude` au lieu d’imposer ENU. Pour les Tiangong, le blanc délègue seulement l’orientation du corps à la calibration détaillée ; ses panneaux restent fixes. Sans vitesse, la verticale locale de référence est conservée (Cupola/axe nadir ISS vers le centre terrestre ; verticale géodésique de secours pour Tiangong). Ni les positions orbitales ni les animations des versions réalistes ne sont modifiées.

Dans Atlas, les modèles blancs sont limités à l’objet sélectionné et à une distance caméra–objet inférieure à 1 500 km. Tous les objets non sélectionnés, et la sélection en vue lointaine, utilisent les points habituels. Un point reste présent pendant le chargement. La transition est réévaluée au changement de sélection, de distance et de disponibilité du modèle ; les pages dédiées gardent leur affichage. Les régressions vérifient la sélection lointaine, l’approche, le retour au point après dézoom, le blocage des modèles non sélectionnés, les vrais axes du chargeur Cesium, les latitudes polaires et l’absence de réflexion ou déplacement de l’objet.

### Nouvelle Mir réaliste, référence photographique et TurboSquid 529931 (30 octobre 2026)

Le GLB `resources/detailed-originals/mir-atlas.glb` est une reconstitution originale Atlas, sans extraction ni réutilisation de maillage ou texture TurboSquid. L’aperçu public du produit 529931 sert de référence d’aspect, avec les photographies fournies par l’utilisateur. L’ancien modèle Celestia original reste conservé dans les ressources, mais n’est plus servi comme modèle détaillé Mir.

Sources primaires consultées :

- [NASA, Mir Space Station / SP-4225](https://www.nasa.gov/history/SP-4225/mir/mir.htm) : dimensions des éléments, compartiments du module central, grue/équipements et extension d’amarrage de Kristall ; Spektr porte quatre ailes, Priroda n’en porte pas.
- [NASA, plans des modules](https://www.nasa.gov/history/SP-4225/diagrams/mir/mir-diagram.htm) : corps, sas, interfaces et antennes des éléments.
- [ESA, Working Aboard Mir, bulletin 88](https://www.esa.int/esapub/bulletin/bullet88/reite88.htm) : positions relatives dans le repère de la station : Kvant-1 en +X derrière le module central, Kvant-2 en +Y, Spektr en -Y, Kristall en -Z et Priroda en +Z. Leurs assemblages sont orthogonaux ; l’inclinaison apparente sur une photo dépend de la caméra et de l’attitude du complexe.
- [NASA TM-106940, Analysis of Shadowing Effects on MIR Photovoltaic and Solar Dynamic Power Systems](https://ntrs.nasa.gov/citations/19950021792) : modèle nominal à onze ailes, dont deux orientables et une fixe sur le module central ; deux orientables sur Kvant-1, Kvant-2 et Spektr. Le rapport modélise le suivi sur un axe et souligne les attitudes changeantes et l’absence d’horaires exacts de changement. Son suivi en pas de 12,5° est une hypothèse de calcul de l’étude, pas une télémétrie moteur ; il n’est pas présenté comme la loi de commande réellement utilisée dans Atlas.

La reconstruction représente une configuration complète après Priroda, pas un état matériel exact à chaque date historique : assemblage/déplacement des modules, transfert des panneaux de Kristall, dégâts de Spektr en 1997, modes de stationnement et vaisseaux visiteurs ne sont pas reconstitués date par date. Les sources techniques couvrent plusieurs configurations et ne donnent pas une loi d’attitude unique pour toute la vie de Mir. Le corps utilise donc une référence nominale en gradient de gravité, avec l’axe longitudinal vers la Terre, explicitement distincte d’une attitude réelle mesurée. Les panneaux orientables suivent le Soleil calculé et la date de la scène ; les ailes fixes ne tournent pas. La course visuelle bornée +/-90° est conservatrice et illustrative, pas une validation des butées mécaniques réelles. Les détails secondaires des parois, bouteilles, louvres et finitions sont interprétés.

Les scripts `build_mir_recreation.py`, le rapport `mir-recreation.json` et les tests `mir-recreation.cjs` documentent la géométrie, les axes, les pivots et les matériaux. Aucune modification du modèle réaliste ISS ni de ses articulations. Les fichiers sont intégrés en local uniquement.

### Mir : retrait de la reconstruction rejetée et retour au vrai modèle d’auteur (30 octobre 2026)

La reconstitution procédurale Atlas est retirée du registre actif à la demande de l’utilisateur. `scripts/restore_mir_author_model.py` sélectionne le modèle complet de DaveBowman2001 distribué par Celestia, sous CC BY 4.0, déjà vérifié dans `resources/model-research-2026-10-24/mir-source-audit.json`. Source : [CelestiaContent, révision e6d0541](https://github.com/CelestiaProject/CelestiaContent/tree/e6d05411f1ab8aecbd8d72173711ae37f228deaf/extras-standard/mir), auteur [DaveBowman2001/bh sur Celestia](https://celestia.mobi/resources/item/1D013F0D-DF46-4B98-B191-BF2B8DA5389C?lang=ru). Le modèle contient 446 331 triangles, neuf images texturées et soixante matériaux, pour environ 21 Mo en GLB. Les textures et la géométrie source sont conservées ; la présentation ajoute uniquement la normalisation et le repère de chargement déjà calibré. Le rendu conserve l’éclairage et les reflets PBR de l’application.

Recherche comparative : le [modèle NASA Mir](https://science.nasa.gov/3d-resources/mir/) publié ne pèse que 20,39 Ko et contient 5 836 triangles dans sa version épinglée locale ; il convient à la représentation blanche mais n’égale pas les détails du modèle ISS IGOAL. Le [modèle Mir avec Soyuz/Progress de tashtego](https://sketchfab.com/3d-models/mir-station-with-soyuz-and-progress-docked-bd6ac084ae5645848a67597b17665579) affiche environ 29 900 triangles et une licence CC BY-NC ; il n’est pas intégré. Les modèles TurboSquid/Fab restent des références tant que leurs fichiers et droits d’utilisation ne sont pas fournis. Aucun achat ni extraction d’un visualiseur protégé.

L’animation solaire inventée pour la reconstruction Atlas est désactivée sur ce fichier d’auteur, qui ne fournit pas d’articulations validées dans la conversion actuelle. Les positions orbitales et la référence d’orientation sont conservées. Il ne faut pas confondre la disponibilité d’un beau modèle texturé avec celle d’une télémétrie d’attitude ou d’un rig mécanique historique. Le modèle actif est un véritable asset d’auteur ; la reconstruction rejetée n’est plus servie. Le script de reconstruction demeure une ancienne expérience manuelle et ne doit pas être relancé pour remplacer cet asset.


### Mir : surfaces détaillées et version blanche commune (30 octobre 2026)

Le modèle de DaveBowman2001/Celestia reste la source CC BY 4.0. `scripts/detail_mir_surfaces.py` conserve intégralement son binaire de géométrie et ses neuf images couleur, puis ajoute six cartes PBR (normales et rugosité pour métal blanc, chrome et cellules solaires). Le microrelief est une finition illustrative discrète, pas une nouvelle observation de détails physiques ou de dommages. Les tangentes sont calculées au préalable pour éviter un comportement variable des cartes normales entre navigateurs. Le fichier source original est intact. La restauration passe désormais par cette adaptation reproductible.

`scripts/build_mir_white.py` extrait les arêtes caractéristiques du même assemblage détaillé. Modèle blanc autonome de 23 414 segments (563 ko), sans textures ni téléchargement du GLB détaillé ; dessin 2D issu des mêmes contours. Les deux modes utilisent le même repère et la même pose des panneaux, sans retournement au changement de mode. Le générateur général des modèles blancs relance aussi cette étape.

Vérification documentaire : [NASA TM-106940, Analysis of Shadowing Effects on MIR Photovoltaic and Solar Dynamic Power Systems](https://ntrs.nasa.gov/api/citations/19950021792/downloads/19950021792.pdf), pp. 2–3, décrit des ailes fixes et articulées sur un axe ainsi que plusieurs classes d’attitude. Ce rapport de 1995 est une analyse de configurations et de modes, pas une télémétrie couvrant toute la vie de Mir ; son dispositif solaire dynamique projeté ne doit pas être ajouté comme matériel réellement installé. [La NASA](https://www.nasa.gov/history/SP-4225/mir/mir.htm) décrit l’évolution modulaire de Mir et [l’ESA](https://www.esa.int/About_Us/Corporate_news/Mir_FAQs_-_Facts_and_history) rappelle les dommages de Spektr en 1997. Nous conservons donc la pose déployée du modèle complet après Priroda et le repère gravitationnel nominal déjà explicité, sans prétendre retrouver les angles réels de chaque panneau à chaque date. Aucune animation d’articulations devinées n’est ajoutée.

Validation : conservation binaire des données originales, normales/tangentes, orientation commune blanc/détaillé avec ou sans vitesse, absence de miroir et conservation de la position orbitale. Aperçu filaire inspecté hors navigateur ; le rendu PBR GPU reste à vérifier sur la page locale. L’ISS n’est pas modifiée.


### Mir : couleurs, marquages et correction des trois axes (30 octobre 2026)

Référence utilisateur : photographie de Mir fournie le 30 octobre. Vérification primaire : [NASA STS-86, photo 61](https://www.nasa.gov/history/SP-4225/sts86/photo/sts-86-photo-61.htm), [photographie](https://www.nasa.gov/wp-content/uploads/static/history/SP-4225/imagery/photos/sts-86/86p-061.jpg). La légende NASA identifie les inscriptions rouges en cyrillique. `scripts/color_mir_textures.py` redessine les deux marquages de drapeau et « МИР / СССР » aux emplacements UV déjà présents dans le fichier d’auteur, sans ajouter de plaques ou changer les formes. Les drapeaux et inscriptions sont une restitution graphique interprétée ; ce n’est pas une numérisation photographique. Les cartes couleur ajoutées séparent les revêtements blancs satinés, les couvertures thermiques blanc cassé, les raccords chromés, l’adaptateur cuivré/orange et ses éléments dorés. Les matériaux 26 et 41 correspondent aux faces opposées de voilures de la source : leur grille est conservée avec une finition ocre de revers. Les faces bleues conservent leurs cellules. Les fichiers sources et leurs neuf images originales demeurent intacts ; seules leurs affectations de couleur dans l’adaptation sont remplacées. Les couleurs réelles varient avec l’éclairage : cette finition ne constitue pas une mesure colorimétrique historique.

Correction d’orientation : `src/orbit_math.rs` omettait Mir de la liste des objets recevant la vitesse inertielle exprimée en axes terrestres. L’affichage tombait donc sur une orientation ENU de secours. Mir 16609 reçoit maintenant ce vecteur dans le moteur partagé natif/web. `static/model-attitude.js` construit son repère à trois axes avec le nadir radial, la vitesse projetée dans le plan tangent et leur produit vectoriel. Les mêmes transformations calibrées s’appliquent aux contours blancs et au modèle détaillé. L’ISS reste inchangée. Le mode demeure une référence gravitationnelle nominale, pas une restitution des manœuvres historiques que la position seule ne contient pas. Tests : vecteur moteur natif et web-core, orbite entière de 720 pas, continuité, absence de miroir, position inchangée et cas de vitesse manquante/dégénérée. GLB validé : zéro erreur, un avertissement de métadonnées PNG déjà présent dans l’original. Aperçus couleur et atlas contrôlés hors navigateur ; rendu PBR GPU non confirmé dans cette session.


### Mir : nouvelle reconstruction d’après les 24 images fournies (30 octobre 2026)

Demande : recommencer le modèle à partir du dossier local `Desktop/Mir/`. Les 24 rendus de perspective, gros plans, vues ombrées et filaires ont été inspectés : contact général, puis notamment `mir_cw04`, `mir_cw11` et `wir02` en pleine définition. Leurs empreintes figurent dans `resources/mir-reference-rebuild.json`. Les images servent de références visuelles ; aucun fichier géométrique, texture commerciale ou tampon de visualiseur n’en a été extrait. La nouvelle géométrie et les images de matériaux sont originales, produites par `scripts/build_mir_reference.py`. Les sources Celestia et les essais précédents ne sont plus les fichiers sélectionnés par le manifeste actif.

Le fichier `resources/detailed-originals/mir-reference.glb` contient un assemblage distinct : nœud central, corps principal à épaulements, Kvant-1, Kvant-2, Spektr, Priroda, Kristall, adaptateur d’amarrage orange/doré, Soyouz et Progress. Ces deux vaisseaux sont une composition fixe inspirée des références, pas une restitution de leur présence à chaque date. Les dimensions générales s’appuient sur les références NASA/ESA déjà citées. Les revêtements, supports, boîtiers et détails secondaires sont interprétés depuis les images et ne constituent pas une CAO d’ingénierie. Les panneaux sont segmentés, avec faces avant/arrière distinctes, cadres et diagonales ; Kvant-1 comporte les longues sections en accordéon. Les voilures Kvant-2 et Spektr ont des plans distincts de ceux du bloc principal : la revue des rendus a permis de supprimer des intersections coplanaires qui produisaient du scintillement.

Des radiateurs courbes avec tuyauterie réellement modélisée, mains courantes, colliers, fenêtres, bouteilles, boîtiers, treillis Sofora et Strela et mécanismes d’amarrage ont été ajoutés. Les inscriptions et drapeaux ont des surfaces courbes dédiées, avec coordonnées bornées et échantillonnage sans répétition. Ils ne dépendent plus du dépliage incomplet de la coque précédente. Les triangles sont regroupés par composant/matériau : 211 012 triangles en 132 lots, environ 9,9 Mo pour le GLB détaillé. La version blanche est extraite de cette nouvelle géométrie (33 179 segments, environ 797 ko) et garde les mêmes axes.

L’orientation Mir est recalibrée pour le nouveau corps source (+X longitudinal). Le suivi caméra de Mir conserve désormais son repère initial en rotation et suit uniquement la translation : il ne masque plus le changement d’attitude du modèle en tournant simultanément dans le même repère local. Ce changement est limité à Mir ; le comportement ISS reste inchangé. Il n’ajoute aucune rotation arbitraire ni télémétrie historique inexistante.

Validation : inspection des références et des aperçus hors navigateur sur plusieurs angles, tests du manifeste/source actif, composants et visiteurs, dimensions bornées, coordonnées des marquages, axes blanc/détaillé et suivi caméra. Le rendu GPU du navigateur ne peut pas être confirmé par ces aperçus hors ligne. Fichiers détaillé/blanc contrôlés avec le validateur Khronos ; tests d’orientation orbitale et de non-régression ISS. Aucune publication GitHub.


### Mir : corrections après examen de la vidéo de rotation (30 octobre 2026)

Fichier fourni : `Enregistrement de l’écran 2026-10-30 à 11.39.13.mov`, 10,85 s, 2760 × 1584 à 60 images/s. Examen de vues extraites à 0 s, 0,65 s, 1,45 s, 3 s, 6 s et 9 s. Cet enregistrement montre le modèle de référence en rotation, et non un dysfonctionnement de l’application. Empreinte et constatations consignées dans `resources/mir-turntable-review.json` ; le fichier vidéo n’est pas copié dans les ressources publiques.

L’écart principal se trouvait dans les axes de déploiement des paires de panneaux : vus de l’avant, plusieurs bras partaient dans la profondeur au lieu de s’étendre transversalement comme dans la référence. Les paires du bloc principal, Kvant-1, Kvant-2, Spektr et des visiteurs ont été réorientées autour de leurs axes propres. Les feuilles en accordéon de Kvant-1 ont de véritables inclinaisons alternées et des charnières, au lieu de plaques horizontales décalées. Les bras de support les placent au-dessus des modules radiaux ; des tests géométriques contrôlent ce dégagement. Les faces photovoltaïques des paires sont cohérentes et leurs revers ont une finition métallique neutre plutôt qu’une teinte ocre uniforme.

Les grands panneaux thermiques sont maintenant distincts : circuits connectés avec retours arrondis, deux couvertures courbes encadrant un corridor d’équipements et réservoirs apparents. La liaison APAS de Kristall comporte un corps sphérique et ses fenêtres. Priroda reçoit des détecteurs externes et un réflecteur Travers rectangulaire courbe grillagé, à la place de la petite parabole ronde précédente. Les dimensions et positions secondaires restent une interprétation des images, sans prétendre à une CAO ou à une pose historique exacte. Version détaillée v4 et contours blancs régénérés ensemble. Validation des fichiers 3D et tests de silhouette avant, inclinaison des feuilles, dégagement des bras et réflecteur ; aperçus hors navigateur comparés aux angles de la référence. Aucun changement de l’ISS et aucune publication.

### Mir — archive fournie, 31 octobre 2026

Modèle actif : `mir_atlas_pack.zip`, version complète de 1996 (107 632 triangles). Source GLB conservée sans modification dans `resources/detailed-originals/mir-user-pack.glb`. Géométrie, normales et couleurs par sommet conservées ; ajout de finitions PBR et d’une mise à l’échelle uniforme sans miroir. Aucun Soyouz/Progress ajouté. Documentation fournie conservée dans `resources/mir-user-pack/`. Modèle blanc dérivé du même assemblage. Les axes et le suivi orbital nominal sont conservés ; aucune attitude historique mesurée ni articulation solaire inventée. Import reproductible : `scripts/import_mir_pack.py`.

### Mir — retour au premier modèle Celestia, 31 octobre 2026

À la demande de l’utilisateur, le modèle actif revient au modèle DaveBowman2001 / Celestia initial, CC BY 4.0 : `resources/detailed-originals/mir-celestia.glb`. Les 9 textures, matériaux, UV et buffers géométriques d’origine restent inchangés. Les retouches de surfaces et les reconstitutions ultérieures sont exclues du modèle actif. Le modèle blanc reprend les contours du même assemblage ; la calibration des axes utilise une rotation propre, sans miroir.

### Modèles blancs Saliout et suivi solaire historique

Ajout des contours 3D individuels des sept Saliout à partir de leurs modèles détaillés existants (Soyouz illustratif conservé). Suivi solaire uniquement sur les modèles réalistes : Saliout 1 et Skylab orientent la station entière, sans articulation inventée des panneaux ; Saliout 2 à 7 utilisent leurs entraînements solaires. Mir conserve son modèle Celestia et ses textures ; les triangles des dix ailes motorisées sont regroupés en articulations à un axe, en conservant les buffers de sommets et d’images. Le panneau dorsal et les panneaux de visiteurs restent fixes. Sources et limites : `resources/historical-solar-sources.json`. Il s’agit de pointage nominal calculé, pas de télémétrie historique.

### Tiangong — mouvements et stabilité des surfaces, 31 octobre 2026

Vérification des entraînements solaires : TG-1/2 à un axe par aile ; Tianhe à un axe et Wentian/Mengtian à deux axes. La station conserve une orientation orbitale nominale tournée vers la Terre, y compris avec vitesse absente ou dégénérée, sans rotation solaire artificielle du corps. Sources et limites : `resources/tiangong-motion-review.json`. Suppression des couples de triangles de fermeture internes exactement superposés ; finitions PBR gris clair moins spéculaires et cartes de normales atténuées. Les couleurs et images restent identiques. Modèles blancs sans animation solaire.

### Skylab — stabilité des reflets, 31 octobre 2026

Le modèle NASA et ses buffers Draco restent inchangés. Les facteurs spéculaires hérités de l’export Maya (couleurs jusqu’à 2,0) sont bornés, les lobes des métaux clairs élargis et l’éclairage spéculaire d’environnement réduit uniquement pour Skylab. Couleurs diffuses, géométrie, réglages de suivi solaire et modèles blancs conservés. Configuration reproductible dans `resources/detailed-model-sources.json`, audit `resources/skylab-reflection-stability.json`.

### Skylab — correction topologique après les vidéos de 12 h 10 et 12 h 11

Les vidéos fournies le 31 octobre 2026 montrent une compétition de profondeur sur des plaques métalliques. L’analyse du maillage NASA a établi un recouvrement surfacique entre triangles différents dans quatre faces planes du premier sous-maillage ; compter les seuls triangles strictement identiques ne détectait pas cette erreur. Ces quatre zones sont remplacées par leur union plane tessellée sans recouvrement, en conservant concavités, ouvertures et faces latérales. Les quinze autres sous-maillages compressés restent identiques ; aucun autre modèle n’est modifié. Vérification indépendante de couverture, des ouvertures et d’aire d’intersection : `tests/skylab_caps.py`. Audit : `resources/skylab-planar-cap-repair.json`. Les réglages de reflets antérieurs sont conservés, mais ne constituaient pas la correction de ce défaut géométrique.

### Skylab — raccords des plaques

Après confirmation que les défauts résiduels concernent les mêmes plaques, les faces reconstruites utilisent désormais les coordonnées exactes des plans NASA d’origine, sans arrondi décimal qui les décalait légèrement des biseaux. Les intersections communes sont partagées, les jonctions en T subdivisées et les sommets identiques en simple précision soudés. Contours et ouvertures conservés ; audit des plans et vérifications de couverture inchangés. Reconstruction effectuée depuis les buffers d’origine à chaque passe, sans accumulation de données.

### Mir — caméra indépendante de la station

Le repère de suivi de Mir conserve ses axes lors des changements de date, des interruptions temporaires de positions et du passage au modèle détaillé. Seule la translation suit la position orbitale ; les rotations d’attitude de la station ne pilotent pas la caméra. Le recentrage explicite conserve ce repère. Test avec une vraie instance de caméra Cesium sur 720 images : `tests/mir-camera.cjs`. Comportement ISS conservé.
