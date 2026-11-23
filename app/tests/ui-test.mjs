// Headless check of the viewer (React + shadcn/ui) in 2D mode: the scenario browser, no JS errors,
// every tab renders, net and part selection highlight the right boxes, the confidence chips' tooltips
// and search work, the parts table sorts, filters and folds, the bottom photo is turned 180°, the aligned view turns by quarter turns, the
// photos zoom and pan, edits are saved to scenario.json (autosave, undo, refused edits, changes
// made on disk by something else), and the investigation works: following plan.json step by step,
// sweeps, tests outside the plan, observations and instructions in record.json, voiding, the
// repair log's timeline, and a new plan from the agent picked up live. The 3D mode has its own
// test (ui3d-test.mjs).
// It serves a copy of scenarios/homestar-flux with the real server (server.mjs) and writes
// screenshots to ./shots. Needs the built app (npm run build in app/web), a Python with
// app/scripts/requirements.txt (PYTHON) and Chrome or Chromium (CHROME). From app/tests:
//   npm i puppeteer-core@23 && CHROME=/path/to/chrome PYTHON=/path/to/python node ui-test.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { startServer } from './server.mjs';

const app = await startServer();
fs.mkdirSync('shots', { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],  // WebGL for the 3D mode switch
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1100 });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('status of 409') && !m.text().includes('status of 422')) errors.push('console: ' + m.text()); });
// the page fetches its data after the load event: wait for the app to render
const open = async (go) => { await go; await page.waitForSelector('#sidebar', { timeout: 30000 }); await page.waitForFunction(() => window.__ws, { timeout: 30000 }); };
const reload = () => open(page.reload({ waitUntil: 'load' }));
// a known arrangement of panels: the lists, the given views (the first right of the lists, the
// others below it), the details on the right
const layout = (views) => page.evaluate((views) => {
  const w = window.__ws; w.api.clear();
  const p = w.openPanel('parts'); w.openPanel('nets', {}, { referencePanel: p.id }); w.openPanel('traces', {}, { referencePanel: p.id });
  let first = null;
  for (const [kind, params] of views) { const v = w.openPanel(kind, params || {}, first ? { referencePanel: first.id, direction: 'below' } : { referencePanel: p.id, direction: 'right' }); first = first || v; }
  w.openPanel('details', {}, { referencePanel: first.id, direction: 'right' });
  p.group.api.setSize({ width: 340 });
  p.api.setActive();
}, views);
const BOARD = [['photo', { mode: 'raw', show: 'top' }], ['photo', { mode: 'raw', show: 'bottom' }]];
const viewOf = (p) => p.params.view || p.params.side;

const results = [];
const check = (name, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);

// ---------------------------------------------------------------- the scenario browser
await page.goto(app.url, { waitUntil: 'load' });
await page.waitForSelector('[data-scenario]', { timeout: 30000 });
const listed = await page.evaluate(() => ({ cards: [...document.querySelectorAll('[data-scenario]')].map(a => a.dataset.scenario),
  empty: document.querySelector('[data-root="scenarios"]')?.textContent || '' }));
check('scenario browser lists the scenarios', listed.cards.join() === 'scenarios/homestar-flux', listed.cards.join());
await page.screenshot({ path: 'shots/browser.png' });
await open(Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('[data-scenario="scenarios/homestar-flux"]')]));
check('opening a scenario', page.url().endsWith('?s=scenarios%2Fhomestar-flux') && (await page.$eval('#title', (e) => e.textContent)) === 'Sega Toys Homestar Flux', page.url());
check('the default layout is the investigation', (await page.evaluate(() => window.__ws.kinds())).join() === 'path,step,photo,photo,board3d,suspects,details,questions,findings,log',
  await page.evaluate(() => window.__ws.kinds().join()));
await layout(BOARD);
await page.waitForFunction(() => [...document.querySelectorAll('[data-panel-photo] .stage img')].filter((i) => i.complete && i.naturalWidth).length === 2, { timeout: 20000 });

const counts = await page.evaluate(() => ({
  nets: document.querySelectorAll('#nets li').length,
  parts: document.querySelectorAll('#parts tr[data-ref]').length,
  boxes: document.querySelectorAll('.box').length,
  imgs: [...document.querySelectorAll('[data-panel-photo] .stage img')].map(i => i.naturalWidth),
}));
check('net list', counts.nets === 16, `${counts.nets} nets`);
check('part list', counts.parts === 55, `${counts.parts} parts`);
check('photo boxes', counts.boxes > 60, `${counts.boxes} boxes`);
check('photos decoded', counts.imgs.every(w => w === 2400), counts.imgs.join(','));

// select net M+ : expect J_MP, U4, C6 highlighted
await page.evaluate(() => [...document.querySelectorAll('#nets li')].find(l => l.dataset.net === 'M+').click());
const hitNet = await page.evaluate(() => [...new Set([...document.querySelectorAll('.box.hit')].map(b => b.dataset.ref))].sort());
check('net M+ highlights its parts', JSON.stringify(hitNet) === JSON.stringify(['C6', 'J_MP', 'U4']), hitNet.join(','));
await page.screenshot({ path: 'shots/net-mplus.png', fullPage: false });

// click U4's box: detail shows 8 pins, VDD on U4_VDD
await page.evaluate(() => document.querySelector('.box[data-ref="U4"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
const u4 = await page.evaluate(() => ({ rows: document.querySelectorAll('#detail table tr').length - 1, text: document.querySelector('#detail').innerText }));
check('part U4 detail', u4.rows === 8 && u4.text.includes('U4_VDD') && u4.text.includes('OQ1'), `${u4.rows} pins`);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: 'shots/part-u4.png' });
// a part on power nets only (C1: +3V3 and GND) highlights itself, not every part on ground
await page.evaluate(() => document.querySelector('#parts tr[data-ref="C1"]').click());
const c1Hits = await page.evaluate(() => [...new Set([...document.querySelectorAll('.box.hit')].map(b => b.dataset.ref))]);
check('power nets left out of the part highlight', c1Hits.join() === 'C1', c1Hits.join(','));

// confidence chips explain their level on hover
await page.evaluate(() => [...document.querySelectorAll('#nets li')].find(l => l.dataset.net === 'GND').click());
await page.hover('#detail [data-conf="assumed"]');
const tip = await page.waitForSelector('[data-slot="tooltip-content"]', { timeout: 3000 }).then(h => h.evaluate(e => e.textContent)).catch(() => '');
check('a confidence chip shows its meaning on hover', /hypothesis/i.test(tip), tip);
await page.mouse.move(0, 0);

// search
await page.type('#search', 'shoot');
const filtered = await page.evaluate(() => document.querySelectorAll('#nets li').length + document.querySelectorAll('#parts tr[data-ref]').length);
check('search filters', filtered > 0 && filtered < 20, `${filtered} items`);

await page.click('#search', { clickCount: 3 }); await page.keyboard.press('Backspace');

// ---------------------------------------------------------------- parts table, sections
const T = (fn, ...a) => page.evaluate(fn, ...a);
const refs = () => T(() => [...document.querySelectorAll('#parts tr[data-ref]')].map(t => t.dataset.ref));
const typeCol = await T(() => [...document.querySelectorAll('#parts tr[data-ref]')].map(t => t.children[1].textContent));
check('type column', typeCol.length === 55 && typeCol.includes('Resistor') && typeCol.includes('Wire pad') && !typeCol.some(t => !t),
  [...new Set(typeCol)].join(','));
await T(() => document.querySelector('.typechips [data-kind="ic"]').click());
const ics = await refs();
check('type filter', ics.length === 4 && ics.every(r => r.startsWith('U')), ics.join(','));
await T(() => document.querySelector('th[data-sort="known"]').click());   // most known pins first
const byKnown = await T(() => [...document.querySelectorAll('#parts tr[data-ref] .kn')].map(td => +td.textContent.split('/')[0]));
check('sort by known pins', byKnown.every((v, i) => !i || byKnown[i - 1] >= v) && byKnown[0] > 0, byKnown.join(','));
await T(() => document.querySelector('th[data-sort="known"]').click());   // reversed
const asc = await T(() => [...document.querySelectorAll('#parts tr[data-ref] .kn')].map(td => +td.textContent.split('/')[0]));
check('sort reverses', asc.every((v, i) => !i || asc[i - 1] <= v), asc.join(','));
await page.select('#pside', 'bottom');
const bottomIcs = await refs();
check('side filter', bottomIcs.join() !== ics.join() && bottomIcs.length >= 1 && bottomIcs.length < 4, bottomIcs.join(','));
await T(() => document.querySelector('#pknown').click());
const known = await refs();
check('known-nets switch', known.length > 0 && known.length < bottomIcs.length && (await T(() => document.querySelector('#pknown').dataset.state)) === 'checked', `${known.length} parts`);
await T(() => document.querySelector('#preset').click());
check('reset filters', (await refs()).length === 55 && (await T(() => document.querySelector('#preset').hidden)));
await T(() => document.querySelector('th[data-sort="ref"]').click());

// ---------------------------------------------------------------- bottom photo turned 180°, zoom and pan
const turned = await T(async () => {
  const D = window.__editor.state(); D.photos.bottom = { ...D.photos.bottom, ...(await (await fetch('files/scenarios/homestar-flux/generated/view.json')).json()).photos.bottom };
  const ph = D.photos.bottom;
  const r = document.querySelector('#stage-bottom .box[data-ref="U3"]');
  const b = D.parts.U3.box.bottom;
  return { rot: ph.rot, x: +r.getAttribute('x'), want: (ph.size[0] - b[2]) * ph.scale, cap: document.querySelector('#cap-bottom').textContent };
});
check('bottom photo turned 180°', turned.rot === 180 && Math.abs(turned.x - turned.want) < 1 && turned.cap.includes('180'), JSON.stringify(turned));
const vp = await T(() => { const r = document.querySelector('#vp-top').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await T(() => document.querySelector('#vp-top').scrollIntoView({ block: 'center' }));
const vp2 = await T(() => { const r = document.querySelector('#vp-top').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
await page.mouse.move(vp2.x + vp2.w * 0.3, vp2.y + vp2.h * 0.4);
for (let i = 0; i < 4; i++) { await page.keyboard.down('Control'); await page.mouse.wheel({ deltaY: -60 }); await page.keyboard.up('Control'); }
await new Promise(r => setTimeout(r, 200));
const z1 = await T(() => ({ zl: document.querySelector('#zl-top').textContent, h: document.querySelector('#vp-top').getBoundingClientRect().height,
  sl: document.querySelector('#vp-top').scrollLeft, sw: document.querySelector('#stage-top').offsetWidth, vw: document.querySelector('#vp-top').clientWidth }));
check('ctrl + wheel zooms at the pointer', parseInt(z1.zl) > 300 && z1.sw > 3 * z1.vw && z1.sl > 0 && Math.abs(z1.h - vp.h) < 2, JSON.stringify(z1));
// drag on the photo pans, and does not select what it started on
await T(() => document.querySelector('#clear')?.click());
const c = { x: vp2.x + vp2.w / 2, y: vp2.y + vp2.h / 2 };
await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x - 150, c.y - 60, { steps: 6 }); await page.mouse.up();
const pan1 = await T(() => ({ sl: document.querySelector('#vp-top').scrollLeft, st: document.querySelector('#vp-top').scrollTop,
  detail: document.querySelector('#detail h3').textContent }));
check('drag pans the photo', pan1.sl > z1.sl + 100 && pan1.detail === 'Details', JSON.stringify(pan1));
// a plain wheel pans while zoomed
await page.mouse.wheel({ deltaY: 120 });
await new Promise(r => setTimeout(r, 150));
const pan2 = await T(() => document.querySelector('#vp-top').scrollTop);
check('wheel pans when zoomed', pan2 > pan1.st, `${pan1.st} -> ${pan2}`);
await page.screenshot({ path: 'shots/zoom-top.png' });
await T(() => document.querySelector('.photo[data-side="top"] [data-zoom="0"]').click());
check('fit resets the zoom', await T(() => document.querySelector('#zl-top').textContent === '100%' && document.querySelector('#vp-top').scrollLeft === 0));
// 3D is a panel of its own; it opens beside the photos (the scene itself is checked in ui3d-test.mjs)
await T(() => window.__ws.reveal('board3d'));
await page.waitForSelector('#view3d');
const m3 = await T(() => ({ v3: document.querySelector('#view3d').checkVisibility(), bottom: document.querySelector('#vp-bottom').checkVisibility(),
  sameGroup: window.__ws.api.panels.find((p) => p.api.component === 'board3d').group === window.__ws.api.panels.find((p) => p.api.component === 'photo').group }));
check('a 3D panel opens beside the photos', m3.v3 && m3.bottom && m3.sameGroup, JSON.stringify(m3));
await T(() => window.__ws.api.panels.find((p) => p.api.component === 'board3d').api.close());

// ---------------------------------------------------------------- the workspace: panels, groups, sidebar, layouts
const kinds = () => T(() => window.__ws.kinds());
const groupOf = (title) => T((title) => { const g = [...document.querySelectorAll('.dv-tab')].find((t) => t.textContent.trim() === title)?.closest('.dv-groupview'); if (g) g.dataset.test = title; return !!g; }, title);
const press = async (sel) => { const r = await T((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel); await page.mouse.click(r.x, r.y); };
// a group's header action: a button, or an entry of its "…" menu when the group is narrow
const groupAction = async (title, sel) => {
  await groupOf(title);
  if (await T((t) => !!document.querySelector(`[data-test="${t}"] [data-group-more]`), title)) {
    await press(`[data-test="${title}"] [data-group-more]`);
    await page.waitForSelector(`[role="menu"] ${sel}`);
    await page.click(`[role="menu"] ${sel}`);
  } else await press(`[data-test="${title}"] ${sel}`);
};
// the group's + menu adds a panel to it: a second "2D · Top" beside the first
await groupOf('2D · Top');
await press('[data-test="2D · Top"] [data-group-add]');
await page.waitForSelector('[data-add="photo"]');
await page.click('[data-add="photo"]');
const twoTops = await T(() => { const tops = window.__ws.api.panels.filter((p) => p.api.component === 'photo' && (p.params.show || 'top') === 'top'); return { n: tops.length, sameGroup: tops.length === 2 && tops[0].group === tops[1].group }; });
check('the + menu adds a panel to its group, two of the same kind', twoTops.n === 2 && twoTops.sameGroup, JSON.stringify(twoTops));
await T(() => window.__ws.api.panels.filter((p) => p.api.component === 'photo' && (p.params.show || 'top') === 'top')[1].api.close());
// split right: an empty group, which offers the same menu
const groups0 = await T(() => window.__ws.api.groups.length);
await groupAction('2D · Top', '[data-group-split="right"]');
await page.waitForSelector('[data-empty-group] [data-watermark-add]');
check('split right makes an empty group', (await T(() => window.__ws.api.groups.length)) === groups0 + 1);
await press('[data-empty-group] [data-watermark-add]');
await page.waitForSelector('[data-add="questions"]');
await page.click('[data-add="questions"]');
await page.waitForSelector('#qs [data-question]');
check('an empty group adds a panel: the open questions', (await T(() => document.querySelectorAll('#qs [data-question]').length)) === 8);
// maximize the group, restore it, close it
await groupAction('Open questions', '[data-group-max]');
const maxed = await T(() => window.__ws.api.hasMaximizedGroup());
await groupAction('Open questions', '[data-group-max]');
check('maximize and restore a group', maxed && !(await T(() => window.__ws.api.hasMaximizedGroup())));
await groupAction('Open questions', '[data-group-close]');
check('close a group', !(await kinds()).includes('questions') && (await T(() => window.__ws.api.groups.length)) === groups0);
// a sidebar row brings its panel forward or opens it; its + opens another
await T(() => document.querySelector('[data-nav="schematic"]').click());
await T(() => document.querySelector('[data-nav="schematic"]').click());
const sch1 = await T(() => ({ n: window.__ws.kinds().filter((k) => k === 'schematic').length, active: window.__ws.api.activePanel?.api.component,
  row: document.querySelector('[data-nav="schematic"]').dataset.active }));
await T(() => document.querySelector('[data-new="schematic"]').click());
const sch2 = (await kinds()).filter((k) => k === 'schematic').length;
check('a sidebar row reveals its panel, + opens another', sch1.n === 1 && sch1.active === 'schematic' && sch1.row === 'true' && sch2 === 2, JSON.stringify({ sch1, sch2 }));
await T(() => window.__ws.api.panels.filter((p) => p.api.component === 'schematic').forEach((p) => p.api.close()));
// the arrangement survives a reload
const before = await kinds();
await reload();
const after = await kinds();
check('the layout is kept after a reload', [...after].sort().join() === [...before].sort().join(), `${before.join()} -> ${after.join()}`);
// the sidebar folds to a rail, kept after a reload
await T(() => document.querySelector('[data-sidebar-toggle]').click());
await page.waitForFunction(() => document.querySelector('#sidebar').getBoundingClientRect().width < 60, { timeout: 5000 }).catch(() => {}); // the width animates
const rail = await T(() => ({ collapsed: document.querySelector('#sidebar').dataset.collapsed, w: document.querySelector('#sidebar').getBoundingClientRect().width }));
await reload();
const railKept = await T(() => document.querySelector('#sidebar').dataset.collapsed === 'true');
await T(() => document.querySelector('[data-sidebar-toggle]').click());
check('the sidebar folds to a rail, kept after a reload', rail.collapsed === 'true' && rail.w < 60 && railKept, JSON.stringify(rail));
// an empty workspace: a sidebar row and the Add panel menu still open panels
await T(() => [...window.__ws.api.panels].forEach((p) => p.api.close()));
await page.waitForSelector('[data-empty-group] [data-watermark-add]');
await T(() => document.querySelector('[data-nav="parts"]').click());
const fromRow = await kinds();
await T(() => [...window.__ws.api.panels].forEach((p) => p.api.close()));
await press('[data-empty-group] [data-watermark-add]');
await page.waitForSelector('[data-add="nets"]');
await page.click('[data-add="nets"]');
check('an empty workspace opens panels, from the sidebar and from Add panel', fromRow.join() === 'parts' && (await kinds()).join() === 'nets', `${fromRow.join()} / ${(await kinds()).join()}`);
// a double-click on a list row brings up its details: opens the panel, then reuses it
await page.click('#nets li[data-net="GND"]', { clickCount: 2 });
await page.waitForSelector('#detail');
const dblNet = { kinds: (await kinds()).join(), text: await T(() => document.querySelector('#detail').textContent) };
await T(() => document.querySelector('[data-nav="parts"]').click());
await page.click('#parts tr[data-ref="U4"]', { clickCount: 2 });
const dblPart = { kinds: (await kinds()).sort().join(), active: await T(() => window.__ws.api.activePanel.api.component), text: await T(() => document.querySelector('#detail').textContent) };
check('a double-click on a list row shows its details', dblNet.kinds === 'nets,details' && dblNet.text.includes('GND')
  && dblPart.kinds === 'details,nets,parts' && dblPart.active === 'details' && dblPart.text.includes('MX08L'), JSON.stringify({ dblNet: dblNet.kinds, dblPart: dblPart.kinds, active: dblPart.active }));
// a layout preset
await T(() => document.querySelector('[data-nav="preset-schematic"]').click());
check('a layout preset rearranges the panels', (await kinds()).join() === 'parts,nets,schematic,diagram,details', (await kinds()).join());
await page.screenshot({ path: 'shots/workspace.png' });
// the scenario picker lists the scenarios
await page.click('#title');
await page.waitForSelector('[data-scenario-item="scenarios/homestar-flux"]');
check('the scenario picker lists the scenarios', (await T(() => document.querySelector('[data-scenario-item="scenarios/homestar-flux"]').textContent)).includes('Active'));
await page.keyboard.press('Escape');
// the aligned view is a mode of the 2D panel
await layout([['photo', { mode: 'raw', show: 'top' }]]);
await T(() => document.querySelector('[data-photo-show="both"]').click());
await page.waitForFunction(() => [...document.querySelectorAll('[data-panel-photo="raw"] .stage > img')].filter(i => i.complete && i.naturalWidth > 0).length === 2, { timeout: 20000 });
check('a raw 2D panel shows both sides, and offers no overlay', await T(() => document.querySelectorAll('[data-panel-photo="raw"] .stage').length === 2
  && document.querySelector('[data-photo-show="overlay"]').disabled && window.__ws.api.panels.find((p) => p.api.component === 'photo').title === '2D · Both'));
await T(() => document.querySelector('[data-photo-mode="aligned"]').click());
await page.waitForSelector('#aligned');
check('a 2D panel switches to the aligned photos, keeping its sides', await T(() => { const p = window.__ws.api.panels.find((p) => p.api.component === 'photo');
  return p.title === '2D · Aligned · Both' && p.params.mode === 'aligned' && p.params.show === 'both' && !document.querySelector('[data-photo-show="overlay"]').disabled; }));
// aligned view: both sides processed into the board frame, boxes mapped onto them, side by side or overlaid
await page.waitForFunction(() => [...document.querySelectorAll('#aligned .stage > img')].filter(i => i.complete && i.naturalWidth > 0).length === 2, { timeout: 20000 });
const al = await T(() => {
  const img = document.querySelector('#stage-top > img').getBoundingClientRect(), u4 = document.querySelector('#stage-top .box[data-ref="U4"]').getBoundingClientRect();
  return { inside: u4.left > img.left && u4.right < img.right && u4.top > img.top && u4.bottom < img.bottom,
    how: document.querySelector('#ahow').textContent, bottomFlip: getComputedStyle(document.querySelector('#stage-bottom > img')).transform !== 'none' };
});
check('aligned view: both sides, boxes mapped, bottom flipped to read', al.inside && al.how.includes('hand-picked') && al.bottomFlip, JSON.stringify(al));
await T(() => document.querySelector('[data-photo-show="overlay"]').click());
const ov = await T(() => ({ stages: document.querySelectorAll('#aligned .stage').length, overlay: !!document.querySelector('#aligned img[data-overlay]') }));
check('aligned overlay: one view, the other side see-through', ov.stages === 1 && ov.overlay, JSON.stringify(ov));
// a quarter turn turns the whole view: the frame, the photo, the see-through side and the boxes
const shape = () => T(() => {
  const st = document.querySelector('#aligned .stage'), r = st.getBoundingClientRect();
  const img = st.querySelector(':scope > img').getBoundingClientRect(), ovl = st.querySelector('img[data-overlay]').getBoundingClientRect();
  const u4 = st.querySelector('.box[data-ref="U4"]').getBoundingClientRect();
  return { ratio: r.width / r.height, fits: Math.abs(img.width - r.width) < 2 && Math.abs(img.height - r.height) < 2 && Math.abs(ovl.width - r.width) < 2,
    inside: u4.left > r.left && u4.right < r.right && u4.top > r.top && u4.bottom < r.bottom,
    rotate: window.__ws.api.panels.find((p) => p.api.component === 'photo').params.rotate ?? 0 };
});
const r0 = await shape();
await T(() => document.querySelector('#arot-right').click());
const r90 = await shape();
await T(() => document.querySelector('#arot-left').click());
const rBack = await shape();
check('aligned view turns by quarter turns, boxes and both photos with it', r90.rotate === 90 && Math.abs(r90.ratio * r0.ratio - 1) < 0.02 && r90.fits && r90.inside && r0.fits && rBack.rotate === 0,
  JSON.stringify({ r0, r90, rBack }));
await T(() => document.querySelector('[data-photo-mode="raw"]').click());
await page.waitForSelector('[data-panel-photo="raw"]');
check('back to raw, an overlay becomes both sides', await T(() => window.__ws.api.panels.find((p) => p.api.component === 'photo').params.show === 'both'));
await T(() => document.querySelector('[data-photo-mode="aligned"]').click());
await page.waitForSelector('#aligned');
await T(() => document.querySelector('[data-photo-show="top"]').click());
check('an aligned 2D panel shows one side alone', await T(() => document.querySelectorAll('#aligned .stage').length === 1 && !!document.querySelector('#stage-top')
  && window.__ws.api.panels.find((p) => p.api.component === 'photo').title === '2D · Aligned · Top'));
await T(() => document.querySelector('[data-photo-show="overlay"]').click());
// edit in the aligned view: moving U4's box changes it in the original photo's pixels
await T(() => document.querySelector('#edit').click());
await T(() => document.querySelector('#parts tr[data-ref="U4"]').click());
const ab0 = await T(() => window.__editor.state().parts.U4.box.top);
const abox = await T(() => { const r = document.querySelector('#stage-top .editbox').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.mouse.move(abox.x, abox.y); await page.mouse.down(); await page.mouse.move(abox.x + 20, abox.y, { steps: 5 }); await page.mouse.up();
const ab1 = await T(() => window.__editor.state().parts.U4.box.top);
check('move a box in the aligned view', ab1[0] > ab0[0] && ab1[2] - ab1[0] === ab0[2] - ab0[0], `${ab0} -> ${ab1}`);
await T(() => { document.querySelector('#undo').click(); document.querySelector('#edit').click(); });
await layout(BOARD);

// the diagrams, as panels
for (const [kind, sel] of [['diagram', '.diagram svg'], ['schematic', '#schkicad svg:not(.lucide)']]) {
  await page.evaluate((k) => window.__ws.reveal(k), kind);
  await page.waitForSelector(sel);
  const h = await page.evaluate((sel) => document.querySelector(sel).getBoundingClientRect().height, sel);
  check(`${kind} panel`, h > 100, `svg height ${Math.round(h)}`);
  await page.screenshot({ path: `shots/panel-${kind}.png` });
}
// block click -> the photos, with highlights
await page.evaluate(() => window.__ws.reveal('diagram'));
await page.evaluate(() => document.querySelector('.diagram .block[data-block="motor"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
const blockHits = await page.evaluate(() => new Set([...document.querySelectorAll('.box.hit')].map(b => b.dataset.ref)).size);
check('block click highlights parts', blockHits >= 7, `${blockHits} parts`);

// ---------------------------------------------------------------- editor
await page.evaluate(() => localStorage.removeItem('pcbmodel-ui'));
await reload();
await layout(BOARD);
const E = (fn, ...a) => page.evaluate(fn, ...a);
const flush = () => E(() => window.__editor.flush());
await E(() => document.querySelector('#edit').click());
check('edit mode opens', await E(() => !document.querySelector('#editbar').hidden));

// draw a 3-point trace on the top photo, finish with a double-click
const tracesBefore = await E(() => window.__editor.state().traces.length);
await E(() => document.querySelector('[data-tool="draw"]').click());
for (const [x, y] of [[1500, 2300], [1600, 2350], [1700, 2320]]) {
  const p = await E((x, y) => window.__editor.toScreen('top', x, y), x, y);
  await page.mouse.click(p.x, p.y);
}
const last = await E(() => window.__editor.toScreen('top', 1700, 2320));
await page.mouse.click(last.x, last.y, { clickCount: 2 });
const drawn = await E(() => window.__editor.state().traces.at(-1));
check('draw a trace', (await E(() => window.__editor.state().traces.length)) === tracesBefore + 1 && drawn.points.length === 3 && drawn.side === 'top',
  `${drawn.id}: ${drawn.points.length} points`);
await page.select('#tnet', 'M-');
await E(() => { const i = document.querySelector('#tev'); i.value = 'test trace'; i.dispatchEvent(new Event('change')); });
const named = await E(id => window.__editor.state().traces.find(t => t.id === id), drawn.id);
check('set trace net and evidence', named.net === 'M-' && named.evidence === 'test trace');
check('no text selection after drawing', await E(() => String(window.getSelection()) === '' && window.getSelection().type !== 'Range'));
await page.screenshot({ path: 'shots/edit-trace.png' });

// drag the first point of trace t1 by 40 screen px
await E(() => document.querySelector('#traces li[data-trace="t1"]').click());
const p0 = await E(() => window.__editor.state().traces.find(t => t.id === 't1').points[0]);
const h = await E((x, y) => window.__editor.toScreen('top', x, y), ...p0);
await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x + 20, h.y, { steps: 4 }); await page.mouse.move(h.x + 40, h.y, { steps: 4 }); await page.mouse.up();
const p1 = await E(() => window.__editor.state().traces.find(t => t.id === 't1').points[0]);
check('drag a trace point', p1[0] > p0[0] + 50 && Math.abs(p1[1] - p0[1]) < 10, `${p0} -> ${p1}`);

// move U4's box
await E(() => document.querySelector('#parts tr[data-ref="U4"]').click());
const b0 = await E(() => window.__editor.state().parts.U4.box.top);
const u4box = await E(() => { const r = document.querySelector('#stage-top .editbox').getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; });
await page.mouse.move(u4box.x, u4box.y); await page.mouse.down(); await page.mouse.move(u4box.x + 15, u4box.y + 10, { steps: 5 }); await page.mouse.up();
const b1 = await E(() => window.__editor.state().parts.U4.box.top);
check('move a part box', b1[0] > b0[0] && b1[1] > b0[1] && b1[2] - b1[0] === b0[2] - b0[0], `${b0} -> ${b1}`);

// move U3's box on the bottom photo, which is shown turned 180°: dragging right moves it left in the file
await E(() => document.querySelector('#parts tr[data-ref="U3"]').click());
const u3b0 = await E(() => window.__editor.state().parts.U3.box.bottom);
await E(() => document.querySelector('#stage-bottom .editbox').scrollIntoView({ block: 'center' }));
const u3box = await E(() => { const r = document.querySelector('#stage-bottom .editbox').getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; });
await page.mouse.move(u3box.x, u3box.y); await page.mouse.down(); await page.mouse.move(u3box.x + 20, u3box.y + 10, { steps: 5 }); await page.mouse.up();
const u3b1 = await E(() => window.__editor.state().parts.U3.box.bottom);
check('move a box on the turned photo', u3b1[0] < u3b0[0] && u3b1[1] < u3b0[1] && u3b1[2] - u3b1[0] === u3b0[2] - u3b0[0], `${u3b0} -> ${u3b1}`);
await E(() => document.querySelector('#undo').click());
check('undo restores the box', JSON.stringify(await E(() => window.__editor.state().parts.U3.box.bottom)) === JSON.stringify(u3b0));
await E(() => { document.querySelector('#parts tr[data-ref="U4"]').click(); window.scrollTo(0, 0); });

// connection: U4 pin 4 onto DC+ as measured
await page.select('#detail tr[data-pin="4"] .pnet', 'DC+');
await page.select('#detail tr[data-pin="4"] .pconf', 'measured');
await E(() => { const i = document.querySelector('#detail tr[data-pin="4"] .pev'); i.value = 'test: continuity to DC+'; i.dispatchEvent(new Event('change')); });
const nets1 = await E(() => window.__editor.nets());
check('edit a connection', nets1['DC+'].some(n => n[0] === 'U4' && n[1] === '4' && n[2] === 'measured') && !nets1['U4_VDD'].some(n => n[0] === 'U4' && n[1] === '4'));
await page.screenshot({ path: 'shots/edit-part.png' });
for (let i = 0; i < 3; i++) await E(() => document.querySelector('#undo').click());   // net, confidence, evidence: three edits
const nets2 = await E(() => window.__editor.nets());
check('undo three edits', nets2['U4_VDD'].some(n => n[0] === 'U4' && n[1] === '4' && n[2] === 'datasheet'));
for (let i = 0; i < 3; i++) await E(() => document.querySelector('#redo').click());
const nets2b = await E(() => window.__editor.nets());
check('redo them', nets2b['DC+'].some(n => n[0] === 'U4' && n[1] === '4' && n[2] === 'measured'));

// autosave: the file on disk has every edit, and the build reads the same nets as the page
const saved = await flush();
const onDisk = app.read(), inPage = await E(() => window.__editor.state());
check('edits saved to scenario.json', saved.state === 'saved' && JSON.stringify(onDisk) === JSON.stringify(inPage)
  && onDisk.traces.some(t => t.evidence === 'test trace' && t.net === 'M-')
  && onDisk.nets['DC+'].nodes.some(n => n.ref === 'U4' && n.pin === '4' && n.conf === 'measured' && n.evidence === 'test: continuity to DC+')
  && onDisk.parts.U4.box.top[0] > b0[0], JSON.stringify(saved));
const python = process.env.PYTHON || 'python3';
const buildNets = JSON.parse(execFileSync(python, ['-I', path.resolve('../scripts/build.py'), app.dir, '--dump-nets'], { encoding: 'utf8' }));
const pageNets = await E(() => window.__editor.nets());
const norm = (o) => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
check('the build reads the same nets as the page', norm(buildNets) === norm(pageNets));
await reload();
check('edits still there after a reload', (await E(() => window.__editor.state().traces.length)) === tracesBefore + 1);

// an edit the build refuses is not saved; undo, and the next save goes through
await E(() => window.__editor.mutate((d) => { d.traces[0].net = 'NO_SUCH_NET'; }));
const refused = await flush();
const status = await E(() => document.querySelector('#savestatus')?.dataset.state);
check('a refused edit is reported, not saved', refused.state === 'error' && refused.errors.some(e => e.includes('NO_SUCH_NET')) && status === 'error'
  && app.read().traces[0].net !== 'NO_SUCH_NET', refused.errors.join(' | '));
await E(() => window.__editor.mutate((d) => { d.traces[0].net = 'M+'; }));
check('the next valid edit saves', (await flush()).state === 'saved');

// something else changes scenario.json: the next save stops and asks for a reload
const external = app.read(); external.board.description = 'Changed by another program.';
fs.writeFileSync(path.join(app.dir, 'scenario.json'), JSON.stringify(external, null, 2) + '\n');
await E(() => window.__editor.mutate((d) => { d.board.model_date = '2026-12-01'; }));
const conflict = await flush();
check('a change on disk is not overwritten', conflict.state === 'conflict' && app.read().board.description === 'Changed by another program.', conflict.state);
await reload();
check('reload picks up the change on disk', (await E(() => window.__editor.state().board.description)) === 'Changed by another program.');

// ---------------------------------------------------------------- editing the scenario, parts and nets
const setField = (sel, v) => E(([sel, v]) => { const i = document.querySelector(sel); i.value = v; i.dispatchEvent(new Event('change')); }, [sel, v]);
const answer = async (text) => {
  await page.waitForSelector('[data-dialog] [data-ok]');
  if (text !== undefined) await page.type('[data-dialog="prompt"] input', text);
  await E(() => document.querySelector('[data-dialog] [data-ok]').click());
  await page.waitForFunction(() => !document.querySelector('[data-dialog]'));
};
await page.click('#title');
await page.waitForSelector('#editscenario');
await page.click('#editscenario');
await page.waitForSelector('#scenarioform');
await setField('#stitle', 'Homestar Flux (test)');
await setField('#sdesc', 'A test description.');
await flush();
check('rename the scenario', app.read().board.title === 'Homestar Flux (test)' && app.read().board.description === 'A test description.'
  && (await E(() => document.querySelector('#title').textContent)) === 'Homestar Flux (test)');
check('the scenario view shows only its form, without the board editor', await E(() => !document.querySelector('#detail').textContent.includes('Confidence levels')
  && !document.querySelector('#detail').textContent.includes('Select a net') && !document.querySelector('#detail').parentElement.querySelector('[data-editbar], #clear')));

// part: rename C9 to C90, set its value, type and package, rename a pin, add one
if (await E(() => document.querySelector('#edit').dataset.state !== 'on')) await E(() => document.querySelector('#edit').click());
await E(() => document.querySelector('#parts tr[data-ref="C9"]').click());
await setField('#pref', 'C90');
await page.waitForSelector('#partform');
await setField('#pvalue', '100 nF');
await page.select('#pkind', 'electrolytic');
await setField('#ppackage', '0805');
await setField('#detail tr[data-pin="1"] .pname', '+');
await E(() => document.querySelector('#pinadd').click()); await answer('3');
await E(() => { document.querySelector('#detail').scrollTop = 0; }); await page.screenshot({ path: 'shots/edit-partform.png' });
await flush();
const c90 = app.read();
check('edit a part: reference, value, type, package, pins', !c90.parts.C9 && c90.parts.C90?.value === '100 nF' && c90.parts.C90.kind === 'electrolytic'
  && c90.parts.C90.package === '0805' && c90.parts.C90.pins['1'] === '+' && c90.parts.C90.pins['3'] === '3'
  && Object.values(c90.nets).some(n => n.nodes.some(x => x.ref === 'C90')) && !JSON.stringify(c90.schematic_layout).includes('"C9.'),
  JSON.stringify(c90.parts.C90));

// add a part, then delete it
await E(() => document.querySelector('#addpart').click()); await answer('R99');
await flush();
check('add a part', !!app.read().parts.R99 && (await E(() => document.querySelector('#pref')?.value)) === 'R99');
await E(() => document.querySelector('#pdel').click()); await answer();
await flush();
check('delete a part', !app.read().parts.R99);

// net: rename M- to MOTOR_N (its traces follow), then delete SSL-
await E(() => [...document.querySelectorAll('#nets li')].find(l => l.dataset.net === 'M-').click());
await setField('#netname', 'MOTOR_N');
await page.waitForFunction(() => document.querySelector('#netname')?.value === 'MOTOR_N');
await setField('#netdesc', 'Motor, negative side.');
await flush();
const renamed = app.read();
check('rename a net', !renamed.nets['M-'] && renamed.nets.MOTOR_N?.description === 'Motor, negative side.' && renamed.traces.some(t => t.net === 'MOTOR_N') && !renamed.traces.some(t => t.net === 'M-'));
const sslPins = renamed.nets['SSL-'].nodes.length;
await E(() => [...document.querySelectorAll('#nets li')].find(l => l.dataset.net === 'SSL-').click());
await E(() => document.querySelector('#netdel').click()); await answer();
const afterDel = await flush();
check('delete a net', afterDel.state === 'saved' && !app.read().nets['SSL-'] && sslPins > 0, JSON.stringify(afterDel));

// ---------------------------------------------------------------- investigate: follow the plan (clean model)
fs.writeFileSync(path.join(app.dir, 'scenario.json'), app.original);
await reload();
const record = () => JSON.parse(fs.readFileSync(path.join(app.dir, 'record.json'), 'utf8'));
const inv = () => E(() => window.__editor.investigation());
const stepIs = (id) => page.waitForFunction((id) => document.querySelector('#step')?.dataset.step === id, { timeout: 15000 }, id);
const pyStatus = () => JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-I', path.resolve('../scripts/investigation.py'), 'status', app.dir, '--json'], { encoding: 'utf8' }));
await E(() => window.__ws.applyPreset('investigate'));
await stepIs('safety');
const inv0 = await E(() => ({ phases: document.querySelectorAll('#phases [data-phase]').length, suspects: document.querySelectorAll('#suspects [data-suspect]').length,
  open: document.querySelectorAll('#suspects [data-status="open"]').length, banner: !!document.querySelector('#needsupdate'), flag: !!document.querySelector('#planflag') }));
check('the plan opens on its first step', inv0.phases === 4 && inv0.suspects === 8 && inv0.open === 6 && !inv0.banner && !inv0.flag, JSON.stringify(inv0));
const oq = await E(() => ({ n: document.querySelectorAll('#qs [data-question]').length, step: document.querySelector('#qs [data-question="OQ1"] [data-qstep]')?.dataset.qstep }));
check('open questions sit in the Investigate tab, with the step that settles each', oq.n === 8 && oq.step === 'vdd-to-dc', JSON.stringify(oq));
await page.screenshot({ path: 'shots/investigate.png' });
// the answer can't be saved until the set-up is ticked
await E(() => document.querySelector('[data-answer="ready"]').click());
const locked = await E(() => document.querySelector('#stepsave').disabled);
await E(() => document.querySelectorAll('#setup [data-setup]').forEach((c) => c.click()));
await E(() => document.querySelector('#stepsave').click());
await stepIs('u4-supply-to-ground');
const r1 = record().results[0];
check('set-up first, then the answer is saved and the plan moves on', locked && r1?.step === 'safety' && r1.answer === 'ready' && r1.outcome === 'pass' && r1.plan_revision === 1, JSON.stringify(r1));
// a reading preselects the answer whose range it falls in; its effects apply at once
await E(() => document.querySelectorAll('#setup [data-setup]').forEach((c) => c.click()));
await page.type('#step [data-reading="ohms"]', 'OL');
const matched = await E(() => document.querySelector('#step [data-answer][data-matched]')?.dataset.answer);
await E(() => document.querySelector('#stepsave').click());
await stepIs('u4-outputs');
const r2 = record().results[1], st2 = await inv();
check('a reading selects its range, and the effects apply', matched === 'ok' && r2.readings?.ohms === 'OL' && r2.effects?.parts?.[0]?.refs.includes('C7')
  && st2.parts.C7?.status === 'cleared' && st2.suspects.find((x) => x.id === 'S3')?.trend === 'less_likely', JSON.stringify({ matched, r2 }));
check('the page and investigation.py agree on the current step', pyStatus().plan.current === st2.walked.current && st2.walked.path.length === 2, st2.walked.current);
// four readings, none shorted
await E(() => document.querySelectorAll('#setup [data-setup]').forEach((c) => c.click()));
for (const [k, v] of [['outa_gnd', '850'], ['outb_gnd', '900'], ['outa_vdd', 'OL'], ['outb_vdd', 'OL']]) await page.type(`#step [data-reading="${k}"]`, v);
check('four readings match one answer', (await E(() => document.querySelector('#step [data-answer][data-matched]')?.dataset.answer)) === 'none');
await E(() => document.querySelector('#stepsave').click());
await stepIs('diode-sweep');
// a sweep: each item is tested in the dialog, with the plan's procedure
await E(() => document.querySelector('[data-test-item="D10"]').click());
await page.waitForSelector('#testdialog');
await page.type('#testdialog [data-reading="fwd"]', '0.62');
await page.type('#testdialog [data-reading="rev"]', 'OL');
const dMatched = await E(() => document.querySelector('#testdialog [data-answer][data-matched]')?.dataset.answer);
await page.screenshot({ path: 'shots/test-dialog.png' });
await E(() => document.querySelector('#tsave').click());
await page.waitForFunction(() => !document.querySelector('#testdialog') && document.querySelector('#sweep [data-item="D10"] [data-outcome="pass"]'));
const r4 = record().results[3];
check('a sweep item is tested and recorded', dMatched === 'good' && r4.step === 'diode-sweep' && r4.item === 'D10' && r4.target?.ref === 'D10' && r4.outcome === 'pass'
  && (await E(() => document.querySelector('#step').dataset.step)) === 'diode-sweep', JSON.stringify(r4));
// look back at an earlier step: its answer, and a way to answer it again
await E(() => document.querySelector('#path [data-path="u4-supply-to-ground"]').click());
await stepIs('u4-supply-to-ground');
check('an earlier step shows its answer', await E(() => document.querySelector('#answered')?.dataset.result === 'R2' && !!document.querySelector('#again')));
await E(() => document.querySelector('#path [data-current]').click());
await stepIs('diode-sweep');
// the step looks wrong: the plan needs an update
await page.click('#stepmore');
await page.waitForSelector('[data-escape="disputed"]');
await E(() => document.querySelector('[data-escape="disputed"]').click());
await answer('D12 is not where the photo says.');
await page.waitForSelector('#needsupdate');
const r5 = record().results[4];
check('disputing a step asks for a plan update', r5.outcome === 'disputed' && r5.step === 'diode-sweep' && r5.notes.startsWith('D12')
  && (await E(() => !!document.querySelector('#planflag') && document.querySelector('#updatereasons').textContent.includes('disputed'))), JSON.stringify(r5));
// an instruction for the agent's next round (a second later: entries are timed to the second)
await new Promise((r) => setTimeout(r, 1100));
await E(() => document.querySelector('#addnote').click());
await page.waitForSelector('#notedialog');
await E(() => document.querySelector('#notedialog [data-kind="instructions"]').click());
await page.type('#notetext', 'Check where D12 really is on the bottom photo.');
await E(() => document.querySelector('#notesave').click());
await page.waitForFunction(() => !document.querySelector('#notedialog'));
const i1 = record().instructions[0];
check('an instruction is saved with the step it was written on', i1?.id === 'I1' && i1.step === 'diode-sweep'
  && (await E(() => document.querySelector('#updatereasons').textContent.includes('new instruction: I1'))), JSON.stringify(i1));
// the repair log: the timeline, and voiding the disputed result
await E(() => window.__ws.reveal('log'));
const tl = await E(() => ({ first: document.querySelector('#timeline [data-entry]')?.dataset.entry, waiting: !!document.querySelector('[data-entry="I1"] [data-waiting]'),
  obs: document.querySelectorAll('#timeline [data-kind="observations"]').length, plan: !!document.querySelector('#timeline [data-kind="plan"]') }));
check('the repair log shows the timeline, newest first', tl.first === 'I1' && tl.waiting && tl.obs === 15 && tl.plan, JSON.stringify(tl));
await page.screenshot({ path: 'shots/log.png' });
await E(() => document.querySelector('[data-void-btn="R5"]').click());
await answer('Found D12, my mistake.');
await page.waitForFunction(() => document.querySelector('[data-entry="R5"]')?.dataset.void !== undefined);
const st3 = await inv();
check('a voided result counts for nothing', record().results[4].void?.reason === 'Found D12, my mistake.' && st3.walked.current === 'diode-sweep' && !st3.walked.flag
  && st3.reasons.includes('an entry was voided'), JSON.stringify(st3.reasons));
// the agent writes revision 2 (here: the same tree, a reply to I1), stamped: the page picks it up by itself
const plan2 = JSON.parse(fs.readFileSync(path.join(app.dir, 'plan.json'), 'utf8'));
plan2.revision = 2;
plan2.history.push({ revision: 2, date: '2026-11-23', reason: 'R1 to R5, I1.', changes: 'No change to the tree.', replies: { I1: 'D12 is near U1, as modelled.' } });
fs.writeFileSync(path.join(app.dir, 'plan.json'), JSON.stringify(plan2, null, 2));
execFileSync(process.env.PYTHON || 'python3', ['-I', path.resolve('../scripts/investigation.py'), 'stamp', app.dir], { encoding: 'utf8' });
await page.waitForFunction(() => document.querySelector('[data-entry="I1"] [data-reply]'), { timeout: 15000 });
const st4 = await inv();
check('a new plan on disk is picked up, with the reply', st4.revision === 2 && st4.reasons.length === 0 && st4.walked.current === 'diode-sweep', JSON.stringify(st4.reasons));
// editing the model makes the plan out of date; undoing it makes it current again
await E(() => window.__editor.mutate((d) => { d.parts.D12.value = 'LL4148'; }));
await flush();
await page.waitForFunction(() => window.__editor.investigation().reasons.includes('the board model changed'), { timeout: 10000 });
await E(() => document.querySelector('#undo').click());
await flush();
await page.waitForFunction(() => window.__editor.investigation().reasons.length === 0, { timeout: 10000 });
check('a model change makes the plan out of date, undo restores it', true);
// test a part outside the plan, from the board
await E(() => window.__ws.reveal('parts'));
await E(() => document.querySelector('#parts tr[data-ref="D13"]').click());
await E(() => document.querySelector('#ptest').click());
await page.waitForSelector('#testdialog');
const free = await E(() => ({ proto: document.querySelector('#tproto')?.value ?? 'diode', lifted: !!document.querySelector('#tcircuit') }));
await page.type('#testdialog [data-reading="fwd"]', '0.01');
await page.type('#testdialog [data-reading="rev"]', '0.01');
await E(() => document.querySelector('#tsave').click());
await page.waitForFunction(() => document.querySelector('#ptests [data-outcome="fail"]'));
const r6 = record().results.at(-1);
check('a part tested outside the plan', free.proto === 'diode' && free.lifted && !r6.step && r6.target?.ref === 'D13' && r6.answer === 'shorted' && r6.outcome === 'fail', JSON.stringify({ free, r6 }));
// the parts table's Tested column: the latest outcome, or a button that opens the test
const testedCol = await E(() => ({ d13: document.querySelector('#parts tr[data-ref="D13"] [data-tested]')?.dataset.tested,
  d10: document.querySelector('#parts tr[data-ref="D10"] [data-tested]')?.dataset.tested, d12: !!document.querySelector('#parts tr[data-ref="D12"] [data-test-part]:not([disabled])'),
  // the plan has no procedure for a resistor: no diode test offered in its place
  r1b: !!document.querySelector('#parts tr[data-ref="R1B"] [data-test-part][disabled]') }));
await E(() => document.querySelector('[data-test-part="D12"]').click());
await page.waitForSelector('#testdialog');
const fromTable = await E(() => document.querySelector('#testdialog').textContent.includes('Test D12'));
await E(() => [...document.querySelectorAll('#testdialog button')].find((b) => b.textContent === 'Cancel').click());
await page.waitForFunction(() => !document.querySelector('#testdialog'));
check('the Tested column shows the latest outcome, or a button to test (none without a procedure for the kind)', testedCol.d13 === 'fail' && testedCol.d10 === 'pass' && testedCol.d12 && testedCol.r1b && fromTable, JSON.stringify(testedCol));
check('the investigation is exported', /D13/.test(fs.readFileSync(path.join(app.dir, 'exports/investigation.md'), 'utf8'))
  && fs.readFileSync(path.join(app.dir, 'exports/investigation.md'), 'utf8').includes('Reply (revision 2)'));
// Edit part opens the editor on the part
await E(() => document.querySelector('#pedit').click());
check('Edit part opens its form', await E(() => !!document.querySelector('#partform') && document.querySelector('#edit').dataset.state === 'on'));
await E(() => document.querySelector('#edit').click());

// ---------------------------------------------------------------- schematic editor (clean state)
fs.writeFileSync(path.join(app.dir, 'scenario.json'), app.original);
await reload();
await E(() => window.__ws.applyPreset('schematic'));
await page.waitForSelector('[data-schview="edit"]');
await E(() => document.querySelector('[data-schview="edit"]').click());
const s0 = await E(() => window.__editor.sch.analyse());
const nParts = await E(() => document.querySelectorAll('#schedit-svg [data-ref]').length);
check('schematic editor opens clean', nParts === 55 && s0.problems.length === 0, `${nParts} parts, ${s0.problems.length} problems, loose: ${s0.loose.join(',')}`);
await page.screenshot({ path: 'shots/sch-edit.png' });

// bring a sheet point into view in the zoomed editor before using the mouse there
const focusSch = (x, y) => E(([x, y]) => { const box = document.querySelector('.schedit-canvas'), p = window.__editor.sch.toScreen(x, y), b = box.getBoundingClientRect();
  box.scrollLeft += p.x - b.left - b.width / 2; box.scrollTop += p.y - b.top - b.height / 2; }, [x, y]);
// drag U4 by 10.16 mm right and 5.08 mm down: its wires must follow and stay valid
const su4 = await E(() => window.__editor.sch.layout().parts.U4);
await focusSch(su4[0], su4[1]);
const sfrom = await E(([x, y]) => window.__editor.sch.toScreen(x, y), su4);
const sto = await E(([x, y]) => window.__editor.sch.toScreen(x + 10.16, y + 5.08), su4);
await page.mouse.move(sfrom.x, sfrom.y); await page.mouse.down(); await page.mouse.move(sto.x, sto.y, { steps: 8 }); await page.mouse.up();
const su4b = await E(() => window.__editor.sch.layout().parts.U4);
const s1 = await E(() => window.__editor.sch.analyse());
check('drag a part; wires follow', Math.abs(su4b[0] - su4[0] - 10.16) < 0.01 && Math.abs(su4b[1] - su4[1] - 5.08) < 0.01 && s1.problems.length === 0,
  `${su4} -> ${su4b}; ${s1.problems.join(' | ')}`);
await page.screenshot({ path: 'shots/sch-drag.png' });

// draw a wire from C3.1 (net unknown) to J_DCN.1 (GND)
await E(() => document.querySelector('[data-stool="wire"]').click());
const sc3 = await E(() => window.__editor.sch.pinEnd('C3.1')), sdcn = await E(() => window.__editor.sch.pinEnd('J_DCN.1'));
await focusSch(sc3.x, (sc3.y + sdcn.y) / 2);
const sa1 = await E(([x, y]) => window.__editor.sch.toScreen(x, y), [sc3.x, sc3.y]), sb1 = await E(([x, y]) => window.__editor.sch.toScreen(x, y), [sdcn.x, sdcn.y]);
await page.mouse.click(sa1.x, sa1.y); await page.mouse.click(sb1.x, sb1.y, { clickCount: 2 });
const s2 = await E(() => window.__editor.sch.analyse());
check('draw a wire; unknown pin and missing power symbol reported',
  s2.problems.some(t => t.includes('C3.1') && t.includes('unknown')) && s2.problems.some(t => t.includes('needs a power symbol')), s2.problems.join(' | '));
await E(() => document.querySelector('#schedit-problems [data-fix]')?.click());
const nets3 = await E(() => window.__editor.nets());
check('one-click fix adds the pin to the net as assumed', nets3.GND.some(n => n[0] === 'C3' && n[1] === '1' && n[2] === 'assumed'));
await E(() => { document.querySelector('[data-stool="power"]').click(); });
await page.select('#power-net', 'GND'); await page.select('#power-dir', 'L');
await page.mouse.click(sb1.x, sb1.y);
const s4 = await E(() => window.__editor.sch.analyse());
check('place a power symbol; layout valid again', s4.problems.length === 0, s4.problems.join(' | '));
await E(() => { const r = window.__editor.sch.pinEnd('U4.4'); const box = document.querySelector('.schedit-canvas'); const p = window.__editor.sch.toScreen(r.x, r.y); const b = box.getBoundingClientRect(); box.scrollLeft += p.x - b.left - 200; box.scrollTop += p.y - b.top - 150; });
await page.screenshot({ path: 'shots/sch-wire.png' });
const schSaved = await flush();
const schDisk = app.read();
check('the layout is saved and the build accepts it', schSaved.state === 'saved' && schDisk.schematic?.wires?.length > 0
  && schDisk.nets.GND.nodes.some(n => n.ref === 'C3' && n.pin === '1'), JSON.stringify(schSaved));

check('no JS errors', errors.length === 0, errors.join(' | '));
console.log(results.join('\n'));
await browser.close();
app.close();
process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
