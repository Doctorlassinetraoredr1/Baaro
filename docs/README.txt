BAARO API — plafond 12 endpoints (actuel: 10)
ID: api12-20260917T223125Z-546e3875

Endpoints (fichiers api/*.js hors _shared) :
  1. ai.js
  2. chat.js
  3. live.js
  4. payments.js
  5. payout.js          (+ ancien stripe-redeem via rewrite)
  6. referral.js        (+ invites groupe via GET ?code=)
  7. register-device.js
  8. translate.js
  9. wallet.js
 10. webhooks.js

Supprimés / fusionnés :
  - api/stripe-redeem.js → /api/payout
  - api/invite.js        → /api/referral?code=

Rewrites vercel.json :
  /api/invite/:code  → /api/referral?code=:code
  /api/stripe-redeem → /api/payout

InvitePage peut garder fetch('/api/invite/CODE') grâce au rewrite.
Slots libres : 2 (max 12).
