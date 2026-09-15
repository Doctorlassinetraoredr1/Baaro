# BAARO — correctif identité / profil / social

**Plus de `user_id` comme identité principale.**

- `profiles.id` = `auth.users.id`
- `wallets.id` = `auth.users.id`
- `crypto_holdings.id` = `auth.users.id`
- `follows.follower_id` / `follows.followed_id` = `auth.users.id`
- aucune adresse wallet blockchain n'est utilisée comme identifiant utilisateur

Les UUID d'objets (`posts.id`, `follows.id`, etc.) restent des identifiants de contenu/relation.

Migration 034 : normalise `following_id` → `followed_id`  
Migration 037 : renomme `user_id` → `id` sur profiles / wallets / crypto_holdings
