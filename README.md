# Zetamac (The Arithmetic Game) - iPhone PWA & Desktop

I vibecoded myself a zetamac clone to track statistics, give myself reminders to do zetamac and stuff i guess.

👉 **Play Live**: [https://lyn1dev.github.io/lyns-zetamac/](https://lyn1dev.github.io/lyns-zetamac/)

---

## ⚡ Highlights

- **1:1 Zetamac Problem Generator**:
  - **Addition**: Configurable range (default `2–100` + `2–100`).
  - **Subtraction**: Inversion of addition (matches Zetamac’s exact probability and bounds, always positive).
  - **Multiplication**: Configurable range (default `2–12` × `2–100`).
  - **Division**: Inversion of multiplication (guaranteed integer results with zero remainder).
- **Instant Answer Matching**: As soon as you type the correct digits, the question automatically advances without pressing Enter.
- **Strictly Custom Built-in Numpad**:
  - Designed exclusively for iPhone thumb reach.
  - Zero mobile keyboard pop-ups—the iOS software keyboard will never slide up or shift your viewport.
  - Ultra-fast `pointerdown` response with zero 300ms tap delay and tactile press feedback.
- **Resilient Timestamp-Diffing Timer**: Uses `Date.now() - startTime` delta checks alongside `requestAnimationFrame` and fallback interval ticks, ensuring 100% timer precision even if iOS Safari dims or background-throttles the tab.
- **Daily Goal & Hourly Reminders**:
  - Automatically tracks your daily practice (target: **5 rounds/day**).
  - If you haven't completed at least 5 rounds in the day, the app reminds you every hour (`Time for Zetamac! 🧮`).
  - Web Notifications integrated via Service Worker for iOS 16.4+ standalone PWAs.
  - Automatically resets at midnight and silences hourly alerts once your 5 rounds are completed.
- **100% Offline PWA**: Built-in Service Worker caches all assets for offline play on flights or commutes.
- **Retina Icons & Safe Area Support**: Seamlessly fits the iPhone notch, dynamic island, and home swipe bar.
- **Personal Best & Stats**: Automatically records your high scores and calculates pace (seconds per problem and problems per minute).

---

## 📱 How to Install on iPhone (Full-Screen PWA)

To play Zetamac as a standalone fullscreen app without the Safari navigation bar:

1. Open **Safari** on your iPhone and navigate to: **[https://lyn1dev.github.io/lyns-zetamac/](https://lyn1dev.github.io/lyns-zetamac/)**
2. Tap the **Share** button (the square icon with an arrow pointing upward at the bottom of Safari).
3. Scroll down the share sheet and tap **"Add to Home Screen"** (`➕`).
4. (Optional) Rename the icon to **Zetamac**, then tap **Add** in the top right corner.
5. Tap the **Zetamac** icon on your iPhone home screen. It will open in edge-to-edge standalone mode with native app performance!

---

## 🎮 How to Play

1. **Configure Rules**:
   - Set the duration (default: **120 seconds**).
   - Toggle which operations you want (`+`, `-`, `×`, `÷`) and customize factor ranges.
2. **Start the Game**:
   - Tap **Start Game** (or press `Enter` on a desktop keyboard).
3. **Solve Arithmetic**:
   - Tap numbers on the on-screen keypad.
   - When the correct answer is entered, it instantly flashes green and gives you the next problem.
   - Use `⌫` (backspace) to delete the last digit or `C` to clear your input.
   - On desktop, you can also use your physical number row / numpad (`0–9`, `Backspace`, `Esc`).
4. **Game Over & Review**:
   - See your final score, problem pace, and whether you broke your personal record!

---

## 🛠️ Local Development & Testing

To run locally on your computer:

```bash
# Clone the repository
git clone https://github.com/lyn1dev/lyns-zetamac.git
cd lyns-zetamac

# Start a local static server with Python
python -m http.server 8000

# Or with Node.js
npx serve .
```

Open `http://localhost:8000` in your web browser.

---

## 📄 License

MIT License. Feel free to modify and share!
