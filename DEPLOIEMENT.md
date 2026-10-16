# Publication gratuite, sans carte bancaire

La version GitHub Pages conserve l’interface et le moteur orbital Rust, compilé en WebAssembly. Les positions sont calculées dans un Web Worker de chaque navigateur : cinquante visiteurs ne sollicitent pas un serveur de calcul commun. Le serveur Rust local reste utilisable.

Le site public visé est https://SkyyRacer.github.io/starlink-atlas/ . Ne considérer ce lien comme publié qu’après une réponse HTTP correcte et une vérification visuelle.

## Cycle des données et visites

Une tâche GitHub Actions s’exécute à `23` minutes toutes les deux heures UTC, indépendamment du Mac et des visiteurs. GP/SupGP : au plus une collecte par 2 h ; SATCAT/GCAT : 24 h. Les réponses sont validées avant publication. Une erreur d’une source conserve le cache et un fichier `*stopped.txt` ; consulter le journal et corriger la cause avant de retirer cet arrêt du cache. Les archives historiques initiales restent dans `data-seed/history` et leur couverture n’est pas prolongée artificiellement avec les éléments actuels.

Chaque arrivée ou rechargement charge une édition immuable du catalogue, des données orbitales et des sources. L’animation, la chronologie et l’accélération se calculent ensuite dans le navigateur. Aucun filtre ni choix n’est enregistré dans le navigateur. Les collectes suivantes ne changent ni les données de cette visite ni ses commandes ; recharger reprend les données publiées les plus récentes et les filtres par défaut. Les limites orbitales restent les mêmes : GP ±72 h, SupGP de son époque jusqu’à +24 h. Une visite très longue peut dépasser cette validité ; recharger manuellement.

## Reproduire la publication

1. Installer Rust 1.87 et la cible `wasm32-unknown-unknown`.
2. `cargo build --release --locked`
3. `cargo build --manifest-path web-core/Cargo.toml --target wasm32-unknown-unknown --release --locked`
4. `python3 scripts/build_static.py --output public --data-dir data`
5. Servir `public` avec un serveur HTTP, jamais en ouvrant directement `index.html`.

Le site fonctionne aussi sous le sous-chemin d’un dépôt GitHub Pages. Le fichier `.nojekyll` préserve les ressources Cesium. Les données gzip sont décompressées par le navigateur, et ne doivent pas être envoyées avec un deuxième encodage HTTP gzip. Navigateurs modernes avec WebAssembly, Web Workers et DecompressionStream requis ; la vue 2D sert de repli si WebGL est indisponible.

Dans le dépôt public, sélectionner **Settings → Pages → Deploy from a branch → gh-pages / (root)**. La tâche publie une branche dédiée sans accumuler les anciennes éditions du site. Elle conserve les collectes intermédiaires dans le cache Actions, distinct des archives historiques de référence. GitHub peut supprimer les caches inutilisés ; le jeu initial permet alors de redémarrer.

## Limites de l’offre gratuite

GitHub Pages : site ≤1 Go, bande passante indicative de 100 Go/mois. L’export refuse de dépasser 950 Mo. L’ensemble initial occupe environ 832 Mo, principalement l’historique. Pas de garantie contractuelle de disponibilité ou de nombre de connexions ; 50 visiteurs est l’objectif testé, pas une promesse de trafic illimité. Les tâches planifiées peuvent être retardées ; dans un dépôt public sans activité elles peuvent être désactivées après 60 jours et doivent alors être réactivées dans Actions. Aucun service payant ni carte n’est configuré.

Les premières données orbitales actuelles représentent environ 4 Mo compressés ; les archives ne sont téléchargées que pour les jours historiques consultés. Les tuiles OSM restent soumises à la politique du fournisseur. Sources et licences conservées dans l’interface et les fichiers SOURCES.md / THIRD-PARTY.md.

Documentation : https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits et https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule .
