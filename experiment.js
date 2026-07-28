/* =========================================================================
 * experiment.js  —  Builds the jsPsych timeline for the reversal-learning
 * mouse-tracking task and handles data submission to JATOS.
 * ========================================================================= */

/* ---- Small utilities ------------------------------------------------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build a balanced sequence of "left"/"right" assignments for which side a
// given stimulus id appears on, ~50/50 within a block.
function balancedSides(n) {
  const half = Math.floor(n / 2);
  let sides = Array(half).fill("left").concat(Array(n - half).fill("right"));
  return shuffle(sides);
}

/* ---- Timeline construction ------------------------------------------ */
function buildTimeline(jsPsych) {
  const timeline = [];

  const stimById = {};
  CONFIG.stimuli.forEach(s => { stimById[s.id] = s; });
  const idA = CONFIG.stimuli[0].id;
  const idB = CONFIG.stimuli[1].id;

  // Which stimulus is correct in block 1.
  let block1Correct = CONFIG.initial_correct;
  if (block1Correct === null) block1Correct = Math.random() < 0.5 ? idA : idB;
  const otherId = block1Correct === idA ? idB : idA;

  // Correct id per block: alternates every block (a reversal at each boundary).
  const correctByBlock = [];
  for (let b = 0; b < CONFIG.n_blocks; b++) {
    correctByBlock.push(b % 2 === 0 ? block1Correct : otherId);
  }

  /* ---- Instructions ------------------------------------------------- */
  timeline.push({
    type: jsPsychInstructions,
    pages: [
      `<div class="instructions">
        <h1>Hello!</h1>
        <p>In this task, you will choose between two symbols a number of times.</p>
        <p>On each trial, click the <b>${CONFIG.start_label}</b> button at the
           bottom of the screen, then move your mouse up to the symbol you want
           and click it.</p>
       </div>`,
      `<div class="instructions">
        <h1>How to win points</h1>
        <p>One symbol is usually the <b>better</b> choice — it earns
           <b>+1</b> more often than the other.</p>
        <p>One symbol wins more often than the other, but not every time.
           Your job is to figure out which one.</p>
        <p><b>Important:</b> sometimes the two symbols swap. The one that was
           better becomes the worse one. If your symbol stops winning, switch
           to the other symbol.</p>
       </div>`,
      `<div class="instructions">
        <h1>Please note</h1>
        <p>Move your mouse quickly as you make your choice.</p>
        <p>Use a mouse or trackpad on a computer (not a touchscreen).</p>
        <p>Click <b>Next</b> to begin${CONFIG.include_practice ? " with a few practice trials" : ""}.</p>
       </div>`
    ],
    show_clickable_nav: true,
    button_label_previous: "Back",
    button_label_next: "Next"
  });

  /* ---- Practice block ----------------------------------------------- */
  if (CONFIG.include_practice) {
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `<div class="instructions"><h2>Practice</h2>
        <p>These ${CONFIG.practice_trials} trials are for practice and always
        give clear feedback. Ready?</p></div>`,
      choices: ["Start practice"]
    });

    // Practice uses its own visually distinct stimulus set.
    const practiceStimById = {};
    CONFIG.practice_stimuli.forEach(s => { practiceStimById[s.id] = s; });
    const pIdA = CONFIG.practice_stimuli[0].id, pIdB = CONFIG.practice_stimuli[1].id;

    const practiceCorrect = Math.random() < 0.5 ? pIdA : pIdB;
    const pSides = balancedSides(CONFIG.practice_trials);
    for (let i = 0; i < CONFIG.practice_trials; i++) {
      timeline.push(makeTrial(jsPsych, practiceStimById, {
        block: -1,
        is_practice: true,
        correct_id: practiceCorrect,
        reward_prob: 1.0,               // deterministic in practice
        correctSide: pSides[i]
      }));
      timeline.push(iti());
    }

    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `<div class="instructions"><h2>Great!</h2>
        <p>The real task starts now. Remember: one symbol wins more often, and
        the better symbol can change during the task.</p>
        <p>The symbols will also look different from the ones in practice.</p>
        <p>There is no more on-screen guidance — just keep trying to earn
        points.</p></div>`,
      choices: ["Begin task"]
    });
  }

  /* ---- Main blocks -------------------------------------------------- */
  for (let b = 0; b < CONFIG.n_blocks; b++) {
    const correctId = correctByBlock[b];
    // For each block, choose which side the correct stimulus is on, balanced.
    const correctSides = balancedSides(CONFIG.trials_per_block);
    for (let i = 0; i < CONFIG.trials_per_block; i++) {
      timeline.push(makeTrial(jsPsych, stimById, {
        block: b,
        is_practice: false,
        correct_id: correctId,
        reward_prob: CONFIG.reward_prob,
        correctSide: correctSides[i]
      }));
      timeline.push(iti());
    }
  }

  /* ---- Goodbye ------------------------------------------------------ */
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="instructions"><h1>All done!</h1>
      <p>Thank you for taking part. Saving your data…</p></div>`,
    choices: ["Finish"],
    on_load: function () {
      // Auto-advance after a moment so the participant isn't stuck if data
      // submission is what actually ends the study.
    }
  });

  return timeline;
}

/* ---- One reversal-learning trial ------------------------------------ */
function makeTrial(jsPsych, stimById, opts) {
  const correctStim = stimById[opts.correct_id];
  const otherStim = Object.values(stimById).find(s => s.id !== opts.correct_id);

  // Place correct stimulus on the chosen side; the other stimulus opposite.
  let left, right;
  if (opts.correctSide === "left") { left = correctStim; right = otherStim; }
  else                             { left = otherStim;  right = correctStim; }

  return {
    type: jsPsychMouseChoice,
    left_html: left.html,
    right_html: right.html,
    left_id: left.id,
    right_id: right.id,
    correct_id: opts.correct_id,
    reward_prob: opts.reward_prob,
    block: opts.block,
    is_practice: opts.is_practice,
    start_label: CONFIG.start_label,
    feedback_duration: CONFIG.feedback_duration,
    response_timeout: CONFIG.response_timeout,
    time_normalize: CONFIG.time_normalize,
    normalized_points: CONFIG.normalized_points
  };
}

function iti() {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div class="mc-blank"></div>',
    choices: [],
    trial_duration: CONFIG.iti,
    response_ends_trial: false
  };
}

/* ---- Data handling on completion ------------------------------------ */
function handleFinish(jsPsych) {
  const json = jsPsych.data.get().json();

  if (typeof jatos !== "undefined") {
    // Running inside JATOS: submit results, then advance the study flow.
    jatos.submitResultData(json, jatos.startNextComponent);
    return;
  }

  // Standalone preview: optionally download the data locally so nothing is
  // lost while testing outside JATOS.
  if (CONFIG.local_csv_fallback) {
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reversal_mousetracking_data.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { /* no-op */ }
  }
}

/* ---- Boot ------------------------------------------------------------ */
function runExperiment() {
  const jsPsych = initJsPsych({
    on_finish: function () { handleFinish(jsPsych); }
  });
  jsPsych.run(buildTimeline(jsPsych));
}

/* Kick things off once the page (and jatos.js, if present) are ready. */
if (typeof jatos !== "undefined") {
  jatos.onLoad(runExperiment);
} else {
  window.addEventListener("DOMContentLoaded", runExperiment);
}
