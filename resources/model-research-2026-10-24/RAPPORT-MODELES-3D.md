# Recherche de modèles 3D détaillés pour ATLAS

Recherche du **24 octobre 2026**. Périmètre : **24 types de véhicules, 27 identifiants NORAD distincts** possédant aujourd’hui un modèle blanc dans Atlas. Il comprend les 22 modèles scientifiques actifs, l’ISS et Tiangong actuelle. Les anciennes silhouettes retirées de Saliout et Tiangong-1/2 sont examinées en complément, sans gonfler ce total.

## Résultat utilisable

- **10 types disposent déjà d’une option détaillée** dans Atlas. Cela décrit la disponibilité, pas une certification uniforme de leur qualité.
- **9 types supplémentaires ont une piste concrète** : Mir avec source et licences vérifiées ; CHEOPS et XMM-Newton avec sources officielles et droits de redistribution à clarifier ; six modèles payants détaillés.
- **5 types n’ont pas de meilleur modèle texturé téléchargeable vérifié** dans cette recherche : AstroSat, XPoSat, LAGEOS, Suzaku et FUSE.
- Il ne faut donc pas annoncer 19 nouveaux modèles prêts : neuf sont des candidats, dont plusieurs nécessitent un achat ou une clarification de licence. Aucun nouveau modèle n’a été activé sur le site pendant cette recherche.

## Meilleures nouvelles pistes

| Véhicule | Source et auteur | Détails établis | Situation et travail restant |
|---|---|---|---|
| Mir | [DaveBowman2001](https://github.com/CelestiaProject/CelestiaContent/tree/e6d05411f1ab8aecbd8d72173711ae37f228deaf/extras-standard/mir) | Source CMOD de 19,24 Mo et neuf textures PNG ; fichiers et licences réellement contrôlés | Gratuit, CC BY 4.0. Conversion CMOD → GLB et contrôle visuel nécessaires. |
| CHEOPS | [ESA / ESAC SciFleet](https://scifleet.esa.int/#/model-downloads) | OBJ contrôlé : 3 329 sommets, 2 547 faces ; guide officiel décrivant les textures 4K | Téléchargement officiel, redistribution du modèle à clarifier. |
| XMM-Newton | [ESA / ESAC SciFleet](https://scifleet.esa.int/#/model-downloads) | OBJ contrôlé : 10 050 sommets, 17 178 faces ; sources FBX et textures officielles | Téléchargement officiel, redistribution du modèle à clarifier. |
| NuSTAR | [GR33D / TurboDDD (marketplace listings)](https://www.cgtrader.com/3d-models/space/spaceship/nustar-satellite) | 46,736 polygones annoncés ; 4K | Payant. Archive non achetée ni testée ; usage web du fichier à confirmer. |
| IXPE | [vakir](https://www.turbosquid.com/FullPreview/2262337) | 21,190 polygones annoncés ; 4K PBR | Payant. Archive non achetée ni testée ; usage web du fichier à confirmer. |
| XRISM | [See marketplace creator listing](https://www.turbosquid.com/3d-models/xrism-jaxa-x-ray-space-telescope-2516416) | 54,245 polygones annoncés ; PBR; exact texture image size not independently checked | Payant. Archive non achetée ni testée ; usage web du fichier à confirmer. |
| Swift / Neil Gehrels | [john-macneill](https://www.cgtrader.com/3d-models/space/spaceship/swift-satellite) | 36,814 polygones annoncés ; Textures declared; resolution not verified | Payant. Archive non achetée ni testée ; usage web du fichier à confirmer. |
| Skylab | [muklis-sadewo88](https://www.cgtrader.com/3d-models/space/spaceship/skylab) | 117,964 polygones annoncés ; Mixed procedural/tileable; not a ready uniform PBR set | Payant. Le rendu complet dépend de Blender ; textures à cuire avant export. |
| Compton GRO | [BaronDaler](https://www.turbosquid.com/3d-models/3d-cgro-compton-gamma-observatory-model-1477627) | 8,237 polygones annoncés ; 2K PBR | Payant. Archive non achetée ni testée ; usage web du fichier à confirmer. |

### Mir : la meilleure piste gratuite nouvelle

Le dépôt principal Celestia contient un modèle signé DaveBowman2001. J’ai récupéré le fichier CMOD binaire de **19 238 836 octets**, ses **neuf textures** et leurs notices individuelles. Chacune des notices vérifiées indique **CC BY 4.0**. Les empreintes SHA-256 sont consignées dans `mir-source-audit.json`, à la révision épinglée `e6d05411f1ab8aecbd8d72173711ae37f228deaf`.

La plus grande texture mesure **1 024 × 512 pixels** ; ce n’est donc pas un ensemble moderne de textures 4K. Le candidat reste bien plus prometteur que le petit modèle NASA gris actuellement écarté. La conversion vers GLB devra conserver normales, UV, matériaux et toutes les textures. Aucune qualité de rendu finale dans Atlas n’est affirmée avant cette conversion.

Le modèle représente la station complète après l’arrivée de Priroda en avril 1996. Il ne représente pas automatiquement chaque étape antérieure de l’assemblage. Source : [répertoire Mir de Celestia](https://github.com/CelestiaProject/CelestiaContent/tree/e6d05411f1ab8aecbd8d72173711ae37f228deaf/extras-standard/mir).

### CHEOPS et XMM-Newton : privilégier les sources ESA

[SciFleet ESA](https://scifleet.esa.int/#/model-downloads) fournit les modèles et plusieurs formats. Son guide explique que le FBX inclut les textures et que l’OBJ nécessite le jeu de textures séparé. Le guide décrit des cartes couleur, métal et normales en 4K. Les OBJ déjà récupérés ont été inspectés : géométrie et coordonnées UV sont bien présentes.

Le guide renvoie aux [conditions générales ESA](https://www.esa.int/Services/Terms_and_conditions), sans qu’une licence explicite de redistribution de ces modèles ait été établie ici. Le fichier `LICENSE.txt` annoncé dans l’application n’a pas été trouvé à la racine publique (404). Il reste donc une question précise à résoudre sur les droits du modèle ; la possibilité de télécharger ne suffit pas à conclure. Aucune demande n’a été envoyée à l’ESA.

Un réimport XMM-Newton sur Sketchfab a été contrôlé via l’API publique : téléchargement désactivé et aucune licence indiquée. Ce réimport n’améliore pas la situation.

### Modèles payants : les meilleurs choix techniques, à tester

**NuSTAR** est une piste sérieuse : le créateur annonce un maillage de 46 736 polygones, des pièces dépliées séparément et des textures 4K. FBX et OBJ sont proposés. Les fiches CGTrader et TurboSquid semblent correspondre au même actif ; elles ne comptent pas comme deux découvertes indépendantes. Les matériaux V-Ray devront être adaptés au rendu du navigateur.

**IXPE** dispose d’une fiche vakir annonçant 21 190 polygones et des textures PBR 4K. La liste de formats contient glTF, mais le contenu exact de l’archive n’a pas été inspecté. Il faudra vérifier le mât déployé et la transparence des protections. Les kits papier et impressions 3D trouvés ailleurs ne sont pas des substituts à un modèle texturé.

**XRISM** est présenté comme un modèle texturé PBR de 54 245 polygones, avec glTF, FBX et Blender. Les mentions de certification sont celles de la plateforme, pas un test réalisé dans Atlas. Le véhicule doit rester distinct de Suzaku et Hitomi.

**Swift** possède une version john-macneill de 36 814 polygones, avec textures, UV et FBX/OBJ. La résolution des images n’a pas été vérifiée. Les animations NASA trouvées montrent un beau rendu mais ne donnent pas, à elles seules, accès au maillage utilisé.

**Skylab** demande plus de travail qu’une conversion directe : le créateur précise que le rendu complet dépend des matériaux Cycles dans Blender. Seuls le drapeau et le marquage USA sont explicitement dépliés ; les autres formats sont décrits comme livrés avec des matériaux basiques. Il faudra cuire les matériaux procéduraux en textures. Le modèle annoncé compte 117 964 polygones.

**Compton GRO**, par BaronDaler, est annoncé avec 8 237 polygones et trois ensembles PBR 2K : corps, détails et instruments. Le gain potentiel porte sur les surfaces et les textures, pas uniquement sur le nombre de polygones. La fiche décrit les cartes couleur, métal, rugosité, normales et occlusion.

Les prix varient selon les promotions et les licences : aucun achat n’est nécessaire pour consulter ce rapport et aucun n’a été effectué. Les étiquettes « royalty free » ou « editorial » ne sont pas assimilées à une autorisation de placer un GLB récupérable dans un dépôt public. Il faut confirmer ce mode de distribution précis auprès du vendeur avant une éventuelle intégration ; voir les [conditions CGTrader, section licences](https://www.cgtrader.com/pages/terms-and-conditions).

## Modèles déjà présents : conserver ou améliorer

| Modèle | Triangles dans le fichier actuel | Images intégrées | Source actuelle |
|---|---:|---:|---|
| hubble | 21,129 | 10 | [Source](https://science.nasa.gov/resource/hubble-space-telescope-3d-model/) |
| chandra | 30,132 | 6 | [Source](https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Chandra%20X-ray%20Observatory) |
| fermi | 172,788 | 0 | [Source](https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Fermi%20Gamma-ray%20Large%20Area%20Space%20Telescope) |
| tess | 16,161 | 6 | [Source](https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Transiting%20Exoplanet%20Survey%20Satellite%20%28TESS%29%20%28B%29) |
| iss | 2,707,621 | 220 | [Source](https://www.nasa.gov/integrated-graphics-operations-and-analysis-laboratory/) |
| tiangong | 128,932 | 1 | [Source](https://sketchfab.com/3d-models/tiangong-aca22b1dd6d242c1ae7b88de2f483b77) |
| kepler | 9,042 | 10 | [Source](https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Kepler%20%28A%29) |
| spitzer | 10,311 | 7 | [Source](https://science.nasa.gov/resource/spitzer-space-telescope-3d-model/) |
| grace | 3,961 | 4 | [Source](https://github.com/nasa/NASA-3D-Resources/tree/11ebb4ee043715aefbba6aeec8a61746fad67fa7/3D%20Models/Gravity%20Recovery%20and%20Climate%20Experiment%20%28GRACE%29%20%28B%29) |
| grace-fo | 3,652 | 4 | [Source](https://gracefo.jpl.nasa.gov/resources/86/grace-fo-3d-model/) |

Ces mesures sont issues des fichiers locaux effectivement intégrés. Les images intégrées ne sont pas nécessairement autant de textures uniques à haute résolution. Les proportions, la configuration historique et l’éclairage doivent aussi être contrôlés.

**Fermi reste un point à améliorer** : son modèle actuel est dense et possède des matériaux colorés, mais aucune texture image intégrée. Il ne faut pas le présenter comme l’équivalent visuel du grand modèle ISS texturé. Aucune meilleure version texturée téléchargeable n’a été vérifiée pendant cette recherche.

Les modèles NASA sont associés aux [consignes NASA sur les images et médias](https://www.nasa.gov/nasa-brand-center/images-and-media/), sans supposer que toute image trouvée sur un site NASA appartient à la NASA. La provenance des modèles actuels reste dans les manifestes sources du projet.

## Recherches sans remplacement satisfaisant vérifié

| Objet | Résultat et fausses pistes écartées |
|---|---|
| AstroSat | Références ISRO et maquette papier officielle trouvées. Aucun maillage détaillé couleur téléchargeable et réutilisable vérifié. Les sites nommés AstroSat sont souvent des outils de suivi sans lien avec le véhicule. |
| XPoSat | Pas de modèle détaillé fidèle vérifié. Les silhouettes représentatives d’autres trackers ne prouvent pas une géométrie exacte du satellite. |
| LAGEOS-1/2 | Documentation ILRS, description de construction et publication décrivant un CAD scientifique trouvées. Le fichier CAD n’a pas été obtenu avec une licence de réutilisation ; une image de coupe dans un article ne suffit pas. |
| Suzaku | Modèle NASA officiel disponible, mais sans textures image embarquées. Aucun remplacement texturé supérieur vérifié ; documentation JAXA utile pour contrôler la forme. |
| FUSE | Source NASA existante retrouvée ; elle ne règle pas l’exigence de textures et de détail couleur. Aucun meilleur téléchargement vérifié. |

« Non trouvé » signifie qu’aucun fichier convenable n’a été vérifié ici, pas qu’il n’existe aucun modèle privé ou non indexé. Les sources techniques restent utiles pour une création originale ultérieure, sans inventer une géométrie.

## Anciennes stations : recherches complémentaires

| Station | Piste | Limite actuelle |
|---|---|---|
| Saliout-7 | [Sketchfab, uperesito](https://sketchfab.com/3d-models/salyut-7-818ffb07179f4bbcb61c9c1712e07299), 17 020 triangles ; téléchargement actif, CC BY 4.0 annoncé par le déposant | Le déposant indique une origine Celestia Motherlode. Auteur et licence de l’original restent à recouper avant réutilisation. |
| Saliout-1 | [Sketchfab, tashtego](https://sketchfab.com/3d-models/salyut-1-d6b616df31f34d1b8b7459b8144d58bc), 81 260 triangles ; téléchargement actif | CC BY-NC 4.0 : restrictions commerciales explicites. Archive non inspectée. |
| Tiangong-1 | [TurboDDD, TurboSquid](https://www.turbosquid.com/3d-models/tiangong-1-satellite-3d-model/1243902), 42 059 polygones et textures 4K annoncées | Payant ; droits web à confirmer. L’alternative tashtego de 2 413 triangles n’est pas téléchargeable actuellement. |
| Tiangong-2 | Démonstration éducative WWT identifiée | Aucun fichier source fidèle accompagné de droits établis n’a été vérifié. Ne pas utiliser Tiangong-1 à sa place. |
| Almaz, Saliout-4/6 | Recherche effectuée | Aucun modèle détaillé réutilisable validé. Ne pas distribuer Saliout-7 sous ces noms. |

## Ordre de travail proposé

1. Convertir et tester **Mir**, dont les sources et licences sont les mieux établies parmi les nouveautés.
2. Résoudre les conditions des modèles **CHEOPS et XMM-Newton**, puis utiliser les sources officielles avec leurs textures.
3. Si des achats sont envisagés, commencer par **IXPE, XRISM et NuSTAR**, en obtenant une confirmation d’usage dans le site public avant achat.
4. Évaluer ensuite **Swift, Compton et Skylab** ; Skylab nécessite une préparation particulière des matériaux.
5. Garder les objets sans source fiable avec leur représentation actuelle, sans activer un faux modèle détaillé.

## Pièces conservées

`candidates.json` relie les objets aux sources, formats, limites et prochaines vérifications. `mir-source-audit.json` conserve les empreintes et notices de tous les fichiers Mir réellement récupérés. Les réponses de l’API publique Sketchfab distinguent téléchargement actif, licence et simple visionneuse. Les fichiers de recherche restent en dehors de `static/` et aucun candidat payant n’a été téléchargé.

Le menu **Stations spatiales** a également été trié alphabétiquement, avec le même ordre de navigation au clavier. Cette modification est synchronisée en local et vérifiée sur Atlas, une page satellite et une page station. Aucun changement n’a été publié sur GitHub.

## Mise à jour : essai local Mir

À la demande de l’utilisateur, Mir a été converti et ajouté à l’option détaillée locale. 446 331 triangles, neuf textures, crédits CC BY 4.0 conservés. Le modèle blanc reste disponible. Les données orbitales et le modèle géométrique restent distincts ; utiliser la dernière position archivée sur la page Mir. Cette mise à jour ne signifie pas que les autres candidats du rapport ont été intégrés. Aperçu du fichier converti : [Mir](mir-preview.png).
