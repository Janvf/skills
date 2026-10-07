# Rivl

Competitor analysis for Meta ads. Type a brand, see every ad they run, ranked by how long they've kept paying for it.

## What's here

| Path | What it is |
|---|---|
| `public/index.html` | Landing page |
| `public/app.html`, `public/app.js` | Search page: type a brand, see their live ads |
| `public/rivl.css` | Shared styles and brand tokens |
| `api/ads.js` | `GET /api/ads?q=nike&country=ALL` serverless function (Vercel) |
| `lib/ads.js` | Calls the Apify actor, normalises results, caches for 6 hours |
| `lib/mock-data.js` | Demo data for working without Apify credit |
| `server.js` | Zero-dependency local dev server |

No npm dependencies. Node 18.17+.

## Run locally

```bash
cp .env.example .env        # then paste your Apify token into APIFY_TOKEN
npm run dev                 # http://localhost:3000, real searches
npm run dev:mock            # demo data, no Apify calls
npm test
```

Behind a corporate or sandbox HTTPS proxy, start Node with `NODE_USE_ENV_PROXY=1` (Node 22.21+) so `fetch` uses `HTTPS_PROXY`.

## Deploy (Vercel)

1. Import the repo in Vercel. No framework, no build command.
2. Add the environment variable `APIFY_TOKEN`.
3. Deploy. `vercel.json` serves `public/` and gives the API function up to 120 s, which a big brand's first search can need.

## Data source

A keyword search (`?q=nike`) returns every advertiser whose ads mention the word, so the page preselects the best-matching Facebook page and offers a page report (`?q=Nike&page=<page id>`) with only that page's ads.

Ads come from the public Meta Ad Library through the Apify actor `apify/facebook-ads-scraper` (override with `APIFY_ACTOR`). Each search costs roughly $0.20 per 60 ads at Apify's listed rates. Results are cached in memory per server instance for 6 hours; move this to a database (e.g. Supabase) before launch so repeat searches stay free and history builds up.

Image and video links from Meta expire after a while. To keep creatives, copy them to your own storage when you fetch them.

## Brand system
- **Name / mark:** `rivl`, two overlapping rounded cards (you and your rival), the front one in signal orange.
- **Colour:** cool off-white paper, near-black ink, one accent (`#FF5B14`) used sparingly. Full dark mode.
- **Type:** Bricolage Grotesque (display, tight tracking), Geist (body), Geist Mono (data and labels).
- **Signature visual:** a fanned hand of Meta ad cards in the hero; each card shows run length and variant count.
