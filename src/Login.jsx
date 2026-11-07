import React, { useState } from "react";
import { supabase } from "./supabase";
import { normalizeEmail } from "./authValidators";
import "./ui/dash.css";

const redirectUrl = import.meta.env.VITE_SITE_URL || (typeof window !== "undefined" ? window.location.origin + "/" : undefined);

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

    const googleIcon = (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.283 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.591 6.115 29.018 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.591 6.115 29.018 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c5.265 0 9.61-3.527 11.191-8.36l6.57 5.045C40.556 39.661 32.831 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
    );

    return (
        <div className="dx" data-theme="light">
            <div className="dx-auth">
                <main className="dx-auth-form">
                    <div>
                        <div className="dx-wordmark" style={{ marginBottom: 40 }}>Delivagh<i>.</i><small>For shops</small></div>
                        {forgotMode ? (
                            <div className="dx-stack" style={{ gap: 14 }}>
                                <div>
                                    <h1 className="dx-title">Reset your password</h1>
                                    <p className="dx-sub">We'll email you a link to set a new one.</p>
                                </div>
                                {forgotSent ? (
                                    <>
                                        <p className="dx-msg is-ok" role="status">Check your email. We sent a reset link to <strong>{forgotEmail}</strong>.</p>
                                        <button type="button" className="dx-btn is-lg is-block" onClick={() => { setForgotMode(false); setForgotSent(false); setForgotEmail(""); }}>Back to sign in</button>
                                    </>
                                ) : (
                                    <form className="dx-stack" style={{ gap: 12 }} onSubmit={async e => {
                                        e.preventDefault();
                                        if (!forgotEmail.trim()) return;
                                        setForgotLoading(true);
                                        setError("");
                                        const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
                                            redirectTo: 'https://delivagh.app/reset-password'
                                        });
                                        setForgotLoading(false);
                                        if (!error) setForgotSent(true);
                                        else setError(error.message);
                                    }}>
                                        <label className="dx-field"><span className="dx-label">Email</span>
                                            <input className="dx-input" type="email" autoComplete="email" autoFocus value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@example.com" /></label>
                                        {error && <p className="dx-msg is-error" role="alert">{error}</p>}
                                        <button type="submit" className="dx-btn is-primary is-lg is-block" disabled={forgotLoading}>{forgotLoading ? "Sending…" : "Send reset link"}</button>
                                        <button type="button" className="dx-btn is-ghost is-block" onClick={() => { setForgotMode(false); setForgotEmail(""); setError(""); }}>Back to sign in</button>
                                    </form>
                                )}
                            </div>
                        ) : (
                            <div className="dx-stack" style={{ gap: 16 }}>
                                <div>
                                    <h1 className="dx-title">Welcome back</h1>
                                    <p className="dx-sub">Sign in to see your orders.</p>
                                </div>
                                {notice && <p className="dx-msg is-attn" role="status">{notice}</p>}
                                {error && <p className="dx-msg is-error" role="alert">{error}</p>}
                                {resendMsg && <p className="dx-msg is-ok" role="status">{resendMsg}</p>}
                                <button type="button" className="dx-btn is-lg is-block" onClick={handleGoogle}>{googleIcon}Continue with Google</button>
                                <div className="dx-or">or with email</div>
                                <form className="dx-stack" style={{ gap: 14 }} onSubmit={e => { e.preventDefault(); if (!loading) handleLogin(); }}>
                                    <label className="dx-field"><span className="dx-label">Email</span>
                                        <input className="dx-input" type="email" autoComplete="email" value={email} onChange={e => { setShowResendButton(false); setEmail(e.target.value); }} placeholder="you@example.com" /></label>
                                    <div className="dx-field">
                                        <div className="dx-spread">
                                            <label className="dx-label" htmlFor="login-password">Password</label>
                                            <button type="button" className="dx-link" onClick={() => { setForgotMode(true); setError(""); }}>Forgot password?</button>
                                        </div>
                                        <div className="dx-pass">
                                            <input id="login-password" className="dx-input" type={showPass ? "text" : "password"} autoComplete="current-password" value={password} onChange={e => { setShowResendButton(false); setPassword(e.target.value); }} />
                                            <button type="button" onClick={() => setShowPass(p => !p)} aria-label={showPass ? "Hide password" : "Show password"}>{showPass ? "Hide" : "Show"}</button>
                                        </div>
                                    </div>
                                    <button type="submit" className="dx-btn is-primary is-lg is-block" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
                                </form>
                                {showResendButton && (
                                    <button type="button" className="dx-btn is-block" onClick={handleResendConfirmation} disabled={resendLoading}>{resendLoading ? "Sending…" : "Resend confirmation email"}</button>
                                )}
                                <p className="dx-hint" style={{ textAlign: "center", marginTop: 8, fontSize: 14 }}>New to Delivagh? <a className="dx-link" style={{ fontSize: 14 }} href="/signup">Create a shop account</a></p>
                            </div>
                        )}
                    </div>
                </main>
                <aside className="dx-auth-side" aria-hidden="true">
                    <h2>Your customers order on WhatsApp. You see it here.</h2>
                    <p>The bot takes the order, works out the total and asks how they'll pay. You accept it with one tap.</p>
                    <div className="dx-phone">
                        <div className="who">A customer and your shop's bot</div>
                        <div className="msg out">2 jollof and 1 sobolo please<small>12:41</small></div>
                        <div className="msg in">Added 2× Jollof Rice with Chicken and 1× Sobolo. That's GHS 100.00. Pickup or delivery?<small>12:41</small></div>
                        <div className="msg out">Delivery to East Legon, no pepper on one<small>12:42</small></div>
                        <div className="msg in">Noted. Delivery is GHS 5.00, so your total is GHS 105.00. Pay with MoMo or cash?<small>12:42</small></div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
