import { useState } from "react";
import { supabase } from "./supabase";

export default function Signup({ onSignup }) {
    const [businessName, setBusinessName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSignup() {
        setLoading(true);
        setError("");

        // Create auth user
        const { data, error: authError } = await supabase.auth.signUp({
            email,
            password
        });

        if (authError) {
            setError(authError.message);
            setLoading(false);
            return;
        }

        // Create business profile
        const { error: bizError } = await supabase
            .from("businesses")
            .insert([{
                name: businessName,
                phone: phone,
                user_id: data.user.id
            }]);

        if (bizError) {
            setError(bizError.message);
            setLoading(false);
            return;
        }

        onSignup(data.user);
        setLoading(false);
    }

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ backgroundColor: "white", padding: "48px", borderRadius: "16px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", width: "100%", maxWidth: "400px" }}>
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                    <h1 style={{ color: "#16a34a", fontSize: "28px", margin: 0 }}>DelivaGH</h1>
                    <p style={{ color: "#6b7280", marginTop: "8px" }}>Create your business account</p>
                </div>

                {error && (
                    <div style={{ backgroundColor: "#fef2f2", color: "#dc2626", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" }}>
                        {error}
                    </div>
                )}

                <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "14px", color: "#374151", marginBottom: "6px" }}>Business Name</label>
                    <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Mama's Kitchen"
                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }}
                    />
                </div>

                <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "14px", color: "#374151", marginBottom: "6px" }}>Business Phone</label>
                    <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+233XXXXXXXXX"
                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }}
                    />
                </div>

                <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "14px", color: "#374151", marginBottom: "6px" }}>Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }}
                    />
                </div>

                <div style={{ marginBottom: "24px" }}>
                    <label style={{ display: "block", fontSize: "14px", color: "#374151", marginBottom: "6px" }}>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }}
                    />
                </div>

                <button
                    onClick={handleSignup}
                    disabled={loading}
                    style={{ width: "100%", backgroundColor: "#16a34a", color: "white", padding: "12px", borderRadius: "8px", border: "none", fontSize: "16px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
                    {loading ? "Creating account..." : "Create Account"}
                </button>

                <p style={{ textAlign: "center", marginTop: "16px", fontSize: "14px", color: "#6b7280" }}>
                    Already have an account?{" "}
                    <a href="/" style={{ color: "#16a34a", fontWeight: "600", textDecoration: "none" }}>Sign in</a>
                </p>
            </div>
        </div>
    );
}