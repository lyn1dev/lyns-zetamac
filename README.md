# Zetamac (The Arithmetic Game) - OLED PWA & Cognitive Analytics Engine

A high-performance, pitch-black OLED 1:1 clone of Zetamac designed specifically for iOS PWA and desktop. Features granular cognitive latency tracking, mathematical weakness diagnosis, conflict-free private GitHub repository sync, and milestone achievements.

👉 **Play Live**: [https://lyn1dev.github.io/lyns-zetamac/](https://lyn1dev.github.io/lyns-zetamac/)

---

## ⚡ Key Highlights

- **Pure OLED Pitch Black Theme (`#000000`)**: Completely shuts off pixels on OLED displays for maximum battery life and contrast. High-contrast typography with custom minimalist button outlines.
- **Strictly Custom Built-in Numpad**:
  - Engineered for iPhone thumb reach.
  - Zero mobile keyboard pop-ups—the iOS software keyboard will never slide up or shift the viewport.
  - Instant `pointerdown` reaction with zero 300ms tap delay and tactile press feedback.
- **Granular Cognitive Latency Tracking**:
  - Tracks **`firstKeyMs`**: Measures latency to the very first keystroke, isolating pure mathematical retrieval speed from typing/motor time.
  - Tracks **`totalMs`** and **`corrections`**: Identifies second-guessing and hesitation.
  - Mid-problem interruption invalidation: Automatically excludes trials if the app is backgrounded or tabbed away.
- **Mathematical Weakness Diagnosis**:
  - Uses 34-bin log-spaced histograms ($0.25\text{s} - 20\text{s}$).
  - **Leave-One-Out Baselines**: Evaluates each factor or arithmetic feature against an uncontaminated baseline where the tested cell is mathematically excluded.
  - **Log-Scale 90% Confidence Intervals**: Only diagnoses a weakness if the lower bound of the cell's 90% CI is $\ge 15\%$ slower than the operation baseline ($n \ge 20$).
  - Iglewicz-Hoaglin outlier filtering on log-transformed latency with robust MAD floor guards.
- **Private GitHub Repository Sync**:
  - Completely bypasses iOS Safari's 7-day PWA storage eviction.
  - Scoped to a single private repository with fine-grained PAT (`contents: read/write`).
  - Optimistic concurrency with Compare-And-Swap (CAS) retry loops on HTTP 409 conflicts.
  - Partitioned into 3 cloud files: `core.json` ($<64\text{KB}$ dying-page keepalive), `stats.json`, and `history.json`.
- **Daily Goals & Hourly Reminders**:
  - 5-round daily consistency tracker with progress indicators.
  - Web Notifications for iOS 16.4+ standalone PWAs when daily goal is incomplete.
- **Monotonic Personal Best & Achievement Badges**:
  - Append-only CRDT set with read-time monotonic timeline derivation.
  - Milestone unlock badges for speed thresholds, consistency, and daily streaks.

---

## 📱 Detailed Installation Guide (iOS PWA)

To play in fullscreen standalone mode with native performance and notifications:

1. Open **Safari** on your iPhone and visit: **[https://lyn1dev.github.io/lyns-zetamac/](https://lyn1dev.github.io/lyns-zetamac/)**
2. Tap the **Share** icon (the square with an arrow pointing up at the bottom of Safari).
3. Scroll down and select **"Add to Home Screen"** (`➕`).
4. (Optional) Name it **Zetamac**, then tap **Add** in the top right.
5. Launch **Zetamac** from your Home Screen. It will launch edge-to-edge without browser address bars, with support for the Dynamic Island and swipe bar.

---

## ☁️ Private GitHub Sync Setup Guide

Safari automatically purges local storage for PWAs that have not been opened in 7 days. Connecting a private GitHub repository ensures your personal bests, historical rounds, and analytics survive forever.

### Step 1: Create a Private GitHub Repository
1. Log in to [GitHub](https://github.com/) and click **New Repository** (or visit `https://github.com/new`).
2. Name the repository `zetamac-data`.
3. Set the visibility to **Private**.
4. Check **"Add a README file"** (GitHub requires the default branch to exist before creating files via the API).
5. Click **Create repository**.

### Step 2: Generate a Scoped Personal Access Token (PAT)
You can use a Fine-Grained Token (recommended) or a Classic Token:

#### Option A: Fine-Grained Token (Recommended)
1. Go to **GitHub Settings** > **Developer settings** > **Personal access tokens** > **Fine-grained tokens**.
2. Click **Generate new token**.
3. Name: `Zetamac Sync`.
4. Expiration: Choose your preferred expiration (e.g. 1 year or No expiration).
5. **Repository access**: Choose **Only select repositories** > select `zetamac-data`.
6. **Permissions**: Under **Repository permissions**, find **Contents** and set it to **Read and write**.
7. Click **Generate token** and copy the token (`github_pat_...`).

#### Option B: Classic Token
1. Go to **Developer settings** > **Personal access tokens** > **Tokens (classic)**.
2. Click **Generate new token (classic)**.
3. Check the **`repo`** scope (Full control of private repositories).
4. Click **Generate token** and copy the token (`ghp_...`).

### Step 3: Connect in Zetamac
1. When opening Zetamac for the first time, a setup modal will appear automatically (or tap **Stats** > **Achievements & Cloud** > **Reconnect / Change**).
2. Enter:
   - **GitHub Personal Access Token**: Paste your token.
   - **GitHub Username / Owner**: Your GitHub username.
   - **Repository Name**: `zetamac-data`.
3. Tap **Connect & Sync**. Zetamac will verify repository permissions, pull any existing records, and immediately sync your game data.

---

## 📖 Complete Usage Guide

### 1. Start Screen
* **Start Game**: Begins a round immediately with your current settings.
* **Best Score**: Displays your all-time high score derived monotonically across all devices.
* **Navigation**: Quick access to **Settings** and **Stats**.

### 2. Game Settings & Rules
Tap the **⚙️ Settings** button on the home screen:
* **Game Duration**: Configure the timer duration in seconds (default: `120s`).
* **Operation Toggles & Number Ranges**:
  * **Addition (`+`)**: Specify Min and Max for first term and second term (default: `2–100` + `2–100`).
  * **Subtraction (`–`)**: Automatically inverts addition rules to guarantee non-negative results matching official Zetamac bounds.
  * **Multiplication (`×`)**: Specify Min and Max for factor 1 and factor 2 (default: `2–12` × `2–100`).
  * **Division (`÷`)**: Automatically inverts multiplication rules to guarantee integer division with zero remainder.
* **Daily Goal & Progress**: Shows your progress toward the 5-round daily goal.
* **Hourly Reminders Toggle**:
  * Tap **Enable Reminders** to request notification permissions.
  * When enabled, the app sends an hourly reminder if you haven't completed 5 rounds today.
  * Automatically silences once the 5-round threshold is reached.
* **Restore Defaults**: Resets duration and factor ranges to default tournament standards.

### 3. Playing a Round & Controls
* **Virtual On-Screen Numpad**:
  * Tap `0–9` to enter digits.
  * **Instant Verification**: The moment the buffer matches the correct answer, the answer box flashes green and immediately presents the next problem. No Enter key is required.
  * `⌫` (Backspace): Deletes the last digit entered (increments the trial's correction counter).
  * `C` (Clear): Completely wipes the answer box (increments the trial's correction counter).
* **Desktop Keyboard Shortcuts**:
  * Number keys `0–9`: Input digits.
  * `Backspace`: Delete previous digit.
  * `Escape` or `C`: Clear input buffer.
  * `Enter`: Start game from the home screen.
* **Abort Game**: Tap **Abort** in the top bar to immediately end the session and record results.

### 4. Game Over Screen
Review comprehensive performance metrics immediately upon round completion:
* **Final Score**: Total problems solved.
* **New Record Badge**: Displayed if you beat your previous all-time personal best.
* **Pace**: Average time spent per problem (e.g. `1.85s / problem`).
* **Problems Per Minute (PPM)**: Speed normalized to a 60-second rate.
* **Daily Goal Progress**: Visual 5-segment bar displaying today's completed rounds.
* **Buttons**: Play Again, View Detailed Stats, or Return to Settings/Home.

### 5. Statistics & Cognitive Analytics
Tap **📊 Stats** on the home screen or game-over screen to inspect three comprehensive tabs:

#### Tab 1: Weakness Analysis (`Analyze Weaknesses`)
* **Diagnostic Headlines**:
  * Displays statistical weaknesses tagged with percentage slower than baseline (e.g., `×9 Tables (+42% slower)`).
  * Lists mathematical evidence: geometric mean vs. baseline, 90% confidence intervals, and sample size ($n$).
  * Displays strengths (e.g., `+ No Carry (+28% faster)`).
* **Operational Baselines**: Instant glance at geometric mean latency across all four operations (`+`, `–`, `×`, `÷`).
* **Factor Breakdown Grid**: Breakdown of multiplication factor latencies ($\times 2$ through $\times 12$) with uncertainty bounds and sample counts.
* **Recent Bottlenecks**: Highlights the slowest specific problems from your last 30 games with latency to first key and total time.

#### Tab 2: Round History (`Round History`)
* Displays your **last 30 games** in chronological order.
* Each card shows: Date, time, duration, score, and average pace.
* **Interactive Accordion**: Tap any round to open the drawer and see **every single problem** solved in that round:
  * Problem prompt (e.g. `56 ÷ 8`).
  * Latency to first keystroke (`firstKeyMs`).
  * Correction indicator if you made a typo or second-guessed (`(1 fix)`).

#### Tab 3: Achievements & Cloud (`Achievements & Cloud`)
* **Personal Best Timeline**: A strictly monotonic progression of every all-time high score you've achieved, complete with timestamps and round durations.
* **Milestone Badges**: Unlockable achievements:
  * 🎯 *First Steps*: Complete your first round.
  * ⚡ *Speed Demon*: Score 40+ in a round.
  * 🚀 *Turbo Mind*: Score 60+ in a round.
  * 👑 *Grandmaster*: Score 80+ in a round.
  * 🌌 *Century Club*: Score 100+ in a round.
  * 📚 *Dedicated*: Complete 10 total rounds.
  * 🔥 *Arithmetic Machine*: Complete 25 total rounds.
  * 🌟 *Daily Champion*: Finish 5 rounds in a single day.
* **Cloud Sync Management**:
  * Shows connected GitHub repository and Unique Device ID.
  * Sync status indicator (`☁️ Synced`, `🔄 Syncing...`, `⚠️ Sync Pending`, `⚠️ Auth Error`).
  * **Force Sync Now**: Manually trigger an immediate CAS push/pull cycle.
  * **Reconnect / Change**: Update your GitHub PAT or switch repository.

---

## 🔬 Architectural & Statistical Design

### 1. Mathematical Rigor in Weakness Analysis
* **Why Geometric Mean?** Arithmetic problem latency follows a log-normal distribution, with positive skewness caused by occasional cognitive pauses. The geometric mean ($\exp(\mu_{\ln})$) accurately represents the true median of log-normal data without distortion from extreme values.
* **Leave-One-Out Baseline Isolation**: Standard statistical anomaly detection suffers from self-masking when an outlier cell contaminates its own baseline. Zetamac calculates:
  $$\text{baselineBins}[i] = \max(0, \text{opTotalBins}[i] - \text{cellBins}[i])$$
  This ensures that severe weaknesses (such as hesitation on $\times 9$) do not inflate the multiplication baseline and mask their own severity.
* **Confidence Interval Gating**: Diagnoses require $n \ge 20$ trials and are only flagged when the lower bound of the 90% confidence interval exceeds the baseline by $\ge 15\%$:
  $$\text{CI}_{90\text{, lower}} = \exp\left(\mu_{\ln} - 1.645 \cdot \frac{\sigma_{\ln}}{\sqrt{n}}\right) \ge 1.15 \cdot \text{Baseline}$$

### 2. Concurrency & Offline Architecture
* **3-File Cloud Partition**:
  * `core.json` ($<64\text{KB}$): Settings, daily stats, personal bests, achievements. Flushed opportunistically on page unload using `keepalive: true`.
  * `stats.json`: Permanent aggregate log-spaced histograms keyed by `(deviceId, month, cell)`.
  * `history.json`: Rolling window of the 30 most recent games with compact problem arrays `[opIndex, a, b, totalMs, firstKeyMs, corrections]`.
* **Optimistic Concurrency (CAS)**:
  * Uses GitHub Contents API `PUT /repos/{owner}/{repo}/contents/{path}` with the remote blob's `sha`.
  * In the event of a concurrent write from another device (HTTP 409 Conflict), the client backs off, re-fetches the remote file, merges the CRDT state, and retries.
* **TOCTOU Protection**:
  * Incremental re-merging: After each file write, `syncAll()` immediately updates local storage with freshest data.
  * A `mutationSeq` counter tracks user modifications made during network round-trips to ensure no settings or round data are overwritten by in-flight responses.
* **Stale-While-Revalidate PWA Caching**:
  * Service Worker v5 responds immediately from local cache for instant 0ms app starts on subway commutes or offline flights.
  * Background cache updates trigger seamless reload via `controllerchange` when updates are deployed.

---

## 🛠️ Local Development & Testing

To test or develop locally:

```bash
# Clone the repository
git clone https://github.com/lyn1dev/lyns-zetamac.git
cd lyns-zetamac

# Run a static server with Python
python -m http.server 8000

# Or with Node.js
npx serve .
```

Open `http://localhost:8000` in your browser.

---

## 📄 License

MIT License. Crafted for high-speed arithmetic practice.

