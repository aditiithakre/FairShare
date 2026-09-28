import { useMemo, useState } from "react";
import { Avatar, Confirm, initials } from "./ui";
import ExpenseDialog from "./ExpenseDialog";
import { formatPaise } from "../lib/money";
import { calculateBalances, settleBalances, monthlySummary } from "../lib/engine";

const today = () => new Date().toISOString().slice(0, 10);

export default function GroupView({ group, expenses, me, onAdd, onDelete, onLeave }) {
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [copied, setCopied] = useState(false);
  const [month, setMonth] = useState("");

  const balances = useMemo(() => calculateBalances(expenses), [expenses]);
  const payments = useMemo(() => settleBalances(balances), [balances]);
  const months = useMemo(
    () => [...new Set(expenses.map((expense) => expense.date.slice(0, 7)))].sort().reverse(),
    [expenses]
  );

  const activeMonth = month || months[0] || today().slice(0, 7);
  const summary = useMemo(() => monthlySummary(expenses, activeMonth), [expenses, activeMonth]);
  const myBalance = balances[me] || 0;
  const maxCategory = Math.max(1, ...Object.values(summary.byCategory));

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(group.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const recordSettlement = (payment) =>
    onAdd({
      groupId: group.id,
      description: `${payment.from} paid ${payment.to}`,
      amountPaise: payment.amount,
      paidBy: payment.from,
      category: "Settlement",
      date: today(),
      split: { mode: "exact", people: { [payment.to]: payment.amount } },
    });

  return (
    <div className="main">
      <div className="topbar">
        <h1>{group.name}</h1>
        <div className="members">
          {group.members.slice(0, 6).map((member) => (
            <span className="pip" key={member} title={member}>{initials(member)}</span>
          ))}
          {group.members.length > 6 ? <span className="pip">+{group.members.length - 6}</span> : null}
        </div>
        <button className="code" onClick={copyCode} title="Copy the code so someone can join this group">
          {copied ? "Copied" : group.joinCode}
        </button>
        <div style={{ flex: "1 1 auto" }} />
        <button className="btn btn-quiet btn-sm" onClick={() =>
          setConfirming({
            title: "Leave this group?",
            body: `You'll stop seeing ${group.name} and its expenses. Others keep theirs, and you can rejoin with the code ${group.joinCode}.`,
            confirmLabel: "Leave group",
            onConfirm: () => onLeave(group.id),
          })}>Leave</button>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>Add expense</button>
      </div>

      <div className="content">
        <div className="tiles">
          <div className="tile">
            <div className="k">Your balance</div>
            <div className={`v money ${myBalance > 0 ? "pos" : myBalance < 0 ? "neg" : ""}`}>
              {formatPaise(myBalance)}
            </div>
            <div className="note">
              {myBalance > 0 ? "you are owed" : myBalance < 0 ? "you owe" : "all settled"}
            </div>
          </div>
          <div className="tile">
            <div className="k">Spent in {activeMonth}</div>
            <div className="v money">{formatPaise(summary.total)}</div>
            <div className="note">settlements excluded</div>
          </div>
          <div className="tile">
            <div className="k">To settle up</div>
            <div className="v money">{payments.length}</div>
            <div className="note">{payments.length === 1 ? "payment needed" : "payments needed"}</div>
          </div>
        </div>

        <div className="two-col">
          <div className="card">
            <div className="card-head"><h2>Balances</h2></div>
            <div className="card-body">
              {Object.keys(balances).length ? (
                Object.keys(balances)
                  .sort((a, b) => balances[b] - balances[a])
                  .map((person) => (
                    <div className="row" key={person}>
                      <Avatar name={person} />
                      <div className="grow">
                        <div className="t">{person}{person === me ? " (you)" : ""}</div>
                        <div className="s">
                          {balances[person] > 0 ? "is owed" : balances[person] < 0 ? "owes" : "all square"}
                        </div>
                      </div>
                      <div className={`money t ${balances[person] > 0 ? "pos" : balances[person] < 0 ? "neg" : "dim"}`}>
                        {formatPaise(balances[person])}
                      </div>
                    </div>
                  ))
              ) : (
                <div className="empty"><strong>No expenses yet</strong>Add one to see who owes whom.</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>Settle up</h2></div>
            <div className="card-body">
              {payments.length ? (
                payments.map((payment, index) => (
                  <div className="row" key={index}>
                    <Avatar name={payment.from} />
                    <div className="grow">
                      <div className="t">{payment.from} <span className="dim">→</span> {payment.to}</div>
                      <div className="s">suggested payment</div>
                    </div>
                    <div className="money t">{formatPaise(payment.amount)}</div>
                    <button className="btn btn-quiet btn-sm" onClick={() =>
                      setConfirming({
                        title: "Record this payment?",
                        body: `${payment.from} pays ${payment.to} ${formatPaise(payment.amount)}. It is saved as a settlement, so it counts against the balance but not as spending.`,
                        confirmLabel: "Record payment",
                        onConfirm: () => recordSettlement(payment),
                      })}>Record</button>
                  </div>
                ))
              ) : (
                <div className="empty"><strong>Everyone is settled up</strong>Nothing to pay right now.</div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Spending by category</h2>
            {months.length > 1 ? (
              <select className="input" style={{ width: "auto", padding: "5px 9px", fontSize: 13 }}
                value={activeMonth} onChange={(event) => setMonth(event.target.value)}>
                {months.map((item) => <option key={item}>{item}</option>)}
              </select>
            ) : null}
          </div>
          <div className="card-body">
            {Object.keys(summary.byCategory).length ? (
              Object.keys(summary.byCategory)
                .sort((a, b) => summary.byCategory[b] - summary.byCategory[a])
                .map((category) => (
                  <div className="row" key={category} style={{ gap: 14 }}>
                    <div style={{ flex: "0 0 92px", fontSize: 13.5, fontWeight: 600 }}>{category}</div>
                    <div className="bar-track">
                      <div className="bar" style={{ width: `${(summary.byCategory[category] / maxCategory) * 100}%` }} />
                    </div>
                    <div className="money" style={{ fontSize: 13.5, fontWeight: 620 }}>
                      {formatPaise(summary.byCategory[category])}
                    </div>
                  </div>
                ))
            ) : (
              <div className="empty">Nothing recorded for {activeMonth}.</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Expenses</h2>
            <span className="dim" style={{ fontSize: 13 }}>{expenses.length}</span>
          </div>
          <div className="card-body">
            {expenses.length ? (
              expenses.map((expense) => (
                <div className="row" key={expense.id}>
                  <Avatar name={expense.paidBy} />
                  <div className="grow">
                    <div className="t">{expense.description}</div>
                    <div className="s">
                      {expense.date} · {expense.paidBy} paid · split {expense.split.mode} between{" "}
                      {expense.split.mode === "equal"
                        ? expense.split.people.length
                        : Object.keys(expense.split.people).length}
                    </div>
                  </div>
                  <span className="chip">{expense.category}</span>
                  <div className="money t">{formatPaise(expense.amountPaise)}</div>
                  <button className="btn btn-ghost btn-sm" aria-label={`Delete ${expense.description}`}
                    onClick={() =>
                      setConfirming({
                        title: "Delete this expense?",
                        body: `"${expense.description}" for ${formatPaise(expense.amountPaise)} will be removed and the balances recalculated.`,
                        confirmLabel: "Delete",
                        onConfirm: () => onDelete(expense.id),
                      })}>✕</button>
                </div>
              ))
            ) : (
              <div className="empty"><strong>No expenses yet</strong>Everything you add shows up here.</div>
            )}
          </div>
        </div>
      </div>

      {adding ? <ExpenseDialog group={group} me={me} onClose={() => setAdding(false)} onSave={onAdd} /> : null}
      {confirming ? <Confirm {...confirming} onClose={() => setConfirming(null)} /> : null}
    </div>
  );
}
