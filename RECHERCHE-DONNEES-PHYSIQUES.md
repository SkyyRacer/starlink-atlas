# Audit des caractéristiques physiques — 26 octobre 2026

L’audit porte sur les 63 926 identifiants NORAD uniques des catalogues locaux. Il couvre les satellites, stations, corps de fusée, composants séparés et fragments. Le fichier [object-physical-audit.csv](resources/object-physical-audit.csv) contient une ligne par objet, les valeurs effectivement proposées aux fiches et leur provenance par champ. Une cellule vide reste une ligne absente dans l’interface.

| Classe du catalogue | Objets examinés | Au moins une caractéristique physique | Les trois champs disponibles | Au moins une valeur estimée |
|---|---:|---:|---:|---:|
| Satellites / charges utiles | 20 624 | 20 556 | 20 555 | 17 277 |
| Corps de fusée / étages | 6 772 | 6 112 | 6 112 | 1 728 |
| Débris / composants séparés | 35 931 | 3 906 | 3 614 | 2 682 |
| Objets non identifiés | 599 | 0 | 0 | 0 |

Ces nombres décrivent une couverture documentaire, pas des mesures indépendantes de chaque objet. Une grande partie des satellites partage les caractéristiques de sa plateforme ; GCAT précise les estimations avec ses indicateurs, repris par « ≈ ». Les valeurs non marquées comme estimées ne sont pas pour autant des mesures en vol.

## Catalogues et rapprochement

Données de J. McDowell, [GCAT](https://planet4589.org/space/gcat), sous CC BY 4.0 : `satcat.tsv`, mise à jour du 26 octobre 2026 à 00:22:04, et `satcat100k.tsv`, 00:22:11. Les empreintes SHA-256, URL, fichiers et comptes figurent dans [le manifeste](resources/object-physical-facts-manifest.json).

Le rapprochement exige le numéro NORAD et l’identifiant international. Pour les désignations grecques d’avant 1963, il exige NORAD et jour de lancement. Les conflits de classe satellite/étage sont exclus. Les valeurs nulles, négatives ou absentes ne produisent pas une dimension fictive. Les dimensions du module initial de Mir, de l’ISS ou de Tiangong ne sont pas utilisées comme dimensions de la station assemblée.

Des divergences subsistent, notamment les identifiants internationaux de certains Starlink du lancement 2023-046, les attributions d’Iridium 24/46 et des objets récents non identifiés. Ces conflits restent sans ajout automatique. La couverture n’est donc pas présentée comme complète.

## Vérifications auprès des agences

- **H-IIA, NORAD 33500, 2009-002J** : [JAXA, cible CRD2](https://www.ard.jaxa.jp/eng/crd2/project/) identifie explicitement l’étage observé par ADRAS-J et publie environ 11 m de longueur, 4 m de diamètre et 3 tonnes. La fiche utilise la longueur et la masse approximatives JAXA, au lieu des 9,2 m / 4 tonnes du catalogue général. Le diamètre ne remplace pas le champ « envergure ».
- **VESPA, NORAD 39162, 2013-021D** : [étude ESA/ClearSpace, janvier 2020](https://nebula.esa.int/sites/default/files/neb_study/2508/C4000128786ExS.pdf), section 3.1 et figure 5 : partie supérieure, diamètre 2 m, hauteur 1,6 m, masse 112 kg. Le diamètre est la dimension transversale du corps et la hauteur sa longueur axiale. Les valeurs sont celles de l’adaptateur entier dans cette étude, sans les reporter sur d’autres débris. [L’ESA confirme la masse de 112 kg](https://www.esa.int/Space_Safety/ESA_purchases_world-first_debris_removal_mission_from_start-up).
- **Explorer 1** : [NASA](https://science.nasa.gov/mission/explorer-1/about/) : longueur totale 2,05 m et masse 13,90 kg, à distinguer des 8,32 kg d’instruments.
- **Vanguard 1** : [NASA, résumé des lancements historiques](https://ntrs.nasa.gov/api/citations/19800019885/downloads/19800019885.pdf) : sphère de 0,1625 m et masse de 1,47 kg ; le diamètre ne prétend pas décrire l’envergure des antennes.
- **Spoutnik 1, NORAD 2** : [NASA](https://www.nasa.gov/wp-content/uploads/static/history/sputnik.html) : corps de 0,58 m et masse de 83,6 kg. NORAD 1 est le corps de fusée associé.
- **Mir assemblée** : [ESA](https://www.esa.int/About_Us/Corporate_news/Mir_FAQs_-_Facts_and_history) : 33 × 31 × 27,5 m et 130–140 tonnes dans la configuration de référence de 2001, véhicules amarrés compris. La fiche précise cette configuration ; ce n’est pas une reconstitution de la masse à chaque date historique.

## Limites particulières aux débris

[DISCOS, ESA](https://discosweb.esoc.esa.int/) documente les propriétés physiques et utilise des dimensions adaptées à la forme. Il n’a pas été importé intégralement : aucune connexion authentifiée à sa base n’est configurée ici. Son existence ne signifie pas qu’une masse publiée existe pour chaque fragment.

Le [rapport ESA sur l’environnement spatial 2026](https://www.sdo.esoc.esa.int/publications/Space_Environment_Report_I10R0_20260501.pdf) précise que les masses et aires de ses objets reposent sur les valeurs de conception et ne sont pas indiquées pour les débris et objets non identifiés dans ce rapport.

La [publication NASA sur la section radar des débris](https://ntrs.nasa.gov/api/citations/20190033903/downloads/20190033903.pdf) explique que le signal dépend de la forme, du matériau, de l’orientation et de la longueur d’onde. Une même section radar peut correspondre à des objets différents. Par conséquent :

- aucune conversion de RCS en longueur ou masse individuelle ;
- aucune masse du satellite parent attribuée à un fragment ;
- aucune estimation de population statistique présentée comme mesure d’un débris précis ;
- les fragments sans documentation restent sans dimensions ni masse affichées.

## Reproduction

Après actualisation des fichiers GCAT locaux : `python3 scripts/import_object_physical_facts.py --source CHEMIN/satcat.tsv --additional-source CHEMIN/satcat100k.tsv`, puis `node scripts/audit_object_physical_facts.cjs` pour reconstruire le bilan et le CSV.

Cet audit constitue un rapprochement massif de catalogues publics et des vérifications ciblées auprès des agences. Il ne prétend pas avoir parcouru tous les documents d’Internet ni avoir trouvé des caractéristiques qui ne sont pas publiques.


## Extension du recoupement : lanceurs et types de mission

Deux tables supplémentaires ont été analysées intégralement : [GCAT launchlog](https://planet4589.org/space/gcat/tsv/derived/launchlog.tsv), environ 5,3 Mo, et [GCAT psatcat](https://planet4589.org/space/gcat/tsv/cat/psatcat.tsv), environ 5,2 Mo. Leurs dates et empreintes sont dans le manifeste. Le rapprochement couvre les 63 926 identifiants du site, dont les débris.

Le lanceur est renseigné pour **62 866 objets**. Le lien repose sur l’identifiant international de lancement ; avant 1963, un rapprochement par jour n’est accepté que pour un objet déjà recoupé avec GCAT et un lanceur unique ce jour-là. Une fragmentation ne devient pas un nouveau lancement : la fiche du débris donne le lanceur d’origine de son parent. Une station assemblée affiche celui du premier module. Le champ manque encore pour 1 060 objets : il reste absent plutôt que d’attribuer une fusée par ressemblance de nom.

Les catégories individuelles de mission GCAT complètent les catégories de collection : astronomie, sciences de la Terre, biologie, microgravité, étalonnage, télécommunications, navigation, météorologie, reconnaissance, etc. Les lignes absentes et les incertitudes du catalogue ne sont pas transformées en mesures réelles.

Vérifications documentaires supplémentaires :

- **IKAROS** : [fiche japonaise ISAS/JAXA](https://www.isas.jaxa.jp/missions/spacecraft/past/ikaros.html), [fiche anglaise JAXA](https://global.jaxa.jp/projects/sas/ikaros/index.html) et [brochure technique bilingue](https://global.jaxa.jp/activity/pr/brochure/files/sat28.pdf) : corps haut de 0,8 m, voile de 14 × 14 m, diagonale de 20 m, masse au lancement d’environ 310 kg. La hauteur du corps ne prétend pas être le grand côté de la voile. Les publications de recherche citant 307–308 kg décrivent des conventions/configurations différentes : la fiche retient la valeur de référence JAXA, signalée approximative.
- **Tiangong** : [publication gouvernementale chinoise citant le concepteur en chef, juin 2026](https://english.scio.gov.cn/chinavoices/2026-06/24/content_118564178.html) : complexe de référence de 90 tonnes. Ce chiffre ne remplace pas la masse de Tianhe seul et ne reconstitue pas la configuration historique.
- **Programmes historiques** : consultation du [rapport présidentiel NASA de 1958](https://www.nasa.gov/wp-content/uploads/2024/01/presrep1958.pdf) et de [NASA Exploring the Unknown, volume V](https://www.nasa.gov/wp-content/uploads/2023/03/sp-4407-etuv5.pdf). Ils permettent de distinguer la masse des instruments, celle du satellite entier et celle du véhicule de lancement ; leurs valeurs anciennes arrondies ne sont pas fusionnées arbitrairement avec les fiches modernes.

Pour reproduire cet enrichissement, ajouter `--launchlog CHEMIN/launchlog.tsv --payloadsource CHEMIN/psatcat.tsv` à la commande d’import, puis relancer l’audit.

### Données qui restent indisponibles ou contradictoires

Les masses et dimensions de plus de 32 000 fragments ne sont pas établies individuellement dans les sources publiques recoupées. Des objets Analyst n’ont pas d’identité de mission confirmée. Les conflits d’identifiants de certains satellites, les rapports militaires non publics et les archives orbitales absentes ne peuvent pas être résolus en remplaçant les valeurs par celles d’un objet voisin. Une notice technique ou un modèle 3D ne fournit pas non plus une trajectoire historique mesurée. L’archive des équipages expose sa date de couverture et les cumuls partiels. Les sorties EVA ne sont pas ajoutées une seconde fois au temps passé dans l’espace.

Cette recherche couvre des catalogues complets et des documents d’agence en plusieurs langues ; elle ne constitue pas un examen de tous les sites, livres ou rapports publiés dans le monde.
