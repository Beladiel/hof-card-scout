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

This public build uses the separate storage key `summoner-scout.review.v2` and starts with clearly fictional demonstration records. It cannot read the private Site's origin-scoped browser storage. Version-1 review data is migrated locally, while malformed records remain untouched and trigger recovery or demo fallback. Do not add real account names, screenshots, monster inventories, battle records or private backups to this repository.

## Data model and safety

- Schema version 2 validates all nested fields, ranges, outcomes and record IDs.
- ToA Normal and Hard have independent current floors, historical bests, milestones and notes.
- Dungeon runs retain immutable IDs; statistics are filtered by dungeon, difficulty and optional team.
- Historical dungeon bests are stored separately from editable run history.
- Every confirmed import first writes a recoverable pre-import snapshot.
- Imported and user-controlled strings are escaped before HTML rendering.
- Storage failures show an error and offer backup export rather than claiming success.

## Verification

Run `npm test` for schema, migration, time parsing, statistics, HTML-safety contracts, recovery ordering, mobile safe-area, offline-assets and icon checks. Run `npm run check` for JavaScript syntax checks.

## Run locally

Serve `dist/` from any static HTTP server. For example:

```text
python -m http.server 8080 --directory dist
```

Then open `http://127.0.0.1:8080`.

## Deployment

`.openai/hosting.json` identifies the separate OpenAI Site used only for public review. The private production app has a different Site project and URL.

