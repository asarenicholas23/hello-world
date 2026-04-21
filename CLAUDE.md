# EPA Permit Management System — CLAUDE.md
# Konongo Area Office, Ghana EPA

This file gives future Claude sessions full context on this project.

---

## What this is

A mobile + desktop app for Ghana EPA's Konongo Area Office. Field officers use it on iOS/Android phones; admin and finance staff use it on desktop.

- **Web app**: React + Vite (this repo) — wraps with Capacitor for iOS/Android
- **Same codebase** runs on web (desktop) and mobile
- **Firebase backend**: Firestore (database), Auth (email+password), Storage (photos)

---

## Tech Stack

| Layer       | Tech                                              |
|-------------|---------------------------------------------------|
| Frontend    | React 19 + Vite                                  |
| Styling     | Custom CSS (`src/index.css`) — mobile-first       |
| Routing     | react-router-dom v7                               |
| Backend     | Firebase (Firestore + Auth + Storage)             |
| Mobile      | Capacitor (Phase 4) wrapping the Vite build       |
| Icons       | lucide-react                                      |

---

## Firebase Project

- **Project ID**: `epa-kon-pms`
- **Auth**: Email + password
- **Region**: europe-west1 (Belgium) — closest to West Africa

---

## Core Concept: File Numbers

Every facility has a **FILE NUMBER** — the Firestore document ID and the permanent unique key.

**Format**: `{SECTOR_PREFIX}{counter}` — no zero-padding.  
Examples: `CI1`, `CI42`, `CI266`, `CU1547`

Generated via **Firestore transaction** (Phase 2) that atomically increments the sector counter.

**PERMIT NUMBER** is different — it's a manually-typed string like `EPA/ASH/KON/EA1/CI266/25/00266`. The app stores it as a string, never parses it.

---

## Sectors & Prefixes

| Sector                    | Prefix |
|---------------------------|--------|
| Manufacturing             | CU     |
| Infrastructure            | CI     |
| Health                    | CH     |
| Hospitality               | CT     |
| Energy                    | CE     |
| Agrochemical & Pesticide  | PP     |
| Agriculture               | CA     |
| Mining                    | CM     |

---

## User Roles

| Role    | Can do                                                                 |
|---------|------------------------------------------------------------------------|
| admin   | Everything: facilities, permits, finance, staff management             |
| finance | Finance records + view all                                             |
| officer | Field work: screenings, monitoring, enforcement, site verifications + view all |

Staff docs live in the `staff` Firestore collection, **keyed by Firebase Auth UID**.  
After login, the app fetches `staff/{uid}` to get the role.

---

## Firestore Data Model (summary)

See `DATA_MODEL.md` for full field lists.

```
counters/{CU,CI,CH,CT,CE,PP,CA,CM}   ← sector counters for file number generation
staff/{uid}                           ← staff profiles (uid = Firebase Auth UID)
facilities/{file_number}              ← facility profiles
  /permits/{id}
  /finance/{id}                       ← payment_status: 'paid'|'unpaid'
  /screenings/{id}
  /site_verifications/{id}
  /monitoring/{id}
  /enforcement/{id}
complaints/{id}                       ← top-level, not facility-scoped
environmental_education/{id}          ← top-level, not facility-scoped
field_reports/{id}                    ← for unregistered facilities
```

---

## Hardcoded Values

- **Region**: always "Ashanti"
- **Districts** (placeholders — real codes TBD): KON (Konongo), KMA (Kumasi Metro), EJI (Ejisu), OBU (Obuasi)

---

## Test Accounts (seeded via `scripts/seed.cjs`)

| Role    | Email                   | Password      | Staff ID |
|---------|-------------------------|---------------|----------|
| admin   | admin@epa-ashanti.gh    | Admin@1234    | STF001   |
| finance | finance@epa-ashanti.gh  | Finance@1234  | STF002   |
| officer | officer@epa-ashanti.gh  | Officer@1234  | STF003   |

---

## Phase Plan

| Phase | Description                          | Status     |
|-------|--------------------------------------|------------|
| 1     | Foundation & Auth                    | ✅ Complete |
| 2     | Facility (Entity) Profiles           | ✅ Complete |
| 3     | Offline Support                      | ✅ Complete |
| 4     | Camera + GPS via Capacitor           | ✅ Complete |
| 5     | Sub-records (Permits, Finance, etc.) | ✅ Complete |
| 6     | Filters, Search, Dashboard           | ✅ Complete |
| 7     | Data Migration from Google Drive     | ✅ Complete |
| 8     | Desktop Polish                       | ✅ Complete |
| 9     | Staff Testing & Bug Fixes            | 🔜 Next     |

---

## Key Source Files

| File                          | Purpose                                  |
|-------------------------------|------------------------------------------|
| `src/firebase/config.js`      | Firebase init (reads from `.env`)        |
| `src/context/AuthContext.jsx` | Auth state + staff doc + role            |
| `src/components/Layout.jsx`   | App shell: sidebar + topbar + outlet     |
| `src/pages/Login.jsx`         | Email/password login screen              |
| `src/pages/Home.jsx`          | Role-specific home/dashboard             |
| `src/App.jsx`                 | Route definitions                        |
| `scripts/seed.cjs`            | Seeds test staff + counters (Admin SDK)  |
| `firestore.rules`             | Firestore security rules                 |
| `DATA_MODEL.md`               | Full Firestore schema reference          |

---

## Seeding (one-time setup)

```bash
# 1. Download service account key from Firebase Console:
#    Project Settings → Service Accounts → Generate New Private Key
#    Save as scripts/serviceAccountKey.json

# 2. Run the seed
node scripts/seed.cjs
```

---

## Important Conventions

- Staff doc ID = Firebase Auth UID (not staff_id field). Enables O(1) security rule lookups.
- File number generation uses a **Firestore transaction** — requires online. Offline facility creation queues a draft (Phase 3).
- Monitoring checklists are **sector-specific** — different fields per sector prefix.
- Permit numbers are typed manually — never auto-generated or parsed by the app.
- `.env` is gitignored — never commit Firebase credentials.
- `scripts/serviceAccountKey.json` is gitignored — never commit.
