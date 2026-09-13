# BAARO Master Upgrade v2 — Production checklist

## Added in v2
- Content moderation queue for post/story/comment/profile/message/video reports.
- Notification `read_at` and unread index.
- Feed event telemetry for impressions, opens, watches, completions, likes, comments, shares, saves and hides.
- Authenticated RPCs for feed events and notification read state.
- Story expiration index and expiry-window validation.
- Realtime notification publication.
- Client helper `src/lib/feedEvents.js`.

## What "100%" still requires
No code bundle can honestly guarantee production readiness without executing it against the real BAARO environment.

Before release:
1. Apply migrations to staging first.
2. Run `npm run build`.
3. Run `npm run audit:security`.
4. Run `npm run check:production`.
5. Run `npm run check:e2e` and `npm run check:e2e-smoke`.
6. Verify Supabase RLS as anonymous/user/owner/moderator.
7. Test Stories: text/photo/video/poll, upload failures, expiration and Realtime.
8. Test Social: feed pagination, reactions, shares, saves, reposts, comments, mentions and notifications.
9. Test Video: autoplay policy, pause/resume, view events and poor-network recovery.
10. Test Live: join/leave, permissions, co-hosts, moderation and disconnect recovery.
11. Test Android push notifications and background behavior.
12. Test payments/payouts and anti-fraud separately in sandbox/staging.
13. Run load tests on feed, Realtime, Stories and Live-related endpoints.
14. Monitor errors, latency, storage usage and database query performance after release.

The existing application scripts already expose several of these checks; this pack does not pretend they have passed until they are actually executed.
