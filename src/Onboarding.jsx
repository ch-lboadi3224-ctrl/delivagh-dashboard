import React, { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { handleAuthError } from "./authUtils";

const DELIVAGH_WA_NUMBER = "233276295769";
const DELIVAGH_WA_LINK = `https://wa.me/${DELIVAGH_WA_NUMBER}?text=Hi`;

export default function Onboarding({ user, businessName, menuItems, onComplete }) {
    const [step, setStep] = useState(1);
    const initializedRef = useRef(false);
    const hasExistingMenu = (menuItems?.length || 0) > 0;

    const [deliveryZones, setDeliveryZones] = useState("");
    const [minOrderAmount, setMinOrderAmount] = useState("");
    const [botGreeting, setBotGreeting] = useState("");
    const [profileSaving, setProfileSaving] = useState(false);

    const [itemName, setItemName] = useState("");
    const [itemPrice, setItemPrice] = useState("");
    const [itemDesc, setItemDesc] = useState("");
    const [itemCategory, setItemCategory] = useState("Main");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const progressKey = user?.id ? `onboarding_last_step_${user.id}` : null;

    async function persistProgress(nextStep) {
        if (!user?.id) return;
        localStorage.setItem(`onboarding_last_step_${user.id}`, String(nextStep));
        // Best-effort backend persistence; safe even if column doesn't exist yet.
        try {
            await supabase.from("businesses").update({ onboarding_last_step: nextStep }).eq("user_id", user.id);
        } catch {
            // Ignore; localStorage keeps resume behavior working.
        }
    }

    async function loadExistingProfile() {
        const { data, error } = await supabase
            .from("businesses")
            .select("*")
            .eq("user_id", user.id)
            .limit(1);
        if (error) return;
        const biz = data?.[0];
        if (biz) {
            setDeliveryZones(biz.delivery_zones || "");
            setMinOrderAmount(
                biz.min_order_amount === null || biz.min_order_amount === undefined
                    ? ""
                    : String(biz.min_order_amount)
            );
            setBotGreeting(biz.bot_greeting || "");

            const hasProfile =
                !!(biz.delivery_zones && biz.delivery_zones.trim()) ||
                !!(biz.bot_greeting && biz.bot_greeting.trim()) ||
                !!(parseFloat(biz.min_order_amount) > 0);

            // Existing vendors with profile + menu should continue at sharing step.
            if (hasExistingMenu && hasProfile) setStep(3);
        }
    }

    useEffect(() => {
        if (!user?.id || initializedRef.current) return;
        initializedRef.current = true;
        const last = parseInt(localStorage.getItem(`onboarding_last_step_${user.id}`) || "", 10);
        if (!Number.isNaN(last) && last >= 1 && last <= 4) setStep(last);
        loadExistingProfile();
    }, [user?.id]);

    useEffect(() => {
        if (!progressKey) return;
        persistProgress(step);
    }, [step, progressKey]);

    async function saveBusinessProfile() {
        setProfileSaving(true);
        setError("");
        const payload = {
            delivery_zones: deliveryZones.trim(),
            min_order_amount: minOrderAmount === "" ? 0 : parseFloat(minOrderAmount) || 0,
            bot_greeting: botGreeting.trim(),
        };
        const { error: e } = await supabase.from("businesses").update(payload).eq("user_id", user.id);
        if (e) {
            if (await handleAuthError(e)) return;
            const missingColumnError = typeof e.message === "string" && e.message.includes("Could not find the");
            if (!missingColumnError) {
                setError(e.message);
                setProfileSaving(false);
                return;
            }

            // Backward compatibility: allow onboarding to continue even if optional columns are not yet in schema.
            const fallbackPayload = {};
            if (!e.message.includes("'delivery_zones'")) fallbackPayload.delivery_zones = payload.delivery_zones;
            if (!e.message.includes("'min_order_amount'")) fallbackPayload.min_order_amount = payload.min_order_amount;
            if (!e.message.includes("'bot_greeting'")) fallbackPayload.bot_greeting = payload.bot_greeting;
            if (Object.keys(fallbackPayload).length > 0) {
                const { error: fallbackError } = await supabase.from("businesses").update(fallbackPayload).eq("user_id", user.id);
                if (fallbackError) {
                    setError(fallbackError.message);
                    setProfileSaving(false);
                    return;
                }
            }
        }
        setProfileSaving(false);
        setStep(hasExistingMenu ? 3 : 2);
    }

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
        if (e) { if (await handleAuthError(e)) return; setError(e.message); setSaving(false); return; }
        setStep(3);
        setSaving(false);
    }

    function finish() {
        localStorage.setItem("onboarding_done_" + user.id, "true");
        localStorage.removeItem(`onboarding_last_step_${user.id}`);
        supabase.from("businesses").update({ onboarding_last_step: null }).eq("user_id", user.id);
        onComplete();
    }

    function copyLink() {
        navigator.clipboard.writeText(DELIVAGH_WA_LINK);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    const stepDot = (n) => {
        const active = step === n;
        const done = step > n;
        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: done || active ? "#22c55e" : "rgba(255,255,255,0.06)", border: `2px solid ${done || active ? "#22c55e" : "rgba(255,255,255,0.12)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", color: done || active ? "white" : "rgba(255,255,255,0.45)", transition: "all 0.3s" }}>
                    {done ? "✓" : n}
                </div>
                <span style={{ fontSize: "10px", color: active ? "#22c55e" : "rgba(255,255,255,0.45)", fontWeight: "600" }}>
                    {n === 1 ? "Profile" : n === 2 ? "Menu" : n === 3 ? "Share" : "Go Live"}
                </span>
            </div>
        );
    };

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
            <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'DM Sans', sans-serif; }
                body { background: #080f0a; }
                .ob-input { width: 100%; padding: 13px 16px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; font-size: 14px; color: #ecfdf3; outline: none; transition: border-color 0.2s; font-family: 'DM Sans', sans-serif; }
                .ob-input::placeholder { color: rgba(236,253,243,0.4); }
                .ob-input:focus { border-color: #22c55e; background: rgba(34,197,94,0.08); }
                .ob-btn { width: 100%; padding: 14px; background: #16a34a; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; }
                .ob-btn:hover:not(:disabled) { background: #22c55e; transform: translateY(-1px); }
                .ob-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>

            <div style={{ minHeight: "100vh", backgroundColor: "#080f0a", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                <div style={{ width: "100%", maxWidth: "560px" }}>

                    {/* Header */}
                    <div style={{ textAlign: "center", marginBottom: "40px" }}>
                        <div style={{ fontSize: "24px", fontWeight: "800", color: "white", marginBottom: "6px", fontFamily: "'Playfair Display', serif" }}>
                            Delivagh<span style={{ color: "#22c55e" }}>.</span>
                        </div>
                        <p style={{ color: "rgba(236,253,243,0.55)", fontSize: "13px" }}>Let's get {businessName} set up 🚀</p>
                    </div>

                    {/* Progress */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "40px" }}>
                        {stepDot(1)}
                        <div style={{ width: "68px", height: "2px", backgroundColor: step > 1 ? "#22c55e" : "rgba(255,255,255,0.12)", marginBottom: "22px", transition: "background 0.3s" }} />
                        {stepDot(2)}
                        <div style={{ width: "68px", height: "2px", backgroundColor: step > 2 ? "#22c55e" : "rgba(255,255,255,0.12)", marginBottom: "22px", transition: "background 0.3s" }} />
                        {stepDot(3)}
                        <div style={{ width: "68px", height: "2px", backgroundColor: step > 3 ? "#22c55e" : "rgba(255,255,255,0.12)", marginBottom: "22px", transition: "background 0.3s" }} />
                        {stepDot(4)}
                    </div>

                    {/* Step Card */}
                    <div style={{ backgroundColor: "#101b14", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.10)", padding: "32px", marginBottom: "20px" }}>

                        {/* STEP 1 — Business Profile */}
                        {step === 1 && (
                            <div>
                                <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "16px" }}>🏪</div>
                                <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "800", color: "white" }}>Set up your business profile</h2>
                                <p style={{ margin: "0 0 24px", fontSize: "14px", color: "rgba(236,253,243,0.55)", lineHeight: "1.6" }}>These settings improve delivery checks and customer experience in chat.</p>

                                {error && <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px" }}>{error}</div>}

                                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "rgba(236,253,243,0.5)", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.07em" }}>DELIVERY ZONES</label>
                                        <input
                                            className="ob-input"
                                            type="text"
                                            value={deliveryZones}
                                            onChange={e => setDeliveryZones(e.target.value)}
                                            placeholder="Delivery zones (e.g. UMaT, Tarkwa Station, New Atuabo)"
                                        />
                                        <p style={{ fontSize: "11px", color: "rgba(236,253,243,0.35)", marginTop: "5px" }}>Areas you deliver to - the bot uses this to check if a customer is in range</p>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "rgba(236,253,243,0.5)", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.07em" }}>MINIMUM ORDER AMOUNT (GHS) <span style={{ fontWeight: "400", textTransform: "none", letterSpacing: 0, color: "rgba(236,253,243,0.3)" }}>— optional</span></label>
                                        <input
                                            className="ob-input"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={minOrderAmount}
                                            onChange={e => setMinOrderAmount(e.target.value)}
                                            placeholder="0"
                                        />
                                        <p style={{ fontSize: "11px", color: "rgba(236,253,243,0.35)", marginTop: "5px" }}>Customers will be told if their order is below this amount</p>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column" }}>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: "rgba(236,253,243,0.5)", marginBottom: "7px", textTransform: "uppercase", letterSpacing: "0.07em" }}>WELCOME GREETING <span style={{ fontWeight: "400", textTransform: "none", letterSpacing: 0, color: "rgba(236,253,243,0.3)" }}>optional</span></label>
                                        <textarea
                                            className="ob-input"
                                            rows={3}
                                            value={botGreeting}
                                        onChange={e => setBotGreeting(e.target.value)}
        placeholder={`e.g. Welcome to ${businessName}! What can I get for you today?`}
        style={{ resize: "vertical" }}
    />
    <p style={{ fontSize: "11px", color: "rgba(236,253,243,0.35)", marginTop: "5px" }}>The bot sends this when a customer first selects your business</p>
</div>
                                    <button className="ob-btn" onClick={saveBusinessProfile} disabled={profileSaving}>
                                        {profileSaving ? "Saving..." : hasExistingMenu ? "Save & Continue →" : "Save & Add Menu →"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 2 — Add Menu Item */}
                        {step === 2 && (
                            <div>
                                <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "16px" }}>🍽️</div>
                                <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "800", color: "white" }}>Add your first menu item</h2>
                                <p style={{ margin: "0 0 24px", fontSize: "14px", color: "rgba(236,253,243,0.55)", lineHeight: "1.6" }}>Add at least one item so customers can place orders immediately.</p>

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
                                    <button onClick={() => setStep(3)} style={{ width: "100%", padding: "11px", backgroundColor: "transparent", color: "rgba(236,253,243,0.65)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                                        Skip for now
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 3 — Share Link */}
                        {step === 3 && (
                            <div>
                                <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "16px" }}>📱</div>
                                <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "800", color: "white" }}>Share your WhatsApp link</h2>
                                <p style={{ margin: "0 0 24px", fontSize: "14px", color: "rgba(236,253,243,0.55)", lineHeight: "1.6" }}>
                                    Share this link with your customers to start receiving orders on WhatsApp.
                                </p>

                                <div style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "20px", border: "1px solid rgba(255,255,255,0.10)", marginBottom: "20px" }}>
                                    <p style={{ margin: "0 0 10px", fontSize: "10px", fontWeight: "700", color: "rgba(236,253,243,0.55)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Your DelivaGH WhatsApp Link</p>
                                    <a
                                        href={DELIVAGH_WA_LINK}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ display: "block", margin: "0 0 16px", fontSize: "14px", fontWeight: "700", color: "#22c55e", wordBreak: "break-all", textDecoration: "underline" }}
                                    >
                                        {DELIVAGH_WA_LINK}
                                    </a>
                                    <div style={{ display: "flex", gap: "10px" }}>
                                        <button
                                            onClick={copyLink}
                                            style={{ flex: 1, padding: "9px 14px", backgroundColor: "#16a34a", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                                        >
                                            {copied ? "Copied! ✓" : "Copy Link"}
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (navigator.share) {
                                                    navigator.share({ title: "Order from us on WhatsApp", url: DELIVAGH_WA_LINK });
                                                } else {
                                                    copyLink();
                                                }
                                            }}
                                            style={{ flex: 1, padding: "9px 14px", backgroundColor: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.35)", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                                        >
                                            Share Link
                                        </button>
                                    </div>
                                    <p style={{ margin: "14px 0 0", fontSize: "12px", color: "rgba(236,253,243,0.55)", lineHeight: "1.6" }}>
                                        Customers tap this link → WhatsApp opens → they send Hi → ordering starts 🚀
                                    </p>
                                </div>

                                <button className="ob-btn" onClick={() => setStep(4)}>
                                    I've shared it → Continue
                                </button>
                            </div>
                        )}

                        {/* STEP 3 — Done */}
                        {step === 4 && (
                            <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: "56px", marginBottom: "20px" }}>🎉</div>
                                <h2 style={{ margin: "0 0 12px", fontSize: "22px", fontWeight: "800", color: "white" }}>You're live!</h2>
                                <p style={{ margin: "0 0 28px", fontSize: "14px", color: "rgba(236,253,243,0.55)", lineHeight: "1.7" }}>
                                    <strong style={{ color: "white" }}>{businessName}</strong> is now on DelivaGH. Your AI bot is active 24/7.
                                </p>

                                <div style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "16px", border: "1px solid rgba(255,255,255,0.10)", marginBottom: "24px", textAlign: "left" }}>
                                    <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: "700", color: "rgba(236,253,243,0.55)", textTransform: "uppercase", letterSpacing: "0.06em" }}>What happens next</p>
                                    {[
                                        "Customer taps your WhatsApp link",
                                        "Bot shows your menu & takes order",
                                        "You get a notification on your dashboard",
                                        "Accept order → customer gets payment link",
                                        "Customer pays → order confirmed"
                                    ].map((s, i) => (
                                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                                            <span style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#22c55e", color: "white", fontSize: "10px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                                            <span style={{ fontSize: "13px", color: "#ecfdf3" }}>{s}</span>
                                        </div>
                                    ))}
                                </div>

                                <button className="ob-btn" onClick={finish}>
                                    Go to Dashboard →
                                </button>
                            </div>
                        )}
                    </div>

                    <p style={{ textAlign: "center", fontSize: "12px", color: "rgba(236,253,243,0.55)" }}>
                        <span onClick={finish} style={{ cursor: "pointer", textDecoration: "underline" }}>Skip setup, go to dashboard</span>
                    </p>
                </div>
            </div>
        </>
    );
}
