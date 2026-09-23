# CMA MCQ Portal — Updated Access Control

This package preserves the existing subject engines and adds centralized Admin-controlled access rules.

## Firebase
Deploy `firestore.rules` to the `cma-mcq-portal-cf33f` Firebase project.

## Admin
Open `admin.html` and sign in with the authorised admin account. Global settings are stored in `settings/access`; per-user access is stored in `access/{email}`; setting changes are recorded in `settingsHistory`.

## Subjects
All 22 subject HTML files were updated in-place. Existing MCQ/PYQ/timer/bookmark/retry/chapter functionality is retained; the access gate now reads the central settings and per-user overrides.

## Note
Client-side rules protect normal portal behavior but are not a substitute for server-side entitlement validation if the question bank itself must be strongly protected from extraction.
