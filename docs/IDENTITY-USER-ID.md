# BAARO — Identifiant utilisateur unique

## Règle (plus de `user_id` comme identité)

L'identifiant utilisateur canonique est **`auth.users.id` (UUID Supabase Auth)**.

Dans les tables d'identité :
- `profiles.id` = `auth.users.id`
- `wallets.id` = `auth.users.id`
- `crypto_holdings.id` = `auth.users.id`

Dans les relations (FK) :
- `posts.author_id`, `messages.sender_id` / `recipient_id`
- `follows.follower_id` / `followed_id`
- likes, réactions, notifications, groupes, vidéos, ledger…  
  (ces colonnes peuvent s'appeler `user_id`, `author_id`, `sender_id` — ce sont des **clés étrangères**, pas l'identité de base)

**Interdit comme clé relationnelle :**
- email, username/handle, display_name, device id, ID généré côté navigateur

## Migration obligatoire

Exécuter `supabase/migrations/037_rename_user_id_to_id.sql` pour supprimer définitivement les colonnes `user_id` des tables d'identité.
