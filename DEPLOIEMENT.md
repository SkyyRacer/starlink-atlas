# Publication gratuite, sans carte bancaire

La version GitHub Pages conserve l’interface et le moteur orbital Rust, compilé en WebAssembly. Les positions sont calculées dans un Web Worker de chaque navigateur : cinquante visiteurs ne sollicitent pas un serveur de calcul commun. Le serveur Rust local reste utilisable.

Le site public visé est https://SkyyRacer.github.io/starlink-atlas/ . Ne considérer ce lien comme publié qu’après une réponse HTTP correcte et une vérification visuelle.

## Cycle des données et visites

Une tâche GitHub Actions s’exécute aux minutes `23` et `53` de chaque heure UTC, en vérifiant les échéances, indépendamment du Mac et des visiteurs. GP/SupGP : au plus une collecte par 2 h ; SATCAT/GCAT : 24 h. Les réponses sont validées avant publication. Une erreur d’une source conserve le cache et un fichier `*stopped.txt` ; consulter le journal et corriger la cause avant de retirer cet arrêt du cache. Les archives historiques initiales restent dans `data-seed/history`, servies depuis le dépôt public à une révision immuable. Les collectes ultérieures sont conservées sous forme d’observations réelles quotidiennes par satellite et par source, choisies près de midi UTC ; cette réduction peut limiter l’étude fine d’un train de lancement. Les fenêtres de validité SupGP restent respectées dans ces archives. Il n’y a aucune reconstruction inventée avant les premières observations.

Chaque arrivée ou rechargement charge une édition immuable du catalogue, des données orbitales et des sources. L’animation, la chronologie et l’accélération se calculent ensuite dans le navigateur. Aucun filtre ni choix n’est enregistré dans le navigateur. Les fichiers d’observations sont nommés par leur empreinte et les anciennes versions restent accessibles sept jours ; au-delà une visite très ancienne peut nécessiter un rechargement. Les collectes suivantes ne changent ni les données de cette visite ni ses commandes ; recharger reprend les données publiées les plus récentes et les filtres par défaut. Les limites orbitales restent les mêmes : GP ±72 h, SupGP de son époque jusqu’à +24 h. Une visite très longue peut dépasser cette validité ; recharger manuellement.

## Reproduire la publication

1. Installer Rust 1.87 et la cible `wasm32-unknown-unknown`.
2. `cargo build --release --locked`
3. `cargo build --manifest-path web-core/Cargo.toml --target wasm32-unknown-unknown --release --locked`
4. `python3 scripts/build_static.py --output public --data-dir data`
5. Servir `public` avec un serveur HTTP, jamais en ouvrant directement `index.html`.

Le site fonctionne aussi sous le sous-chemin d’un dépôt GitHub Pages. Le fichier `.nojekyll` préserve les ressources Cesium. Les données gzip sont décompressées par le navigateur, et ne doivent pas être envoyées avec un deuxième encodage HTTP gzip. Navigateurs modernes avec WebAssembly, Web Workers et DecompressionStream requis ; la vue 2D sert de repli si WebGL est indisponible.

Dans le dépôt public, sélectionner **Settings → Pages → Source → GitHub Actions**. La tâche téléverse le site construit puis utilise l’action officielle de déploiement Pages, sans pousser une branche générée. Elle conserve les collectes intermédiaires dans le cache Actions, distinct des archives historiques de référence. GitHub peut supprimer les caches inutilisés ; le jeu initial permet alors de redémarrer.

## Limites de l’offre gratuite

GitHub Pages : site ≤1 Go, bande passante indicative de 100 Go/mois. L’export refuse de dépasser 950 Mo. Le site initial publié occupe environ 27 Mo ; environ 818 Mo d’archives restent dans le dépôt public et sont téléchargés à la demande. Les nouveaux jours s’ajoutent au site, dont la taille est vérifiée à chaque publication. Pas de garantie contractuelle de disponibilité ou de nombre de connexions ; 50 visiteurs est l’objectif testé, pas une promesse de trafic illimité. Les ressources gratuites ne constituent pas un hébergement garanti. Les tâches planifiées peuvent être retardées ; dans un dépôt public sans activité elles peuvent être désactivées après 60 jours et doivent alors être réactivées dans Actions. Aucun service payant ni carte n’est configuré.

Les premières données orbitales actuelles représentent environ 4 Mo compressés ; les archives ne sont téléchargées que pour les jours historiques consultés. Les tuiles OSM restent soumises à la politique du fournisseur. Sources et licences conservées dans l’interface et les fichiers SOURCES.md / THIRD-PARTY.md.

Documentation : https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits et https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule .


## Publier les modifications locales sur le dépôt existant

Depuis le dossier source local, exécuter `bash scripts/publish_github.sh`. Le script vérifie la connexion GitHub, le dépôt cible et son état propre, synchronise les sources vers le checkout de publication existant, inclut les caches publics ISS / missions / EVA, crée un commit et pousse `main`. Il configure Pages en mode GitHub Actions. Il ne copie pas les fichiers `.env`, les exécutables compilés ou les archives ZIP. La préparation du script ne publie rien : seul son lancement explicite effectue ces actions.

Les documents `/atlas/`, `/iss/` et `/starlink/` de l’export statique restent sous le sous-chemin du dépôt. La page racine affiche Atlas. Les fichiers partagés utilisent une base relative, y compris les drapeaux, le modèle ISS et les données des missions et EVA. La signature de Quentin Jaros figure en bas à gauche dans les deux vues.


## Chargement progressif et ressources partagées

Chaque nouvelle visite charge `edition.json` sans réutiliser une ancienne édition. Cet index référence des fichiers compressés, nommés selon leur contenu, distincts pour ISS, Starlink et Atlas. Le catalogue et la configuration restent disponibles sans attendre le moteur orbital. Les missions ISS, EVA et compléments GCAT des fiches sont chargés seulement lorsqu’ils sont utiles ; les métadonnées restent attachées à l’édition de la visite.

Le navigateur reçoit une table d’éléments orbitaux sans répétition des noms de champs. Leurs valeurs et leur précision sont conservées. Pour la journée de publication, l’export prépare les mêmes observations que l’ancienne fenêtre de sept jours ; les candidats à égalité à la seconde sont conservés dans leur ordre initial. En dehors de cette fenêtre sûre, ou si aucune position n’est disponible, le moteur charge les observations et archives nécessaires à la date demandée. Il ne remplace pas un calcul par une position figée.

`asset-cache.js` et `asset-sw.js` partagent le téléchargement du moteur Cesium, de Leaflet, du WASM, des styles et images entre les trois documents. Les pages, réponses API, fichiers de données et index d’édition sont exclus de ce cache. Les tuiles de carte lisibles par CORS sont conservées dans la limite de 128 et selon leur expiration ; les images opaques et les réponses en erreur ne sont pas stockées. Les fichiers de rendu sont limités à 256 entrées et les anciens caches d’une version publiée sont nettoyés. Sans Service Worker disponible, l’application utilise le cache HTTP normal.

Le cache persistant fonctionne sur HTTPS et sur localhost. Une navigation entre de vrais documents réinitialise toujours JavaScript et la scène WebGL : ce cache évite les transferts répétés, il ne maintient pas une scène 3D unique en mémoire.

Vérifications de l’export : `node tests/static-pages.cjs CHEMIN_EXPORT URL_LOCALE`, `node tests/static-transport.cjs CHEMIN_EXPORT URL_LOCALE`, `node tests/asset-cache.cjs` et `node tests/wasm.cjs CHEMIN_EXPORT`. Les deux premiers tests nécessitent un serveur HTTP local sous `/starlink-atlas/`.
