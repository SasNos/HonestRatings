# Honest Ratings: working rules

Read this first, then `README.md` and `docs/STATUS.md`.

- The user talks German; everything in the repository is English (code, comments, file names, commit messages, docs). UI strings are English source strings.
- The global rules of the user apply (`~/.claude/CLAUDE.md`): 100 % line and branch coverage (`npm test` enforces it), one logical change per commit with named paths, honest reports.
- The repository is public (`github.com/SasNos/HonestRatings`, set up by the user). Nothing private goes in: no notes, no tokens.
- Style guide and grid are inherited from Spark (`SasNos/Spark`, `CONCEPT.md` section 5), which takes Mber Flow's design system (`SasNos/MberFlow`, `docs/STYLEGUIDE.md`, tokens in `app/src/theme.css`). `src/styles.css` holds copies of the tokens it needs with an `--hr-` prefix; rules use only those variables, nothing by feel. When Mber Flow changes a token, copy the new value.
- Run `npm run check` (ESLint, Prettier check, tests with the coverage gate) before every commit; CI runs the same on every push and pull request.
- All Google Maps selectors live in `src/dom/selectors.js`. Check them against the live page after any Maps change; the built-in browser can inject `dist/content.js` for that.
- Never sign in to Google for testing; the review sorting cannot be verified signed out (see `docs/STATUS.md`).
- LF line endings, UTF-8. Windows PowerShell 5.1: chain commands with `;`.
