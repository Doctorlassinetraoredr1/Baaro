# BAARO — Brancher tous les composants orphelins

## Résumé

| Module | Branché comment |
|--------|-----------------|
| **Entreprises** | Nouvel `EnterprisesTab.jsx` → onglet `companies` (CompanyCard, Detail, Registration, Manager, EmptyState) |
| **Communauté** | `CommunityTab` → onglet `community` (Plus) |
| **Amis** | `friends` dans menu Plus → `FriendsTab` |
| **Découvrir** | `DiscoverHub` → onglet `discover` |
| **Confidentialité** | `PrivacyPage` → route `/privacy` + onglet `privacy` + réglages |
| **Invite** | `InvitePage` → route `/invite/:code` |
| **Shop produits** | `ProductForm` + `ImageUpload` dans gestion boutique ; `ShopReviews` dans détail boutique ; `ConfirmDialog` suppression |
| **Sondages** | `PollComposer` dans composeur du fil ; `PollDisplay` ré-exporté |
| **Vidéos** | `VideoTranslateControls` sous chaque vidéo |
| **Shop props** | `ShopTab` accepte `id` ou `userId` |

## Fichiers à copier dans le repo

```
src/app/tabs.jsx
src/app/App.jsx
src/app/MainShell.jsx
src/components/Navigation.jsx
src/components/EnterprisesTab.jsx   ← NOUVEAU
src/features/shop/ShopTab.jsx
src/features/shop/ShopFeature.jsx
src/features/shop/components/ShopDetail.jsx
src/features/feed/FeedTab.jsx
src/features/feed/SocialEnhancements.jsx
src/features/settings/index.tsx
src/features/videos/VideosTab.jsx
```

Les composants déjà présents (`Company*`, `CommunityTab`, `DiscoverHub`, `PrivacyPage`, `Poll*`, `ProductForm`, `ImageUpload`, `ShopReviews`, `ConfirmDialog`, `InvitePage`, `EmptyState`, `VideoTranslateControls`) ne sont **pas** recréés — seulement branchés.

## Après copie

```bash
npm run build
npm run check:production
```

## Navigation (menu Plus)

Découvrir · Entreprises · Communauté · Amis · BARO · Portefeuille · Hors-ligne · IA · Réglages
