/* =========================================================================
 * plugin-mouse-choice.js  —  jsPsych 7 plugin for a start-button-anchored
 * two-alternative mouse-tracking choice trial.
 *
 * Flow of one trial:
 *   1. A "Start" button appears at bottom-center; the two choice stimuli sit
 *      in the top-left and top-right corners.
 *   2. The participant clicks Start. The button disappears and mouse tracking
 *      begins (t = 0 at this moment). The stimuli become clickable.
 *   3. Every mousemove is recorded as {x, y, t}. The participant moves the
 *      cursor to one stimulus and clicks it.
 *   4. Probabilistic feedback (reward / no reward) is shown on the chosen
 *      stimulus, then the trial ends.
 *
 * All geometry is recorded so trajectories can be re-normalized offline.
 * ========================================================================= */

var jsPsychMouseChoice = (function (jspsych) {
  "use strict";

  const info = {
    name: "mouse-choice",
    version: "1.0.0",
    parameters: {
      /* Stimulus shown on the left / right (HTML). */
      left_html:  { type: jspsych.ParameterType.HTML_STRING, default: "" },
      right_html: { type: jspsych.ParameterType.HTML_STRING, default: "" },
      /* Stable identity of the left / right stimulus (e.g. "A" / "B"). */
      left_id:  { type: jspsych.ParameterType.STRING, default: "" },
      right_id: { type: jspsych.ParameterType.STRING, default: "" },
      /* Which id is currently correct, and the reward probability. */
      correct_id:  { type: jspsych.ParameterType.STRING, default: "" },
      reward_prob: { type: jspsych.ParameterType.FLOAT,  default: 0.8 },
      /* Bookkeeping passed straight through to the data. */
      block:      { type: jspsych.ParameterType.INT,    default: 0 },
      is_practice:{ type: jspsych.ParameterType.BOOL,   default: false },
      /* UI / timing. */
      start_label:       { type: jspsych.ParameterType.STRING, default: "Start" },
      feedback_duration: { type: jspsych.ParameterType.INT,    default: 900 },
      response_timeout:  { type: jspsych.ParameterType.INT,    default: null },
      /* Offline resampling of the trajectory. */
      time_normalize:    { type: jspsych.ParameterType.BOOL, default: true },
      normalized_points: { type: jspsych.ParameterType.INT,  default: 101 }
    },
    data: {
      block:        { type: jspsych.ParameterType.INT },
      is_practice:  { type: jspsych.ParameterType.BOOL },
      correct_id:   { type: jspsych.ParameterType.STRING },
      left_id:      { type: jspsych.ParameterType.STRING },
      right_id:     { type: jspsych.ParameterType.STRING },
      chosen_id:    { type: jspsych.ParameterType.STRING },
      chosen_side:  { type: jspsych.ParameterType.STRING },
      correct:      { type: jspsych.ParameterType.BOOL },
      rewarded:     { type: jspsych.ParameterType.BOOL },
      rt:           { type: jspsych.ParameterType.FLOAT },
      init_time:    { type: jspsych.ParameterType.FLOAT },
      movement_time:{ type: jspsych.ParameterType.FLOAT }
    }
  };

  class MouseChoicePlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      const self = this;

      // ---- Build the display ------------------------------------------
      display_element.innerHTML = `
        <div id="mc-stage" class="mc-stage">
          <div id="mc-left"  class="mc-target mc-left">${trial.left_html}</div>
          <div id="mc-right" class="mc-target mc-right">${trial.right_html}</div>
          <button id="mc-start" class="mc-start" type="button">${trial.start_label}</button>
          <div id="mc-feedback" class="mc-feedback"></div>
        </div>`;

      const stage    = display_element.querySelector("#mc-stage");
      const leftEl   = display_element.querySelector("#mc-left");
      const rightEl  = display_element.querySelector("#mc-right");
      const startBtn = display_element.querySelector("#mc-start");
      const fbEl     = display_element.querySelector("#mc-feedback");

      // Geometry recorded relative to the stage's top-left corner so it is
      // independent of window scroll / position.
      let stageRect = stage.getBoundingClientRect();

      const rectOf = (el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left - stageRect.left,
          y: r.top  - stageRect.top,
          w: r.width,
          h: r.height,
          cx: r.left - stageRect.left + r.width / 2,
          cy: r.top  - stageRect.top  + r.height / 2
        };
      };

      let trajectory = [];      // [{x, y, t}, ...] sampled from mousemove
      let onset = null;         // performance.now() when tracking begins
      let firstMoveTime = null; // t of first recorded movement (initiation)
      let responded = false;
      let timeoutHandle = null;

      // ---- Mouse tracking ---------------------------------------------
      function onMouseMove(e) {
        if (onset === null) return;
        const t = performance.now() - onset;
        const x = e.clientX - stageRect.left;
        const y = e.clientY - stageRect.top;
        if (firstMoveTime === null) firstMoveTime = t;
        trajectory.push({ x: Math.round(x), y: Math.round(y), t: Math.round(t) });
      }

      // ---- Start of tracking ------------------------------------------
      function beginTracking() {
        // Re-measure in case of any layout shift, then hide the start button.
        stageRect = stage.getBoundingClientRect();
        startBtn.classList.add("mc-hidden");
        stage.classList.add("mc-active");
        onset = performance.now();
        // Seed the trajectory with the start-button center as t = 0.
        const s = self._startRect;
        trajectory.push({ x: Math.round(s.cx), y: Math.round(s.cy), t: 0 });

        document.addEventListener("mousemove", onMouseMove);
        leftEl.addEventListener("click", onChoiceLeft);
        rightEl.addEventListener("click", onChoiceRight);

        if (trial.response_timeout) {
          timeoutHandle = self.jsPsych.pluginAPI.setTimeout(() => {
            if (!responded) endResponse(null, null);
          }, trial.response_timeout);
        }
      }

      function onChoiceLeft()  { endResponse(trial.left_id,  "left",  rectOf(leftEl)); }
      function onChoiceRight() { endResponse(trial.right_id, "right", rectOf(rightEl)); }

      // ---- Response & feedback ----------------------------------------
      function endResponse(chosen_id, chosen_side, targetRect) {
        if (responded) return;
        responded = true;
        const rt = performance.now() - onset;

        document.removeEventListener("mousemove", onMouseMove);
        leftEl.removeEventListener("click", onChoiceLeft);
        rightEl.removeEventListener("click", onChoiceRight);
        if (timeoutHandle) self.jsPsych.pluginAPI.clearAllTimeouts();

        const timed_out = chosen_id === null;
        const correct = !timed_out && chosen_id === trial.correct_id;

        // Probabilistic reward.
        let rewarded = false;
        if (!timed_out) {
          const p = correct ? trial.reward_prob : (1 - trial.reward_prob);
          rewarded = Math.random() < p;
        }

        // Feedback display.
        if (timed_out) {
          fbEl.textContent = "Too slow — please respond faster";
          fbEl.className = "mc-feedback mc-fb-timeout";
        } else {
          const chosenEl = chosen_side === "left" ? leftEl : rightEl;
          chosenEl.classList.add("mc-chosen");
          if (rewarded) {
            fbEl.textContent = "+1";
            fbEl.className = "mc-feedback mc-fb-reward";
          } else {
            fbEl.textContent = "0";
            fbEl.className = "mc-feedback mc-fb-noreward";
          }
        }

        // Movement metrics computed on the raw trajectory geometry, using the
        // *unchosen* alternative to fix the sign of deviation.
        const competitorRect = chosen_side === "right" ? rectOf(leftEl) : rectOf(rightEl);
        const metrics = self._computeMetrics(trajectory, competitorRect);

        let traj_norm = null;
        if (trial.time_normalize) {
          traj_norm = self._timeNormalize(trajectory, trial.normalized_points);
        }

        const data = {
          block: trial.block,
          is_practice: trial.is_practice,
          correct_id: trial.correct_id,
          left_id: trial.left_id,
          right_id: trial.right_id,
          chosen_id: chosen_id,
          chosen_side: chosen_side,
          correct: correct,
          rewarded: rewarded,
          timed_out: timed_out,
          reward_prob: trial.reward_prob,
          rt: Math.round(rt),
          init_time: firstMoveTime === null ? null : Math.round(firstMoveTime),
          movement_time: firstMoveTime === null ? null : Math.round(rt - firstMoveTime),
          // Full geometry for offline re-normalization.
          stage_w: Math.round(stageRect.width),
          stage_h: Math.round(stageRect.height),
          start_rect: self._startRect,
          left_rect: rectOf(leftEl),
          right_rect: rectOf(rightEl),
          // Movement summary measures.
          max_deviation: metrics.md,
          auc: metrics.auc,
          x_flips: metrics.x_flips,
          n_samples: trajectory.length,
          trajectory: trajectory,
          trajectory_norm: traj_norm
        };

        self.jsPsych.pluginAPI.setTimeout(() => finish(data), trial.feedback_duration);
      }

      function finish(data) {
        display_element.innerHTML = "";
        self.jsPsych.finishTrial(data);
      }

      // ---- Wire up the start button -----------------------------------
      self._startRect = rectOf(startBtn);
      startBtn.addEventListener("click", function onStart() {
        startBtn.removeEventListener("click", onStart);
        beginTracking();
      }, { once: true });
    }

    /* ---- Static-ish helpers (instance methods) ----------------------- */

    // Time-normalize a trajectory to `n` equally-spaced-in-time points via
    // linear interpolation. Returns {x:[...], y:[...]}.
    _timeNormalize(traj, n) {
      if (traj.length < 2) return null;
      const t0 = traj[0].t, t1 = traj[traj.length - 1].t;
      const dur = t1 - t0 || 1;
      const xs = new Array(n), ys = new Array(n);
      let j = 0;
      for (let i = 0; i < n; i++) {
        const tt = t0 + (dur * i) / (n - 1);
        while (j < traj.length - 2 && traj[j + 1].t < tt) j++;
        const a = traj[j], b = traj[j + 1];
        const span = (b.t - a.t) || 1;
        const frac = Math.min(1, Math.max(0, (tt - a.t) / span));
        xs[i] = Math.round(a.x + (b.x - a.x) * frac);
        ys[i] = Math.round(a.y + (b.y - a.y) * frac);
      }
      return { x: xs, y: ys };
    }

    // Max deviation (MD), area under curve (AUC) relative to the ideal
    // straight line from start to chosen target, and count of x-direction
    // reversals (x_flips). Sign convention: deviation *toward the competitor*
    // (the unchosen alternative) is positive.
    _computeMetrics(traj, competitorRect) {
      if (traj.length < 2) return { md: 0, auc: 0, x_flips: 0 };
      const sx = traj[0].x, sy = traj[0].y;
      const ex = traj[traj.length - 1].x, ey = traj[traj.length - 1].y;
      const dx = ex - sx, dy = ey - sy;
      const len = Math.hypot(dx, dy) || 1;
      // Unit normal to the start->end line.
      const nx = -dy / len, ny = dx / len;
      // Positive normal direction should point toward the competitor.
      const toCompX = competitorRect.cx - sx, toCompY = competitorRect.cy - sy;
      const sign = (nx * toCompX + ny * toCompY) >= 0 ? 1 : -1;

      let md = 0, auc = 0;
      const perp = [];
      for (let i = 0; i < traj.length; i++) {
        const px = traj[i].x - sx, py = traj[i].y - sy;
        const d = sign * (nx * px + ny * py);   // signed perpendicular distance
        perp.push(d);
        if (Math.abs(d) > Math.abs(md)) md = d;
      }
      // AUC via trapezoidal integration of signed deviation over path progress.
      for (let i = 1; i < perp.length; i++) {
        const step = Math.hypot(traj[i].x - traj[i - 1].x, traj[i].y - traj[i - 1].y);
        auc += ((perp[i] + perp[i - 1]) / 2) * step;
      }
      // x-flips: number of sign changes in horizontal velocity.
      let x_flips = 0, lastDir = 0;
      for (let i = 1; i < traj.length; i++) {
        const vx = traj[i].x - traj[i - 1].x;
        const dir = vx > 0 ? 1 : vx < 0 ? -1 : 0;
        if (dir !== 0 && lastDir !== 0 && dir !== lastDir) x_flips++;
        if (dir !== 0) lastDir = dir;
      }
      return { md: Math.round(md), auc: Math.round(auc), x_flips: x_flips };
    }
  }

  MouseChoicePlugin.info = info;
  return MouseChoicePlugin;
})(jsPsychModule);
