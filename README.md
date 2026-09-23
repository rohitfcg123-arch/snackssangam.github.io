# CMA MCQ Portal — Common Engine Architecture

All subject HTML files stay in the repository root. No subject folders are required.

## Root
- `index.html` — Home + Google login + subject directory
- `subjects.html` — Subject directory
- `payment.html` — Premium payment/UTR page
- `admin.html` — Admin console
- `firestore.rules` — Firestore security rules
- `*subject*.html` — Subject-specific question data only

## Common folders
- `css/common.css` — one visual system for the entire portal
- `js/core.js` — Firebase/auth/session/access foundation
- `js/subject-engine.js` — common quiz engine
- `js/popup-manager.js` — common premium popup
- `js/subscription.js` — common access hook
- `js/ads-manager.js` — common ads hook
- `js/analytics.js` — common analytics hook

## Global access rule
Admin Portal -> Access & Pricing Rules -> `settings/access`

- `fixedPool`: free users can answer Q1 through the configured limit; attempting to move beyond the limit opens the Premium popup.
- `attemptLimit`: free users can start only the configured number of free attempts.
- `siteWideFree`: gives logged-in users full access.
- Paid access is group-specific in `access/{email}`.

Default rebuild values:
- Fixed question limit: 20
- Attempt limit: 5
- Site-wide free: OFF

Admin:
`rohit.fcg123@gmail.com`

Firebase project:
`cma-mcq-portal-cf33f`

## Important
Subject files contain their own question arrays and subject metadata. Common UI, access rules, popup behaviour and quiz mechanics are loaded from `css/` and `js/`.
