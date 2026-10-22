# Audit des performances Atlas — 22 octobre 2026

## Résultat et périmètre

Audit des chemins de chargement et de rendu : documents Terre/Lune, scripts et styles, menus, Cesium, Leaflet, interpolation, modèles, téléchargement des données, worker/WASM, API Rust, archives, export statique et cache partagé. Les corrections sont locales ; aucune publication GitHub n’a été effectuée.

Le problème ne venait pas uniquement d’anciennes interfaces. Une partie de l’interface aperçue au démarrage est toujours la source des contrôles utilisés par les menus actuels : la supprimer aurait cassé les filtres et les couleurs. Son apparition transitoire provenait de l’application tardive du mode bureau. Des calculs, téléchargements et allocations réellement inutiles ont également été identifiés et corrigés.

## Corrections effectuées

| Zone | Coût constaté | Correction |
| --- | --- | --- |
| Premier affichage | L’ancien panneau latéral était peint avant sa transformation par `workspace.js`. | Application du mode bureau immédiatement à l’ouverture du corps du document, avant le contenu du panneau. Les contrôles utilisés restent disponibles dans leurs menus. |
| Planisphère en arrière-plan | Même en entrant en 3D, téléchargement des tuiles Leaflet, préparation de 32 images Natural Earth, projection d’un canevas de 2 048 × 2 048 pixels et traitement de ses couleurs. | Téléchargement et conversion déclenchés uniquement à la première ouverture du planisphère, y compris lors du repli automatique si la 3D échoue. |
| Animation 3D | Interpolation de tous les objets reçus, débris masqués compris ; conversions et modifications des points visibles jusqu’à 60 fois par seconde. | Interpolation par sous-ensemble visible. Les symboles du catalogue évoluent à 30 Hz ; la caméra et le satellite suivi conservent leur mise à jour à 60 Hz lorsque le navigateur la permet. Aucun plafonnement du nombre d’objets disponibles. |
| Suivi en pause | La boucle parcourait encore tout le catalogue quand seule la caméra du satellite sélectionné avait besoin d’être suivie. | Accès direct par identifiant au satellite sélectionné ou à la station, sans parcours du catalogue. |
| Planisphère animé | Réaffectation de `canvas.width` et `canvas.height` à chaque image, réinitialisant la surface ; filtres recalculés pour chaque objet à chaque image. | Conservation du canevas entre les images, nettoyage explicite, allocation uniquement au changement de taille ; sous-ensemble visible recalculé lors des changements de données/filtres. |
| Écrans très denses | Canevas 2D suivant sans limite la densité de pixels de l’écran. | Densité limitée à ×2, comme le rendu 3D existant. À densité ×3, la surface de pixels est réduite de 56 %. |
| Nuit sur le planisphère | Trigonométrie du polygone jour/nuit à chaque image. | Réutilisation des coordonnées pendant une seconde de temps simulé ; projection conservée pour les déplacements de carte. |
| ISS et Tiangong | Création des deux modèles de station à chaque ouverture de scène, même sans station visible. | Chargement lorsque leur représentation nécessite effectivement le modèle ; point/icône conservé à distance. |
| Satellites scientifiques | Téléchargement des dessins et GLB même lorsqu’ils apparaissaient comme de simples points lointains. | Chargement lors du rapprochement, de la sélection ou de l’entrée sur leur page dédiée. Le point demeure visible et sélectionnable auparavant. |
| Modèles haute résolution | Les modèles et textures des anciennes cibles restaient en mémoire. La couche cherchait également leur position dans le catalogue à chaque image. | Libération du modèle précédent au changement de cible ou au retour à la vue générale ; réutilisation possible en décochant/recochant sur la même cible. Position courante conservée directement. Les chargements devenus obsolètes sont libérés. |
| Missions et équipages | Quatre scripts d’interface de station chargés sur toutes les pages ; écouteurs et minuterie inutiles hors stations. | Chargement séquentiel des quatre dépendances uniquement sur ISS/Tiangong ; retrait des écouteurs et de la minuterie hors station. Les données de missions étaient déjà conditionnelles : elles ne sont pas présentées comme un téléchargement systématique antérieur. |
| Menus masqués | Construction immédiate des copies de contrôles de couleur ; observateur du sélecteur déclenché par les compteurs de tout le panneau. | Construction des couleurs à la première ouverture ; suppression de l’observateur de compteurs du sélecteur, synchronisation par les événements de changement. Pas de remplacement des textes de compteur inchangés. |
| Progression lunaire | Styles locaux et balisage différents du chargement terrestre. | Suppression des surcharges locales du chargeur et même balisage pour le pourcentage : taille, signe %, barre et fermeture partagés avec les autres pages. |
| Export statique | Les dépendances de station deviennent dynamiques. | URLs relatives au script et versions recalculées après réécriture de l’export. Fonctionnement prévu sous le préfixe GitHub Pages et en local. |

## Mesures reproductibles

Test du vrai contrôleur `globe.js` avec les classes mathématiques Cesium, un Viewer simulé, 25 000 objets dont 13 500 visibles, et 60 passages de boucle sur une seconde simulée. Le même harnais a été exécuté avec les fichiers sauvegardés avant modification et les fichiers corrigés. Trois exécutions par variante ; durées médianes Node sur cette machine.

| Mesure sur 60 passages | Avant | Après |
| --- | ---: | ---: |
| Conversions géographiques en animation | 810 000 | 405 000 |
| Temps CPU du scénario animé | 237,70 ms | 77,14 ms |
| Conversions en suivi avec chronologie en pause | 810 120 | 180 |
| Temps CPU du scénario de suivi en pause | 189,23 ms | 0,43 ms |
| Demandes de modèles ISS/Tiangong sans station affichée | 2 | 0 |

Les conversions en animation sont réduites de **50 %** ; le temps CPU de cette boucle simulée baisse d’environ **68 %**. Ce ne sont ni des temps de chargement réseau ni des FPS réels : le test n’inclut pas l’exécution GPU de Cesium, le navigateur, les tuiles ou les sources externes. Mesures brutes : `performance-render-2026-10-22.json`.

Autres gains vérifiés par tests : aucune réallocation du canevas lors de 60 images supplémentaires à taille constante ; aucune demande des quatre scripts de station sur Atlas/Starlink/Débris ; aucun téléchargement de dessin/GLB scientifique lointain ; modèle HD précédent libéré lors du changement de cible. Les scripts directement liés dans le document passent de **33 à 30**, soit environ **492 à 470 ko bruts** hors moteur Cesium et ressources optionnelles. La réduction principale vient du travail évité, et non d’une forte diminution de la taille du HTML.

Reproduction du scénario corrigé :

```sh
NODE_PATH=/private/tmp/atlas-menu-check/node_modules ATLAS_RENDER_BENCH=1 node tests/globe-runtime.cjs
```

La variante antérieure utilise en plus `ATLAS_RENDER_BASE=/private/tmp/atlas-performance-before/static`, tant que cette sauvegarde temporaire existe.

## Ce qui est déjà conditionnel et doit être conservé

- La page lunaire est un document distinct : elle ne démarre ni l’application de satellites, ni son worker, ni son catalogue. Quitter un document permet au navigateur de libérer sa scène ; le cache partagé garde les fichiers réutilisables.
- Les images de Terre réaliste et le ciel détaillé ne sont demandés qu’à leur activation. Les deux options restent désactivées lors d’une première entrée normale sur Atlas.
- Les modèles HD sont explicitement activés. Le modèle détaillé ISS reste très lourd : environ 96 Mo de GLB, 2,7 millions de triangles et 220 textures. Il ne peut pas être présenté comme léger pour une petite configuration lorsqu’on choisit cette option.
- Les archives sur disque, ressources sources des modèles et artefacts de compilation ne sont pas chargés intégralement par le navigateur parce qu’ils existent dans le projet. Leur suppression n’améliorerait pas la fluidité du rendu et pourrait détruire des données historiques ou des sources nécessaires aux exports.
- Le calcul orbital est déjà en Rust côté serveur et en Rust/WASM dans un worker côté GitHub Pages. Les instantanés de catalogue et les constantes orbitales sont réutilisés ; les lectures historiques sont mises en cache et déportées. La version navigateur charge des fenêtres historiques, pas toutes les archives au démarrage.
- Les menus réutilisent des contrôles sources. Leur visibilité n’est pas une preuve de consommation GPU ; les téléchargements et les boucles exécutées sont les critères retenus.

## Points restant coûteux et limites de l’audit

1. Cesium et Leaflet restent tous deux présents dans l’application Terre ; Leaflet est encore analysé au démarrage, même si ses tuiles et son fond sont désormais différés. Une séparation complète des deux moteurs demanderait une autre architecture du contrôleur de carte et une validation visuelle complète.
2. Les points 3D utilisent encore les primitives Cesium et une interpolation CPU, désormais limitée aux objets visibles à 30 Hz. Une interpolation dans un tampon GPU pourrait réduire davantage le coût à très forte densité ; elle nécessite des essais WebGL sur plusieurs GPU, particulièrement pour le masquage par la Terre et la sélection.
3. L’API native effectue encore la propagation des objets de la collection à chaque demande et renvoie toutes les positions de cette collection, y compris les débris que le filtre local peut masquer. Ce choix conserve les compteurs et le basculement immédiat des filtres. Modifier les réponses impose un protocole séparant compteurs, visibilité et positions ; aucune réduction de couverture n’a été introduite ici.
4. Le ciel, les textures réalistes et les modèles HD peuvent rester limités par le GPU et sa mémoire. Les durées CPU ci-dessus ne permettent pas de garantir 60 FPS sur toutes les machines.
5. Les styles historiques encore utilisés par le planisphère, les pages dédiées et les menus n’ont pas été supprimés à l’aveugle. Les surcharges inutiles du chargeur lunaire ont été retirées ; les copies de menus nécessaires sont désormais plus tardives et moins souvent synchronisées.

Il n’y a pas eu de mesure de FPS, de mémoire GPU ou de test visuel dans un navigateur accéléré : ce contexte ne fournit pas de navigateur GPU fonctionnel. Les tests HTTP de site complet et d’export WASM nécessitant un serveur/export dédié n’ont pas été exécutés. Un essai réel sur la petite configuration visée reste nécessaire pour quantifier la fluidité finale.

## Validation effectuée

- **61 suites JavaScript réussies**, couvrant notamment scène 3D simulée, sélection et survol, filtres, compteurs, planisphère, suivi, modèles, chronologie, chargement, navigation Terre/Lune, stations, menus, actualités et cache.
- **46 tests Rust réussis**, hors ligne ; aucune modification de la logique de collecte ou des données.
- Test de l’exporteur sur un petit dossier isolé : dépendances dynamiques relatives, empreintes des scripts exportés et progression lunaire.
- Tests ajoutés de sous-ensemble animé, de réapparition d’un objet masqué, de libération des modèles HD, de chargement scientifique au rapprochement et de stabilité du canevas.
- Trois anciens harnais de filtres/recherche ont reçu le simulacre `document.addEventListener` qui leur manquait ; leurs assertions métier restent inchangées.

Pour voir les fichiers locaux corrigés, recharger la page sans cache avec **⌘⇧R**. Aucun redémarrage du serveur Rust n’est requis pour ces modifications de fichiers statiques.
