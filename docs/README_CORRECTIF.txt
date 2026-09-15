BAARO — correctif ciblé profil / abonnements / amis

Fichiers corrigés :
- src/features/friends/FollowButton.jsx
- src/features/friends/FriendsTab.jsx
- src/hooks/useProfile.js
- supabase/migrations/013_profile_social_fix.sql

IMPORTANT :
1. Remplacer les fichiers JS/JSX correspondants dans le projet.
2. Exécuter 013_profile_social_fix.sql dans Supabase SQL Editor.
3. Redémarrer/rebuilder l'application.

Aucune autre fonctionnalité de BAARO n'est incluse dans ce correctif.
