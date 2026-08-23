PROJET FIVE / FUTSAL
Dossier complet
État des lieux du marché · Cahier des charges fonctionnel · Estimation de coût

Version 2
21 août 2026

Document de travail pour le développeur, Sébastien, Iacob et Lucas
Point de départ : groupe de five existant à Reims
Confidentiel — hypothèses à valider par entretiens et crash-test terrain


Table des matières
Nouvelles idées — août 2026	4
PARTIE 1 — État des lieux du marché	5
1.1 Chiffres clés et lecture stratégique	5
1.2 Les quatre douleurs réelles	5
1.3 Analyse concurrentielle	5
1.4 Segments de clientèle	5
1.5 Tendances à exploiter	6
PARTIE 2 — Cahier des charges fonctionnel	7
2.1 Vision produit et promesse	7
2.2 Personas	7
Comptes & profils (C-)	7
Groupes (G-)	7
Événements (E-)	8
Paiement & cagnotte (P-)	8
Social & messagerie (S-)	9
Découverte de joueurs (D-)	9
Premium / Pass Leader (PR-)	9
Notifications (N-)	10
Back-office (B-)	10
Partenaires (PA-)	10
Tournois & merch (T-)	10
FiveComposer & cartes joueurs (FC-)	11
2.3 Exigences non fonctionnelles	11
2.4 Architecture technique proposée	12
2.5 Roadmap V0 → V4	12
2.6 Les quatre parcours critiques	12
Créer un événement	12
Réserver et payer sa place	12
Générer les équipes	12
Rejoindre un groupe	13
PARTIE 3 — Estimation de coût	14
3.1 Charge de développement	14
3.2 Impact des nouveaux modules	14
3.3 Calendriers selon le régime de travail	14
3.4 Coûts de lancement — année 1	14
3.5 Coûts juridiques et produit	15
3.6 Trois scénarios budgétaires	15
3.7 Modèle de revenus et seuil de rentabilité	15
PARTIE 4 — Recommandations	17
4.1 Les six décisions à trancher avant de coder	17
4.2 Plan des 90 premiers jours	17
4.3 Matrice des cinq risques	17
4.4 Trois recommandations sur les nouvelles idées	17
4.5 Avis critique honnête sur le projet	18
SYNTHÈSE EN UNE PAGE	19


Nouvelles idées — août 2026
Cette annexe d’ouverture distingue les idées confirmées des éléments déjà couverts par le périmètre produit. Elle évite d’ajouter des fonctionnalités sans expliciter leur place dans la séquence de livraison.
Idée confirmée
Statut et interprétation produit
Réseau social
Déjà couvert : module Social. Reste à cadrer et à reporter en V2 après validation des usages.
Création d’évènements Five
Déjà couvert : cœur du MVP, avec date, lieu, capacité, joueurs et statut.
Création de groupe
Déjà couvert : cœur du MVP, pour le noyau récurrent de Reims.
FiveComposer, terrains + équipes
Nouveau module, positionné en V1.5 comme différenciateur.
Générateur auto de cartes joueurs réutilisable pour faire les équipes
Nouveau module, lié au FiveComposer : la carte alimente la logique d’équilibrage.
Cagnotte pour réserver sa place
Précise le module Paiement existant : paiement lié à la confirmation de la place, en V1.5.


PARTIE 1 — État des lieux du marché
1.1 Chiffres clés et lecture stratégique
Le five et le futsal représentent un bassin estimatif de 1,5 à 2,5 millions de pratiquants en France, selon le périmètre retenu (licenciés, joueurs loisirs réguliers, sessions en complexes et pratiques informelles). Il faut lire cette fourchette comme un ordre de grandeur, non comme une mesure consolidée : la pratique loisir est précisément peu documentée.
Le marché est fragmenté entre complexes privés, groupes d’amis, messageries et outils de réservation. Aucun leader logiciel ne possède aujourd’hui la relation complète « trouver ou créer une session → remplir la liste → encaisser → composer les équipes ». Cette absence de leader est une opportunité, mais aussi un signal : la disposition à payer et la fréquence réelle restent à démontrer.
1.2 Les quatre douleurs réelles (ça va créer le besoin)
Douleur
Ce qui se passe aujourd’hui
Valeur potentielle
Collecter l’argent
L’organisateur avance, relance individuellement, rapproche les virements et gère les désistements.
Une cagnotte événementielle et des règles claires réduisent l’avance de trésorerie.
Compléter la liste
Un joueur manque au dernier moment ; l’appel au réseau arrive trop tard.
Découverte locale et liste d’attente rendent la session plus robuste.
Organiser / relancer
WhatsApp est efficace mais bruyant ; les informations importantes se perdent.
Un événement structuré, des notifications ciblées et un statut unique.
Équilibrer les équipes
La composition est faite à l’intuition, parfois tard, avec contestations.
FiveComposer : cartes, proposition d’équipes, ajustement et partage.

1.3 Analyse concurrentielle
Concurrent
Positionnement
Forces
Faiblesses
Menace pour nous
Anybuddy
Réservation de terrains et activités sportives.
Catalogue, réservation, marque, paiement.
Ne gère pas le collectif récurrent ni l’équilibrage.
Peut élargir vers la session complète.
Urban Soccer & Le Five
Exploitants de complexes.
Lieux, capacité d’acquisition, expérience terrain.
Outils centrés sur leurs centres ; peu inter-complexes.
Peuvent intégrer une fonctionnalité propriétaire.
Sporteasy
Gestion d’équipe de club, surtout football à 11.
Maturité, calendriers, convocations.
Plus administratif ; pas conçu pour le loisir spontané.
Peut descendre vers le five si le segment devient visible.
Footbar
Statistiques et tracker de performance.
Données et storytelling de match.
Dépendance au matériel ; ne résout pas l’organisation.
Peut capter la couche gamification.
WhatsApp + Lydia/Paylib
Organisation informelle, gratuit et installé.
Zéro onboarding, habitudes, réseau déjà présent.
Pas de structure, paiement déconnecté, composition manuelle.
Concurrent principal : notre produit doit être plus simple, pas seulement plus complet.

1.4 Segments de clientèle
Segment
Besoin initial
Angle d’entrée
Groupe d’amis récurrent
Créer la session hebdomadaire sans relances interminables.
Crash-test du groupe de Reims ; valeur immédiate pour le Pass Leader.
Joueur isolé / nomade
Trouver une session proche, fiable et adaptée à son niveau.
Découverte locale et réputation progressive.
Complexes / exploitants
Remplir des créneaux creux et fidéliser.
Partenariats et commission, après preuve d’usage.
Entreprises
Organiser du five inter-boîtes, avec facturation et participants.
Offre événementielle B2B plus tardive.

1.5 Tendances à exploiter
    • Gamification : profils, cartes joueurs, historique et progression donnent une raison de revenir sans promettre une performance professionnelle.
    • Paiement fractionné intégré : une contribution par participant réduit la friction financière, mais les frais fixes rendent les petits montants sensibles.
    • Essor du sport loisir sans licence : la cible veut réserver et jouer, sans calendrier fédéral ni engagement annuel.

PARTIE 2 — Cahier des charges fonctionnel
2.1 Vision produit et promesse
Five est une application web et mobile qui transforme une session de five informelle en rendez-vous fiable : un organisateur crée l’événement, les joueurs confirment leur présence, la contribution est visible, puis le produit aide à composer et partager les équipes. La promesse n’est pas « un réseau social de plus » ; c’est « une session complète, remplie et prête à jouer ».
Principe de conception : le parcours principal doit être plus rapide que l’assemblage WhatsApp + tableur + paiement séparé. Toute fonctionnalité qui ajoute du paramétrage sans améliorer la session doit rester hors V1.
2.2 Personas
Persona
Contexte
Jobs-to-be-done
Critères de succès
Organisateur — Pass Leader
Organise chaque semaine, connaît 8 à 15 joueurs, avance parfois l’argent.
Créer, remplir, relancer, encaisser, équilibrer et garder une trace.
Session complète ; zéro avance ; moins de messages manuels.
Joueur régulier
Membre d’un groupe, revient souvent, accepte une routine.
Voir les prochaines sessions, payer, prévenir, retrouver ses stats.
Réservation en moins de deux minutes ; confiance dans le groupe.
Joueur nomade
Disponible ponctuellement, ne connaît pas toujours les groupes.
Découvrir une session compatible, comprendre le niveau et rejoindre.
Disponibilité locale ; règles et coût lisibles ; accueil explicite.

Comptes & profils (C-)
Exigences priorisées selon MoSCoW : Must indispensable à la promesse de la version cible ; Should important ; Could différé sans bloquer le produit. Les versions sont des cibles, pas des engagements contractuels.
ID
Exigence
Détail
Priorité MoSCoW
Version cible
C-01
Création de compte
Email, téléphone ou fournisseur social ; consentements séparés.
Must
V1
C-02
Profil joueur
Avatar, prénom/pseudo, ville, poste préféré, niveau auto-déclaré.
Must
V1
C-03
Disponibilités
Créneaux préférés et rayon de déplacement configurables.
Should
V1
C-04
Confidentialité du profil
Visibilité du profil et données partageables par groupe.
Must
V1
C-05
Vérification email
Lien à durée limitée et gestion du renvoi.
Should
V1
C-06
Suppression/export
Export des données et suppression du compte selon RGPD.
Must
V1

Groupes (G-)
Exigences priorisées selon MoSCoW : Must indispensable à la promesse de la version cible ; Should important ; Could différé sans bloquer le produit. Les versions sont des cibles, pas des engagements contractuels.
ID
Exigence
Détail
Priorité MoSCoW
Version cible
G-01
Créer un groupe
Nom, ville, description, avatar et règles d’accès.
Must
V1
G-02
Inviter
Lien, QR ou invitation email avec expiration.
Must
V1
G-03
Rôles
Propriétaire, admin, membre ; journal des changements.
Should
V1
G-04
Rejoindre/quitter
Demande d’adhésion, approbation et sortie réversible.
Must
V1
G-05
Liste des membres
Recherche, statut et profil minimal.
Must
V1
G-06
Groupe privé/public
Contrôle de découvrabilité ; groupes privés par défaut.
Should
V1

Événements (E-)
Exigences priorisées selon MoSCoW : Must indispensable à la promesse de la version cible ; Should important ; Could différé sans bloquer le produit. Les versions sont des cibles, pas des engagements contractuels.
ID
Exigence
Détail
Priorité MoSCoW
Version cible
E-01
Créer un événement
Date, heure, lieu, capacité, niveau, prix indicatif et consignes.
Must
V1
E-02
Statuts
Brouillon, ouvert, complet, terminé, annulé.
Must
V1
E-03
Inscriptions
Rejoindre, se désister, liste d’attente et capacité.
Must
V1
E-04
Récurrence
Copier un événement hebdomadaire avec validation humaine.
Should
V1
E-05
Check-in
Présence confirmée et relance des absents.
Should
V1.5
E-06
Historique
Sessions passées et taux de présence du groupe.
Could
V2
E-07
Lien partageable
Résumé sans compte, puis conversion à l’inscription.
Must
V1

Paiement & cagnotte (P-)
Exigences priorisées selon MoSCoW : Must indispensable à la promesse de la version cible ; Should important ; Could différé sans bloquer le produit. Les versions sont des cibles, pas des engagements contractuels.
ID
Exigence
Détail
Priorité MoSCoW
Version cible
P-01
Paiement sécurisé
Intégration Stripe, montant et statut par participant.
Must
V1.5
P-02
Remboursement
Remboursement total/partiel selon règles de l’événement.
Should
V1.5
P-03
Reçus
Email et historique des transactions.
Should
V1.5
P-04
Frais de service
Affichage transparent et configuration par type d’événement.
Must
V1.5
P-05
Gestion des annulations
Règles visibles avant paiement ; cas complexe documenté.
Should
V1.5
P-06
Rapprochement organisateur
Vue des contributions, frais et solde dû au complexe.
Should
V1.5
P-11
Paiement = condition de réservation
la place n’est confirmée qu’une fois la contribution versée dans la cagnotte, pas une inscription déclarative
Must
V1.5
P-12
Cagnotte collective par événement
chaque événement a sa cagnotte avec objectif (ex 120€) et progression (ex 80€/120€, 8/12 joueurs)
Must
V1.5
P-13
Libération automatique de la place
si un joueur ne paie pas dans le délai fixé (ex 24h avant), sa place est libérée pour le suivant en liste d’attente
Should
V1.5

Cela renforce l’argument de repousser le paiement réel en V1.5 plutôt qu’en V1 : la logique « paiement = place » ajoute de la complexité (délais, relances, libération automatique), des cas limites et des obligations de support. 
La V1 peut démontrer l’usage sans exposer trop tôt l’équipe à la réconciliation financière.
Social & messagerie (S-)
Exigences priorisées selon MoSCoW : Must indispensable à la promesse de la version cible ; Should important ; Could différé sans bloquer le produit. Les versions sont des cibles, pas des engagements contractuels.
ID
Exigence
Détail
Priorité MoSCoW
Version cible
S-01
Fil de groupe
Posts courts, réactions et épinglage d’informations.
Could
V2
S-02
Chat événement
Messages associés à une session, modération et signalement.
Should
V1.5
S-03
Partage externe
Lien et visuel partageables vers WhatsApp.
Must
V1
S-04
Mentions
Mention d’un membre avec notification contrôlable.
Could
V2
S-05
Anti-spam
Limites, blocage et signalement.
Must
V1
S-06
Média léger
Photo de groupe avec consentement et suppression.
Could
V2
S-07
Messages privés
Chater en priver avec un ami
Should
V2

Découverte de joueurs (D-)
Exigences priorisées selon MoSCoW : Must indispensable à la promesse de la version cible ; Should important ; Could différé sans bloquer le produit. Les versions sont des cibles, pas des engagements contractuels.
ID
Exigence
Détail
Priorité MoSCoW
Version cible
D-01
Sessions ouvertes
Rechercher par ville, date, niveau et places.
Should
V1.5
D-02
Profil public minimal
Afficher uniquement les informations autorisées.
Must
V1
D-03
Demande de rejoindre
Validation par organisateur pour sessions privées.
Should
V1.5
D-04
Recommandation locale
Sessions compatibles selon disponibilité et distance.
Could
V2
D-05
Réputation de présence
Taux de présence, sans note de personnalité.
Could
V2
D-06
Blocage
Empêcher contact et invitation.
Must
V1

Premium / Pass Leader (PR-)
Exigences priorisées selon MoSCoW : Must indispensable à la promesse de la version cible ; Should important ; Could différé sans bloquer le produit. Les versions sont des cibles, pas des engagements contractuels.
ID
Exigence
Détail
Priorité MoSCoW
Version cible
PR-01
Abonnement Pass Leader
Offre mensuelle sans engagement, prix cible 4,99 €.
Should
V1.5
PR-02
Fonctions avancées
Récurrence, relances, exports et règles de groupe.
Should
V1.5
PR-03
Période d’essai
Essai clair, rappel avant renouvellement.
Could
V2
PR-04
Gestion d’abonnement
Annulation, factures et restauration.
Must
V1.5
PR-05
Limites freemium
Plafonds compréhensibles, jamais bloquants pour rejoindre.
Must
V1.5

Notifications (N-)
Exigences priorisées selon MoSCoW : Must indispensable à la promesse de la version cible ; Should important ; Could différé sans bloquer le produit. Les versions sont des cibles, pas des engagements contractuels.
ID
Exigence
Détail
Priorité MoSCoW
Version cible
N-01
Push événement
Ouverture, changement d’heure, annulation, place libérée.
Must
V1
N-02
Email transactionnel
Invitation, confirmation, reçu et rappel critique.
Must
V1.5
N-03
Relance non-réponse
Relance contrôlée par l’organisateur, anti-spam.
Must
V1
N-04
Préférences
Canaux, quiet hours et fréquence.
Should
V1
N-05
Centre de notifications
Historique lu/non lu et deep links.
Should
V1

Back-office (B-)
Exigences priorisées selon MoSCoW : Must indispensable à la promesse de la version cible ; Should important ; Could différé sans bloquer le produit. Les versions sont des cibles, pas des engagements contractuels.
ID
Exigence
Détail
Priorité MoSCoW
Version cible
B-01
Dashboard
Utilisateurs, groupes, événements, paiements et erreurs.
Must
V1
B-02
Modération
Signalements, blocage, retrait de contenu.
Must
V1
B-03
Support
Recherche d’un compte et résolution traçable.
Should
V1
B-04
Remboursement assisté
Actions limitées et journalisées.
Should
V1.5
B-05
Paramétrage
Frais, villes, textes et règles sans redéploiement.
Could
V2
B-06
Audit log
Actions sensibles et accès administrateurs.
Must
V1

Partenaires (PA-)
Exigences priorisées selon MoSCoW : Must indispensable à la promesse de la version cible ; Should important ; Could différé sans bloquer le produit. Les versions sont des cibles, pas des engagements contractuels.
ID
Exigence
Détail
Priorité MoSCoW
Version cible
PA-01
Fiche complexe
Adresse, horaires, terrains et contact.
Should
V1.5
PA-02
Créneaux partenaires
Catalogue de créneaux disponibles.
Could
V2
PA-03
Attribution événement
Associer une session à un complexe.
Must
V1
PA-04
Commission
Règles contractuelles et reporting.
Should
V2
PA-05
Code partenaire
Suivi des groupes et offres de lancement.
Could
V2

Tournois & merch (T-)
Exigences priorisées selon MoSCoW : Must indispensable à la promesse de la version cible ; Should important ; Could différé sans bloquer le produit. Les versions sont des cibles, pas des engagements contractuels.
ID
Exigence
Détail
Priorité MoSCoW
Version cible
T-01
Créer un tournoi
Format, équipes, calendrier et règlement.
Could
V2
T-02
Bracket
Tableau et résultats saisis par admin.
Could
V2
T-03
Classement
Points, fair-play et archivage.
Could
V2
T-04
Boutique simple
Précommandes de maillots et accessoires.
Could
V3
T-05
Codes promotionnels
Partenaires et événements spéciaux.
Could
V2

FiveComposer & cartes joueurs (FC-)
Exigences priorisées selon MoSCoW : Must indispensable à la promesse de la version cible ; Should important ; Could différé sans bloquer le produit. Les versions sont des cibles, pas des engagements contractuels.
ID
Exigence
Détail
Priorité MoSCoW
Version cible
FC-01
Carte joueur automatique
génération auto d'une carte visuelle style carte FIFA/FUT à partir du profil (nom, avatar/photo, poste préféré, niveau auto-déclaré)
Should
V1.5
FC-02
Notation du joueur
notes 1-99 ou 1-5 étoiles par sous-critère (technique, physique, vitesse, défense), auto-déclarées puis ajustées par les autres joueurs post-match
Could
V2
FC-03
Évolution de la carte
la carte évolue avec l'historique (sessions jouées, notes reçues), gamification/collection
Could
V2
FC-04
Éditeur de terrain visuel
représentation graphique du terrain (5v5, 6v6...) avec positionnement des joueurs
Should
V1.5
FC-05
Génération auto des équipes
algorithme répartissant les inscrits en 2+ équipes équilibrées à partir des cartes/notes
Must
V1.5
FC-06
Ajustement manuel des équipes
glisser-déposer un joueur d'une équipe à l'autre après proposition auto
Should
V1.5
FC-07
Partage de la composition
export/partage de l'image des équipes générées vers le groupe WhatsApp/chat
Should
V1.5
FC-08
Historique des compositions
consulter les équipes des sessions passées
Could
V2

Le FiveComposer est un différenciateur fort face à WhatsApp. Aucun concurrent identifié dans l’analyse ne propose cette combinaison carte joueur + éditeur de terrain + équipes partageables. Le rendu est très partageable et potentiellement viral : une composition publiée dans un groupe fait connaître le produit. La carte joueur alimente l’algorithme d’équilibrage ; les deux idées forment donc un seul module en deux briques. 
Vigilance technique : l’équilibrage est un problème d’optimisation (« team balancing problem »). Version simple d’abord — tri par note puis répartition en serpentin — en V1.5 ; version avancée (poste, historique de coéquipiers) en V2+ seulement si la demande est confirmée.
2.3 Exigences non fonctionnelles
Domaine
Exigence cible
Test de réception
Performance
Écran principal < 2 s sur réseau 4G correct ; API p95 < 500 ms hors paiement.
Mesures Lighthouse / Sentry sur parcours critiques.
Disponibilité
Objectif 99,5 % mensuel sur les services critiques, hors maintenance annoncée.
Monitoring et page d’incident simple.
RGPD
Minimisation, consentement, droit d’accès/suppression, registre des traitements, DPA fournisseurs.
Revue des flux et test d’export/suppression.
Accessibilité
Contrastes, tailles, labels, navigation clavier web et lecteurs d’écran sur actions principales.
Audit manuel + tests automatisés.
Sécurité
RLS Supabase stricte, secrets côté serveur, rate limiting, journaux d’accès, sauvegardes.
Tests d’autorisation par rôle et revue de dépendances.
Paiements
Ne jamais stocker les cartes ; webhooks idempotents ; états transactionnels explicites.
Tests Stripe en mode test, rejouabilité et rapprochement.

2.4 Architecture technique proposée
Client : React Native / Expo pour mutualiser iOS, Android et une partie web. Backend : Supabase avec Postgres, Auth, Storage, Realtime et Row Level Security (RLS). Paiements : Stripe Connect pour les flux liés aux partenaires et événements ; RevenueCat pour l’abonnement Pass Leader. Opérations : Resend pour les emails, Sentry pour les erreurs, PostHog pour l’analytics produit, Vercel pour le web et Expo EAS pour les builds et distributions.
Décision d’architecture : conserver les règles métier sensibles (confirmation, remboursement, libération de place) dans des fonctions serveur transactionnelles et idempotentes. Realtime sert à l’actualisation d’interface, jamais à remplacer la source de vérité Postgres. Les images de cartes peuvent être rendues côté client pour le partage, avec une version serveur si la qualité ou la modération l’exige.
2.5 Roadmap V0 → V4
Version
Objectif
Périmètre / sortie attendue
V0 — preuve
Tester le problème avant de construire.
Prototype cliquable, landing page, 10 entretiens, groupe de Reims observé.
V1 — MVP
Créer et remplir une session fiable.
Comptes, groupes, événements, invitations, inscriptions déclaratives, notifications essentielles, partage WhatsApp ; pas de paiement réel.
V1.5 — monétisation + différenciation
Faire de la place payée une place réservée et proposer la composition.
Paiement/cagnotte conditionnelle, Pass Leader initial, FiveComposer : cartes, éditeur, équilibrage simple, ajustement et partage.
V2 — rétention
Augmenter la fréquence et l’ouverture locale.
Social plus riche, notation post-match modérée, évolution des cartes, découverte joueurs, récurrence avancée, partenaires pilotes.
V3/V4 — réseau
Passer du groupe local à la plateforme.
Tournois, merch, B2B, offres partenaires, expansion villes ; uniquement si la rétention et l’économie unitaire sont prouvées.

2.6 Les quatre parcours critiques
Créer un événement
Pass Leader ouvre son groupe → renseigne date, lieu, capacité et contribution → publie et partage le lien → suit les réponses et relance les indécis
Réserver et payer sa place
joueur ouvre le lien → voit coût total et règles d’annulation → paie sa contribution → reçoit confirmation ; à défaut de paiement dans le délai, la place suit la règle d’attente
Générer les équipes
organisateur ouvre FiveComposer → sélectionne nombre d’équipes et format → l’algorithme propose une répartition simple → organisateur ajuste puis partage l’image
Rejoindre un groupe
joueur ouvre invitation → crée/complète son profil minimal → accepte les règles et rejoint → voit les prochains événements

PARTIE 3 — Estimation de coût
3.1 Charge de développement
Estimation indicative en jours-homme (j/h), pour une équipe utilisant fortement Opus 5 comme accélérateur de conception, code, tests et documentation. Elle suppose un périmètre maîtrisé, un développeur responsable des décisions et une validation rapide par Sébastien, Iacob et Lucas. Sans Opus 5, la charge comparable est estimée à environ 208 j/h.
Lot
Avec Opus 5
Sans Opus 5
Cadrage, UX et architecture
10
18
Comptes, profils, groupes
16
28
Événements, invitations, listes
20
38
Notifications, partage et back-office
12
24
Paiement réel et règles de cagnotte
19
36
QA, sécurité, déploiement et marge
23
64
Total de référence
~110
~208

3.2 Impact des nouveaux modules
Lot
Charge avec Opus 5
Complexité
Commentaire
Carte joueur (génération + design)
+4 j/h
Moyenne
Beaucoup de design (templates de carte), peu de logique.
Notation collaborative post-match
+3 j/h
Moyenne
Nécessite modération anti-abus (notes de vengeance).
Éditeur de terrain visuel
+5 j/h
Moyenne-Élevée
Interface drag & drop.
Algorithme d’équilibrage simple
+3 j/h
Moyenne
Version serpentin, rapide avec Opus 5.
Algorithme d’équilibrage avancé
+8 j/h
Élevée
Reporté en V2 si demande confirmée.
Cagnotte conditionnant la réservation (délais, relances, libération auto)
+4 j/h
Moyenne-Élevée
S’ajoute au module paiement déjà chiffré.

Total ajouté ≈ +19 j/h en version simple. La charge V1.5 passe d’environ 70 j/h à ~89 j/h. Cela reste raisonnable et renforce la différenciation sur un marché sans leader, à condition de ne pas embarquer l’algorithme avancé avant de disposer de données et de retours.
3.3 Calendriers selon le régime de travail
Régime
Hypothèse
Délai de construction indicatif
Conditions
Soirs / week-ends
8 à 12 h/semaine
5 à 7 mois
Limiter le périmètre ; maintenir une démo toutes les deux semaines.
Mi-temps
18 à 22 h/semaine
3 à 4 mois
Une personne arbitre les décisions ; tests utilisateurs hebdomadaires.
Plein temps
35 à 40 h/semaine
8 à 12 semaines
Inclure QA, store review et corrections ; ne pas confondre vitesse et validation.

3.4 Coûts de lancement — année 1
Poste
Fournisseur
Coût
Périodicité
Commentaire
Apple Developer
Apple
99 €
Annuelle
Compte de publication iOS.
Google Play
Google
25 €
Unique
Inscription développeur Android.
Nom de domaine
Registrar
25–40 €
Annuelle
Prévoir renouvellement et DNS.
Supabase Pro
Supabase
0 → 25 $/mois
Mensuelle
Commencer au gratuit ; surveiller stockage et logs.
Vercel
Vercel
0 → 20 $/mois
Mensuelle
Hébergement web et previews.
Expo EAS
Expo
0 → 19 $/mois
Mensuelle
Builds et distribution mobile.
Resend
Resend
0 → 20 $/mois
Mensuelle
Emails transactionnels.
Sentry
Sentry
0 → 26 $/mois
Mensuelle
Erreurs et performance.
PostHog
PostHog
0 €
Selon usage
Analytics ; vérifier la configuration RGPD.
Google Maps/Places
Google
0 → 30 €/mois
Mensuelle
Mettre en cache agressivement et limiter les appels.
RevenueCat
RevenueCat
0 € jusqu’à 2 500 € de MediumTR
Selon usage
Abonnement Pass Leader.

Sous-total infra année 1 ≈ 150 à 1 400 €, hors commissions de paiement, taxes, éventuels dépassements et coûts de support.
3.5 Coûts juridiques et produit
Poste
Fourchette indicative
Pourquoi
CGU / CGV / politique de confidentialité
1 000–3 000 €
Paiements, contenus, responsabilités et rôles doivent être cohérents.
RGPD et contrats sous-traitants
1 000–4 000 €
Cartographier données, consentements, conservation et droits.
Marque INPI
190–500 € + classes/assistance
Sécuriser le nom avant de communiquer largement.
Design / Figma / tests
500–3 000 €
Système visuel, carte joueur et parcours mobile.
Assurance
300–1 200 €/an
Responsabilité professionnelle et cyber selon activité.

Alerte unit economics : les frais Stripe sur de petits montants, par exemple 10 €, pèsent lourd en pourcentage. Prévoir des frais de service explicites, ou regrouper certaines transactions lorsque le modèle et les règles le permettent. La transparence doit primer sur une tarification artificiellement basse.
3.6 Trois scénarios budgétaires
Scénario
Budget
Ce qu’il finance
Ce qu’il n’achète pas
Bootstrap
≈ 3 000 €
Outils, juridique minimal, design léger, crash-test piloté par l’équipe.
Une équipe salariée ; du support 7j/7 ; une marketplace nationale.
Version sérieuse
≈ 13 000 €
Juridique correct, UX, QA, infra, contenu, premiers partenariats et marge.
La preuve que l’acquisition sera rentable.
Externalisé
130–195 k€
Équipe produit complète, mobile/web, QA, pilotage et première exploitation.
L’adéquation produit-marché ; le risque commercial reste entier.

3.7 Modèle de revenus et seuil de rentabilité
Le modèle recommandé combine : freemium pour rejoindre une session ; frais de service sur paiement ; Pass Leader à 4,99 €/mois pour les organisateurs actifs ; commission partenaires sur la réservation de créneaux, qui constitue le vrai levier à moyen terme. Les fonctionnalités de composition peuvent rester incluses dans l’abonnement ou être visibles à tous pour maximiser l’effet viral.
Hypothèse de seuil de rentabilité initial : environ 250 utilisateurs actifs, répartis dans 20 groupes, avec un noyau d’organisateurs payants et une contribution partenaires progressive. Ce n’est pas une prévision ; c’est une cible de validation à recalculer avec les coûts de support, le churn, le panier moyen et les commissions réellement négociées.

PARTIE 4 — Recommandations
4.1 Les six décisions à trancher avant de coder
Décision
Question à fermer
Sortie attendue
Nom / marque
Le nom est-il disponible et prononçable ?
Recherche d’antériorité, domaine et décision écrite.
Périmètre V1
Quelle promesse doit fonctionner sans paiement ?
Backlog gelé et critères de sortie.
Modèle de paiement
Quand une place devient-elle réservée ?
Règle « paiement = place » et politique d’annulation.
Statut juridique
Qui facture, encaisse et porte les risques ?
Structure, compte bancaire et responsabilités.
Capital et vesting
Qui apporte quoi et sur quelle durée ?
Accord entre associés, vesting et décisions.
Cible du crash-test
Quel groupe, quelle ville, quelle métrique ?
Groupe de Reims, nombre de sessions et seuils de succès.

4.2 Plan des 90 premiers jours
Période
Actions
Mesure de sortie
Jours 1–15
Entretiens avec organisateurs et joueurs ; observation de 3 sessions ; décider nom, V0 et règles.
10–15 entretiens ; problème priorisé ; prototype de parcours.
Jours 16–30
Prototype cliquable ; test de création d’événement et inscription ; landing page.
5 tests modérés ; 20 pré-inscriptions locales.
Jours 31–60
Construire V0/V1 minimale ; connecter groupe de Reims ; instrumenter événements et activation.
3 sessions gérées ; taux de complétion ; retours qualitatifs.
Jours 61–90
Stabiliser ; tester récurrence et partage ; spécifier paiement et FiveComposer ; décider V1.5.
10 sessions ; rétention à 4 semaines ; décision go/no-go.

4.3 Matrice des cinq risques
Risque
Probabilité
Impact
Mitigation
1. Essoufflement de l’équipe
Élevée
Très élevé
Engagement hebdomadaire explicite, décisions écrites, scope réduit, règle de sortie et répartition claire.
2. Adoption insuffisante hors du groupe initial
Moyenne
Élevé
Mesurer activation et rétention ; tester une seconde communauté avant de généraliser.
3. Complexité du paiement / support
Moyenne
Élevé
Reporter le paiement réel en V1.5 ; états idempotents ; règles d’annulation lisibles.
4. Équilibrage contesté ou données biaisées
Moyenne
Moyen-élevé
Commencer par serpentin ; expliquer la proposition ; laisser l’ajustement manuel ; modérer les notes.
5. Risque juridique / données personnelles
Moyenne
Élevé
Avocat et revue RGPD avant paiement, minimisation des profils, suppression effective.

4.4 3 recommandations sur les nouvelles idées
    • Le FiveComposer + cartes joueurs est le meilleur différenciateur : unique dans l’analyse de marché et viral par nature. Priorité haute en V1.5, avec une première version simple et esthétique plutôt qu’un système de notation sophistiqué.
    • La cagnotte comme condition de réservation est plus cohérente qu’un wallet libre : elle simplifie la promesse produit (« tu payes ta place, elle est réservée ») et limite les soldes dormants et la complexité comptable.
    • Ne pas tout charger sur le crash-test initial du groupe de Reims. Le FiveComposer peut être la feature qui déclenche le passage en V1.5, pas un prérequis de la V0/V1.
4.5 Avis critique honnête sur le projet
Le projet répond à une demande réelle, fréquente et suffisamment émotionnelle pour créer de la rétention : personne ne veut arriver à six joueurs, avancer 120 € ou refaire les équipes dans l’urgence. Le point fort est l’ancrage dans un groupe existant, qui permet d’observer un usage sans acheter immédiatement de l’acquisition.
Le risque principal n’est pas de savoir construire l’application ; c’est de maintenir une cadence à trois, de convaincre les organisateurs de changer une habitude gratuite et de transformer une feature séduisante en usage récurrent. WhatsApp restera présent. Il faut donc gagner sur le résultat — session confirmée, argent clair, équipes prêtes — et non sur la quantité de fonctionnalités. La recommandation est un lancement étroit à Reims, des métriques simples, puis une extension seulement après preuve de répétition.

SYNTHÈSE EN UNE PAGE
Décision proposée : valider une V0/V1 très resserrée sur les groupes et événements, puis investir en V1.5 dans le paiement conditionnel et le FiveComposer lorsque la répétition d’usage est démontrée.
Thème
Résumé opérationnel
Marché
1,5 à 2,5 M de pratiquants estimés ; marché fragmenté ; aucun leader logiciel.
Positionnement
L’outil de la session complète : créer, remplir, payer, composer, partager.
Différenciation
FiveComposer : cartes joueur, terrain visuel, équipes équilibrées et partageables ; très visible et viral.
Modèle
Freemium, frais de service, Pass Leader 4,99 €/mois, commission partenaires comme levier principal.
Stack
React Native / Expo ; Supabase ; Stripe Connect ; RevenueCat ; Resend ; Sentry ; PostHog ; Vercel ; Expo EAS.
Charge dev
Référence ~110 j/h avec Opus 5 contre ~208 j/h sans ; V1.5 avec FiveComposer simple ~89 j/h.
Budget an 1
Infra ≈ 150–1 400 € ; scénarios globaux ≈ 3 000 €, 13 000 € ou 130–195 k€.
Seuil de rentabilité
Cible de travail : environ 250 utilisateurs actifs / 20 groupes.
Risque n°1
Essoufflement de l’équipe ; cadence, scope et vesting à décider avant code.
Prochaine action
Sous 15 jours : entretiens + observation du groupe de Reims, prototype, six décisions fermées.

Conclusion : construire moins, mesurer plus, et réserver le budget de différenciation au FiveComposer quand le noyau organisationnel fonctionne.
