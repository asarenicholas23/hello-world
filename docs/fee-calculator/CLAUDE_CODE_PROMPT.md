# Prompt for Claude Code: bring in the Fee Calculator and deploy

Paste everything below the line into Claude Code, opened in `~/projects/epa-permit-app`.

---

I want to add the Act 1080 Fee Calculator to this app and deploy it. The code is on GitHub, on branch `feature/fee-calculator` of `asarenicholas23/hello-world`. Read `docs/fee-calculator/README.md` on that branch first.

Important background: my local copy is months ahead of GitHub. `origin/master` is older than my working copy. Do NOT merge or rebase `feature/fee-calculator` into my branch, and never force-push, reset or overwrite local work. The feature branch contains only new files plus a patch for three existing files.

Work through these steps, and stop and tell me if anything looks wrong:

1. **Protect local work.** Run `git status` and `git branch -vv`. If there are uncommitted changes, show me the list and commit them on the current branch (ask me for a message if the purpose isn't clear). Make sure `.env`, `scripts/serviceAccountKey.json` and any other credentials are not staged. Then push the current branch to `origin` with a normal push so GitHub catches up. If the push is rejected, stop and tell me; don't force it.

2. **Bring in the new files.** Run `git fetch origin`, then:
   ```
   git checkout origin/feature/fee-calculator -- \
     src/data/act1080Fees.json \
     src/utils/feeCalc.js \
     src/pages/FeeCalculatorPage.jsx \
     src/styles/feeCalculator.css \
     scripts/build-fee-table.mjs \
     docs/fee-calculator
   ```
   Check that none of these paths existed locally before; if one did, show me the diff before overwriting.

3. **Wire it in.** Run `git apply --check docs/fee-calculator/wiring.patch`, then `git apply docs/fee-calculator/wiring.patch`. If it doesn't apply cleanly because `App.jsx`, `Layout.jsx` or `CLAUDE.md` have changed, make the same edits by hand:
   - `src/App.jsx`: `import FeeCalculatorPage from './pages/FeeCalculatorPage'`, and `<Route path="fee-calculator" element={<FeeCalculatorPage />} />` inside the protected layout routes, above the `:module` route.
   - `src/components/Layout.jsx`: add `Calculator` to the lucide-react import and `{ label: 'Fee Calculator', icon: Calculator, path: '/fee-calculator' }` to every role's sidebar (after Finance for admin, IT and finance; after Field Reports for officers). It must be its own sidebar tab, not inside the facility pages.
   - `CLAUDE.md`: add the new files to the key files table and a short "Fee Calculator (Act 1080)" section (see the README).

4. **Check it.** Run `npm run lint` and `npm run build`; fix anything in the new files. Then `npm run dev` and test `/fee-calculator` logged in as each role (test accounts are in CLAUDE.md):
   - Search "clinic", sector Health, phase Construction, Permit (new), 8 beds, turn on the penalty (×3 on permit fee). Total must be **GH¢3,565** (345 + 805 + 2,415).
   - Search "hostel", phase Operation, 30 rooms. Total must be **GH¢1,500** (30 × 20 + 30 × 30).
   - Search "sachet", pick "Sachet Water Production (No. of Bags per Day)", Permit (new), category 4001-8000. There should be no capacity box and no multiplying: total **GH¢800** (300 + 500).
   - Search "church": it should find "Other construction proposals such as religious facilities" and show the note that the Act and L.I. 2504 don't define impact scale.
   - Check the page on a phone-sized window too.

5. **Commit and push.** One commit on my current branch, e.g. "Add Act 1080 fee calculator tab", then a normal push.

6. **Deploy.** Project `epa-kon-pms` (see `.firebaserc`). Run `npm run build` then `firebase deploy --only hosting`. Don't deploy Firestore rules or functions; nothing in this change needs them. Give me the hosting URL and confirm `/fee-calculator` loads there.

7. **Android (only if I say yes).** `npx cap sync android`, then tell me how to rebuild the APK in Android Studio.

8. **Report back** with what you committed, the deployed URL, and anything you had to change by hand.

Later, when I finish cross-checking the fees: I'll correct the fee Sheet ("EPA fees and charges – Act 1080"), export the "Permits and certificates" tab as CSV, and you'll run `node scripts/build-fee-table.mjs <file.csv>`, then build and deploy again.
