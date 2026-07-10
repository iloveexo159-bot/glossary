/* Email export (PRD §2.1 export journeys + user request 2026-07-10):
   "(DD-MM-YYYY) Glossary Export.zip" to the account's Gmail. No mail is sent
   server-side (no backend on Spark) — desktop downloads the zip and opens a
   pre-addressed Gmail compose tab; the tests pin that contract. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { newComp } = require('./helpers/load-app');

function FakeZip() { this.entries = {}; }
FakeZip.prototype.file = function (name, content) { this.entries[name] = content; };
FakeZip.prototype.generateAsync = async function () { return { fakeBlob: true, names: Object.keys(this.entries) }; };

function emailComp() {
  const comp = newComp();
  comp.user = { uid: 'u1', name: 'Tester', email: 'iloveexo159@gmail.com' };
  comp.cards = [
    { id: 'c1', title: 'Entropy', extract: 'Disorder.', image: null, savedAt: 1, note: '', tags: [], highlights: [] },
    { id: 'c2', title: 'Enthalpy', extract: 'Heat.', image: null, savedAt: 2, note: '', tags: [], highlights: [] },
  ];
  comp.selected = ['c1', 'c2'];
  comp.exportSheet = true;
  comp._ctx.JSZip = FakeZip;
  comp._ctx.window.JSZip = FakeZip;
  comp.openedUrls = [];
  comp._ctx.window.open = (url) => { comp.openedUrls.push(url); };
  comp.downloads = [];
  comp.downloadBlob = function (blob, name) { this.downloads.push({ blob, name }); };
  return comp;
}

test('exportEmailName is "(DD-MM-YYYY) Glossary Export" for today', () => {
  const comp = newComp();
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  assert.equal(comp.exportEmailName(),
    `(${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}) Glossary Export`);
});

test('email export (desktop): compose tab to the account address, zip named after the subject', async () => {
  const comp = emailComp();
  await comp.doExport('email');

  assert.equal(comp.openedUrls.length, 1, 'one Gmail compose tab');
  const url = comp.openedUrls[0];
  assert.ok(url.startsWith('https://mail.google.com/mail/?view=cm'), 'Gmail compose URL');
  assert.ok(url.includes('to=' + encodeURIComponent('iloveexo159@gmail.com')), 'pre-addressed to the account');
  assert.ok(url.includes(encodeURIComponent('Glossary Export')), 'subject carries the export title');

  assert.equal(comp.downloads.length, 1, 'the zip is downloaded for attaching');
  assert.equal(comp.downloads[0].name, comp.exportEmailName() + '.zip');
  assert.deepEqual(Array.from(comp.downloads[0].blob.names).sort(), ['Enthalpy.md', 'Entropy.md'],
    'every selected card is in the zip');
});

test('email export stamps lastExportedAt and closes the sheet like a download does', async () => {
  const comp = emailComp();
  await comp.doExport('email');
  assert.ok(comp.cards.every((c) => c.lastExportedAt), 'both cards stamped');
  assert.equal(comp.exportSheet, false);
  assert.deepEqual(Array.from(comp.selected), []);
  assert.match(comp.toast, /Gmail tab/);
});

test('email export without the zip library warns and sends nothing', async () => {
  const comp = emailComp();
  delete comp._ctx.window.JSZip;
  await comp.doExport('email');
  assert.equal(comp.openedUrls.length, 0, 'no compose tab');
  assert.equal(comp.downloads.length, 0, 'no download');
  assert.ok(!comp.cards.some((c) => c.lastExportedAt), 'nothing stamped as exported');
  assert.match(comp.toast, /zip library/);
});

test('plain download path is unchanged: multi-card selection becomes glossary-export.zip', async () => {
  const comp = emailComp();
  await comp.doExport('download');
  assert.equal(comp.openedUrls.length, 0, 'no compose tab on plain download');
  assert.equal(comp.downloads[0].name, 'glossary-export.zip');
  assert.equal(comp.toast, '✓ Export downloaded');
});
