import { useState } from "react";
import { auth, googleProvider } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fonts = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500&display=swap');`;

  const mono = { fontFamily: "'DM Mono', monospace" };
  const serif = { fontFamily: "'Playfair Display', serif" };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const msgs = {
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/email-already-in-use": "Email already registered. Please login.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/invalid-email": "Invalid email address.",
        "auth/invalid-credential": "Invalid email or password.",
      };
      setError(msgs[err.code] || "Something went wrong. Try again.");
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError("Google sign-in failed. Try again.");
    }
    setLoading(false);
  };

  const inp = {
    width: "100%", padding: "12px 14px", borderRadius: 8,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "white", fontSize: 14, boxSizing: "border-box", outline: "none",
    fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <>
      <style>{fonts}</style>
      <div style={{
        minHeight: "100vh", background: "#09090F", color: "white",
        fontFamily: "'DM Sans', sans-serif", display: "flex",
        alignItems: "center", justifyContent: "center", position: "relative",
      }}>
        {/* Ambient glow */}
        <div style={{
          position: "fixed", inset: 0, pointerEvents: "none",
          background: `
            radial-gradient(ellipse 60% 50% at 20% 30%, rgba(0,255,178,0.06) 0%, transparent 60%),
            radial-gradient(ellipse 50% 50% at 80% 70%, rgba(162,155,254,0.07) 0%, transparent 60%)
          `
        }} />

        <div style={{ width: "100%", maxWidth: 420, padding: "0 20px", position: "relative", zIndex: 1 }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 13,
              background: "linear-gradient(135deg, #00FFB2, #A29BFE)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 800, color: "#09090F",
              margin: "0 auto 14px",
            }}>P</div>
            <div style={{ ...serif, fontWeight: 700, fontSize: 24, letterSpacing: "-0.5px" }}>PrepWise</div>
            <div style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.5px", marginTop: 4 }}>AI PLACEMENT TRACKER</div>
          </div>

          {/* Card */}
          <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 18, padding: "28px", backdropFilter: "blur(20px)",
          }}>
            {/* Tab switcher */}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 4, marginBottom: 24 }}>
              {["Login", "Sign Up"].map((t, i) => (
                <button key={t} onClick={() => { setIsLogin(i === 0); setError(""); }} style={{
                  flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: (isLogin ? i === 0 : i === 1) ? "rgba(0,255,178,0.15)" : "transparent",
                  color: (isLogin ? i === 0 : i === 1) ? "#00FFB2" : "rgba(255,255,255,0.4)",
                  fontSize: 13, fontWeight: (isLogin ? i === 0 : i === 1) ? 600 : 400,
                  fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                }}>{t}</button>
              ))}
            </div>

            <form onSubmit={handleEmailAuth}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 7, letterSpacing: "0.5px" }}>EMAIL</div>
                <input type="email" placeholder="you@college.edu" value={email}
                  onChange={e => setEmail(e.target.value)} style={inp} required />
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 7, letterSpacing: "0.5px" }}>PASSWORD</div>
                <input type="password" placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} style={inp} required />
              </div>

              {error && (
                <div style={{ background: "rgba(253,121,168,0.1)", border: "1px solid rgba(253,121,168,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#FD79A8" }}>
                  ⚠ {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width: "100%", padding: "13px", borderRadius: 8, border: "none",
                background: loading ? "rgba(0,255,178,0.4)" : "linear-gradient(135deg, #00FFB2, #00C98E)",
                color: "#09090F", fontSize: 14, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: "0 4px 20px rgba(0,255,178,0.2)",
              }}>
                {loading ? "Please wait..." : isLogin ? "Login →" : "Create Account →"}
              </button>
            </form>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
              <span style={{ ...mono, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>OR</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            </div>

            <button onClick={handleGoogle} disabled={loading} style={{
              width: "100%", padding: "12px", borderRadius: 8,
              cursor: loading ? "not-allowed" : "pointer",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
              color: "white", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            }}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
          </div>

          <p style={{ textAlign: "center", ...mono, fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 20 }}>
            Your data is secure and private 🔒
          </p>
        </div>
      </div>
    </>
  );
}