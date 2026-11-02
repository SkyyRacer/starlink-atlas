# Atlas sur Oracle Always Free

État : préparation locale. Aucun compte Oracle ni serveur n’a été créé par ces fichiers. Le workflow GitHub Pages reste désactivé ; ce déploiement ne l’utilise pas.

## 1. Créer le compte

Ouvrir https://www.oracle.com/cloud/free/ dans son navigateur. Renseigner soi-même identité, téléphone et vérification bancaire. Ne pas envoyer les identifiants, codes de validation ou numéros de carte dans le chat.

Choisir une région principale proche des utilisateurs. Les ressources Always Free doivent être dans cette région ; une capacité A1 libre n’est pas garantie. L’offre vérifiée le 1 novembre 2026 annonce un total de **2 OCPU ARM et 12 Go de mémoire**, et **200 Go de volumes**. Ne pas reprendre les anciens tutoriels annonçant 4 OCPU / 24 Go.

Source : https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

## 2. Créer la machine

- Image Ubuntu 24.04 LTS ARM64.
- Forme VM.Standard.A1.Flex : 2 OCPU, 12 Go de mémoire, dans le quota Always Free du compte.
- Volume de démarrage de 100 Go au maximum pour cette première machine, dans les 200 Go gratuits cumulés du compte.
- Vérifier les mentions d’éligibilité gratuite et l’estimation avant de créer. Ne pas choisir une forme payante pour contourner une absence de capacité.
- Conserver la clé SSH privée sur son ordinateur. Seuls l’adresse IP du serveur et le nom du fichier de clé seront nécessaires pour préparer la connexion.
- Autoriser SSH (22) depuis son adresse IP ; autoriser HTTP/HTTPS (80/443) pour le site. Ne pas exposer le port interne 3000.

Oracle peut récupérer les machines jugées inactives. Une copie des données hors de cette machine reste nécessaire.

## 3. Installer et transférer

Installer Docker Engine et le module Compose d’après https://docs.docker.com/engine/install/ubuntu/ (Ubuntu 24.04 et ARM64 sont pris en charge).

Transférer le projet préparé vers `~/atlas` sur le serveur. Un simple clone du dépôt distant ne suffit pas tant que ces fichiers locaux n’y ont pas été enregistrés. Inclure `static/`, `scripts/`, les JSON de `resources/`, `data-seed/` et `deploy/`, avec le code Rust et ses fichiers Cargo. Exclure `.git`, `target`, les caches générés et tous les secrets. L’image utilise les originaux locaux, pas l’export compressé GitHub Pages.

Depuis le dossier du projet sur le serveur :

```sh
cp deploy/oracle/.env.example deploy/oracle/.env
chmod 600 deploy/oracle/.env
sudo docker compose --env-file deploy/oracle/.env -f deploy/oracle/compose.yml build app
sudo docker compose --env-file deploy/oracle/.env -f deploy/oracle/compose.yml up -d app maintenance
```

Si disponible, ajouter la clé du fournisseur KeepTrack dans `.env` avant le démarrage. Ne pas l’intégrer dans l’image ou dans Git. Un changement de serveur ne garantit pas le déblocage de CelesTrak ou l’existence de nouvelles observations.

Les volumes Docker conservent les observations, les archives, les données des équipages, les éphémérides collectées et les certificats. L’initialisation n’écrase jamais une observation déjà présente. Les dates des données de départ ne sont pas rendues artificiellement récentes : le contrôle suivant peut donc échouer tant qu’une collecte valide n’a pas abouti.

## 4. Vérifier avant l’ouverture publique

```sh
sudo docker compose --env-file deploy/oracle/.env -f deploy/oracle/compose.yml ps
sudo docker compose --env-file deploy/oracle/.env -f deploy/oracle/compose.yml logs --tail=100 app maintenance
python3 deploy/oracle/check.py http://127.0.0.1:3000
```

Le contrôle refuse un catalogue sans positions, une perte importante des constellations ou l’absence d’une station actuelle attendue. Les couvertures partielles restent signalées. Le contrôle de santé Docker vérifie seulement que le serveur répond ; il ne remplace pas ce contrôle des données.

Vérifier ensuite Atlas, le retour à la dernière observation de Mir et Saliout, les pages planétaires et les missions lointaines. Ne pas annoncer la migration comme terminée avant ces vérifications sur la machine.

Pour le premier essai par adresse IP, conserver `ATLAS_ADDRESS=:80`, puis :

```sh
sudo docker compose --env-file deploy/oracle/.env -f deploy/oracle/compose.yml up -d web
```

Pour la version publique HTTPS, utiliser un domaine pointant vers l’IP de cette machine et remplacer `:80` par ce domaine dans `.env`. Caddy gère alors le certificat. Un domaine personnel peut être payant ; aucun achat de domaine n’est requis pour le premier test par IP. La création et les essais du certificat restent à vérifier sur le serveur.

## 5. Sauvegarder et restaurer

Depuis le dossier du projet sur le serveur :

```sh
sudo sh deploy/oracle/backup.sh
```

Les deux services qui écrivent les données s’arrêtent pendant la sauvegarde puis redémarrent. Le site peut être temporairement indisponible. L’archive contient les données et les éphémérides persistantes ; son nom est affiché à la fin. Elle est privée et peut contenir des identifiants de fournisseurs présents dans les données.

Copier cette archive hors de la machine, par exemple sur son Mac : une seconde copie dans un volume du même serveur ne protège pas d’une perte du serveur. Pour exporter une archive précise vers un fichier local, remplacer `IP` et `NOM_ARCHIVE` :

```sh
ssh ubuntu@IP 'cd ~/atlas && sudo docker compose --env-file deploy/oracle/.env -f deploy/oracle/compose.yml run --rm --no-deps --entrypoint cat backup /app/backups/NOM_ARCHIVE' > atlas-sauvegarde.tar.gz
```

Pour restaurer : arrêter `app` et `maintenance`, vérifier le contenu de l’archive de confiance, extraire `data/` dans le volume des observations et `ephemerides/` dans celui des éphémérides en conservant UID 10001, puis redémarrer et relancer le contrôle des données. Tester cette restauration avant de supprimer une ancienne machine. Garder `.env` et les accès SSH séparément dans un emplacement privé.

Ne jamais utiliser `docker compose down -v` pour une mise à jour : cette option supprime les volumes de données.

## Validation disponible

Les tests locaux vérifient l’initialisation sans écrasement, la décompression des observations solaires, la conservation des dates, le contenu des sauvegardes et le refus d’une couverture insuffisante. La construction de l’image Docker, le HTTPS et les essais sur Oracle doivent encore être exécutés sur une machine équipée de Docker.
