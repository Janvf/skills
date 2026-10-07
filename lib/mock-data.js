// Demo data in the raw shape the Apify actor returns. Used when RIVL_MOCK=1 so the
// app can be built and tested without spending Apify credit. Brands are fictional.

const DAY = 86400;
const nowSec = Math.floor(Date.now() / 1000);

function art(bg, fg, text) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750">
<rect width="600" height="750" fill="${bg}"/><circle cx="430" cy="210" r="120" fill="${fg}" opacity=".18"/>
<text x="48" y="640" font-family="Arial, sans-serif" font-weight="800" font-size="58" fill="${fg}">${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function ad(i, o) {
  return {
    adArchiveID: String(900000000000 + i),
    pageID: o.pageId,
    pageName: o.page,
    isActive: true,
    startDate: nowSec - o.days * DAY,
    endDate: nowSec,
    publisherPlatform: o.platforms || ['FACEBOOK', 'INSTAGRAM'],
    collationCount: o.variants || 1,
    collationID: String(700000 + i),
    snapshot: {
      pageProfilePictureUrl: null,
      body: { text: o.body },
      title: o.title,
      ctaText: o.cta || 'Shop now',
      linkUrl: 'https://example.com',
      displayFormat: o.video ? 'VIDEO' : 'IMAGE',
      images: [{ originalImageUrl: art(o.bg, o.fg, o.art) }],
      videos: o.video ? [{ videoHdUrl: '', videoSdUrl: '', videoPreviewImageUrl: art(o.bg, o.fg, o.art) }] : [],
    },
  };
}

export const MOCK_ITEMS = [
  ad(1, { page: 'Northline Running', pageId: '1', days: 143, variants: 9, bg: '#FF5B14', fg: '#fff', art: 'Run your first 10k', title: 'The 12-week 10k plan', body: 'Never run more than 5k? Our coaches built a 12-week plan that gets you to 10k without the shin splints.', cta: 'Get the plan' }),
  ad(2, { page: 'Northline Running', pageId: '1', days: 96, variants: 4, bg: '#15171C', fg: '#F2F2F2', art: '30-day returns', title: 'Run in them for 30 days', body: 'Run in them for 30 days. If they don’t feel right, send them back, mud and all.', platforms: ['INSTAGRAM'] }),
  ad(3, { page: 'Northline', pageId: '2', days: 61, variants: 6, bg: '#C9D3FF', fg: '#0D1A5C', art: 'Lighter by 40g', title: 'Aero 3, now 40g lighter', body: 'The Aero 3 is 40 grams lighter than last year’s and still has the same cushioning. Tested over 800 km.' }),
  ad(4, { page: 'Northline', pageId: '2', days: 33, variants: 2, bg: '#DCEBDD', fg: '#173A22', art: 'Made from 60% recycled', title: 'Same shoe, less plastic', body: 'Every pair of Aero 3 uses 60% recycled material in the upper. Same fit, less waste.' }),
  ad(5, { page: 'Northline Running', pageId: '1', days: 19, variants: 3, bg: '#FFB547', fg: '#3A1F06', art: '“Best shoe I own”', title: '4.8 stars from 12,000 runners', body: '“Best running shoe I’ve owned in 15 years.” — Marta, marathoner. Join 12,000 runners who rate us 4.8.', video: true }),
  ad(6, { page: 'Sneaker Outlet EU', pageId: '3', days: 12, variants: 1, bg: '#FFE1EE', fg: '#5A0430', art: '-30% Northline', title: 'Northline Aero 2 at 30% off', body: 'Last sizes of the Northline Aero 2 at 30% off. Free shipping in the EU.', cta: 'Shop now' }),
  ad(7, { page: 'Northline', pageId: '2', days: 5, variants: 2, bg: '#1B2550', fg: '#E8ECFF', art: 'Night run kit', title: 'Be seen after dark', body: 'Reflective on all sides. The Night Run kit is back for winter.', video: true }),
  ad(8, { page: 'Northline Running', pageId: '1', days: 2, variants: 1, bg: '#FF9C7A', fg: '#fff', art: 'Race day checklist', title: 'Free race day checklist', body: 'Your first race is in 3 weeks? Download the checklist our coaches give every new runner.', cta: 'Download', platforms: ['FACEBOOK', 'INSTAGRAM', 'MESSENGER'] }),
];
