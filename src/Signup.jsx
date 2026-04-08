import { useState } from "react";
import { supabase } from "./supabase";

// FIX: Field defined OUTSIDE component so it never gets recreated on re-render
function Field({ label, error, children }) {
    return (
        <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: error ? "#fca5a5" : "rgba(255,255,255,0.5)", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
            {children}
            {error && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#fca5a5" }}>{error}</p>}
        </div>
    );
}

export default function Signup({ onSignup, onLogin }) {
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
    const pwColor = ["", "#ef4444", "#f59e0b", "#3b82f6", "#22c55e"][pwS];

    function validate() {
        const e = {};
        if (!businessName.trim()) e.businessName = "Business name is required";
        if (!phone.trim()) e.phone = "Phone number is required";
        if (!email.trim()) e.email = "Email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email address";
        if (!password) e.password = "Password is required";
        else {
            const issues = [];
            if (password.length < 8) issues.push("at least 8 characters");
            if (!/[A-Z]/.test(password)) issues.push("one uppercase letter");
            if (!/[0-9]/.test(password)) issues.push("one number");
            if (issues.length > 0) e.password = "Password needs: " + issues.join(", ");
        }
        if (!confirmPassword) e.confirmPassword = "Please confirm your password";
        else if (password !== confirmPassword) e.confirmPassword = "Passwords do not match";
        setFieldErrors(e);
        return Object.keys(e).length === 0;
    }

    async function handleSignup() {
        if (!validate()) return;
        setLoading(true); setError("");

        const { data: ep } = await supabase.from("businesses").select("id").eq("phone", phone.trim()).limit(1);
        if (ep && ep.length > 0) { setFieldErrors(p => ({ ...p, phone: "This phone number is already in use" })); setLoading(false); return; }

        const { data: en } = await supabase.from("businesses").select("id").eq("name", businessName.trim()).limit(1);
        if (en && en.length > 0) { setFieldErrors(p => ({ ...p, businessName: "This business name is already taken" })); setLoading(false); return; }

        const { data, error: ae } = await supabase.auth.signUp({ email, password });
        if (ae) {
            if (ae.message.toLowerCase().includes("already")) setFieldErrors(p => ({ ...p, email: "This email is already in use" }));
            else setError(ae.message);
            setLoading(false); return;
        }

        const { error: be } = await supabase.from("businesses").insert([{ name: businessName.trim(), phone: phone.trim(), user_id: data.user.id, status: "pending" }]);
        if (be) {
            if (be.message.includes("phone")) setFieldErrors(p => ({ ...p, phone: "This phone number is already in use" }));
            else if (be.message.includes("name")) setFieldErrors(p => ({ ...p, businessName: "This business name is already taken" }));
            else setError(be.message);
            setLoading(false); return;
        }

        await supabase.from("registered_businesses").insert([{ business_name: businessName.trim(), description: "" }]).catch(() => { });
        onSignup(data.user);
        setLoading(false);
    }

    const clr = (key) => setFieldErrors(p => ({ ...p, [key]: "" }));

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
            <style>{`
                * { box-sizing:border-box; margin:0; padding:0; }
                @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
                @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:0.7} }
                @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
                .ai { width:100%; padding:13px 16px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:10px; font-size:14px; color:white; outline:none; transition:border-color 0.2s; font-family:'DM Sans',sans-serif; }
                .ai::placeholder { color:rgba(255,255,255,0.3); }
                .ai:focus { border-color:#22c55e; background:rgba(34,197,94,0.05); }
                .ai.err { border-color:#ef4444!important; background:rgba(239,68,68,0.05); }
                .ab { width:100%; padding:14px; background:#16a34a; color:white; border:none; border-radius:10px; font-size:15px; font-weight:600; cursor:pointer; transition:all 0.2s; font-family:'DM Sans',sans-serif; }
                .ab:hover:not(:disabled) { background:#22c55e; transform:translateY(-1px); box-shadow:0 8px 24px rgba(34,197,94,0.35); }
                .ab:disabled { opacity:0.6; cursor:not-allowed; }
                .rp { display:flex; }
                @media(max-width:768px){.rp{display:none!important;}}
            `}</style>

            <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'DM Sans',sans-serif", backgroundColor: "#080f0a" }}>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px", overflowY: "auto" }}>
                    <div style={{ width: "100%", maxWidth: "420px", animation: "fadeUp 0.5s ease both", padding: "20px 0" }}>
                        <div style={{ marginBottom: "36px" }}>
                            <div style={{ fontSize: "22px", fontWeight: "700", color: "white", letterSpacing: "-0.5px", marginBottom: "4px" }}>Delivagh<span style={{ color: "#22c55e" }}>.</span></div>
                            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", fontWeight: "300" }}>Vendor Portal</p>
                        </div>
                        <h1 style={{ fontSize: "26px", fontWeight: "700", color: "white", letterSpacing: "-0.5px", marginBottom: "6px", fontFamily: "'Playfair Display',serif" }}>Create your account</h1>
                        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", marginBottom: "28px", fontWeight: "300" }}>Start receiving WhatsApp orders today</p>

                        {error && <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", padding: "12px 14px", borderRadius: "10px", marginBottom: "20px", fontSize: "13px", animation: "shake 0.4s ease" }}>{error}</div>}

                        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "22px" }}>
                            <Field label="Business Name" error={fieldErrors.businessName}>
                                <input className={`ai${fieldErrors.businessName ? " err" : ""}`} type="text" value={businessName} onChange={e => { setBusinessName(e.target.value); clr("businessName"); }} placeholder="e.g. Mama's Kitchen" />
                            </Field>
                            <Field label="Business Phone" error={fieldErrors.phone}>
                                <input className={`ai${fieldErrors.phone ? " err" : ""}`} type="text" value={phone} onChange={e => { setPhone(e.target.value); clr("phone"); }} placeholder="0244000000" />
                            </Field>
                            <Field label="Email Address" error={fieldErrors.email}>
                                <input className={`ai${fieldErrors.email ? " err" : ""}`} type="email" value={email} onChange={e => { setEmail(e.target.value); clr("email"); }} placeholder="your@email.com" />
                            </Field>
                            <Field label="Password" error={fieldErrors.password}>
                                <div style={{ position: "relative" }}>
                                    <input className={`ai${fieldErrors.password ? " err" : ""}`} type={showPass ? "text" : "password"} value={password} onChange={e => { setPassword(e.target.value); clr("password"); }} placeholder="Min. 8 chars, 1 uppercase, 1 number" style={{ paddingRight: "54px" }} />
                                    <button onClick={() => setShowPass(p => !p)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: "12px", fontFamily: "'DM Sans',sans-serif", fontWeight: "500" }}>{showPass ? "Hide" : "Show"}</button>
                                </div>
                                {password.length > 0 && <>
                                    <div style={{ display: "flex", gap: "4px", marginTop: "8px", marginBottom: "4px" }}>
                                        {[1, 2, 3, 4].map(n => <div key={n} style={{ flex: 1, height: "3px", borderRadius: "2px", backgroundColor: n <= pwS ? pwColor : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />)}
                                    </div>
                                    <p style={{ margin: "0 0 6px", fontSize: "11px", color: pwColor, fontWeight: "500" }}>{pwLabel}</p>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                        {[{ l: "8+ chars", ok: password.length >= 8 }, { l: "Uppercase", ok: /[A-Z]/.test(password) }, { l: "Number", ok: /[0-9]/.test(password) }].map(r => (
                                            <span key={r.l} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "999px", backgroundColor: r.ok ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)", color: r.ok ? "#86efac" : "rgba(255,255,255,0.3)", border: `1px solid ${r.ok ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}`, transition: "all 0.2s" }}>{r.ok ? "✓ " : ""}{r.l}</span>
                                        ))}
                                    </div>
                                </>}
                            </Field>
                            <Field label="Confirm Password" error={fieldErrors.confirmPassword}>
                                <div style={{ position: "relative" }}>
                                    <input className={`ai${fieldErrors.confirmPassword ? " err" : ""}`} type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); clr("confirmPassword"); }} placeholder="Re-enter your password" style={{ paddingRight: "80px", borderColor: confirmPassword && confirmPassword === password && !fieldErrors.confirmPassword ? "#22c55e" : undefined }} />
                                    <div style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: "8px" }}>
                                        {confirmPassword && confirmPassword === password && <span style={{ color: "#22c55e", fontSize: "14px" }}>✓</span>}
                                        <button onClick={() => setShowConfirm(p => !p)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", fontSize: "12px", fontFamily: "'DM Sans',sans-serif", fontWeight: "500" }}>{showConfirm ? "Hide" : "Show"}</button>
                                    </div>
                                </div>
                            </Field>
                        </div>

                        <button className="ab" onClick={handleSignup} disabled={loading}>{loading ? "Creating account..." : "Create Account"}</button>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", marginTop: "18px" }}>
                            {["Free to start", "GHS 1/order", "No monthly fees"].map((t, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <span style={{ color: "#22c55e", fontSize: "10px" }}>✓</span>
                                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>{t}</span>
                                </div>
                            ))}
                        </div>

                        <p style={{ textAlign: "center", marginTop: "16px", fontSize: "14px", color: "rgba(255,255,255,0.35)" }}>
                            Already have an account?{" "}<span onClick={onLogin} style={{ color: "#22c55e", fontWeight: "600", cursor: "pointer" }}>Sign in</span>
                        </p>
                    </div>
                </div>

                <div className="rp" style={{ flex: 1, position: "relative", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#052e16 0%,#064e3b 40%,#065f46 70%,#047857 100%)" }} />
                    <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(ellipse at 30% 20%,rgba(34,197,94,0.15) 0%,transparent 60%),radial-gradient(ellipse at 80% 80%,rgba(16,185,129,0.12) 0%,transparent 50%)", animation: "shimmer 4s ease-in-out infinite" }} />
                    <div style={{ position: "relative", zIndex: 1, padding: "60px", maxWidth: "480px" }}>
                        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(32px,3.5vw,48px)", fontWeight: "800", color: "white", lineHeight: 1.2, marginBottom: "24px", letterSpacing: "-1px" }}>Your restaurant,<br /><em style={{ fontStyle: "normal", color: "#86efac" }}>on WhatsApp.</em></h2>
                        <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: "40px", fontWeight: "300" }}>Join food businesses across Ghana using DelivaGH to automate their WhatsApp ordering.</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            {[{ icon: "🍽️", title: "Add your menu", desc: "Add items with prices in minutes" }, { icon: "💬", title: "Customers order on WhatsApp", desc: "AI bot handles ordering 24/7" }, { icon: "📊", title: "Manage from dashboard", desc: "Accept, track, deliver — all in one place" }].map((s, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "14px", padding: "16px", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", backgroundColor: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>{s.icon}</div>
                                    <div><p style={{ margin: "0 0 3px", fontSize: "13px", fontWeight: "600", color: "white" }}>{s.title}</p><p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>{s.desc}</p></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}