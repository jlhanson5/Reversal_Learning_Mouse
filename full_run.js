/* Drive the REAL index.html with a simulated learning participant, capture the
 * data the task submits, and print an analysis to check it's reasonable. */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (req.url === '/jatos.js')   { res.writeHead(404); res.end(); return; } // simulate no-JATOS
  let p = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'text/plain' });
    res.end(d);
  });
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => server.listen(8140, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, acceptDownloads: true });

  // Capture the JSON the task tries to download on completion.
  let dataJson = null;
  page.on('download', async d => {
    const fp = path.join(__dirname, 'sim_data.json');
    await d.saveAs(fp);
    dataJson = fs.readFileSync(fp, 'utf8');
  });

  await page.goto('http://localhost:8140/', { waitUntil: 'domcontentloaded' });

  // Simple reinforcement-learning policy over stimulus identities.
  const Q = { A: 0.5, B: 0.5 };
  const ALPHA = 0.35, EPS = 0.10;
  let trialsDone = 0;

  async function clickAnyButton() {
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')]
        .filter(b => b.offsetParent !== null && b.id !== 'mc-start');
      if (!btns.length) return false;
      const pref = ['Next', 'Begin task', 'Start practice', 'Begin', 'Finish', 'Continue'];
      for (const p of pref) { const m = btns.find(b => b.textContent.trim() === p); if (m) { m.click(); return true; } }
      btns[btns.length - 1].click();
      return true;
    });
    return clicked;
  }

  async function doTrial() {
    // Which identity is on which side (blue #2f7fd1 = A, orange = B).
    const ids = await page.evaluate(() => {
      const bg = el => el ? getComputedStyle(el).backgroundColor : '';
      const idOf = c => c.replace(/\s/g,'').includes('47,127,209') ? 'A' : 'B';
      return {
        left:  idOf(bg(document.querySelector('#mc-left .stim'))),
        right: idOf(bg(document.querySelector('#mc-right .stim')))
      };
    });

    // Epsilon-greedy choice.
    let chosenId;
    if (Math.random() < EPS) chosenId = Math.random() < 0.5 ? 'A' : 'B';
    else chosenId = Q.A === Q.B ? (Math.random() < 0.5 ? 'A' : 'B') : (Q.A > Q.B ? 'A' : 'B');
    const chosenSide = ids.left === chosenId ? 'left' : 'right';

    // Geometry.
    const boxes = await page.evaluate(() => {
      const r = el => { const b = el.getBoundingClientRect(); return { x:b.x+b.width/2, y:b.y+b.height/2 }; };
      return { start: r(document.querySelector('#mc-start')),
               left:  r(document.querySelector('#mc-left')),
               right: r(document.querySelector('#mc-right')) };
    });
    const s = boxes.start, t = boxes[chosenSide], comp = boxes[chosenSide === 'left' ? 'right' : 'left'];

    // Click Start to begin tracking.
    await page.mouse.move(s.x, s.y);
    await page.mouse.click(s.x, s.y);
    await sleep(60); // brief initiation pause

    // Curved path; more curvature toward the competitor when the two options
    // are close in value (choice conflict) + a little noise.
    const conflict = 1 - Math.min(1, Math.abs(Q.A - Q.B) * 2);   // 0..1
    const curveAmt = (25 + 90 * conflict) * (0.6 + Math.random()*0.8);
    const dirX = Math.sign(comp.x - t.x) || 1;  // toward competitor horizontally
    const N = 26;
    for (let i = 1; i <= N; i++) {
      const f = i / N;
      const bow = Math.sin(Math.PI * f) * curveAmt * dirX;
      const jx = (Math.random()-0.5) * 3, jy = (Math.random()-0.5) * 3;
      await page.mouse.move(s.x + (t.x - s.x) * f + bow + jx, s.y + (t.y - s.y) * f + jy);
      await sleep(4);
    }
    await page.mouse.click(t.x, t.y);

    // Read feedback (+1 / 0) and update value estimate.
    await sleep(120);
    const fb = await page.evaluate(() => (document.querySelector('#mc-feedback')||{}).textContent || '');
    const reward = fb.trim() === '+1' ? 1 : 0;
    Q[chosenId] = Q[chosenId] + ALPHA * (reward - Q[chosenId]);
    trialsDone++;
  }

  // Main loop: advance instructions/transition screens and play trials.
  const t0 = Date.now();
  while (!dataJson && Date.now() - t0 < 300000) {
    if (await page.$('#mc-start')) { await doTrial(); continue; }
    if (await clickAnyButton()) { await sleep(120); continue; }
    await sleep(80); // ITI / feedback / blank
  }

  await sleep(400);
  await browser.close();
  server.close();

  if (!dataJson) { console.log('ERROR: no data captured'); process.exit(1); }
  console.log(`Completed ${trialsDone} mouse-choice trials. Data saved to sim_data.json`);
})();
