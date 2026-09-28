import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, isConfigured } from "./lib/firebase";
import * as api from "./lib/api";
import { Avatar } from "./components/ui";
import AuthScreen from "./components/AuthScreen";
import GroupView from "./components/GroupView";
import { GroupDialog, JoinDialog } from "./components/GroupDialogs";
import SetupScreen from "./components/SetupScreen";

export default function App() {
  const [user, setUser] = useState(undefined);   // undefined = still checking
  const [groups, setGroups] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Firebase restores the session itself, then reports it here
  useEffect(() => {
    if (!isConfigured) return;
    return onAuthStateChanged(auth, (next) => setUser(next));
  }, []);

  const refreshGroups = useCallback(async () => {
    if (!user) return [];
    setError("");
    try {
      const next = await api.loadGroups(user.uid);
      setGroups(next);
      return next;
    } catch (failure) {
      setError(failure.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user === undefined) return;
    if (!user) { setLoading(false); return; }
    setLoading(true);
    refreshGroups();
  }, [user, refreshGroups]);

  // the name is on the account itself, set at sign-up; email is the fallback
  const displayName = user ? user.displayName || user.email.split("@")[0] : "";

  const active = groups.find((group) => group.id === activeId) || groups[0] || null;
  const activeGroupId = active ? active.id : null;

  // expenses follow the open group, one group's worth at a time
  const refreshExpenses = useCallback(async () => {
    if (!activeGroupId) { setExpenses([]); return; }
    try {
      setExpenses(await api.loadExpenses(activeGroupId));
    } catch (failure) {
      setError(failure.message);
    }
  }, [activeGroupId]);

  useEffect(() => { refreshExpenses(); }, [refreshExpenses]);

  const run = async (work) => {
    setError("");
    try {
      await work();
      await refreshGroups();
      await refreshExpenses();
    } catch (failure) {
      setError(failure.message);
    }
  };

  if (!isConfigured) return <SetupScreen />;

  if (user === undefined || (user && loading)) {
    return (
      <div className="boot">
        <div className="boot-mark">₹</div>
        <p className="dim" style={{ fontSize: 13 }}>Loading FairShare…</p>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-brand"><span className="mark">₹</span> FairShare</div>

        <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div className="side-label">Groups</div>
          <div className="glist">
            {groups.map((group) => (
              <button className="gitem" key={group.id} aria-current={Boolean(active && group.id === active.id)}
                onClick={() => setActiveId(group.id)}>
                <span className="dot" style={{ background: group.color }} />
                <span className="gname">{group.name}</span>
                <span className="gnet dim">{group.members.length}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button className="btn btn-quiet btn-sm" style={{ flex: 1 }} onClick={() => setCreating(true)}>
              + New
            </button>
            <button className="btn btn-quiet btn-sm" style={{ flex: 1 }} onClick={() => setJoining(true)}>
              Join
            </button>
          </div>
        </div>

        <div className="side-foot">
          <Avatar name={displayName} size={32} />
          <div className="who">
            <div className="n">{displayName}</div>
            <div className="r">{user.email}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </aside>

      {active ? (
        <GroupView
          key={active.id}
          group={active}
          expenses={expenses}
          me={displayName}
          onAdd={(expense) => run(() => api.addExpense(expense, user.uid))}
          onDelete={(id) => run(() => api.deleteExpense(id))}
          onLeave={(id) => run(async () => {
            await api.leaveGroup(id, user.uid);
            setActiveId(null);
          })}
        />
      ) : (
        <div className="main">
          <div className="topbar"><h1>Welcome, {displayName.split(" ")[0]}</h1></div>
          <div className="content">
            {error ? <div className="err">{error}</div> : null}
            <div className="card">
              <div className="card-body">
                <div className="empty" style={{ padding: "48px 18px" }}>
                  <strong>No groups yet</strong>
                  A group is a set of people who share costs — flatmates, a trip, a team lunch.
                  <div style={{ marginTop: 18, display: "flex", gap: 8, justifyContent: "center" }}>
                    <button className="btn btn-primary" onClick={() => setCreating(true)}>Create a group</button>
                    <button className="btn btn-quiet" onClick={() => setJoining(true)}>Join with a code</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && active ? (
        <div style={{ position: "fixed", bottom: 16, right: 16, maxWidth: 360, zIndex: 50 }}>
          <div className="err" style={{ margin: 0, boxShadow: "var(--shadow)" }}>{error}</div>
        </div>
      ) : null}

      {creating ? (
        <GroupDialog me={displayName} onClose={() => setCreating(false)}
          onSave={(group) => run(async () => {
            const id = await api.createGroup(group, user.uid);
            setActiveId(id);
          })} />
      ) : null}

      {joining ? (
        <JoinDialog onClose={() => setJoining(false)}
          onJoin={async (code) => {
            const id = await api.joinGroup(code, user.uid);
            await refreshGroups();
            setActiveId(id);
          }} />
      ) : null}
    </div>
  );
}
