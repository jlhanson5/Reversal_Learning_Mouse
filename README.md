# Reversal Learning Task with Mouse Tracking

A two-alternative **probabilistic reversal-learning** task with continuous
**mouse-trajectory tracking**, built with [jsPsych 7](https://www.jspsych.org)
and ready to deploy on [JATOS](https://www.jatos.org) or any static web host.

On each trial the participant clicks a **Start** button at the bottom of the
screen, then moves the cursor up to one of two symbols and clicks it. The full
path of the cursor — from Start to choice — is recorded, following the
start-button-anchored paradigm of Freeman & Ambady's MouseTracker.

---

## Design at a glance

| Feature | Value | Where to change |
|---|---|---|
| Structure | 4 blocks × 20 trials = **80 trials** | `config.js` → `n_blocks`, `trials_per_block` |
| Reversals | **Fixed schedule**: contingency flips at each block boundary (trials 20, 40, 60) | `config.js` → `n_blocks` |
| Feedback | **Probabilistic**, 80 / 20 | `config.js` → `reward_prob` |
| Mouse tracking | Start-button anchored, full trajectory | built in |
| Stimuli | Two abstract colored shapes | `config.js` → `stimuli` |
| Practice | 6 deterministic warm-up trials | `config.js` → `include_practice`, `practice_trials` |
| Data saving | `jatos.submitResultData()` (JSON) | built in |

Set `reward_prob: 1.0` for a **deterministic** task. Set `initial_correct` to
`"A"` or `"B"` to fix which symbol is correct in block 1 (default: randomized
per participant for counterbalancing).

---

## Files

```
index.html                main page: loads libraries + task code
config.js                 all tunable parameters (edit this)
plugin-mouse-choice.js    custom jsPsych plugin: the mouse-tracking trial
experiment.js             timeline, reversal schedule, data submission
style.css                 layout
lib/                      vendored jsPsych 7.3.4 + plugins (no CDN needed)
test_harness.html         dev-only: single-trial page for automated testing
test_run.js               dev-only: Playwright end-to-end check of the plugin
```

jsPsych is **vendored** into `lib/`, so the study is fully self-contained: it
needs no internet connection to an external CDN, which is the most robust setup
for JATOS.

---

## Quick local preview

Because browsers block some features on `file://`, serve the folder over HTTP:

```bash
cd RL_mouse
python3 -m http.server 8000
# open http://localhost:8000
```

Outside JATOS the study runs normally and, when finished, downloads a
`reversal_mousetracking_data.json` file so you can inspect the data. (The
`jatos.js` 404 in the console is expected and harmless during local preview.)

---

## Deploying on JATOS

1. **Zip the study folder** — include `index.html`, `config.js`,
   `experiment.js`, `plugin-mouse-choice.js`, `style.css`, and the `lib/`
   folder. (The `test_*` files and `node_modules/` are not needed.)
2. In JATOS, use **Import Study**, or create a new study and upload these as
   the study assets with `index.html` as the single component's HTML file.
3. JATOS automatically serves `jatos.js`, so the task detects it, calls
   `jatos.onLoad()` on start, and `jatos.submitResultData()` on completion,
   then advances via `jatos.startNextComponent()`.
4. Run the study; results appear per worker in **Study Results** as JSON.

---

## Data format

One JSON array is submitted; each mouse-choice trial is one object with (among
the jsPsych defaults) these fields:

| Field | Meaning |
|---|---|
| `block` | 0-indexed block (−1 = practice) |
| `is_practice` | practice trial flag |
| `correct_id` | which symbol is correct **this trial** (reflects reversals) |
| `left_id`, `right_id` | which symbol was shown on each side |
| `chosen_id`, `chosen_side` | the symbol / side the participant clicked |
| `correct` | chose the currently-correct symbol |
| `rewarded` | received +1 (probabilistic) |
| `timed_out` | no response within `response_timeout` (if set) |
| `rt` | ms from stimulus onset (Start click) to choice |
| `init_time` | ms from onset to first cursor movement (initiation time) |
| `movement_time` | ms from first movement to choice |
| `trajectory` | array of `{x, y, t}` — raw cursor samples, px relative to stage top-left, `t` in ms from onset |
| `trajectory_norm` | `{x:[…], y:[…]}` time-normalized to 101 points (if `time_normalize`) |
| `max_deviation` | max perpendicular deviation from the ideal Start→choice line (px; **+** = toward the unchosen symbol) |
| `auc` | area between the actual path and the ideal line (**+** = toward unchosen) |
| `x_flips` | number of horizontal direction reversals along the path |
| `stage_w`, `stage_h`, `start_rect`, `left_rect`, `right_rect` | screen geometry for offline re-normalization |

### Analysis notes

- **Learning / reversal curves:** plot `correct` (or `rewarded`) as a function
  of trial-position-within-block, aligned to reversals. `init_time` and
  `movement_time` typically lengthen right after a reversal.
- **Attraction to the alternative:** `max_deviation` and `auc` index how much
  the cursor was pulled toward the unchosen symbol — a movement-level measure of
  choice conflict / uncertainty, expected to spike on post-reversal trials.
- **Re-normalizing:** because raw pixel geometry and all target rectangles are
  saved, you can re-map trajectories into a common start-at-origin,
  target-at-(±1,1) space offline (e.g. with the R `mousetrap` package) and
  compute MAD, AUC, x-flips, and trajectory-type clustering consistently.
- `x` increases rightward and `y` increases **downward** (screen coordinates);
  flip `y` if you want upward-positive plots.

---

## Swapping in image stimuli

In `config.js`, replace the `html` of each stimulus with an `<img>` tag:

```js
stimuli: [
  { id: "A", label: "face1", html: '<img class="stim" src="img/face1.png">' },
  { id: "B", label: "face2", html: '<img class="stim" src="img/face2.png">' }
]
```

Put the images in an `img/` subfolder inside the study and include it in the
JATOS zip. For many images, add jsPsych's `plugin-preload` to avoid load
flicker.

---

## Automated test (optional, for developers)

`test_run.js` drives one real mouse-choice trial in headless Chromium and
checks that the trajectory, choice/reward logic, timing, normalization, and
movement metrics are all recorded correctly:

```bash
npm install playwright     # dev dependency only
node test_run.js           # prints PASS/FAIL for each check
```

---

## Extending

The timeline in `experiment.js` is a plain jsPsych array, so you can prepend a
consent form, demographics, or debrief using standard jsPsych plugins, and add
attention checks between blocks. To make the reversal rule
**performance-based** instead of fixed, replace the block loop with a
conditional/loop node that flips `correct_id` once a running accuracy criterion
is met.
