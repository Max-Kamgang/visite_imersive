# -*- coding: utf-8 -*-
"""Chapitre 1 (cadre conceptuel et theorique) et Chapitre 2 (methodologie)."""
from norme_keyce import (titre_chapitre, titre_2, titre_3, titre_4, para, puce,
                         tableau, titre_tableau, titre_figure, source_note, citation_longue)


def chapitre1(doc):
    titre_chapitre(doc, "Chapitre 1 : Cadre conceptuel et théorique")

    para(doc,
        "Ce chapitre pose les fondations intellectuelles de l'étude. Il clarifie d'abord les "
        "notions mobilisées — patrimoine culturel, médiation, numérisation tridimensionnelle, "
        "généalogie, valorisation — afin d'écarter les ambiguïtés terminologiques et de "
        "délimiter le champ d'analyse. Il dresse ensuite l'état de l'art des dispositifs de "
        "médiation numérique existants et en souligne les limites au regard du contexte des "
        "musées de chefferie. Il présente enfin les théories retenues pour interpréter le "
        "phénomène étudié et justifier la démarche adoptée.")

    # ---------------------------------------------------------------- 1.1
    titre_2(doc, "1.1. Cadre conceptuel et état de l'art")

    titre_3(doc, "1.1.1. Le patrimoine culturel")
    para(doc,
        "Le patrimoine culturel désigne l'ensemble des biens, matériels et immatériels, qu'une "
        "collectivité reçoit de ses prédécesseurs et transmet à ses successeurs. La Convention "
        "pour la sauvegarde du patrimoine culturel immatériel élargit cette notion au-delà des "
        "objets : elle y intègre les pratiques, représentations, connaissances et savoir-faire "
        "que les communautés reconnaissent comme faisant partie de leur héritage (UNESCO, "
        "2003). Cette définition importe pour notre étude : elle établit que la valeur d'un "
        "fonds ne réside pas seulement dans les pièces conservées, mais aussi dans les récits "
        "qui les accompagnent.")
    para(doc,
        "Dans le cas des chefferies de l'Ouest-Cameroun, cette articulation est structurante. "
        "Un trône, un masque ou un insigne ne valent pas d'abord par leur facture : ils valent "
        "par le souverain auquel ils se rattachent et par le moment dynastique qu'ils "
        "matérialisent. Le patrimoine matériel et le patrimoine immatériel y sont donc "
        "indissociables. Séparer l'objet de sa lignée revient à en effacer la signification.")

    titre_3(doc, "1.1.2. Le musée et sa mission de communication")
    para(doc,
        "La définition du musée adoptée par le Conseil international des musées assigne à "
        "l'institution muséale une mission qui dépasse la conservation. Le musée y est présenté "
        "comme un établissement au service de la société, qui recherche, collecte, conserve, "
        "interprète et expose le patrimoine, de manière accessible et inclusive (ICOM, 2022). "
        "Deux termes retiennent l'attention : « interpréter » et « accessible ». Ils font de la "
        "mise en relation avec un public une mission constitutive, et non un supplément "
        "facultatif.")
    para(doc,
        "Ce déplacement fonde notre problématique. Un musée qui conserve sans rendre accessible "
        "n'accomplit qu'une partie de sa mission. La question de l'accessibilité du fonds de la "
        "Maison Foudjem n'est donc pas une question périphérique : elle touche à la raison "
        "d'être de l'institution.")

    titre_3(doc, "1.1.3. La médiation culturelle et la médiation numérique")
    para(doc,
        "La médiation culturelle désigne l'ensemble des dispositifs qui établissent une "
        "relation entre un public et un objet de patrimoine. Elle recouvre la visite guidée, le "
        "cartel, l'audioguide, la scénographie ou la publication. Sa fonction est de rendre "
        "intelligible ce qui, sans elle, resterait muet.")
    para(doc,
        "La médiation numérique en constitue une modalité particulière : elle mobilise des "
        "supports informatiques pour documenter, restituer et raconter un fonds. Nous la "
        "définissons, dans le cadre de ce travail, comme l'ensemble des dispositifs techniques "
        "permettant de décrire un objet patrimonial dans un système d'information, de le "
        "restituer à distance sous une forme perceptible, et d'en énoncer le récit à un public "
        "déterminé.")
    para(doc,
        "Cette définition retient trois dimensions opératoires : la documentation (l'objet "
        "est-il décrit dans un référentiel exploitable ?), la restitution (l'objet est-il "
        "perceptible à distance ?) et la narration (le récit associé est-il énoncé ?). Ces "
        "trois dimensions structurent les variables de l'étude, présentées au chapitre 2.")

    titre_3(doc, "1.1.4. La numérisation tridimensionnelle et la réalité augmentée")
    para(doc,
        "La numérisation tridimensionnelle consiste à produire une représentation numérique "
        "d'un objet physique dans ses trois dimensions. Deux techniques dominent aujourd'hui. "
        "La photogrammétrie reconstitue un volume à partir d'une série de photographies prises "
        "sous des angles différents. La télémétrie par la lumière, désignée par l'acronyme "
        "LiDAR, mesure les distances au moyen d'un faisceau lumineux ; elle est désormais "
        "intégrée à certains terminaux mobiles, ce qui en abaisse fortement le coût.")
    para(doc,
        "Le résultat est enregistré dans un format d'échange. Le format glTF, et sa variante "
        "binaire GLB, s'est imposé comme standard pour la diffusion de modèles tridimensionnels "
        "sur le web. La réalité augmentée prolonge ce dispositif : elle superpose le modèle "
        "numérique à l'environnement réel de l'utilisateur, au moyen de la caméra de son "
        "terminal. Un visiteur distant peut ainsi placer virtuellement un objet dans son propre "
        "espace et en apprécier les proportions.")
    para(doc,
        "Ces techniques présentent un intérêt direct pour notre objet d'étude. Elles permettent "
        "de restituer un objet sans le déplacer, donc sans l'exposer aux risques inhérents au "
        "transport, et sans exiger la présence physique du public.")

    titre_3(doc, "1.1.5. La généalogie comme structure de connaissance")
    para(doc,
        "La généalogie est l'étude de la filiation et des lignées. Dans le contexte des "
        "chefferies, elle ne relève pas de la curiosité érudite : elle constitue le principe "
        "d'organisation du pouvoir et, par voie de conséquence, la grille de lecture des "
        "collections. Connaître la succession des souverains, leurs alliances et leur "
        "descendance permet de dater un objet, d'en établir la provenance et d'en comprendre la "
        "fonction.")
    para(doc,
        "Sur le plan informatique, une généalogie se modélise comme un graphe orienté : chaque "
        "individu constitue un nœud, chaque relation de filiation un arc. Cette structure "
        "autorise deux opérations utiles à la médiation : la remontée d'une lignée à partir "
        "d'un individu, et la mise en relation d'un objet avec le souverain auquel il se "
        "rattache. C'est cette seconde opération qui restitue au visiteur le sens de la pièce "
        "qu'il observe.")

    titre_3(doc, "1.1.6. La valorisation du patrimoine")
    para(doc,
        "La valorisation désigne l'action de faire produire à un patrimoine les effets attendus "
        "de lui. Elle comporte deux volets. La valorisation culturelle vise la transmission : "
        "elle se mesure à l'audience atteinte et à la connaissance diffusée. La valorisation "
        "économique vise la soutenabilité : elle se mesure aux ressources que le fonds procure "
        "à la structure qui en assure la garde.")
    para(doc,
        "Ces deux volets sont liés. Un musée sans ressources ne conserve pas durablement ; un "
        "musée sans audience ne justifie pas les ressources qu'il mobilise. Dans le cadre de "
        "cette étude, nous retenons les deux dimensions comme variables à mesurer.")

    titre_3(doc, "1.1.7. L'intelligence artificielle appliquée à la médiation")
    para(doc,
        "Les modèles de langue permettent aujourd'hui de produire un discours en langue "
        "naturelle et de répondre à des questions formulées librement. Leur emploi en médiation "
        "muséale soulève toutefois une difficulté : ces modèles peuvent produire des énoncés "
        "plausibles mais faux. Appliqué au patrimoine, ce défaut est disqualifiant : un guide "
        "qui invente une filiation ou attribue un objet au mauvais souverain produit une "
        "désinformation.")
    para(doc,
        "La réponse technique à cette difficulté porte le nom d'ancrage : le modèle n'est "
        "autorisé à répondre qu'à partir d'un contexte documentaire fourni, extrait d'une base "
        "de connaissances vérifiée. Le dispositif combine alors une recherche dans le fonds "
        "documenté et une génération contrainte par les seuls éléments retrouvés. Cette "
        "approche conditionne la crédibilité de tout guide automatisé appliqué au patrimoine.")
    para(doc,
        "La synthèse vocale, désignée par l'acronyme TTS, complète ce dispositif en convertissant "
        "un texte en parole. Elle permet d'adresser au visiteur un discours oral, modalité "
        "cohérente avec une tradition de transmission elle-même orale.")

    titre_3(doc, "1.1.8. État de l'art des dispositifs existants")
    para(doc,
        "Les dispositifs de médiation numérique du patrimoine se sont multipliés. Les grandes "
        "institutions muséales proposent des visites virtuelles, des collections en ligne et "
        "des applications mobiles. Des plateformes agrègent les fonds de plusieurs musées et en "
        "offrent une consultation à distance. Des audioguides numériques accompagnent la visite "
        "sur place.")
    para(doc,
        "Ces dispositifs présentent toutefois trois limites au regard du contexte étudié. "
        "Premièrement, ils sont conçus pour des institutions disposant de fonds déjà inventoriés "
        "et normalisés, ce qui n'est pas le cas des musées de chefferie. Deuxièmement, ils "
        "traitent l'objet comme une entité autonome et ne restituent pas la structure "
        "généalogique qui, dans les sociétés de chefferie, lui donne son sens. Troisièmement, "
        "ils supposent des moyens techniques et financiers hors de portée d'une fondation.")
    para(doc,
        "C'est dans cet écart que se situe l'apport attendu de ce travail : documenter les "
        "causes de la faible médiation dans un musée de chefferie, et concevoir un dispositif "
        "qui articule explicitement l'objet et la lignée.")

    # ---------------------------------------------------------------- 1.2
    titre_2(doc, "1.2. Cadre théorique")
    para(doc,
        "Trois cadres théoriques sont mobilisés. Le premier éclaire l'adoption d'un dispositif "
        "numérique par ses destinataires. Le deuxième explique la diffusion d'une innovation "
        "dans un corps social. Le troisième fonde la démarche par laquelle un artefact est "
        "conçu et évalué dans le cadre d'une recherche.")

    titre_3(doc, "1.2.1. Le modèle d'acceptation de la technologie")
    para(doc,
        "Le modèle d'acceptation de la technologie établit que l'usage effectif d'un système "
        "d'information dépend principalement de deux perceptions : l'utilité perçue et la "
        "facilité d'utilisation perçue (Davis, 1989). Un dispositif jugé utile mais difficile "
        "d'accès est délaissé ; un dispositif facile mais inutile l'est également.")
    para(doc,
        "Ce modèle est mobilisé ici parce que le diagnostic ne peut se limiter à constater "
        "l'absence d'outils. Il doit examiner les conditions dans lesquelles un dispositif "
        "serait effectivement adopté, tant par le personnel de la Fondation que par le public. "
        "Sa limite tient à son origine : il a été construit pour des usages professionnels en "
        "entreprise, et transpose imparfaitement les motivations d'un visiteur de musée, qui "
        "relèvent aussi de l'attachement culturel.")

    titre_3(doc, "1.2.2. La théorie de la diffusion de l'innovation")
    para(doc,
        "La théorie de la diffusion de l'innovation explique comment une nouveauté se répand "
        "dans un système social au fil du temps. Elle identifie cinq attributs qui déterminent "
        "le rythme de cette diffusion : l'avantage relatif, la compatibilité avec les valeurs "
        "existantes, la complexité, la possibilité d'essai et l'observabilité des résultats "
        "(Rogers, 2003).")
    para(doc,
        "L'attribut de compatibilité retient particulièrement l'attention dans notre contexte. "
        "Un dispositif numérique appliqué au patrimoine des chefferies ne se diffusera que s'il "
        "respecte les règles de transmission propres à ces sociétés, notamment le caractère "
        "réservé de certains savoirs. Cette théorie éclaire donc une contrainte que la seule "
        "analyse technique ne ferait pas apparaître.")

    titre_3(doc, "1.2.3. La recherche en science de la conception")
    para(doc,
        "La recherche en science de la conception établit qu'un artefact — modèle, méthode ou "
        "système — peut constituer une contribution scientifique à part entière, dès lors que "
        "sa construction répond à un problème identifié et que son évaluation est conduite avec "
        "rigueur (Hevner, March, Park et Ram, 2004).")
    para(doc,
        "Ce cadre fonde la structure de notre travail. Il justifie que le diagnostic précède la "
        "conception, et que l'artefact proposé ne vaille pas par lui-même, mais par sa réponse "
        "à un problème établi empiriquement. Il impose également une évaluation : c'est à ce "
        "titre que la faisabilité de l'intervention est démontrée par un prototype, dont les "
        "vérifications sont rapportées au chapitre 3.")

    para(doc,
        "Ces trois cadres se complètent. La science de la conception structure la démarche ; le "
        "modèle d'acceptation et la théorie de la diffusion en éclairent les conditions de "
        "réussite. Aucun d'eux n'est mobilisé pour lui-même : chacun sert l'interprétation des "
        "résultats présentés aux chapitres 3 et 4.")

    titre_2(doc, "Conclusion du chapitre")
    para(doc,
        "Ce chapitre a clarifié les notions sur lesquelles repose l'étude. Il a établi que le "
        "patrimoine des chefferies articule indissociablement l'objet et la lignée, que la "
        "mission muséale comporte une exigence d'accessibilité, et que la médiation numérique "
        "se décompose en trois dimensions : documentation, restitution et narration. L'état de "
        "l'art a montré que les dispositifs existants ne traitent pas la structure généalogique "
        "et supposent des moyens inadaptés au contexte étudié. Les cadres théoriques retenus "
        "fournissent enfin les instruments d'interprétation nécessaires. Le chapitre suivant "
        "expose la méthodologie par laquelle ces notions ont été rendues mesurables.")


def chapitre2(doc):
    titre_chapitre(doc, "Chapitre 2 : Méthodologie de l'étude")

    para(doc,
        "Ce chapitre expose la démarche suivie pour répondre aux questions posées en "
        "introduction. Il précise la nature de l'étude et le niveau de recherche retenu, "
        "décompose les hypothèses en variables et en indicateurs mesurables, définit la "
        "population et l'échantillon, et présente les outils de collecte ainsi que les "
        "techniques d'analyse. Les difficultés rencontrées et les limites de la démarche y sont "
        "également rapportées.")

    # ---------------------------------------------------------------- 2.1
    titre_2(doc, "2.1. Nature de l'étude, variables et indicateurs")

    titre_3(doc, "2.1.1. Nature de l'étude")
    para(doc,
        "L'étude se situe à deux niveaux successifs. Le diagnostic relève du niveau "
        "appréhensif : il analyse les dispositifs en place, examine les relations entre les "
        "variables et porte un regard critique sur la situation observée. La seconde partie du "
        "travail relève du niveau intégrateur : elle ne se limite pas à comprendre, mais "
        "intervient sur la réalité par la conception et l'expérimentation d'un artefact.")
    para(doc,
        "Le type d'étude correspondant est la recherche interactive, conduite selon une "
        "démarche de recherche-action. Le chercheur n'a pas observé le terrain à distance : il "
        "a été intégré à la structure d'accueil durant le stage, a participé à ses travaux et a "
        "construit avec elle la réponse au problème identifié. Ce choix est cohérent avec la "
        "science de la conception présentée au chapitre 1, qui fait de la construction et de "
        "l'évaluation d'un artefact une contribution scientifique.")
    para(doc,
        "L'approche méthodologique est mixte, à dominante qualitative. La dominante qualitative "
        "s'impose parce que les données recherchées portent sur des pratiques, des perceptions "
        "et des processus, que seuls l'observation et l'entretien permettent de saisir. Une "
        "composante quantitative complète le dispositif : l'inventaire des collections et le "
        "dénombrement des objets documentés produisent des données numériques nécessaires à la "
        "mesure de certaines variables.")

    titre_3(doc, "2.1.2. Variables et indicateurs de l'étude")
    para(doc,
        "L'hypothèse générale énonce que la faible accessibilité et la faible valorisation du "
        "patrimoine s'expliquent par l'état de la documentation et par le mode de médiation. "
        "Elle se décompose donc en une variable expliquée et trois variables explicatives. "
        "Conformément au principe méthodologique retenu, ces variables sont celles-là mêmes qui "
        "figurent dans l'énoncé du problème.")
    para(doc,
        "La variable expliquée est l'accessibilité et la valorisation du patrimoine. Les "
        "variables explicatives sont la documentation des collections, la médiation et le "
        "dispositif de valorisation économique. Chacune est rendue mesurable par des "
        "indicateurs observables sur le terrain, présentés au tableau 2.1.")

    titre_tableau(doc, "2.1", "Variables et indicateurs de l'étude")
    tableau(doc,
        ["Variable", "Indicateurs"],
        [
            ["V1 — Documentation des collections",
             "Support dominant (papier / numérique) ; existence d'un référentiel unique ; "
             "nombre d'objets décrits rapporté au nombre total ; champs renseignés par objet ; "
             "existence d'un lien documenté entre objet et personnage"],
            ["V2 — Médiation",
             "Modalités proposées (visite guidée / libre) ; dépendance à la coprésence d'un "
             "guide ; supports disponibles ; langues proposées ; restitution effective du lien "
             "objet–lignée"],
            ["V3 — Valorisation économique",
             "Sources de revenus du musée ; existence d'une tarification ; existence d'une "
             "offre accessible à distance"],
            ["VE — Accessibilité et valorisation du patrimoine (variable expliquée)",
             "Canaux d'accès au fonds ; portée géographique de l'audience ; possibilité de "
             "consultation à distance ; fréquentation observée"],
        ],
        largeurs=[5.0, 10.5])
    source_note(doc, "Note. Élaboré par l'auteur à partir de l'hypothèse générale de l'étude.")

    para(doc,
        "Le choix de ces indicateurs appelle une précision. Ils ont été retenus parce qu'ils "
        "sont observables durant la période de stage et qu'ils se rapportent directement aux "
        "termes de l'hypothèse. Les indicateurs relatifs à la fréquentation constituent la "
        "principale difficulté rencontrée : en l'absence d'un registre systématique des "
        "visiteurs à la Maison Foudjem, leur mesure repose sur les déclarations du personnel et "
        "sur l'observation directe. Cette limite est prise en compte dans l'interprétation des "
        "résultats.")

    # ---------------------------------------------------------------- 2.2
    titre_2(doc, "2.2. Échantillonnage et outils de l'étude")

    titre_3(doc, "2.2.1. Population et échantillonnage")
    para(doc,
        "La population de l'étude est constituée de deux ensembles. Le premier réunit les "
        "objets du fonds patrimonial conservé à la Maison Foudjem, ainsi que les lignées "
        "documentées qui s'y rattachent. Le second réunit les personnes intervenant dans la "
        "conservation et la médiation de ce fonds au sein de la Fondation Jean Félicien Gacha.")
    para(doc,
        "La technique d'échantillonnage retenue est non probabiliste et raisonnée. Ce choix se "
        "justifie par la nature de l'étude : il ne s'agit pas de généraliser statistiquement, "
        "mais de comprendre une situation dans un site déterminé. Les éléments ont donc été "
        "sélectionnés en fonction de leur pertinence au regard des objectifs, et non par tirage "
        "aléatoire.")
    para(doc,
        "[À COMPLÉTER APRÈS COLLECTE : préciser le nombre d'objets examinés, le nombre de "
        "lignées documentées et le nombre de personnes interrogées, ainsi que les critères "
        "d'inclusion retenus pour chacun de ces ensembles.]")
    para(doc,
        "La portée des conclusions est limitée par ce choix. Les résultats valent pour la "
        "Maison Foudjem ; leur transposition à d'autres musées de chefferie suppose une "
        "vérification préalable des conditions locales.")

    titre_3(doc, "2.2.2. Outils de l'étude")
    para(doc,
        "Quatre outils de collecte ont été employés, chacun rattaché à un objectif spécifique. "
        "Leur articulation est présentée au tableau 2.2.")

    titre_tableau(doc, "2.2", "Outils de collecte rattachés aux objectifs spécifiques")
    tableau(doc,
        ["Objectif spécifique", "Outil de collecte", "Données produites"],
        [
            ["Connaître les dispositifs de documentation et de médiation en usage",
             "Grille d'observation ; guide d'entretien semi-directif",
             "Pratiques observées ; perceptions du personnel"],
            ["Évaluer l'état de la documentation numérique",
             "Fiche documentaire ; inventaire",
             "Supports existants ; nombre d'objets décrits ; champs renseignés"],
            ["Analyser le lien entre absence de dispositif, audience et valorisation",
             "Guide d'entretien ; analyse documentaire",
             "Canaux d'accès ; sources de revenus ; portée de l'audience"],
        ],
        largeurs=[5.5, 4.5, 5.5])
    source_note(doc, "Note. Élaboré par l'auteur.")

    para(doc,
        "La grille d'observation a servi à consigner les pratiques de médiation constatées sur "
        "place : modalités de visite, supports employés, restitution du lien entre l'objet et "
        "la lignée. Le guide d'entretien semi-directif a permis de recueillir la perception du "
        "personnel sur les difficultés rencontrées et sur les besoins exprimés. La fiche "
        "documentaire a servi à relever l'état des supports de documentation existants. Les "
        "modèles de ces trois outils figurent en annexe.")
    para(doc,
        "Un pré-test du guide d'entretien a été effectué auprès d'un premier interlocuteur afin "
        "d'identifier les formulations ambiguës et d'ajuster l'ordre des questions avant la "
        "collecte définitive.")

    titre_4(doc, "Outils d'implémentation")
    para(doc,
        "La phase de conception a mobilisé un ensemble d'outils logiciels, présentés au "
        "chapitre 3. Ils ont été retenus selon trois critères : la gratuité ou l'existence "
        "d'une offre gratuite, afin de rester compatible avec les moyens d'une fondation ; "
        "l'ouverture des formats, afin de préserver la pérennité des données patrimoniales ; et "
        "la possibilité d'un fonctionnement sur terminal mobile, compte tenu des usages "
        "observés au Cameroun.")

    titre_4(doc, "Techniques d'analyse des données")
    para(doc,
        "Les données qualitatives issues des observations et des entretiens ont été traitées "
        "par analyse thématique : les énoncés ont été codés, regroupés en catégories, puis "
        "rapportés aux variables de l'étude. Les données quantitatives issues de l'inventaire "
        "ont été traitées par statistiques descriptives : effectifs, fréquences et "
        "pourcentages. La confrontation des deux séries de résultats a permis la vérification "
        "des hypothèses, présentée au chapitre 4.")

    titre_2(doc, "Conclusion du chapitre")
    para(doc,
        "Ce chapitre a établi que l'étude relève d'une recherche interactive conduite selon une "
        "démarche de recherche-action, aux niveaux appréhensif puis intégrateur, selon une "
        "approche mixte à dominante qualitative. Il a décomposé l'hypothèse générale en quatre "
        "variables et en indicateurs observables, défini une population et un échantillonnage "
        "raisonné, et présenté les quatre outils de collecte ainsi que les techniques "
        "d'analyse. Les limites de la démarche — absence de registre de fréquentation, portée "
        "restreinte à un site unique — ont été explicitées. Le chapitre suivant présente le "
        "site de l'étude, les données recueillies et les résultats obtenus.")
