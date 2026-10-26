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
