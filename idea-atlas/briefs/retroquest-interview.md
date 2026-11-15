# RetroQuest — Design Interview & Development Decisions

**Project:** RetroQuest: Retro Game Companion
**Status:** Concept / interview in progress
**Date started:** November 15, 2026

## Vision
An iPhone-friendly retro-game companion with platform-specific step-by-step walkthroughs, interactive maps, progressive spoiler-controlled hints, cheats, secrets, strategies and a personal physical-game catalog. User owns a Genesis-compatible cartridge console gifted by Jay. Recently acquired Power Monger and Phantasy Star III. Power Monger is a proposed first complete beginner-guide trial. No required paid APIs; use free hosting and respect copyright/guide licensing. Do not modify existing Idea Atlas personal data.

## Confirmed decisions

### Question 1 — Console scope
**Answer: B — All retro systems, with Genesis developed first.**
Build RetroQuest as a multi-system gaming reference hub rather than an exclusively Genesis app. Develop Sega Genesis guides first, then expand to systems such as NES, SNES, Game Boy and PlayStation over time. This is a long-term platform vision, not a promise that all guide content exists at launch.

## Pending interview

### Question 2 — Primary guide experience
How should players generally access RetroQuest help while playing?
- **A — Guided companion:** Follow a game chapter by chapter, with current-objective tracking and spoiler-aware hints.
- **B — Reference library:** Search and browse complete walkthroughs, maps, cheats and guides whenever needed.
- **C — Both:** A guided companion and a browsable reference library, switchable at any time.

**Answer: C — Both approaches. Confirmed November 15, 2026.**

Offer both a guided, chapter-by-chapter mode that saves progress and protects against spoilers, and a complete searchable reference mode containing walkthroughs, maps, cheats, secrets and strategy guides. Let players switch between modes at any time.

### Question 3 — How should RetroQuest's guide library grow?
- **A — Original curated guides:** Build each full walkthrough and map in RetroQuest, verifying content carefully; fewer games initially but richer integration.
- **B — Guide directory:** Launch a broad search and directory of reputable existing walkthroughs with links to their sources; faster coverage but less integrated experience.
- **C — Hybrid:** Detailed original interactive guides for selected games plus a searchable directory linking to trusted outside guides for other titles.

**Answer: C — Hybrid approach. Confirmed November 15, 2026.**

Create fully interactive, original, fact-checked guides for selected games, beginning with Power Monger for Genesis. For many other retro games, offer a searchable directory linking to reputable existing walkthroughs with appropriate attribution instead of copying protected content.

### Question 4 — Map experience
How should maps behave inside RetroQuest?
- **A — Full maps:** Open complete zoomable maps showing locations, treasure, exits and key points immediately.
- **B — Discovery maps:** Reveal areas and hidden details gradually as the player manually marks progress, protecting exploration surprises.
- **C — Both styles:** Let players toggle between a fully revealed reference map and a discovery-focused map with hidden areas and secrets.

**Answer: C — Both map styles. Confirmed November 15, 2026.**

Offer two map views for guides with mapped areas: a fully revealed zoomable reference map displaying treasures, exits, secrets and other points of interest, and a discovery view that hides unexplored rooms/sections and spoilers until revealed by the player. Allow switching freely while preserving discovery progress; don't inadvertently expose secrets in previews.

### Question 5 — How should players track their location and progress?
When playing on an original cartridge and using RetroQuest on an iPhone, how should the companion know what to show next?
- **A — Manual checkpoints:** Choose the current chapter, area or objective from a list and check off completed steps. Simple, reliable and offline-friendly.
- **B — Natural-language lookup:** Type where you are or what you just did (e.g., "I reached the first village") to jump to relevant guide content. Needs robust local search without paid AI.
- **C — Both:** Manual checkpoint tracking for precise progress plus a text-search/jump tool to quickly relocate when returning to a game.

**Answer: C — Both methods. Confirmed November 15, 2026.**

Enable manually saved checkpoints, step-completion checklists, and an additional text-description search to find a player's place in a game. Search should initially work locally with curated game/section keywords, without paid AI calls. Text search should not automatically mark objectives complete or unexpectedly reveal spoilers.

### Question 6 — First launch content
What should the first usable release of RetroQuest contain?
- **A — One polished game:** Fully develop Power Monger for Genesis with a rich walkthrough, maps, hints, and tested progress-saving before adding more games.
- **B — Small Genesis starter pack:** Launch with streamlined, usable guides for Power Monger, Phantasy Star III, and a few other Genesis favorites; expand each guide in stages.
- **C — Large game directory first:** Release a broad searchable Genesis catalog and source links, while interactive walkthroughs for selected games arrive afterward.

**Answer: B — Small Genesis starter collection. Confirmed November 15, 2026.**

Include **Power Monger**, **Phantasy Star III: Generations of Doom**, **Phantasy Star II**, and **King's Bounty**. Begin with usable guides for these games and improve/deepen guides in stages. Power Monger remains the first learning-from-scratch pilot.

**Correction (November 15, 2026):** The user meant **King's Bounty**, not King's Quest. Design the fourth starter guide around King's Bounty for Sega Genesis. Discard the former question about which King's Quest installment. Corrected by user: the intended game is King's Bounty, not King's Quest. Target the Sega Genesis version for initial guide planning.

### Question 7 — Hint and spoiler control
How should RetroQuest give help when a player gets stuck?
- **A — Three progressive hints:** First a subtle nudge, then a clearer hint, then the full answer; reveal each only on request.
- **B — Direct solution:** Provide the exact answer or route immediately when asked, with an optional spoiler warning.
- **C — Both:** Offer a spoiler-free progressive-hint ladder or a direct full solution, letting the player choose each time.

**Answer: C — Both options. Confirmed November 15, 2026.**

Each hint-supported objective should offer a progressive hint ladder (subtle nudge, stronger clue, full solution) **and** a separate direct-answer option for players who want the solution immediately. Let players choose each time; avoid exposing spoilers until requested, show clear spoilers warnings and remember reveal state when appropriate.

### Question 8 — Physical game collection tracking
How much of a personal cartridge collection manager should RetroQuest include?
- **A — Simple collection:** Mark games as owned, playing, finished or wishlisted, with minimal details.
- **B — Detailed collection:** Track original cartridge vs box/manual, condition, purchase price, purchase date and personal notes, alongside playing status.
- **C — Walkthrough focus:** Skip a collection manager for now; RetroQuest is for guides, while a later feature can handle ownership.

**Answer: A — Simple collection tracker. Confirmed November 15, 2026.**

Track games as **Owned, Playing, Completed, or Wishlist**, with a quick way to open a game's guide. Keep the first release focused on the walkthrough/companion experience rather than a detailed collector database. Do **not** require box/manual completeness, condition, purchase price, or purchase date.

### Question 9 — Offline access to guides
How should RetroQuest work when the iPhone has no internet access?
- **A — Online-only:** Guides and maps require a connection; progress stays saved on the device.
- **B — Save selected guides:** Mark individual games to keep their walkthroughs, maps, hints, cheats and progress available offline. No manual file handling; the app handles storage.
- **C — Automatic offline library:** Automatically store every opened, fully supported guide and its maps for offline use. More storage, less manual setup.

**Answer: B — Save selected games for offline use. Confirmed November 15, 2026.**

Allow the player to save individual supported game guides for offline use, including full original walkthrough text, interactive map assets, hint ladders and cheats. The app should manage cached files automatically with no opening or importing separate files on iPhone. Keep guide progress and local notes usable offline and provide storage/update controls. External third-party walkthrough links will continue to need connectivity unless licensing explicitly permits offline copies.

### Question 10 — Cross-device progress syncing
How should RetroQuest handle saved progress across an iPhone and other devices?
- **A — This-device only:** Save progress on each device separately, with no sync or account required.
- **B — Manual transfer:** Save locally and provide optional backup/export and restore to move progress when needed.
- **C — Automatic sync:** Use a free, account-based sync option to keep game progress, collection and notes consistent on iPhone and computer, including handling changes made offline once reconnected.

**Answer: C — Automatic cloud syncing. Confirmed November 15, 2026.**

Keep the collection, individual-game walkthrough progress, saved checkpoints, discovery-map state and notes synchronized between iPhone and laptop under the same account. Updates made offline stay available locally and synchronize automatically on reconnection. Implement conflict handling so an older device cannot silently overwrite newer progress, and retain an export/backup recovery path. Use only a reliable free-tier provider and no paid API; investigate technical feasibility during build, rather than promising unlimited storage or unsupported account integrations.

### Question 11 — Sign-in for cloud sync
How would you like to sign in to sync RetroQuest between your devices?
- **A — Google sign-in:** Use your Google account to sign in to RetroQuest and sync across devices.
- **B — Email sign-in:** Use an email one-time code or magic link; no third-party sign-in button.
- **C — Both Google and email:** Offer both methods, with account linking safeguards so the same library is not accidentally split across accounts.

**Answer: A — Google sign-in. Confirmed November 15, 2026.**

Use Google sign-in as the primary and only required account sign-in method for cloud syncing across iPhone and computer. Do not build a separate password system or require email magic links as an additional path at launch. Select a free-tier authentication provider during implementation, verify its pricing and browser compatibility, and preserve local offline progress when signed out; never overwrite unsynced changes. Account linking is out of scope unless revisited.

### Question 12 — Visual style
What visual style should RetroQuest use across its game catalog, guides and maps?
- **A — Retro arcade:** Pixel-inspired fonts, classic console colors and nostalgic game-like styling, while keeping text legible.
- **B — Modern reference:** Clean, readable interface with restrained retro accents; prioritize easy navigation of long guides and maps.
- **C — Switchable themes:** Offer both a retro arcade theme and a clean modern theme, remembering the preference across devices.

**Answer: A — Classic retro arcade. Confirmed November 15, 2026.**

Use a classic retro-arcade visual direction across RetroQuest: pixel-inspired typography, classic console palettes, nostalgic menus, retro game accents and restrained pixel-art embellishments. Maintain comfortable reading sizes and contrast, accessible controls, and responsive map and walkthrough interfaces. This is the one selected theme for launch; a modern alternate theme is not required.

### Question 13 — Learning a new game
When trying a retro title for the first time (like Power Monger), what should the Getting Started section provide?
- **A — Quick-start control guide:** A concise original controller-button diagram, key commands and essential tips; jump straight into playing.
- **B — Guided beginner lesson:** A step-by-step first-session tutorial explaining buttons and mechanics through real starting objectives, with checkable progress.
- **C — Both:** A one-screen quick-reference control guide plus an optional interactive, beginner-friendly tutorial that players can skip once comfortable.

**Answer: C — Both options. Confirmed November 15, 2026.**

Provide both a concise, platform- and version-specific control reference (including an accurate Genesis controller diagram for the launch games) and an optional interactive first-session tutorial that teaches actual mechanics through guided, checkable objectives. Experienced players can skip tutorials and use the quick reference; tutorial progress should save across sessions. Verify controls against reputable sources before publishing.

### Question 14 — How should guides use images and videos?
When you read a walkthrough, what media should accompany the steps?
- **A — Mostly text and interactive maps:** Prioritize quick-loading instructions, diagrams and maps, with minimal images.
- **B — Illustrated walkthroughs:** Include screenshots or original annotated illustrations at important steps to help recognize locations, items and enemies.
- **C — Illustrated walkthroughs plus optional video links:** Use images/maps within guides and add optional links to relevant gameplay clips or demonstrations when available.

**Answer:** Pending.

## Interview workflow
Ask one question at a time. As answers are confirmed, append each decision to this file and update the catalog when practical. Keep original requirements and prior decisions, and later assemble a tested Sparky build handoff.
