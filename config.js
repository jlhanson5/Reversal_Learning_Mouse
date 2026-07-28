/* =========================================================================
 * config.js  —  All experiment parameters in one place.
 *
 * Everything a researcher is likely to want to change lives here so you never
 * have to touch the plugin or timeline code. Edit values, re-zip, re-upload.
 * ========================================================================= */

const CONFIG = {

  /* ---- Design: blocks & reversals ------------------------------------ */
  // Fixed reversal schedule. The correct stimulus flips at the start of each
  // new block. 4 blocks of 20 trials => reversals at trials 20, 40, 60.
  trials_per_block: 20,
  n_blocks: 4,

  /* ---- Feedback / reward --------------------------------------------- */
  // Probabilistic feedback. Choosing the currently-correct stimulus is
  // rewarded with prob `reward_prob`; the incorrect stimulus is rewarded with
  // prob (1 - reward_prob). Set reward_prob = 1.0 for a deterministic task.
  reward_prob: 0.8,

  /* ---- Stimuli -------------------------------------------------------- */
  // Two abstract stimuli. `id` is the stable identity that carries the
  // contingency; `html` is what gets drawn. Swap html for <img> tags to use
  // image files instead (see README).
  stimuli: [
    { id: "A", label: "blue circle",  html: '<div class="stim stim-circle" style="background:#2f7fd1;"></div>' },
    { id: "B", label: "orange square", html: '<div class="stim stim-square" style="background:#e08a1e;"></div>' }
  ],

  // Which stimulus id is correct in block 1. If null, it is randomized per
  // participant (recommended for counterbalancing). The other stimulus becomes
  // correct after the first reversal, and so on.
  initial_correct: null,

  /* ---- Practice ------------------------------------------------------- */
  include_practice: true,
  practice_trials: 6,          // short, deterministic warm-up (reward_prob = 1)

  // Practice uses visually distinct stimuli (different shapes AND colors) so
  // participants don't carry a learned association into the real task.
  practice_stimuli: [
    { id: "P1", label: "green triangle", html: '<div class="stim stim-triangle" style="border-bottom-color:#3aa657;"></div>' },
    { id: "P2", label: "purple diamond", html: '<div class="stim stim-diamond" style="background:#7d3ac1;"></div>' }
  ],

  /* ---- Timing (ms) ---------------------------------------------------- */
  feedback_duration: 900,      // how long reward/no-reward feedback stays up
  iti: 400,                    // blank inter-trial interval
  response_timeout: null,      // ms to force a response, or null for no limit

  /* ---- Mouse tracking ------------------------------------------------- */
  // Trajectories are recorded from every mousemove event (native resolution).
  // Set to true to also resample the trajectory to a fixed number of
  // time-normalized points in the saved data (handy for quick analysis).
  time_normalize: true,
  normalized_points: 101,      // standard in the mouse-tracking literature

  /* ---- Text ----------------------------------------------------------- */
  start_label: "Start",

  /* ---- Data ----------------------------------------------------------- */
  // JATOS study result data are submitted as JSON on completion. Set false to
  // additionally trigger a local CSV download (useful when testing offline).
  local_csv_fallback: true
};
