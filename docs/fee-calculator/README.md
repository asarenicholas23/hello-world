# Fee Calculator (Act 1080)

A tab in the EPA Permit Management System that works out the fees an undertaking pays under the **Fees and Charges (Miscellaneous Provisions) Act, 2022 (Act 1080)**, Second Schedule, Environmental Protection Agency section.

Officers search for the facility type, set the phase, application type and capacity, and see the processing fee, permit fee and any penalty, with the working shown. It is an estimate for officers; the Ghana.gov invoice from the EPA client portal is the bill.

The page stands on its own. It is not linked to facility records or finance records.

---

## Files

| File | What it is |
|------|------------|
| `src/pages/FeeCalculatorPage.jsx` | The page. Route `/fee-calculator`, sidebar item "Fee Calculator". |
| `src/utils/feeCalc.js` | Pure fee logic (no React): search, band matching, per-unit fees, US$ conversion, penalty, CSV parsing. |
| `src/data/act1080Fees.json` | The fee table. Loaded on demand, so it is a separate ~27 KB (gzipped) chunk, not part of the main bundle. |
| `src/styles/feeCalculator.css` | Page styles, scoped under `.fee-calc`, following the Studio skin. |
| `scripts/build-fee-table.mjs` | Rebuilds the fee table from the fee Sheet's CSV export. |
| `docs/fee-calculator/wiring.patch` | Adds the route, the sidebar item and the CLAUDE.md notes. Written against the local working copy (see "Merging" below). |
| `docs/fee-calculator/EPA_fees_Act_1080.xlsx` | Snapshot of the extracted fee table, for reference while cross-checking. |

---

## Where the numbers come from

- **Source:** the scanned Act 1080 (182 pages). The EPA section is Act pages 294–445. **Page 294 is missing from the scan**, so the permitting processing fee is blank for the first nine mining lines.
- **Cross-check:** "ApprovedFees & Charges 2023", the Konongo office's own extract of the EPA section.
- **Method:** every amount was read twice by OCR and compared with the office extract. 172 uncertain lines and a random sample of 25 were checked by eye against the page images.

The EPA section is four parallel fee blocks plus extra charges:

| Act pages | Block | JSON |
|-----------|-------|------|
| 295–325 | Permitting: processing fee | `main[i][10]` |
| 326–355 | Permitting: permit fee | `main[i][11]` |
| 356–385 | Certification: processing fee | `main[i][12]` |
| 386–416 | Certification: permit fee | `main[i][13]` |
| 416–429 | Chemicals, pesticides, other fee categories, hazardous and e-waste | `other` |
| 429–445 | Fees on electrical and electronic items (product labels) | `labels` |

### Status of each line (column "Check against office document")

| Status | Count | Meaning |
|--------|-------|---------|
| Matches office document | 503 | Act and office extract agree. |
| Differs from office document | 36 | They disagree; the table holds the **Act's** figure and the Notes column holds both. |
| Not in office document | 88 | Act only (mostly transportation, wildlife and forestry, urban tree felling). |
| Check | 22 | The office extract has a figure not found in the Act scan. |

"Reading confidence: Medium" (178 lines) means the amount rests on OCR alone. The page shows a "Machine-read, verify" badge on those lines.

---

## Calculation rules (confirmed by the Konongo office)

1. **Processing fee and permit fee are calculated separately.** Permit (new undertaking) uses the permitting columns; Certificate (existing undertaking) uses the certification columns.
2. **Per-unit lines:** the capacity picks the band, and the fee is the band's rate × the number of units (e.g. hostel, 30 rooms, operation: 30 × 20 + 30 × 30).
   Lines that are only *categorised* by capacity, with one flat fee per category, are not multiplied: sachet water (bags or boxes a day) and aquaculture (tonnes a year). For those the page shows the categories to pick from and no capacity box.
3. **Non-compliance penalty** (late permit renewal, or operating without a permit): **3 × the permit fee** by default. The officer can change the multiplier or apply it to processing + permit. Checked against invoice 260729142239499 (Choice Clinic): 345 + 805 + 3 × 805 = 3,565.
4. **No service charge.**
5. **US$ amounts** ("cedi equivalent of US$ …") are converted at the rate the officer types.
6. The Act's flat **US$ 500,000 "Operating without a permit"** administrative charge (page 424) is a separate charge, listed under Other charges. It is not the ×3 penalty.

### Lines still to confirm

- **201 lines marked "Flat – confirm":** they have a capacity band but the Act does not say "per", e.g. power plants by MW, hospitals by beds. The calculator treats them as flat.
- **Band edges:** some bands share an edge (e.g. 5–35 MW and 35–75 MW). The page asks the officer which band applies.
- **Hostels** are per room by office practice; the Act does not say "per room".

---

## Impact scale (large, medium, small, minor, micro)

Many lines, e.g. "Other construction proposals such as religious facilities", most manufacturing, wildlife and forestry, and irrigation, are priced by impact scale with no test for what makes a proposal large or small.

- **Act 1080** does not define the scales. Its only definitions (section 7) are "enactment", "fees and charges", "Minister" and "Ministry".
- **Environmental Assessment Regulations, 2025 (L.I. 2504)** do not define them either. The First Schedule lists undertakings that need a permit (places of worship are item 50) and leaves the level of assessment to screening.
- Where the Act gives a measure in the line itself, the calculator uses it: hospitals (beds), hotels (rooms), poultry (birds), aquaculture (tonnes a year), sachet water (boxes a day), power plants (MW).

So for impact-scale lines the page tells officers to use the scale assigned at screening. If the EPA client portal's "approved activity rules" define the scales, they could be added here later.

---

## Updating the fee table after the cross-check

Do not hand-edit `src/data/act1080Fees.json`.

1. Correct lines in the fee Sheet ("EPA fees and charges – Act 1080"), tab **Permits and certificates**. Keep the column headers as they are.
2. Download that tab as CSV.
3. Run `node scripts/build-fee-table.mjs path/to/file.csv`. It refuses the file if a fee cell cannot be read, and prints a summary.
4. `npm run build`, check the page, commit, deploy.

Only the permits-and-certificates lines are replaced; other charges and product labels stay as they are.

---

## Merging

On 16 Nov 2026 GitHub (`asarenicholas23/hello-world`) was about four months behind the working copy on the office laptop (`~/projects/epa-permit-app`). This branch was therefore built on `origin/master` with **new files only**, so it cannot overwrite newer local work. The edits to existing files are in `wiring.patch`, written against the local `src/App.jsx`, `src/components/Layout.jsx` and `CLAUDE.md`:

- `App.jsx`: import `FeeCalculatorPage` and add `<Route path="fee-calculator" …/>` just above the `:module` catch-all. A static path ranks above `:module` in react-router v7, so there is no clash.
- `Layout.jsx`: import the `Calculator` icon and add "Fee Calculator" to `ADMIN_NAV` and `IT_NAV` (after Finance), `FIELD_NAV` (after Field Reports) and the finance role (after Finance). `DATA_ACCESS_NAV` is derived from `ADMIN_NAV`, so it picks it up.
- `CLAUDE.md`: key-files rows and a "Fee Calculator" section.

`npx eslint` passes on the new files, and the page builds and runs with the local `index.css`.
