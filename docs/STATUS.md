# Status

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
