/* Analyze sim_data.json to sanity-check the reversal-learning + mouse data. */
const fs = require('fs');
const rows = JSON.parse(fs.readFileSync('sim_data.json', 'utf8'));
const trials = rows.filter(r => r.trajectory && r.is_practice === false);
const practice = rows.filter(r => r.trajectory && r.is_practice === true);

const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : NaN;
const pct = a => (100*mean(a)).toFixed(0)+'%';

console.log('=== COUNTS ===');
console.log(`practice trials: ${practice.length}`);
console.log(`main trials:     ${trials.length}`);
const blocks = [...new Set(trials.map(t=>t.block))].sort((a,b)=>a-b);
console.log(`blocks:          ${blocks.join(', ')}`);

console.log('\n=== ACCURACY BY BLOCK (chose currently-correct symbol) ===');
for (const b of blocks) {
  const bt = trials.filter(t=>t.block===b);
  const correctId = bt[0].correct_id;
  console.log(`block ${b} (correct=${correctId}, n=${bt.length}): acc=${pct(bt.map(t=>t.correct?1:0))}  reward_rate=${pct(bt.map(t=>t.rewarded?1:0))}`);
}

console.log('\n=== REVERSAL EFFECT (accuracy in 5-trial bins around each block boundary) ===');
// position within block 0..19; show early vs late accuracy per block.
for (const b of blocks) {
  const bt = trials.filter(t=>t.block===b);
  const first5 = bt.slice(0,5).map(t=>t.correct?1:0);
  const last5  = bt.slice(-5).map(t=>t.correct?1:0);
  console.log(`block ${b}: first5=${pct(first5)}  ->  last5=${pct(last5)}`);
}

console.log('\n=== FEEDBACK CONTINGENCY CHECK (should be ~80/20) ===');
const whenCorrect = trials.filter(t=>t.correct);
const whenWrong   = trials.filter(t=>!t.correct);
console.log(`P(reward | chose correct) = ${pct(whenCorrect.map(t=>t.rewarded?1:0))} (target 80%)`);
console.log(`P(reward | chose wrong)   = ${pct(whenWrong.map(t=>t.rewarded?1:0))} (target 20%)`);

console.log('\n=== SIDE BALANCE (correct symbol should be ~50% left) ===');
const correctLeft = trials.filter(t => (t.correct_id===t.left_id)).length;
console.log(`correct symbol on left: ${(100*correctLeft/trials.length).toFixed(0)}%`);
const choseLeft = trials.filter(t=>t.chosen_side==='left').length;
console.log(`participant chose left: ${(100*choseLeft/trials.length).toFixed(0)}%`);

console.log('\n=== TIMING (ms) ===');
const summ = (name, vals) => {
  const s=[...vals].sort((a,b)=>a-b);
  console.log(`${name}: mean=${mean(vals).toFixed(0)}  median=${s[Math.floor(s.length/2)]}  min=${s[0]}  max=${s[s.length-1]}`);
};
summ('rt        ', trials.map(t=>t.rt));
summ('init_time ', trials.map(t=>t.init_time));
summ('move_time ', trials.map(t=>t.movement_time));

console.log('\n=== MOUSE TRAJECTORY ===');
summ('n_samples ', trials.map(t=>t.n_samples));
summ('max_dev   ', trials.map(t=>t.max_deviation));
summ('auc       ', trials.map(t=>t.auc));
summ('x_flips   ', trials.map(t=>t.x_flips));
const anyNorm = trials[0].trajectory_norm;
console.log(`trajectory_norm present: ${!!anyNorm}, points: ${anyNorm ? anyNorm.x.length : 'n/a'}`);
console.log(`geometry saved per trial: ${!!(trials[0].left_rect && trials[0].start_rect && trials[0].stage_w)}`);

// A concrete example trajectory (first 6 and last 2 samples).
const ex = trials.find(t=>t.n_samples>8) || trials[0];
console.log('\n=== EXAMPLE TRAJECTORY (trial block '+ex.block+', chose '+ex.chosen_id+') ===');
console.log('first samples:', ex.trajectory.slice(0,6).map(p=>`(${p.x},${p.y},t${p.t})`).join(' '));
console.log('last samples :', ex.trajectory.slice(-2).map(p=>`(${p.x},${p.y},t${p.t})`).join(' '));

console.log('\n=== SANITY VERDICT ===');
const checks = [
  ['86-ish trials recorded', trials.length>=70],
  ['4 blocks present', blocks.length===4],
  ['contingency reverses across blocks', new Set(blocks.map(b=>trials.find(t=>t.block===b).correct_id)).size===2],
  ['reward contingency ~80/20', mean(whenCorrect.map(t=>t.rewarded?1:0))>0.6 && mean(whenWrong.map(t=>t.rewarded?1:0))<0.4],
  ['sides ~balanced', Math.abs(correctLeft/trials.length-0.5)<0.15],
  ['trajectories non-trivial', mean(trials.map(t=>t.n_samples))>10],
  ['deviation varies (>0 spread)', Math.max(...trials.map(t=>Math.abs(t.max_deviation)))>10],
  ['timing plausible', mean(trials.map(t=>t.rt))>150 && mean(trials.map(t=>t.rt))<5000],
];
let ok=true;
for(const [n,c] of checks){ console.log((c?'PASS':'FAIL')+' - '+n); if(!c) ok=false; }
process.exit(ok?0:1);
