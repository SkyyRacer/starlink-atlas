# Fluidité de l’Atlas — 23 octobre 2026

L’objectif est un rendu à 60 images par seconde, en adaptant le coût graphique à la machine. Ce seuil n’est pas garanti sur tout matériel, notamment avec le modèle ISS original de 2,7 millions de triangles. Les modèles d’origine, les dessins blancs, les données et les satellites restent disponibles.

## Corrections

- La boucle utilise directement la cadence du navigateur, sans ajouter le limiteur Cesium à 60 Hz qui peut sauter des images aux limites d’horodatage.
- Le rendu commence à un pixel graphique par pixel CSS. Sur un écran Retina ×2, cela représente quatre fois moins de pixels que le rendu précédent. Une adaptation graduelle mesure les intervalles de rendu pendant l’animation ou les mouvements de caméra, réduit la résolution en cas de ralentissement durable et restaure les détails lorsque la marge revient. Les vues en pause ou les onglets masqués ne sont pas traités comme des machines lentes.
- Le cumul d’antialiasing matériel, de MSAA et de FXAA est remplacé par FXAA seul. Le rendu évite également les passes de transparence indépendante de l’ordre ; les effets et matériaux restent affichés par le rendu de transparence standard.
- Le système d’animation du processeur conserve seulement le satellite sélectionné, les stations et les représentations particulières. Tous les autres points restent animés dans le lot GPU, sans recopier leurs objets dans un deuxième système.
- Les coordonnées WGS84 sont calculées dans des objets réutilisés, sans vecteurs intermédiaires. Les tests comparent cette conversion à celle de Cesium, y compris aux pôles et aux hautes altitudes.
- Les couleurs et dimensions communes sont réutilisées. Les compteurs inchangés, les formatteurs de dates et les mesures des étiquettes ne sont plus reconstruits continuellement.
- Le survol ne déclenche plus une lecture de sélection GPU synchrone. Un cône autour du rayon de la souris rejette d’abord les points éloignés, avant la projection précise des candidats. Les clics conservent la sélection précise. La recherche par survol est suspendue pendant un glissement ou le zoom à la molette.
- L’option haute résolution respecte la résolution adaptative et conserve le modèle source intégral. Le remplacement du dessin blanc et les raccords orbitaux restent en place.

## Mesures et limites

Banc du contrôleur avec 25 000 positions et 13 500 satellites visibles, trois exécutions indépendantes par version :

| Mesure | Avant | Après |
| --- | ---: | ---: |
| Mise à jour d’un instantané, médiane CPU | 46,50 ms | 22,59 ms |
| Objets copiés dans l’animation CPU ordinaire | 25 000 | 0 |
| Satellites visibles | 13 500 | 13 500 |

Il s’agit de mesures CPU dans un environnement simulant la scène avec les mathématiques Cesium réelles. Elles ne mesurent pas les FPS du navigateur ni le coût réel du GPU. Les temps varient avec l’échauffement du moteur JavaScript et la charge de la machine.

Les tests couvrent l’adaptation à 30/60 Hz, Retina, le retour progressif des détails, le redimensionnement, les pauses, la précision des positions, les filtres et compteurs, le suivi, les raccords d’orbite, la sélection, l’arrêt des recherches pendant le glissement et l’exclusion rapide des objets éloignés de la souris. Aucun satellite n’est retiré pour réduire la charge.

Ces changements sont préparés localement, sans publication GitHub.
