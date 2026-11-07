import React, { useState } from "react";
import { supabase } from "./supabase";
import {
    normalizeGhanaPhone,
    validateBusinessName,
    normalizeEmail,
    validatePassword,
} from "./authValidators";
import "./ui/dash.css";

function Field({ label, error, children }) {
    return (
        <div className="dx-field">
            <span className="dx-label" style={error ? { color: "var(--danger)" } : undefined}>{label}</span>
            {children}
            {error && <span className="dx-hint danger-text" role="alert">{error}</span>}
        </div>
    );
}

export default function Signup() {
    const [businessName, setBusinessName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [step, setStep] = useState("form"); // 'form' | 'phone'
    const [otp, setOtp] = useState("");
    const [phoneE164, setPhoneE164] = useState("");
    const [phoneDisplay, setPhoneDisplay] = useState("");
    const [smsHint, setSmsHint] = useState("");

    function getPasswordStrength(p) {
        let s = 0;
        if (p.length >= 8) s++;
        if (/[A-Z]/.test(p)) s++;
        if (/[0-9]/.test(p)) s++;
        if (/[^A-Za-z0-9]/.test(p)) s++;
        return s;
    }
    const pwS = getPasswordStrength(password);
    const pwLabel = ["", "Weak", "Fair", "Good", "Strong"][pwS];

    const redirectUrl = import.meta.env.VITE_SITE_URL || (typeof window !== "undefined" ? window.location.origin + "/" : undefined);

    function validate() {
        const e = {};
        const bn = validateBusinessName(businessName);
        if (!bn.ok) e.businessName = bn.message;

        const ph = normalizeGhanaPhone(phone);
        if (ph.error) e.phone = ph.error;

        const em = normalizeEmail(email);
        if (!em.ok) e.email = em.message;

        const pw = validatePassword(password);
        if (!pw.ok) e.password = pw.message;

        if (!confirmPassword) e.confirmPassword = "Please confirm your password";
        else if (password !== confirmPassword) e.confirmPassword = "Passwords do not match";

        setFieldErrors(e);
        return Object.keys(e).length === 0;
    }

    async function insertBusinessRow(userId, name, phoneLocal) {
        const { error: be } = await supabase.from("businesses").insert([{ name, phone: phoneLocal, user_id: userId, status: "pending" }]);
        if (be) console.error('[signup] Supabase insert error:', be.message, be.details, be.hint);
        return be;
    }

    async function finishSignupAfterVerified({ userId, name, phoneLocal }) {
        console.log('[signup] Inserting business row for userId:', userId, 'name:', name);
        const be = await insertBusinessRow(userId, name, phoneLocal);
        if (be) {
            console.error('[signup] Business insert failed:', be);
            if (be.message.includes("phone")) setFieldErrors(p => ({ ...p, phone: "This phone number is already in use" }));
            else if (be.message.includes("name")) setFieldErrors(p => ({ ...p, businessName: "This business name is already taken" }));
            else setError(be.message);
            return false;
        }
        await supabase.auth.updateUser({
            data: { pending_business_name: null, pending_business_phone: null },
        });
        window.location.replace('/onboarding');
        return true;
    }

    async function handleGoogleSignup() {
        setError("");
        const { error: oerr } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: redirectUrl },
        });
        if (oerr) setError(oerr.message);
    }

    async function sendPhoneOtp(e164) {
        const { error: uerr } = await supabase.auth.updateUser({ phone: e164 });
        if (uerr) throw uerr;
    }

    async function handleSignup() {
        if (!validate()) return;
        setLoading(true);
        setError("");
        setSmsHint("");

        const bn = validateBusinessName(businessName).value;
        const ph = normalizeGhanaPhone(phone);
        const em = normalizeEmail(email).value;

        const { data: ep } = await supabase.from("businesses").select("id").eq("phone", ph.display).limit(1);
        if (ep && ep.length > 0) {
            setFieldErrors(p => ({ ...p, phone: "This phone number is already in use" }));
            setLoading(false);
            return;
        }

        const { data: en } = await supabase.from("businesses").select("id").eq("name", bn).limit(1);
        if (en && en.length > 0) {
            setFieldErrors(p => ({ ...p, businessName: "This business name is already taken" }));
            setLoading(false);
            return;
        }

        const { data, error: ae } = await supabase.auth.signUp({
            email: em,
            password,
            options: {
                emailRedirectTo: redirectUrl,
                data: {
                    pending_business_name: bn,
                    pending_business_phone: ph.display,
                },
            },
        });

        if (ae) {
            if (ae.message.toLowerCase().includes("already")) setFieldErrors(p => ({ ...p, email: "This email is already in use" }));
            else setError(ae.message);
            setLoading(false);
            return;
        }

        if (!data?.user?.id) {
            setError("Could not create account. Please try again.");
            setLoading(false);
            return;
        }

        const session = data.session;

        if (!session) {
            window.location.replace('/onboarding');
            setLoading(false);
            return;
        }

        setPhoneE164(ph.e164);
        setPhoneDisplay(ph.display);

        try {
            await sendPhoneOtp(ph.e164);
            setStep("phone");
            setSmsHint("Enter the code we sent to your phone (SMS).");
        } catch (smsErr) {
            console.warn("Phone OTP not sent:", smsErr);
            setSmsHint("SMS verification is unavailable (check Supabase Phone provider). You can continue — your number is still saved on your profile.");
            const ok = await finishSignupAfterVerified({ userId: data.user.id, name: bn, phoneLocal: ph.display });
            if (ok) {
                setLoading(false);
                return;
            }
        }

        setLoading(false);
    }

    async function handleVerifyOtp() {
        const code = otp.replace(/\D/g, "");
        if (code.length < 6) {
            setError("Enter the 6-digit code from SMS");
            return;
        }
        setLoading(true);
        setError("");
        const { error: verr } = await supabase.auth.verifyOtp({
            phone: phoneE164,
            token: code,
            type: "sms",
        });
        if (verr) {
            setError(verr.message);
            setLoading(false);
            return;
        }
        const { data: u } = await supabase.auth.getUser();
        const uid = u?.user?.id;
        if (!uid) {
            setError("Session lost. Please sign in again.");
            setLoading(false);
            return;
        }
        const bn = validateBusinessName(businessName).value;
        const ok = await finishSignupAfterVerified({ userId: uid, name: bn, phoneLocal: phoneDisplay });
        setLoading(false);
        if (ok) setStep("form");
    }

    async function skipPhoneAndFinish() {
        setLoading(true);
        setError("");
        const { data: u } = await supabase.auth.getUser();
        const uid = u?.user?.id;
        if (!uid) {
            setError("Session lost. Please sign in again.");
            setLoading(false);
            return;
        }
        const bn = validateBusinessName(businessName).value;
        const ok = await finishSignupAfterVerified({ userId: uid, name: bn, phoneLocal: phoneDisplay });
        setLoading(false);
        if (ok) setStep("form");
    }

    const clr = (key) => setFieldErrors(p => ({ ...p, [key]: "" }));
    const tone = ["", "var(--danger)", "var(--attn)", "var(--accent)", "var(--accent)"][pwS];

    return (
        <div className="dx" data-theme="light">
            <div className="dx-auth">
                <main className="dx-auth-form">
                    <div>
                        <div className="dx-wordmark" style={{ marginBottom: 36 }}>Delivagh<i>.</i><small>For shops</small></div>

                        {step === "phone" ? (
                            <form className="dx-stack" style={{ gap: 14 }} onSubmit={e => { e.preventDefault(); if (!loading) handleVerifyOtp(); }}>
                                <div>
                                    <h1 className="dx-title">Check your phone</h1>
                                    <p className="dx-sub">{smsHint || `We sent a code to ${phoneDisplay}.`}</p>
                                </div>
                                {error && <p className="dx-msg is-error" role="alert">{error}</p>}
                                <label className="dx-field"><span className="dx-label">6-digit code</span>
                                    <input className="dx-input num" inputMode="numeric" autoComplete="one-time-code" autoFocus value={otp} onChange={e => setOtp(e.target.value)}
                                        style={{ letterSpacing: "0.3em", textAlign: "center", fontSize: 20, height: 52 }} /></label>
                                <button type="submit" className="dx-btn is-primary is-lg is-block" disabled={loading}>{loading ? "Checking…" : "Verify and continue"}</button>
                                <button type="button" className="dx-btn is-ghost is-block" onClick={skipPhoneAndFinish} disabled={loading}>Skip for now</button>
                            </form>
                        ) : (
                            <div className="dx-stack" style={{ gap: 16 }}>
                                <div>
                                    <h1 className="dx-title">Put your shop on WhatsApp</h1>
                                    <p className="dx-sub">Create your account. We review new shops before they go live.</p>
                                </div>
                                {error && <p className="dx-msg is-error" role="alert">{error}</p>}
                                <button type="button" className="dx-btn is-lg is-block" onClick={handleGoogleSignup}>
                                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.283 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.591 6.115 29.018 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.591 6.115 29.018 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c5.265 0 9.61-3.527 11.191-8.36l6.57 5.045C40.556 39.661 32.831 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
                                    Continue with Google
                                </button>
                                <div className="dx-or">or with email</div>
                                <form className="dx-stack" style={{ gap: 14 }} noValidate onSubmit={e => { e.preventDefault(); if (!loading) handleSignup(); }}>
                                    <Field label="Shop name" error={fieldErrors.businessName}>
                                        <input className={"dx-input" + (fieldErrors.businessName ? " is-invalid" : "")} type="text" value={businessName} onChange={e => { setBusinessName(e.target.value); clr("businessName"); }} placeholder="e.g. Auntie Esi's Kitchen" autoComplete="organization" />
                                    </Field>
                                    <Field label="Shop phone number" error={fieldErrors.phone}>
                                        <input className={"dx-input num" + (fieldErrors.phone ? " is-invalid" : "")} type="tel" inputMode="tel" value={phone} onChange={e => { setPhone(e.target.value); clr("phone"); }} placeholder="024 400 0000" autoComplete="tel" />
                                    </Field>
                                    <Field label="Email" error={fieldErrors.email}>
                                        <input className={"dx-input" + (fieldErrors.email ? " is-invalid" : "")} type="email" value={email} onChange={e => { setEmail(e.target.value); clr("email"); }} placeholder="you@example.com" autoComplete="email" />
                                    </Field>
                                    <Field label="Password" error={fieldErrors.password}>
                                        <div className="dx-pass">
                                            <input className={"dx-input" + (fieldErrors.password ? " is-invalid" : "")} type={showPass ? "text" : "password"} value={password} onChange={e => { setPassword(e.target.value); clr("password"); }} autoComplete="new-password" aria-describedby="pw-rules" />
                                            <button type="button" onClick={() => setShowPass(p => !p)} aria-label={showPass ? "Hide password" : "Show password"}>{showPass ? "Hide" : "Show"}</button>
                                        </div>
                                        <div id="pw-rules" className="dx-row" style={{ gap: 10, marginTop: 2 }}>
                                            {password.length > 0 && <span style={{ fontSize: 12.5, fontWeight: 600, color: tone }}>{pwLabel}</span>}
                                            {[{ l: "8+ characters", ok: password.length >= 8 }, { l: "a capital letter", ok: /[A-Z]/.test(password) }, { l: "a number", ok: /[0-9]/.test(password) }].map(r => (
                                                <span key={r.l} className={r.ok ? "accent-text" : "faint"} style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                                    {r.ok ? "✓" : "·"} {r.l}
                                                </span>
                                            ))}
                                        </div>
                                    </Field>
                                    <Field label="Confirm password" error={fieldErrors.confirmPassword}>
                                        <div className="dx-pass">
                                            <input className={"dx-input" + (fieldErrors.confirmPassword ? " is-invalid" : "")} type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); clr("confirmPassword"); }} autoComplete="new-password" />
                                            <button type="button" onClick={() => setShowConfirm(p => !p)} aria-label={showConfirm ? "Hide password" : "Show password"}>{showConfirm ? "Hide" : "Show"}</button>
                                        </div>
                                        {confirmPassword && confirmPassword === password && !fieldErrors.confirmPassword && <span className="accent-text" style={{ fontSize: 12.5 }}>✓ Passwords match</span>}
                                    </Field>
                                    <button type="submit" className="dx-btn is-primary is-lg is-block" disabled={loading}>{loading ? "Creating your account…" : "Create account"}</button>
                                </form>
                            </div>
                        )}

                        <p className="dx-hint" style={{ textAlign: "center", marginTop: 22, fontSize: 14 }}>
                            Already have an account? <a className="dx-link" style={{ fontSize: 14 }} href="/login">Sign in</a>
                        </p>
                        <p className="dx-hint" style={{ textAlign: "center", marginTop: 10 }}>
                            <a className="dx-link" style={{ color: "var(--ink-3)", fontWeight: 500, fontSize: 12.5 }} href="/terms">Terms</a> · <a className="dx-link" style={{ color: "var(--ink-3)", fontWeight: 500, fontSize: 12.5 }} href="/privacy">Privacy</a>
                        </p>
                    </div>
                </main>

                <aside className="dx-auth-side" aria-hidden="true">
                    <h2>Three steps to your first WhatsApp order.</h2>
                    <ol className="dx-steps">
                        <li><strong>Add your menu</strong><span>Type it in, or upload a photo of your printed menu.</span></li>
                        <li><strong>Share your order link</strong><span>Customers tap it and WhatsApp opens, ready to order.</span></li>
                        <li><strong>Accept orders here</strong><span>The bot takes each order and payment choice. You tap Accept.</span></li>
                    </ol>
                </aside>
            </div>
        </div>
    );
}
