# Status

## Chip alignment, 17 October 2026

The "Negative" chip now copies the Maps chip geometry measured on the live page: a 48px row with 6px right margin, a 32px pill centered in it (8px vertical margin), radius 8px, no border, Maps shadow, padding 0 4px 0 12px, label 500 14/20 Google Sans Text, 24px caret. Checked live (pill at the same y and height as the "Rating" chip); not re-checked in German or dark mode.

## First signed-in test (German Maps), 17 October 2026

The debug line showed "sort button missing, 0 menu items, 26 review elements": the reviews are on the page, only the sort button was not found. Also "10 of 25 reviews" for a place with 659 reviews: the histogram parser assumed the order "5 stars, N reviews". And the chip stayed floating because the first scan ran before the filter bar existed.

Fixes: the sort button is also found by label (sort, sortieren, trier ...), and when no sorting is possible the worst of the loaded reviews is used; the histogram is read by position (five consecutive rows, 5 down to 1) so the word order does not matter; a floating chip moves to the rating chip as soon as it exists. The real German labels are still unknown; the debug line now also prints the histogram it read.

## Stuck stars and "no bad reviews", 17 October 2026

User test: stars sometimes jumped to 5 after the map moved, and the overlay always said there were no bad reviews with text.

- Stars: the parser read the extension's own label ("2 of 5 negative stars") as a rating once Maps rebuilt a card. Own stars are now skipped, and a badge is rebuilt when Maps reuses a card for another place.
- Reviews: cause not yet known (needs a signed-in Maps session). Changes made blind: sort menu and option are pressed with the whole pointer sequence, the collector waits until the list actually changes after sorting, and the review text has a fallback when Maps renames its text class. When no review is read, the overlay shows a grey debug line (sort button found/missing, menu items, review elements); that line tells where it breaks. Remove it once the reviews work.

## Flicker fix, 17 October 2026

User test showed the panel jumping to the reviews and the overlay flickering on and off. Cause: the place was identified by the `h1`, which changes while the collector switches tabs, so every switch restarted the collection. Now the place comes from the URL path (`/maps/place/<name>`), results are cached per place, the exact numbers show at once from the overview histogram, the panel is faded out (`hr-collecting`) while tabs switch, and the scroll position is restored. 57 tests, 100 % coverage. Not yet re-tested in a real signed-in Chrome.

## State of 17 October 2026

First version built: Manifest V3 extension, esbuild bundle in `dist/`, 55 tests, 100 % line and branch coverage.

Where things are:

- `src/scoring.js`: negative stars from the star histogram or, as an estimate, from the average.
- `src/dom/`: Maps selectors, parsing (rating labels, histogram, reviews) and the collector that opens the Reviews tab and sorts by lowest rating.
- `src/ui/`: purple stars, result badge, "Negative" dropdown chip, top-right overlay. `src/styles.css`: Material look, light and dark.
- `src/app.js`: scans the page (MutationObserver), decorates result cards, places the chip, opens the overlay per place.

### Verified on the live page (signed out, English, 17 October 2026)

- Result cards (`[role=feed] [role=article]`) and their `"4.6 stars 561 Reviews"` labels, badges render and look right.
- The chip is placed after the visible "Rating" chip (Maps keeps a hidden duplicate of the chip row, which is skipped).
- Place panel: title is the last `h1` outside the feed (ads add a "Sponsored" h1 first); tabs are `button[role=tab]` with labels like "Reviews for <name>"; the histogram rows are `[role=img]` with labels like "5 stars, 404 reviews"; the sort button is `button[data-value="Sort"]`.
- Signed out, sorting opens a sign-in dialog, so the collector skips it (`a[href*="accounts.google.com/ServiceLogin"]` is the signed-out marker).

### Not verified

- The sort menu (`[role=menuitemradio]`, fourth entry = lowest rating) and the review markup (`[data-review-id]`, author, stars, text) need a signed-in Maps session. They follow earlier Maps markup and the unit tests, but have not been run against the live page.
- Not loaded as a real extension in Chrome yet (only the bundle was injected into the page), so manifest, `chrome://extensions` loading and the content-script CSS are untested.
- Only English was checked live; other languages rely on the label patterns and the position-based sort entry.

## Open work

1. Load `dist/` in Chrome while signed in and verify the sort menu and review scraping; fix selectors if needed.
2. Remember the chosen "Negative" filter between page loads.
3. Estimated badges in the list could be replaced by exact values once a place was opened.
4. Store listing (screenshots, description) if the extension should go to the Chrome Web Store.
