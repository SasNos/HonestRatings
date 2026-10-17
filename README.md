# Honest Ratings

Chrome extension for Google Maps that puts the bad reviews first. Bad reviews say more than good ones, so instead of the average stars and the number of all reviews it shows how many reviews are bad and how bad a place is, in **negative stars** (1-5 purple stars, fewer is better).

## What it does

Maps itself stays untouched: no changed dropdown, no changed result list. The extension only adds one overlay at the top right that appears when you open a place:

- negative stars (1-5 purple stars, fewer is better),
- the share of bad reviews with the count, for example `20% (200 / 1,000)` (a `~` marks an estimate, see below),
- Google's own rating,
- **all negative reviews** (1-2 stars) that contain text, **worst first**, in a scrollable list. The extension scrolls the review list to load more until it passes the 2-star reviews (at most eight loads).

## How negative stars are calculated

`bad = reviews with 1 or 2 stars`, `share = bad / all reviews`.

| Share of bad reviews | Negative stars |
| --- | --- |
| up to 10 % | 1 |
| up to 15 % | 2 |
| up to 22 % | 3 |
| up to 30 % | 4 |
| more | 5 |

A place with a 4.0 average typically lands at 1 star. The overlay uses the exact star histogram of the place panel; when it cannot be read, the numbers are estimated from the average rating (`~`). The thresholds are constants in [src/scoring.js](src/scoring.js).

## Install (developer mode)

```powershell
npm install; npm run build
```

Then open `chrome://extensions`, enable developer mode, choose "Load unpacked" and select the `dist` folder.

## Limits, honestly

- The negative reviews need a Google login: Maps only lets signed-in users sort reviews. Signed out, the overlay shows the share and count of bad reviews (if the histogram loads) and a sign-in hint.
- The extension reads the Maps page; it has no API key and sends nothing anywhere. When Google changes the markup, selectors break. All of them live in [src/dom/selectors.js](src/dom/selectors.js).
- To read the reviews, the extension briefly switches the place panel to the Reviews tab, sorts by "Lowest rating" and switches back.
- Maps loads reviews in pages; the overlay lists the negative ones it could load (up to eight scroll loads after sorting by lowest rating).
- The sort menu is found by position (fourth entry) so it works in every Maps language; tab and sort labels are matched in English, German, French, Spanish, Italian, Dutch, Portuguese, Japanese and Chinese.

## Development

```powershell
npm test        # vitest, jsdom, 100 % line and branch coverage enforced
npm run build   # bundles src/ into dist/
npm run icons   # regenerates icons/
```

Code and documentation are English. The design follows Google's Material look (purple accent, 4 px spacing grid, light and dark mode).

## License

MIT, see [LICENSE](LICENSE).
