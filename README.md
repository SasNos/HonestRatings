# Honest Ratings

Chrome extension for Google Maps that puts the bad reviews first. Bad reviews say more than good ones, so instead of the average stars and the number of all reviews it shows how many reviews are bad and how bad a place is, in **negative stars** (1-5 purple stars, fewer is better).

## What it does

- **Result list:** the rating of every place is replaced by purple negative stars and the number of bad reviews (1-2 stars). A `~` in front of the number marks an estimate (see below).
- **"Negative" filter:** a dropdown chip next to the "Rating" chip. Pick 1-5 purple stars to hide every place with more negative stars than that.
- **Place overlay:** when you open a place, an overlay appears at the top right with the three worst reviews that contain text, plus the exact count of bad reviews.

## How negative stars are calculated

`bad = reviews with 1 or 2 stars`, `share = bad / all reviews`.

| Share of bad reviews | Negative stars |
| --- | --- |
| up to 10 % | 1 |
| up to 15 % | 2 |
| up to 22 % | 3 |
| up to 30 % | 4 |
| more | 5 |

A place with a 4.0 average typically lands at 1 star. The star histogram is only available in the place panel, so the result list can only estimate from the average rating (`~`). Once a place is opened, the overlay shows the exact numbers. The thresholds are constants in [src/scoring.js](src/scoring.js).

## Install (developer mode)

```powershell
npm install; npm run build
```

Then open `chrome://extensions`, enable developer mode, choose "Load unpacked" and select the `dist` folder.

## Limits, honestly

- The three worst reviews need a Google login: Maps only lets signed-in users sort reviews. Signed out, the overlay shows the exact bad-review count (if the histogram loads) and a sign-in hint.
- The extension reads the Maps page; it has no API key and sends nothing anywhere. When Google changes the markup, selectors break. All of them live in [src/dom/selectors.js](src/dom/selectors.js).
- To read the reviews, the extension briefly switches the place panel to the Reviews tab, sorts by "Lowest rating" and switches back.
- Maps loads only part of the reviews; the worst three are chosen among those loaded after sorting.
- The sort menu is found by position (fourth entry) so it works in every Maps language; tab and chip labels are matched in English, German, French, Spanish, Italian, Dutch, Portuguese, Japanese and Chinese.

## Development

```powershell
npm test        # vitest, jsdom, 100 % line and branch coverage enforced
npm run build   # bundles src/ into dist/
npm run icons   # regenerates icons/
```

Code and documentation are English. The design follows Google's Material look (purple accent, 4 px spacing grid, light and dark mode).

## License

MIT, see [LICENSE](LICENSE).
