import React, { useState } from "react";
import { supabase } from "./supabase";
import { handleAuthError } from "./authUtils";
import { normalizeGhanaPhone, validateBusinessName } from "./authValidators";
import "./ui/dash.css";

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
        <div className="dx dx-center" data-theme="light">
            <div className="dx-card">
                <div className="dx-wordmark">Delivagh<i>.</i><small>Last step</small></div>
                <form className="dx-stack" onSubmit={e => { e.preventDefault(); if (!loading) handleSubmit(); }} noValidate>
                    <div>
                        <h1 className="dx-title-sm">Add your shop</h1>
                        <p className="dx-sub">You signed in with Google. Tell us your shop's name and WhatsApp number so we can review your account.</p>
                    </div>
                    {error && <p className="dx-msg is-error" role="alert">{error}</p>}
                    <label className="dx-field">
                        <span className="dx-label">Shop name</span>
                        <input className={`dx-input${fieldErrors.businessName ? " is-invalid" : ""}`} value={businessName} onChange={e => { setBusinessName(e.target.value); clr("businessName"); }} placeholder="e.g. Mama's Kitchen" autoComplete="organization" aria-invalid={!!fieldErrors.businessName} />
                        {fieldErrors.businessName && <span className="dx-hint danger-text">{fieldErrors.businessName}</span>}
                    </label>
                    <label className="dx-field">
                        <span className="dx-label">WhatsApp number for the shop</span>
                        <input className={`dx-input${fieldErrors.phone ? " is-invalid" : ""}`} value={phone} onChange={e => { setPhone(e.target.value); clr("phone"); }} placeholder="024 400 0000" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={!!fieldErrors.phone} />
                        {fieldErrors.phone ? <span className="dx-hint danger-text">{fieldErrors.phone}</span> : <span className="dx-hint">A Ghana number. We'll use it to reach you about orders.</span>}
                    </label>
                    <button type="submit" className="dx-btn is-primary is-lg is-block" disabled={loading}>
                        {loading ? "Saving…" : "Send for approval"}
                    </button>
                </form>
            </div>
        </div>
    );
}
