# Starlink Atlas

Application web locale full-stack : serveur Axum et propagation SGP4 en Rust ; interface HTML/CSS/JavaScript avec Leaflet, une couche Canvas unique et un globe CesiumJS chargé à la demande. Aucun Node, bundler ou compte requis au lancement. Rust n’est pas utilisé pour les interactions du navigateur : cette petite couche JS privilégie la compatibilité et évite une compilation WebAssembly.

## Lancer

Installer Rust **1.87 ou plus récent** avec Cargo depuis https://rustup.rs (sur Windows : prérequis du toolchain MSVC). Dans ce dossier :

```sh
cargo run --release --locked
```

Ouvrir http://127.0.0.1:3000 dans Firefox, Chrome, Edge, Safari ou Opera récent. La première compilation et la première collecte nécessitent Internet. Les bibliothèques du navigateur sont livrées localement. Le fond OSM nécessite Internet. Arrêt : Ctrl+C. Exécuter depuis la racine du projet, qui contient `static/`.

Windows PowerShell utilise la même commande Cargo. Pour les options, employer `$env:OFFLINE="1"` ou `$env:DATA_DIR="D:\\archives"` avant lancement. Sur macOS/Linux :

```sh
OFFLINE=1 cargo run --release --locked
DATA_DIR=/chemin/archives BIND=127.0.0.1:3001 cargo run --release --locked
```

`OFFLINE=1` désactive la collecte satellite ; les tuiles continuent à nécessiter une connexion. Sans archive, la carte ne montre aucun satellite. Le service écoute seulement sur localhost par défaut.

## Fonctionnement

- Carte responsive, déplacement, molette, zoom +/− et tactile. Un seul planisphère : répétition désactivée, déplacement borné et dézoom minimal adapté à la largeur et à la hauteur.
- Filtre par nom/NORAD, année, lancement (identifiant international) et état à la date choisie ; liste mise en avant avec nom, NORAD, état et compteur ; 100 satellites par page, avec flèches précédente/suivante pour parcourir tous les résultats. Changer un filtre revient à la première page.
- Un clic sur un satellite ou un résultat ouvre sa fiche. Une trace au sol passée (verte) et une prévision du prochain tour (pointillés bleus) apparaissent ; en mode planisphère, il s’agit d’une projection au sol. Son début (cercle creux « −1 tour ») diffère de sa fin (satellite actuel) à cause de la rotation terrestre ; la trace n’est pas fermée. Le passage ±180° est découpé aux deux bords de la carte. Seul le satellite sélectionné affiche son nom sur la carte.
- Fond pays/frontières/villes permanent ; la rubrique de réglages cartographiques a été retirée.
- Ombre jour/nuit : approximation solaire géométrique, sans crépuscule ni réfraction, indépendante de l’éclairage des satellites.
- Date/heure au **fuseau et format du navigateur**, pause (date et positions figées), lecture ×1/×2/×5/×10/×100, retour immédiat au présent. La lecture accélérée s’arrête au présent ; le futur est refusé aussi côté serveur.
- Les points sont interpolés à chaque image entre deux positions reçues, en 2D et en 3D, sans extrapoler au-delà de la dernière position disponible. Cela ajoute environ une seconde de retard visuel (davantage de temps simulé en lecture accélérée) ; le mouvement entre échantillons est une approximation d’affichage. Pause, changement de date et manque d’archives arrêtent la transition. Positions recalculées environ chaque seconde ; les éléments sources ne sont pas actualisés chaque seconde. Le bouton « Actualiser le cache » relit le serveur, sans nouvelle requête au fournisseur.

## Terre 3D

Le sélecteur « Planisphère / Terre 3D » conserve la date, les filtres et la sélection. Le globe WGS84 utilise les mêmes tuiles OSM attribuées ; les pôles restent sans tuiles raster au-delà de la couverture Web Mercator. Les satellites et les traces sont placés à leur altitude estimée au-dessus de l’ellipsoïde. Aucun relief terrain n’est chargé. Les altitudes restent toujours à l’échelle réelle ×1 ; aucune exagération ni sélecteur d’échelle.

Glisser pour tourner, molette pour zoomer, Ctrl + glisser pour incliner, flèches pour orienter. La boussole indique le nord géographique projeté dans la vue, y compris après inclinaison ; cliquer dessus remet le nord en haut sans déplacer le centre. Glisser horizontalement sur la boussole tourne l’affichage. La rotation horizontale du globe à la souris et le glissement de la boussole utilisent la même commande : orientation et degrés restent synchronisés. Le déplacement vertical fait basculer le globe, avec amortissement. Lorsqu’un satellite est sélectionné, les mouvements Cesium d’origine sont rétablis pour explorer son altitude et tourner autour de lui ; le suivi reste disponible. « Recentrer », sous la boussole, rétablit le cadrage initial et le nord en haut, et arrête le suivi éventuel. « Suivre le satellite » centre et suit le satellite sélectionné en temps réel ou en lecture ×2/×5/×10/×100, avec transitions interpolées entre positions calculées. Zoom et rotation restent disponibles autour de la cible. « Vue du dessus » cadre depuis le haut sur l’axe de hauteur ; « Vue de côté » cadre perpendiculairement à cet axe, avec la Terre en dessous. Ces deux boutons activent automatiquement le suivi et restent compatibles avec la lecture accélérée. « Libérer la caméra » ou « Vue globale » arrête le suivi. Sans position disponible, le suivi est suspendu ; fermer la sélection le désactive. « Vue globale » recadre la Terre. Les boutons +/− donnent des pas fins. Le rendu GPU regroupe les points, amortit les déplacements et ne redessine qu’en cas de changement ; la fluidité dépend du matériel.

La vue 3D demande WebGL2 et l’accélération graphique du navigateur. Le planisphère reste disponible si le globe ne peut pas démarrer. CesiumJS 1.127.0 est livré localement, sans compte ni jeton Cesium ion. Après mise à jour, redémarrer le serveur avec `cargo run --release --locked` puis recharger la page avec ⌘⇧R sur Mac.

## Dates locales

La chronologie, la saisie de date, les époques orbitales, les collectes et les bornes d’archives utilisent la langue et le fuseau du navigateur. Le fuseau IANA et le décalage UTC sont indiqués ; le décalage est recalculé pour la date choisie, y compris été/hiver. Les instants envoyés au serveur restent UTC et les positions représentent le même instant. Une modification du fuseau/langue du navigateur est détectée sans recharger, avec réactualisation des fiches et métadonnées sous 30 secondes.

Les heures inexistantes lors du passage à l’heure d’été sont refusées. Une heure répétée à l’automne utilise la première occurrence, avec le décalage UTC affiché. Les dates de lancement/désorbitation fournies uniquement comme jour UTC ne permettent pas de calculer une heure locale : elles gardent ce jour, formaté selon le navigateur et explicitement marqué « heure non fournie ». Les instants précis éventuels sont convertis normalement. Les événements restent ceux du catalogue collecté, pas des heures inventées ou des informations temps réel de télémétrie.

## Données et historique

Lire [SOURCES.md](SOURCES.md) avant d’interpréter les résultats. L’historique public quotidien est décrit dans [HISTORIQUE.md](HISTORIQUE.md) et stocké dans `data/history/`, chargé autour de la date choisie. Les collectes OMM/GP JSON sont archivées dans `data/gp-*.json`, avec toutes les époques distinctes. SATCAT est conservé dans `data/satcat.json` : noms, identifiants, dates de lancement/désorbitation et code opérationnel actuel. Le catalogue est l’union des objets Starlink publiés dans ces deux sources ; son exhaustivité n’est pas garantie.

Pour charger un export historique JSON OMM (tableau d’objets, champs CelesTrak/Space-Track), arrêter le serveur, puis :

```sh
cargo run --release --locked -- --import /chemin/gp_history.json
cargo run --release --locked -- --import-catalog /chemin/satcat.json
cargo run --release --locked
```

Ne pas confondre ces deux formats. L’import orbital valide les éléments, conserve uniquement les noms commençant par STARLINK et déduplique NORAD + époque. Le catalogue importé remplace le fichier SATCAT local. Le prochain rafraîchissement peut le remplacer : utiliser `OFFLINE=1` pour conserver un jeu importé fixe. Aucun identifiant Space-Track n’est demandé ni stocké. Obtenir les archives avec son compte et selon les conditions du fournisseur ; pour les gros volumes suivre les recommandations Space-Track plutôt que multiplier les requêtes.

Un satellite aujourd’hui désorbité peut apparaître dans le passé **seulement si des éléments historiques proches de cette date ont été importés** et si ses dates de vie le permettent. Aucune position ancienne n’est fabriquée à partir d’une orbite actuelle. L’élément le plus proche (avant ou après la date) est choisi dans une fenêtre ±72 heures. Cette reconstruction rétrospective peut donc employer une observation postérieure à la date affichée ; ce n’est pas une simulation de ce qui était connu à l’époque. Une date de désorbitation sans heure est interprétée à minuit UTC, ce qui crée une incertitude sur cette journée.

L’intervalle première/dernière époque n’est pas une promesse de couverture continue. Le compteur « sans position exploitable » inclut les objets potentiellement présents sans éléments, trop loin de l’époque ou dont la propagation échoue. Les objets désorbités ne sont pas dessinés au présent mais restent consultables dans la liste et les fiches.

## Collecte et panne

Une seule instance de collecte par dossier : GP toutes les 2 h ; SATCAT au plus une fois par 24 h. Dernière tentative persistée, y compris après redémarrage. Redirections et réponses HTTP autres que 200 arrêtent la collecte ; erreurs réseau, JSON invalide ou écriture impossible également. Les anciennes archives continuent à fonctionner dans leur fenêtre de validité.

`data/collection-stopped.txt` contient le motif. Corriger la cause et vérifier la politique fournisseur, arrêter le serveur, supprimer **uniquement ce fichier**, puis relancer. Ne pas effacer `last-attempt.txt` pour contourner les quotas. Le bouton navigateur ne réactive pas une collecte arrêtée.

Sauvegarder `data/`. Pas de purge automatique : croissance permanente des archives. Importer l’historique complet d’une constellation peut demander beaucoup de mémoire ; cette version charge les éléments et constantes SGP4 en mémoire. Le choix d’époque est une recherche binaire. Pour une exploitation volumineuse/multiutilisateur, déplacer l’archive vers SQLite/PostgreSQL, mettre en cache les réponses temporelles et isoler les calculs CPU dans un pool. Ne pas lancer plusieurs collecteurs contre le même dossier.

## API

- `GET /api/catalog` : catalogue, dernière collecte, état de collecte, premières/dernières époques.
- `GET /api/positions?at=2026-10-12T09:00:00Z&id=44714` : positions valides à cette date et trace passée de l’objet sélectionné. Date omise = présent ; date mal formée/future = HTTP 400.
- Altitude en km au-dessus de l’ellipsoïde WGS84, vitesse inertielle TEME en km/s, époque UTC et écart signé en heures.
- `GET /api/config` : URL/attribution du fournisseur cartographique configuré.

Aucun endpoint d’écriture/import public. Compression gzip des réponses. Les coordonnées cartographiques excluent de fait les régions polaires extrêmes : projection Web Mercator, pas un globe.

## Vérifier

```sh
cargo test --locked
cargo fmt --check
cargo build --release --locked
python3 tests/smoke.py
```

[VALIDATION.md](VALIDATION.md) détaille les contrôles effectués et les limites. Les tests incluent le vecteur de référence SGP4 de Vallado, la conversion géodésique, le choix d’époque, les limites d’âge, les imports et les bornes temporelles.

## Docker (optionnel)

```sh
docker build -t starlink-atlas .
docker run --rm -p 3000:3000 -v starlink-data:/app/data starlink-atlas
```

Ouvrir http://localhost:3000. Docker doit être installé. Pour exposer le service ailleurs, ajouter un proxy HTTPS et les limites de ressources adaptées. Le conteneur utilise un utilisateur non privilégié ; l’accès au volume doit lui être permis. Le Dockerfile est fourni, sans validation Docker dans cet environnement.

## Cartographie et licences

Code applicatif : MIT. Leaflet : BSD-2-Clause, licence incluse dans `static/vendor/LEAFLET-LICENSE`. Autres composants : [THIRD-PARTY.md](THIRD-PARTY.md), licences déclarées par les paquets. Les données ne deviennent pas MIT parce que le code l’est.

OSM : attribution visible, ODbL. Tuiles publiques adaptées à une utilisation interactive modérée, sans SLA : aucune précollecte ni téléchargement hors ligne. Le navigateur garde son Referer et son cache standard. Pour la production choisir un hébergement de tuiles approprié ou auto-hébergé. Variables optionnelles `TILE_URL` (modèle `{z}/{x}/{y}`) et `TILE_ATTRIBUTION` (HTML contrôlé par l’administrateur) pour changer de fournisseur sans modifier le code. Préserver les attributions exigées.

CelesTrak/Space-Track : accès public ou sous compte ne signifie pas « sans droits » ni autorisation universelle de redistribution. Les archives collectées pour la vérification locale sont exclues du ZIP livré. Aucune prétention de disponibilité permanente, de télémétrie en direct ou de précision garantie.

Contrôle géométrique du navigateur (Node facultatif) : `node tests/geometry.cjs`.

Prévision orbitale : `future_track` commence à la position affichée et prolonge le trajet sur une période au maximum, avec les mêmes éléments SGP4. Arrêt si désorbitation connue, propagation invalide ou fenêtre ±72 h dépassée. Le futur reste interdit dans la chronologie ; seule la trace directionnelle est prédictive. Il ne s’agit pas d’un trajet exact garanti.

Changement de date : une requête en cours ne peut plus perdre la nouvelle sélection. Sans données historiques, un message explicite et « Date disponible la plus proche » permettent de revenir à une époque archivée. Les filtres restent appliqués : un message indique aussi s’ils masquent toutes les positions.

Les archives publiques sont livrées dans un ZIP séparé pour éviter de gonfler le paquet de code. Sur l’installation actuelle elles sont déjà dans data/history/. Sur une autre installation, copier ce dossier et supplemental-catalog.json depuis le paquet d’archives vers data/, après une première collecte SATCAT, puis redémarrer le serveur. Voir HISTORIQUE.md.

Navigation : le dézoom maximal affiche la carte complète dans l’espace au-dessus de la chronologie ; petits paliers à la molette et boutons +/− par demi-niveau. La répétition du monde reste désactivée.

Années et lancements : filtres à cases à cocher, sélection multiple par clic. Les valeurs d’un même filtre se combinent par OU (2024 ou 2026) ; années/lancements/état/recherche se combinent par ET. Toutes / Effacer la sélection rétablit toutes les valeurs pour ce filtre. Les compteurs de carte et de résultats reflètent la sélection. Pagination réinitialisée lors d’un changement de filtre, choix conservés lors d’une actualisation du catalogue. L’option autonome Inconnu a été retirée du filtre d’état ; Tous les états inclut toujours tous les objets.

Accueil : Terre 3D par défaut, onglet Planisphère à droite ; retour au planisphère si WebGL est indisponible. Recentrer est mis en évidence dans les deux vues. En 2D il centre le monde entier et adapte le dézoom à la surface disponible, sans répétition ; filtres et date conservés.

Le filtre Lancements regroupe automatiquement les vols par année, en ordre décroissant. Cocher une année sélectionne ses vols et inclut les nouveaux vols de cette année aux actualisations suivantes ; décocher un vol rend le groupe partiellement sélectionné. Les nouveaux millésimes sont créés à partir du catalogue. Lorsque Toutes/Tous est actif, les deux boutons de réinitialisation sont désactivés et grisés.

Les en-têtes annuels du filtre Lancements défilent normalement avec leurs vols, sans position collante ni déplacement lors de la sélection.

Recherche sous le titre Satellites et le compteur : un préfixe de STARLINK affiche le suffixe grisé ; Espace complète STARLINK-. Si aucun résultat ne passe les filtres mais que le catalogue contient des correspondances, un message décrit les filtres et les années/vols des candidats (jusqu’à cinq propositions). Non conserve les filtres ; Oui réinitialise années/lancements/état et recherche exactement le satellite choisi, sélectionné sur la carte.


### Sources publiques complémentaires

Au lancement, le serveur charge également les caches CelesTrak SupGP / SpaceX et GCAT / Jonathan McDowell, puis les actualise automatiquement (2 h / 24 h). Aucun compte requis. La fiche donne la source orbitale et les heures de lancement recoupées ; Sources & fiabilité indique les collectes et erreurs. Les données actuelles ne remplacent pas les archives historiques manquantes. Détails et attributions dans SOURCES.md.

En cas d’erreur, examiner data/supgp-stopped.txt ou data/gcat-stopped.txt ; corriger la cause avant de supprimer le fichier concerné. OFFLINE=1 conserve uniquement les caches. L’API /api/sources donne l’état des nouvelles sources.


### Version publique gratuite

Déploiement GitHub Pages sans carte bancaire, moteur Rust/WebAssembly dans chaque navigateur et collecte planifiée indépendante du Mac : voir [DEPLOIEMENT.md](DEPLOIEMENT.md). Les filtres ne sont jamais enregistrés ; une visite garde son édition des données jusqu’au rechargement.


### Collections Atlas, ISS et Starlink

Le bouton à droite du titre ouvre le sélecteur, avec « Tous les satellites », puis ISS et Starlink par ordre alphabétique. Starlink conserve ses filtres et sa liste. ISS dispose d’une vue dédiée épurée, d’un modèle blanc cliquable en 3D et d’un dessin sur le planisphère. La vue Atlas propose la sélection combinée des familles intégrées et des fiches simplifiées. Toutes les vues partagent la chronologie, le calcul SGP4 et les commandes de caméra. Les choix sont réinitialisés au rechargement. Voir `SOURCES.md` pour la couverture historique ISS et le caractère illustratif du modèle.

### ISS : missions et équipage (local)

Choisir **ISS** dans le menu en haut de la colonne gauche. Les vols sont regroupés par année ; cliquer sur un vol ouvre sa fiche. L’équipage actuel et le temps depuis l’arrivée à bord apparaissent sous l’historique. Le modèle est plus petit dans **Tous les satellites / Atlas**.

Le serveur collecte les faits Launch Library 2 toutes les 6 heures et conserve `data/iss-missions.json`. La visite en cours ne recharge pas ce catalogue ; recharger la page pour obtenir la dernière collecte. En cas d’indisponibilité, le cache est conservé avec sa date de réception visible. Le mode `OFFLINE=1` désactive la collecte. Voir `SOURCES.md` pour la couverture et les limites. Après une mise à jour du programme, arrêter l’ancien processus avec Ctrl+C puis relancer le binaire.

### Pages de l’observatoire

La version locale fournit trois documents accessibles directement : `/atlas` (tous les satellites), `/iss` et `/starlink`. Le menu **Choisir les satellites à observer** effectue une navigation complète ; recherches, filtres et couleurs reviennent à leurs valeurs initiales sur une nouvelle page. `/` redirige vers `/atlas`, la page d’accueil. Les adresses sont distinctes pour permettre de mesurer séparément les consultations lors d’une future intégration de statistiques ou de publicité ; aucun outil publicitaire n’est installé dans cette version.

Sur Atlas, les cartes ISS / Starlink contrôlent l’affichage des catégories et leurs couleurs, sur le globe comme sur le planisphère. La couleur ISS s’applique à son modèle et à son icône.

Les couleurs Atlas se modifient en cliquant sur le carré coloré ou la mention « Modifier la couleur ». Cela ouvre le sélecteur natif du navigateur / système, dont la présentation et les options peuvent varier. Les deux cartes de catégorie remplacent la rubrique globale « Tous les éléments ».


## Galileo et navigation entre collections

Les pages locales `/atlas`, `/galileo`, `/iss` et `/starlink` partagent les vues 3D et planisphère. Galileo réutilise les filtres annuels, les groupes de lancement, la recherche de satellite, les fiches et le suivi. Dans Atlas, sa visibilité et sa couleur se règlent indépendamment. Le cadrage tient compte des orbites hautes tout en conservant les altitudes réelles.

Les éléments orbitaux proviennent du groupe public CelesTrak `galileo` (collecte toutes les deux heures). Le catalogue SATCAT `NAME=GSAT` est filtré par identité Galileo pour exclure les objets indiens GSAT et les autres correspondances ; collecte quotidienne. Comme ailleurs, aucune position ne dépasse la fenêtre de validité de 72 heures autour de son élément orbital. Les objets sans orbite exploitable restent au catalogue ; les archives historiques Starlink ne sont pas présentées comme des archives Galileo. Les données de chaque visite restent figées jusqu’au rechargement.

Cliquer sur le logo rejoint l’accueil Atlas. La recherche de pages reconnaît Atlas / Tous les satellites, Galileo, ISS et Starlink ; elle propose des liens cliquables et accepte Entrée ou Tab en cas de résultat unique. Les liens fonctionnent aussi sous le chemin d’export `/starlink-atlas/`.


## GPS et cadrage d’accueil Atlas

`/gps` reprend les filtres, la recherche NAVSTAR / NORAD, les fiches, les traces et le suivi 3D / planisphère de Galileo. La recherche de pages reconnaît aussi « GPS », « NAVSTAR » et « Global Positioning System ». GPS possède une catégorie indépendante avec couleur personnalisable dans Atlas ; les valeurs par défaut restent blanches. Le filtre « Hors service (statut actuel) » est distinct de « Désorbité » et reprend sa teinte. « Vue de côté » est masquée sur GPS comme sur Galileo.

Sources : groupe public CelesTrak `gps-ops` pour les orbites exploitables et SATCAT `NAME=NAVSTAR` pour le catalogue incluant les anciens satellites. Collectes espacées de deux heures pour les orbites et d’une journée pour le catalogue, avec conservation du cache en cas d’erreur. Les données ne changent pas au milieu d’une visite. Aucun historique GPS n’est remplacé par des archives Starlink ; une ancienne date sans éléments adaptés reste sans position.

L’accueil Atlas et son recentrage conservent une vue Terre centrée sur 0° de longitude / 20° de latitude, avec une taille apparente d’environ 47 % de la hauteur disponible sur écran large (adaptation à la largeur sur mobile). Les orbites GPS / Galileo restent à leur altitude calculée : dézoomer pour les voir toutes. Leur arrivée ne provoque plus de recul automatique du cadrage Atlas. Les pages GPS et Galileo gardent leur cadrage global adapté aux hautes orbites.


## Constellations et débris — extension locale

L’observatoire comprend des documents distincts pour Atlas, BeiDou, COSMO-SkyMed, Débris, Galileo, Globalstar, GLONASS, GOES, GPS, ICEYE, Iridium, ISS, Meteosat, OneWeb, Pléiades Neo, Sentinel / Copernicus et Starlink. Toutes les familles sont présentes dans le sélecteur, la recherche (accents / synonymes compris) et les cases de visibilité / couleur d’Atlas. Les pages de constellation reprennent les filtres, la liste paginée, les fiches, les traces passées / futures et le suivi. Les cartes et le moteur restent communs et mis en cache.

Le registre relu `resources/constellations.json` rassemble les noms, les identités et les sources. `python3 scripts/generate_constellations.py` synchronise son module navigateur, le menu et les cartes Atlas. La classification est partagée par le moteur natif / WASM et vérifiée sur des éléments orbitaux réels. GLONASS est recoupé avec les identifiants Cosmos ; Meteosat comprend les générations MSG / MTG ; GOES comprend ses alias EWS ; COSMO-SkyMed inclut CSG. Pléiades Neo reste séparé des anciens Pléiades. Les instruments Sentinel embarqués ne deviennent pas des satellites supplémentaires.

Les groupes GP publics CelesTrak sont récupérés toutes les deux heures et les catalogues SATCAT quotidiennement. Les programmes utilisant le groupe commun `active` partagent un téléchargement par cycle. Une panne conserve le cache. Les collectes du serveur ne modifient pas l’édition déjà ouverte par un visiteur. Aucune publication automatique n’est effectuée pendant ce travail local.

### Page Débris

`/debris` comprend les enregistrements SATCAT de type `DEB` (fragments) et `R/B` (étages / corps de fusée) autour de la Terre, tous programmes et années confondus, avec les objets déjà rentrés. Les charges utiles entières, même non opérationnelles, conservent leur classification de satellite et ne sont pas assimilées à des fragments. Filtres supplémentaires : type et pays / organisation d’origine (code SATCAT). Les fiches affichent cette classification et l’origine.

Source du catalogue : https://celestrak.org/pub/satcat.csv ; schéma : https://celestrak.org/satcat/satcat-format.php. Les positions utilisent les requêtes GP publiques par noms (`DEB`, `R/B`, `AKM`, `PKM`, noyaux / liquide de refroidissement, aiguilles Westford, etc.), recoupées par identifiant avec les types SATCAT. Les rares noms non couverts sont interrogés par identifiant. Aucun accès au catalogue orbital global restreint n’est nécessaire. Les petits objets non catalogués et les éléments non publics / manquants ne peuvent pas être représentés. La fenêtre de propagation reste de ±72 h ; les objets sans orbite adaptée restent consultables au catalogue.

La page Débris conserve un cadrage terrestre lisible ; les pages Meteosat / GOES / BeiDou encadrent leurs hautes orbites. L’accueil Atlas conserve le zoom demandé, indépendamment des familles chargées.

### Catalogue étendu et thèmes Atlas

Le registre fournit maintenant 91 familles d’objets et 92 pages avec Atlas. Chacune conserve les fiches, la recherche, les filtres, le suivi et les deux représentations. Atlas range ses contrôles dans sept thèmes repliables : stations spatiales, navigation, télécommunications, observation terrestre, météo et climat, sciences et astronomie, débris. Les objets sont triés par nom dans chaque thème. Les cases, couleurs, désélection et réinitialisation gardent leur fonctionnement.

Les pages ciblées (GOES-18 / 19, MTG, Sentinel-5P / 6) partagent leurs objets avec les familles générales. Les filtres se combinent par union : une famille générale cochée peut donc continuer à afficher un objet dont la sous-famille est décochée. Un identifiant NORAD correspond à un seul marqueur dans Atlas. Une couleur personnalisée de sous-famille cochée prend priorité sur celle de sa famille. EDRS-A est représenté par son hôte Eutelsat 9B ; aucun satellite séparé n’est inventé.

Les collectes supplémentaires utilisent le même téléchargement GP `active` par cycle et un seul catalogue SATCAT quotidien partagé, y compris avec Débris. Les pages ne chargent que leur propre moteur orbital et leurs données lors d’un export statique. Les identifiants publiés évitent les homonymes (PACE, Hubble, etc.). Un objet sans éléments publics reste dans le catalogue, sans position fabriquée. Les hautes orbites de Chandra, XMM-Newton et TESS ont un cadrage adapté ; leurs traces peuvent être partielles à cause de la limite de validité de 72 heures.

Le moteur navigateur reçoit ses données par lots de 256 enregistrements. Les dates de lancement et de rentrée sont conservées sous forme compacte ; les positions sont sérialisées directement. Les observations courantes et historiques sont fusionnées sans doublons de source / époque, en préservant exactement les candidats susceptibles d’être utilisés dans la fenêtre horaire UTC consultée. Ce traitement réduit les pics mémoire sur mobile. Les données de la visite restent figées jusqu’au rechargement.

Les modifications sont locales. Aucun script de publication n’est exécuté.

TESS utilise également les vecteurs officiels NASA/JPL Horizons, avec archives depuis avril 2018 chargées uniquement pour l’année consultée. XPoSat propose une date de consultation exploitable lorsque ses éléments publics sont trop anciens ; aucune orbite périmée n’est propagée indéfiniment.

### Commandes Atlas et page Tiangong

Chaque thème offre « Tout sélectionner », « Tout désélectionner » et un sélecteur de couleur commun. Les commandes globales restent fixées en haut pendant le défilement des thèmes, sous la barre de fermeture sur mobile. Le lien « Voir la page » de chaque objet effectue une navigation complète vers sa page dédiée.

`/tiangong` représente la station actuelle (Tianhe / CSS, NORAD 48274), séparément des laboratoires historiques Tiangong-1 / 2. Elle partage les fiches et recherches des vols / équipages de l’ISS, avec un modèle original en T et une taille visuelle adaptative identique. L’équipage et les missions sont isolés de l’ISS ; les durées de séjour utilisent l’arrivée de la mission. Les noms de famille chinois sont fournis pour le tri. Les EVA reprennent le catalogue mondial partagé, avec dates, durées documentées, participants et cumuls individuels. Le même rafraîchissement LL2 fournit les deux pages ; aucune double collecte mondiale n’est ajoutée. Une source indisponible conserve le cache. Les données manquantes restent signalées comme telles.

La rubrique Débris inclut désormais les objets publics du groupe CelesTrak `analyst`. Ces objets non identifiés sont explicitement séparés des fragments / étages confirmés, y compris dans les filtres et fiches. Ils ne reçoivent ni origine ni date de lancement inventée. Leur identifiant est provisoire. L’encadré de couverture distingue le catalogue cumulé, les objets encore signalés en orbite et les positions réellement calculables à la date affichée. Les millions de petits fragments estimés statistiquement ne possèdent pas de coordonnées individuelles publiques à dessiner. L’audit daté est dans `resources/debris-coverage-audit.json`.


### Chronologie de toutes les rubriques

La date de la carte pilote les équipages ISS/Tiangong, les durées et les EVA. Un satellite sélectionné est retrouvé à sa position à cette date, en 3D et sur le planisphère. Aucun état opérationnel ancien n’est inventé à partir du statut actuel.

`scripts/import_public_history.py --scope all` importe désormais les identifiants de toutes les rubriques du catalogue fourni, avec reprise par année et conservation des journées déjà présentes. L’import initial est volumineux et peut continuer en arrière-plan ; son état réel reste dans `data/history/manifest.json` (`year_scopes`, `object_coverage`). `scripts/import_recent_history.py` complète uniquement une période récente depuis la dernière révision publique du jeu source, sans réimporter les anciennes années. `scripts/import_station_history.py` complète les stations depuis l’archive publique IAU CPS SatChecker.

Les collecteurs existants restent espacés de deux heures, sous réserve de disponibilité des sources et de leurs éventuels arrêts sur erreur. Chaque collecte GP/SupGP réussie est conservée comme observation quotidienne dans `data/history-updates/`, avant le remplacement du cache récent. Cela inclut les nouveaux objets reconnus, dont les Starlink nouvellement lancés. Le moteur serveur et le moteur navigateur utilisent les archives communes pour toutes les rubriques ; l’historique n’est plus limité à Starlink. Les données nouvelles ne sont pas accompagnées d’une remise à zéro des filtres ou de la sélection.

L’objectif d’import couvre tout le catalogue de l’application ; la disponibilité d’une position à n’importe quelle date dépend des observations publiques et de leur validité. Les trous d’archives, dates antérieures au lancement ou postérieures à la désorbitation restent signalés. Aucun objet absent des sources n’est simulé pour donner une couverture artificielle de 100 %.

Le bouton « Actualités » de l’en-tête ouvre un fil orbital commun aux pages. Le serveur compare les catalogues collectés, regroupe les objets d’un même lancement et conserve les 60 événements les plus récents dans `data/orbital-news.json`. Il détecte les nouveaux objets, désorbitations documentées et changements de statut explicites ; une simple nouvelle position, l’absence d’éléments orbitaux et les mises à jour logicielles n’annoncent rien. À la première installation, les lancements et désorbitations documentés des trente derniers jours amorcent le fil ; les changements de statut antérieurs ne sont pas reconstitués. L’heure est affichée uniquement si elle est fournie. L’export statique contient `news.json`, renouvelé au prochain export des données.
