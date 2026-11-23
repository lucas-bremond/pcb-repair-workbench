// Test harness: a copy of a committed scenario in a temporary folder, served by the real server
// (app/server/server.mjs) over the built app (app/web/dist), so the tests can edit it freely. Its
// scenario.json, plan.json and record.json come from fixtures/<example>/, a frozen copy, so the
// tests don't follow the real repair's progress (refresh them when the format changes).
// Needs Node.js and a Python with app/scripts/requirements.txt (PYTHON, python3 by default).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const APP = path.resolve(import.meta.dirname, '..');
const REPO = path.dirname(APP);

export async function startServer(example = 'homestar-flux') {
  if (!fs.existsSync(path.join(APP, 'web/dist/index.html'))) throw new Error('app/web/dist is missing: run npm run build in app/web');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcb-scenarios-'));
  const roots = { scenarios: path.join(tmp, 'scenarios') };
  const dir = path.join(roots.scenarios, example);
  fs.cpSync(path.join(REPO, 'scenarios', example), dir, { recursive: true, filter: (p) => !p.split(path.sep).includes('generated') });
  // the scenario's three files are frozen in fixtures/: the real one moves on as the repair does
  const fixtures = path.join(APP, 'tests', 'fixtures', example);
  for (const f of fs.existsSync(fixtures) ? fs.readdirSync(fixtures) : []) fs.copyFileSync(path.join(fixtures, f), path.join(dir, f));
  const proc = spawn(process.execPath, [path.join(APP, 'server/server.mjs')], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', STATIC_DIR: path.join(APP, 'web/dist'),
      SCENARIO_ROOTS: Object.entries(roots).map(([k, v]) => `${k}=${v}`).join(',') },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const url = await new Promise((resolve, reject) => {
    let out = '';
    proc.stdout.on('data', (d) => { out += d; const m = out.match(/http:\/\/[^\s]+:(\d+)/); if (m) resolve(`http://127.0.0.1:${m[1]}/`); });
    proc.on('exit', (code) => reject(new Error(`server exited (${code}): ${out}`)));
  });
  return {
    url, dir, id: `scenarios/${example}`, page: `${url}?s=scenarios/${example}`,
    original: fs.readFileSync(path.join(dir, 'scenario.json'), 'utf8'),
    read: () => JSON.parse(fs.readFileSync(path.join(dir, 'scenario.json'), 'utf8')),
    close: () => { proc.kill(); fs.rmSync(tmp, { recursive: true, force: true }); },
  };
}
