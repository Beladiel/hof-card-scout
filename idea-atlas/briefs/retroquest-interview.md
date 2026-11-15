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

**Answer: C — Illustrated walkthroughs plus optional video links. Confirmed November 15, 2026.**

Include relevant screenshots and original/appropriately licensed annotated illustrations alongside interactive maps and written directions at key points in each supported guide. Where reliable relevant gameplay demonstrations exist, link to them as an optional resource. All video should be optional, not required to understand a step; label external links and protect against unintended spoilers. Respect image and video rights, and don't bundle copyrighted media without permission. Only app-owned or licensed guide illustrations should be included in offline packs.

### Question 15 — Bookmarks and personal game notes
What personal tools should RetroQuest include while you work through a game?
- **A — Bookmarks only:** Save favorite guide sections, maps and checklist points for quick return.
- **B — Personal notes only:** Keep a private notebook per game for discoveries, clues, reminders and strategy ideas.
- **C — Both:** Bookmark important guide spots and add personal notes for each game, with the notes and bookmarks syncing between devices.

**Answer: C — Both bookmarks and notes. Confirmed November 15, 2026.**

Include bookmarks for specific walkthrough steps, guide sections, maps and points of interest, plus a private per-game notebook for user-entered discoveries, clues, reminders and strategies. Bookmarks and notes must sync across the user's devices through Google sign-in and remain available while offline, then safely reconcile changes after reconnection. Make both tools available without cluttering the core guide.

### Question 16 — Cheats and secret codes
How detailed should the cheat-code and secrets section be?
- **A — Simple cheat list:** Show validated codes and secrets in a straightforward searchable list for each game.
- **B — Organized reference:** Group cheats by type, include game/platform compatibility and clear instructions, and warn about codes that may affect saves.
- **C — Organized reference plus favorites:** Everything in B, plus let players bookmark or favorite useful codes and mark ones they have tried.

**Answer: C — Organized reference plus favorites. Confirmed November 15, 2026.**

Organize game cheats, secrets, passwords and codes by category, with search, clear activation instructions, platform/edition-specific compatibility and warnings for codes that may harm save progress. Let players favorite cheats and mark whether they've tried each one, with this personal state syncing between devices and remaining usable offline. Mark codes as verified only when supported by trustworthy evidence; never imply that all codes work on all game versions.

### Question 17 — Who should be able to use RetroQuest?
Should RetroQuest be just your personal companion, a public resource, or a community project?
- **A — Personal only:** Keep the app and guides primarily for your own use, with your personal game library.
- **B — Public guide library:** Anyone can browse guides, maps and codes, while each signed-in player gets private progress, bookmarks and notes.
- **C — Community contributions:** Public browsing plus a way for other players to submit guides, maps, tips or corrections for review before publishing.

**Answer: A — Personal gaming companion. Confirmed November 15, 2026.**

RetroQuest is designed for the user's own game collection and personal play sessions, not as a public retro gaming reference service. Prioritize personal access from iPhone and laptop with the previously chosen Google sign-in, cloud-synced progress, private notes and bookmarks. Do not build community-submitted content, public user profiles, or a public contribution/moderation system. A public static host does not by itself make files private: clarify appropriate access/security in implementation planning and do not assume hiding UI provides real content protection.

### Question 18 — Spoken walkthrough assistance
Since the user plays on a cartridge console while using RetroQuest on an iPhone, should guides offer hands-free audio?
- **A — Text and visuals only:** Keep RetroQuest silent; read the steps, hints and maps on screen.
- **B — Tap-to-listen:** Add a Read Aloud control using free on-device/browser text-to-speech where supported, so a step or hint can be spoken.
- **C — Voice-assisted companion:** Include tap-to-listen plus optional spoken commands such as "next step", "repeat" and "give me a hint" where browser/device speech recognition works; always provide touch controls as fallback.

**Answer: A — Text and visuals only. Confirmed November 15, 2026.**

Keep RetroQuest silent and screen-based. Instructions, steps, hints, walkthroughs and maps should be presented through text and visual UI only. Do not add read-aloud buttons, text-to-speech, voice commands, microphone permissions or speech API dependencies for the initial release. Maintain readable text, clear layouts and accessible touch controls.

### Question 19 — Game-specific strategy tools
Beyond walkthroughs and maps, how much game-specific help should RetroQuest provide?
- **A — Reference charts:** Clear searchable lists for character abilities, RPG equipment, enemies, spells or strategy-game units and terrain.
- **B — Charts plus interactive trackers:** References plus checklists to track collected items, unlocked abilities, defeated bosses and similar game-specific milestones.
- **C — Full interactive strategy tools:** Everything in B plus game-specific calculators or planners such as party builders, unit comparisons, route planners or resource estimators, where accurate data allows.

**Answer: B — Charts plus interactive trackers. Confirmed November 15, 2026.**

Provide verified, searchable game-specific reference charts (equipment, character abilities, enemies, spells, army units, terrain advantages, etc.) plus interactive checklists and trackers for collected items, learned abilities, defeated bosses, quests and milestones when relevant to the game. Persist per-game/per-save progress locally and through the chosen cloud sync. Trackers must not guess the state of an original cartridge game; the player marks progress manually. Full simulation calculators, party builders and army optimizers are not required at launch.

### Question 20 — RetroQuest home screen
What should the RetroQuest home screen emphasize when you open it on your iPhone?
- **A — Continue playing:** Lead with the current game, last saved checkpoint and a large Resume Guide button; browsing the full library is secondary.
- **B — Game library:** Lead with a visual shelf of owned/playing/wishlist games and a search bar; choose a game to access its guides.
- **C — Both:** Show a prominent Resume Current Game area above a compact game library, with quick access to search, maps and favorites.

**Answer: C — Both approaches. Confirmed November 15, 2026.**

The mobile home screen should prominently display **Continue Playing** for the current game, including the last checkpoint and an easy Resume Guide control. Below that, show a compact, visual personal game library with game cover images when permitted, a search bar, Owned/Playing/Completed/Wishlist filters and quick links to favorites, saved maps and guide sections. Keep the layout usable on iPhone and laptop, in the selected classic retro arcade visual style.

### Question 21 — Multiple playthroughs and branching paths
Some games, such as Phantasy Star III, can have different story paths. How should RetroQuest track separate runs through the same game?
- **A — One progress record per game:** Keep one active walkthrough, set of checklists and map progress for each title; starting over resets that game's tracked progress.
- **B — Multiple playthrough slots:** Create separate named saves for each playthrough, keeping its checkpoints, inventory checklists, notes and discoveries independently.
- **C — Multiple slots plus branching story tracking:** Everything in B, plus visual route/branch tracking where a game has meaningful choices, with spoilers concealed until requested.

**Answer: A — One playthrough per game. Confirmed November 15, 2026.**

Maintain one active saved progress record per game, encompassing walkthrough checkpoints, item/achievement trackers, map discoveries and relevant notes. Do not add multi-slot management or per-branch visual story tracking in the initial release. Starting a new run must require a clearly labeled confirmation before resetting gameplay progress; avoid unintentionally removing the user's general bookmarks, personal game notes or ownership status. The exact reset UX can be finalized during implementation.

### Question 22 — Updates to downloaded offline guides
When a guide you saved offline gets an improved map, corrected instructions or new cheats, how should RetroQuest update it?
- **A — Automatic updates:** Download the latest version silently when online, without changing your saved progress.
- **B — Ask before updating:** Show a short summary of what's new and let you approve the update for each game.
- **C — Manual updates only:** Keep saved guides unchanged until you choose Check for Updates.

**Answer: A — Automatic updates. Confirmed November 15, 2026.**

When an internet connection is available, the app automatically checks for and downloads newer versions of selected offline game guides, maps, hints and cheats. Guide content and the player's progress, bookmarks, favorites, discovered locations and private notes must be stored separately so updates do not reset or overwrite personal data. Use stable content identifiers and safe migrations for changed sections or maps; test in-place update and rollback behavior, avoid heavy cellular downloads where possible, and keep already-downloaded guides functional if an update fails.

### Question 23 — Original game manuals
Should RetroQuest help you find the original instruction manuals that came with classic games?
- **A — No manual section:** Use RetroQuest's custom controls and beginner tutorials instead.
- **B — Links to manuals:** Where lawful copies or official archives are available, include a quick link to the original game manual.
- **C — Manuals plus searchable quick reference:** Provide authorized links to original manuals, and add original searchable summaries of controls, menus, and game rules within RetroQuest.

**Answer: C — Manuals plus searchable references. Confirmed November 15, 2026.**

For each supported title, provide links to official or otherwise lawfully available original instruction manuals where possible, alongside RetroQuest's own verified and searchable explanations of controls, menus, game mechanics and rules. Label the manual source and version. Do not copy, host or bundle copyrighted manuals without permission, and do not assume every game has a legitimate online manual. Make the in-app quick references usable offline when their content is original or properly licensed.

### Question 24 — Adding games to your library
How should you add a new retro game to your personal collection?
- **A — Search the game catalog:** Search by title and console, select the matching game/version, and mark it Owned, Playing, Completed or Wishlist.
- **B — Manual game entry:** Type the title and choose the system yourself, including games that aren't in RetroQuest's catalog yet.
- **C — Both:** Search an existing catalog for quick additions, but also add a game manually if it isn't listed yet.

**Answer: B — Add games manually. Confirmed November 15, 2026.**

Provide a straightforward Add Game form where the user enters a game title and chooses its platform, even if no RetroQuest walkthrough or indexed catalog record exists yet. Allow optional collection status (Owned, Playing, Completed or Wishlist), preserve the entry in local and cloud-synced storage, and avoid requiring a catalog search or automatic matching to complete entry. When a manual entry corresponds to a supported guide, the app can provide a guide link without overwriting the user's manually entered title or platform.

### Question 25 — When a game has no RetroQuest guide
When you manually add a game that doesn't have its own interactive RetroQuest walkthrough yet, what should the app offer?
- **A — Collection entry only:** Keep it listed in your personal collection until we create a guide for it.
- **B — External help links:** Show available links to reputable existing walkthroughs and manuals, even before we create a RetroQuest guide.
- **C — External links plus a guide wishlist:** Offer outside walkthroughs where available and let you mark the game as a priority for a future original interactive guide.

**Answer: C — External guides plus a guide wishlist. Confirmed November 15, 2026.**

For manually entered games that lack a native RetroQuest interactive guide, show links to credible third-party walkthroughs and legally available manuals where such links exist. Label external resources clearly, do not copy their content, and never promise a link when none has been found. Include a separate **Guide Wishlist** flag to request and prioritize original RetroQuest interactive guides for those titles; this is distinct from the game ownership Wishlist status. The app should save and sync guide-wishlist choices with the personal library and not imply that adding a request automatically generates a complete guide.

### Question 26 — New-guide notifications
When an original RetroQuest guide becomes available for a game on your Guide Wishlist, how would you like to find out?
- **A — No alerts:** See the guide whenever you next browse that game's page.
- **B — In-app updates:** Show a New Guide badge and a compact What's New section inside RetroQuest, without phone notifications.
- **C — Optional phone notifications:** Include in-app updates plus opt-in push alerts when supported by the iPhone/PWA setup, with a notification-free fallback.

**Answer: B — In-app announcements. Confirmed November 15, 2026.**

When a new original RetroQuest guide is published, show a compact What's New section and a clear New Guide indicator inside RetroQuest, especially for titles on the user's Guide Wishlist. Do not send iPhone push notifications or request notification permissions. Keep the update indicators unobtrusive and let the user dismiss or mark announcements as seen. This applies to newly available interactive guides, not unverified external links.

### Question 27 — Protecting saved game progress
RetroQuest will already sync data between iPhone and laptop. What backup protection should it offer if a device or cloud account has a problem?
- **A — Cloud sync only:** Rely on your automatically synchronized data; no additional backup controls.
- **B — Manual backup and restore:** Include a simple Export Backup and Restore Backup feature for all personal game progress, notes, bookmarks and collection entries.
- **C — Automatic snapshots plus manual backup:** Keep a limited history of recoverable snapshots on a free-tier storage solution when feasible, and also allow backup export and restore.

**Answer: C — Automatic backups plus manual export. Confirmed November 15, 2026.**

Alongside automatic Google-account cloud syncing, provide recoverable snapshots of personal game data (collection, progress, map discoveries, notebook entries, bookmarks, guide wishlist and code favorites) where feasible within a genuinely free storage tier. Provide easy manual Export Backup and Restore Backup controls regardless, using a portable format such as JSON. Allow the user to inspect backup date and content before restoring, warn about any data replacement, and safeguard against corrupt or partial backups. Prefer keeping a small rolling history with explicit retention limits. Do not claim unlimited snapshots or recovery before provider limits and restore behavior are verified.

### Question 28 — Game completion and achievements
Once you've finished a retro game, what kind of completion tracking would you enjoy?
- **A — Simple completion status:** Mark the game Completed and optionally record the date, with no additional achievement system.
- **B — RetroQuest achievements:** Track game-specific optional milestones such as beating a boss, discovering a secret or finishing a challenge, with nostalgic badges.
- **C — Both:** Keep a simple Completed status and an optional achievement checklist/badge system for supported games; skip achievements when you just want a walkthrough.

**Answer: A — Simple game completion. Confirmed November 15, 2026.**

Keep game completion tracking straightforward: the user can mark a game **Completed**, with an optional completion date, and then move on. Do not add RetroQuest achievement badges, trophies, XP, score systems, or optional achievement challenges. Game-specific item and boss checklists chosen in Question 19 remain available as walkthrough trackers, but are not a gamified achievement system.

### Question 29 — Games available on multiple platforms
Some retro games have different versions on different consoles, with different controls, levels or secrets. How should RetroQuest organize these?
- **A — Track only the version you own:** Add just your specific platform's copy; other editions matter only if you add them later.
- **B — One game with a version selector:** Put the title under a single entry but let you choose its platform or edition to see the correct controls, maps and cheats.
- **C — Separate entry for each version:** Treat Genesis, NES, SNES, computer and other versions as individual game entries with their own guides and completion records.

**Answer:** Pending.

## Interview workflow
Ask one question at a time. As answers are confirmed, append each decision to this file and update the catalog when practical. Keep original requirements and prior decisions, and later assemble a tested Sparky build handoff.
