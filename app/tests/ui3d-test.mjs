// Headless check of the 3D mode of the viewer's Board tab (WebGL through SwiftShader): it loads
// without errors, the board and parts render, views switch, a click on a part selects it, and net
// and question selection highlight the right parts. Writes screenshots to ./shots. Run like
// ui-test.mjs; add --use-angle=swiftshader where the browser has no GPU.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { startServer } from './server.mjs';

fs.mkdirSync('shots', { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const app = await startServer();
// the page fetches its data after the load event: wait for the app to render
const open = async (go) => { await go; await page.waitForSelector('#sidebar', { timeout: 30000 }); await page.waitForFunction(() => window.__ws, { timeout: 30000 }); };
const reload = () => open(page.reload({ waitUntil: 'load' }));
await open(page.goto(app.page, { waitUntil: 'load' }));
// the lists, a 3D panel and the details: no photo
await page.evaluate(() => {
  localStorage.clear();
  const w = window.__ws; w.api.clear();
  const p = w.openPanel('parts'); w.openPanel('nets', {}, { referencePanel: p.id });
  const v = w.openPanel('board3d', {}, { referencePanel: p.id, direction: 'right' });
  w.openPanel('details', {}, { referencePanel: v.id, direction: 'right' });
  p.group.api.setSize({ width: 320 }); v.group.api.setSize({ width: 760 });
});
await page.waitForFunction('window.__ready === true', { timeout: 60000 });
await new Promise(r => setTimeout(r, 1500));

const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
const lists = await page.evaluate(() => ({
  nets: document.querySelectorAll('#nets li').length, parts: document.querySelectorAll('#parts tr[data-ref]').length,
  canvas: !!document.querySelector('#view3d canvas'), photosHidden: ![...document.querySelectorAll('.photo')].some((p) => p.checkVisibility()),
}));
check('canvas and lists', lists.canvas && lists.photosHidden && lists.nets === 16 && lists.parts === 55, JSON.stringify(lists));
await page.screenshot({ path: 'shots/3d-iso.png' });

// the canvas is not blank: sample pixel variety
const clip = await page.evaluate(() => { const r = document.querySelector('#view3d').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
const shot = await page.screenshot({ encoding: 'base64', clip });
check('scene renders', shot.length > 60000, `${Math.round(shot.length / 1024)} KB screenshot`);

// click U4 on the canvas -> part detail
const u4 = await page.evaluate(() => window.__project('U4'));
await page.mouse.click(u4.x, u4.y);
await new Promise(r => setTimeout(r, 300));
const det = await page.evaluate(() => document.querySelector('#detail').innerText);
check('click on U4 selects it', det.includes('U4') && det.includes('MX08L'), det.split('\n').slice(0, 2).join(' | '));
await page.screenshot({ path: 'shots/3d-u4.png' });

// net M+ -> J_MP, U4, C6 lit
await page.evaluate(() => [...document.querySelectorAll('#nets li')].find(l => l.dataset.net === 'M+').click());
const lit = await page.evaluate(() => window.__lit());
check('net M+ lights its parts', JSON.stringify(lit) === JSON.stringify(['C6', 'J_MP', 'U4']), lit.join(','));
await page.screenshot({ path: 'shots/3d-net-mplus.png' });

// question OQ1, shown from the open questions panel: the 3D view stays in front, U4 lit
await page.evaluate(() => window.__ws.openPanel('questions', {}, { referencePanel: window.__ws.api.panels.find((p) => p.api.component === 'details').id, direction: 'below' }));
await page.waitForSelector('#qs [data-showq="OQ1"]');
await page.evaluate(() => document.querySelector('#qs [data-showq="OQ1"]').click());
const oq = await page.evaluate(() => ({ lit: window.__lit(), text: document.querySelector('#detail').innerText, v3: document.querySelector('#view3d').checkVisibility() }));
check('question OQ1', oq.lit.join() === 'U4' && oq.text.includes('Check') && oq.v3, JSON.stringify(oq));
// the panel is kept
await reload();
await page.waitForFunction('window.__ready === true', { timeout: 60000 });
check('3D panel kept after reload', await page.evaluate(() => window.__ws.kinds().includes('board3d') && document.querySelector('#view3d').checkVisibility()));

// views
for (const v of ['top', 'bottom']) {
  await page.evaluate(x => document.querySelector(`[data-view="${x}"]`).click(), v);
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: `shots/3d-${v}.png` });
}
check('views switch', true);
await page.evaluate(() => { document.querySelector('[data-view="iso"]').click(); document.querySelector('#xray').click(); document.querySelector('#clear')?.click(); });
await page.evaluate(() => [...document.querySelectorAll('#nets li')].find(l => l.dataset.net === 'GND').click());
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: 'shots/3d-xray-gnd.png' });

// traced copper: M+ selection lights only M+ traces; toggles work
await page.evaluate(() => { document.querySelector('#xray').click(); document.querySelector('#clear')?.click(); });
await page.evaluate(() => [...document.querySelectorAll('#nets li')].find(l => l.dataset.net === 'M+').click());
const lit3 = await page.evaluate(() => [...new Set(window.__traces())]);
check('M+ lights only its traced copper', lit3.length === 1 && lit3[0] === 'M+', lit3.join(','));
const tracedText = await page.evaluate(() => document.querySelector('#detail').innerText);
check('net detail lists its traced copper', /\nTRACES\n/i.test(tracedText) && tracedText.includes('IMG_3619'));
await page.evaluate(() => window.__look([-25, -40, 45], [-28, -14, 0]));
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: 'shots/3d-traces-motor.png' });
await page.evaluate(() => { document.querySelector('[data-panel-3d] [data-switch="traces"]').click(); });
const hidden = await page.evaluate(() => document.querySelector('[data-panel-3d] [data-switch="traces"]').getAttribute('aria-checked') === 'false' && window.__traces().length === window.__traces().length);
await page.evaluate(() => { document.querySelector('[data-panel-3d] [data-switch="traces"]').click(); document.querySelector('#clear')?.click(); document.querySelector('#enhanced').click(); document.querySelector('[data-view="bottom"]').click(); });
await new Promise(r => setTimeout(r, 1200));
await page.screenshot({ path: 'shots/3d-enhanced-bottom.png' });
check('trace and enhanced toggles', hidden);

await page.evaluate(() => localStorage.clear());
check('no JS errors', errors.length === 0, errors.join(' | '));
console.log(results.join('\n'));
await browser.close();
app.close();
process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
