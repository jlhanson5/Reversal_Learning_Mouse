const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  let p = path.join(__dirname, req.url === '/' ? 'test_harness.html' : req.url.split('?')[0]);
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'text/plain' });
    res.end(data);
  });
});

(async () => {
  await new Promise(r => server.listen(8137, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:8137/', { waitUntil: 'networkidle' });

  // Start the trial.
  await page.waitForSelector('#mc-start', { timeout: 10000 });
  const startBox = await page.locator('#mc-start').boundingBox();
  await page.mouse.move(startBox.x + startBox.width/2, startBox.y + startBox.height/2);
  await page.mouse.click(startBox.x + startBox.width/2, startBox.y + startBox.height/2);

  // Move the cursor up toward the LEFT target in several steps (a real path).
  const leftBox = await page.locator('#mc-left').boundingBox();
  const tx = leftBox.x + leftBox.width/2, ty = leftBox.y + leftBox.height/2;
  const sx = startBox.x + startBox.width/2, sy = startBox.y + startBox.height/2;
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(sx + (tx-sx)*i/20, sy + (ty-sy)*i/20);
    await page.waitForTimeout(8);
  }
  await page.mouse.click(tx, ty);

  await page.waitForFunction('window.__done === true', { timeout: 10000 });
  const data = await page.evaluate('window.__data');

  const t = data.find(d => d.trajectory);
  const checks = [];
  const assert = (name, cond) => checks.push([name, !!cond]);
  assert('trial recorded', !!t);
  assert('chose left => A', t && t.chosen_id === 'A' && t.chosen_side === 'left');
  assert('correct flag true', t && t.correct === true);
  assert('trajectory has samples', t && t.trajectory.length > 5);
  assert('rt > 0', t && t.rt > 0);
  assert('init_time present', t && t.init_time !== null);
  assert('norm has 101 pts', t && t.trajectory_norm && t.trajectory_norm.x.length === 101);
  assert('metrics present', t && typeof t.max_deviation === 'number' && typeof t.auc === 'number');
  assert('geometry saved', t && t.left_rect && t.start_rect);
  assert('no console errors (except jatos 404)', errors.filter(e => !/jatos/.test(e)).length === 0);

  console.log('\n=== RESULTS ===');
  let ok = true;
  for (const [n, c] of checks) { console.log((c ? 'PASS' : 'FAIL') + ' - ' + n); if (!c) ok = false; }
  if (t) console.log('\nsample: chosen=%s correct=%s rewarded=%s rt=%dms init=%dms mt=%dms nsamp=%d md=%d auc=%d xflips=%d',
    t.chosen_id, t.correct, t.rewarded, t.rt, t.init_time, t.movement_time, t.n_samples, t.max_deviation, t.auc, t.x_flips);
  if (errors.length) console.log('\nconsole errors:', errors);

  await browser.close();
  server.close();
  process.exit(ok ? 0 : 1);
})();
