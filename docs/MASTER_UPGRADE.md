# BAARO — Master Upgrade

## Déjà préparé dans ce pack

### Social
- sondages
- réactions
- bookmarks
- partages
- notifications sociales
- suggestions
- score du feed
- rate limiting social
- réponses aux commentaires
- hashtags / mentions
- reposts
- tendances

### Stories
- texte
- photo
- vidéo
- sondage
- texte sur média
- réactions
- vues
- progression
- pause/reprise
- expiration 24 h
- Realtime
- stockage Supabase

### Nouvelle couche
- `video_views`
- statistiques de visionnage
- score de découverte vidéo
- composant `DiscoverHub.jsx`

## Ce qui doit encore être vérifié dans le dépôt réel avant de dire « 100 % production »

1. Appliquer les migrations sur un projet Supabase de staging.
2. Vérifier toutes les RLS avec un compte anonyme, un utilisateur et un propriétaire.
3. Intégrer les composants dans les vrais onglets/routes BAARO.
4. Vérifier les noms exacts des colonnes et fonctions déjà présents.
5. Exécuter `npm run build`.
6. Exécuter `npm run audit:security`.
7. Exécuter `npm run check:production`.
8. Exécuter `npm run check:e2e` et `npm run check:e2e-smoke`.
9. Tester upload photo/vidéo sur Android.
10. Tester Realtime, hors-ligne/réseau faible et reprise.
11. Vérifier les limites Storage et les politiques de fichiers.
12. Vérifier les flux de paiement/retrait et l'anti-fraude séparément.
13. Vérifier les Live Daily.co en conditions réelles.
14. Vérifier les notifications push sur Android.
15. Faire un test de charge sur les chemins Realtime/feed.

## Règle

Ce pack ne supprime pas les fonctionnalités existantes et n'introduit pas de virtualisation.
