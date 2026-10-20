# Atlas — Rapport d’expérience utilisateur

**20 octobre 2026 · version locale après refonte graphique**

**Note globale indicative : 14,5 / 20.**

Atlas possède une vraie valeur : observer de nombreux objets, comprendre leurs orbites, explorer leur histoire et consulter des informations détaillées dans une même interface. Sa principale difficulté est désormais la densité de ses commandes. Le prochain gain d’expérience viendra surtout d’une meilleure prise en main et d’une simplification des parcours, davantage que de l’ajout de nouvelles fonctionnalités.

## Portée de cette évaluation

Ce rapport est un audit heuristique : examen de l’interface et de ses comportements dans le code, contrôles des ressources sur plusieurs pages et tests existants de navigation, recherche, filtres, chronologie, suivi, chargement et actualités. Les notes sont un jugement de conception, pas des résultats mesurés auprès d’utilisateurs.

La nouvelle présentation a été préparée pour ordinateur, mobile et écrans courts. **Le navigateur automatisé est bloqué par les permissions système : aucun contrôle visuel complet du rendu ni essai tactile réel n’a pu être réalisé.** Les appréciations de la présentation et du mobile restent donc provisoires. Il n’y a pas eu de mesure de taux de réussite, de temps de tâche ou de satisfaction.

La direction artistique prend [SpaceX](https://www.spacex.com/) comme référence, tout en gardant l’identité Atlas et les contraintes d’un outil d’observation. Il s’agit d’une inspiration, sans reprise du logo ou des éléments graphiques SpaceX.

## Notes par partie

Chaque partie a le même poids dans la note globale : moyenne des seize notes ci-dessous. Cette convention est explicite ; elle ne remplace pas une pondération fondée sur les usages réels.

| Partie | Note / 20 | Ce qui fonctionne bien | Ce qui fonctionne moins bien |
| --- | ---: | --- | --- |
| Identité et cohérence visuelles | **16** | Typographie dédiée, hiérarchie plus affirmée, surfaces monochromes, commandes cohérentes entre les pages. | Une interface très sombre et technique peut sembler austère. Le rendu réel de la refonte reste à valider. |
| Première visite et compréhension | **13** | La Terre et les objets donnent immédiatement le sujet de l’application. | Un nouveau visiteur doit comprendre seul la différence entre vue globale, page dédiée, sélection et suivi. Trop d’actions arrivent simultanément. |
| Navigation entre les pages | **15** | Accueil via le logo, sélection par nom, repères alphabétiques, accès aux pages depuis Atlas. | Une liste de près de cent pages devient longue. La navigation alphabétique aide à retrouver un nom connu, moins à découvrir ce qui existe. |
| Recherche | **16** | Recherche directe, résultats cliquables et navigation au clavier. Les missions et astronautes sont aussi recherchables. | La recherche des pages et celle des objets ou personnes ont des périmètres différents. Entrée et surtout Tab peuvent provoquer une navigation inattendue. |
| Thèmes et filtres Atlas | **14** | Catégories repliables, sélection groupée, couleurs par thème, réinitialisation accessible et débris séparés. | Beaucoup de petites commandes par objet. « Voir les détails » et « Voir le satellite » demandent un apprentissage. Les réglages de couleur dépendent du sélecteur du système. |
| Observation 3D | **17** | C’est le cœur distinctif du produit : contexte terrestre, orbites, stations et modèles détaillés. | En vue globale, les points peuvent être très denses. La taille et l’orientation des modèles sont illustratives ; un novice peut les prendre pour des représentations à l’échelle. |
| Planisphère | **15** | Complément utile à la 3D pour situer un objet et lire sa trajectoire. | La coupure au bord du monde et la projection demandent une explication. La présence d’une altitude peut laisser croire que la hauteur est représentée proportionnellement sur la carte. |
| Sélection, caméra et suivi | **15** | Suivi direct d’un objet, recentrage, zoom adapté aux objets lointains et commande de retour à une vue globale. | Plusieurs mécanismes peuvent déplacer la caméra : sélection, changement de groupe et suivi automatique de l’ISS après inactivité. Le mouvement peut surprendre. |
| Chronologie et consultation du passé | **12** | Exploration historique très riche, choix de date partagé, équipages et caméra actualisés avec la date. | Date, lecture, vitesse, heure locale, données historiques et disponibilité des observations sont beaucoup à comprendre ensemble. L’absence de position peut encore être interprétée comme un bug. |
| Fiches des satellites | **15** | Descriptions, type d’orbite, altitude, identifiant, dates et informations de source donnent du contexte. | Les termes NORAD, SupGP, époque orbitale ou état opérationnel inconnu restent techniques. La fiche peut demander beaucoup de lecture avant de répondre à une question simple. |
| Stations, missions et astronautes | **16** | Informations humaines, équipages cliquables, missions, durées de séjour et EVA enrichissent fortement l’observation. | Mélange de données présentes, historiques et parfois incomplètes. Les retours dans un autre véhicule et les durées inconnues ne sont pas intuitifs pour tous. |
| Actualités orbitales | **15** | Seulement les changements significatifs, regroupement par lancement, liste bornée et aucune annonce des simples positions ou ajouts de pages. | Il faut ouvrir le bouton pour découvrir les événements. Le nombre annoncé correspond aux objets identifiés dans les données collectées, pas forcément au manifeste complet d’un lancement. |
| Petits écrans et tactile | **12** | Panneau de filtres séparé, fiches repliables et adaptations selon la hauteur disponible. | Carte, fiche, caméra et chronologie se partagent peu de place. La densité reste le principal risque. Le tactile et les éventuels chevauchements doivent être vérifiés sur de vrais téléphones. |
| Accessibilité | **12** | Contrastes marqués, noms de boutons, recherche et menu utilisables au clavier, dialogues, focus visible et réduction des animations prévue. | Une scène 3D demeure difficilement exploitable sans vision. Il manque un parcours équivalent entièrement textuel à vérifier. Quelques indications sont petites et plusieurs états reposent beaucoup sur la couleur. |
| Chargement et réactivité perçue | **15** | Ressources partagées, chargements à la demande et progression visible. Les polices du nouveau thème sont servies localement. | Le premier chargement 3D, les archives et les modèles détaillés restent sensibles à la connexion et à l’appareil. Aucun temps de chargement universel ne peut être promis. |
| Confiance et compréhension des données | **14** | Les sources et limites existent ; les observations absentes ne sont pas inventées. | « À jour » peut être confondu avec une mesure instantanée. Il faut mieux distinguer moment de collecte, date des éléments et date de simulation. Une grande couverture globale ne garantit pas chaque objet à chaque date. |

## Les points les plus réussis

**Une réelle complémentarité entre vue globale et exploration détaillée.** Atlas permet de découvrir les objets puis d’approfondir une constellation, une station ou une mission scientifique. Ce lien est plus intéressant qu’une simple carte remplie de points.

**Une chronologie qui dépasse le simple déplacement des satellites.** Faire évoluer aussi les équipages et les informations de présence donne du sens à la consultation du passé.

**Des commandes qui répondent à de vrais usages.** Cacher un thème, distinguer les familles par couleur, retrouver un objet, suivre sa trajectoire et revenir à une vue globale sont des actions utiles. Le défi consiste à les présenter progressivement.

**Des actualités sans bruit.** Exclure les mises à jour de position et les modifications du logiciel protège l’utilité du fil.

## Les principales faiblesses

**La prise en main suppose déjà une certaine curiosité technique.** Un habitué peut apprécier la richesse ; un nouveau visiteur peut hésiter sur la première action à effectuer.

**Les commandes sont parfois aussi présentes que ce qu’elles pilotent.** Sur mobile, une série de boutons, une fiche et la chronologie peuvent occuper une grande partie du champ d’observation. Un style plus élégant améliore la lecture, mais ne supprime pas cette concurrence.

**Le comportement de la caméra peut manquer de prévisibilité.** Un centrage automatique utile lors d’une sélection peut devenir déroutant lorsqu’il suit une période d’inactivité. Il faut que l’utilisateur sache toujours pourquoi la vue bouge et comment reprendre la main.

**Les données absentes ou anciennes demandent encore trop d’interprétation.** Un satellite invisible ne signifie pas nécessairement qu’il a disparu ou qu’il est désorbité. Cette différence est essentielle à la confiance.

## Priorités recommandées — non implémentées dans cette refonte

| Priorité | Proposition | Bénéfice attendu |
| --- | --- | --- |
| **1** | Tester sur téléphone les parcours « chercher l’ISS », « suivre un objet », « changer de date » et « fermer une fiche ». | Identifier les vrais chevauchements et gestes difficiles avant de modifier davantage l’interface. |
| **2** | Prévoir une première visite très courte, facultative, avec une action claire : chercher un objet ou choisir une catégorie. | Réduire l’hésitation initiale sans créer de tutoriel long. |
| **3** | Rendre le mode temporel explicite : maintenant, date passée, lecture en cours ; placer la qualité/disponibilité des données près de l’objet concerné. | Éviter la confusion entre simulation, collecte et événement réel. |
| **4** | Regrouper les commandes secondaires dans un niveau « options » et clarifier les libellés des actions de navigation et de cadrage. | Redonner de la place à l’observation, surtout sur mobile. |
| **5** | Faire auditer un parcours clavier complet et un parcours lecteur d’écran ; proposer une alternative textuelle à l’observation visuelle. | Améliorer l’accès au produit au-delà des seuls contrastes et boutons. |

## Vérifications à réaliser avec des utilisateurs

Cinq à huit personnes, dont des novices, suffiraient pour un premier cycle qualitatif. Leur demander de trouver l’ISS, distinguer GPS de Galileo, afficher uniquement une famille, consulter un satellite à une ancienne date et reconnaître pourquoi un objet n’a pas de position.

Relever les hésitations, les erreurs de navigation, les pertes de contexte et les actions qui nécessitent une explication. Mesurer ensuite les temps de tâche et les réussites sur un second cycle pour décider si les évolutions améliorent réellement l’expérience. Ne pas utiliser la note de cet audit comme substitut à ces observations.

## Modifications réalisées pour cette livraison

La refonte porte sur la présentation : polices locales, hiérarchie typographique, espacement, navigation, boutons, listes, panneaux, chronologie, fiches, dialogues et adaptations aux tailles d’écran. Le texte d’aide demandé dans Atlas a été retiré.

Les calculs, sources, collectes, filtres, recherches, suivi, chronologie et données ne sont pas modifiés. Aucun déploiement en ligne n’a été effectué.
