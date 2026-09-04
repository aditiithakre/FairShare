import json
from datetime import date

#Defining Functions

#Persistence functions
def load_expenses():
    try:
        with open("expenses.json", "r") as file:
            expenses = json.load(file)
    except FileNotFoundError:
        expenses = []
    return expenses

def save_expenses(expenses):
    with open("expenses.json", "w") as file:
        json.dump(expenses, file, indent=2)

def next_id(expenses):
    if not expenses:
        return 1
    return max(expense["id"] for expense in expenses) + 1


#Core functions
def add_expense(expenses):
    payer = input("Enter the name of the person who paid: ")

    while True:
        try:
            amount = int(input("Enter the amount in paise: "))
            break
        except ValueError:
            print("Please enter a whole number for the amount.")

    description = input("Enter a description for the expense: ")
    category = input("Enter a category for the expense: ")

    split_mode = input("Enter the split mode (equal/shares/percentage/exact): ")
    if split_mode == "equal":
        participants = input("Enter the names of participants separated by commas: ").split(",")
        participants = [p.strip() for p in participants]
        split = {"mode": "equal", "people": participants}
    elif split_mode == "shares":
        participants_input = input("Enter the names and shares of participants (name:share) separated by commas: ")
        participants = {}
        try:
            for item in participants_input.split(","):
                name, share = item.split(":")
                participants[name.strip()] = int(share.strip())
        except ValueError:
            print("Shares must be whole numbers. Expense not added.")
            return
        split = {"mode": "shares", "people": participants}
    elif split_mode == "percentage":
        participants_input = input("Enter the names and percentages of participants (name:percentage) separated by commas: ")
        participants = {}
        try:
            for item in participants_input.split(","):
                name, percentage = item.split(":")
                participants[name.strip()] = int(percentage.strip())
        except ValueError:
            print("Percentages must be whole numbers. Expense not added.")
            return
        split = {"mode": "percentage", "people": participants}
    elif split_mode == "exact":
        participants_input = input("Enter the names and exact amounts of participants (name:amount) separated by commas: ")
        participants = {}
        try:
            for item in participants_input.split(","):
                name, amount_exact = item.split(":")
                participants[name.strip()] = int(amount_exact.strip())
        except ValueError:
            print("Exact amounts must be whole numbers. Expense not added.")
            return
        split = {"mode": "exact", "people": participants}
    else:
        print("Invalid split mode.")
        return

    expense = {
        "id": next_id(expenses),
        "paid_by": payer,
        "amount_paise": amount,
        "description": description,
        "category": category,
        "date": date.today().isoformat(),
        "split": split,
    }
    expenses.append(expense)
    save_expenses(expenses)
    print("Expense added successfully.")

def calculate_balances(expenses):
    balances = {}
    for expense in expenses:
        payer = expense["paid_by"]
        total = expense["amount_paise"]
        participants = expense["split"]["people"]
        mode = expense["split"]["mode"]

        if mode == "equal":
            n = len(participants)
            share = total // n
            leftover = total % n
            shares = {participant: share for participant in participants}

        elif mode == "shares":
            total_units = sum(participants.values())
            unit_value = total //total_units
            shares = {participant: unit_value * units for participant, units in participants.items()}
            leftover = total - sum(shares.values())

        elif mode == "percentage":
            total_percentage = sum(participants.values())
            if total_percentage != 100:
                raise ValueError("Total percentage must be 100")
            shares = {participant: (total * percentage) // 100 for participant, percentage in participants.items()}
            leftover = total - sum(shares.values())

        elif mode == "exact":
            if sum(participants.values()) != total:
                raise ValueError("Exact amounts must sum to total")
            shares = dict(participants)
            leftover = 0  

        else:
            raise ValueError(f"Unknown split mode: {mode}")  

        # Update the payer's balance
        if payer not in balances:
            balances[payer] = 0
        if payer in participants:
            balances[payer] += total - shares[payer] - leftover
        else:
            balances[payer] += total - leftover

        #update the participants' balances
        for participant in participants:
            if participant not in balances:
                balances[participant] = 0
            if participant != payer:
                balances[participant] -= shares[participant]

    return balances

def settle_balances(expenses):

    balances = calculate_balances(expenses)
    transactions = []

    creditors = {person: balance for person, balance in balances.items() if balance > 0}
    debtors = {person: -balance for person, balance in balances.items() if balance < 0}

    creditors = dict(sorted(creditors.items(), key=lambda x: -x[1]))
    debtors = dict(sorted(debtors.items(), key=lambda x: -x[1]))

    for debtor in list(debtors.keys()):
        for creditor in list(creditors.keys()):
            if debtors[debtor] == 0:
                break
            paid = min(debtors[debtor], creditors[creditor])
            if paid == 0:
                continue
            transactions.append((debtor, creditor, paid))
            debtors[debtor] -= paid
            creditors[creditor] -= paid
    return transactions, creditors, debtors

def record_settlement_payment(expenses):
    payer = input("Enter the name of the person who is paying: ")
    payee = input("Enter the name of the person who is receiving the payment: ")

    while True:
        try:
            amount = int(input("Enter the amount in paise: "))
            break
        except ValueError:
            print("Please enter a whole number for the amount.")

    settlement_expense = {
        "id": next_id(expenses),
        "paid_by": payer,
        "amount_paise": amount,
        "description": f"Settlement payment from {payer} to {payee}",
        "category": "Settlement",
        "date": date.today().isoformat(),
        "split": {"mode": "exact", "people": {payee: amount}},
    }
    expenses.append(settlement_expense)
    save_expenses(expenses)
    print(f"Recorded settlement payment of {amount} paise from {payer}.")

def monthly_summary(expenses, month):
    total = 0
    by_category = {}
    for expense in expenses:
        if expense["date"][:7] != month:
            continue
        if expense["category"] == "Settlement":
            continue
        total += expense["amount_paise"]
        by_category[expense["category"]] = by_category.get(expense["category"], 0) + expense["amount_paise"]
    return total, by_category

#call functions to test
if __name__ == "__main__":
    expenses = load_expenses()

    while True:
        print("========= FairShare =========")
        print("1. Add expense")
        print("2. View balances")
        print("3. Settle up")
        print("4. Record a settlement payment")
        print("5. Monthly summary")
        print("6. Quit")
        choice = input("Enter your choice: ")
        if choice == "1":
            add_expense(expenses)
        elif choice == "2":
            balances = calculate_balances(expenses)
            print("Current balances:")
            for person, balance in balances.items():
                print(f"{person}: {balance} paise")
        elif choice == "3":
            transactions, creditors, debtors = settle_balances(expenses)
            print("Transactions to settle balances:")
            for debtor, creditor, amount in transactions:
                print(f"{debtor} pays {creditor} {amount} paise")
        elif choice == "4":
            record_settlement_payment(expenses)
        elif choice == "5":
            month = input("Enter the month to summarize (YYYY-MM): ")
            total, by_category = monthly_summary(expenses, month)
            print(f"Total spent in {month}: {total} paise")
            for category, amount in by_category.items():
                print(f"  {category}: {amount} paise")
        elif choice == "6":
            print("Exiting the program.")
            break
        else:
            print("Invalid choice. Please try again.")

