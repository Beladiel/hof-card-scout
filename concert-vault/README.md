# Encore Concert Vault · v1.1

A free, private, mobile-first library for physical live-concert Blu-rays, DVDs and 4K UHD discs.

## New in v1.1 — Cover Helper

- Open **Cover Helper** from the app navigation or Collection page.
- Choose up to **24 cover photos** from iPhone Photos at a time, or take one photo with the camera. Each image is compressed and resized to a maximum of 720 pixels along the longest edge before saving.
- Preview the photos, filter concert names, and match each photo to its correct entry. Save one or all matched photos. Duplicated assignments are blocked; replacing an existing cover requires confirmation.
- **Local Photo Storage** shows the exact total number of bytes used by saved cover images and the number of concert entries with covers. If supported, `navigator.storage.estimate()` shows the browser's estimated quota/usage (which may include other content served from the same origin). This is **not** remaining iPhone space and does not guarantee iOS won't purge browser data.
- Cover images remain exclusively in **device-local IndexedDB**. They are never uploaded to GitHub or ChatGPT from the app. GitHub stores only the public app source code.
- Export a complete backup after adding a group of covers: it includes the images. Opening the same Home Screen icon is important to preserve the existing browser-local storage.

## What v1.0 does

- Catalog **Owned** and **Wishlist** concerts with artist, title, concert year, release year, venue, disc format, number of discs, audio mix/codec, rating, watched status, favorite flag and notes.
- Upload a real concert disc cover photo; image is resized and stored on the device in IndexedDB.
- Search and filter your collection by artist, concert, venue, format or audio mix.
- **Concert Night** chooses a random owned disc, or prioritizes an unwatched disc.
- **Backup & Import** downloads a complete JSON archive including cover photos and restores via safe merge (skips duplicates, never overwrites existing entries).
- **Import from Scout** accepts JSON batches formatted as `{"format":"scout-concert-batch","concerts":[{"artist":"Band","title":"Live Title","format":"Blu-ray","status":"Owned"}]}`. If source photos don't establish disc format, Scout should return `"Other"` rather than guess. No paid metadata API.
- No preset/synthetic user collection. The first install starts empty.
- Local safety copy protects catalog metadata from a corrupted primary save. Backups are still important for photo files.

## Install and preserve your collection

App URL: https://beladiel.github.io/hof-card-scout/concert-vault/

To install as an iPhone Home Screen app, open this one URL in Safari and choose **Share → Add to Home Screen**. Keep **one** Home Screen app icon and open the same icon after updates. Do not delete and reinstall the app: doing so can delete browser-local data.

The concert app uses dedicated storage keys, entirely separate from Miniature Paint Studio and HOF Card Scout. Data is **not** synced via GitHub or ChatGPT. Keep JSON backups safely in Files or iCloud Drive.

## Limitations

- Cover photos and data live inside the specific Safari or installed web-app storage location. Opening a link in ChatGPT's embedded browser may show a different collection.
- Formats/audio mixes aren't verified automatically; enter the edition information from the back cover.
- Photos are not automatically transferred from Scout to the app. You can ask Scout for a JSON batch from pictures, then paste it in the app's Backup & Import screen.
- The concert player itself is not controlled by the app.
- Tests: `node --test concert-vault/tests/concert-health.test.cjs`.
