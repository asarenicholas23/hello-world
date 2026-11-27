# Firestore Data Model — EPA Permit Management System
# Konongo Area Office

---

## Top-level Collections

```
epa-kon-pms (Firestore)
│
├── counters/
├── staff/
└── facilities/
```

---

## `counters` collection

Legacy collection from the former file-number generator. New facility records now use manually entered file numbers.

| Doc ID | Fields |
|--------|--------|
| `CU`   | `last_count: number`, `sector_name: "Manufacturing"` |
| `CI`   | `last_count: number`, `sector_name: "Infrastructure"` |
| `CH`   | `last_count: number`, `sector_name: "Health"` |
| `CT`   | `last_count: number`, `sector_name: "Hospitality"` |
| `CE`   | `last_count: number`, `sector_name: "Energy"` |
| `PP`   | `last_count: number`, `sector_name: "Agrochemical & Pesticide"` |
| `CA`   | `last_count: number`, `sector_name: "Agriculture"` |
| `CM`   | `last_count: number`, `sector_name: "Mining"` |

File numbers are entered manually and are not derived from the sector.

---

## `staff` collection

**Document ID = Firebase Auth UID** (not staff_id). This enables efficient security rule lookups via `request.auth.uid`.

```
staff/{uid}
  uid           string   — Firebase Auth UID (same as doc ID)
  staff_id      string   — Human-readable ID, e.g. "STF001"
  name          string
  email         string   — Must match Firebase Auth email
  role          string   — "admin" | "finance" | "officer"
  designation   string   — Job title
  phone         string
```

**Role capabilities:**
- `admin` — full access; manages staff, permits, facilities
- `finance` — manages finance records; views everything
- `officer` — field work: screenings, monitoring, enforcement; views everything

---

## `facilities` collection

**Document ID = file_number**.

```
facilities/{file_number}
  file_number         string   — Same as doc ID
  name                string   — Name of Undertaking
  sector              string   — e.g. "Infrastructure"
  sector_prefix       string   — e.g. "CI"
  type_of_undertaking string
  sub_sector          string   — optional; 'gold_board' (Gold board applications, under Infrastructure) or 'none'. When empty, the app reads it from type_of_undertaking (src/utils/subSectors.js)
  fee_activities      string[] — optional; Act 1080 activities to price (FEE_RULES ids, e.g. ["hotel","restaurant"]). Set on the Finance tab; when absent they are read from type_of_undertaking
  location            string
  district            string   — e.g. "KON", "KMA", "EJI", "OBU"
  region              string   — Hardcoded "Ashanti"
  coordinates         { lat: number, lng: number } | null
  email               string
  entity_tin          string
  contact_person      string
  designation         string
  address             string
  phone               string
  created_at          timestamp
  created_by          string   — staff uid
  updated_at          timestamp
```

### Subcollections

#### `facilities/{file_number}/permits/{id}`
```
  permit_number   string    — Typed manually, e.g. "EPA/ASH/KON/EA1/CI266/25/00266"
  issue_date      timestamp
  effective_date  timestamp
  expiry_date     timestamp
  issue_location  string
  notes           string
  created_at      timestamp
  created_by      string    — staff uid
```

#### `facilities/{file_number}/permit_workflows/{permit_id}`
One workflow case per permit. The document ID is the related permit document ID.

```
  facility_id      string
  facility_name    string
  permit_id        string
  permit_number    string
  current_step     number    — 0..10
  status           string    — "not_started" | "in_progress" | "complete"
  steps            map       — keyed by workflow step number
  linked_records   map       — finance/screening/site_verifications/monitoring record IDs
  created_at       timestamp
  created_by       string
  updated_at       timestamp
  updated_by       string
```

#### `facilities/{file_number}/finance/{id}`
```
  amount          number
  currency        string    — "GHS" | "USD"
  date            timestamp
  payment_type    string
  reference_number string
  notes           string
  created_at      timestamp
  created_by      string
```

#### `facilities/{file_number}/screenings/{id}`
```
  date            timestamp
  officer_id      string    — staff uid
  officer_name    string
  coordinates     { lat: number, lng: number } | null
  photos          string[]  — Firebase Storage URLs
  notes           string
  created_at      timestamp
```

#### `facilities/{file_number}/site_verifications/{id}`
```
  date              timestamp
  officer_id        string
  officer_name      string
  coordinates       { lat: number, lng: number } | null
  linked_permit_id  string    — Permit doc ID being renewed
  photos            string[]
  notes             string
  created_at        timestamp
```

#### `facilities/{file_number}/monitoring/{id}`
```
  date        timestamp
  officer_id  string
  officer_name string
  checklist   object    — Sector-specific fields (see Phase 5)
  photos      string[]
  notes       string
  created_at  timestamp
```

#### `facilities/{file_number}/enforcement/{id}`
```
  date            timestamp
  coordinates     { lat: number, lng: number } | null
  location        string
  action_taken    string   — "warning"|"notice"|"fine"|"closure"|"other"
  contact_person  string
  photos          string[]
  notes           string
  follow_up_date  timestamp | null
  officer_id      string
  officer_name    string
  created_at      timestamp
```

---

## Sectors & File Number Prefixes

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

## Districts (placeholders — real codes to be provided)

| Code | District        |
|------|-----------------|
| KON  | Konongo         |
| KMA  | Kumasi Metro    |
| EJI  | Ejisu           |
| OBU  | Obuasi          |
