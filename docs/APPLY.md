# BAARO — Fichiers corrigés (sans régression)

Appliquer ces fichiers **par-dessus** ton dépôt GitHub `ltraoredr1/Baaro`.

## Contenu

```
baaro-fixes/
├── APPLY.md                          ← ce guide
├── README.md                         → racine du projet
├── vercel.json                       → racine
├── vite.config.js                    → racine
├── src/main.jsx                      → src/main.jsx
├── .github/workflows/ci.yml          → .github/workflows/ci.yml (créer le dossier)
├── supabase/migrations/
│   ├── 044_shop_items_cart.sql       ← remplace le fichier "044" sans extension
│   └── 046_messaging_improvements.sql← remplace supabase-add-messaging-improvements.sql
└── docs/notes/
    └── systeme-abonnement-etat.md    ← notes déplacées hors migrations/
```

## Étapes

1. **Supprimer** dans ton repo (s’ils existent encore) :
   - `supabase/migrations/044` (sans `.sql`)
   - `supabase/migrations/Système abonnement corriger`
   - `supabase/migrations/supabase-add-messaging-improvements.sql`

2. **Copier** les fichiers de ce pack aux mêmes chemins dans le projet.

3. Vérifier :

```bash
npm run check:production
npm run audit:security
npm run build
```

4. Commit :

```bash
git add README.md vercel.json vite.config.js src/main.jsx \
  .github/workflows/ci.yml \
  supabase/migrations/044_shop_items_cart.sql \
  supabase/migrations/046_messaging_improvements.sql \
  docs/notes/
git status
git commit -m "chore: fix migrations names, vercel rewrites, PWA icons, CI — no product regression"
git push
```

## Ce qui change (résumé)

| Fichier | Correction |
|---------|------------|
| `vercel.json` | Rewrites paiement → `/api/payments` et `/api/webhooks` (routes réelles) ; SPA n’intercepte plus `/api/*` ; headers de base |
| `vite.config.js` | Icônes PWA alignées sur `/icon-192.png` et `/icon-512.png` |
| `src/main.jsx` | Pas de double enregistrement service worker |
| Migrations | Noms valides `.sql` + ordre numérique |
| `ci.yml` | Pipeline install + checks + build |
| `README.md` | Documentation produit à jour |

Aucune logique wallet, feed, live, marketplace ou IA n’a été modifiée.
