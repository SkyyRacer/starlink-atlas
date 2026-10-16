# Validation — 12 octobre 2026

## Exécuté avec succès

- Compilation debug et release avec Rust 1.87.0, dépendances verrouillées dans Cargo.lock.
- Sept tests Rust : vecteur SGP4 Vallado en mode AFSPC (tolérance 10⁻⁷ km / 10⁻⁸ km/s), géodésie équateur/pôle, angle sidéral J2000, refus des dates invalides/futures, bornes lancement/désorbitation, import/déduplication et fenêtre ±72 h, sélection de l’époque historique la plus proche.
- Cinq tests API hors ligne isolés : imports orbitaux et catalogue, numéro NORAD à six chiffres, satellite désorbité présent à une date historique valide, trace orbitale, exclusion avant lancement/après rentrée, erreurs HTTP 400, configuration de carte, page statique et absence d’accès HTTP au dossier de données. Fixtures synthétiques séparées du cache réel.
- Vérification syntaxique du JavaScript, formatage Rust.
- Collecte CelesTrak réelle : 12 918 objets dans l’union catalogue/GP ; 1 787 dates de désorbitation renseignées. À la mesure : 11 086 positions valides, 45 objets potentiellement présents sans position exploitable.
- Requête réelle `/api/positions` en release : environ 30 ms, y compris réception/décodage JSON par un client local. Date du 1er janvier 2020 : zéro position et 120 objets sans éléments historiques disponibles. Mesure ponctuelle sur la machine de développement, pas un test de charge.
- Navigateur intégré : carte et attribution visibles, recherche STARLINK-1008, fiche et trace au sol, pause, date historique sans éléments, lecture ×100 avec arrêt au présent, retour « Maintenant ».
- Responsive vérifié à 390 × 844 : carte puis filtres dans une page défilante, chronologie et commandes accessibles ; viewport de bureau également inspecté.

## Non validé

Pas de campagne sur Firefox/Safari/Opera ni sur Windows/Linux, pas de test de charge ou d’uptime. L’interface utilise des standards HTML/CSS, Canvas et Leaflet ; compatibilité visée avec les versions modernes, sans garantie pour tous les navigateurs historiques. Pas de validation Docker dans cet environnement. Pas de comparaison des positions Starlink calculées avec une télémétrie opérateur indépendante.

Les tests scientifiques vérifient l’intégration du propagateur et la conversion de coordonnées à des points connus ; ils ne certifient pas une précision réelle Starlink. Le mouvement polaire/UT1 n’est pas pris en compte. L’historique complet et les états opérationnels passés ne sont pas fournis. Les sources et leurs conditions doivent être revérifiées avant publication/exploitation.

## Reproduire

Depuis le dossier du projet :

```sh
cargo test --locked
cargo fmt --check
cargo build --release --locked
python3 tests/smoke.py
```

Le dernier contrôle nécessite Python 3 et utilise uniquement sa bibliothèque standard. Sur Windows, définir `ATLAS_BINARY` avec le chemin du `.exe` avant ce test. Le dossier temporaire et le serveur de test sont supprimés/arrêtés à sa fin ; aucune requête externe n’est émise par ce test.

## Correctifs cartographiques

Répétition des tuiles supprimée, coordonnées uniques pour les points et les traces, limites de déplacement et de dézoom adaptatives. Découpe géographique des traces à ±180° avec interpolation aux bords ; suppression de la coupure dépendant de la largeur de fenêtre. Début de trace identifié « −1 tour », car une trace au sol ne se ferme pas après une révolution orbitale. Zoom animé désactivé pour éviter une désynchronisation temporaire du Canvas et du fond.

Tests Node : passages dans les deux sens à ±180°, continuité normale, conservation de la dernière position et absence de diagonale traversant le monde. Vérification visuelle de la fiche STARLINK-1008 et bouton de dézoom désactivé au minimum.

## Trace future

Ajout de la projection SGP4 du prochain tour en pointillés bleus, calculée avec les mêmes éléments que la position et la trace passée. Tests API étendus : départ exactement identique au point satellite et à la fin de la trace passée, 121 points sur une période, déplacement effectif, interruption avant une désorbitation connue. Chronologie toujours limitée au présent.

## Retour dans le passé

Correction de la perte de requête lors du changement de date pendant un chargement (nouvelle sélection mise en attente, ancienne réponse ignorée). Test Node exécutant la fonction réelle avec réponses contrôlées : la nouvelle requête est lancée même en pause et seule sa réponse apparaît. Six tests API réussis, dont suggestion d’une époque archivée puis retour d’une position à cette époque. Les archives manquantes ne sont pas remplacées par des positions fabriquées.

## Historique public effectivement installé

Import final en UTC : **10 886 344 observations** sur **3 148 journées disponibles**, du **22 février 2018 à 15:41:15 UTC** au **10 octobre 2026 à 23:59:45 UTC**. Prototypes Tintin A/B inclus. Source Julien Simon / Space-Track TLE History, révision `8ee9ed364d18b6e6b8d22e0b11dd3bfd775ed156`, licence déclarée CC BY 4.0. Une observation réelle par satellite/jour disponible ; précision réduite de certains champs Parquet. Collecte GP actuelle utilisée en complément.

Les données préparées avec un fuseau local ont été écartées et entièrement réimportées depuis la source en UTC. Le test d’import hors ligne vérifie l’été, l’hiver, le changement d’heure, la journée UTC et la fusion sans doublon. Sept tests API passent, notamment le chargement paresseux d’archives historiques et le retour entre deux époques ; sept tests Rust et les contrôles JavaScript passent.

Mesures locales de l’API sur les archives finales :

| Date UTC | Positions | Sans position exploitable | Temps ponctuel |
|---|---:|---:|---:|
| 2018-02-22T16:00:00Z | 2 | 0 | 0.012 s |
| 2019-06-12T13:21:00Z | 55 | 7 | 0.003 s |
| 2020-06-12T13:21:00Z | 477 | 0 | 0.009 s |
| 2021-06-12T13:21:00Z | 1662 | 0 | 0.025 s |
| 2022-06-12T13:21:00Z | 2403 | 0 | 0.049 s |
| 2023-06-12T13:21:00Z | 4215 | 52 | 0.061 s |
| 2024-06-12T13:21:00Z | 6153 | 0 | 0.104 s |
| 2025-06-12T13:21:00Z | 7684 | 51 | 0.113 s |
| 2026-06-12T13:21:00Z | 10549 | 106 | 0.151 s |

Dans le navigateur intégré, la date du 12 juin 2026 à 13:21 affiche 10 549 positions. Fiche STARLINK-34043 : époque historique du 12 juin 2026 à 06:07:30 UTC, altitude estimée 487,7 km et vitesse 7,623 km/s, traces passée et future présentes. Ce contrôle valide le fonctionnement, pas une exactitude indépendante par rapport à une télémétrie opérateur. Les trous par satellite restent signalés (106 objets sans position à cette date).

## Satellite désorbité sélectionné

Le satellite sélectionné conserve son point blanc cerclé et son nom lorsqu’une position existe dans le passé, même si le filtre « Désorbité » ne correspond plus à son état historique « En orbite ». Après sélection ou changement de date, la carte se centre sur sa position disponible. Les autres objets restent filtrés normalement. Le backend continue d’exclure les points avant lancement et après désorbitation ; aucun point n’est fabriqué en l’absence d’éléments. Test de la règle de visibilité ajouté au contrôle géométrique JavaScript.

Vérification navigateur du correctif : Tintin A (désorbité le 29 août 2020), sélectionné avec le filtre « Désorbité », réapparaît comme un point blanc cerclé à la date du 12 juin 2019 à 13:21 UTC. Compteur visible : 1 ; fiche historique et traces disponibles.

## Dézoom et mouvements

Minimum de zoom calculé à partir de la largeur ET de la hauteur disponible, avec le monde entier au-dessus de la chronologie. Zoom fractionnaire par quarts de niveau, boutons par demi-niveau, molette moins sensible (360 px/niveau, temporisation 90 ms). Points plus petits en vue globale. Canvas déplacé avec le panneau cartographique pendant le glissement ; dessins regroupés à la fin des mouvements et zone de marge pré-dessinée. Ombre jour/nuit construite par un polygone géométrique au lieu du balayage pixel par pixel.

Vérifications : vue entière sans répétition sur bureau et à 390 × 844, boutons +/−, déplacement souris et molette dans le navigateur intégré ; tests géométriques du terminateur aux deux saisons et à l’équinoxe, syntaxe JS et test de concurrence des changements de date réussis. Pas de mesure chiffrée de fréquence d’images ni de test sur chaque matériel.

## Globe 3D — 12 octobre 2026

Compilation release et 7 tests Rust réussis ; 7 tests API hors ligne réussis, dont continuité des trajectoires 3D passée/future à la position du satellite et conservation de l’altitude. Vérifications Node de géométrie et de changement de date réussies.

Dans le navigateur intégré : globe OSM chargé sans compte, rotation à la souris, orientation par flèches et remise au nord, altitude ×1/×3, retour 2D/3D conservant la date du 12 juin 2026 à 13:21 UTC et la sélection STARLINK-34043 (487,7 km), puis vue globale. Vérification à 390 × 844 : commandes accessibles, globe et chronologie visibles ; fiche défilante. Aucun message d’erreur JavaScript après correction de l’initialisation. Safari/Firefox et les autres OS n’ont pas été testés directement pour cette version 3D.

Correction boussole : projection du nord au centre de la vue, prise en compte du roulis, mise à jour cumulée des petits mouvements. Vérifié dans le navigateur : flèche droite → 5°, clic → 0° ; glisser la boussole → 19° ; vue inclinée et tournée → 29°, clic → 0°. Aucun message d’erreur JavaScript.

Suivi caméra : bouton Suivre/Libérer, repère local attaché au satellite et interpolation entre mises à jour. Contrôle visuel en historique ×2/×5/×10/×100, pause, zoom et déverrouillage ; boussole et coordonnées actualisées lors des déplacements souris. Tests Node de géométrie et de requêtes concurrentes réussis.

Rotation synchronisée : glissement horizontal du globe de 84 px → boussole 42° ; glissement de la boussole de 36 px → 60° ; bouton Recentrer retourne au cadrage initial avec 0°. Les coordonnées sous la boussole ont été retirées. Vérification dans le navigateur intégré.

Vue satellite : retour aux commandes de rotation Cesium originales dès qu’un satellite est sélectionné. Le geste personnalisé du globe est désactivé dans cette vue ; les mouvements en attente sont effacés au changement de mode. Suivi et altitudes conservés. Vérification syntaxique et tests Node réussis.

Cadrages satellite : Vue du dessus (pitch −90°) et Vue de côté (pitch 0°, perpendiculaire à la hauteur locale), centrés sur le satellite. Vérification navigateur sur STARLINK-34043 : chaque bouton active le suivi depuis son état désactivé ; aucune erreur JavaScript.

Échelle réelle fixe et mouvement continu : suppression du sélecteur, coordonnées 3D sans facteur d’exagération. Interpolation latitude/longitude (passage ±180° le plus court) et altitude à chaque image pour tous les points, 2D et 3D, avec caméra attachée à la position interpolée. Tests Node : progression par petits pas, arrivée exacte, continuité lors d’une nouvelle réponse, nouvelle date/pause, nouveaux satellites et absence de données. Vérification navigateur : aucun sélecteur, échelle 1, vues 2D/3D, suivi ×100 et pause, aucune erreur JavaScript.

Interface résultats : rubrique Couches cartographiques et cases à cocher supprimées ; liste placée directement après les filtres, compteur et cartes nom/NORAD/état, zone de défilement agrandie. Fond, jour/nuit et trajectoires conservés automatiquement, noms globaux désactivés. Recherche et sélection vérifiées en navigateur, passage 3D sans erreurs JavaScript. Tests de requêtes concurrentes et interpolation réussis.

Pagination : 100 satellites par page, toutes les entrées accessibles avec flèches précédente/suivante, numéro de page et intervalle affiché. Tests Node : 205 entrées réparties en 100/100/5, limites, filtres et résultat vide. Navigateur : page 2/130, 100 cartes, intervalle 101–200 ; filtrage revient à 1/1 et désactive les flèches ; aucune erreur JavaScript.

13 octobre 2026 : sélection depuis la liste liée au point sur la carte, cadrage au zoom minimum 5 pour éviter une fiche masquante au dézoom maximal. Fiche décalée, lignes désorbitées grisées et état ambre ; absence de position expliquée.

Zone visible au sol : bouton dans la fiche en 2D et 3D, limite sphérique à élévation 0°, mouvement interpolé. Tests géométriques : altitude nulle, horizon tangent pour toutes les bornes, latitudes 0°/40°/±85° et passage ±180°. Navigateur : zone et contour sur planisphère et globe, suivi ×100, masquage/réactivation, aucune erreur JavaScript. Limites optiques explicites dans la fiche et la documentation.

Fonction de zone au sol retirée à la demande : bouton, géométrie 2D/3D et documentation supprimés. Tests Node de géométrie, pagination, interpolation et concurrence réussis. Versions des fichiers navigateur renouvelées.

Dates locales : fuseau/langue du navigateur, saisie locale et envoi UTC, chronologie, époques, collectes et archives converties. Tests Paris été/hiver, heures manquantes/répétées, New York avec changement de jour, Kathmandu UTC+05:45, UTC et conservation des jours sources sans heure. Navigateur Paris : janvier UTC+01:00 ; juin UTC+02:00, 15:21 locale correspond à 13:21 UTC avec altitude 487,7 km ; époque 08:07:30 locale. Aucune erreur JavaScript. Les heures de lancement/désorbitation non fournies ne sont pas inventées.

Filtres multiples : tests OU entre années/lancements, ET entre groupes et réinitialisation réussis. Navigateur : 2026+2024 → 4 131 résultats ; deux lancements 2026-225+2026-219 → 53 résultats ; Effacer rétablit toutes les années, aucune erreur JavaScript. Option Inconnu retirée du filtre d’état.

Accueil et recentrage : navigateur ouvre directement la 3D ; ordre Terre 3D puis Planisphère. Bouton Recentrer vert visible dans les deux vues ; en 2D, zoom puis recentrage restaure le planisphère complet. Aucune erreur JavaScript.

Groupes de lancements : tests de tri dynamique avec années 2027 et 2028. Navigateur : cocher 2026 sélectionne 82 vols ; décocher un vol rend le groupe indéterminé ; réinitialiser Tous désactive les actions dans les deux filtres ; aucune erreur JavaScript.

Recherche assistée : S → suggestion STARLINK, Espace → STARLINK-. Navigateur : filtre 2024 et recherche 34043 → proposition STARLINK-34043, année 2025 et vol 2025-092. Non conserve 2024 ; Oui réinitialise et montre une seule ligne et le point sélectionné. Tests de suggestion, recherche globale, refus et sélection exacte réussis ; aucune erreur JavaScript.

Commandes 3D : zoom +/−, joystick circulaire avec maintien et glissement, arrêt au relâchement et changement de vue. Recherche : Space et Tab complètent STARLINK-, Shift+Tab garde la navigation arrière.

Recherche numérique : proposition issue du catalogue complet, affinée à chaque chiffre, arrêt sur nom exact ou absence de correspondance ; validation Tab/Espace. Tests search.cjs étendus.

Entrée dans la recherche sélectionne le premier résultat de la page affichée ; réaffiche la confirmation hors filtres même après Non ; signale une recherche sans résultat. Tests search.cjs : OK.

Navigation : haut/bas et pavé numérique 8/2 parcourent les résultats filtrés après sélection, changent de page automatiquement, rendent la sélection visible et préservent les champs de saisie. Tests navigation.cjs : OK.

Planisphère : clic simple sélectionne sans centrage immédiat ou différé ; double-clic sélectionne avec centrage et zoom minimum 5 ; liste conserve le centrage. Zoom natif au double-clic désactivé pour éviter le double déplacement. Tests map-selection.cjs : OK.

Fiche : suppression de l’écart à l’époque ; référence orbitale explicitée ; infobulles sur chaque ligne avec délai 1 s et accès clavier. Les lignes persistent pendant les mises à jour afin de préserver le survol.


Sources publiques supplémentaires, 13 octobre 2026 :
- 9 tests Rust passent, dont rapprochement d’identité SupGP, déduplication, validité vers l’avenir, rejet des heures GCAT incertaines ou discordantes et frontière exacte du lancement.
- 7 tests API isolés passent ; tests recherche, sélection planisphère, navigation et course des positions passent.
- Données réelles : 11 154 SupGP reçus, 11 101 recoupés avec SATCAT ; 12 196 lancements GCAT recoupés.
- API actuelle : 11 128 positions au moment du contrôle ; NORAD 100753 utilise CelesTrak SupGP / SpaceX, lancement enrichi 2026-09-20T01:47:00Z.
- API 2026-09-21 : NORAD 100753 reste absent, aucun historique inventé.
- Fiche et sources vérifiées dans le navigateur ; aucune erreur JavaScript observée. Rapport outputs/sources-validation.json et capture outputs/sources-publiques.png.


Calendrier / train, 13 octobre 2026 :
- Calendrier contrôlé à droite au-dessus de la chronologie, fermeture Escape/clic extérieur, calendrier local et rejet des dates futures ; sur petit écran hauteur limitée à l’espace disponible.
- Vérification navigateur : calendrier entièrement dans une fenêtre 1265×720 ; choix 30 septembre 2026 à 14 h converti correctement en Europe/Paris UTC+02:00, fermeture après validation.
- Fiche plafonnée au-dessus de la chronologie pour éviter de masquer ses commandes ; bouton train affiche 26 résultats pour le lancement 2026-225.
- 9 tests Rust, 7 tests API, recherche et navigation passent ; tests/supgp_import.py confirme la provenance conservée après import/rechargement et l’absence de propagation SupGP avant l’époque.
- Aucune position inventée au largage. Liste de demande : outputs/demande-archives-lancement-2026-225.txt ; capture outputs/calendrier-train.png.


16 octobre 2026 — calendrier et bouton de vol :
- Clic sur le champ date : ouverture sans annuler le clic ni déplacer le focus ; saisie clavier 2026-10-13T15:30 puis Entrée vérifiée, horloge locale 15:30 UTC+02.
- Calendrier non modal placé dans le corps de page, position fixe ancrée au champ, bornée au viewport et recalculée au défilement/redimensionnement ; plus de contexte de superposition de fiche ou de carte.
- Libellé dynamique « Voir tous les satellites du vol 2026-225 », état aria-pressed visible ; activation et désactivation vérifiées dans le navigateur.
- Sélection du vol depuis le menu de gauche puis sélection d’un autre satellite du vol : bouton actif. Clic de désactivation : case 2026-225 décochée et résumé Tous les lancements.
- Tests recherche/navigation : OK ; aucune erreur JavaScript observée. Capture outputs/date-vol-synchronises.png.

Désactivation du bouton de vol en 3D : suppression du filtre puis appel de la même commande home que Recentrer ; demande de focus annulée avant actualisation pour préserver le retour à la vue globale.

16 octobre — retrait du calendrier personnalisé et du bouton Date. Conservation du champ datetime-local natif et de la saisie clavier. Lorsque l’espace inférieur est insuffisant, le champ est remonté temporairement avant ouverture, avec emplacement réservé et retour à sa position au blur. Vérification navigateur : focus conservé, champ entre y=247,5 et y=288 dans une fenêtre de hauteur 720, soit 432 px disponibles sous le champ. Le popup natif dépend du navigateur et n’est pas rendu dans les captures DOM.

16 octobre — refonte du choix de date : champ fixe compact dans la chronologie, saisie locale au clavier, calendrier assorti dans un panneau ancré au champ et borné à la fenêtre. Mois/année directement sélectionnables, heure éditable, validation explicite, dates futures refusées, fermeture extérieure/Échap et parcours clavier. Vérifié dans le navigateur : 13/10/2026 15:30 par calendrier et 12/10/2026 14:20 par saisie, horloge correcte et aucune erreur JavaScript. Tests fuseaux et navigation réussis. Remplace le déplacement temporaire du champ décrit précédemment.

16 octobre — thème visuel inspiré des références fournies : noir/blanc, Helvetica système, titres en capitales, contours fins, états actifs contrastés, transitions de couleur 180 ms avec respect de la réduction des animations. Thème CSS séparé ; seules les couleurs du rendu carte/globe changent dans les scripts. Aucun gestionnaire ni fonction modifiés. Vérification navigateur : 3D, planisphère, calendrier, recherche et fiche satellite, puis largeur mobile 390 px sans débordement horizontal visible. Tests sélection carte, navigation et fuseaux réussis.

Touches bleu glacier ajoutées au thème : marque, compteur visible, sélections, recentrage, calendrier et repères de navigation. Changement CSS uniquement.

Retour au thème noir et blanc. Introduction de la colonne gauche, indicateur de mode en tête et bouton de rafraîchissement manuel retirés avec leurs références JavaScript. Collecte automatique des données conservée.

Planisphère : retrait de l’inversion de couleurs, saturation/luminosité/contraste alignés sur les paramètres 3D. Ombre nocturne allégée ; marqueurs détourés ; rendu canvas limité au rectangle géographique mondial pour éviter les débordements. Retour 3D→2D : état de mouvement réinitialisé et redessin demandé. Message de filtres recalculé aussi bien après masquage que restauration. Vérifié navigateur : recherche sans résultat puis suppression, bascule 3D/2D, aucune erreur console. Tests géométrie, sélection carte et réponses de positions périmées réussis.

Vue mondiale : Natural Earth II local sous zoom 3, mosaïque TMS réassemblée et reprojetée de coordonnées géographiques en Mercator, sans joints de tuiles visibles ; retour au fond OSM au zoom détaillé. Points orange #ff9b45 dans les deux vues et blanc pour la sélection, contour sombre. Tests orientation nord/sud, échantillonnage équateur et alternance Natural Earth/OSM réussis ; vérification navigateur des deux vues et zoom, aucune erreur observée.

Navigation et cadrage : points blancs restaurés, Natural Earth en niveaux de gris calculés une fois dans le canvas. Fond mondial conservé sous les tuiles OSM lors du zoom ; filtres CSS appliqués aux tuiles individuelles pour éviter la composition d’une très grande surface filtrée. Rotation 3D Cesium native ancrée au sol, inertie réduite ; facteur de zoom adapté à l’altitude, sensibilité 2D adaptée au niveau. Cadrage initial et Recentrer calculés depuis le champ de vision et la taille de fenêtre (enveloppe orbitale ~74 %). Vérifiés : glisser 3D, zoom détaillé sans trous visibles, recentrage des deux vues, aucune erreur console. Tests aperçu mondial avec fond persistant, géométrie et interpolation réussis.

Commandes : aide de manipulation sous l’altitude retirée, panneau de suivi aligné à gauche et dégagement prévu sous la boussole en fenêtre courte. Flèches retirées des boutons Maintenant/Recentrer. Luminosité du globe réduite de 0,65 à 0,57. Recentrer 3D grisé sur la position initiale et après la fin du retour, réactivé après déplacement de caméra ; vérifié au navigateur par zoom puis recentrage. Même état synchronisé en 2D. Aucune erreur console observée.

Fermeture de fiche : fonction commune à la croix et aux clics hors surface, désélection, suppression des trajectoires et invalidation des réponses en cours, retour au cadrage initial 3D/2D. Clic 3D : satellite prioritaire, puis intersection avec l’ellipsoïde pour distinguer la Terre du vide ; clic 2D : coordonnées comparées aux limites du monde. Vérifié au navigateur : croix puis bouton Recentrer grisé, surface 3D et carte conservant la fiche, vide dans les deux vues fermant la fiche. Tests de fermeture/recentrage et réponses périmées réussis.

Publication GitHub Pages : moteur orbital partagé Rust/WebAssembly dans un Worker, sans serveur de calcul public. Tests Rust (10), API hors ligne (7), suites JavaScript et WASM réussis. Test public : 50 téléchargements simultanés de 2,66 Mo chacun, 50 succès, 12,49 s au total depuis la connexion de test ; cette mesure ne constitue pas une garantie de SLA ou de rendu de 50 navigateurs. Calcul de 50 images orbitales locales : environ 29–30 ms/image. Page publique vérifiée : 11 152 positions actuelles, 10 549 positions au 12 juin 2026, pas d’erreur console. Édition des données conservée jusqu’au rechargement, archives de collecte adressées par contenu et conservées sept jours. Collecte vérifiée toutes les 30 min, GP/SupGP au plus toutes les 2 h, catalogue/GCAT toutes les 24 h.
