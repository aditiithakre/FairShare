import { useMemo, useState } from "react";
import { Dialog } from "./ui";
import { formatPaise, parseRupees } from "../lib/money";

const CATEGORIES = ["Food", "Rent", "Utilities", "Travel", "Groceries", "Entertainment", "Other"];
const today = () => new Date().toISOString().slice(0, 10);

export default function ExpenseDialog({ group, me, onClose, onSave }) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [paidBy, setPaidBy] = useState(group.members.includes(me) ? me : group.members[0] || "");
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState("equal");
  const [picked, setPicked] = useState(() => group.members.slice());
  const [values, setValues] = useState({});
  const [error, setError] = useState("");

  const totalPaise = useMemo(() => {
    try { return parseRupees(amount); } catch { return null; }
  }, [amount]);

  const tally = useMemo(() => {
    if (mode === "equal") return 0;
    let sum = 0;
    for (const member of group.members) {
      const raw = (values[member] || "").trim();
      if (!raw) continue;
      if (mode === "exact") { try { sum += parseRupees(raw); } catch { /* mid-typing */ } }
      else if (/^\d+$/.test(raw)) sum += parseInt(raw, 10);
    }
    return sum;
  }, [values, mode, group.members]);

  const submit = () => {
    setError("");

    let total;
    try { total = parseRupees(amount); } catch (failure) { return setError(failure.message); }
    if (total <= 0) return setError("Amount must be more than zero");
    if (!description.trim()) return setError("Add a short description");
    if (!paidBy) return setError("Choose who paid");

    let split;
    if (mode === "equal") {
      if (!picked.length) return setError("Pick at least one person to split between");
      split = { mode: "equal", people: picked };
    } else {
      const people = {};
      for (const member of group.members) {
        const raw = (values[member] || "").trim();
        if (!raw) continue;
        if (mode === "exact") {
          try { people[member] = parseRupees(raw); }
          catch (failure) { return setError(`${member}: ${failure.message}`); }
        } else {
          if (!/^\d+$/.test(raw)) return setError(`${member}: use a whole number`);
          people[member] = parseInt(raw, 10);
        }
      }
      if (!Object.keys(people).length) return setError("Enter a value for at least one person");

      const sum = Object.values(people).reduce((a, b) => a + b, 0);
      if (mode === "percentage" && sum !== 100) return setError(`Percentages add up to ${sum}, not 100`);
      if (mode === "exact" && sum !== total) {
        return setError(`Exact amounts add up to ${formatPaise(sum)}, not ${formatPaise(total)}`);
      }
      split = { mode, people };
    }

    onSave({
      groupId: group.id,
      description: description.trim(),
      amountPaise: total,
      paidBy,
      category,
      date,
      split,
    });
    onClose();
  };

  return (
    <Dialog
      title="Add an expense"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Add expense</button>
        </>
      }
    >
      {error ? <div className="err">{error}</div> : null}

      <label className="field">
        <span>Description</span>
        <input className="input" value={description} autoFocus
          onChange={(event) => setDescription(event.target.value)} placeholder="Dinner, rent, cab…" />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label className="field">
          <span>Amount</span>
          <div className="rupee">
            <input className="input" value={amount} inputMode="decimal"
              onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
          </div>
        </label>
        <label className="field">
          <span>Category</span>
          <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label className="field">
          <span>Paid by</span>
          <select className="input" value={paidBy} onChange={(event) => setPaidBy(event.target.value)}>
            {group.members.map((member) => <option key={member}>{member}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Date</span>
          <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>

      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
        Split
      </span>
      <div className="seg">
        {[["equal", "Equally"], ["shares", "Shares"], ["percentage", "Percent"], ["exact", "Exact"]].map(
          ([key, label]) => (
            <button key={key} type="button" aria-pressed={mode === key} onClick={() => setMode(key)}>{label}</button>
          )
        )}
      </div>

      {group.members.map((member) => (
        <div className="split-row" key={member}>
          {mode === "equal" ? (
            <input type="checkbox" id={`pick-${member}`} checked={picked.includes(member)}
              onChange={(event) =>
                setPicked(event.target.checked ? [...picked, member] : picked.filter((p) => p !== member))} />
          ) : null}
          <label className="nm" htmlFor={mode === "equal" ? `pick-${member}` : undefined}>{member}</label>
          {mode === "equal" ? (
            <span className="dim money" style={{ fontSize: 13 }}>
              {picked.includes(member) && totalPaise && picked.length
                ? formatPaise(Math.floor(totalPaise / picked.length))
                : "—"}
            </span>
          ) : (
            <input type="text" className="input" value={values[member] || ""} inputMode="decimal"
              placeholder={mode === "exact" ? "0.00" : mode === "percentage" ? "0" : "1"}
              onChange={(event) => setValues({ ...values, [member]: event.target.value })} />
          )}
        </div>
      ))}

      {mode !== "equal" ? (
        <div className="tally">
          <span>{mode === "percentage" ? "Total percentage" : "Total entered"}</span>
          <span className="money">
            {mode === "exact" ? formatPaise(tally) : `${tally}${mode === "percentage" ? "%" : " shares"}`}
            {mode === "percentage" ? " of 100%" : mode === "exact" && totalPaise ? ` of ${formatPaise(totalPaise)}` : ""}
          </span>
        </div>
      ) : null}
    </Dialog>
  );
}
