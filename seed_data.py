from main import save_expenses

seed_expenses = [
    {
        "id": 1,
        "paid_by": "A",
        "amount_paise": 8000,
        "description": "Groceries",
        "category": "Food",
        "date": "2026-08-01",
        "split": {"mode": "equal", "people": ["A", "C", "D", "B"]}
    },
    {
        "id": 2,
        "paid_by": "B",
        "amount_paise": 8000,
        "description": "Internet",
        "category": "Utilities",
        "date": "2026-08-02",
        "split": {"mode": "equal", "people": ["A", "B", "C", "D"]}
    },
    {
        "id": 3,
        "paid_by": "A",
        "amount_paise": 4000,
        "description": "Snacks",
        "category": "Food",
        "date": "2026-08-03",
        "split": {"mode": "equal", "people": ["C", "D"]}
    },
    {
        "id": 4,
        "paid_by": "B",
        "amount_paise": 2000,
        "description": "Cleaning supplies",
        "category": "Utilities",
        "date": "2026-08-04",
        "split": {"mode": "equal", "people": ["C", "D"]}
    },
    {
        "id": 5,
        "paid_by": "Aditi",
        "amount_paise": 900000,
        "description": "September rent",
        "category": "Rent",
        "date": "2026-09-01",
        "split": {"mode": "shares", "people": {"Aditi": 2, "Arya": 1, "Shravya": 1}}
    },
    {
        "id": 6,
        "paid_by": "Arya",
        "amount_paise": 10000,
        "description": "Pizza",
        "category": "Food",
        "date": "2026-09-02",
        "split": {"mode": "shares", "people": {"Arya": 2, "Reem": 1}}
    },
    {
        "id": 7,
        "paid_by": "Shravya",
        "amount_paise": 9999,
        "description": "Groceries",
        "category": "Food",
        "date": "2026-09-03",
        "split": {"mode": "percentage", "people": {"Shravya": 33, "Reem": 33, "Aditi": 34}}
    },
    {
        "id": 8,
        "paid_by": "Reem",
        "amount_paise": 9999,
        "description": "Movie tickets",
        "category": "Trips",
        "date": "2026-09-04",
        "split": {"mode": "exact", "people": {"Aditi": 7000, "Reem": 2999}}
    }
]

save_expenses(seed_expenses)
print("Seeded", len(seed_expenses), "expenses")
