# Optimisation du rendu — 23 octobre 2026

## Changements

- Les satellites ordinaires partagent un buffer et une commande de dessin GPU. Le processeur envoie les deux positions observées, puis le shader interpole leur déplacement. Aucun satellite n'est supprimé pour gagner du temps. Le satellite sélectionné conserve son interpolation précise et son marqueur indépendant.
- Les données complémentaires TESS et les ressources lunaires ne bloquent plus les premières positions de l'Atlas. Les pages TESS attendent toujours leurs données officielles.
- Les modèles détaillés se chargent uniquement à la demande. Les modèles optimisés privilégient une ouverture rapide ; une option conserve l'accès à la qualité d'origine. Le modèle simplifié reste affiché pendant le téléchargement.
- ISS : 1 082 456 octets et 174 440 triangles par défaut, au lieu de 95 875 884 octets et 2 707 621 triangles. Ce modèle par défaut est la variante officielle NASA ISS B, normalisée pour la scène. La provenance et les empreintes figurent dans `resources/iss-balanced-source.json`. Le modèle IGOAL original reste disponible.
- Hubble : 799 032 octets au lieu de 11 463 724. Chandra et TESS utilisent également des versions compressées. Les textures optimisées sont redimensionnées et encodées en WebP ; la qualité d'origine reste sélectionnable. Fermi et Tiangong conservent leurs fichiers déjà compacts.
- Les téléchargements des modèles évitent une deuxième copie complète du fichier en mémoire. Un changement de cible ou de vue libère les modèles et buffers inutilisés. Un téléchargement annulé n'installe pas tardivement son modèle.
- Les onglets masqués suspendent le rendu et les mises à jour d'horloge de l'interface. Leur retour conserve la date et les réglages.
- Le cache persistant du moteur est indépendant des mises à jour de l'application. Les autres caches ont des budgets estimés et une éviction des ressources les moins récemment utilisées. Les données, pages HTML et gros modèles ISS ne sont pas dupliqués dans ce cache. Le cache HTTP du navigateur conserve son fonctionnement normal.

## Vérifications

Le banc du contrôleur utilise 25 000 positions, dont 13 500 visibles, sur 60 images simulées. Avant : 405 000 conversions géographiques dans la boucle d'animation, environ 76 ms de processeur cumulées. Après : aucune conversion de ces points dans cette boucle, environ 0,5 ms. Ce test isole le travail du processeur ; il ne mesure pas les FPS ni le coût GPU d'un appareil réel.

Les tests vérifient la précision des coordonnées GPU, l'absence d'extrapolation, les dates, les filtres, la sélection, le repli sur les primitives Cesium, l'annulation des modèles, leur provenance, les limites des caches et le démarrage sans ressources complémentaires. L'export conserve les contrôles WASM et le seuil de couverture Starlink.

La publication après un changement de code comporte également un test Chromium/WebGL : présence effective de pixels des satellites, compilation du shader, décodage et affichage des modèles optimisés Hubble et ISS. Une erreur bloque la mise en ligne. Les collectes automatiques toutes les deux heures conservent leurs contrôles de données sans réinstaller Chromium.

## Régénération des modèles

`scripts/optimize_models.cjs` utilise glTF Transform, Meshoptimizer, Sharp et le décodeur Draco dans l'environnement de préparation. Ces dépendances ne sont pas téléchargées par les visiteurs. Le manifeste généré est intégré aux définitions du navigateur par `scripts/build_detailed_models.py`. Les fichiers optimisés et leurs empreintes sont versionnés.
