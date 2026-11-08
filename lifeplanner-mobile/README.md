# LifePlanner Mobile v1.0

A free, local-first iPhone Home Screen companion for the existing LifePlanner Windows v1.2, built from the original Python/Tkinter/SQLite source.

## Current features

- Responsive category-tile dashboard matching the original categories: Vacation, Milestone, Doctor, School, Personal, Other.
- Four featured tiles show all upcoming events by default, with an optional first-upcoming-only toggle.
- Date countdowns, multiple entries per day, time, notes, original reminder options, completed history, search/filter, event create/edit/delete and complete/reopen.
- Private device storage: browser localStorage with a safety copy. No personal data sent to GitHub or any cloud server.
- **Import PC Backup:** accepts native Windows LifePlanner1 JSON exported through the PC's Save Backup button. The desktop columns are id, title, category, day, time, notes, remind_days, completed, alerted_on.
- **Merge Missing:** adds events that don't already match title/category/date/time, without overwriting matching events. This is not conflict-resolution sync.
- **Replace Phone List:** confirm before replacing; a local pre-import snapshot is preserved in browser storage.
- **Export for PC:** writes original LifePlanner1 JSON understood by Windows Restore Backup. CAUTION: the desktop Restore Backup operation replaces ALL desktop events; save a PC backup first.
- **Save Phone Backup:** exports mobile data and settings as LifePlannerMobile1; this file can be reimported.
- Service worker caches the app shell for offline use; reminder notices appear only while app is opened.

## Original PC data

The original Windows database is at %LOCALAPPDATA%\LifePlanner\life_planner.db, settings at %LOCALAPPDATA%\LifePlanner\settings.json. This release does not modify either file.

## Storage safety

Mobile data is stored only in the browser/Home Screen app on this device. Do not uninstall the Home Screen icon; that may delete local data. Periodically save JSON backups to Files or iCloud Drive.

URL: https://beladiel.github.io/hof-card-scout/lifeplanner-mobile/

## Synchronization status

Automatic PC ↔ iPhone sync is NOT connected in v1.0. This version establishes a compatible data model and safe manual transfer. Full two-way sync will need a private authenticated cloud backend, a Windows sync adapter, and careful duplicate/conflict handling. No paid subscriptions or external accounts are required for v1.0.

Tests: node --test lifeplanner-mobile/tests/mobile-health.test.cjs
