/* Verify the new instruction text + distinct practice shapes render, and grab
 * screenshots of a practice trial and a main-task trial. */
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico' || req.url === '/jatos.js') { res.writeHead(404); res.end(); return; }
  let p = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(p, (e, d) => { if (e){res.writeHead(404);res.end();return;} res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'text/plain'}); res.end(d); });
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => server.listen(8160, r));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await b.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto('http://localhost:8160/', { waitUntil: 'domcontentloaded' });
  await sleep(300);

  const results = [];
  const check = (n, c) => results.push([n, !!c]);

  // Screen 1 text.
  const h1 = await page.textContent('.instructions h1');
  const p1 = await page.textContent('.instructions');
  check('screen1 says "Hello!"', h1 && h1.trim() === 'Hello!');
  check('screen1 "a number of times"', p1.includes('a number of times'));

  const nextBtn = () => page.click('#jspsych-instructions-next');
  async function clickBtn(label) {
    const loc = page.getByRole('button', { name: label, exact: true });
    if (await loc.count()) { await loc.first().click(); return true; }
    return false;
  }

  // Advance instructions (3 pages) -> practice intro.
  await nextBtn(); await sleep(150);
  const p2 = await page.textContent('.instructions');
  check('screen2 simplified (no "noisy")', !p2.toLowerCase().includes('noisy'));
  check('screen2 has "swap"', p2.includes('swap'));
  await nextBtn(); await sleep(150);
  const p3 = await page.textContent('.instructions');
  check('screen3 "quickly"', p3.includes('Move your mouse quickly'));
  await nextBtn(); await sleep(150);
  await clickBtn('Start practice'); await sleep(250);

  // First practice trial: shapes present?
  const hasTri = await page.$('.stim-triangle');
  const hasDia = await page.$('.stim-diamond');
  check('practice shows triangle', !!hasTri);
  check('practice shows diamond', !!hasDia);
  check('practice does NOT show circle', !(await page.$('.stim-circle')));
  await page.screenshot({ path: 'shot_practice.png' });

  // Play through the 6 practice trials, then Begin task.
  async function playTrial() {
    const boxes = await page.evaluate(() => {
      const r = el => { const bb = el.getBoundingClientRect(); return {x:bb.x+bb.width/2,y:bb.y+bb.height/2}; };
      return { s:r(document.querySelector('#mc-start')), l:r(document.querySelector('#mc-left')) };
    });
    await page.mouse.click(boxes.s.x, boxes.s.y); await sleep(40);
    for (let i=1;i<=12;i++){ await page.mouse.move(boxes.s.x+(boxes.l.x-boxes.s.x)*i/12, boxes.s.y+(boxes.l.y-boxes.s.y)*i/12); await sleep(4); }
    await page.mouse.click(boxes.l.x, boxes.l.y);
    await sleep(1400); // feedback + iti
  }
  for (let i=0;i<6;i++){ if (await page.$('#mc-start')) await playTrial(); }
  // Transition screen -> Begin task.
  for (let k=0;k<10 && !(await page.$('#mc-start')); k++){ await clickBtn('Begin task'); await sleep(300); }

  const hasCircle = await page.$('.stim-circle');
  const hasSquare = await page.$('.stim-square');
  check('main task shows circle', !!hasCircle);
  check('main task shows square', !!hasSquare);
  check('main task does NOT show triangle', !(await page.$('.stim-triangle')));
  await page.screenshot({ path: 'shot_maintask.png' });

  await b.close(); server.close();
  let ok = true;
  console.log('=== VISUAL / TEXT CHECKS ===');
  for (const [n,c] of results){ console.log((c?'PASS':'FAIL')+' - '+n); if(!c) ok=false; }
  console.log(ok ? '\nALL PASS' : '\nSOME FAILED');
  process.exit(ok?0:1);
})();
