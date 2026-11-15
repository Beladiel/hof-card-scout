# CasinoLab: The House Edge Academy — Sparky Project Brief

**Status:** Dreaming / high priority / favorite  
**Updated:** November 14, 2026  
**Idea Atlas project ID:** `casinolab-house-edge-academy`  
**Live idea vault:** https://beladiel.github.io/hof-card-scout/idea-atlas/  
**Repo:** `Beladiel/hof-card-scout`  
**Purpose:** Living design notes for Sparky. Brainstorm-stage ideas below are proposals, not all confirmed requirements.

## Confirmed interview decisions (November 14, 2026)

- **Bubble craps is the preferred primary experience**, with large animated dice in a transparent dome. The traditional felt layout can remain an optional alternative as a future view.
- **Home screen choice (confirmed):** display two prominent options, **Learn to Play** (step-by-step interactive tutorials) and **Free Play** (immediate virtual casino session, with optional contextual explanations). Both must use the same bubble-craps visual and underlying verified game engine.
- **Free Play table choice (confirmed, November 14, 2026):** make all *major* craps betting options available immediately (including Pass Line, Don't Pass, Come, Don't Come, Odds, Place bets, Field, Hardways and other common bets), without locking them behind lessons. Tapping any bet opens concise tap-to-learn help explaining when it can be placed, what it pays, how it wins/loses, and the applicable house edge under the chosen paytable. Keep Learn to Play progressive and guided. This is the intended **Free Play launch experience**; Sparky can implement and test the underlying bets in stages, but should not label the MVP with Pass Line only as full Free Play or claim the complete table is finished until the major bets actually work.
- **Interview still ongoing**: the remaining teaching flow, bankroll defaults, bet coverage, visual presentation, and controls are not finalized. Avoid assuming answers before the user confirms them.

- **Bankroll and sessions (confirmed, November 14, 2026):** Free Play uses a persistent, play-money virtual bankroll that carries between app visits, with a session history including starting and ending balances, chips wagered, net results, and meaningful activity stats. Also let the player start separate practice sessions with a custom starting amount; practice must not alter the persistent main bankroll or permanently inflate its statistics. Save progress locally and support explicit user-controlled reset; never use real-money payments or cash-out. Provide easy explanations distinguishing net profit, amounts staked, and outcome variance.

- **Dice rolling control (confirmed, November 14, 2026):** Manual rolling **only**. The player presses a prominent **ROLL** button when ready; animate the two dice bouncing inside the bubble dome and settle them to reveal the outcome. Do **not** add an automatic countdown or time-limited betting window. The player can inspect or place bets at their own pace before pressing ROLL in both learning and free-play contexts. One deliberate press = one independently generated dice roll; disable repeat taps during the animation to prevent unintended multiple rolls.

- **Free Play coaching (confirmed, November 14, 2026):** provide a clearly visible optional **Casino Coach** on/off toggle. When enabled, after each manual roll, explain in concise plain language which active bets won, lost, pushed, or remain in play and why, with corresponding payouts where relevant. When disabled, show normal machine results, chip/bankroll updates, and roll history without interruptive instructional text. The toggle should not affect game mechanics or RNG, and players should still be able to tap any bet for rules, payout, and odds help at any time. Learn to Play retains guided instruction regardless of this Free Play setting.

- **Bet placement controls (confirmed, November 14, 2026):** support **both** (1) choose a virtual chip denomination and tap the corresponding craps betting area to place that chip, and (2) tap/select a wager in a convenient **quick-bet panel** to enter or adjust its amount. Both must feed the same validated underlying bet engine and bankroll ledger and be fully touch-accessible on iPhone. Provide clear selection state, distinguish **place/select bet** from **read bet explanation** (e.g., a separate info control or help affordance, so tapping to wager is not hijacked), allow adjustments/undo before a roll where rules permit, enforce available balance and legal bet increments/minimums, and ensure changes appear in both views. These are two interaction methods, not separate bankrolls or separate games.

- **Dice animation and sounds (confirmed, November 14, 2026):** create a **realistic bubble-craps presentation** in Free Play: two oversized, convincing 3D-looking dice bounce and tumble visibly inside a transparent dome for a few seconds, then settle on the result of the manual ROLL action. Include optional dice/machine sound effects with a clear mute control. This choice is **B, not a speed-mode selector**: do not assume quick-roll or instant-result UI modes are part of the intended baseline. Animation is presentation only; the verified fair RNG and rules engine determine results, and sound/motion must not change outcomes. Account for mobile browser audio permissions and reduced-motion accessibility settings. Prevent multiple roll submissions while the animation is active.

- **Learn to Play lesson navigation (confirmed, November 14, 2026):** offer **both** a recommended progressive beginner-to-advanced learning path and a browseable lesson library with **every individual lesson accessible in any order**. Do not gate or lock content behind prior lessons. Every lesson should offer hands-on practice on the actual bubble-craps simulation where applicable, with clear progress indicators without requiring linear completion. This is the user's choice **C** for the Learn to Play experience.

- **Interactive lesson practice (confirmed, November 14, 2026):** use **demonstrate, then practice**. Each appropriate lesson begins with explicitly labeled, controlled example outcomes that teach important cases (such as establishing a point, winning, or sevening out). Afterward, the learner gets actual random dice rolls and feedback to apply the concept. The preset outcomes are educational demonstrations only: they must never be labeled as random, never alter the player's persistent real Free Play bankroll/history, and must use the same rules/payout logic as the random simulation. The random-practice phase uses the same fair dice engine as Free Play. This is choice **C**.

- **Starting play-money bankroll (confirmed, November 14, 2026):** begin the persistent main bankroll with **$1,000 in virtual credits**. Provide an **optional virtual allowance** (a deliberate, player-initiated replenishment) when the balance runs low. **Account for every allowance/top-up separately from game winnings and losses** so reports clearly show net gambling results versus new credits issued. Keep a dedicated adjustment ledger, and ensure total bankroll reconciles as starting balance + net gambling result + allowances/other explicit adjustments. No real-money purchases, deposits, or cash-outs. **Allowance size, frequency, and trigger behavior are not yet decided**; do not invent those requirements. This is the user's choice **C** for Interview Question 10.

- **Virtual allowance trigger (confirmed, November 14, 2026):** when the **persistent main bankroll falls below $100**, gently **offer an optional $500 play-money allowance**. The player may **accept or decline**; never auto-credit it. Log each accepted allowance as a separate bankroll adjustment, not a win, and keep net betting performance statistics unaffected. Avoid interrupting an active roll and avoid repeatedly prompting after a decline; reasonable re-offer behavior may be designed later, as frequency/cooldown was not explicitly decided. This confirms choice **B** from Interview Question 11.

- **Table minimum choices (confirmed, November 14, 2026):** before entering a Free Play session, offer **four fixed table-minimum presets: $5, $10, $15, and $25** in virtual chips. This is choice **B** for Interview Question 12. Do **not** require arbitrary custom table minimums. Show the chosen minimum on the table and enforce the applicable minimum for bets where relevant; some bets also have denomination or payout-unit requirements, and not all bets necessarily share the same minimum. Explain these rules with the existing tap-to-learn bet help. A $1,000 starting bankroll and optional below-$100 allowance remain as previously decided.

- **iPhone hybrid layout (confirmed, November 14, 2026):** use a **smart hybrid** responsive interface. During betting, keep the transparent dice dome visible above a compact, touch-friendly craps betting layout with chip and quick-bet controls. When the user presses the manual **ROLL** button, temporarily **expand the dome** to showcase the realistic animated bounce/settle of the two dice, then return to the compact betting layout showing the result, active bets, payouts and bankroll. Preserve bets and game state throughout the transition. The expanded view should not require another navigation tap; support accessible reduced-motion handling. This confirms choice **C** for Interview Question 13.

- **iPhone orientation (confirmed, November 14, 2026):** design the **primary gameplay interface for LANDSCAPE orientation** (Interview Question 14, choice B), not portrait and not dual optimized orientation layouts. In landscape, provide the bubble dome, craps betting areas, chips/quick-bet controls and manual ROLL action with comfortable touch targets. Preserve the previously confirmed smart-hybrid behavior: compact dome and table during betting, expanding dome during the animated roll, then return to betting layout. On an upright phone, provide a simple, friendly rotate-device suggestion instead of cramming the full craps interface into portrait. iOS mobile browsers/PWAs may not support reliably forcing screen orientation; use responsive CSS and a helpful fallback rather than assuming an orientation lock. This explicit choice supersedes earlier general 'phone portrait first' suggestions in the initial brainstorm and MVP draft; desktop remains supported.

- **Bet management (confirmed, November 14, 2026):** when the player selects an existing active bet, open a **smart contextual panel** displaying that bet's current wager, pertinent payout information, status and **only actions permitted by the game's rules and current state** (for example, Add, Reduce, Remove, Turn On, Turn Off when legally applicable). Disabled or inapplicable operations should not be presented as available. Clearly distinguish opening a bet-management panel from placing additional chips via the agreed tap-to-place and quick-bet controls. Validate every action against the authoritative craps engine, chosen table minimum and bet-specific increments; immediately reconcile bankroll/committed chips and visibly update both the table and quick-bet panel. This records Interview Question 15, choice **B**.

- **First complete release scope (confirmed, November 14, 2026; Interview Question 16, choice A):** the first full release must be a **complete, genuinely playable CRAPS experience**, rather than launching a thin multi-game bundle. Prioritize bubble-craps visuals and manual rolling, functional major craps bets, both bet input styles, smart contextual bet controls, Learn to Play (guided demonstration then random practice), Free Play with optional Casino Coach, bankroll/allowance/session history, and the planned odds/probability statistics. **Blackjack and slots are deferred until craps is finished and tested.** Sparky should still build and test craps incrementally in internal development milestones; those milestones are not a substitute for the first complete public release, and do not describe a Pass Line-only preview as the finished Free Play table. Keep every other confirmed requirement in this brief intact.

- **Craps betting scope (confirmed November 14, 2026; Interview Question 17, choice B):** CasinoLab 1.0 should provide a **full casino-style craps table**, not just basic bets. Include Pass Line / Don't Pass, Come / Don't Come, odds, Place, Buy, Lay, Field, Hardways, plus **common center-table proposition bets** including Horn, Any Seven, Any Craps, Yo (11), and C&E; implement other common center-table bets where they belong to the selected paytable. These bets must actually work, have correct timing, valid wager increments, accurate payouts and exceptions (including craps table variations), clear tap-for-help descriptions, and reliable bankroll accounting. **Specialized Hop bets and unusual proprietary side bets are not part of the required first-release scope** (choice C was not selected). Maintain the confirmed complete-craps-first release target; build incrementally and test each bet family before labeling the full table complete.

- **Payouts and learning (confirmed, November 14, 2026; Interview Question 18, choice B):** all wagers resolve with **automatic, accurate payout calculation and bankroll crediting**, as on an electronic craps machine. Add an **optional payout-calculation learning feature** that occasionally invites the player to predict the payout on a winning bet **before revealing the correct amount**, then explains the payout ratio and arithmetic with friendly feedback. This is a learning prompt, **not a manual payout requirement**: whether the answer is correct, wrong, or skipped, the actual validated payout remains identical, and the feature must not affect game odds, dice, or funds. Make the exercise optional, easy to disable, and non-disruptive for players who just want Free Play; the exact prompt frequency can be chosen later. Distinguish net win from returned stake in the explanation.

## 1. What we already agreed

CasinoLab combines the older **Craps Tutor + Simulation** and **Casino Strategies Tutor** ideas into one educational, realistic, **play-money-only** casino learning app.

- **Craps first.** User has used a craps practice app and liked the automatic, large-dice **electronic bubble-craps machines** seen in Las Vegas. Offer a traditional felt-table view and a bubble-craps-inspired view; reproduce the feel, not trademarks or proprietary cabinet artwork.
- **Next:** blackjack basic-strategy lessons, then a slot-machine probability lab.
- **Core purpose:** Understand the rules, probabilities, table procedures, outcomes, and sensible decisions; gain confidence approaching a real table without promising profits.
- **Four original modes:** Academy, Casino Floor, Strategy Coach, Challenge Mode. **Strategy Laboratory** can be a subarea accessible throughout.
- **Device/cost constraints:** iPhone-first, also usable on a Windows laptop; free GitHub Pages/static hosting; no subscriptions, paid APIs, deposits, cash-out, real-money wagering or external gambling accounts.
- **User's earlier craps training preference:** Learn Pass Line and optional odds first; understand Come bets and place bets next; explain why Field, Hardways, Horn and many prop bets cost more on average; learn table etiquette.
- Keep all current Idea Atlas projects and personal changes unchanged. CasinoLab is a **new project**, not an extension of the Idea Atlas application itself.

## 2. Product promise

*A virtual casino that teaches WHY a choice is good or bad, lets you practice it, and allows thousands of statistically correct experiments in a safe sandbox.*

The app teaches that **house-edge reduction is not a winning system**. Even a statistically sensible bet can lose over a session; short-run variance is substantial.

## 3. Main sections

### A. Academy — teach me, step by step

**Craps lesson path (proposed sequence):**
1. The dice: two fair six-sided dice, 36 equally likely ordered outcomes, unequal sums.
2. Layout and come-out roll: Pass Line, 7/11 win, 2/3/12 lose, otherwise establish a point.
3. Point phase: win if the point repeats before 7; lose on seven-out.
4. Optional free-odds wager: true-odds payouts, how it affects average edge per total money wagered, and why the original line bet still has an edge.
5. Don't Pass and push on 12; Come and Don't Come bets.
6. Place 6/8, 5/9 and 4/10; correct payouts and bet sizing.
7. Higher-edge choices (Field, Hardways, Horn, other propositions), with **rules/paytable-dependent** edge labels.
8. Table confidence and etiquette: wait for a safe betting moment, don't touch chips during a roll, exchange cash for chips through the dealer, understand the puck and shooter rotation, and follow house-specific rules.
9. Common misconceptions: streaks, "due" numbers, progressive staking, hedging, and why rolls are independent.

After each decision show a plain-English explanation, the relevant payout, and the house edge where known for the **exact** rules.

**Blackjack lesson path:**
- Card values, dealer procedures, blackjack vs ordinary 21, natural payout and push rules.
- Hit / stand / double / split / surrender where allowed, with feedback derived from the selected rule set and a tested basic-strategy chart.
- Compare 3:2 vs 6:5 blackjack, dealer soft-17 rules, shoe/deck count, doubling restrictions. Avoid one universal strategy chart when tables vary.
- Optional myth-busting/advanced lessons only after basic strategy works.

**Slots lesson path:**
- Random outcomes, symbol/payline rules, reel weights, hit frequency, RTP and house edge, volatility, jackpots.
- Explain why a game can return a stated percentage over many theoretical plays yet have wildly different individual sessions.
- Make all simulated paytables explicitly **invented teaching models**; don't represent them as the current odds of a real machine.
- No "hot machine", near-miss, streak, or guaranteed-winning claims.

### B. Casino Floor — practice like a real session

- Virtual chip stack, optional starting bankroll (e.g., 100/200/500 demo credits), selectable table minimum, clear denomination controls.
- Responsive craps felt layout with a prominent **ROLL DICE** action, point puck, bets, payout animations, history, and bankroll ledger.
- Optional "Bubble Craps" presentation: dice automatically animated inside a clear dome; **same rules and outcome engine** as felt-table mode.
- Beginner assist toggles: highlighted allowed bets, risk/payout tooltip, automatic explanation after each roll, undo a bet **before** roll if allowed, and a "What happened?" recap.
- Sessions are saved locally; no sign-in required. Bankroll is imaginary and never withdrawable.

### C. Strategy Coach — what would you do?

- Present a situation; player chooses a legal bet or playing action; show rule-specific evaluation and explanation.
- Teach **expected value and risk**, not a guarantee of winning.
- Optional challenges: "place a Pass Line wager," "identify the puck state," "calculate a 6/8 place-bet payout," "decide whether to split."
- Permit hints and replay rather than penalizing mistakes.

### D. Strategy Laboratory — experiment with probability

- Run simulated 10, 100, 1,000, or 10,000 rolls/hands/spins without requiring tap-by-tap play.
- Compare total wagered, wins/losses, net play-money result, average result per wager, realized return, theoretical return, and bankroll path.
- Graph sum-of-dice distribution vs theoretical counts and compare Pass Line vs alternative bets under identical published rules.
- Compare flat-betting and progression *without* suggesting progression overcomes negative expectation.
- Offer simulation settings, reset, and clear explanation of the assumptions.

### E. Challenge Mode — optional achievements

- Skill-based objectives, not gambling-style pressure or real-money incentives.
- Examples: 5 correct terminology answers; a complete craps point cycle; a blackjack decision streak; identify a misleading slot claim.
- Can be hidden if the user prefers a straightforward study tool.

## 4. First playable release (MVP) — **CRAPS ONLY**

Build a narrow vertical slice with genuine functionality, not a decorative mock-up.

1. A real two-dice RNG and correct sum probabilities.
2. A complete, tested Pass Line state machine (come-out / point / seven-out / repeat).
3. A legal Pass Line bet, virtual chip/bankroll accounting, correct even-money payouts, and no ability to risk more than available.
4. Show the point puck, felt-table layout, two dice, recent rolls, current outstanding bets, bankroll, and a plain-language explanation **after every roll**.
5. A short interactive lesson, with overlay/coach highlights and a simple intro to table etiquette.
6. One mobile-friendly bubble-dice visual mode using the **same engine** (a visual alternative, not a second implementation).
7. Save/resume a local practice session; offer restart. No remote accounts.
8. Automated tests, including deterministic injected RNG for rule tests and a broad 2d6 distribution sanity test.

**Acceptance tests:** Correct payout/resolution for 7, 11, 2, 3, 12 at come-out; each point 4/5/6/8/9/10 correctly establishes and resolves; point-before-7 wins, 7-before-point loses; bankroll ledger reconciles stake, payouts and outstanding bets; no illegal state or negative funds; phone touch controls usable in portrait.

After MVP works, implement **Pass Odds** (4/10 pays 2:1, 5/9 3:2, 6/8 6:5), then Come, Don't Pass, Place bets, then blackjack and slots. Preserve working features at each step.

## 5. Truthfulness / rules data

- Two fair dice: sum 7 = 6/36, sums 6 and 8 = 5/36 each, 5 and 9 = 4/36 each, 4 and 10 = 3/36 each, 3 and 11 = 2/36 each, 2 and 12 = 1/36 each.
- The typical Pass Line house edge is about **1.41% of the flat line bet**, *not* 1.41% of every roll. The odds bet pays true odds; it does not change the flat-bet expectation, but changes edge measured across total wagered.
- For craps bets and blackjack, compute/display edge and strategy for the **chosen actual rules and payouts** rather than assuming every casino is identical.
- Avoid implying a simulation's sample result is its theoretical edge. Separate empirical observations from mathematical expectation.
- Use a fair random source (browser crypto RNG where available); support an injectable deterministic engine for testing.

## 6. Interface and build constraints

- Modern but readable casino aesthetic, high contrast, large tappable chips, clear roll/payout log and friendly explanations; phone portrait first.
- Play-money badge always visible. No real-currency account, wagers, deposits, withdrawals, payment features, casino affiliate links, or monetization.
- Free, static PWA suitable for GitHub Pages; lightweight JavaScript/TypeScript acceptable; no back-end needed for MVP.
- Offline-capable after first load; browser-local save with clear reset/export options; protect against accidental overwrites.
- Keep core simulation engine **separate** from UI/animations so tests are independent.
- Use original visual assets and sounds or permissively licensed free assets. Respect reduced-motion setting and optional mute.
- Keep project in its own directory, e.g., `casino-lab/`, not inside Idea Atlas code except for a brief link.

## 7. Sparky's suggested build order

1. Create `casino-lab/` with a README containing this brief, a small roadmap, and no-cost GitHub Pages deployment plan.
2. Design pure craps engine/state model and unit tests; specify whether returned payouts include stake, so accounting can't double-pay.
3. Add minimal usable HTML/CSS/JS interface and verified Pass Line loop.
4. Add Academy lesson overlays and feedback.
5. Add bubble-dice view using same mechanics, then local persistence and app install support.
6. Review on actual iPhone and laptop; fix issues **before** starting Blackjack.
7. Only then extend bets, Blackjack Academy, slots, and large-batch strategy experiments.

## 8. Decisions for future brainstorming — do not assume finalized

- Should bubble craps be the **default** view, with traditional felt as an alternative?
- Preferred starting practice bankroll and table minimum?
- Which lesson style: quiet text/tooltips, spoken narration, or both? (Avoid paid voice APIs.)
- Should challenge badges be displayed or optional?
- Do we want real-casino table rule presets and side-bet menus later, after verifying each paytable?

## 9. Definition of done for first milestone

On an iPhone, the user can open a free CasinoLab web app, learn what a Pass Line bet means, wager virtual chips, roll fair dice, see real rules applied correctly, understand the result, and continue/restart a saved session. No fake buttons, no decorative-only prototype, and no accidental change to other Idea Atlas or HOF Card Scout projects.

**Sparky:** Treat this markdown file as the canonical brainstorm brief, and check the Idea Atlas CasinoLab card for later personal notes. Ask before adding real-money or paid services (not desired), or changing established scope.
