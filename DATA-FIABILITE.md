# Contrôle et récupération des données

Le contrôle principal est `scripts/ensure_data.py`. Depuis la racine du projet :

```sh
python3 scripts/ensure_data.py
```

Il détecte le dossier de données local habituel. Les chemins peuvent être précisés :

```sh
python3 scripts/ensure_data.py --data-dir /chemin/des/donnees --history-dir /chemin/des/archives --fallback-root /chemin/dune/copie/du/projet
```

Le contrôle est intégré au redémarrage local et au workflow de publication.
Il s'exécute avant le démarrage du serveur pour que son catalogue en mémoire
utilise les données réparées, sans lancer deux collecteurs simultanés.

1. Vérifier les JSON, archives compressées de collecte, vecteurs, identités de mission,
   modèles GLB, images et moteur WASM. Les modèles et fiches dont le manifeste
   fournit une empreinte doivent correspondre à cette empreinte.
2. Conserver les fichiers validés dans `DATA_DIR/last-good`. Un fichier vide ou
   corrompu ne peut pas remplacer cette sauvegarde. Les dates et époques originales
   sont conservées lors d'une restauration.
3. Restaurer les données manquantes ou endommagées depuis la dernière copie valide,
   les données de démarrage du dépôt ou une copie du projet indiquée par
   `--fallback-root`. Les anciens téléchargements bruts volontairement compactés
   ne sont pas réintroduits systématiquement ; leurs observations quotidiennes restent archivées.
4. Exécuter le collecteur natif existant : CelesTrak, sources secondaires déjà configurées
   KeepTrack/SatNOGS, catalogues spécialisés, stations, missions/équipages/EVA,
   actualités et TESS. Les intervalles, limites et suspensions de chaque fournisseur
   continuent de s'appliquer. Les clés existantes restent dans l'environnement.
5. Actualiser les missions lointaines NASA/JPL si leur couverture devient insuffisante.
   Une marge de quatorze jours est demandée dans les trajectoires calculées officielles,
   réduite à la borne publiée lorsque le fournisseur ne va pas aussi loin. Aucun vecteur
   n'est extrapolé hors de la réponse. Cassini conserve ses dates historiques.
6. Vérifier la présence des journées déclarées dans l'index historique et restaurer
   les journées manquantes lorsqu'une copie existe. Chaque journée est analysée lors
   de sa lecture. Cela ne prétend pas vérifier à chaque démarrage les 123 millions
   d'observations du dossier complet ni créer une couverture absente des sources.

Le résultat est écrit dans `DATA_DIR/data-health.json` : fichiers validés, restaurés,
indisponibles, collecteurs et bornes des missions. `--check-only` effectue les contrôles
et réparations locales sans lancer de téléchargement.

La publication conserve également son import quotidien des archives récentes et
ses contrôles de couverture des constellations/stations. Une perte importante empêche
le remplacement de l'édition publique précédente.

Les fichiers de données embarqués permettent de fonctionner pendant une panne de
source. Ils ne deviennent pas des données fraîches par leur restauration : les limites
orbitales restent appliquées et les dates réellement disponibles sont proposées par
la chronologie. Spektr-RG et IKAROS restent signalés sans source de trajectoire vérifiée.
Un script ne peut pas créer des mesures lorsque toutes les sources et leurs archives
en sont dépourvues. Les tuiles cartographiques externes restent soumises au fournisseur
configuré et à son cache navigateur ; ce script n'effectue aucun téléchargement
massif de cartes ni contournement d'un fournisseur bloqué.
