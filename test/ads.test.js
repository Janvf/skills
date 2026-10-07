import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAd, buildStartUrl, summarize, searchAds } from '../lib/ads.js';

const NOW = Date.parse('2026-10-07T12:00:00Z');

// Shape copied from the Apify facebook-ads-scraper output.
const apifyItem = {
  adArchiveID: '1785179045778580',
  pageID: '721404351056614',
  pageName: 'Nike',
  isActive: true,
  startDate: Date.parse('2026-06-17T07:00:00Z') / 1000,
  endDate: Date.parse('2026-10-06T07:00:00Z') / 1000,
  publisherPlatform: ['FACEBOOK', 'INSTAGRAM'],
  collationCount: 9,
  collationID: '974017695598335',
  snapshot: {
    body: { text: 'Just do it.' },
    title: 'Pegasus 42',
    ctaText: 'Shop now',
    linkUrl: 'https://nike.com',
    displayFormat: 'IMAGE',
    images: [{ originalImageUrl: 'https://scontent.example/a.jpg', resizedImageUrl: 'https://scontent.example/a_s.jpg' }],
    videos: [],
  },
};

test('normalizes an Apify item', () => {
  const ad = normalizeAd(apifyItem, NOW);
  assert.equal(ad.id, '1785179045778580');
  assert.equal(ad.pageName, 'Nike');
  assert.equal(ad.daysRunning, 112);
  assert.equal(ad.variants, 9);
  assert.equal(ad.format, 'Image');
  assert.equal(ad.image, 'https://scontent.example/a.jpg');
  assert.equal(ad.body, 'Just do it.');
  assert.deepEqual(ad.platforms, ['FACEBOOK', 'INSTAGRAM']);
  assert.equal(ad.libraryUrl, 'https://www.facebook.com/ads/library/?id=1785179045778580');
});

test('uses the stop date for inactive ads and handles camelCase ids', () => {
  const ad = normalizeAd({ ...apifyItem, adArchiveID: undefined, adArchiveId: '42', isActive: false }, NOW);
  assert.equal(ad.id, '42');
  assert.equal(ad.daysRunning, 111);
});

test('replaces catalog template copy with the first card and detects video', () => {
  const ad = normalizeAd({
    ...apifyItem,
    snapshot: {
      body: { text: '{{product.brand}}' },
      displayFormat: 'DPA',
      cards: [{ body: 'Air Max 90', title: 'Air Max', originalImageUrl: 'https://x/c.jpg', videoHdUrl: 'https://x/v.mp4' }],
    },
  }, NOW);
  assert.equal(ad.body, 'Air Max 90');
  assert.equal(ad.format, 'Video');
  assert.equal(ad.video.src, 'https://x/v.mp4');
});

test('drops items without an id', () => {
  assert.equal(normalizeAd({ pageName: 'x' }, NOW), null);
});

test('builds an Ad Library keyword URL, and passes Facebook URLs through', () => {
  const url = new URL(buildStartUrl('liquid death', 'BE'));
  assert.equal(url.searchParams.get('q'), 'liquid death');
  assert.equal(url.searchParams.get('country'), 'BE');
  assert.equal(url.searchParams.get('active_status'), 'active');
  assert.equal(buildStartUrl('https://www.facebook.com/nike', 'ALL'), 'https://www.facebook.com/nike');
});

test('summarizes pages and stats', () => {
  const ads = [
    normalizeAd(apifyItem, NOW),
    normalizeAd({ ...apifyItem, adArchiveID: '2', pageName: 'Nike Running', startDate: NOW / 1000 - 3 * 86400 }, NOW),
  ];
  const s = summarize(ads);
  assert.equal(s.stats.total, 2);
  assert.equal(s.stats.longestDays, 112);
  assert.equal(s.stats.newThisWeek, 1);
  assert.deepEqual(s.pages.map((p) => p.name), ['Nike', 'Nike Running']);
});

test('mock search works end to end and dedupes nothing it should not', async () => {
  process.env.RIVL_MOCK = '1';
  const r = await searchAds({ q: 'northline' });
  assert.equal(r.mock, true);
  assert.equal(r.ads.length, 8);
  assert.equal(r.pages[0].name, 'Northline Running');
  await assert.rejects(searchAds({ q: '  ' }), /Type a brand/);
  delete process.env.RIVL_MOCK;
});

test('reports a missing token clearly', async () => {
  const saved = process.env.APIFY_TOKEN;
  delete process.env.APIFY_TOKEN;
  await assert.rejects(searchAds({ q: 'token-check' }), /APIFY_TOKEN/);
  if (saved) process.env.APIFY_TOKEN = saved;
});
