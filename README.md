# BAARO — Social Complete v2

Ce pack termine le chantier Social sans virtualisation.

## Inclus
- Sondages fonctionnels : création, 2–6 choix, vote, changement de vote, résultats.
- Réactions avancées : ❤️ 😂 😮 😢 😡 🤝.
- Favoris/enregistrements.
- Partages persistants avec compteur réel.
- Notifications sociales enrichies + realtime.
- Abonnements : suivre/ne plus suivre.
- Suggestions de comptes basées sur abonnements/mutualité + audience.
- Score de fil intelligent côté Supabase (`social_feed_score`).
- Anti-spam serveur sur les principales interactions.
- Indexes pour le feed et les interactions.
- Aucun nouveau fichier dans `api/`.

## Installation
1. Appliquer `supabase/migrations/013_social_complete.sql` dans Supabase.
2. Copier `src/features/feed/SocialEnhancements.jsx`.
3. À la racine du projet, exécuter :
   `node scripts/apply_social_complete.mjs`
4. Vérifier :
   `npm run build`
   `npm run check:production`

Le script crée d'abord `FeedTab.jsx.social-complete.bak`.
Le pack ne supprime aucune fonctionnalité Live, Marketplace, IA ou autre.
