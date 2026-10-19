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
