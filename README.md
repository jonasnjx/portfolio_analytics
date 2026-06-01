# portfolio_analytics

Event pipeline and analytics backend for my portfolio site. Tracks visitor interactions across the 3D room and classic site, aggregates them via Upstash QStash and Redis, and exposes a stats API for the public dashboard.

## Architecture

```
  Visitor clicks something on portfolio_site
          |
          | Browser sends POST /track in the background
          | 
          |
  ┌───────▼──────────────────────────────┐
  │  /api/track                           │
  │  - Reject unknown event types         │
  │  - Block IPs sending too many events  │
  │  - Hand event to QStash queue         │
  └───────┬──────────────────────────────┘
          |
          | QStash holds the event and
          | calls /api/consume automatically
          |
  ┌───────▼──────────────────────────────┐
  │  /api/consume                         │
  │  - Confirm request came from QStash   │
  │  - Add 1 to the right Redis counter   │
  └───────┬──────────────────────────────┘
          |
  Upstash Redis stores all the counters
  (pa:total:room_enter, pa:obj:resume ...)
          |
          | Dashboard page calls GET /stats
          | every 30 seconds
          |
  /dashboard page reads the totals
  and displays them with Chart.js
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

- Upstash QStash is used instead of Kafka for serverless compatibility
