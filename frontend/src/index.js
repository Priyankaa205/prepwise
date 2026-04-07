import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import AuthPage from './AuthPage';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

function Root() {
  const [user, setUser] = React.useState(undefined);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Loading state
  if (user === undefined) return (
    <div style={{
      minHeight: "100vh", background: "#09090F",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#00FFB2", fontFamily: "'DM Mono', monospace", fontSize: 13, letterSpacing: "1px",
    }}>
      LOADING...
    </div>
  );

  return user ? <App user={user} /> : <AuthPage />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Root />);