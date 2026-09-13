# BAARO Master Upgrade v3

Cette version renforce la version v2 sur trois axes :

1. **Notifications** — composant React prêt à brancher, compteur non-lues, temps réel et marquage en lu via RPC sécurisé.
2. **Modération** — RPC de signalement qui utilise `auth.uid()` côté serveur et limite les champs envoyés.
3. **Production / validation** — index supplémentaires et script qui vérifie les fichiers critiques et la limite de 12 fichiers dans `api/` si ce dossier existe.

## Intégration

- Exécuter les migrations dans l'ordre `017 → 018 → 019` après vérification de l'état réel de la base.
- Ajouter `NotificationCenter.jsx` dans le header/navigation.
- Utiliser `reportContent()` pour les boutons Signaler.
- Lancer `node scripts/validate_upgrade.mjs /chemin/du/repo`.

## Important

Ce pack est une **couche d'amélioration**, pas une preuve de production à 100 %. Le dépôt réel n'a pas pu être modifié directement depuis cette session et le build complet n'a donc pas été exécuté sur ton checkout réel. Avant mise en ligne : migration Supabase sur environnement de staging, `npm run build`, tests E2E, contrôle RLS, puis déploiement progressif.

Aucune virtualisation n'est ajoutée.
