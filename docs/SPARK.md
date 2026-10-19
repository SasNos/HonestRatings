# Honest Ratings in Spark

Honest Ratings goes into Spark (`SasNos/Spark`) as a built-in tool. Spark has no extension system (Spark `CONCEPT.md` 6.16, target version 0.4), so the Chrome extension is the source and Spark ships its bundle. This file is the integration design; nothing of it is built in Spark yet.

## Shape

- Honest Ratings stays JavaScript. It reads and clicks the Google Maps page, so it has to run inside the tab web view; a Rust rewrite would gain nothing.
- Spark gets a small Rust module (`honest_ratings`) that owns the settings switch (on by default), the list of Maps hosts and the injection. All tool logic stays in this repository with its own tests.
- The Chrome extension keeps working from the same source (`manifest.json`, `npm run build`).

## Build and copy

- `npm run build` writes `dist/content.js` (one IIFE, no globals) and `dist/styles.css`.
- Spark copies both, pinned to a Honest Ratings commit, into its resources (copy, not link, as with Mber Flow). The commit is noted next to the files. In Spark they count as vendored code for the coverage rule; the coverage is enforced here.
- The style already matches Spark: tokens copied from Mber Flow with an `--hr-` prefix (`src/styles.css`).

## Injection

- When a tab finishes loading a URL on one of the Maps hosts in `manifest.json` (`google.<tld>/maps/*`, `maps.google.com/*`), and the switch is on, Spark adds the CSS and runs the script once per document.
- Windows (WebView2): `ExecuteScriptAsync` after `NavigationCompleted` / `DOMContentLoaded` with a host check, because `AddScriptToExecuteOnDocumentCreated` cannot be limited to URLs.
- macOS (WKWebView): a `WKUserScript` at document end in its own `WKContentWorld`, so the page cannot see the script, with the same host check.
- Maps is a single-page app; the script follows place changes itself (URL watch and `MutationObserver`), so one injection per document is enough.

## Rules it keeps

- Nothing callable is exposed to the page and the tab web view gets no Tauri capability; the script only reads and clicks the Maps DOM.
- No network request of its own (nothing to add to Spark's `docs/NETWORK.md`).
- The review list needs a Google sign-in in the Spark profile; signed out the overlay shows the share and a sign-in hint, as in Chrome.

## Open

- Maps markup in WebKit (macOS) has never been checked; the selectors were written against Chromium.
- The signed-in checks listed in `docs/STATUS.md` are still open.
