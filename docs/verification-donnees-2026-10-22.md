# Vérification des données — 22 octobre 2026

Le secours KeepTrack authentifié et SatNOGS sont intégrés à la collecte locale. Aucun envoi du code ni de la clé vers GitHub n'a été effectué.

## Vérification réelle de l'application

- Atlas : 25,043 positions actuelles calculables.
- Starlink : 11,146 positions ; Galileo : 25.
- Débris : 11,457 positions.
- ISS et Tiangong : visibles à la date actuelle ; positions historiques vérifiées en 2020 et 2024. Hubble vérifié en 2000.
- Actualités : 60 entrées conservées. Le fil recharge les données à chaque ouverture et chaque minute lorsqu'il reste ouvert. Les mises à jour d'époques orbitales ne créent pas de notifications.

## Historique et EVA

- 113,624,992 observations historiques restaurées, réparties sur 24,137 jours entre 1959 et 2026.
- 326,493 observations complémentaires archivées après les nouvelles collectes ; les nouveaux éléments orbitaux sont aussi conservés quotidiennement.
- 33,810 archives compressées ont passé la vérification d'intégrité. Six périodes ont aussi été contrôlées pour leur nombre d'enregistrements et leur schéma.
- 58,102 objets couverts ; 1,587 objets demandés ne disposent pas d'archive dans ces fichiers. Il ne s'agit donc pas d'une garantie d'historique complet pour chaque objet.
- 500 EVA chargées, soit la totalité annoncée par la source ; 282 associées à l'ISS et 27 à Tiangong, les autres à d'autres programmes. Équipages : 318 vols associés à l'ISS et 21 à Tiangong. Complétude contrôlée avec les indicateurs de la source.

## Résilience et recoupement

- KeepTrack et SatNOGS : catalogues groupés toutes les deux heures. Les fichiers validés restent disponibles en cas d'échec.
- Les interruptions de connexion sont réessayées au prochain cycle, sans requête avant deux heures. Les HTTP en erreur de CelesTrak restent suspendus conformément à ses règles ; les sources de secours poursuivent leur cycle. Les instructions Retry-After plus longues sont respectées.
- Comparaison des modèles à la même date, avec vérification des identifiants et des éléments orbitaux. 162 objets comparés et 0 écarts dépassant le seuil indicatif de 100 km au dernier contrôle.
- Un accord entre sites partageant les mêmes observations amont ne constitue pas une vérification indépendante. Les fiches indiquent les sources et l'écart mesuré, sans prétendre fournir une mesure de vérité.
- Une détection sans date de lancement confirmée reste une entrée au catalogue. Aucun déploiement, nombre de satellites ou horaire n'est déduit d'un simple téléchargement de positions.

## Clé et publication

La clé est conservée dans un fichier local ignoré par Git, limité au propriétaire. Elle n'apparaît ni dans les scripts, ni dans les ressources du navigateur, ni dans les URL enregistrées. Le workflow est préparé à utiliser un secret GitHub nommé KEEPTRACK_API_KEY ; ce secret n'a pas été créé à distance.

## Sources

- [CelesTrak](https://celestrak.org/) : éléments et catalogue d'origine ; connexion indisponible pendant les essais.
- [KeepTrack](https://keeptrack.space/api) : secours orbital groupé et métadonnées ; API authentifiée, données CC BY-NC 4.0.
- [SatNOGS](https://docs.satnogs.org/projects/satnogs-db/en/latest/api.html) : autre canal orbital ; couverture partielle, données CC BY-SA.
- [GCAT](https://planet4589.org/space/gcat/) : rapprochement des identités et dates de lancement, CC BY.
- [The Space Devs](https://thespacedevs.com/llapi) : équipages, missions et EVA.
- [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) : trajectoires scientifiques prises en charge.


## Cycle permanent

Les collectes orbitales et le catalogue KeepTrack sont réglés sur 7 200 secondes. Le serveur local doit rester en cours d'exécution. Les fiches et les actualités se mettent à jour lorsque les données de statut, de lancement ou de désorbitation changent ; le silence ou la disparition d'un objet ne constitue jamais une preuve de désorbitation.

Le workflow GitHub est préparé pour une exécution toutes les deux heures. Il reste à publier les sources et à enregistrer la clé dans le secret du dépôt pour activer KeepTrack à distance. Les métadonnées SATCAT et GCAT, les missions et EVA conservent leurs cycles adaptés aux publications et quotas des fournisseurs. La fréquence de collecte ne garantit pas que les fournisseurs connaissent ou publient immédiatement une fin de mission.
