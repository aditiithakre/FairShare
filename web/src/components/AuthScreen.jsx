import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth, readableAuthError } from "../lib/firebase";

export default function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const signingUp = mode === "signup";

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (signingUp && !displayName.trim()) return setError("What should we call you?");
    if (!email.trim()) return setError("Enter your email address");
    if (password.length < 6) return setError("Passwords need at least 6 characters");

    setBusy(true);
    try {
      if (signingUp) {
        const created = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(created.user, { displayName: displayName.trim() });
        // onAuthStateChanged fires before the profile write lands, so nudge it
        await created.user.reload();
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (failure) {
      setError(readableAuthError(failure));
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-pitch">
        <div className="auth-brand"><span className="mark">₹</span> FairShare</div>
        <h1>Split the bill, not the friendship.</h1>
        <p className="lede">
          Track what everyone paid, see who owes whom at a glance, and settle up in the fewest
          payments. Amounts are kept in whole paise, so a balance always reaches zero.
        </p>
        <div className="receipt" aria-hidden="true">
          <div className="receipt-row">
            <span className="pip">1</span><span className="who">Someone pays</span>
            <span className="tag money">₹4,800.00</span>
          </div>
          <div className="receipt-row">
            <span className="pip">2</span><span className="who">Split four ways</span>
            <span className="tag money">₹1,200.00 each</span>
          </div>
          <div className="receipt-row">
            <span className="pip">3</span><span className="who">Settle up</span>
            <span className="tag">1 payment, not 3</span>
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <div className="tabs">
            <button aria-pressed={!signingUp} onClick={() => { setMode("signin"); setError(""); }}>
              Sign in
            </button>
            <button aria-pressed={signingUp} onClick={() => { setMode("signup"); setError(""); }}>
              Create account
            </button>
          </div>

          <h2>{signingUp ? "Create your account" : "Welcome back"}</h2>
          <p className="sub">
            {signingUp
              ? "Your groups sync to every device you sign in on."
              : "Sign in to pick up where you left off."}
          </p>

          {error ? <div className="err">{error}</div> : null}

          <form onSubmit={submit}>
            {signingUp ? (
              <label className="field">
                <span>Your name</span>
                <input className="input" value={displayName} autoComplete="name"
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="How friends know you" />
              </label>
            ) : null}

            <label className="field">
              <span>Email</span>
              <input className="input" type="email" value={email} autoComplete="email"
                onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </label>

            <label className="field">
              <span>Password</span>
              <input className="input" type="password" value={password}
                autoComplete={signingUp ? "new-password" : "current-password"}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters" />
            </label>

            <button className="btn btn-brand" type="submit" disabled={busy}>
              {busy ? "One moment…" : signingUp ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="switch">
            {signingUp ? "Already have an account? " : "New here? "}
            <button onClick={() => { setMode(signingUp ? "signin" : "signup"); setError(""); }}>
              {signingUp ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
