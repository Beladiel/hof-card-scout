# Summoner Scout — Sparky Development Handoff
**Prepared:** 2026-11-15  
**Stage:** Build an actually working v0.1, test, then expand; this is a new app, not a change to Idea Atlas.  
**Source-of-truth catalog entry:** `idea-atlas/catalog.js`, ID `summoner-scout`.

## Mission
Build a friendly, FREE, mobile-first companion for a returning **Summoners War: Sky Arena** player. They have forgotten many game menus and their old goals. The companion should answer "What was I doing?", "Where do I find that?", "What should I do next?", and "Which teams worked?" It is a **second-screen companion**, not an automated game client, bot, account scraper, or clone of Summoners War. Player prefers **PvE, monster collecting, dungeon farming, ToA, Rift and achievements**; they dislike PvP and only do it when missions require it. No competitive arena agenda.

## Constraints
- Works well on **iPad (landscape and portrait)** and **iPhone**, also Windows browser. PWA/installable if straightforward.
- **No paid APIs, subscriptions, advertising, or new hosting costs.** Start with static HTML/CSS/JavaScript hosted through existing GitHub Pages repo, if feasible. Avoid the previously troublesome Vercel 403 flow.
- Do not modify or break existing apps, `idea-atlas/`, Card Scout, or other working projects. Work in a new `summoner-scout/` directory. Use small, reversible commits.
- **Privacy:** Do not commit real player account names, screenshots, monster inventory, battle records, or personally identified backups to this public repo. Store player data locally in the user's browser. Synthetic demo data is fine, clearly labeled. A private JSON import/backup workflow may eventually load the real data.
- Do not use unofficial bot/screen scraping tools or promise access to Com2uS account APIs. Manual entries first; screenshot import/recognition can be explored later and must ask for confirmation of uncertain identifications.
- Avoid speculative game facts. Navigation content must be verified for the current game UI and annotated with a last-checked date. Do not advise sacrificing rare monsters based on portrait recognition alone.
- The game is an unofficial third-party reference; don't imply affiliation with Com2uS. Prefer original UI and icons over copied game art.

## v0.1 acceptance criteria — build these FIRST
1. **Dashboard**: visually polished, touch-first start screen with "What should I do next?", current ToA Hard floor, monster storage counters, recent dungeon results and a free-to-play/PvE-only preference. Never claim a recommendation is verified when based only on a guess.
2. **ToA Tracker**: separate current rotation progress and *historical best*. Editable mode (Normal/Hard), current floor, historical best, stretch target, optional team notes; save after reload. Show progress toward next user-set milestone. Don't treat mission incomplete as never-cleared historical achievement.
3. **Dungeon Run Log**: choose dungeon + difficulty, record outcome, clear time in m:ss (optionally milliseconds), optional team label and notes; display number of wins/losses, best, average winning time, and whether reliability is untested due to small sample. Do not silently assume every saved run is a win. Preserve previous best independently of current run history.
4. **Monster Space Tracker**: three independently editable counts/capacities: Regular Monster Inventory, Monster Storage, Normal Monster Sealed Shrine. Calculate free slots and occupancy correctly. Track movement by adjusting both source/destination only with user confirmation, or just edit counters initially. Never imply moving in the companion moves a monster in the game.
5. **Where Is It?**: searchable short step-by-step game navigation tips, editable/user-correctable notes. Starter entries: Summoner's Way via island; Monster menu from island; Normal Monster Sealed Shrine via island building, then Normal tab; Profile records via Summoner's Tower > Profile; Dragon's Lair in Battle > Cairos; ToA in Battle. Show a "May vary after updates" note and a last-reviewed date. Explicitly **do not** repeat the incorrect suggestion that the decorative diamond beside Storage 218/220 is clickable.
6. **Storage and backup**: localStorage or IndexedDB persistence with schema version; import/export full JSON; import preview and explicit confirmation; backup is not a sync guarantee. No fake cloud sync.
7. **Real working navigation**: every primary tab/button and all save/import/export controls must work. No empty decorative screens marked complete. Basic responsive/accessibility support (labels, keyboard use, legible text, decent hit targets).

## Suggested screen structure
Bottom navigation on small devices: Home | ToA | Dungeons | Storage | Find It. On tablets, use side navigation or a responsive wide layout. Dark fantasy-adjacent but original, restrained graphics; high readability. Provide quick-entry controls usable with one hand while the game is running in parallel.

## Model and future phases
**v0.2:** monster roster (verified names/element/base star, last used, reserve/keep/skill-up candidates), teams per activity, manual rune notes. Do not auto-classify trash from tiny icons.  
**v0.3:** learning modules for runes, artifacts, awakening, Dimension Hole, Rift and ToA; returning-player temporary bonus countdown and a list of FREE rewards vs PAID offers.  
**v0.4:** optional annotated screenshot reference flow; no OCR assumptions; confidence/status tags for confirmed vs tentative data.  
**Later:** optional free-tier cross-device sync only if reliable and user explicitly chooses it; no required login for v0.1.

## Existing real-user discoveries — KEEP PRIVATE, NOT IN PUBLIC APP DATA
The active discussion has account records and screenshots; request the **private account baseline JSON** from the user or ChatGPT before importing. Do not paste those account identifiers or private screenshots into this public GitHub repository. The user has a saved five-monster Dragons Abyss Hard team and a saved ToA Hard team; they are now resuming ToA Hard. The first two comeback Dragon runs both won, including a new best. They have nearly full monster storage but freed regular inventory by storing unused 3-star duplicates. These facts shape UX, **not public demo seed data**.

## Implementation/testing plan
1. Inspect current repo and GitHub Pages settings; do not assume hosting is active. Create `summoner-scout/` as a self-contained static web app.
2. Ship just the **v0.1** implementation, use entirely fictitious default sample data or blank values. Include a README for installing on iPhone/iPad and explain backup limitations.
3. Test create/edit/save/reload; add two dungeon runs; edit ToA; change three storage counters; export and re-import; search guides; verify narrow phone and tablet landscape layouts. Inspect any console errors.
4. Send the user a direct, tested URL (if deployed), a checklist of functionality that actually works, and known limitations. Stop here and solicit feedback before advancing to v0.2.
5. Reuse existing GitHub repository but never overwrite `idea-atlas/` or any other app.

## Definition of done
User can open the live v0.1 on iPad, enter their ToA floor and three inventory counts, log a Dragon battle, close and reopen the app, see their entries preserved, export backup JSON and read verified-ish navigation instructions. No screenshots required to get started; no paid service or external account setup.
