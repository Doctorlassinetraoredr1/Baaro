# BAARO — User ID unique

## Règle
L'identifiant utilisateur canonique est **`auth.users.id` (UUID Supabase Auth)**.

À utiliser dans toutes les relations: `profiles.user_id`, `wallets.user_id`, `posts.author_id`,
`messages.sender_id/recipient_id`, `follows.follower_id/followed_id`, likes, réactions,
notifications, groupes, vidéos, wallet ledger, etc.

Ne jamais utiliser comme clé relationnelle:
- email
- username/handle
- display_name
- device id
- identifiant généré côté navigateur

Les UUID `id` propres aux objets (post, message, transaction, etc.) restent normaux: ils identifient
l'objet, pas l'utilisateur.
