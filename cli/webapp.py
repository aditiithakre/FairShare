"""Web front end for FairShare.

Runs on Python's standard library alone - no Flask, no pip install. Every
calculation is done by the functions in main.py; this file only moves data
between HTTP and that engine, exactly as the menu loop moves data between
input()/print() and the same engine.

    python3 webapp.py    then open http://localhost:8000
"""

import json
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

import main as fairshare

PORT = 8000


def group_names(expenses):
    return sorted({expense["group"] for expense in expenses})


def money(amount):
    return {"paise": amount, "text": fairshare.format_paise(amount)}


def build_state(group):
    expenses = fairshare.load_expenses()
    groups = group_names(expenses)

    if group not in groups and groups:
        group = groups[0]

    group_expenses = fairshare.filter_by_group(expenses, group)
    balances = fairshare.calculate_balances(group_expenses)
    transactions, _, _ = fairshare.settle_balances(group_expenses)

    months = sorted({expense["date"][:7] for expense in group_expenses}, reverse=True)
    summaries = []
    for month in months:
        total, by_category = fairshare.monthly_summary(group_expenses, month)
        summaries.append({
            "month": month,
            "total": money(total),
            "categories": [
                {"name": name, "amount": money(amount)}
                for name, amount in sorted(by_category.items(), key=lambda item: -item[1])
            ],
        })

    return {
        "group": group,
        "groups": groups,
        "people": sorted(balances.keys()),
        "balances": [
            {"person": person, "amount": money(amount)}
            for person, amount in sorted(balances.items(), key=lambda item: -item[1])
        ],
        "transactions": [
            {"from": debtor, "to": creditor, "amount": money(amount)}
            for debtor, creditor, amount in transactions
        ],
        "expenses": [
            {
                "id": expense["id"],
                "date": expense["date"],
                "description": expense["description"],
                "category": expense["category"],
                "paid_by": expense["paid_by"],
                "amount": money(expense["amount_paise"]),
                "mode": expense["split"]["mode"],
                "people": list(expense["split"]["people"]),
            }
            for expense in sorted(group_expenses, key=lambda e: (e["date"], e["id"]), reverse=True)
        ],
        "summaries": summaries,
    }


def parse_split(payload, total):
    """Turn the form's split fields into the {mode, people} shape the engine expects."""
    mode = payload.get("mode", "equal")

    if mode == "equal":
        people = [name.strip() for name in payload.get("people", []) if name.strip()]
        if not people:
            raise ValueError("Add at least one participant.")
        return {"mode": "equal", "people": people}

    entries = payload.get("entries", [])
    people = {}
    for entry in entries:
        name = entry.get("name", "").strip()
        value = entry.get("value", "").strip()
        if not name or not value:
            continue
        if mode == "exact":
            people[name] = fairshare.parse_rupees(value)
        else:
            if not value.isdecimal():
                raise ValueError("Shares and percentages must be whole numbers.")
            people[name] = int(value)

    if not people:
        raise ValueError("Add at least one participant.")
    if mode == "percentage" and sum(people.values()) != 100:
        raise ValueError(f"Percentages must add up to 100 (they add up to {sum(people.values())}).")
    if mode == "exact" and sum(people.values()) != total:
        raise ValueError(
            f"Exact amounts must add up to {fairshare.format_paise(total)} "
            f"(they add up to {fairshare.format_paise(sum(people.values()))})."
        )

    return {"mode": mode, "people": people}


class FairShareHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        route = urlparse(self.path)

        if route.path in ("/", "/index.html"):
            return self.send_file("index.html", "text/html; charset=utf-8")
        if route.path == "/api/state":
            group = parse_qs(route.query).get("group", [""])[0]
            return self.send_json(build_state(group))

        self.send_error(404)

    def do_POST(self):
        route = urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(length) or "{}")

        try:
            if route.path == "/api/expense":
                return self.send_json(self.add_expense(payload))
            if route.path == "/api/settlement":
                return self.send_json(self.add_settlement(payload))
            if route.path == "/api/delete":
                return self.send_json(self.remove_expense(payload))
        except ValueError as error:
            return self.send_json({"error": str(error)}, status=400)

        self.send_error(404)

    #Routes
    def add_expense(self, payload):
        group = payload.get("group", "").strip()
        payer = payload.get("payer", "").strip()
        description = payload.get("description", "").strip()
        category = payload.get("category", "").strip() or "Uncategorised"

        if not group:
            raise ValueError("Pick a group first.")
        if not payer:
            raise ValueError("Who paid?")
        if not description:
            raise ValueError("Add a description.")

        amount = fairshare.parse_rupees(payload.get("amount", ""))
        if amount <= 0:
            raise ValueError("Amount must be more than zero.")

        expenses = fairshare.load_expenses()
        split = parse_split(payload, amount)
        fairshare.create_expense(expenses, group, payer, amount, description, category, split)
        return build_state(group)

    def add_settlement(self, payload):
        group = payload.get("group", "").strip()
        payer = payload.get("payer", "").strip()
        payee = payload.get("payee", "").strip()

        if not payer or not payee:
            raise ValueError("Both people are needed.")
        if payer == payee:
            raise ValueError("A person can't settle up with themselves.")

        #the suggested-payment buttons already know the exact paise, so they skip the
        #rupee round trip entirely rather than dividing by 100 in JavaScript
        if "amount_paise" in payload:
            amount = int(payload["amount_paise"])
        else:
            amount = fairshare.parse_rupees(payload.get("amount", ""))
        if amount <= 0:
            raise ValueError("Amount must be more than zero.")

        expenses = fairshare.load_expenses()
        fairshare.create_settlement(expenses, group, payer, payee, amount)
        return build_state(group)

    def remove_expense(self, payload):
        group = payload.get("group", "").strip()
        expense_id = payload.get("id")

        expenses = fairshare.load_expenses()
        #only this group's expenses are searched, so one group can't delete another's
        for expense in fairshare.filter_by_group(expenses, group):
            if expense["id"] == expense_id:
                expenses.remove(expense)
                fairshare.save_expenses(expenses)
                return build_state(group)

        raise ValueError("That expense is not in this group.")

    #Plumbing
    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, filename, content_type):
        try:
            with open(filename, "rb") as file:
                body = file.read()
        except FileNotFoundError:
            return self.send_error(404)

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  #keep the terminal quiet


if __name__ == "__main__":
    server = HTTPServer(("localhost", PORT), FairShareHandler)
    print(f"FairShare is running at http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")
    webbrowser.open(f"http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
