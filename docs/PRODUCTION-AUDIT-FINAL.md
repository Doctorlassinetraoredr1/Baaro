# BAARO — audit final et corrections

## Corrigé dans ce patch
- Profil: RLS INSERT/UPDATE propriétaire + persistance DB.
- Abonnements: `toggle_follow` sécurisé et cohérent avec `status=accepted`.
- Amis: RPC `send_friend_request` pour éviter l'UPSERT bloqué par la RLS receiver-only.
- Messages: RLS lecture/envoi/update/delete et garde-fou des identités; le client d'envoi existant fournit déjà `recipient_id`.
- Publications/commentaires: UPDATE/DELETE propriétaire.
- Likes/favoris/partages: tables, contraintes, RLS et index manquants.
- Sondages posts: tables, RLS et RPC atomique de vote.
- Stories: réactions et sondages persistants + RLS.
- Paramètres: `user_settings` persistant + RLS.
- Préférences notifications: RLS vérifiée.
- Wallet: endpoint `/api/wallet` aligné sur les RPC sécurisés (`status`, `earn`, `redeem`, `convert`); les montants de récompense sont décidés côté serveur.
- Cadeaux: route alignée sur `wallet_send_gift(room_id, gift_type_id)` et filtre realtime corrigé.
- Payout/retrait cash: explicitement désactivé, sans débit de wallet, tant que le provider n'est pas configuré.
- Check de production: chemin du document de sécurité corrigé.

## Vérifications locales
- `node scripts/check-production.mjs` → OK.
- `node scripts/check-e2e-readiness.mjs` → OK.
- `node scripts/security-audit-scan.mjs` → aucun échec automatique; les marqueurs restants sont des revues de sécurité attendues (service role, URLs publiques, anciennes migrations).
- Syntaxe Node vérifiée sur les fichiers JS/MJS concernés. Les fichiers JSX/TSX nécessitent le build Vite.

## À faire sur l'environnement réel avant production
1. Exécuter `supabase/migrations/035_production_final_persistence.sql`.
2. Configurer `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` côté serveur et `ALLOWED_ORIGINS`.
3. Lancer `npm ci` puis `npm run build` dans CI/Vercel.
4. Tester avec deux comptes: profil, follow/unfollow, demande ami/acceptation/refus, messages, likes/commentaires/publications.
5. Tester wallet: bonus quotidien, récompenses liées à un événement, conversion; vérifier qu'un double appel ne crédite pas deux fois.
6. Vérifier les webhooks de paiement et garder le payout désactivé jusqu'à validation provider.
7. Vérifier les buckets Storage: toute URL publique doit être intentionnelle.
