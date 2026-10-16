# Historique orbital importé

Les fichiers sont installés dans `data/history/`. Le serveur les lit automatiquement après redémarrage. Ils sont séparés de la collecte GP actuelle. Pour la chronologie, choisir une date UTC et conserver les filtres sur « Tous ».

## Source et méthode

Archive [Space-Track TLE History](https://huggingface.co/datasets/juliensimon/space-track-tle-history), auteur Julien Simon, licence **déclarée CC BY 4.0**, provenance Space-Track / US Space Surveillance Network. Une révision précise est enregistrée dans `data/history/manifest.json`, avec les années effectivement importées et les dates disponibles. Les limites du fichier 2026 sont mesurées à l’import ; une archive annuelle partielle ne couvre pas automatiquement la période jusqu’au présent.

Les objets sont identifiés par NORAD à partir de SATCAT, en incluant ceux actuellement désorbités. Les deux prototypes Tintin A/B sont ajoutés par un catalogue complémentaire ; leurs noms d’origine, identifiants et dates proviennent de la recherche SATCAT CelesTrak `NAME=TINTIN`. Les noms d’affichage sont préfixés « STARLINK » pour les intégrer aux filtres de l’application.

Pour limiter la taille et le temps de calcul, on conserve **une observation orbitale réelle par satellite et par jour disponible**, la plus proche de midi UTC. On ne crée aucun élément pour une journée absente. Un emplacement à l’heure choisie est obtenu par SGP4 avec l’observation disponible la plus proche, dans la fenêtre ±72 h habituelle. Le chargement est limité aux sept journées entourant la sélection, avec un cache borné partagé. Les archives de la collecte actuelle continuent de participer au choix de l’élément le plus proche.

Ce n’est pas l’intégralité de chaque mesure source. Certains champs de l’archive Parquet sont en float32, ce qui réduit la précision par rapport aux TLE originaux. `MEAN_MOTION_DDOT`, numéro de révolution et numéro de jeu d’éléments ne sont pas fournis dans l’archive dérivée et sont fixés à zéro pour reconstruire les objets OMM ; ils ne déterminent pas la propagation SGP4 employée ici. Les dates de panne et changements opérationnels historiques ne sont toujours pas établis.

Le catalogue actuel peut manquer des objets historiques ou des associations de noms ; l’exhaustivité de tous les satellites et de toutes les dates n’est pas certifiée. Les trous de données restent visibles. Pour une analyse scientifique exigeante, utiliser les éléments bruts officiels et une méthode d’incertitude adaptée. Cette archive dérivée est destinée à la visualisation.

## Réinstaller sur une autre machine

Le ZIP source ne contient pas les données volumineuses. Copier le dossier `data/history/` et `data/supplemental-catalog.json` depuis l’installation qui possède les données, ou utiliser le script d’import. La source est attribuée dans l’interface. Ne pas appliquer la licence MIT du logiciel aux archives.

L’importeur est facultatif et nécessite Python 3 et DuckDB ; le fonctionnement normal du serveur nécessite seulement Rust :

```sh
python3 -m venv history-env
history-env/bin/pip install -r scripts/history-requirements.txt
history-env/bin/python scripts/import_public_history.py --first-year 2018 --last-year 2026
```

Exécuter dans le dossier du projet après une première collecte SATCAT. L’import peut lire plusieurs gigaoctets distants et demander plusieurs minutes. Les fichiers terminés et les années importées sont conservés : un relancement reprend les années non terminées. Le script épingle la révision et s’arrête sur erreur. Ne pas lancer plusieurs importeurs simultanément sur le même dossier. `--data-dir` et `--work-dir` permettent de changer les chemins.

Les fichiers `.json.gz` sont écrits dans des fichiers temporaires puis renommés. L’importeur peut fusionner un catalogue complémentaire avec `--catalog-file data/supplemental-catalog.json --first-year 2018 --last-year 2020 --merge`. Cela ajoute les prototypes aux journées existantes sans remplacer les autres satellites. Le catalogue complémentaire est fourni dans `resources/prototypes-catalog.json` et installé automatiquement par l’importeur complet. Il provient de CelesTrak SATCAT, collecté le 12 octobre 2026. Redémarrer le serveur à la fin de l’import.

Les dates de l’archive sont traitées explicitement en UTC, indépendamment du fuseau horaire du Mac. Un test hors ligne couvre le passage été/hiver et vérifie que les observations proches de minuit restent affectées à la bonne journée UTC.

## Jeu installé le 12 octobre 2026

10 886 344 observations, 3 148 journées disponibles : du 22 février 2018 au 10 octobre 2026. Les éléments actuels CelesTrak complètent la période récente. Révision source : `8ee9ed364d18b6e6b8d22e0b11dd3bfd775ed156`. Volume compressé des observations : environ 807 Mo. Les trous par satellite ne sont pas masqués.


## Rejouer un lancement récent depuis le largage

Pour le lancement 2026-225 (26 satellites, NORAD 100855 à 100880), les caches installés ne donnent pas de position pour STARLINK-40083 du 28 septembre au 12 octobre. GP courant ne contient pas cet objet ; SupGP actuel commence à l’époque affichée. Reculer une éphéméride récente sur plusieurs semaines ne restitue pas les manœuvres ni la dispersion réelle.

Demande ciblée sans compte Space-Track : https://celestrak.org/NORAD/archives/sup-request.php?FORMAT=json-pretty ; autre source : https://celestrak.org/NORAD/archives/request.php?FORMAT=json-pretty. Fournir les numéros un par ligne, début 2026-09-28, fin au jour courant, format JSON/JSON PP. Le fournisseur demande nom, courriel et CAPTCHA ; aucune demande n’est soumise automatiquement. Ses limites publiées sont 100 satellites et 20 000 enregistrements par demande, 10 demandes par 24 h. La présence d’éléments dès le largage n’est pas garantie.

Après réception, --import accepte les JSON GP ou SupGP SpaceX-E. SupGP est recoupé avec le SATCAT chargé, conservé avec sa provenance et ne sert pas avant son époque ; GP importé est identifié séparément. Toutes les observations reçues sont conservées, sans échantillonnage quotidien. Redémarrer le serveur pour charger les fichiers.

Le bouton « Voir le train de ce lancement » dans la fiche isole tous les membres du lancement et retire les autres filtres. Choisir ensuite une date couverte et lancer la lecture accélérée pour voir leur dispersion estimée et leurs altitudes. Les positions restent calculées par SGP4, les données reçues ne sont pas une mesure continue de chaque manœuvre.

KeepTrack affiche un historique d’altitude pour NORAD 100855 (https://keeptrack.space/satellite/100855), mais le lien JSON public retourne HTTP 403 lors de cette vérification. Aucun contournement ni collecte par satellite automatique ; ses conditions interdisent le moissonnage et ne constituent pas une source libre de redistribution commerciale.
