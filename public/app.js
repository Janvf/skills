// Rivl search page: reads ?q= and ?country=, calls /api/ads and renders the ads.

const $ = (id) => document.getElementById(id);
const states = ['start', 'loading', 'error', 'results'];
const PLATFORM = { FACEBOOK: 'FB', INSTAGRAM: 'IG', MESSENGER: 'Messenger', AUDIENCE_NETWORK: 'AN', THREADS: 'Threads', WHATSAPP: 'WhatsApp' };
const LONG_RUNNER_DAYS = 60;

let data = null;
let pageFilter = null;
let timer = null;
let current = null; // AbortController for the in-flight search

function show(name) {
  for (const s of states) $(`state-${s}`).hidden = s !== name;
}

// Small DOM helper. Text always goes in through textContent, so ad copy can't inject markup.
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

const safeUrl = (u) => (typeof u === 'string' && /^(https?:|data:image\/)/i.test(u) ? u : null);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function readParams() {
  const p = new URLSearchParams(location.search);
  return { q: (p.get('q') || '').trim(), country: (p.get('country') || 'ALL').toUpperCase() };
}

async function search({ q, country }) {
  $('q').value = q;
  $('country').value = [...$('country').options].some((o) => o.value === country) ? country : 'ALL';
  if (!q) return show('start');

  document.title = `${q} ads · Rivl`;
  current?.abort();
  current = new AbortController();
  show('loading');
  $('go').disabled = true;
  const t0 = Date.now();
  clearInterval(timer);
  $('elapsed').textContent = '0s';
  timer = setInterval(() => { $('elapsed').textContent = `${Math.round((Date.now() - t0) / 1000)}s`; }, 1000);

  try {
    const res = await fetch(`/api/ads?${new URLSearchParams({ q, country })}`, { signal: current.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `The server answered ${res.status}.`);
    data = body;
    pageFilter = null;
    render();
    show('results');
  } catch (err) {
    if (err.name === 'AbortError') return;
    $('error-text').textContent = err.message === 'Failed to fetch'
      ? 'Could not reach the Rivl server. Check your connection and try again.'
      : err.message;
    show('error');
  } finally {
    clearInterval(timer);
    $('go').disabled = false;
  }
}

function render() {
  const { stats, pages, query, country, mock, cached, fetchedAt } = data;
  $('r-title').textContent = query;
  const where = country === 'ALL' ? 'all countries' : $('country').selectedOptions[0]?.textContent || country;
  const when = new Date(fetchedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  $('r-meta').textContent = `${plural(stats.total, 'active ad')} from ${plural(pages.length, 'page')} · ${where} · fetched ${when}${cached ? ' (cached)' : ''}`;
  $('r-eyebrow').replaceChildren('Active ads', mock ? h('span', { class: 'demo-badge' }, 'Demo data') : '');

  $('k-total').textContent = stats.total;
  $('k-longest').textContent = stats.longestDays ? `${stats.longestDays}d` : '–';
  $('k-new').textContent = stats.newThisWeek;
  $('k-format').textContent = stats.topFormat?.name || '–';
  $('k-format-sub').textContent = stats.topFormat ? `${stats.topFormat.share}% of ads` : '';

  // Page chips: a keyword like "nike" also matches resellers, so let people narrow to one page.
  const chips = $('page-chips');
  chips.replaceChildren(
    chip('All pages', stats.total, pageFilter === null, () => { pageFilter = null; render(); }),
    ...pages.slice(0, 8).map((p) => chip(p.name, p.ads, pageFilter === p.name, () => { pageFilter = p.name; render(); })),
  );
  chips.hidden = pages.length < 2;

  renderGrid();
}

function chip(label, count, on, onclick) {
  return h('button', { type: 'button', class: `chip${on ? ' on' : ''}`, 'aria-pressed': on ? 'true' : 'false', onclick },
    label, h('span', { class: 'mono' }, count));
}

function renderGrid() {
  const sort = $('sort').value;
  const ads = data.ads
    .filter((a) => pageFilter === null || a.pageName === pageFilter)
    .sort((a, b) => {
      if (sort === 'newest') return (a.daysRunning ?? 1e9) - (b.daysRunning ?? 1e9);
      if (sort === 'variants') return b.variants - a.variants || (b.daysRunning ?? 0) - (a.daysRunning ?? 0);
      return (b.daysRunning ?? -1) - (a.daysRunning ?? -1);
    });
  $('grid').replaceChildren(...ads.map(card));
  $('empty').hidden = ads.length > 0;
}

function card(ad) {
  const long = ad.daysRunning !== null && ad.daysRunning >= LONG_RUNNER_DAYS;
  const isNew = ad.daysRunning !== null && ad.daysRunning <= 7;
  const platforms = ad.platforms.map((p) => PLATFORM[p] || p).join(' · ');
  const initial = (ad.pageName || '?').trim().charAt(0).toUpperCase();

  const avatar = safeUrl(ad.pageAvatar)
    ? h('img', { class: 'av', src: ad.pageAvatar, alt: '', referrerpolicy: 'no-referrer', loading: 'lazy', onerror: (e) => e.target.replaceWith(h('span', { class: 'av' }, initial)) })
    : h('span', { class: 'av' }, initial);

  return h('article', { class: 'acard' },
    long ? h('span', { class: 'sticker' }, 'Long runner') : null,
    h('header', {},
      avatar,
      h('div', { class: 'who' }, h('b', {}, ad.pageName), h('small', {}, `Sponsored${platforms ? ` · ${platforms}` : ''}`)),
    ),
    media(ad),
    ad.body ? h('p', { class: 'copy' }, ad.body) : null,
    ad.title || ad.cta ? h('div', { class: 'cta-row' },
      h('span', { class: 'cta-title' }, ad.title || ''),
      ad.cta ? h('span', { class: 'cta-btn' }, ad.cta) : null,
    ) : null,
    h('footer', {},
      h('span', { class: long ? 'hot' : '' }, ad.daysRunning !== null ? `Active ${ad.daysRunning}d` : 'Active', isNew ? h('span', { class: 'new' }, 'New') : null),
      h('span', {}, `${plural(ad.variants, 'variant')} · ${ad.format}`),
      h('a', { href: ad.libraryUrl, target: '_blank', rel: 'noopener', 'aria-label': `Open this ${ad.pageName} ad in the Meta Ad Library` }, 'Ad Library ↗'),
    ),
  );
}

function media(ad) {
  const poster = safeUrl(ad.video?.poster) || safeUrl(ad.image);
  const src = safeUrl(ad.video?.src);
  if (src) {
    const box = h('div', { class: 'media' });
    const play = h('button', {
      type: 'button', class: 'play', 'aria-label': 'Play video',
      onclick: () => box.replaceChildren(h('video', { src, poster, controls: true, autoplay: true, playsinline: true, referrerpolicy: 'no-referrer' })),
    }, h('span', { 'aria-hidden': 'true' }, '▶'));
    box.append(poster ? h('img', { src: poster, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : '', play);
    return box;
  }
  if (poster) {
    return h('div', { class: 'media' },
      h('img', { src: poster, alt: ad.title || `${ad.pageName} ad`, loading: 'lazy', referrerpolicy: 'no-referrer' }),
      ad.format === 'Video' ? h('span', { class: 'fmt' }, 'Video') : ad.format === 'Carousel' ? h('span', { class: 'fmt' }, 'Carousel') : null);
  }
  return h('div', { class: 'media none' }, h('span', {}, 'No preview. Open in Ad Library'));
}

$('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('q').value.trim();
  if (!q) return;
  const country = $('country').value;
  history.pushState(null, '', `?${new URLSearchParams(country === 'ALL' ? { q } : { q, country })}`);
  search({ q, country });
});
$('sort').addEventListener('change', () => data && renderGrid());
$('retry').addEventListener('click', () => search(readParams()));
window.addEventListener('popstate', () => search(readParams()));

search(readParams());
