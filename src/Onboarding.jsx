import { useState } from "react";
import { supabase } from "./supabase";

export default function Onboarding({ user, businessName, menuItems, onComplete }) {
    const [step, setStep] = useState(menuItems && menuItems.length > 0 ? 2 : 1);
    const [itemName, setItemName] = useState("");
    const [itemPrice, setItemPrice] = useState("");
    const [itemDesc, setItemDesc] = useState("");
    const [itemCategory, setItemCategory] = useState("Main");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function addItem() {
        if (!itemName.trim() || !itemPrice) { setError("Please enter item name and price."); return; }
        setSaving(true); setError("");
        const { error: e } = await supabase.from("menus").insert([{
            business_name: businessName,
            item_name: itemName.trim(),
            item_price: parseFloat(itemPrice),
            item_description: itemDesc.trim(),
            category: itemCategory,
            available: true
        }]);
        if (e) { setError(e.message); setSaving(false); return; }
        setStep(2);
        setSaving(false);
    }

    function finish() {
        localStorage.setItem("onboarding_done_" + user.id, "true");
        onComplete();
    }

    const stepDot = (n) => {
        const active = step === n;
        const done = step > n;
        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: done || active ? "#2563eb" : "#1c2128", border: `2px solid ${done || active ? "#2563eb" : "#30363d"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", color: done || active ? "white" : "#7d8590", transition: "all 0.3s" }}>
                    {done ? "✓" : n}
                </div>
                <span style={{ fontSize: "10px", color: active ? "#2563eb" : "#7d8590", fontWeight: "600" }}>
                    {n === 1 ? "Menu" : n === 2 ? "Share" : "Go Live"}
                </span>
            </div>
        );
    };

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
            <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: Inter, sans-serif; }
                body { background: #0f1117; }
                .ob-input { width: 100%; padding: 13px 16px; background: #1c2128; border: 1px solid #30363d; border-radius: 10px; font-size: 14px; color: #e6edf3; outline: none; transition: border-color 0.2s; font-family: Inter, sans-serif; }
                .ob-input::placeholder { color: #7d8590; }
                .ob-input:focus { border-color: #2563eb; background: rgba(37,99,235,0.05); }
                .ob-btn { width: 100%; padding: 14px; background: #2563eb; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: Inter, sans-serif; }
                .ob-btn:hover:not(:disabled) { background: #3b82f6; transform: translateY(-1px); }
                .ob-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>

            <div style={{ minHeight: "100vh", backgroundColor: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                <div style={{ width: "100%", maxWidth: "560px" }}>

                    {/* Header */}
                    <div style={{ textAlign: "center", marginBottom: "40px" }}>
                        <div style={{ fontSize: "22px", fontWeight: "800", color: "white", marginBottom: "6px" }}>
                            Delivagh<span style={{ color: "#2563eb" }}>.</span>
                        </div>
                        <p style={{ color: "#7d8590", fontSize: "13px" }}>Let's get {businessName} set up 🚀</p>
                    </div>

                    {/* Progress */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "40px" }}>
                        {stepDot(1)}
                        <div style={{ width: "80px", height: "2px", backgroundColor: step > 1 ? "#2563eb" : "#30363d", marginBottom: "22px", transition: "background 0.3s" }} />
                        {stepDot(2)}
                        <div style={{ width: "80px", height: "2px", backgroundColor: step > 2 ? "#2563eb" : "#30363d", marginBottom: "22px", transition: "background 0.3s" }} />
                        {stepDot(3)}
                    </div>

                    {/* Step Card */}
                    <div style={{ backgroundColor: "#161b22", borderRadius: "16px", border: "1px solid #30363d", padding: "32px", marginBottom: "20px" }}>

                        {/* STEP 1 — Add Menu Item */}
                        {step === 1 && (
                            <div>
                                <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "16px" }}>🍽️</div>
                                <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "800", color: "white" }}>Add your first menu item</h2>
                                <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#7d8590", lineHeight: "1.6" }}>Add at least one item so your customers can start placing orders through WhatsApp.</p>

                                {error && <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px" }}>{error}</div>}

                                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                    <input
                                        className="ob-input"
                                        type="text"
                                        value={itemName}
                                        onChange={e => setItemName(e.target.value)}
                                        placeholder="Item name (e.g. Jollof Rice)"
                                    />
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                        <input
                                            className="ob-input"
                                            type="number"
                                            value={itemPrice}
                                            onChange={e => setItemPrice(e.target.value)}
                                            placeholder="Price (GHS)"
                                        />
                                        <select
                                            className="ob-input"
                                            value={itemCategory}
                                            onChange={e => setItemCategory(e.target.value)}
                                        >
                                            <option value="Main">Main</option>
                                            <option value="Sides">Sides</option>
                                            <option value="Extras">Extras</option>
                                        </select>
                                    </div>
                                    <textarea
                                        className="ob-input"
                                        value={itemDesc}
                                        onChange={e => setItemDesc(e.target.value)}
                                        placeholder="Brief description (optional)"
                                        style={{ height: "80px", resize: "none" }}
                                    />
                                    <button className="ob-btn" onClick={addItem} disabled={saving || !itemName.trim() || !itemPrice}>
                                        {saving ? "Saving..." : "Add Item & Continue →"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 2 — Share Number */}
                        {step === 2 && (
                            <div>
                                <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "16px" }}>📱</div>
                                <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "800", color: "white" }}>Share your WhatsApp number</h2>
                                <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#7d8590", lineHeight: "1.6" }}>
                                    Customers message this number to order from <strong style={{ color: "white" }}>{businessName}</strong>.
                                </p>

                                <div style={{ backgroundColor: "#1c2128", borderRadius: "12px", padding: "20px", border: "1px solid #30363d", marginBottom: "20px" }}>
                                    <p style={{ margin: "0 0 6px", fontSize: "10px", fontWeight: "700", color: "#7d8590", textTransform: "uppercase", letterSpacing: "0.08em" }}>Your DelivaGH WhatsApp Number</p>
                                    <p style={{ margin: "0 0 12px", fontSize: "22px", fontWeight: "800", color: "#2563eb", fontFamily: "monospace" }}>+1 415 523 8886</p>
                                    <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#7d8590" }}>Customers send <strong style={{ color: "white" }}>"Hi"</strong> to start ordering</p>
                                    <button onClick={() => { navigator.clipboard.writeText("+14155238886"); }}
                                        style={{ padding: "8px 16px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                                        Copy Number
                                    </button>
                                </div>

                                <div style={{ backgroundColor: "rgba(37,99,235,0.08)", borderRadius: "10px", padding: "14px 16px", border: "1px solid rgba(37,99,235,0.2)", marginBottom: "20px" }}>
                                    <p style={{ margin: 0, fontSize: "12px", color: "#60a5fa", lineHeight: "1.6" }}>
                                        <strong>Note:</strong> This is the Twilio sandbox number. You'll get a dedicated number once you upgrade to Meta WhatsApp Cloud API.
                                    </p>
                                </div>

                                <button className="ob-btn" onClick={() => setStep(3)}>
                                    I've shared it → Continue
                                </button>
                            </div>
                        )}

                        {/* STEP 3 — Done */}
                        {step === 3 && (
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "56px", marginBottom: "20px" }}>🎉</div>
                                <h2 style={{ margin: "0 0 12px", fontSize: "22px", fontWeight: "800", color: "white" }}>You're live!</h2>
                                <p style={{ margin: "0 0 28px", fontSize: "14px", color: "#7d8590", lineHeight: "1.7" }}>
                                    <strong style={{ color: "white" }}>{businessName}</strong> is now on DelivaGH. Your AI bot is active 24/7.
                                </p>

                                <div style={{ backgroundColor: "#1c2128", borderRadius: "12px", padding: "16px", border: "1px solid #30363d", marginBottom: "24px", textAlign: "left" }}>
                                    <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: "700", color: "#7d8590", textTransform: "uppercase", letterSpacing: "0.06em" }}>What happens next</p>
                                    {[
                                        "Customer messages +1 415 523 8886",
                                        "Bot shows your menu & takes order",
                                        "You get a notification on your dashboard",
                                        "Accept order → customer gets payment link",
                                        "Customer pays → order confirmed"
                                    ].map((s, i) => (
                                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                                            <span style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#2563eb", color: "white", fontSize: "10px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                                            <span style={{ fontSize: "13px", color: "#e6edf3" }}>{s}</span>
                                        </div>
                                    ))}
                                </div>

                                <button className="ob-btn" onClick={finish}>
                                    Go to Dashboard →
                                </button>
                            </div>
                        )}
                    </div>

                    <p style={{ textAlign: "center", fontSize: "12px", color: "#7d8590" }}>
                        <span onClick={finish} style={{ cursor: "pointer", textDecoration: "underline" }}>Skip setup, go to dashboard</span>
                    </p>
                </div>
            </div>
        </>
    );
}
