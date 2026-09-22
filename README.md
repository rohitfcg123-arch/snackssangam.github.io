# CMA MCQ Portal — Flat Staging

All subject HTML files are stored directly in the repository root. There are no subject folders and no subject `index.html` files.

Root files:
- `index.html` — Home
- `admin.html` — Admin
- Subject files use unique group-prefixed names.

Firebase project: `cma-mcq-portal-cf33f`
Admin: `rohit.fcg123@gmail.com`

Access model:
- Login is requested only when protected content is opened.
- Free-tier behaviour is controlled from the Admin Portal ("Access & Pricing Settings" panel), stored in `settings/access` (publicly readable, admin-writable):
  - `freeAccessMode`: `"attemptLimit"` (default — capped number of free test attempts, tracked in `attempts`) or `"fixedPool"` (free users always draw from the same first N MCQ Bank questions, sorted by id, and can reattempt them without limit).
  - `freeAttemptLimit` (default 5) — used when mode is `attemptLimit`.
  - `freePoolSize` (default 30) — used when mode is `fixedPool`.
  - `siteWideFree` (default false) — when true, every logged-in user gets full premium access to everything, overriding all of the above.
  - Previous Year Papers are always premium-only for free users, regardless of mode.
- Paid access is stored in `access/{email}` and is group-specific.
- Payments are stored in `payments`.
- Login records: `loginEvents`.
- Portal visits: `portalVisits`.
- `admin.html` is a separate, unlinked URL — it is not referenced anywhere in the public pages and is reachable only by whoever has the link, gated by the Firebase admin email check inside the page.
