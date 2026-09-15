# BAARO — Audit identité unique `user_id`

## Règle canonique
`auth.users.id` est l'identifiant unique d'un utilisateur.

Il est réutilisé comme :
- `profiles.user_id` (PK/FK)
- `wallets.user_id` (PK/FK) — aucun `wallet_id`
- `crypto_holdings.user_id` (PK/FK)
- `follows.follower_id` / `follows.followed_id`
- `posts.author_id`, `messages.sender_id`, `messages.recipient_id`, etc. selon les tables.

## Nettoyé
- `src/usersData.js` : supprimé. Il contenait des utilisateurs fictifs `u_amina`, `u_kenji`, etc. et ne doit pas servir d'identité sociale.
- `FriendsTab.jsx` : ne consulte plus `usersData.js`; il charge les profils par `profiles.user_id`.
- `useSocial.js` : le suivi passe par `toggle_follow` avec le vrai `user_id`.
- `FollowButton.jsx` : utilise déjà `toggle_follow` avec `targetUserId` correspondant au `user_id` Supabase.
- `supabaseClient.js` : toutes les fonctions sociales utilisent le UUID `auth.users.id`.

## À ne pas supprimer
- `src/data/users.js` : fallback vide utilisé par `GlobalSearchModal.jsx`; il ne contient aucun identifiant fictif et peut rester.
- `supabase/legacy/*` : archives historiques SQL; elles utilisent déjà `user_id` comme identifiant utilisateur. Ne pas exécuter ces archives comme nouvelles migrations.
- `supabase/migrations/014_follow_column_compatibility.sql` : migration historique qui nettoie l'ancien nom `following_id` vers `followed_id`. Elle ne crée pas un nouvel identifiant utilisateur.

## Wallet
Le modèle actuel est déjà correct :
`wallets.user_id` est la clé primaire et référence `auth.users.id`.

Il ne faut PAS créer `wallet_id` pour identifier l'utilisateur.

Une éventuelle adresse blockchain/on-chain reste techniquement une adresse de portefeuille, mais ce n'est pas l'identité BAARO. Elle doit être rattachée au même `user_id` si elle est ajoutée plus tard.

## Migration
Exécuter `supabase/migrations/034_single_user_id_identity.sql` après les migrations existantes.
