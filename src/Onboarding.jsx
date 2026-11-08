import React, { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { handleAuthError } from "./authUtils";
import Icon from "./ui/Icon";
import "./ui/dash.css";

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

    const STEP_NAMES = ["Shop details", "First item", "Share link", "Done"];

    return (
        <div className="dx dx-center" data-theme="light">
            <div className="dx-ob">
                <div className="dx-ob-head">
                    <span className="dx-wordmark">Delivagh<i>.</i></span>
                    <button type="button" className="dx-link" onClick={finish}>Skip setup</button>
                </div>

                <ol className="dx-ob-steps" aria-label="Setup steps">
                    {STEP_NAMES.map((name, i) => {
                        const n = i + 1;
                        const state = step > n ? "is-done" : step === n ? "is-on" : "";
                        return (
                            <li key={name} className={state} aria-current={step === n ? "step" : undefined}>
                                <span>{name}</span>
                            </li>
                        );
                    })}
                </ol>

                <div className="dx-card is-wide dx-ob-card" key={step}>
                    {step === 1 && (
                        <form className="dx-stack" onSubmit={e => { e.preventDefault(); if (!profileSaving) saveBusinessProfile(); }}>
                            <div>
                                <h1 className="dx-title-sm">Set up {businessName}</h1>
                                <p className="dx-sub">The bot uses these to answer customers. You can change them later in Settings.</p>
                            </div>
                            {error && <p className="dx-msg is-error" role="alert">{error}</p>}
                            <label className="dx-field">
                                <span className="dx-label">Where do you deliver?</span>
                                <input className="dx-input" type="text" value={deliveryZones} onChange={e => setDeliveryZones(e.target.value)} placeholder="e.g. UMaT, Tarkwa Station, New Atuabo" />
                                <span className="dx-hint">The bot checks a customer's area against this list.</span>
                            </label>
                            <label className="dx-field">
                                <span className="dx-label">Smallest order you'll take <span className="faint">(GHS, optional)</span></span>
                                <input className="dx-input num" type="number" inputMode="decimal" min="0" step="0.01" value={minOrderAmount} onChange={e => setMinOrderAmount(e.target.value)} placeholder="0" />
                                <span className="dx-hint">Customers are told if their order is below this amount.</span>
                            </label>
                            <label className="dx-field">
                                <span className="dx-label">Welcome message <span className="faint">(optional)</span></span>
                                <textarea className="dx-textarea" rows={3} value={botGreeting} onChange={e => setBotGreeting(e.target.value)} placeholder={`e.g. Welcome to ${businessName}. What can I get for you today?`} />
                                <span className="dx-hint">Sent when a customer first opens your shop in the chat.</span>
                            </label>
                            <button type="submit" className="dx-btn is-primary is-lg is-block" disabled={profileSaving}>
                                {profileSaving ? "Saving…" : hasExistingMenu ? "Save and continue" : "Save and add your menu"}
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <form className="dx-stack" onSubmit={e => { e.preventDefault(); if (!saving && itemName.trim() && itemPrice) addItem(); }}>
                            <div>
                                <h1 className="dx-title-sm">Add your first item</h1>
                                <p className="dx-sub">One item is enough for customers to start ordering. You can add the rest from Menu.</p>
                            </div>
                            {error && <p className="dx-msg is-error" role="alert">{error}</p>}
                            <label className="dx-field">
                                <span className="dx-label">Item name</span>
                                <input className="dx-input" type="text" value={itemName} onChange={e => setItemName(e.target.value)} placeholder="e.g. Jollof Rice with Chicken" />
                            </label>
                            <div className="dx-form-grid">
                                <label className="dx-field">
                                    <span className="dx-label">Price (GHS)</span>
                                    <input className="dx-input num" type="number" inputMode="decimal" min="0" step="0.01" value={itemPrice} onChange={e => setItemPrice(e.target.value)} placeholder="45.00" />
                                </label>
                                <label className="dx-field">
                                    <span className="dx-label">Section</span>
                                    <select className="dx-select" value={itemCategory} onChange={e => setItemCategory(e.target.value)}>
                                        <option value="Main">Main</option>
                                        <option value="Sides">Sides</option>
                                        <option value="Extras">Extras</option>
                                    </select>
                                </label>
                            </div>
                            <label className="dx-field">
                                <span className="dx-label">Description <span className="faint">(optional)</span></span>
                                <textarea className="dx-textarea" rows={3} value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="What comes with it, portion size, spice level" />
                            </label>
                            <div className="dx-stack" style={{ gap: 8 }}>
                                <button type="submit" className="dx-btn is-primary is-lg is-block" disabled={saving || !itemName.trim() || !itemPrice}>
                                    {saving ? "Saving…" : "Add item and continue"}
                                </button>
                                <button type="button" className="dx-btn is-ghost is-block" onClick={() => { setError(""); setStep(3); }}>Skip for now</button>
                            </div>
                        </form>
                    )}

                    {step === 3 && (
                        <div className="dx-stack">
                            <div>
                                <h1 className="dx-title-sm">Share your WhatsApp link</h1>
                                <p className="dx-sub">Customers tap it, WhatsApp opens, they say hi and the bot takes it from there.</p>
                            </div>
                            <div className="dx-share">
                                <code>{DELIVAGH_WA_LINK}</code>
                                <div className="dx-row" style={{ gap: 8 }}>
                                    <button type="button" className="dx-btn is-primary" onClick={copyLink}><Icon name={copied ? "check" : "copy"} size={16} />{copied ? "Copied" : "Copy link"}</button>
                                    <button type="button" className="dx-btn" onClick={() => {
                                        if (navigator.share) navigator.share({ title: "Order from us on WhatsApp", url: DELIVAGH_WA_LINK }).catch(() => {});
                                        else copyLink();
                                    }}><Icon name="external" size={16} />Share</button>
                                    <a className="dx-btn is-ghost" href={DELIVAGH_WA_LINK} target="_blank" rel="noopener noreferrer">Try it</a>
                                </div>
                            </div>
                            <p className="dx-hint">Good places for it: your WhatsApp status, Instagram bio, flyers and the sign at your counter.</p>
                            <button type="button" className="dx-btn is-primary is-lg is-block" onClick={() => setStep(4)}>Continue</button>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="dx-stack">
                            <div>
                                <h1 className="dx-title-sm">{businessName} is ready</h1>
                                <p className="dx-sub">The bot is answering customers on WhatsApp now. Here's what happens with each order.</p>
                            </div>
                            <ol className="dx-ob-flow">
                                <li>A customer taps your link and says hi.</li>
                                <li>The bot shows your menu and takes the order.</li>
                                <li>The order appears on your dashboard.</li>
                                <li>You accept it and the customer is told how to pay.</li>
                                <li>Once they've paid, you prepare and send it out.</li>
                            </ol>
                            <button type="button" className="dx-btn is-primary is-lg is-block" onClick={finish}>Open my dashboard</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
