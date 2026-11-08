# Miniature Paint Studio · v1.6

Standalone, mobile-friendly, local-first hobby studio for miniature painters. Live URL (after GitHub Pages deploy):

https://beladiel.github.io/hof-card-scout/miniature-paint-studio/

## Features

- Miniature collection with a pre-created **Nova Aetas Renaissance · Dual-Axe Warrior** project.
- Model/game organization, board-game completion progress, painting stages and journal entries.
- Upload unpainted, artwork reference, painted concept and finished photos, stored in browser IndexedDB after downsizing.
- Art-to-Mini workspace with preset color schemes and local artwork color extraction (not AI).
- Copyable instruction prompt for use in ChatGPT with **both user-supplied images** to generate painted-preview concepts.
- 13 multi-step painting tutorials including leather, fire, eyes, skin, steel, cloth, washes, drybrushing, priming, etc.
- Vallejo-first paint rack that does not invent owned paint numbers.
- JSON backup and restoration of **both data and images**.
- Offline shell via service worker once loaded at least once online.

## Free in-app AI painted preview (v1.1)

- Art-to-Mini now has **Generate Free Painted Preview** using the AI Horde volunteer img2img network. A photo of the unpainted miniature is the only required input.
- Choose Surprise Me, Renaissance, Dark Fantasy, Bright Heroic, Realistic Weathered, or Custom instructions. The photo is resized to a padded 512x512 source and sent to volunteer workers over HTTPS, with no secret or user-paid subscription.
- The result is stored in the existing Painted Concept image slot when the provider allows browser downloads; the preview is visible otherwise for manual saving.
- **Privacy:** Photo data leaves your phone, and volunteer workers may see submitted photos. Never upload photos containing private people or confidential information. Anonymous AI Horde jobs are free but lowest priority, subject to availability, and may take several minutes or fail. Unlike a dedicated, paid editing model, the sculpt's features are not guaranteed to remain exact.
- Existing miniatures, paints, notes and photo storage remain unchanged.

## Important limitations

- **Free AI image generation is community-powered.** AI Horde requests require an internet connection, may queue or fail, and output fidelity varies. Unlike the local project journal, photos submitted to AI Horde leave the device.
- **No account/cloud sync.** Data and photos are stored locally in the browser and may not move between Safari, a standalone home-screen app, or other devices. Export backups regularly; save them to Files/iCloud Drive or another safe location.
- Current backing data can be lost if site storage is cleared, an app is removed, or browser storage is evicted.
- The site is hosted within the existing Card Scout GitHub Pages repository under a distinct path and distinct browser data keys. It does not alter the Card Scout card database.
- Brand names and generic paint examples are educational references; specific paints are not presumed to be owned.

## Run locally

Serve this folder with any static HTTP server. For example:

python3 -m http.server 8000

Then visit http://localhost:8000/miniature-paint-studio/ from the repository root. IndexedDB and service workers require a browser context supporting these features.

## Acceptance checks

node --check miniature-paint-studio/app.js
node --check miniature-paint-studio/academy.js
node --check miniature-paint-studio/sw.js
node --test miniature-paint-studio/tests/studio-health.test.cjs

No third-party dependencies; no remote endpoints or access keys needed.
