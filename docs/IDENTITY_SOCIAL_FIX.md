# BAARO — correctif identité / profil / social

Identité utilisateur unique : `auth.users.id`.

- `profiles.user_id` = `auth.users.id`
- `wallets.user_id` = `auth.users.id`
- `follows.follower_id` / `follows.followed_id` = `auth.users.id`
- aucune adresse wallet blockchain n'est utilisée comme identifiant utilisateur
- `follows.id`, `posts.id`, etc. restent des identifiants de relations/contenus et ne sont pas des identifiants utilisateur.

La migration 034 normalise aussi l'ancien `following_id` vers `followed_id`.
