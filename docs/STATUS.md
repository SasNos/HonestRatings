# Status

## Click to the review, free map controls, all 1-2 star reviews, 17 October 2026

- Every 1-2 star review is listed, also without text (shown as "No text"), 1 star first, then 2 stars (stable sort, Maps' order inside a rating). `negativeReviews()` no longer requires text.
- The reviews appear while they load: `collect(doc, options, onProgress)` reports the list after the first read and after each scroll load (at most 30); the overlay is redrawn each time and keeps its scroll position.
- A click on a review card (or Enter or Space) calls `revealReview()` in `src/dom/collect.js`: open the reviews tab, sort by lowest rating (not signed out), scroll until the `data-review-id` element exists (at most 30 loads), `scrollIntoView` to the centre, class `hr-flash` for 2.5 s. The collector and this function share `sortLowest` and `scrollUntil`.
- Overlay position: `top: 72px; right: 80px; max-height: calc(100vh - 112px)` and a width of at most 360px that shrinks with narrow windows, so it stays below the account and filter rows, left of the zoom, location and street view column and above the attribution. Measured only from Maps' known layout, not checked on a live page with a place open.
- Not verified live (needs a signed-in Maps session): the reveal click, loading by scrolling, the flash.

## Back to an overlay only, 17 October 2026

New approach from the user: no dropdown, no change in the results, only the overlay at the top right so that negative reviews are in view at once, sorted worst first. Removed: the "Negative" section in the Rating dropdown (`ratingMenu.js`), the purple badges in the result list (`badge.js`), hiding of places, worst-first ordering of the list, loading more results, the mirrored/Any-rating clicks, and the CSS and selectors for them. Kept: place tracking by URL, waiting for the panel, the collector with sorting and loading of all negative reviews, the overlay (stars, share and counts `20% (200 / 1,000)`, Google rating, scrollable list of every 1-2 star review with text, worst first), the debug line. `src/app.js` is now just `scan()` (URL change opens the overlay) and `start()` (MutationObserver). 69 tests, 100 % coverage. The entries below describe the removed result-list work and are history only.

## Negative rows keep only worse places (superseded), all negative reviews in the overlay, 17 October 2026

User tests: the overlay showed the values of the previous place, and the negative rows changed nothing in the list. Decisions and changes:

- Overlay values: the URL changes before the panel does, so the overlay read the previous place's title and histogram. `openPlace` now waits (up to 3 s) until the panel title matches the place name from the URL, reads the title at that moment, and only then reads and collects. The cache still keys on the URL.
- Negative rows (user chose "only worse places"): a negative pick clicks Maps' "Any rating" item and the extension hides places with a Google rating of at least 6 minus N (1 = below 5.0, 2 = below 4.0, 3 = below 3.0; unrated places stay). The Maps mirroring of the previous entry is removed. Because most places Maps lists are good, `fillList` (scroll the feed, up to 10 loads, until 8 places remain visible, then scroll back) is back, and runs again after Maps reloads the list. Combined with the worst-first order from the entry below.
- Overlay reviews: `negativeReviews()` returns every review with text and 1-2 stars, worst first (was: the three lowest). `collect()` scrolls the review list (`loadNegatives`, at most 8 loads) until a review above 2 stars appears or nothing new arrives, reads the debug counts before switching back to the overview tab (they were read after and were often 0), and the overlay shows "N negative reviews (1-2 stars) with text" above the scrollable list. Without a working sort the negative ones among the loaded reviews are used.
- Not verified live: the sign-in-only review loading, the scroll loading of reviews and of the result list (signed out Maps caps the list at ten).

## Worst first in the negative view, 17 October 2026

User: only places with 1 negative star showed up (the Maps list is mostly 4.0 and better), asked for "worst first". `orderFeed()` in `src/app.js` gives the children of `[role=feed]` a CSS `order` while the negative view is active: places by negative stars descending, then Google rating ascending; places without a rating after the rated ones; header children (before the first place) on top; children with text after a place (footer) at the end; textless children after a place (dividers) travel with it. Leaving the negative view removes the inline order. Checked live (signed out): the feed is a flex column and reversed `order` values really reorder its cards. This only sorts what Maps has loaded: if the list holds only good places, 2 or 3 negative stars still have little to show; the Maps option 3.0+ or 2.0+ (the mirrored rows) controls what Maps lists at all.

## Negative rows mirror the Maps options, 17 October 2026

The logic was rebuilt on the user's definition: the positive Maps options stay as they are (Google default, "or higher", 0.5 steps); the negative rows are aliases of them. 1 negative star = 4.0 or higher, 2 = 3.0 or higher, 3 = 2.0 or higher; there is no 4 or 5 (they would be 1.0+ and 0.0+). Picking a row clicks the matching Maps option (rating = 5 minus N, found by its star label, so it works in any language), marks no Maps option selected, closes the menu with Escape and switches the list to the purple negative view. Any Maps pick leaves the negative view. The client-side filtering, the exact bands and the automatic loading of more results from the previous entry are removed (Maps now filters itself). The negative stars shown in the list are still computed from the bad-review share and are not changed by the filter. Half steps for the negative rows were tried and dropped on the user's request.

Verified live (signed out, English): a scripted click on the Maps option "4.0" is accepted (menu closes, the Maps URL gets the rating parameter). The new rows themselves were checked only in the tests and, earlier, as a rendered section in the real menu.

## Few results above one negative star (superseded), 17 October 2026

User: the negative filter only worked with 1 star. Cause: the result list holds mostly places with Google ratings of 4 or more, and two or more negative stars mean roughly 3.7 or worse, so almost nothing was left. Changes: (1) the Maps rating options become exact bands while the extension runs ("3.0" = 3.0 to 3.4; Maps' own server filter still means "or higher", the extension hides what is above the band; "Any rating" clears it); (2) with a band or a negative filter active the extension scrolls the result feed to load more places (until 8 match, at most 10 loads) and scrolls back to the top, and it repeats this after Maps reloads the list. Verified live only that the feed (`[role=feed]`, overflow auto) accepts a scripted scrollTop; signed out Maps caps the list at 10 places, so loading more could not be observed. Not verified: loading more while signed in.

## Maps rating filter and negative filter exclude each other, 17 October 2026

The two filters were combined (AND). Now they are exclusive: state `minStars` is 0 for the Maps view (original ratings, Maps' own filter, no negative row selected) and 1-5 for the negative view. Picking a negative row sets the state, clicks Maps' "Any rating" item (first menu item, with a flag so the click does not count as a Maps pick), marks all Maps items unselected and closes the menu with Escape. Any click on a Maps item in the menu sets the state back to 0. Row "1" is now a real pick (all places, purple view), so the neutral state is separate from it. Not verified live: that Maps accepts the scripted click on "Any rating" and refreshes the list.

## Filter direction reversed, 17 October 2026

Picking N negative stars now keeps the places with at least N negative stars (before: at most N). 1 is the neutral row (everything stays), 5 shows only the worst places, which is roughly the same as filtering Google ratings of 5 minus N or lower. The neutral value moved from 5 to 1, so the negative list view is active for N above 1.

## Menu rows vanished, list stays Maps until filtered, 17 October 2026

After picking a negative star row the "Negative" section was gone when the menu was opened again: Maps keeps the `role=menu` element and rebuilds the rows inside it, but the menu was flagged as done. The section is now looked up by its class and added again whenever it is missing. The result list shows the original Google Maps ratings until a negative filter below 5 is picked; only then (`data-hr-negative` on the html element) the purple negative badges replace them, so both the Maps rating filter and the negative filter can be used. The place overlay is unchanged. Not re-checked live (needs a full extension run).

## Negative filter inside the Rating dropdown, 17 October 2026

The own "Negative" chip is gone (no more layout jumps, and the earlier chip alignment and menu clipping work is obsolete). When Maps builds its rating menu (`div[role=menu]` whose `menuitemradio` rows carry star labels; it is rebuilt on every open), `src/ui/ratingMenu.js` appends a "Negative" section with five rows of purple stars: same 32px rows and 16px padding, a divider and a small heading. The pick filters the result list and closes the menu by dispatching Escape on it (clicking the chip again did not close it). The menu is enhanced from the MutationObserver without the 200 ms debounce so it does not visibly grow. Checked live (signed out, English): section renders natively, a click is picked, Escape closes the menu; the list filtering itself is covered by the tests only. There is no marker on the chip showing that a negative filter is active.

## Same numbers for every place, 17 October 2026

"10 of 25 reviews are 1-2 stars" and 5 negative stars showed for every restaurant. Cause: `parseHistogram` scanned the whole page and read the extension's own chip stars ("5 of 5 negative stars" ... "1 of 5 negative stars", five rows of 5) as the histogram. Own stars (`.hr-stars`) are now skipped. The overlay summary now reads: purple stars, then "20% (200 / 1,000)" (bad reviews as share, count and all ratings; `~` on every estimated number), and a line "Google rating 4.0". The old text "Estimated from the average rating" is gone. Percentages under 10 % get one decimal.

## Duplicate review in the overlay, 17 October 2026

Maps sets `data-review-id` on the review and again on an element inside it, so the first (lowest) review showed twice. `reviewElements()` in `src/dom/parse.js` now takes the outermost element of each id once; the debug counts use the same function. Fixed from the user's report, not re-checked on the live page (needs a signed-in session).

## "No bad reviews with text" again, 17 October 2026

Reported after the dropdown fix; the debug line was not available, so the cause is not confirmed. Two likely causes fixed: an empty result was cached for the place (one slow load then stuck until reload), and the star rating of a review was read from the first image in the review (an avatar or badge could come first, so the review was dropped). Stars are now taken from the first image whose label looks like a rating ("1 star", "Mit 2 von 5 Sternen bewertet"). The debug line also prints how many review elements have stars and text. If it still fails, that line says where.

## Dropdown did not open, 17 October 2026

The menu was an absolutely positioned child of the chip, and the Maps chip row is only 48px high and clips its children, so the menu opened but stayed invisible. The menu now moves into the body on first open and is positioned fixed under the button (`position: fixed`, z-index 2000). Verified live with real clicks (signed out, English): the menu shows below the chip with the five purple star rows.

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

1. Verify in a signed-in Maps session: sorting by lowest rating, the review markup, loading by scrolling, the click to the review and the flash; fix selectors if needed.
2. Integration into Spark as a built-in tool (Spark 0.4), designed in `docs/SPARK.md`; nothing built in Spark yet.
