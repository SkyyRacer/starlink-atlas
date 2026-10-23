# Satellites manquants et chargement du site publié — 23 octobre 2026

## Diagnostic reproduit

Lecture des données de la publication GitHub Pages `0e7c62dd6cb65a19717d` et exécution de son moteur WASM : **5 Starlink calculables** à l’heure consultée, contre **11 143** avec les données locales. Le catalogue de noms conservait environ 12 945 Starlink, mais les observations orbitales publiées étaient essentiellement des GP du 14–16 octobre et des SupGP du 20 octobre. Les limites de validité sont respectivement 72 h et 24 h ; conserver ces limites évite d’afficher de fausses positions.

L’état public des sources indiquait `keeptrack.configured=false`, alors que cette source était configurée et alimentée en local. La date récente de collecte globale provenait de SatNOGS et ne signifiait pas que les milliers d’orbites Starlink avaient été actualisées.

Avec l’autorisation explicite de l’utilisateur, la clé locale a été enregistrée dans le secret chiffré GitHub Actions `KEEPTRACK_API_KEY`. Elle n’est ni imprimée, ni incorporée au dépôt, aux données exportées ou au navigateur.

## Corrections de chargement

- Le lot orbital de démarrage n’inclut plus les observations qui ne peuvent être valides à aucun instant de sa fenêtre courante. Les archives et les observations historiques complètes restent disponibles séparément.
- Les identifiants orbitaux sans entrée SATCAT restent conservés pour ne pas modifier le compteur des positions indisponibles.
- Le moteur Cesium est préchargé depuis l’en-tête des documents Terre/Lune pour démarrer son téléchargement en parallèle des scripts applicatifs.
- Un contrôle de couverture WASM a été ajouté avant l’envoi du site à GitHub Pages. Une édition qui retrouverait moins de 80 % des Starlink encore signalés en orbite est rejetée ; les objets déjà désorbités et les lancements futurs ne gonflent pas ce seuil. Il s’agit d’un seuil de protection contre une perte massive de source, pas d’une garantie de couverture exhaustive.

## Validation

Sur le lot réellement téléchargé de la publication défectueuse, à date identique :

| Lot | Avant | Après |
| --- | ---: | ---: |
| Observations initiales Atlas | 42 226 | 15 810 |
| Observations initiales Starlink | 22 284 | 6 |

Les positions, identifiants, sources et compteurs calculés sont strictement identiques avant/après cette réduction. Les six observations Starlink restantes ne permettent toujours que cinq positions : **cette optimisation ne remplace pas le rétablissement de la source KeepTrack**.

Sur cette machine, dans le worker exécuté avec le vrai WASM sous Node, l’initialisation Atlas passe d’environ 650 ms à 220 ms sur ce lot. Ce n’est pas une mesure des FPS ni du temps total dans un navigateur accéléré.

L’export de contrôle utilisant les données locales récentes passe la nouvelle protection : **11 143 / 11 154 Starlink encore signalés en orbite** disposent d’une position calculable. Les autres nécessitent des observations publiques adaptées ; aucune position n’a été inventée.
