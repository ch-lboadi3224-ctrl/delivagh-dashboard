import { useState } from "react";
import { supabase } from "./supabase";

export default function Login({ onLogin, onSignup }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPass, setShowPass] = useState(false);

    async function handleLogin() {
        if (!email || !password) { setError("Please fill in all fields."); return; }
        setLoading(true);
        setError("");
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setError(error.message); }
        else { onLogin(data.user); }
        setLoading(false);
    }

    function handleKey(e) { if (e.key === "Enter") handleLogin(); }

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
            <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'DM Sans', sans-serif; }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes shimmer { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
                .auth-input { width: 100%; padding: 13px 16px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; font-size: 14px; color: white; outline: none; transition: border-color 0.2s, background 0.2s; font-family: 'DM Sans', sans-serif; }
                .auth-input::placeholder { color: rgba(255,255,255,0.3); }
                .auth-input:focus { border-color: #22c55e; background: rgba(34,197,94,0.05); }
                .auth-btn { width: 100%; padding: 14px; background: #16a34a; color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; letter-spacing: 0.01em; }
                .auth-btn:hover:not(:disabled) { background: #22c55e; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(34,197,94,0.35); }
                .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }
            `}</style>

            <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'DM Sans', sans-serif", backgroundColor: "#080f0a" }}>

                {/* ── LEFT — FORM ── */}
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px", position: "relative", zIndex: 1 }}>
                    <div style={{ width: "100%", maxWidth: "400px", animation: "fadeUp 0.5s ease both" }}>

                        {/* Logo */}
                        <div style={{ marginBottom: "48px" }}>
                            <div style={{ fontSize: "22px", fontWeight: "700", color: "white", letterSpacing: "-0.5px", marginBottom: "6px" }}>
                                Delivagh<span style={{ color: "#22c55e" }}>.</span>
                            </div>
                            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", fontWeight: "300" }}>Vendor Portal</p>
                        </div>

                        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "white", letterSpacing: "-0.5px", marginBottom: "8px", fontFamily: "'Playfair Display', serif" }}>
                            Welcome back
                        </h1>
                        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", marginBottom: "36px", fontWeight: "300" }}>
                            Sign in to manage your orders
                        </p>

                        {error && (
                            <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", padding: "12px 14px", borderRadius: "10px", marginBottom: "20px", fontSize: "13px", animation: "fadeUp 0.3s ease" }}>
                                {error}
                            </div>
                        )}

                        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: "500", color: "rgba(255,255,255,0.5)", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</label>
                                <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKey} placeholder="your@email.com" />
                            </div>
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
                                    <label style={{ fontSize: "12px", fontWeight: "500", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</label>
                                    <span style={{ fontSize: "12px", color: "#22c55e", cursor: "pointer", fontWeight: "500" }}>Forgot?</span>
                                </div>
                                <div style={{ position: "relative" }}>
                                    <input className="auth-input" type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKey} placeholder="••••••••" style={{ paddingRight: "44px" }} />
                                    <button onClick={() => setShowPass(p => !p)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "13px", padding: "2px" }}>
                                        {showPass ? "Hide" : "Show"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button className="auth-btn" onClick={handleLogin} disabled={loading}>
                            {loading ? "Signing in..." : "Sign In"}
                        </button>

                        <p style={{ textAlign: "center", marginTop: "24px", fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>
                            No account?{" "}
                            <span onClick={onSignup} style={{ color: "#22c55e", fontWeight: "600", cursor: "pointer" }}>Create one free</span>
                        </p>
                    </div>
                </div>

                {/* ── RIGHT — VISUAL PANEL ── */}
                <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {/* Dark green gradient background */}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #052e16 0%, #064e3b 40%, #065f46 70%, #047857 100%)" }} />

                    {/* Mesh noise overlay */}
                    <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse at 30% 20%, rgba(34,197,94,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(16,185,129,0.12) 0%, transparent 50%)", animation: "shimmer 4s ease-in-out infinite" }} />

                    {/* Content */}
                    <div style={{ position: "relative", zIndex: 1, padding: "60px", maxWidth: "480px" }}>
                        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(36px, 4vw, 52px)", fontWeight: "800", color: "white", lineHeight: 1.15, marginBottom: "32px", letterSpacing: "-1px" }}>
                            Receive orders<br />
                            <em style={{ fontStyle: "normal", color: "#86efac" }}>on WhatsApp,</em><br />
                            manage everything.
                        </h2>
                        <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: "48px", fontWeight: "300" }}>
                            Your AI-powered ordering system for food businesses in Ghana. Live orders, instant notifications, zero hassle.
                        </p>

                        {/* Stats row */}
                        <div style={{ display: "flex", gap: "32px" }}>
                            {[
                                { num: "GHS 1", label: "per order" },
                                { num: "24/7", label: "AI bot active" },
                                { num: "5 min", label: "to set up" },
                            ].map((s, i) => (
                                <div key={i}>
                                    <p style={{ fontSize: "22px", fontWeight: "800", color: "white", margin: "0 0 3px", fontFamily: "'Playfair Display', serif" }}>{s.num}</p>
                                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Mock order card */}
                        <div style={{ marginTop: "48px", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: "16px", padding: "20px", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(10px)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                                <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>🔔</div>
                                <div>
                                    <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "white" }}>New Order — GHS 75.00</p>
                                    <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>2x Jollof Rice · 1x Grilled Chicken</p>
                                </div>
                                <span style={{ marginLeft: "auto", backgroundColor: "rgba(34,197,94,0.15)", color: "#86efac", padding: "3px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "700", border: "1px solid rgba(34,197,94,0.2)", whiteSpace: "nowrap" }}>Pending</span>
                            </div>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <div style={{ flex: 1, height: "6px", borderRadius: "3px", backgroundColor: "#22c55e" }} />
                                <div style={{ flex: 1, height: "6px", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.1)" }} />
                                <div style={{ flex: 1, height: "6px", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.1)" }} />
                                <div style={{ flex: 1, height: "6px", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.1)" }} />
                            </div>
                            <p style={{ margin: "8px 0 0", fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Order progress — Step 1 of 4</p>
                        </div>
                    </div>
                </div>

            </div>
        </>
    );
}