// Headless render harness for this box: drives the Playwright-bundled Chromium via
// the DevTools protocol (no puppeteer), loads the running app, cycles species and
// screenshots each to /tmp/nudi_<id>.png. Also reports WebGL state + console
// errors so a broken shader shows up here instead of silently rendering black.
//
// Usage: `npm start` in one shell, then `npm run render` (optionally URL=..., or
// SPECIES=nanomia,physalia to shoot a subset, OUT=/tmp to change the dir).
import { spawn } from 'node:child_process';
import { writeFileSync, readdirSync, existsSync } from 'node:fs';

const base = process.env.HOME + '/.cache/ms-playwright';
const dir = readdirSync(base).find((d) => d.startsWith('chromium-') && !d.includes('headless'));
const CHROME = `${base}/${dir}/chrome-linux64/chrome`;
if (!existsSync(CHROME)) { console.error('no chromium at', CHROME); process.exit(1); }

const URL = process.env.URL || 'http://localhost:5185/';
const OUT = process.env.OUT || '/tmp';
const PORT = 9224;
const SPECIES = (process.env.SPECIES ||
  'chromodoris,hypselodoris,nembrotha,hexabranchus,phyllidia,jorunna,cadlina,willani,flabellina,glaucus,cratena,aeolidia,dirona,dendronotus,costasiella'
).split(',');

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  '--use-gl=angle', '--use-angle=vulkan', '--enable-unsafe-swiftshader',
  '--window-size=1280,900', '--no-first-run', '--no-sandbox',
  '--user-data-dir=/tmp/nudichrome', 'about:blank',
]);
chrome.stderr.on('data', () => {});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://localhost:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error('chrome devtools never came up');
}

async function main() {
  const page = await cdp();
  const ws = new (await import('ws')).WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled')
      logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
    if (m.method === 'Runtime.exceptionThrown') {
      const e = m.params.exceptionDetails;
      logs.push('[EXCEPTION] ' + (e.exception?.description || e.text));
    }
  });
  const send = (method, params = {}) =>
    new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: URL });
  await sleep(2500);

  const info = await send('Runtime.evaluate', {
    expression: `(() => {
      const c = document.querySelector('canvas');
      const gl = c && c.getContext('webgl2');
      return JSON.stringify({ hasCanvas: !!c, w: c?.width, h: c?.height, webgl2: !!gl,
        species: window.NUDI?.params?.id, bells: window.NUDI?.rig()?.bells?.length });
    })()`, returnByValue: true,
  });
  console.log('state:', info.result.value);

  // Hide UI chrome so gallery shots are just the animal on black.
  await send('Runtime.evaluate', {
    expression: `for (const id of ['gui-panel','panel-tab','title','hud']) {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    }`,
  });

  for (const sp of SPECIES) {
    await send('Runtime.evaluate', { expression: `window.NUDI.setSpecies('${sp}')` });
    await sleep(1400);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot?.data) writeFileSync(`${OUT}/nudi_${sp}.png`, Buffer.from(shot.data, 'base64'));
    process.stdout.write(`shot ${sp} `);
  }
  console.log('\n\n--- console (last 30) ---');
  console.log(logs.slice(-30).join('\n') || '(clean)');
  ws.close();
  chrome.kill();
  process.exit(0);
}
main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
