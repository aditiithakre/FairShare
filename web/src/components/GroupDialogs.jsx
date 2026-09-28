import { useState } from "react";
import { Dialog } from "./ui";

const COLORS = ["#0f9d76", "#3b82c4", "#b4791f", "#a4559b", "#5c6ac4", "#c25b4a"];

export function GroupDialog({ me, onClose, onSave }) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState([me || "", "", ""]);
  const [error, setError] = useState("");

  const submit = () => {
    const groupName = name.trim();
    const people = members.map((member) => member.trim()).filter(Boolean);
    const unique = [...new Set(people)];

    if (!groupName) return setError("Give the group a name");
    if (unique.length < 2) return setError("Add at least two people");
    if (unique.length !== people.length) return setError("Two people have the same name — make them different");

    onSave({ name: groupName, members: unique, color: COLORS[Math.floor(Math.random() * COLORS.length)] });
    onClose();
  };

  return (
    <Dialog
      title="New group"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Create group</button>
        </>
      }
    >
      {error ? <div className="err">{error}</div> : null}

      <label className="field">
        <span>Group name</span>
        <input className="input" value={name} autoFocus onChange={(event) => setName(event.target.value)}
          placeholder="Flatmates, Goa trip, Office lunch…" />
      </label>

      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
        People
      </span>
      {members.map((member, index) => (
        <div className="split-row" key={index}>
          <input type="text" className="input" style={{ flex: "1 1 auto", width: "auto", textAlign: "left" }}
            value={member} placeholder={index === 0 ? "You" : "Name"}
            onChange={(event) => {
              const next = members.slice();
              next[index] = event.target.value;
              setMembers(next);
            }} />
          {members.length > 2 ? (
            <button className="btn btn-ghost btn-sm" aria-label={`Remove person ${index + 1}`}
              onClick={() => setMembers(members.filter((_, other) => other !== index))}>✕</button>
          ) : null}
        </div>
      ))}
      <button className="btn btn-quiet btn-sm" style={{ marginTop: 8 }}
        onClick={() => setMembers([...members, ""])}>+ Add person</button>

      <p className="helper">
        These are the people costs are split between. They don't need FairShare accounts — you can
        invite anyone who does have one to the group afterwards, with its join code.
      </p>
    </Dialog>
  );
}

export function JoinDialog({ onClose, onJoin }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim()) return setError("Enter the group's code");
    setBusy(true);
    setError("");
    try {
      await onJoin(code.trim());
      onClose();
    } catch (failure) {
      setError(failure.message || "Could not join that group");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Join a group"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Joining…" : "Join group"}
          </button>
        </>
      }
    >
      {error ? <div className="err">{error}</div> : null}
      <label className="field">
        <span>Group code</span>
        <input className="input" value={code} autoFocus style={{ fontFamily: "var(--mono)", letterSpacing: ".1em" }}
          onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="A1B2C3" maxLength={8} />
      </label>
      <p className="helper">
        Ask whoever set the group up for its code — it's shown at the top of their group page.
      </p>
    </Dialog>
  );
}
