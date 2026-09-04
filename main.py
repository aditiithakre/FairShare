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

def filter_by_group(expenses, group):
    return [expense for expense in expenses if expense["group"] == group]

def format_paise(amount):
    sign = "-" if amount < 0 else ""
    rupees, paise = divmod(abs(amount), 100)

    #Indian grouping: last three digits, then twos (9,00,000 not 900,000)
    digits = str(rupees)
    if len(digits) > 3:
        groups = [digits[-3:]]
        rest = digits[:-3]
        while len(rest) > 2:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        groups.insert(0, rest)
        digits = ",".join(groups)

    return f"{sign}₹{digits}.{paise:02d}"

def parse_rupees(text):
    #string arithmetic only - a float here would reintroduce the rounding we store paise to avoid
    text = text.strip().lstrip("₹").strip().replace(",", "")

    parts = text.split(".")
    if len(parts) > 2:
        raise ValueError("Amount must be a number, e.g. 2216.67")

    rupees = parts[0]
    paise = parts[1] if len(parts) == 2 else ""

    if not rupees and not paise:
        raise ValueError("Amount must be a number, e.g. 2216.67")
    if rupees and not rupees.isdecimal():
        raise ValueError("Amount must be a number, e.g. 2216.67")
    if paise and not paise.isdecimal():
        raise ValueError("Amount must be a number, e.g. 2216.67")
    if len(paise) > 2:
        raise ValueError("Amount can have at most two decimal places.")

    return int(rupees or 0) * 100 + int(paise.ljust(2, "0") or 0)


#Core functions
def add_expense(expenses, group):
    payer = input("Enter the name of the person who paid: ")

    while True:
        try:
            amount = parse_rupees(input("Enter the amount in rupees (e.g. 2216.67): "))
            break
        except ValueError as error:
            print(error)

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
        participants_input = input("Enter the names and exact amounts in rupees (name:amount) separated by commas: ")
        participants = {}
        try:
            for item in participants_input.split(","):
                name, amount_exact = item.split(":")
                participants[name.strip()] = parse_rupees(amount_exact)
        except ValueError:
            print("Exact amounts must be numbers in rupees, e.g. Aditi:70.00. Expense not added.")
            return
        split = {"mode": "exact", "people": participants}
    else:
        print("Invalid split mode.")
        return

    expense = {
        "id": next_id(expenses),
        "group": group,
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

def record_settlement_payment(expenses, group):
    payer = input("Enter the name of the person who is paying: ")
    payee = input("Enter the name of the person who is receiving the payment: ")

    while True:
        try:
            amount = parse_rupees(input("Enter the amount in rupees (e.g. 2216.67): "))
            break
        except ValueError as error:
            print(error)

    settlement_expense = {
        "id": next_id(expenses),
        "group": group,
        "paid_by": payer,
        "amount_paise": amount,
        "description": f"Settlement payment from {payer} to {payee}",
        "category": "Settlement",
        "date": date.today().isoformat(),
        "split": {"mode": "exact", "people": {payee: amount}},
    }
    expenses.append(settlement_expense)
    save_expenses(expenses)
    print(f"Recorded settlement payment of {format_paise(amount)} from {payer}.")

def delete_expense(expenses, group):
    group_expenses = filter_by_group(expenses, group)
    if not group_expenses:
        print("There are no expenses in this group to delete.")
        return

    print("Expenses in this group:")
    for expense in group_expenses:
        print(f"  {expense['id']}: {expense['date']} {expense['description']} - {format_paise(expense['amount_paise'])} paid by {expense['paid_by']}")

    choice = input("Enter the id to delete (blank to cancel): ").strip()
    if not choice:
        print("Nothing deleted.")
        return
    if not choice.isdecimal():
        print("Id must be a number. Nothing deleted.")
        return

    #searching the group's expenses, not all of them, so one group can't delete another's
    for expense in group_expenses:
        if expense["id"] == int(choice):
            break
    else:
        print(f"No expense with id {choice} in this group. Nothing deleted.")
        return

    confirm = input(f"Delete '{expense['description']}' ({format_paise(expense['amount_paise'])})? (y/n): ").strip().lower()
    if confirm != "y":
        print("Nothing deleted.")
        return

    expenses.remove(expense)
    save_expenses(expenses)
    print("Expense deleted.")

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

    existing_groups = sorted({expense["group"] for expense in expenses})
    if existing_groups:
        print("Existing groups:", ", ".join(existing_groups))

    while True:
        group = input("Enter the group to use: ").strip()
        if not group:
            print("Group name cannot be empty.")
            continue
        if group in existing_groups:
            break
        confirm = input(f"'{group}' doesn't exist yet. Create it? (y/n): ").strip().lower()
        if confirm == "y":
            break

    while True:
        group_expenses = filter_by_group(expenses, group)

        print(f"========= FairShare ({group}) =========")
        print("1. Add expense")
        print("2. View balances")
        print("3. Settle up")
        print("4. Record a settlement payment")
        print("5. Monthly summary")
        print("6. Delete an expense")
        print("7. Quit")
        choice = input("Enter your choice: ")
        if choice == "1":
            add_expense(expenses, group)
        elif choice == "2":
            balances = calculate_balances(group_expenses)
            print("Current balances:")
            for person, balance in balances.items():
                print(f"{person}: {format_paise(balance)}")
        elif choice == "3":
            transactions, creditors, debtors = settle_balances(group_expenses)
            print("Transactions to settle balances:")
            for debtor, creditor, amount in transactions:
                print(f"{debtor} pays {creditor} {format_paise(amount)}")
        elif choice == "4":
            record_settlement_payment(expenses, group)
        elif choice == "5":
            month = input("Enter the month to summarize (YYYY-MM): ")
            total, by_category = monthly_summary(group_expenses, month)
            print(f"Total spent in {month}: {format_paise(total)}")
            for category, amount in by_category.items():
                print(f"  {category}: {format_paise(amount)}")
        elif choice == "6":
            delete_expense(expenses, group)
        elif choice == "7":
            print("Exiting the program.")
            break
        else:
            print("Invalid choice. Please try again.")

