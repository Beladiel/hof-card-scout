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

**Answer:** Pending.

## Interview workflow
Ask one question at a time. As answers are confirmed, append each decision to this file and update the catalog when practical. Keep original requirements and prior decisions, and later assemble a tested Sparky build handoff.
