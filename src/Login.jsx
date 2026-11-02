import React, { useState } from "react";
import { supabase } from "./supabase";
import { normalizeEmail } from "./authValidators";

const redirectUrl = import.meta.env.VITE_SITE_URL || (typeof window !== "undefined" ? window.location.origin + "/" : undefined);

function googleButtonStyle() {
    return {
        width: "100%",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "10px",
        color: "white",
        fontSize: "14px",
        fontWeight: "600",
        cursor: "pointer",
        fontFamily: "'Inter',sans-serif",
    };
}

export default function Login({ notice = "" }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendMsg, setResendMsg] = useState("");
    const [showResendButton, setShowResendButton] = useState(false);
    const [forgotMode, setForgotMode] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotSent, setForgotSent] = useState(false);
    const [forgotLoading, setForgotLoading] = useState(false);

    function loginErrorSuggestsUnconfirmedEmail(message) {
        const m = (message || "").toLowerCase();
        return m.includes("email") && m.includes("confirm");
    }

    async function handleGoogle() {
        setError("");
        setResendMsg("");
        const { error: oerr } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: "https://www.delivagh.app" },
        });
        if (oerr) setError(oerr.message);
    }

    async function handleResendConfirmation() {
        const em = normalizeEmail(email);
        if (!em.ok) {
            setResendMsg("");
            setError("Enter the email you signed up with, then tap Resend.");
            return;
        }
        setResendLoading(true);
        setResendMsg("");
        setError("");
        const { error: rerr } = await supabase.auth.resend({
            type: "signup",
            email: em.value,
            options: { emailRedirectTo: redirectUrl },
        });
        setResendLoading(false);
        if (rerr) setResendMsg(rerr.message);
        else setResendMsg("Check your inbox for a new confirmation link.");
    }

    async function handleLogin() {
        setResendMsg("");
        const em = normalizeEmail(email);
        if (!em.ok) {
            setShowResendButton(false);
            setError(em.message);
            return;
        }
        if (!password) {
            setShowResendButton(false);
            setError("Please enter your password.");
            return;
        }
        setLoading(true);
        setError("");
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: em.value, password });
        if (authError) {
            const raw = authError.message || "";
            const lower = raw.toLowerCase();
            let displayMsg = raw;
            if (lower.includes("confirm") || lower.includes("verified") || lower.includes("not confirmed")) {
                displayMsg = "Please confirm your email before signing in. Use “Resend confirmation email” if you did not get the link.";
            }
            setError(displayMsg);
            setShowResendButton(loginErrorSuggestsUnconfirmedEmail(displayMsg));
            setLoading(false);
            return;
        }

        const { data: bizData } = await supabase.from("businesses").select("status").eq("user_id", data.user.id).limit(1);
        if (bizData && bizData.length > 0) {
            const status = bizData[0].status;
            if (status === "pending") {
                await supabase.auth.signOut();
                setShowResendButton(false);
                setError("Your account is pending admin approval. You will be notified once approved.");
                setLoading(false);
                return;
            }
            if (status === "rejected") {
                await supabase.auth.signOut();
                setShowResendButton(false);
                setError("Your account application was not approved. Please contact support.");
                setLoading(false);
                return;
            }
            if (status === "suspended") {
                await supabase.auth.signOut();
                setShowResendButton(false);
                setError("Your account has been suspended. Please contact support.");
                setLoading(false);
                return;
            }
        }
        window.location.replace('/dashboard');
        setLoading(false);
    }

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
            <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes shimmer { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
                .ai { width:100%; padding:13px 16px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:10px; font-size:14px; color:white; outline:none; transition:border-color 0.2s; font-family:'Inter',sans-serif; }
                .ai::placeholder { color:rgba(255,255,255,0.3); }
                .ai:focus { border-color:#16a34a; background:rgba(34,197,94,0.05); }
                .ab { width:100%; padding:14px; background:#16a34a; color:white; border:none; border-radius:10px; font-size:15px; font-weight:600; cursor:pointer; transition:all 0.2s; font-family:'Inter',sans-serif; }
                .ab:hover:not(:disabled) { background:#16a34a; transform:translateY(-1px); box-shadow:0 8px 24px rgba(34,197,94,0.35); }
                .ab:disabled { opacity:0.6; cursor:not-allowed; }
                .rp { display:flex; }
                @media(max-width:768px){.rp{display:none!important;}}
            `}</style>
            <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Inter',sans-serif", backgroundColor: "#080f0a" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
                    <div style={{ width: "100%", maxWidth: "400px", animation: "fadeUp 0.5s ease both" }}>
                        <div style={{ marginBottom: "48px" }}>
                            <div style={{ fontSize: "22px", fontWeight: "700", color: "white", letterSpacing: "-0.5px", marginBottom: "4px" }}>Delivagh<span style={{ color: "#16a34a" }}>.</span></div>
                            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", fontWeight: "300" }}>Vendor Portal</p>
                        </div>
                        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "white", letterSpacing: "-0.5px", marginBottom: "8px", fontFamily: "'Inter',sans-serif" }}>Welcome back</h1>
                        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", marginBottom: "28px", fontWeight: "300" }}>Sign in to manage your orders</p>
                        {notice && <div style={{ backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#fcd34d", padding: "12px 14px", borderRadius: "10px", marginBottom: "14px", fontSize: "13px" }}>{notice}</div>}
                        {error && <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", padding: "12px 14px", borderRadius: "10px", marginBottom: "20px", fontSize: "13px" }}>{error}</div>}
                        {resendMsg && <div style={{ backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#86efac", padding: "12px 14px", borderRadius: "10px", marginBottom: "14px", fontSize: "13px" }}>{resendMsg}</div>}

                        {forgotMode ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                <h2 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: "800", color: "white" }}>Reset Password</h2>
                                <p style={{ margin: "0 0 6px", fontSize: "13px", color: "rgba(255,255,255,0.55)" }}>
                                    Enter your email and we'll send you a reset link.
                                </p>
                                {forgotSent ? (
                                    <>
                                        <p style={{ color: "#16a34a", fontWeight: "700", fontSize: "14px", margin: 0 }}>✓ Check your email</p>
                                        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", margin: 0 }}>
                                            We sent a password reset link to <strong>{forgotEmail}</strong>
                                        </p>
                                        <button onClick={() => { setForgotMode(false); setForgotSent(false); setForgotEmail(""); }}
                                            style={{ width: "100%", padding: "13px", backgroundColor: "#16a34a", color: "white", border: "none", borderRadius: "10px", fontWeight: "700", fontSize: "14px", cursor: "pointer", marginTop: "6px" }}>
                                            Back to Login
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <input
                                            type="email"
                                            value={forgotEmail}
                                            onChange={e => setForgotEmail(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && !forgotLoading && document.getElementById('forgot-btn').click()}
                                            placeholder="your@email.com"
                                            style={{ padding: "12px 14px", backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", fontSize: "14px", color: "white", outline: "none", width: "100%", boxSizing: "border-box" }}
                                        />
                                        <button id="forgot-btn" onClick={async () => {
                                            if (!forgotEmail.trim()) return;
                                            setForgotLoading(true);
                                            const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
                                                redirectTo: 'https://delivagh.app/reset-password'
                                            });
                                            setForgotLoading(false);
                                            if (!error) {
                                                setForgotSent(true);
                                            } else {
                                                alert('Error: ' + error.message);
                                            }
                                        }} disabled={forgotLoading}
                                            style={{ width: "100%", padding: "13px", backgroundColor: forgotLoading ? "rgba(255,255,255,0.1)" : "#16a34a", color: "white", border: "none", borderRadius: "10px", fontWeight: "700", fontSize: "14px", cursor: forgotLoading ? "not-allowed" : "pointer" }}>
                                            {forgotLoading ? "Sending..." : "Send Reset Link"}
                                        </button>
                                        <button onClick={() => { setForgotMode(false); setForgotEmail(""); }}
                                            style={{ width: "100%", padding: "13px", backgroundColor: "transparent", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}>
                                            Back to Login
                                        </button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <>
                                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "18px" }}>
                                    <button type="button" style={googleButtonStyle()} onClick={handleGoogle}>
                                        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.283 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.591 6.115 29.018 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.591 6.115 29.018 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c5.265 0 9.61-3.527 11.191-8.36l6.57 5.045C40.556 39.661 32.831 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
                                        Continue with Google
                                    </button>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "rgba(255,255,255,0.25)", fontSize: "11px" }}>
                                        <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.12)" }} />
                                        or email
                                        <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.12)" }} />
                                    </div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
                                    <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "rgba(255,255,255,0.5)", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</label>
                                        <input className="ai" type="email" value={email} onChange={e => { setShowResendButton(false); setEmail(e.target.value); }} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="your@email.com" autoComplete="email" />
                                    </div>
                                    <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "7px" }}>
                                            <label style={{ fontSize: "11px", fontWeight: "600", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</label>
                                            <span style={{ fontSize: "12px", color: "#16a34a", cursor: "pointer", fontWeight: "500" }} onClick={() => setForgotMode(true)}>Forgot?</span>
                                        </div>
                                        <div style={{ position: "relative" }}>
                                            <input className="ai" type={showPass ? "text" : "password"} value={password} onChange={e => { setShowResendButton(false); setPassword(e.target.value); }} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="••••••••" style={{ paddingRight: "54px" }} autoComplete="current-password" />
                                            <button type="button" onClick={() => setShowPass(p => !p)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: "12px", fontFamily: "'Inter',sans-serif", fontWeight: "500" }}>{showPass ? "Hide" : "Show"}</button>
                                        </div>
                                    </div>
                                </div>
                                <button className="ab" onClick={handleLogin} disabled={loading}>{loading ? "Signing in..." : "Sign In"}</button>
                                {showResendButton && (
                                    <button type="button" onClick={handleResendConfirmation} disabled={resendLoading} style={{ width: "100%", marginTop: "10px", padding: "11px", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", color: "rgba(255,255,255,0.55)", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                                        {resendLoading ? "Sending…" : "Resend confirmation email"}
                                    </button>
                                )}
                                <p style={{ textAlign: "center", marginTop: "24px", fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>No account?{" "}<a href='/signup' style={{ color: '#16a34a', fontWeight: '600', textDecoration: 'none' }}>Create one free</a></p>
                            </>
                        )}
                    </div>
                </div>
                <div className="rp" style={{ flex: 1, position: "relative", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#052e16 0%,#064e3b 40%,#065f46 70%,#047857 100%)" }} />
                    <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse at 30% 20%,rgba(34,197,94,0.15) 0%,transparent 60%),radial-gradient(ellipse at 80% 80%,rgba(16,185,129,0.12) 0%,transparent 50%)", animation: "shimmer 4s ease-in-out infinite" }} />
                    <div style={{ position: "relative", zIndex: 1, padding: "60px", maxWidth: "480px" }}>
                        <h2 style={{ fontFamily: "'Inter',sans-serif", fontSize: "clamp(32px,3.5vw,48px)", fontWeight: "800", color: "white", lineHeight: 1.2, marginBottom: "32px", letterSpacing: "-1.5px" }}>Receive orders<br /><em style={{ fontStyle: "normal", color: "#86efac" }}>on WhatsApp,</em><br />manage everything.</h2>
                        <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: "48px", fontWeight: "300" }}>Your AI-powered ordering system for food businesses in Ghana.</p>
                        <div style={{ display: "flex", gap: "32px" }}>
                            {[{ num: "24/7", label: "AI bot active" }, { num: "5 min", label: "to set up" }, { num: "100%", label: "WhatsApp native" }].map((s, i) => (
                                <div key={i}><p style={{ fontSize: "22px", fontWeight: "800", color: "white", margin: "0 0 3px", fontFamily: "'Inter',sans-serif" }}>{s.num}</p><p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p></div>
                            ))}
                        </div>
                        <div style={{ marginTop: "48px", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: "16px", padding: "20px", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                                <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🔔</div>
                                <div><p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "white" }}>New Order — GHS 75.00</p><p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>2x Jollof Rice · 1x Grilled Chicken</p></div>
                                <span style={{ marginLeft: "auto", backgroundColor: "rgba(34,197,94,0.15)", color: "#86efac", padding: "3px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "700", border: "1px solid rgba(34,197,94,0.2)", whiteSpace: "nowrap" }}>Pending</span>
                            </div>
                            <div style={{ display: "flex", gap: "8px" }}><div style={{ flex: 1, height: "6px", borderRadius: "3px", backgroundColor: "#16a34a" }} />{[1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: "6px", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.1)" }} />)}</div>
                            <p style={{ margin: "8px 0 0", fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Order progress — Step 1 of 4</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
