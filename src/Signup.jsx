import { useState } from "react";
import { supabase } from "./supabase";

export default function Signup({ onSignup, onLogin }) {
    const [businessName, setBusinessName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSignup() {
        setLoading(true);
        setError("");
        const { data, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) { setError(authError.message); setLoading(false); return; }
        const { error: bizError } = await supabase.from("businesses").insert([{ name: businessName, phone, user_id: data.user.id }]);
        if (bizError) { setError(bizError.message); setLoading(false); return; }
        onSignup(data.user);
        setLoading(false);
    }

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ backgroundColor: "#1e293b", padding: "48px", borderRadius: "20px", width: "100%", maxWidth: "400px", boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}>
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                    <img src="/logo.png" alt="DelivaGH" style={{ height: "40px", marginBottom: "16px", filter: "brightness(0) invert(1)" }} />
                    <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>Create your business account</p>
                </div>

                {error && (
                    <div style={{ backgroundColor: "#450a0a", color: "#fca5a5", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" }}>
                        {error}
                    </div>
                )}

                {[
                    { label: "Business Name", value: businessName, set: setBusinessName, placeholder: "e.g. Mama's Kitchen", type: "text" },
                    { label: "Business Phone", value: phone, set: setPhone, placeholder: "+233XXXXXXXXX", type: "text" },
                    { label: "Email", value: email, set: setEmail, placeholder: "your@email.com", type: "email" },
                    { label: "Password", value: password, set: setPassword, placeholder: "password", type: "password" },
                ].map(field => (
                    <div key={field.label} style={{ marginBottom: "16px" }}>
                        <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#94a3b8", marginBottom: "6px" }}>{field.label}</label>
                        <input type={field.type} value={field.value} onChange={e => field.set(e.target.value)} placeholder={field.placeholder}
                            style={{ width: "100%", padding: "12px 14px", border: "1px solid #334155", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box", backgroundColor: "#0f172a", color: "white" }} />
                    </div>
                ))}

                <button onClick={handleSignup} disabled={loading}
                    style={{ width: "100%", backgroundColor: "#16a34a", color: "white", padding: "12px", borderRadius: "8px", border: "none", fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, marginTop: "8px" }}>
                    {loading ? "Creating account..." : "Create Account"}
                </button>

                <p style={{ textAlign: "center", marginTop: "20px", fontSize: "14px", color: "#64748b" }}>
                    Already have an account?{" "}
                    <span onClick={onLogin} style={{ color: "#ef4444", fontWeight: "600", cursor: "pointer" }}>Sign in</span>
                </p>
            </div>
        </div>
    );
}