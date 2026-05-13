import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";

/**
 * Business Settings Component
 * Add this to your dashboard to allow vendors to set their MoMo number
 */
export default function BusinessSettings({ user, darkMode = true }) {
    const [momoNumber, setMomoNumber] = useState("");
    const [contactNumber, setContactNumber] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const d = darkMode ? {
        bg: "#080f0a", card: "#101b14", border: "rgba(255,255,255,0.10)",
        text: "#ecfdf3", muted: "rgba(236,253,243,0.62)",
        input: "rgba(255,255,255,0.06)", inputBorder: "rgba(255,255,255,0.12)",
    } : {
        bg: "#f0fdf4", card: "#ffffff", border: "#d1fae5",
        text: "#052e16", muted: "#166534",
        input: "#ffffff", inputBorder: "#a7f3d0",
    };

    useEffect(() => {
        if (user) {
            fetchBusinessData();
        }
    }, [user]);

    async function fetchBusinessData() {
        try {
            const { data, error } = await supabase
                .from('businesses')
                .select('contact_number, momo_number')
                .eq('user_id', user.id)
                .single();

            if (error) throw error;

            if (data) {
                setContactNumber(data.contact_number || "");
                setMomoNumber(data.momo_number || "");
            }
        } catch (e) {
            console.error("Error fetching business data:", e);
            setError("Failed to load business data");
        } finally {
            setLoading(false);
        }
    }

    async function saveSettings() {
        setSaving(true);
        setMessage("");
        setError("");

        try {
            const { error } = await supabase
                .from('businesses')
                .update({
                    contact_number: contactNumber,
                    momo_number: momoNumber
                })
                .eq('user_id', user.id);

            if (error) throw error;

            setMessage("Settings saved successfully!");
            setTimeout(() => setMessage(""), 3000);
        } catch (e) {
            console.error("Error saving settings:", e);
            setError("Failed to save settings: " + e.message);
            setTimeout(() => setError(""), 5000);
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div style={{ padding: "20px", color: d.text }}>Loading...</div>;
    }

    return (
        <div style={{ padding: "24px", maxWidth: "600px" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: "700", color: d.text }}>
                Business Settings
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: "14px", color: d.muted }}>
                Manage your business contact information
            </p>

            {message && (
                <div style={{
                    padding: "12px 16px",
                    marginBottom: "20px",
                    background: "rgba(34,197,94,0.1)",
                    border: "1px solid rgba(34,197,94,0.3)",
                    borderRadius: "10px",
                    color: "#22c55e",
                    fontSize: "14px"
                }}>
                    {message}
                </div>
            )}

            {error && (
                <div style={{
                    padding: "12px 16px",
                    marginBottom: "20px",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "10px",
                    color: "#ef4444",
                    fontSize: "14px"
                }}>
                    {error}
                </div>
            )}

            <div style={{ marginBottom: "20px" }}>
                <label style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: d.muted,
                    marginBottom: "8px"
                }}>
                    Contact Number (WhatsApp)
                </label>
                <input
                    type="tel"
                    placeholder="024XXXXXXX"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: d.input,
                        border: `1px solid ${d.inputBorder}`,
                        borderRadius: "10px",
                        fontSize: "14px",
                        color: d.text,
                        outline: "none",
                        boxSizing: "border-box"
                    }}
                />
                <small style={{
                    display: "block",
                    marginTop: "6px",
                    fontSize: "12px",
                    color: d.muted
                }}>
                    Your main business WhatsApp number for customer communication
                </small>
            </div>

            <div style={{ marginBottom: "24px" }}>
                <label style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: d.muted,
                    marginBottom: "8px"
                }}>
                    MoMo Number for Payments
                </label>
                <input
                    type="tel"
                    placeholder="024XXXXXXX"
                    value={momoNumber}
                    onChange={(e) => setMomoNumber(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "12px 16px",
                        background: d.input,
                        border: `1px solid ${d.inputBorder}`,
                        borderRadius: "10px",
                        fontSize: "14px",
                        color: d.text,
                        outline: "none",
                        boxSizing: "border-box"
                    }}
                />
                <small style={{
                    display: "block",
                    marginTop: "6px",
                    fontSize: "12px",
                    color: d.muted
                }}>
                    This number will be shown to customers for direct MoMo payments (can be different from contact number)
                </small>
            </div>

            <button
                onClick={saveSettings}
                disabled={saving}
                style={{
                    padding: "12px 24px",
                    background: "#22c55e",
                    color: "white",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.6 : 1
                }}
            >
                {saving ? "Saving..." : "Save Settings"}
            </button>
        </div>
    );
}
