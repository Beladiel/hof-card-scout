# RetroQuest — Sparky Development Handoff

**Project:** RetroQuest: Retro Game Companion
**Prepared:** November 15, 2026
**Stage:** Requirements complete (30 confirmed interview choices); development not yet started
**Owner:** Personal-use app; not a public gaming community
**Primary device:** iPhone used beside an original-cartridge-compatible Genesis console; also works on a Windows laptop
**Canonical source:** [RetroQuest interview log](./retroquest-interview.md); [Idea Atlas catalog](../catalog.js)

## 1. The objective

Build a genuinely useful, free-to-run **retro game walkthrough companion**, not an emulator. The user plays physical cartridges on a console gifted by friend Jay. RetroQuest, open on iPhone or laptop, provides verified, version-specific walkthroughs, carefully controlled spoilers, original maps, manual references, hints, cheats and personal game progress.

**Non-negotiables**
- **No extra subscriptions, paid APIs, or paid hosting.** Verify real current free-tier limits and iPhone compatibility before choosing an authentication/sync provider.
- Functional features, not clickable mockups. Complete and manually test each milestone before the next.
- **Personal-only** experience. No public user accounts, open contributions, gamification, push alerts or social profiles.
- Preserve the existing Idea Atlas, CueLab and all other applications, repositories, user data and deployed links. Do not refactor or overwrite unrelated projects.
- Works as an iPhone-friendly installed web app/PWA; no manually opening downloaded files to use it.
- No unauthorized copying of original game manuals, commercial guides, maps, images or videos. Use original and verified guide content, authorized assets or clearly labeled links to external sources.
- Never invent factual game controls, cheats, maps, routes, boss mechanics, or hidden items. Mark unverified content as unavailable until researched.

## 2. Confirmed decisions (all 30)

The interview log contains the full question wording, options, and explanation. The decisions below take precedence over any earlier brainstorm that conflicts with them.

| # | Decision | Implementation implication |
|---|---|---|
| 1 | **B: All retro systems, Genesis first** | Multi-platform data architecture; author Genesis content first; other systems later |
| 2 | **C: Guided companion + reference library** | Switch freely between sequential spoiler-aware guide and searchable full reference |
| 3 | **C: Hybrid guide sources** | Original interactive guides for selected games, reputable external links for others |
| 4 | **C: Full and discovery maps** | Complete reference map and progressively revealed exploration mode |
| 5 | **C: Manual checkpoints + text location lookup** | Save checklist steps and let user search plain descriptions to find the relevant section |
| 6 | **B: Small starter collection** | Power Monger, Phantasy Star III, Phantasy Star II and King's Bounty — Genesis versions |
| 7 | **C: Progressive hints + direct solution** | Three ordered hint reveals or jump directly to spoiler-marked solution |
| 8 | **A: Simple collection** | Owned, Playing, Completed, Wishlist; no condition/price/box/manual inventory |
| 9 | **B: Save chosen game guides offline** | Download integrated licensed/original guide packs per selected title |
| 10 | **C: Automatic cross-device sync** | iPhone/laptop sync after reconnection, offline edits preserved, conflict-safe |
| 11 | **A: Google sign-in** | Google account authentication for sync, no extra password or magic-link flow |
| 12 | **A: Classic retro arcade appearance** | Pixel-inspired but legible UI, nostalgic console styling, accessible touch layouts |
| 13 | **C: Quick controls + beginner tutorial** | Reference diagram and skippable, interactive first-session lessons |
| 14 | **C: Illustrations + optional video links** | Contextual original/licensed visual aids, external demonstration links |
| 15 | **C: Bookmarks + game notebook** | Per-game bookmarked guide steps/maps and private notes, offline and synced |
| 16 | **C: Organized cheats + favorites** | Categories, activation/compatibility/warnings, favorited/tried states |
| 17 | **A: Personal-use companion** | Do not build a public community or moderated guide-submission pipeline |
| 18 | **A: Text and visuals only** | No microphone permissions, speech recognition, voice controls or TTS |
| 19 | **B: Reference charts + trackers** | Searchable verified RPG/strategy data and player-controlled item/boss checklists |
| 20 | **C: Continue Playing + library home** | Last checkpoint hero section above searchable personal game library |
| 21 | **A: One playthrough per game** | Only one current save; confirm before reset, preserve collection and general notes |
| 22 | **A: Auto-update offline guides** | Background content updates with stable IDs; never reset player data |
| 23 | **C: Manual links + searchable references** | Link authorized manuals; independently write searchable controls/mechanics summaries |
| 24 | **B: Add games manually** | Game title and specific platform entered by player; no catalog-match requirement |
| 25 | **C: External help + Guide Wishlist** | Link available third-party walkthroughs, flag missing native guides for later work |
| 26 | **B: In-app new-guide announcements** | What's New/New Guide badges, not iPhone push notifications |
| 27 | **C: Auto backups + manual export** | Safe versioned snapshots within a proven free tier; JSON export and verified restore |
| 28 | **A: Simple completion only** | Completed flag, optional date; no achievements, badges or XP |
| 29 | **A: Only the version owned** | Library entry guides/cheats correspond to its actual platform; no version-switch UI |
| 30 | **B: Build and test in stages** | Real playable milestones before adding complex functionality |

**Critical naming correction:** The fourth launch game is **King's Bounty**, NOT King's Quest. The three other games are **Power Monger**, **Phantasy Star III: Generations of Doom**, and **Phantasy Star II**. Do not reintroduce King's Quest from earlier drafts.

## 3. First release and content scope

**Initial game library seeded or entered manually:**
1. **Power Monger — Sega Genesis** — first real, verified *beginner guide* pilot because the user has never played it. Prioritize the console-specific controls quick reference, first-session tutorial, checklist and selective hints.
2. **Phantasy Star III: Generations of Doom — Sega Genesis** — incremental RPG walkthrough, character/system references and maps as verified content is available.
3. **Phantasy Star II — Sega Genesis** — incremental walkthrough, dungeon/navigation aids, equipment and enemies as verified.
4. **King's Bounty — Sega Genesis** — strategy/tutorial references and campaign help as verified.

Having a game entry does NOT imply complete guide coverage. Display honest states: **Guide available**, **Partial guide**, **External resources**, or **Guide requested**. Prioritize original verified guide content over quantity. Research content against the correct platform, game edition and primary sources or multiple reliable guides. Clearly distinguish authored in-app content from third-party links. Never paste copyrighted external guides into the app.

## 4. Product architecture and data guidance

A modern static front end/PWA is acceptable if it works on real iPhone Safari/PWA and laptop browsers. Keep all app files in their own well-isolated project area or repository. Use GitHub version control and genuinely free hosting; existing GitHub Pages can be considered for the PUBLIC app shell, with an appropriately secured cloud store for PRIVATE user data. Avoid repeating previous Vercel deployment/access failures without investigating the cause.

**Design local-first.** Store progress/collection/notes in a durable offline-capable local datastore, with versioned schemas, stable object IDs and separate content/user-state namespaces. A paid LLM/API is not required. Location descriptions should use offline index/search across original guide sections, keywords and synonyms; prompt the player to choose from matched sections instead of pretending to understand arbitrary game state.

Suggested conceptual records (names adaptable):
- `GameEntry`: stable ID, player-entered title, platform/edition owned, status (Owned | Playing | Completed | Wishlist), optional completion date, guide-wishlist flag, last-opened timestamp, native-guide link if mapped
- `GuideManifest`: canonical title/platform ID, version, provenance/license/source metadata, sections, tutorials, mapped assets, cheat/reference datasets, external legal links, guide status, offline pack manifest
- `PlayProgress`: one per GameEntry, last section/checkpoint, completed-step IDs, tutorial completion, discovered-map-location IDs, relevant tracker values, spoiler/hint reveal state, update timestamp
- `PersonalAnnotations`: bookmarks (stable target IDs), per-game private notebook text, cheat favorites and tried state
- `OfflinePack`: specific guide revision, downloaded owned/licensed resources, cache and integrity status
- `SyncMetadata`: local change IDs, revision/version, last successful sync, pending operations, conflict/recovery state, backup checkpoints
- `Announcements`: new original guide release ID, date, read/dismissed state

Use stable section/map IDs so later content updates do not break progress, bookmarks or discoveries. Progress and guide content should never share the same mutable cache entry. Keep a way to export a versioned JSON backup; implement import with schema validation and a preview before replacing data. Only one active playthrough for each game; reset must be confirmed and must not wipe collection ownership or unrelated personal notes by default.

**Privacy:** Google authentication should protect private remote records with user-level access controls. A publicly hosted static app is not itself private; do not expose private synced data or secrets in source code or client bundles. Choose an authentication and database service only after confirming its free-tier limits, supported Google login, suitable row-level permissions, iOS browser behavior and export options. A service not truly free at the required usage is disqualified. If free automatic backup history is infeasible, do not silently present backup as working; ship manual export first and clearly flag the automatic feature as unfinished until proven.

## 5. User experience

**Home:** Retro arcade styling, clearly readable fonts and mobile touch targets. First card: Continue Playing with game name, last saved objective and Resume button. Then personal visual game shelf, Add Game action, filter (Owned / Playing / Completed / Wishlist), search, bookmarks, maps, Guide Wishlist, What's New, backup/settings.

**Game detail:** Platform badge, guide availability, Continue Walkthrough, Full Reference, Maps, Controls, Beginner Tutorial, Cheats & Secrets, Reference Charts & Trackers, My Notes, Bookmarks, External Guides, Manual Link, Offline availability.

**Guided mode:** Checkable steps with saved progress. Allow user to choose current chapter/area; also type a description and receive matching indexed sections. Avoid spoilers in results/previews where player has enabled spoiler concealment.

**Hint system:** Each supported obstacle can expose Hint 1 (nudge), Hint 2 (clearer), Hint 3 (solution) one by one, or a separate Show Solution action with warning. Remember reveals without leaking other future steps.

**Maps:** One fully revealed zoomable reference view and one player-driven discovery map that hides unvisited areas and secrets. Support meaningful taps, labels, checkmarks and persistent per-game discoveries. Map implementation must reflect verified game geography; don't invent data to populate empty maps.

**Images/videos:** Prioritize credited, licensed/authorized or originally drawn illustrations. Use optional external video links, never copy videos into app storage. No imagery is necessary for unverified sections and no video is required to understand a step.

**Library & Guide Wishlist:** Manual Add Game form works even when the title isn't present in an existing catalog. An entry can link to an available native guide or, if unavailable, to separately verified external resources plus a Guide Wishlist priority flag. Guide Wishlist is separate from collection status Wishlist.

**Strategy and completion:** Include reference charts and practical per-game manual trackers. Mark game Completed with optional date. Do not introduce a score, XP, achievements or multi-save branching tracker.

## 6. Milestone-based implementation plan

### Milestone 0 — Safe project scaffolding
- Identify existing repository/layout and deployment approach without changing unrelated apps.
- Make isolated RetroQuest files, a README, data schema, development scripts, a short testing checklist and git history/rollback.
- Basic accessible, retro arcade iPhone shell and offline-safe navigation.
- Establish error reporting and backup/export strategy from the outset.

**Pass:** Runs on real iPhone and laptop via normal web URL; no 403, blank screen or console-breaking error; no other app changed.

### Milestone 1 — A functioning personal companion
- Manual Add/Edit/Delete Game with required title and platform, and simple statuses.
- Seed or manually add the four initial Genesis entries without claiming guides are complete.
- Show Continue Playing and library; switching game pages actually works.
- Load a **verified, genuinely useful Power Monger starter lesson**, controller reference and several real checklist steps; no fake button mappings.
- Implement single-playthrough local saved checkpoints, search within indexed guide sections, resume behavior, and an early JSON Export Backup.
- Add a simple direct link to verified outside resources where appropriate.

**Pass:** Add a fifth obscure game not in catalog; mark it Playing; open/close app; return to the same saved guide step after iPhone restart or tab/app closure. Confirm completion/status persists. Check the Power Monger control guide against the Genesis game.

### Milestone 2 — Rich guides, cheats and game-specific trackers
- Add the second guide-reading mode (complete searchable reference), progressive hints/direct solution, verified cheat categories, manual quick references and optional video links.
- Bookmarks, private per-game notes and cheat favorites/tried states.
- Add first practical RPG/strategy charts and item/boss/quest trackers.
- Expand original guide coverage for Phantasy Star III, Phantasy Star II and King's Bounty, with honest Partial/Available statuses.

**Pass:** Spoilers stay concealed in guided mode; hints require deliberate revealing; cheat instructions specify versions; no unlicensed manual or guide text is copied. Saving notes and bookmarks survives restarting the browser.

### Milestone 3 — Functional maps and offline guide packs
- Reference map and separate discovery map, with meaningful mark/reveal behavior and persistent state.
- User-selected offline packs that contain only native or authorized text/images/maps; third-party guide URLs remain links.
- Safe automatic updates for downloaded packs, with manifest checks and previous cache retained until success.

**Pass:** Disconnect network after saving a pack; navigate guide, maps, hints and notes on iPhone; reconnect and update guide text without losing checkpoints/discovery state.

### Milestone 4 — Google sign-in and free automatic syncing
- Investigate and verify a **genuinely free** auth/database tier with secure Google login. Implement per-user private data, local-first offline writes and automatic cross-device sync.
- Implement conflict-safe merges or explicit conflict recovery, not silent last-write-wins overwrites for notebooks/progress.
- Reconcile existing local data when connecting the Google account without deleting it.
- Never make offline guide use dependent on an active sign-in session.

**Pass:** Save checkpoint on iPhone, open on laptop and verify it appears; make edits offline, reconnect and verify neither overwrites newer valid user data. Test signed-out and account-switch behavior.

### Milestone 5 — Release hardening, notifications and backups
- Dismissible in-app What's New/New Guide indicators and Guide Wishlist linkage (no push permission).
- Automatic backup snapshots on a verified free tier, with retention/restore tests; manual JSON restore with preview/confirmation.
- Finish iPhone home-screen install behavior, accessibility, security checks, performance, storage/backup documentation and deployment instructions.

**Pass:** Restore an exported backup into a clean test session and verify library, progress, notes, map state and favorites. Simulate an interrupted content update, rejected login, account switch and failed sync without losing the only good copy of personal data.

## 7. Definition of done for every milestone

Every feature claimed as done must:
1. Work on a real iPhone, including a home-screen-installed PWA, and on the Windows laptop.
2. Survive app closure/reopen and appropriate offline/reconnect transitions.
3. Persist the *right* user data without resetting unrelated games or notes.
4. Have readable UI on small screens and acceptable keyboard/touch accessibility.
5. Be grounded in the correct Sega Genesis title/edition where game facts are involved.
6. Use no paid required API and respect the content rights of referenced assets.
7. Be committed to GitHub with meaningful commit descriptions and a reversible deployment.
8. Be manually testable through a short checklist; no "working" status for static placeholders.

## 8. Sparky kickoff instruction

**Start at Milestone 0 and 1, not the entire feature list.** Read this handoff and the decision log. Inspect the current GitHub project before editing. Create or select an isolated RetroQuest location so existing Idea Atlas, Gift Exchange, CueLab and other applications/data remain untouched. Keep the initial release local-first and genuinely playable without waiting for cloud infrastructure. Never fabricate walkthrough details to make the prototype appear complete. Verify Power Monger's Sega Genesis controller mechanics and introductory objectives before putting them in the guide; if verification isn't yet possible, implement a clearly labeled data framework and request approved/source-backed guide material rather than invent it. Show the user the working iPhone/laptop URL and precise tests performed at each milestone before proposing the next phase.

**All 30 design answers are approved.** New scope choices should be raised only where technically necessary. Do not expand the app into a public service or add capabilities the user explicitly rejected (voice, detailed valuation catalog, achievements, multi-save, push notifications, etc.).
