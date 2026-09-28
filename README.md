# FairShare

Split shared expenses with a group, see who owes whom, and settle up in the fewest payments.

The project is in two halves that share one set of rules:

```
cli/    the original Python command-line version — where the splitting
        engine was worked out, still runnable, still the reference
web/    the site — React, real accounts, Firebase, deployed to Pages
```

Both compute balances the same way, down to the paisa; `web/src/lib/engine.js` is a direct port of `calculate_balances` and `settle_balances` in [cli/main.py](cli/main.py), and its results are checked against the CLI's.

## The site

```
cd web
npm install
npm run dev
```

First run shows a setup screen, because the app needs a database:

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com) — the free Spark plan is enough.
2. Under **Authentication → Sign-in method**, enable **Email/Password**.
3. In the sidebar, open **Databases & Storage → Firestore Database** and create a database — production mode is right, since you replace its rules in the next step. Then open its **Rules** tab, paste in [`web/firebase/firestore.rules`](web/firebase/firestore.rules), and publish.
4. Under **Project settings → Your apps**, register a web app and copy its config into `web/.env` (see [`web/.env.example`](web/.env.example)).

The config values are public by design in a browser build — the security rules are what keep one account's data away from another's. Every collection is closed by default; the last rule in the file denies everything not explicitly allowed.

**Accounts.** Email and password, through Firebase Auth. Sign up and your groups follow you to any device you sign in on.

**Sharing a group.** Each group gets a six-character code, shown in its header. Anyone else with an account joins by entering it. The code lives in its own tiny `joinCodes` document holding nothing but a group id, because someone who is not yet a member cannot read the group itself — and the rule for joining permits exactly one change: adding your own uid to the member list, never anyone else's. Members of a group need not have accounts at all: they're names, so you can split with people who never sign up.

**Deploying.** Pushing to `main` builds and publishes through [.github/workflows/deploy.yml](.github/workflows/deploy.yml). Add the six `VITE_FIREBASE_*` values under Settings → Secrets and variables → Actions, then turn on Pages with "GitHub Actions" as the source.

## The command-line version

A single-file expense splitter with no dependencies beyond the Python standard library, backed by one JSON file.

### Requirements

- Python 3

### Running it

```
cd cli
python3 main.py
```

To load some example data first:

```
cd cli
python3 seed_data.py
python3 main.py
```

`seed_data.py` overwrites `cli/expenses.json` with 8 sample expenses across two months and two groups, using every split mode. Run it any time you want a clean slate.

### Groups

Expenses belong to a group — a household, a trip, any set of people who share a ledger. On startup the app lists the groups it already knows about and asks which one you want:

```
Existing groups: Flat 302, Study Group
Enter the group to use: Flat 302
```

Everything after that — balances, settling up, monthly summaries, new expenses — is scoped to that group. Group names are case-sensitive and stored exactly as typed, so `Flat 302` and `flat 302` are two different groups. Surrounding whitespace is trimmed, since it's invisible and never deliberate; an empty name is rejected.

There's nothing to create up front: typing an unrecognized name offers to start a new group, and confirming is all it takes.

```
Enter the group to use: Trip to Goa
'Trip to Goa' doesn't exist yet. Create it? (y/n): y
```

To work in a different group, quit and restart.

### Menu

```
1. Add expense
2. View balances
3. Settle up
4. Record a settlement payment
5. Monthly summary
6. Delete an expense
7. Quit
```

- **Add expense** — record who paid, how much (in rupees, e.g. `2216.67`), a description, a category, and how it's split (see below). The date is stamped automatically.
- **View balances** — running total per person. Positive means they're owed money; negative means they owe.
- **Settle up** — works out a short list of payments that zeroes everyone out (see the note on greedy settlement below).
- **Record a settlement payment** — logs an actual payment between two people (e.g. after they pay each other outside the app) so balances reflect it. Filed under the `Settlement` category, which `Monthly summary` excludes — it's debt repayment, not spending.
- **Monthly summary** — enter a month as `YYYY-MM`; prints total spent and a per-category breakdown for that month, excluding settlements.
- **Delete an expense** — lists the group's expenses with their ids, then removes the one you pick after a confirmation. Only ids in the current group are accepted, so you can't delete another group's expense by guessing a number.

### Split modes

When adding an expense, choose how the amount is divided:

- `equal` — split evenly across a list of names.
- `shares` — split proportionally by weight, e.g. `Aditi:2,Arya:1` gives Aditi twice Arya's share.
- `percentage` — split by percentage per person; must sum to 100.
- `exact` — specify the exact amount each person owes, in rupees, e.g. `Aditi:70,Reem:30`; must sum to the total.

### Data

Expenses live in `cli/expenses.json`, a flat list of records:

```json
{
  "id": 5,
  "group": "Flat 302",
  "paid_by": "Aditi",
  "amount_paise": 900000,
  "description": "September rent",
  "category": "Rent",
  "date": "2026-09-01",
  "split": {
    "mode": "shares",
    "people": { "Aditi": 2, "Arya": 1, "Shravya": 1 }
  }
}
```

Amounts are stored in paise (1 rupee = 100 paise) to avoid floating-point rounding issues. Rupees are the unit at both edges: `parse_rupees` turns `2216.67` into `221667` on the way in, and `format_paise` turns it back into `₹2,216.67` on the way out. Paise never appear in the interface.

## Design decisions

- **Events, not balances.** Expenses are stored as facts; balances are recomputed from the full list every time they're needed. Nothing is ever stored pre-aggregated, so editing or removing an expense can't leave stale derived state behind.
- **Integer paise.** Money is stored as whole paise, never floats. `0.1 + 0.2 == 0.30000000000000004` — a balance that never quite reaches zero is a real bug in a money app, not a rounding curiosity.
- **Rounding remainders go to the payer.** ₹100 split three ways leaves a stray paisa (`10000 // 3 = 3333`, remainder `1`). That paisa is charged to the payer rather than distributed unevenly among participants — one consistent rule, so balances always sum to exactly zero.
- **Settlements are expenses.** A payment from Arya to Aditi is just an expense where the entire amount is an exact split to one person. It reuses the same record shape and the same balance engine — no new record type, no special-casing in `calculate_balances`.
- **Greedy settlement.** `settle_balances` repeatedly matches the largest debtor against the largest creditor for the smaller of the two amounts. This is near-optimal in practice; finding the true minimum number of transactions is NP-hard, and greedy is a reasonable trade for a CLI tool.
- **Groups are a filter, not a feature.** Group support is one helper — `filter_by_group` — applied to the list *before* it reaches the engine. `calculate_balances`, `settle_balances`, and `monthly_summary` were not modified and don't know groups exist; they still just take a list of expenses. Shaping the data to fit the working engine beats teaching the engine a new case.
- **Group names are case-sensitive.** A group name is stored exactly as typed — `Flat 302` stays `Flat 302` in the ledger, the group list, and the menu header, and is a distinct group from `flat 302`. Only surrounding whitespace is stripped. Lowercasing everything would have made those two collide, but at the cost of mangling names on display for a collision the confirmation prompt already catches.
- **The port is checked, not assumed.** `web/src/lib/engine.js` is a line-for-line port of the Python engine, and it is verified against the CLI's own output: the same four seed expenses produce the same four balances to the paisa, the same three settlement payments in the same order, and the same monthly total. A rewrite in another language is a place for drift to hide, so the numbers are compared rather than trusted. On the browser side the suggested-payment buttons pass integer paise instead of dividing by 100 in JavaScript, keeping floats out of the money path there too.
- **Rupee input parsed as strings, never floats.** `parse_rupees` splits on the decimal point and does integer arithmetic on the two halves — `"2216.67"` → `2216 * 100 + 67`. Routing input through `float()` would undo the whole point of storing integer paise, since `float("0.07") * 100` is `7.000000000000001`. A missing fraction pads (`"2216.5"` → `.50`), and more than two decimal places is rejected rather than rounded: silently discarding a fraction of a paise is how a ledger stops adding up.
- **Indian digit grouping, written by hand.** `format_paise` groups the last three digits and then in twos — `₹9,00,000`, not `₹900,000`. Python's `f"{n:,}"` only does Western grouping, and the `locale` module's Indian formatting is process-global and depends on `en_IN` being installed on the machine. Five lines of string slicing avoids both problems.
- **New groups are confirmed, not implicit.** An unrecognized name prompts before creating the group. Silent creation is indistinguishable from a typo — you'd get an empty ledger and reasonably conclude your data was gone. One y/n turns a silent failure into an obvious one.

## Known limitations

- **No edit.** Expenses can be deleted but not amended — correcting a typo means deleting the record and re-adding it.
- **Ids are reused after deletion.** `next_id` takes `max(id) + 1`, so deleting the newest expense frees its id for the next one. Nothing references ids across records, so this is cosmetic today; it would matter the moment anything pointed at an expense by id.
- **Sequential IDs.** `next_id` takes `max(id) + 1` from the local file, so two people adding expenses on different devices and merging later would generate colliding IDs. Fine for a single local file, not fine for sync.
- **`shares` and `percentage` take whole numbers only.** Weights and percentages are still parsed with `int()`, so `Aditi:2.5` or a `33.33%` split is rejected. Only money goes through `parse_rupees`.
- **No switching groups mid-session.** The group is chosen once at startup; changing it means quitting and rerunning. A deliberate trade — a switch option is easy to add, but restarting costs a second.
- **Group names are free text.** There's no rename, merge, or delete — a group confirmed into existence by typo (including a wrong-case one like `flat 302` sitting next to `Flat 302`) can only be cleaned up by hand-editing `cli/expenses.json`. The confirmation prompt catches it at entry; it can't undo one you've already accepted.
