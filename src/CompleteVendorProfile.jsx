import React, { useState } from "react";
import { supabase } from "./supabase";
import { handleAuthError } from "./authUtils";
import { normalizeGhanaPhone, validateBusinessName } from "./authValidators";

export default function CompleteVendorProfile({ user, onRegistered }) {
    const [businessName, setBusinessName] = useState("");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});

    async function handleSubmit() {
        const e = {};
        const bn = validateBusinessName(businessName);
        if (!bn.ok) e.businessName = bn.message;
        const ph = normalizeGhanaPhone(phone);
        if (ph.error) e.phone = ph.error;
        setFieldErrors(e);
        if (Object.keys(e).length) return;

        setLoading(true);
        setError("");
        const name = bn.value;

        const { data: ep } = await supabase.from("businesses").select("id").eq("phone", ph.display).limit(1);
        if (ep && ep.length > 0) {
            setFieldErrors(p => ({ ...p, phone: "This phone number is already in use" }));
            setLoading(false);
            return;
        }
        const { data: en } = await supabase.from("businesses").select("id").eq("name", name).limit(1);
        if (en && en.length > 0) {
            setFieldErrors(p => ({ ...p, businessName: "This business name is already taken" }));
            setLoading(false);
            return;
        }

        const { error: ins } = await supabase.from("businesses").insert([{
            name,
            phone: ph.display,
            user_id: user.id,
            status: "pending",
        }]);

        if (ins) {
            if (await handleAuthError(ins)) return;
            setError(ins.message);
            setLoading(false);
            return;
        }

        await supabase.auth.updateUser({
            data: { pending_business_name: null, pending_business_phone: null },
        });

        onRegistered();
        setLoading(false);
    }

    const clr = (key) => setFieldErrors(p => ({ ...p, [key]: "" }));

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080f0a", padding: "24px", fontFamily: "'DM Sans',sans-serif" }}>
                <div style={{ width: "100%", maxWidth: "420px", background: "#101b14", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "16px", padding: "28px" }}>
                    <div style={{ fontSize: "22px", fontWeight: "800", color: "white", marginBottom: "4px", fontFamily: "'Playfair Display',serif" }}>Delivagh<span style={{ color: "#22c55e" }}>.</span></div>
                    <p style={{ margin: "0 0 20px", fontSize: "12px", color: "rgba(236,253,243,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Finish setup</p>
                    <h1 style={{ margin: "0 0 8px", fontSize: "22px", color: "#ecfdf3", fontFamily: "'Playfair Display',serif" }}>Add your business</h1>
                    <p style={{ margin: "0 0 22px", fontSize: "14px", color: "rgba(236,253,243,0.72)", lineHeight: 1.55 }}>
                        You signed in with Google. Enter your public business name and WhatsApp business line so we can finish your vendor profile.
                    </p>
                    {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", padding: "12px", borderRadius: "10px", marginBottom: "16px", fontSize: "13px" }}>{error}</div>}
                    <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: fieldErrors.businessName ? "#fca5a5" : "rgba(255,255,255,0.5)", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Business name</label>
                    <input value={businessName} onChange={e => { setBusinessName(e.target.value); clr("businessName"); }} placeholder="e.g. Mama's Kitchen" style={{ width: "100%", padding: "13px 16px", marginBottom: fieldErrors.businessName ? "6px" : "14px", background: "rgba(255,255,255,0.06)", border: `1px solid ${fieldErrors.businessName ? "#ef4444" : "rgba(255,255,255,0.1)"}`, borderRadius: "10px", fontSize: "14px", color: "white", outline: "none", boxSizing: "border-box" }} />
                    {fieldErrors.businessName && <p style={{ margin: "0 0 14px", fontSize: "12px", color: "#fca5a5" }}>{fieldErrors.businessName}</p>}

                    <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: fieldErrors.phone ? "#fca5a5" : "rgba(255,255,255,0.5)", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Business phone (Ghana)</label>
                    <input value={phone} onChange={e => { setPhone(e.target.value); clr("phone"); }} placeholder="0244000000" type="tel" style={{ width: "100%", padding: "13px 16px", marginBottom: fieldErrors.phone ? "6px" : "18px", background: "rgba(255,255,255,0.06)", border: `1px solid ${fieldErrors.phone ? "#ef4444" : "rgba(255,255,255,0.1)"}`, borderRadius: "10px", fontSize: "14px", color: "white", outline: "none", boxSizing: "border-box" }} />
                    {fieldErrors.phone && <p style={{ margin: "0 0 18px", fontSize: "12px", color: "#fca5a5" }}>{fieldErrors.phone}</p>}

                    <button type="button" onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "14px", background: "#16a34a", color: "white", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.65 : 1 }}>
                        {loading ? "Saving..." : "Submit for approval"}
                    </button>
                </div>
            </div>
        </>
    );
}
