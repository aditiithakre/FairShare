# FairShare

A command-line expense splitter. Track shared expenses among a group, see who owes whom, record settlement payments, and pull a monthly spending summary — all backed by a single JSON file, no dependencies beyond the Python standard library.

## Requirements

- Python 3

## Running it

```
python3 main.py
```

To load some example data first:

```
python3 seed_data.py
python3 main.py
```

`seed_data.py` overwrites `expenses.json` with 8 sample expenses across two months, using every split mode. Run it any time you want a clean slate.

## Menu

```
1. Add expense
2. View balances
3. Settle up
4. Record a settlement payment
5. Monthly summary
6. Quit
```

- **Add expense** — record who paid, how much (in paise), a description, a category, and how it's split (see below). The date is stamped automatically.
- **View balances** — running total per person. Positive means they're owed money; negative means they owe.
- **Settle up** — computes the minimal set of payments needed to zero everyone out.
- **Record a settlement payment** — logs an actual payment between two people (e.g. after they pay each other outside the app) so balances reflect it. Filed under the `Settlement` category, which `Monthly summary` excludes — it's debt repayment, not spending.
- **Monthly summary** — enter a month as `YYYY-MM`; prints total spent and a per-category breakdown for that month, excluding settlements.

## Split modes

When adding an expense, choose how the amount is divided:

- `equal` — split evenly across a list of names.
- `shares` — split proportionally by weight, e.g. `Aditi:2,Arya:1` gives Aditi twice Arya's share.
- `percentage` — split by percentage per person; must sum to 100.
- `exact` — specify the exact amount each person owes; must sum to the total.

## Data

Expenses live in `expenses.json`, a flat list of records:

```json
{
  "id": 1,
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

Amounts are stored in paise (1 rupee = 100 paise) to avoid floating-point rounding issues.

## Design decisions

- **Events, not balances.** Expenses are stored as facts; balances are recomputed from the full list every time they're needed. Nothing is ever stored pre-aggregated, so editing or removing an expense can't leave stale derived state behind.
- **Integer paise.** Money is stored as whole paise, never floats. `0.1 + 0.2 == 0.30000000000000004` — a balance that never quite reaches zero is a real bug in a money app, not a rounding curiosity.
- **Rounding remainders go to the payer.** ₹100 split three ways leaves a stray paisa (`10000 // 3 = 3333`, remainder `1`). That paisa is charged to the payer rather than distributed unevenly among participants — one consistent rule, so balances always sum to exactly zero.
- **Settlements are expenses.** A payment from Arya to Aditi is just an expense where the entire amount is an exact split to one person. It reuses the same record shape and the same balance engine — no new record type, no special-casing in `calculate_balances`.
- **Greedy settlement.** `settle_balances` repeatedly matches the largest debtor against the largest creditor for the smaller of the two amounts. This is near-optimal in practice; finding the true minimum number of transactions is NP-hard, and greedy is a reasonable trade for a CLI tool.

## Known limitations

- **No group concept.** All people share one ledger — there's no way to run separate expense pools for, say, roommates vs. a trip with different friends.
- **No edit or delete.** Once an expense is saved there's no menu path to correct or remove it; fixing a mistake means hand-editing `expenses.json`.
- **Sequential IDs.** `next_id` takes `max(id) + 1` from the local file, so two people adding expenses on different devices and merging later would generate colliding IDs. Fine for a single local file, not fine for sync.
- **No currency formatting.** Everything prints as raw paise (e.g. `221667 paise`) rather than a formatted amount like ₹2,216.67.
