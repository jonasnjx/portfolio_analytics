# portfolio_analytics

Event pipeline and analytics backend for Jonas Ng's portfolio. Tracks visitor interactions across the 3D room and classic site, aggregates them via Upstash QStash and Redis, and exposes a stats API for the public dashboard.

## Architecture

```
  portfolio_site (browser)
          |
   POST /track  (fire-and-forget via sendBeacon)
          |
  ┌───────▼────────┐
  │  /api/track     │
  │  validate event │
  │  rate limit IP  │
  └───────┬────────┘
          │  publish
          ▼
  Upstash QStash
          │  deliver webhook
          ▼
  ┌───────▼────────┐
  │  /api/consume   │
  │  verify sig     │
  │  incr Redis     │
  └───────┬────────┘
          │
  Upstash Redis  (pa: namespace, shared db)
          │
   GET /stats
          │
  /dashboard page (portfolio_site)
```

## Endpoints

- `POST /track` — receives events from portfolio_site, publishes to QStash
- `POST /consume` — QStash webhook, increments Redis counters
- `GET /stats` — returns aggregated analytics JSON (cached 30s)
- `GET /health` — `{ status: "ok" }`

## Events tracked

| Event | When |
|---|---|
| `page_view` | Classic site page loads |
| `room_enter` | Visitor enters the 3D room |
| `object_interact` | Any 3D object clicked |
| `baymax_ask` | Question sent to AI assistant |
| `character_switch` | Avatar changed |

## Setup

```bash
npm install
cp .env.example .env
# Fill in keys from Upstash + QStash dashboards
vercel dev
```

## Environment variables

```
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CONSUME_URL=https://your-deployment.vercel.app/consume
IP_SALT=any-random-string
```

- QStash keys: https://console.upstash.com (QStash tab)
- Redis keys: https://console.upstash.com (Redis tab, same db as portfolio_ai_assistant)
- Set CONSUME_URL after first deploy

## Deployment

```bash
vercel --prod
```

Set all env vars in Vercel project settings. After first deploy, update CONSUME_URL to the production URL and redeploy.

## Notes

- All analytics keys use `pa:` prefix to avoid collision with `assistant:` keys in the shared Redis db
- Events are fire-and-forget. Counts are approximate (no retry on failure by design)
- Upstash QStash is used instead of Kafka for serverless compatibility
