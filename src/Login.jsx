import { useState } from "react";
import { supabase } from "./supabase";

export default function Login({ onLogin, onSignup }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleLogin() {
        setLoading(true);
        setError("");
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setError(error.message);
        } else {
            onLogin(data.user);
        }
        setLoading(false);
    }

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ backgroundColor: "#1e293b", padding: "48px", borderRadius: "20px", width: "100%", maxWidth: "400px", boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}>
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                    <div style={{ width: "48px", height: "48px", backgroundColor: "#16a34a", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "24px", color: "white", fontWeight: "800" }}>D</div>
                    <h1 style={{ color: "white", fontSize: "24px", fontWeight: "800", margin: 0 }}>DelivaGH</h1>
                    <p style={{ color: "#64748b", marginTop: "8px", fontSize: "14px" }}>Sign in to your dashboard</p>
                </div>

                {error && (
                    <div style={{ backgroundColor: "#450a0a", color: "#fca5a5", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" }}>
                        {error}
                    </div>
                )}

                <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#94a3b8", marginBottom: "6px" }}>Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        style={{ width: "100%", padding: "12px 14px", border: "1px solid #334155", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box", backgroundColor: "#0f172a", color: "white" }}
                    />
                </div>

                <div style={{ marginBottom: "24px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#94a3b8", marginBottom: "6px" }}>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="password"
                        style={{ width: "100%", padding: "12px 14px", border: "1px solid #334155", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box", backgroundColor: "#0f172a", color: "white" }}
                    />
                </div>

                <button onClick={handleLogin} disabled={loading}
                    style={{ width: "100%", backgroundColor: "#16a34a", color: "white", padding: "12px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
                    {loading ? "Signing in..." : "Sign In"}
                </button>

                <p style={{ textAlign: "center", marginTop: "20px", fontSize: "14px", color: "#64748b" }}>
                    No account?{" "}
                    <span onClick={onSignup} style={{ color: "#16a34a", fontWeight: "600", cursor: "pointer" }}>Sign up</span>
                </p>
            </div>
        </div>
    );
}