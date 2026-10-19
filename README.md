# Honest Ratings

Chrome extension for Google Maps that puts the bad reviews first. Bad reviews say more than good ones, so instead of the average stars and the number of all reviews it shows how many reviews are bad and how bad a place is, in **negative stars** (1-5 ember stars, fewer is better).

## What it does

Maps itself stays untouched: no changed dropdown, no changed result list. The extension only adds one overlay at the top right that appears when you open a place:

- negative stars (1-5 ember stars, fewer is better),
- the share of bad reviews with the count, for example `20% (200 / 1,000)` (a `~` marks an estimate, see below),
- Google's own rating,
- **all reviews with 1-2 stars**, with or without text, **1 star first, then 2 stars**, in a scrollable list. They appear while they load (the extension scrolls the review list, at most 30 loads), so the worst are in view at once.
- **A click on a review** (or Enter) shows it in the Google Maps panel: the extension opens the reviews tab, sorts by lowest rating, scrolls until the review is loaded, scrolls it to the middle and flashes it.

The overlay sits right of the map and leaves the Maps controls free: below the account and filter rows, left of the zoom, location and street view buttons, above the attribution.

## How negative stars are calculated

`bad = reviews with 1 or 2 stars`, `share = bad / all reviews`.

| Share of bad reviews | Negative stars |
| -------------------- | -------------- |
| up to 10 %           | 1              |
| up to 15 %           | 2              |
| up to 22 %           | 3              |
| up to 30 %           | 4              |
| more                 | 5              |

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
- Maps loads reviews in pages; the overlay lists the negative ones it could load (up to 30 scroll loads after sorting by lowest rating). A place with more negative reviews than that is listed partly.
- The sort menu is found by position (fourth entry) so it works in every Maps language; tab and sort labels are matched in English, German, French, Spanish, Italian, Dutch, Portuguese, Japanese and Chinese.

## Development

```powershell
npm test              # vitest, jsdom, 100 % line and branch coverage enforced
npm run lint          # ESLint
npm run format        # Prettier, rewrites files (format:check only checks)
npm run check         # lint, format check and tests, as in CI
npm run build         # bundles src/ into dist/
npm run icons         # regenerates icons/
```

Code and documentation are English. The look is inherited from Spark, which uses the Mber Flow design system: ember accent, warm sand surfaces, the Mber Flow spacing and type scale on a 4 px grid, light and dark mode. The tokens are copied into `src/styles.css` with an `--hr-` prefix (see Spark `CONCEPT.md` section 5 and Mber Flow `docs/STYLEGUIDE.md`).

## License

MIT, see [LICENSE](LICENSE).
