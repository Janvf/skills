// Fetches a brand's ads from the Meta Ad Library through an Apify actor and
// normalises them into the small shape the app renders.

import { MOCK_ITEMS } from './mock-data.js';

const DAY = 864e5;
const CACHE_TTL = 6 * 60 * 60 * 1000; // Ad Library data barely moves within a few hours
const cache = new Map();

export const COUNTRIES = ['ALL', 'US', 'GB', 'BE', 'NL', 'FR', 'DE', 'ES', 'IT', 'CA', 'AU'];

export class SearchError extends Error {
  constructor(message, status = 500) { super(message); this.status = status; }
}

// A query can be a brand name, a Facebook page URL or a full Ad Library URL.
export function buildStartUrl(q, country) {
  if (/^https?:\/\/(www\.|m\.)?facebook\.com\//i.test(q)) return q;
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country,
    q,
    search_type: 'keyword_unordered',
    media_type: 'all',
  });
  return `https://www.facebook.com/ads/library/?${params}`;
}

export async function searchAds({ q, country = 'ALL', limit = 60, now = Date.now() }) {
  q = String(q || '').trim();
  if (!q) throw new SearchError('Type a brand name, Facebook page or Ad Library link.', 400);
  if (q.length > 300) throw new SearchError('That search is too long.', 400);
  country = COUNTRIES.includes(String(country).toUpperCase()) ? String(country).toUpperCase() : 'ALL';
  limit = Math.min(Math.max(parseInt(limit, 10) || 60, 10), 200);

  const mock = process.env.RIVL_MOCK === '1';
  const key = JSON.stringify([q.toLowerCase(), country, limit, mock]);
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL) return { ...hit.result, cached: true };

  const raw = mock ? MOCK_ITEMS : await runActor(buildStartUrl(q, country), limit);
  const ads = dedupe(raw.map((item) => normalizeAd(item, now)).filter(Boolean));
  const result = { query: q, country, mock, fetchedAt: new Date(now).toISOString(), ...summarize(ads), ads };
  cache.set(key, { at: now, result });
  return { ...result, cached: false };
}

async function runActor(startUrl, limit) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new SearchError('The server has no APIFY_TOKEN set. Add it to .env (local) or the hosting environment variables.', 500);
  const actor = (process.env.APIFY_ACTOR || 'apify/facebook-ads-scraper').replace('/', '~');
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=110&clean=true`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ startUrls: [{ url: startUrl }], resultsLimit: limit }),
      signal: AbortSignal.timeout(115_000),
    });
  } catch (err) {
    throw new SearchError(err.name === 'TimeoutError'
      ? 'The Ad Library took too long to answer. Try again, or lower the number of ads.'
      : 'Could not reach Apify. Check the server\'s internet access.', 504);
  }
  if (!res.ok) {
    // Apify errors look like {"error":{"type":"...","message":"..."}}; anything else came from a proxy in between.
    const text = await res.text().catch(() => '');
    let apifyMessage = '';
    try { apifyMessage = JSON.parse(text)?.error?.message || ''; } catch {}
    if (res.status === 401) throw new SearchError('Apify rejected the API token. Check APIFY_TOKEN.', 502);
    if (res.status === 402) throw new SearchError('The Apify account is out of credit.', 502);
    throw new SearchError(apifyMessage
      ? `Apify: ${apifyMessage}`
      : `The request to Apify was blocked (HTTP ${res.status}). Check that the server can reach api.apify.com.`, 502);
  }
  const items = await res.json();
  return Array.isArray(items) ? items.filter((i) => !i.error && !i.errorMessage) : [];
}

const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== '');
const hasTemplate = (s) => typeof s === 'string' && /\{\{[^}]+\}\}/.test(s);
const clean = (s) => (typeof s === 'string' && !hasTemplate(s) ? s.trim() : '');

export function normalizeAd(item, now = Date.now()) {
  const id = String(pick(item.adArchiveID, item.adArchiveId, item.ad_archive_id, '') || '');
  if (!id) return null;
  const s = item.snapshot || {};
  const cards = Array.isArray(s.cards) ? s.cards : [];
  const card = cards[0] || {};

  const start = toMs(pick(item.startDate, item.start_date)) ?? Date.parse(item.startDateFormatted);
  const end = toMs(pick(item.endDate, item.end_date)) ?? Date.parse(item.endDateFormatted);
  const isActive = item.isActive !== false;
  const until = isActive || !Number.isFinite(end) ? now : end;
  const daysRunning = Number.isFinite(start) ? Math.max(1, Math.round((until - start) / DAY)) : null;

  const images = [...(s.images || []), ...cards]
    .map((i) => pick(i.originalImageUrl, i.resizedImageUrl, i.original_image_url, i.resized_image_url))
    .filter(Boolean);
  const vid = (s.videos || [])[0] || (cards.find((c) => c.videoHdUrl || c.videoSdUrl) ?? null);
  const video = vid && pick(vid.videoHdUrl, vid.videoSdUrl)
    ? { src: pick(vid.videoHdUrl, vid.videoSdUrl), poster: pick(vid.videoPreviewImageUrl, images[0]) || null }
    : null;

  const fmt = String(s.displayFormat || '').toUpperCase();
  const format = video || fmt === 'VIDEO' ? 'Video' : cards.length > 1 || fmt === 'CAROUSEL' ? 'Carousel' : fmt === 'DPA' || fmt === 'DCO' ? 'Catalog' : 'Image';

  return {
    id,
    pageId: String(pick(item.pageID, item.pageId, s.pageId, '') || ''),
    pageName: pick(item.pageName, s.pageName, 'Unknown page'),
    pageAvatar: pick(s.pageProfilePictureUrl, null),
    body: clean(s.body?.text ?? s.body) || clean(card.body),
    title: clean(s.title) || clean(card.title),
    cta: clean(s.ctaText) || clean(card.ctaText),
    link: pick(s.linkUrl, card.linkUrl, null),
    format,
    image: images[0] || null,
    imageCount: images.length,
    video,
    platforms: (item.publisherPlatform || item.publisher_platform || []).map((p) => String(p).toUpperCase()),
    isActive,
    startedAt: Number.isFinite(start) ? new Date(start).toISOString() : null,
    daysRunning,
    variants: Math.max(1, Number(pick(item.collationCount, 1)) || 1),
    collationId: pick(item.collationID, item.collationId, null),
    libraryUrl: `https://www.facebook.com/ads/library/?id=${encodeURIComponent(id)}`,
  };
}

function toMs(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n; // Apify returns Unix seconds
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

// Meta groups near-identical ads into a "collation"; keep one card per group.
function dedupe(ads) {
  const seen = new Set();
  return ads.filter((a) => {
    const k = a.collationId || a.id;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function summarize(ads) {
  const pages = new Map();
  for (const a of ads) {
    const p = pages.get(a.pageName) || { name: a.pageName, avatar: a.pageAvatar, ads: 0 };
    p.ads += 1;
    pages.set(a.pageName, p);
  }
  const formats = {};
  for (const a of ads) formats[a.format] = (formats[a.format] || 0) + 1;
  const topFormat = Object.entries(formats).sort((x, y) => y[1] - x[1])[0];
  const longest = ads.reduce((m, a) => (a.daysRunning > (m?.daysRunning ?? -1) ? a : m), null);
  const recent = ads.filter((a) => a.daysRunning !== null && a.daysRunning <= 7).length;
  return {
    pages: [...pages.values()].sort((x, y) => y.ads - x.ads),
    stats: {
      total: ads.length,
      newThisWeek: recent,
      longestDays: longest?.daysRunning ?? null,
      topFormat: topFormat ? { name: topFormat[0], share: Math.round((topFormat[1] / ads.length) * 100) } : null,
    },
  };
}
