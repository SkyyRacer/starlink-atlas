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

### ISS — missions, équipage et tailles Atlas (19 octobre 2026)
- 15 tests Rust réussis, dont validation station, sélection des événements d’amarrage ISS, durée depuis l’arrivée sans remise à zéro lors d’un changement de port, exclusion d’un futur vol et des membres revenus au sol.
- Vérifications Node : collections, sélection carte, navigation, recherche, pagination et syntaxe des fichiers modifiés.
- Cache normalisé : 318 vols documentés de 1998 à 2028 (inclut vols futurs), 7 membres à la collecte. Les lacunes restent non renseignées.
- Vérification navigateur locale : sélection ISS/Atlas, ouverture Crew-13, dates locales, durée du vol / séjour distinctes, drapeaux et agences ; dialogue dans un viewport de 390×844 sans débordement horizontal, fermeture par Échap et depuis le panneau mobile.
- Aucune publication ou modification GitHub.

### Ajustements du panneau ISS (19 octobre 2026)
- Équipage au-dessus de la recherche et de l’historique ; nombre de personnes à côté de l’expédition.
- Menu « Toutes les années » fermé par défaut, puis années dépliables individuellement.
- Recherche locale sur les missions/vols et astronautes des équipages de départ et de retour, avec noms accentués, priorité de correspondance, dédoublonnage et message sans résultat ; tests `node tests/iss-search.cjs` réussis.
- Vérification navigateur : fiche Jessica Watkins, fiche Crew-13, navigation flèche/Entrée, fermeture de la fiche, absence de résultats et menu annuel dans le panneau mobile.

### EVA et cartes d’équipage cliquables (19 octobre 2026)
- 17 tests Rust et tests Node `iss-evas.cjs`, `iss-search.cjs` réussis. Déduplication des sorties, cumul sans multiplication par le nombre de participants, exclusion du futur, distinction des sorties en cours et durées absentes.
- Source publique limitée temporairement (HTTP 429) lors de la reprise des archives : cache initial de 300 sorties, du 18 juillet 2001 au 1er septembre 2026. Couverture partielle affichée, reprise complète prévue automatiquement aux prochaines collectes ; aucun zéro de carrière n’est déduit d’une absence de données.
- Navigateur local : clic sur la carte de Pyotr Dubrov, fiche affichant quatre sorties documentées et 29 h 49 min, dates début/fin, durée par sortie, participants et liens source. Aucun débordement horizontal dans le panneau étroit.
- Collectes LL2 sérialisées pour éviter le chevauchement des reprises historiques missions/EVA et respecter le quota public. Aucun déploiement.

### Fiches, drapeaux et complément EVA (19 octobre 2026, 10 h 22)
- Suppression de la ligne « Présence à bord ». Libellé discret encadré sous le nom, sans point ni effet lumineux ; uniquement pour les membres de l’équipage actuel, avec distinction des données anciennes.
- Équipages au lancement et au retour cliquables vers les fiches astronautes. Vérification des profils Luke Delaney, Joshua Kutryk et Kjell Lindgren, y compris au clavier ; absence de statut actuel pour les anciens équipages.
- Drapeaux locaux SVG flag-icons 7.6.0 (MIT), 257 ressources vectorielles ; tous les pays du catalogue couverts, XML valide, remplacement neutre pour les nationalités inconnues. Aucun emoji dans ces fiches.
- Après réouverture du quota fournisseur : deux dernières pages EVA récupérées, 500 identifiants uniques sur les 500 sorties annoncées par Launch Library 2, du 18 mars 1965 au 1er septembre 2026. Cache marqué complet vis-à-vis de la source, sans prétendre à une exhaustivité historique absolue. Mention initiale de couverture partielle retirée automatiquement par les données.
- Tests Rust (17), recherche ISS et statistiques EVA validés. Aucun déploiement.

### Documents séparés et personnalisation Atlas (19 octobre 2026)
- Routes HTML `/atlas`, `/iss`, `/starlink`, titres propres, redirections de la racine et des variantes avec barre finale : réponses HTTP 200 vérifiées après redirection.
- Navigation complète via le menu « Changer de page » ; vérification navigateur Atlas → ISS → Starlink, URL et rubrique correctes après chargement. État remis à zéro, données collectées côté serveur conservées.
- Cartes Atlas ISS / Starlink, case globale avec état intermédiaire, compteurs de positions affichées et sélecteurs de couleur. Choix de couleur testé sur le globe et le planisphère ; masquage/rétablissement Starlink vérifié.
- Statut actuel en texte vert, sans point, et aucun lien dans la section EVA des fiches astronautes.
- 17 tests Rust, tests Node pages/collections/carte/navigation/recherche ISS/EVA et changements de date en cours de requête réussis. Aucun déploiement et aucun module publicitaire ajouté.

### Accueil Atlas et palette rapide
- La racine redirige désormais vers `/atlas`. Les choix ISS/Starlink conservent une navigation complète vers leurs pages dédiées.
- Suppression de la rubrique globale « Tous les éléments » ; seules les deux cartes de catégorie restent affichées.
- Huit couleurs prédéfinies par catégorie, sélection visible, synchronisation avec le sélecteur libre et application sur les deux vues.

### Navigation mise en valeur et palette native uniquement
- Libellé « Choisir les satellites à observer », encadré bleu discret et rappel Atlas / ISS / Starlink.
- Suppression des pastilles prédéfinies visibles sous les catégories. Carré natif conservé, avec libellé associé « Modifier la couleur ».
- Vérification navigateur : désactivation/réactivation Starlink, mise à jour de la couleur libre et absence de pastilles sous les cartes. La présentation de la palette native peut varier selon l’OS et le navigateur ; aucune vérification sur d’autres OS n’a été revendiquée.

### Préparation de la publication GitHub Pages
- Aucun envoi ni configuration GitHub exécuté par l’agent ; `scripts/publish_github.sh` préparé pour lancement manuel, syntaxe Bash vérifiée. Dépôt cible contrôlé, arrêt en cas de modifications préexistantes, synchronisation sans `.env`, `target`, données de travail ou ZIP.
- Export statique de 33,9 Mo testé sous `/starlink-atlas/` : trois documents avec base relative, tous les scripts chargés, drapeaux SVG, initialisation du worker WASM avec missions et EVA incluses. Tests `tests/static-pages.cjs` et `tests/wasm.cjs` réussis (11 152 points calculés lors de ce test).
- Routes de navigation adaptées au sous-chemin GitHub Pages et aux pages locales. Aucun appel API Rust requis pour les fiches ISS dans la version statique.
- Workflow de publication converti en téléversement d’artefact et déploiement Pages officiels. Le script manuel configure Pages en mode workflow, puis pousse main ; les collectes planifiées restent actives.
- Signature de Quentin Jaros ajoutée au planisphère avec le même style et alignement bas/gauche que la vue 3D.


## Optimisation locale et recherche d’objets — 19 octobre 2026

- Démarrage : configuration/chargement du moteur 3D en parallèle avec catalogue puis positions ; la disponibilité du moteur ne bloque plus les données.
- API locale : paramètre optionnel `collection=all|iss|starlink` sur catalogue et positions. Les catalogues JSON sont réutilisés par édition immuable et collection ; les archives ISS filtrent avant la préparation SGP4. Deux fenêtres historiques en cache évitent l’éviction mutuelle ISS / Atlas.
- Mesures HTTP locales, même cache disque, même date `2026-10-19T10:00:00Z`, moteur release, sans compression demandée. Médiane de trois requêtes chaudes : catalogue ISS 36,76 ms → 0,21 ms (4 149 712 → 56 554 octets), positions ISS 27,12 ms → 0,25 ms (2 597 794 → 375 octets). Mesures indicatives de réponses API, pas du chargement complet d’une page. Positions comparées exactement avec l’ancien binaire : ISS, Starlink et Atlas identiques.
- Taille schématique ISS progressive suivant hauteur de caméra et dimensions du cadre, adaptée aussi au planisphère. Taille réduite en vue générale, plus lisible à proximité / lors de la sélection.
- Recherche de pages : ISS / Starlink et synonymes, casse et accents normalisés, clic sur résultats ; Entrée et Tab sur résultat unique, flèches puis Entrée sur plusieurs résultats, Échap pour fermer. Navigation complète conservée et aucune préférence sauvegardée.
- Vérifications : 20 tests Rust réussis ; tests Node pages, recherche interactive, taille ISS, réponses périmées, collections, navigation, sélection carte et interpolation réussis. Contrôle HTTP des trois documents et du catalogue/positions ISS avec édition de visite. Compilation release réussie.
- Aucune publication GitHub. Serveur local relancé sur le port 3002. Contrôles fonctionnels et de données réalisés ; pas de capture de rendu navigateur disponible pendant cette validation.


## Découpage des données en ligne et cache commun — 19 octobre 2026

- Export testé sous `/starlink-atlas/`, sans mise en ligne. Ancien démarrage : 5 258 841 octets de données compressées (bloc commun et archives des 16–19 octobre). Nouveau démarrage : 1 265 976 octets pour Atlas, 1 265 819 pour Starlink (environ −76 %), 1 429 pour ISS. Ces volumes excluent moteur 3D, WASM, styles, images et tuiles ; ce ne sont pas des mesures de temps de chargement complet.
- Fichiers orbitaux par page, tableaux de valeurs sans perte de précision, catalogue simplifié, GCAT par groupes d’identifiants au clic, missions / EVA hors du démarrage du moteur orbital. Configuration et catalogue disponibles même si l’initialisation WASM n’est pas terminée.
- Comparaisons strictes avec le parcours précédent : toutes les positions et les quatre trajectoires (2D/3D, passée/prédite), pour les trois collections, le 19 octobre dans la fenêtre courante et le 18 octobre dans les archives. Aucune tolérance numérique ajoutée. Les candidats d’époque quasi identique restent dans l’ordre initial pour conserver le choix SGP4 à la seconde.
- Cache Service Worker limité aux ressources de rendu réutilisables et aux tuiles CORS avec expiration. Tests : téléchargement partagé, mise à jour par version d’asset, exclusion des données / pages, limites de stockage, exclusion des images opaques, nettoyage des versions précédentes.
- Tests d’export HTTP et moteur WASM réel, tests transport sans moteur prêt, tests cache simulé, 20 tests Rust et tests de sélection / suivi / recherche / interpolation réussis. Métadonnées natives comparées avec l’édition de départ. Compilation native et WASM release réussie.
- Serveur natif sur `http://127.0.0.1:3002/atlas`. Prévisualisation de l’export destiné à GitHub Pages sur `http://127.0.0.1:3004/starlink-atlas/atlas/`. Pas de validation visuelle ni de mesure sur téléphone pendant cette session.


## Vue ISS au repos et face nocturne — 19 octobre 2026

- Éclairage nocturne légèrement relevé au dézoom : ombres ambiantes et atténuation du contraste jour/nuit progressives entre 5 000 et 15 000 km de hauteur caméra. Paramètres initiaux conservés sous 5 000 km ; pas de nouvelle passe de rendu.
- Page ISS / vue 3D : après dix secondes sans activité, centrage global sur l’ISS, transition de 0,8 seconde et suivi de la position interpolée en conservant la Terre entière. Aucune fiche ouverte automatiquement. Le bouton affiche « Libérer la caméra » pendant le suivi au repos.
- Un clic gauche sur le globe libère la caméra ; le clic de sortie sur le modèle ne relance pas immédiatement sa sélection. Le comportement de fermeture sur le vide reste présent. Les commandes explicites de caméra libèrent aussi ce mode. Un nouveau délai de dix secondes permet de le réactiver.
- Suivi inactif sur les autres pages, en planisphère, dans un onglet masqué / sans focus, pendant un geste maintenu ou avant l’ouverture d’une boîte de dialogue. Le passage de vue / perte de focus libère le suivi.
- Tests Node : politique d’inactivité (limite des dix secondes, activité, arrêt et réarmement), éclairage progressif, sélection / suivi manuel, fermeture de fiche et taille du modèle ISS réussis. Export statique reconstruit pour la prévisualisation locale. Pas de validation visuelle disponible pendant cette session ; aucune publication GitHub.


## Barre de chargement initial — 19 octobre 2026

Animation 0–100 % sur la carte, Terre floutée en arrière-plan (illustration légère avant l’arrivée de la scène, puis globe réel). Suppression de « Chargement du catalogue… ». Les pourcentages suivent les étapes effectivement terminées : configuration, catalogue, scène et premières positions. Animation courte entre les étapes et disparition après 100 %, sans délai artificiel long ; préférence de mouvement réduit respectée. Une erreur retire le voile et conserve les messages existants. Tests de progression, erreur, nouvelle tentative et non-régression suivi / sélection / recherche réussis. Export local reconstruit, aucune publication GitHub ; pas de validation visuelle disponible.


## Progression négative : correction commune et anciennes versions — 19 octobre 2026

Les documents Atlas / ISS / Starlink et le petit contrôleur de progression sont désormais récupérés sans réutiliser une ancienne entrée du cache. Le Service Worker ignore / supprime les anciennes copies de `loading.js` et `asset-cache.js`, y compris lorsque l’URL porte un ancien numéro de version. Le cache du moteur 3D, de la carte et du WASM reste actif. Le serveur natif émet `Cache-Control: no-store` pour les documents et scripts de démarrage concernés.

Vérifications : 24 ordres de fin de chargement pour chacune des trois pages, horodatages RAF antérieurs, absence de valeurs négatives / de recul, récupération réseau malgré une copie obsolète en CacheStorage et conservation du moteur déjà téléchargé. Vérification HTTP et exécution du script réellement servi sur les six URL (trois pages natives + trois pages de l’export local) : même version `b2b828256bd1`, 0–100 sans valeurs négatives. 20 tests Rust réussis ; serveur local relancé et export reconstruit. Aucune publication GitHub.


## Galileo, accueil et recherche globale — 19 octobre 2026

Ajout du groupe CelesTrak Galileo, catalogue SATCAT filtré, cache et collecteur dédié ; intégration au calcul natif et WASM. La page Galileo et les pages existantes restent isolées ; Atlas réunit les trois familles. Filtres, fiches, suivi, couleurs et cadrage 3D adaptés aux orbites hautes. Logo cliquable vers Atlas, recherche de pages incluant « Tous les satellites », validation Entrée / Tab et liens adaptés au sous-chemin statique.

Vérification HTTP locale : 36 entrées Galileo au catalogue, 25 positions exploitables au moment du contrôle (fenêtre de 72 h), 1 ISS et 12 947 Starlink au catalogue ; aucune intersection Galileo / Starlink. Les orbites Galileo excentriques conservent leur altitude calculée, sans contrainte artificielle à l’altitude nominale. Les fichiers GP contiennent 32 objets : un élément trop ancien ne produit pas de position inventée.

22 tests Rust réussis, ensemble des tests Node de comportement réussi. Export local reconstruit ; calculs et traces exactement identiques entre données complètes et charges optimisées sur Atlas / Galileo / ISS / Starlink, au présent et à une date passée. La charge initiale propre à Galileo est de 1 070 octets de catalogue compressé et 2 427 octets d’orbites compressées, hors moteurs partagés. Tests du transport, du WASM et du chargement 0–100 sur les huit pages locales natif / statique réussis. Aucun déploiement GitHub et aucune validation visuelle automatisée disponible pendant cette session.


## Galileo : satellites retirés du service — 19 octobre 2026

Vérification du catalogue public chargé : 36 entrées, aucune date DECAY_DATE ; GIOVE-A, GIOVE-B et GSAT0104 sont déjà présents avec le code opérationnel actuel « - ». Ils ne sont pas étiquetés comme rentrés dans l’atmosphère. L’ESA confirme le placement des prototypes GIOVE sur orbite cimetière (https://www.esa.int/Applications/Satellite_navigation/Galileo_prototype_GIOVE-A_switched_off_after_16_years_in_orbit). Ajout du filtre Galileo « Hors service (statut actuel) » ; annotation explicite de ce statut dans la liste, distinct de l’état orbital historique. Masquage de « Vue de côté » sur la page Galileo uniquement. Tests de filtrage, recherche et suivi réussis ; aucune publication.


## GPS et vue initiale Atlas — 19 octobre 2026

Ajout de la famille GPS au moteur natif et au WASM, du catalogue NAVSTAR (80 entrées) et du groupe `gps-ops` (32 positions exploitables au contrôle). Page `/gps`, recherche générale, sélecteur alphabétique et catégorie Atlas avec visibilité / couleur indépendantes. Les filtres et fiches reprennent Galileo, y compris le statut hors service distinct d’une rentrée atmosphérique, sa couleur et l’absence de vue de côté. Collecteur GPS et export statique avec charges et archives propres à la collection.

Atlas ouvre désormais une Terre centrée sur 0° / 20°, d’un diamètre apparent proche de 47 % de la hauteur disponible sur écran large, avec adaptation aux écrans étroits. Le chargement des orbites hautes ne change plus ce cadrage ; leur altitude physique est conservée. Le recentrage utilise le même cadrage et les pages GPS / Galileo continuent d’encadrer leurs hautes orbites.

Validation : 24 tests Rust réussis ; ensemble des tests Node de comportement réussi, dont isolation GPS / Galileo / Starlink / ISS, recherche clic / Entrée / Tab, filtres, suivi, pagination et calcul du cadrage aux différentes dimensions. HTTP natif sur les cinq pages : catalogue GPS isolé, union Atlas exacte, continuité trace passée / future et absence de positions inventées pour 2020. Export local reconstruit ; tests HTTP + WASM sur les cinq pages : positions et traces strictement identiques aux données complètes au présent et à une date historique, chargement 0–100 sans recul, transport indépendant du moteur et archives à la demande. Charge initiale GPS compressée : 1 982 octets de catalogue + 3 074 octets d’orbites, hors moteurs communs. Serveur local relancé sur le port 3002. Aucune publication GitHub ; aucun outil de validation visuelle automatisée disponible.


## Onze nouvelles familles et page Débris — 19 octobre 2026

Pages GLONASS, BeiDou, Iridium, Globalstar, Sentinel / Copernicus, COSMO-SkyMed, Pléiades Neo, ICEYE, Meteosat, GOES et OneWeb. Registre partagé, groupes / alias recoupés avec SATCAT, exclusion des fragments / étages des constellations, contrôles et suivi identiques à Galileo, cadrage des orbites géostationnaires et préservation du cadrage Atlas. Débris : catalogue public complet de types DEB / R/B autour de la Terre (42 703 objets, dont les objets rentrés), 12 547 éléments orbitaux publics récupérés ; seuls les éléments adaptés à la date produisent des points. Deux fragments Starlink auparavant rangés parmi les satellites sont maintenant classés comme débris. Les charges utiles retirées du service ne sont pas recodées en fragments.

Le fichier orbital global CSV a répondu HTTP 403 ; aucune nouvelle tentative sur ce fichier restreint. Utilisation des requêtes GP publiques documentées par CelesTrak, dont les fragments et corps de fusée, avec requêtes complémentaires et recoupement du catalogue public SATCAT. Les catégories inconnues ne sont pas présentées comme des débris. Le parseur CSV prend en charge Unicode, guillemets doublés, virgules / retours à la ligne cités et identifiants à six chiffres et plus ; rejet d’un en-tête ou d’une ligne invalide.

Contrôle HTTP natif (quantités à l’instant du contrôle ; les âges des éléments évoluent) :

| Page | Catalogue | Positions exploitables |
|---|---:|---:|
| all | 57036 | 23336 |
| beidou | 64 | 51 |
| cosmo-skymed | 7 | 7 |
| debris | 42703 | 11200 |
| galileo | 36 | 24 |
| globalstar | 93 | 34 |
| glonass | 148 | 24 |
| goes | 19 | 6 |
| gps | 80 | 32 |
| iceye | 80 | 56 |
| iridium | 175 | 79 |
| iss | 1 | 1 |
| meteosat | 14 | 6 |
| oneweb | 656 | 651 |
| pleiades-neo | 2 | 2 |
| sentinel | 13 | 12 |
| starlink | 12945 | 11151 |

Validation native : 29 tests Rust réussis ; tous les tests Node de comportement réussis, dont isolation des seize familles, visibilité / couleur, filtres de type et origine pour les débris, navigation, recherche avec accents et synonymes, suivi et maintien du cadrage Atlas. Les 17 documents locaux répondent HTTP 200 avec cache de document désactivé ; union Atlas exacte et sans doublons, aucune intersection de familles, traces continues au satellite et absence de positions inventées en 2020.

Optimisation : les éléments très anciens ou datés dans le futur d’un objet ne bloquent plus la fenêtre rapide commune. L’export conserve, par satellite et source, les éléments qui peuvent être les plus proches entre son instant de génération (marge d’une minute) et la fin de la journée UTC, en préservant les quasi-égalités à la seconde et la validité SupGP. Tests sur l’ensemble de cette fenêtre : sélection identique à la liste complète. Les changements de date hors fenêtre utilisent les archives existantes à la demande. Les métadonnées et orbites de chaque page restent isolées ; les grosses données de débris ne sont pas demandées par une page ISS ou une autre constellation.

Serveur local relancé sur le port 3002 ; export statique reconstruit pour vérification locale. Aucune publication GitHub. Aucune validation visuelle automatisée disponible pendant cette session.


Export final vérifié : calculs et traces strictement identiques aux données complètes sur les 17 pages (date courante et historique), transport sans blocage du catalogue par le moteur, chargement 0–100 sur les 34 URL natives / statiques. Charges initiales compressées : ISS 997 + 467 octets, Pléiades Neo 528 + 546 octets, OneWeb 6 243 + 36 025 octets, Débris 474 104 + 968 329 octets, Starlink 131 121 + 1 142 530 octets, Atlas 637 091 + 2 182 224 octets (catalogue + orbites, hors moteurs partagés). La charge Starlink reste au niveau de l’optimisation précédente ; les débris sont chargés seulement dans Débris / Atlas. Export local final : 63 167 476 octets.

## 20 octobre 2026 — modèles et navigation scientifique

- Atlas : changement Hubble → IXPE réoriente la vue distante, sans fiche ni suivi implicite ; position différée prise en charge, sélection encore visible préservée.
- Modèles : zoom relatif à la cible, molette et boutons, butée à proximité ; changement de satellite réinitialise la vue inclinée héritée.
- LAGEOS : 426 ouvertures affleurantes, coque opaque occultant les réflecteurs arrière, dessin 2D limité à la face visible ; GLB, dimensions et provenance vérifiés.
- TESS : éphémérides officielles JPL horaires, UTC, interpolation Hermite, trajectoires 2D/3D, aucune extrapolation. Requête locale + adaptation navigateur : une position et 161 points par arc.
- XPoSat : aucune position actuelle acceptée avec le TLE périmé ; consultation historique vérifiée au 9 octobre 2026 à 22:27:47 UTC.
- 36 tests Rust réussis ; tests JS de caméra, zoom, sélection, course entre requêtes, modèles, éphémérides et transport autonome réussis. Export autonome préparé dans un dossier temporaire et testé, sans publication.
- Aperçu LAGEOS vérifié par rendu 2D ; inspection interactive WebGL non effectuée dans cet environnement.

## 20 octobre 2026 — commandes et modèles couleur

- Option indépendante « Afficher le trait vers le sol », activée par défaut ; les positions animées ne réintroduisent pas le trait lorsqu’il est masqué.
- 5 modèles couleur NASA : Hubble, Chandra, Fermi, TESS et ISS B. Conservation vérifiée des maillages compressés, matériaux, images et données binaires ; transformation racine uniquement.
- Chargement explicite, progression bornée 0–100, flou sur le rendu 3D au cadrage courant, attente de la préparation graphique, annulation immédiate et retour au filaire. Cache de la version prête ; erreur et changement de cible tardif testés. Aucun téléchargement détaillé à l’initialisation.
- Atlas : 3 px à grande distance, croissance progressive jusqu’au zoom rapproché. Distance caméra–modèle utilisée en 3D, repère de zoom en 2D ; modèles filaires lointains remplacés par des points, zones de clic conservées. Pages dédiées conservées.
- Thème « Sciences et astronomie » après « Stations spatiales » dans le HTML et dans le générateur.
- Tests JS réussis pour les modèles détaillés, tailles, thèmes, modèles filaires, Tiangong, caméra, suivi, sélection, courses de chargement et clics. Fichiers GLB servis et export autonome construits localement. Pas de publication ; vérification WebGL interactive non réalisée dans cet environnement.

## 20 octobre 2026 — lisibilité des noms et véritables modèles détaillés

- Noms 3D placés autour de l’encombrement projeté du modèle réellement affiché, blanc ou couleur. Prise en compte de l’agrandissement Cesium, du zoom, de la largeur de texte et des limites de l’écran ; fond sombre et absence d’occultation par la géométrie en très gros plan.
- ISS remplacée par NASA IGOAL D : 2 707 621 triangles, 49 matériaux, 220 images embarquées. Hubble remplacé par NASA VTAD : 21 129 triangles et 10 textures. TESS B texturé remplace TESS A sans textures. Données binaires et matériaux originaux conservés, empreintes vérifiées.
- Éclairage PBR par modèle avec environnement KTX2 local et coefficients SH officiels Cesium. Lissage et densité Retina plafonnée à 2× uniquement en mode détaillé.
- Tests réussis : placement des noms (desktop, mobile, limites et très gros plan), intégrité des modèles, commande du panneau détaillé, progression, annulation, cache, caméra inchangée, rendu demandé et résolution restaurée. Réponses HTTP partielles vérifiées pour les modèles lourds. Pas de publication ; contrôle visuel WebGL interactif toujours à effectuer dans le navigateur utilisateur.

## Correction du shader de texture Hubble (20 octobre 2026)

- Défaut reproduit dans les données : un matériau texturé Hubble exigeait `TEXCOORD_0` sur une primitive qui ne le fournissait pas. Inspection du PNG : entièrement transparent. Ajout vérifié de 24 UV constants, sans modifier les positions, indices, matériaux ou images.
- Contrôle de 1 820 références de textures sur les cinq modèles détaillés : UV présents, type VEC2 et nombre de sommets cohérent. Contrôle ajouté à la construction et test de régression dédié.
- Repli ciblé lors d’une erreur GPU d’un modèle détaillé : suppression du modèle fautif, invalidation du cache, arrêt du chargement, restauration du dessin blanc et reprise du rendu. Les erreurs sans rapport ne sont pas masquées. Transitions testées via le véritable contrôleur et le panneau simulé.
- Contrôles de syntaxe, modèles, noms, suivi et cadrage réussis. La compilation WebGL réelle dans Safari reste à vérifier au rechargement dans le navigateur utilisateur.

Mise à jour des commandes : option détaillée entièrement masquée sans modèle disponible (y compris lorsqu’un schéma blanc existe), mise en avant bleue quand disponible, test du panneau réussi. Orbite et liaison au sol pilotées par le même état et la même case « Afficher l’orbite et le trait au sol », cochée par défaut ; la commande planisphère synchronisée conserve l’intitulé « Afficher l’orbite ». Tests de régression des modèles, UV, panneau et sélection réussis.


## Modèles détaillés et actions Atlas — 20 octobre 2026

- Tiangong : modèle importé, attribution CC BY 4.0 vérifiée sur l’API originale. 478 maillages, 22 matériaux et une texture embarquée. Géométrie inspectée hors ligne avec décodage Draco ; pas de validation WebGL dans un navigateur pour ce changement.
- Les tests des matériaux/UV passent pour les six objets détaillés ; le shader Hubble conserve sa correction.
- Chaque catégorie Atlas a une navigation « Voir les détails » et une action « Voir le satellite » (débris : « Voir un objet »). Cible : premier membre en orbite avec position, priorité au statut opérationnel ; activation de la catégorie si nécessaire. Le panneau mobile se ferme. Les cibles des 97 catégories sont calculées en un passage sur le catalogue.
- L’activation du détail, après téléchargement ou depuis le cache, déclenche un cadrage rapproché adapté au rayon du modèle et au format de l’écran. Décocher ou terminer un chargement annulé ne cadre pas la caméra.
- Contrôles ciblés : tests atlas-observation, atlas-categories, atlas-reorientation, detailed-models, detailed-layer, model-uvs, model-zoom, model-labels, auto-follow, tiangong.
- Les modèles scientifiques supplémentaires non autorisés pour redistribution sont documentés dans resources/model-search-2026-10-20.json et ne sont pas annoncés dans le panneau. Aucun déploiement.


## Chronologie et archives de toutes les rubriques — 20 octobre 2026

- Calendrier appliqué à l’équipage ISS/Tiangong, durées de séjour, badges de présence, fiches de mission et statistiques EVA. Cas vérifiés : relèves, vol de retour différent, Starliner retourné sans ses astronautes, Soyuz MS-22/MS-23.
- Un changement de date conserve l’identifiant sélectionné et réactive le cadrage/suivi à sa nouvelle position ; les réponses obsolètes restent rejetées.
- Archives des stations : 9 658 observations quotidiennes ISS depuis novembre 1998 et 1 792 pour Tiangong depuis avril 2021, jusqu’au 19 octobre 2026. Des jours absents et TLE invalides existent ; ils ne sont pas interpolés artificiellement.
- API locale vérifiée pour ISS en 2000/2010/2024/2026, Tiangong en 2021/2024/2026, et Hubble/GPS/LAGEOS/Atlas au 31 décembre 1998. Aucune station affichée avant son lancement.
- Import initial étendu aux 59 628 objets du catalogue ; état exact par année dans data/history/manifest.json. Ne pas annoncer l’import total terminé tant que toutes les années demandées ne sont pas traitées.
- Chaque collecte GP/SupGP réussie est conservée dans history-updates avant remplacement du cache récent ; test de conservation de l’ancien jour et d’ajout d’un nouvel objet. Le serveur et l’export navigateur utilisent les archives communes pour toutes les pages. Un enregistrement historique invalide ne supprime pas les objets valides.
- Tests natifs, navigateur/WASM, calendrier, équipages, EVA, concurrence des dates, import Parquet hors ligne et archivage quotidien. Aucun déploiement.

- Complément TESS : neuf années de vecteurs officiels NASA/JPL Horizons (2018–2026), chargement paresseux de l’année, cache de visite, refus des interpolations à travers les trous. Les collectes régulières conservent désormais leurs vecteurs par année, avec fusion et remplacement des seuls échantillons de même date. Test natif de conservation et tests navigateur d’archives réussis.
- Validation finale du code : 38 tests Rust réussis, plus calendrier, équipages historiques, EVA, suivi 2D/3D, réponses de dates concurrentes et import hors ligne. Contrôle des 98 pages natives à une date passée sans erreur API ; les objets sans observation publique valide restent indisponibles.

- Avec les archives récentes complètes, le test WASM sous 128 Mio a révélé des allocations inutiles de constantes pour des observations hors de validité. Le worker les écarte avant chargement : résultats strictement identiques vérifiés pour chaque minute de la fenêtre et sources GP/SupGP, mémoire historique mesurée à 93,19 Mio pour 24 258 points.

- Import initial terminé : 68 années traitées (1959–2026), 113,624,992 observations quotidiennes, 56,987 objets avec archives sur 59,628 identifiants demandés. Aucune année en échec dans le manifeste. Ces comptes n’impliquent pas une couverture continue de chaque objet : les absences publiques restent explicites. Complément récent : 175 311 observations du 11 au 18 octobre 2026, plus archives des stations et vecteurs TESS.

## Actualités orbitales — 20 octobre 2026

- Bouton commun en haut à droite, dialogue accessible avec défilement indépendant et chargement au clic, cache pendant la visite. Routes relatives compatibles avec l’export GitHub Pages.
- Comparaison persistante des catalogues : nouveaux objets regroupés par lancement, désorbitations documentées et changements de statut explicites. Positions, époques orbitales, disparition temporaire d’un catalogue et ajout de pages/familles restent silencieux. Les 60 événements les plus récents remplacent les anciens.
- Premier démarrage : amorçage par lancements/désorbitations documentés des trente derniers jours ; aucune reconstitution de changements de statut sans ancienne collecte. Pas d’heure inventée pour les dates connues uniquement au jour.
- Tests : 39 tests Rust, test UI `tests/news.cjs` (natif/statique, ouverture/fermeture, cache, dates et texte brut). API locale vérifiée : 60 événements, en-tête et script disponibles. La version testable de cette session écoute sur le port 3003, le processus préexistant sur 3002 ne pouvant pas être arrêté depuis cet environnement. Aucun déploiement.

## Refonte de présentation et audit UX — 20 octobre 2026

- Nouvelle feuille observatory.css : typographies Barlow/Barlow Semi Condensed servies localement, licences OFL jointes ; hiérarchie, espaces, surfaces monochromes, navigation, filtres, caméra, chronologie, fiches, missions et actualités harmonisés. Adaptations ordinateur, mobile et faible hauteur. Les comportements des moteurs et collectes restent inchangés.
- Suppression du paragraphe d’aide Atlas demandé. Ressources versionnées et polices vérifiées par HTTP sur le serveur local 3003.
- Tests existants réussis : actualités, calendrier, actions et catégories Atlas, menu, recherche, navigation, suivi, changements de date, zoom des modèles et progression. Structure CSS contrôlée.
- La tentative de rendu Chromium a échoué sur l’autorisation macOS MachPortRendezvous : aucun résultat de validation visuelle ou tactile réelle n’est revendiqué.
- Rapport heuristique : RAPPORT-UX-ATLAS-2026-10-20.md ; note indicative 14,5/20, moyenne de seize rubriques. Les recommandations de parcours et les évolutions fonctionnelles proposées dans le rapport ne sont pas implémentées ici. Aucun déploiement.

Refonte graphique annulée à la demande de l’utilisateur : suppression de observatory.css, des polices ajoutées et de la légende d’en-tête. Retour au thème précédent ; fonctionnalités conservées. Le paragraphe d’aide retiré séparément reste supprimé. Le rapport UX précédent décrit la refonte désormais abandonnée.

## Commandes repliables sur ordinateur — 20 octobre 2026

- Chronologie repliée par défaut : résumé « Maintenant » ou date locale consultée, bouton de retour au présent accessible en mode historique, calendrier/lecture/vitesse disponibles à l’ouverture. Les éléments restent montés ; aucun état temporel ou réglage n’est réinitialisé par une fermeture. La fermeture du panneau referme aussi le calendrier et restitue le focus.
- « Outils avancés » révèle les couleurs individuelles/par thème, les filtres détaillés et les options d’orbite/modèle. Recherche, choix des pages et objets, listes, sélection des thèmes, vues, recentrage et suivi restent accessibles. Les commandes de modèles conservent leurs conditions de disponibilité.
- Les changements de dimensions réutilisent le calcul existant de la taille de la carte et du globe. Tests desktop-tools, calendrier, date/réponses obsolètes, modèles détaillés, thèmes et suivi réussis ; structure HTML et unicité des identifiants contrôlées.
- Aucun déploiement. Pas de validation visuelle automatisée disponible dans cet environnement.

## Menus desktop regroupés — 20 octobre 2026

- Recherche de pages intégrée au sélecteur : recherche, résultats et choix alphabétique réunis dans un seul menu. Saisie, flèches, Entrée et Échap conservés. Les raccourcis de navigation entre satellites ne capturent plus les flèches utilisées dans le menu ou le panneau.
- Panneau latéral non modal : filtres existants déplacés sans reconstruction, palettes individuelles et groupées synchronisées avec les contrôles originaux, options d’orbite et de modèles regroupées. Fermeture et réouverture conservent les réglages, réinitialisation synchronisée. Les modèles détaillés restent proposés seulement en vue 3D, selon leur disponibilité.
- Présentation limitée aux menus : noir et blanc, séparateurs, boutons rectangulaires, thèmes en accordéons. Aucun retour à la refonte générale abandonnée. Chronologie repliable conservée.
- Tests avec le vrai document HTML et LinkeDOM installé uniquement dans un dossier de test temporaire : recherche/Entrée/Échap, panneau, couleurs individuelles/groupées, reset, restauration des contrôles et contexte 2D. Tests existants de navigation, recherche, modèles et thèmes réussis. Le navigateur graphique reste indisponible pour un rendu visuel automatisé. Aucun déploiement.

## Vue Terre immersive et navigation haute — 20 octobre 2026

- Référence consultée : https://satellitemap.space/vis/constellation/GLONASS. Sur ordinateur, la scène occupe désormais toute la fenêtre : ni colonne latérale ni bandeau inférieur ne réservent d’espace au moteur. Le logo et une barre compacte flottent en haut, navigation regroupée à droite.
- Sélecteur/recherche, objets affichés (ou satellites, ou missions/équipage selon la page), outils et actualités regroupés dans la barre. Le catalogue et les réglages s’ouvrent en panneaux flottants à droite, un seul à la fois ; fermeture et observation d’un objet libèrent la scène.
- Chronologie compacte en bas à droite, caméra/suivi en bas à gauche et attribution conservée. L’ouverture de la chronologie ajuste le dégagement des panneaux sans réduire la scène. Aucun élément de catalogue n’est recréé, états et calculs conservés.
- Tests sur le vrai HTML : navigation déplacée dans l’en-tête, panneau initialement fermé et inaccessible au focus, exclusivité des panneaux, conservation/restitution des contrôles. Test sizeMap : scène à zéro marge basse même avec chronologie dépliée, dégagements mis à jour. Tests suivi, zoom, date, modèles, thèmes et actualités réussis. Pages Atlas, GLONASS, ISS, Starlink, Hubble et Débris vérifiées par HTTP avec leurs ressources versionnées. Aucun contrôle visuel réel du WebGL n’est revendiqué dans cet environnement. Aucun déploiement.

## 2026-10-20 — Navigation haute, actions Atlas et ciel Gaia

- Bandeau noir de 84 px, accès Tous les satellites, débris dans un panneau dédié, ISS, Tiangong, types classés par thème et retour Atlas sur les pages dédiées.
- Points Atlas réduits de 25 %, zones de clic adaptées au zoom élargies de 2 à 4 px ; objets masqués et occultés restent exclus.
- Fiche sélectionnée Atlas : action orbite/trait au sol synchronisée avec les cases existantes ; accès à la page du programme avec identifiant NORAD exact, vue 3D rapprochée et date historique conservée.
- Fond Gaia EDR3 officiel ESA/Gaia/DPAC sous CC BY-SA 3.0 IGO : six JPEG 1024², environ 1 Mo au total, chargement indépendant et cache d’images existant. Conversion galactique → équatoriale, axes de cube Cesium et orientation d’upload testés. Approximation J2000/TEME documentée dans images/sky/README.md. Soleil natif Cesium réactivé selon la date de scène, sans bloom.
- 46 tests JavaScript autonomes existants passent, ainsi que satellite-links.cjs, detail-actions.cjs et sky_projection.py. desktop-panels.cjs vérifie aussi thèmes, liens directs, panneau débris et exclusion mutuelle des panneaux. Les tests d’export statique/WASM et site-loading.cjs demandent un export/serveur de test spécifique et ne sont pas inclus dans cette validation d’interface.
- HTTP local : 31 ressources avec empreintes correctes, six images JPEG disponibles et lien profond ISS répondant 200 sur le port 3003.
- Validation réelle du rendu WebGL non réalisée : Chromium local ne démarre pas dans cet environnement (erreur macOS MachPortRendezvous). Les tests DOM utilisent LinkeDOM, sans dépendance ajoutée au site.

## 2026-10-20 — Correction du ciel et retour à la liste alphabétique

- Atlas : retour au menu alphabétique avec repères et raccourcis clavier ; les autres pages conservent le menu thématique. Tests DOM et navigation alphabétique validés.
- Cause du Soleil absent confirmée dans le code Cesium 1.127 : skyBox=false empêche aussi la création automatique de Sun. Création explicite de Cesium.Sun, réutilisation de l’instance et lueur native ; test du cas sans Soleil préexistant et de la date de scène.
- Panorama précédent retiré. Source officielle NASA Deep Star Maps 2020 céleste HDR 8192 × 4096, celle citée dans les crédits du site de référence. Conversion en six faces 2048² WebP qualité 95, environ 8 Mo au total. Aucun EXR de 124 Mo envoyé au navigateur.
- Rendu Retina activé, densité plafonnée à 2 pour limiter la charge. Source, projection et conditions documentées dans images/sky/README.md.
- Tests sky_projection.py, sky-runtime.cjs, desktop-panels.cjs, collection-menu.cjs, model-zoom.cjs, globe-framing.cjs, iss-idle.cjs, satellite-links.cjs et detail-actions.cjs réussis. Sources et empreintes vérifiées par HTTP sur 3003 ; six WebP disponibles. Limite : rendu WebGL réel non validé dans un navigateur automatisé, toujours indisponible dans l’environnement.

## Navigation Atlas, fond léger et contraste des satellites

- Un seul menu alphabétique « Tous les satellites », blanc et en première position. Le bouton redondant devient « Catégories », immédiatement à sa droite, avec les groupes et réglages de sélection existants. La recherche commune se déplace dans le menu ouvert ; recherche au clavier, navigation et Échap vérifiés dans les deux menus.
- Ciel NASA : six faces 1024², luminosité ×0,60, WebP qualité 80, total 334 072 octets contre environ 8 Mo avant. Les anciennes faces lourdes sont retirées de l’export. Mémoire des textures divisée par quatre.
- Soleil natif : halo/rayons renforcés (glowFactor=2), bloom activé. La direction réelle et les occultations sont conservées.
- Satellites : teinte bleu glacier #afe1f3 par défaut dans Atlas et pour les points des pages dédiées ; sélection blanche, modèles filaires des pages dédiées conservés, débris ambrés. Les couleurs personnalisées et la réinitialisation sont synchronisées.
- Tests menus DOM, sélection et couleurs des rubriques, rayons de clic et couleur par défaut, projection du ciel, création du Soleil, suivi et cadrage réussis. Limite de validation visuelle WebGL inchangée.

## 2026-10-21 — Boussole, sous-menus et commandes locales de suivi

- Rotation libre de la caméra sans contrainte UNIT_Z ; la boussole projette le nord géographique dans le plan de l’écran, indépendamment d’une sélection. Géométrie de projection testée pour plusieurs rotations et cas dégénéré.
- Tous les satellites, catégories, liste de page, outils Atlas et actualités se placent sous leur bouton, sans espace vertical, avec bornage horizontal et hauteur adaptée. Actualités en sous-menu non modal sur ordinateur ; clic extérieur et Échap ferment les panneaux.
- Débris déplacés du bandeau vers le bloc inférieur gauche, au-dessus des commandes de suivi. Le sous-menu garde la vraie sélection, couleur et compteur ; lien « Isoler les débris » vers la page dédiée. Une catégorie Débris donne aussi accès à cette page avec compteur synchronisé.
- Outils avancés retirés des pages dédiées ; leurs filtres restent accessibles dans la liste de la page. Options d’orbite et de modèle haute résolution dans le bloc de suivi. La case modèle reste masquée si aucun modèle source n’est disponible. L’orbite/trait au sol s’affiche dans le bloc pendant le suivi, le contrôle 2D reste accessible.
- Suivre sans sélection choisit le premier objet opérationnel visible, ou un objet disponible à statut inconnu, puis réutilise l’action de sélection et son cadrage. Une sélection historique sans position ne bascule pas vers un autre satellite.
- 50 tests JavaScript autonomes réussis (hors suites nécessitant un export statique ou un serveur dédié) ; nouveaux contrôles pour suivi, compas, sous-menus, filtres et options dans les pages dédiées, synchronisation du compteur et actualités non modales. Validation WebGL visuelle dans un navigateur automatisé toujours indisponible dans cet environnement.

## 2026-10-21 — Retour à la rotation globale et correction du rendu

- Contrainte de rotation UNIT_Z rétablie comme avant. Boussole et vues du satellite visibles seulement pendant son suivi, masquées en vue globale. Sur Atlas, le bouton de suivi et son aide sont également masqués en vue globale.
- Bouton Débris limité à Atlas. Les pages dédiées conservent leur navigation existante vers Atlas, sans ce bouton.
- Le haut des sous-menus est borné par le bas du bandeau complet et non seulement celui du bouton ; la hauteur disponible est recalculée en conséquence. Le panneau de catégories ne passe plus derrière le bandeau.
- Éclairage terrestre stable : suppression de la variation des ombres et de la transition d’éclairage en fonction de la distance caméra, lumière solaire d’intensité constante, suppression de l’atmosphère au sol et du brouillard qui provoquaient le halo. Contraste de la texture adouci. Le jour/nuit dépend toujours de la date consultée.
- Modèles détaillés : ambiance diffuse neutre sans termes directionnels artificiels, reflets atténués, éclairage direct modéré. Résolution et politique Retina d’origine restaurées après désactivation du modèle au lieu de changer le rendu de toute la scène.
- Tests mis à jour pour les états vue globale/suivi, l’absence de Débris hors Atlas, les menus sous un bandeau plus haut, la constance de l’éclairage et la conservation de la résolution. Limite : rendu WebGL visuel non vérifié automatiquement dans l’environnement local.

## 2026-10-21 — Menus des stations et recherche

- En-tête « Fermer le panneau » masqué dans Missions et équipage sur ISS et Tiangong ; fermeture toujours accessible par le bouton du menu, Échap ou clic à l’extérieur.
- Les clics dans une fiche modale ne ferment plus le menu situé derrière. Fermer une fiche d’astronaute conserve le menu et son défilement.
- Recherche : affichage des résultats suivi d’un défilement minimal du menu uniquement ; taille de la zone de résultats bornée à l’espace disponible, champ de saisie conservé à l’écran, aucun défilement supplémentaire si les résultats sont déjà visibles.
- Boussole agrandie de l’échelle 0,72 à 0,88 ; bouton Recentrer décalé pour garder de l’espace.
- station-menu.cjs valide les deux stations, la conservation d’ouverture et de position, le défilement et l’absence de déplacement de la page. dedicated-controls.cjs et desktop-panels.cjs passent également.

### Optional realistic Earth — 21 October 2026
- Added the Terre réaliste switch beneath 3D/planisphere, above position counts. Off by default; hidden in planisphere.
- Three local NASA WebP composites (1,228,182 bytes combined), requested only on activation, reused on later toggles. Geographic UVs derive from the globe normal in Earth-fixed coordinates; sun direction follows Cesium's simulation clock. Clouds are a static MODIS composite, not live weather.
- Dedicated globe material supplies day/night shading and lights without applying globe lighting twice. Cesium atmospheric scattering is enabled only in this mode. Disabling restores imagery, material and atmosphere without changing the camera or satellites. Load and shader failure fall back to the original renderer.
- Passed earth-realistic, follow-controls, iss-idle, globe-framing and desktop-panels tests. Local HTTP /atlas, JS module and all three image assets returned 200 with correct MIME types. Syntax checks passed. WebGL appearance has not been verified in an interactive browser in this environment.

### Realistic Earth blue globe regression
- Root cause confirmed in bundled Cesium 1.127 `Globe` material gating: shader sources containing `normalEC` or `slope` are ignored unless the terrain provider requests vertex normals. The app uses EllipsoidTerrainProvider without those normals, leaving only the blue base color after hiding the map.
- Replaced terrain-normal input with WGS84 surface direction derived from eye-space position, transformed into Earth-fixed coordinates. No terrain download or imagery size increase.
- Regression test now constructs a real bundled Cesium Material and EllipsoidTerrainProvider and checks the actual material eligibility rule, in addition to lazy-loading/restoration tests. Passed.

### Earth controls and overview selection
- Earth style switch shares a common width with the view selector. Removed the persistent NASA/composite text below the switch, retaining loading/error feedback and map credits.
- Restored original atmospheric settings (18 intensity, 7500 m Rayleigh scale height, -0.12 brightness) and removed the illustrative green limb. Kept 4K textures and the ellipsoid-compatible material.
- Atlas overview has a compact Satellites sélectionnés disclosure in the follow controls. Per-family and category/all toggles reuse original visibility controls; top and lower menus remain synchronized. Debris remains separate and off by default. Selector disappears during satellite tracking.
- Passed earth-realistic, overview-selection, desktop-panels, station-menu and follow-controls tests. Interactive WebGL visual verification remains unavailable in this environment.
