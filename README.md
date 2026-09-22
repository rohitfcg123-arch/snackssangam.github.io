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
- 5 free test attempts per user, tracked in Firestore `attempts`.
- Paid access is stored in `access/{email}` and is group-specific.
- Payments are stored in `payments`.
- Login records: `loginEvents`.
- Portal visits: `portalVisits`.
