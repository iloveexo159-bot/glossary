/* Deterministic Wikipedia API mock.

   The real app hits two endpoints (PRD §5):
     - REST summary:  /api/rest_v1/page/summary/{title}?redirect=true
     - Action API:    /w/api.php?action=opensearch&search=...   (suggestions/disambig)
   We intercept both so the E2E gate never depends on the live network or a
   particular Wikipedia revision. External CDNs (Alpine, JSZip) are left alone.

   To add coverage for a new term, extend SUMMARIES / SUGGESTIONS below. */

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const IMG = 'https://upload.wikimedia.org/wikipedia/commons/thumb/mock.png';

const SUMMARIES = {
  Mitochondrion: {
    type: 'standard', title: 'Mitochondrion', revision: '1001',
    extract: 'A mitochondrion is an organelle found in the cells of most eukaryotes. Mitochondria generate most of the cell’s supply of adenosine triphosphate, used as a source of chemical energy.',
    thumbnail: { source: IMG, width: 320, height: 240 },
  },
  Photosynthesis: {
    type: 'standard', title: 'Photosynthesis', revision: '2002',
    extract: 'Photosynthesis is a system of biological processes by which photosynthetic organisms convert light energy into chemical energy.',
    thumbnail: { source: IMG, width: 320, height: 240 },
  },
  Mercury: { type: 'disambiguation', title: 'Mercury', extract: 'Mercury may refer to several things.' },
};

// Live-summary variant used by the drift test: same title, changed extract.
const DRIFTED = {
  Mitochondrion: {
    type: 'standard', title: 'Mitochondrion', revision: '1099',
    extract: 'REVISED: A mitochondrion is a double-membrane-bound organelle. This sentence was edited on Wikipedia after the card was saved.',
    thumbnail: { source: IMG, width: 320, height: 240 },
  },
};

const SUGGESTIONS = {
  mit: ['Mitochondrion', 'Mitosis', 'Mitochondrial DNA'],
  photo: ['Photosynthesis', 'Photon', 'Photography'],
  mercury: ['Mercury (planet)', 'Mercury (element)', 'Mercury (mythology)'],
};

function opensearchBody(search) {
  const key = Object.keys(SUGGESTIONS).find((k) => search.toLowerCase().startsWith(k));
  const titles = key ? SUGGESTIONS[key] : [];
  const descs = titles.map((t) => 'Wikipedia article about ' + t);
  return [search, titles, descs, titles.map((t) => 'https://en.wikipedia.org/wiki/' + encodeURIComponent(t))];
}

/* Install the mock on a Playwright page.
   opts.drift = true  -> the summary endpoint returns the DRIFTED variant,
   simulating "the article changed since you saved it." */
async function mockWiki(page, opts = {}) {
  const summaries = opts.drift ? { ...SUMMARIES, ...DRIFTED } : SUMMARIES;

  await page.route(/\/w\/api\.php.*action=opensearch/, async (route) => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get('search') || '';
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(opensearchBody(search)) });
  });

  await page.route(/\/api\/rest_v1\/page\/summary\//, async (route) => {
    const url = route.request().url();
    const raw = decodeURIComponent(url.split('/summary/')[1].split('?')[0]);
    const title = raw.replace(/_/g, ' ');
    const data = summaries[title] || summaries[raw];
    if (!data) { await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }); return; }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });

  await page.route(/upload\.wikimedia\.org\//, async (route) => {
    await route.fulfill({ contentType: 'image/png', body: PNG_1x1 });
  });
}

module.exports = { mockWiki, SUMMARIES, SUGGESTIONS };
