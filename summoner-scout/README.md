# Summoner Scout — Public Review Build

This is the isolated public-review copy of Summoner Scout. It is an unofficial, static companion for a returning *Summoners War: Sky Arena* player and is not affiliated with Com2uS.

## Architecture

- Buildless HTML, CSS and JavaScript in `dist/`
- Responsive sidebar/bottom navigation
- Browser-local persistence in `localStorage`
- Versioned JSON backup import/export
- Service worker and web manifest for installable/offline use
- No backend, paid API, account connection, analytics or cloud sync

## Review coverage

- Dashboard and PvE-oriented next-step summary
- Trial of Ascension current rotation, historical best and milestone
- Dungeon win/loss logging with best and average winning time
- Regular inventory, Monster Storage and Sealed Shrine counters
- Searchable game-navigation references with player notes
- Backup export and confirmed import preview
- Phone, tablet and desktop responsive layouts

## Data and privacy

This public build uses the separate storage key `summoner-scout.review.v1` and starts with clearly fictional demonstration records. It cannot read the private Site's origin-scoped browser storage. Do not add real account names, screenshots, monster inventories, battle records or private backups to this repository.

## Run locally

Serve `dist/` from any static HTTP server. For example:

```text
python -m http.server 8080 --directory dist
```

Then open `http://127.0.0.1:8080`.

## Deployment

`.openai/hosting.json` identifies the separate OpenAI Site used only for public review. The private production app has a different Site project and URL.

