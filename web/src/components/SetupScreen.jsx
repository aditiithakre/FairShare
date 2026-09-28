/** Shown when the Firebase config is missing, so a fresh clone explains itself
 *  instead of failing with a blank page. */
export default function SetupScreen() {
  return (
    <div className="setup">
      <div className="splash-mark">₹</div>
      <h1>FairShare needs a database</h1>
      <p className="dim">
        The app is built and ready — it just needs a free Firebase project to hold accounts and
        expenses. This takes about five minutes, once.
      </p>
      <ol>
        <li>Create a project at <code>console.firebase.google.com</code> (the free Spark plan is enough).</li>
        <li>Open <strong>Authentication → Sign-in method</strong> and enable <strong>Email/Password</strong>.</li>
        <li>In the sidebar, open <strong>Databases &amp; Storage → Firestore Database</strong> and create a
          database (production mode is right — you replace its rules next). Then open its
          <strong> Rules</strong> tab, paste in <code>web/firebase/firestore.rules</code> from this repo,
          and publish.</li>
        <li>Under <strong>Project settings → Your apps</strong>, register a web app and copy its config
          values into <code>web/.env</code>:</li>
      </ol>
      <pre>{`VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=yourproject.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=yourproject
VITE_FIREBASE_STORAGE_BUCKET=yourproject.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...`}</pre>
      <p className="dim" style={{ fontSize: 13.5 }}>
        Then restart <code>npm run dev</code>. These values are meant to be public in a browser
        build — the security rules are what keep one account's data away from another's.
      </p>
    </div>
  );
}
