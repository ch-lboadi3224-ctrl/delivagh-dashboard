import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
import { handleAuthError } from "./authUtils";
import Icon from "./ui/Icon";
import "./ui/dash.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://api.delivagh.app";
const API = BACKEND_URL;

export default function Admin() {
    // Admin secret is held only in memory for the duration of the session.
    // It is never persisted to localStorage/sessionStorage or hardcoded.
    const [authed, setAuthed] = useState(false);
    const [adminKey, setAdminKey] = useState("");
    const [pwInput, setPwInput] = useState("");
    const [pwError, setPwError] = useState("");
    const [loggingIn, setLoggingIn] = useState(false);
    const [activePage, setActivePage] = useState("overview");

    // Data
    const [businesses, setBusinesses] = useState([]);
    const [orders, setOrders] = useState([]);
    const [health, setHealth] = useState({ backend: "checking", supabase: "checking", groq: "checking" });
    const [lastOrder, setLastOrder] = useState(null);
    const [selectedBiz, setSelectedBiz] = useState(null);
    const [botConfig, setBotConfig] = useState({});
    const [paymentConfig, setPaymentConfig] = useState({});
    const [saving, setSaving] = useState(false);
    const [paymentSaving, setPaymentSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState("");
    const [paymentMsg, setPaymentMsg] = useState("");
    const [resyncingBot, setResyncingBot] = useState(false);
    const [actionLoading, setActionLoading] = useState({});
    const [showCreateVendorModal, setShowCreateVendorModal] = useState(false);
    const [creatingVendor, setCreatingVendor] = useState(false);
    const [createVendorMsg, setCreateVendorMsg] = useState("");
    const [createVendorErr, setCreateVendorErr] = useState("");
    const [vendorForm, setVendorForm] = useState({
        businessName: "",
        ownerName: "",
        email: "",
        phone: "",
        password: "",
    });
    const [registeredCustomers, setRegisteredCustomers] = useState([]);
    const [webhookLogs, setWebhookLogs] = useState([]);
    const [webhookLogsError, setWebhookLogsError] = useState("");
    const [webhookFilter, setWebhookFilter] = useState("");
    const [theme, setTheme] = useState(() => localStorage.getItem("admin_theme") || "light");
    const [bizFilter, setBizFilter] = useState("all");

    // Bot Control
    const [botActive, setBotActive] = useState(true);
    const [botOfflineMessage, setBotOfflineMessage] = useState("Sorry, we are currently unavailable. Please try again later. 🙏");
    const [botSwitchLoading, setBotSwitchLoading] = useState(false);
    const [botSwitchSaved, setBotSwitchSaved] = useState(false);

    async function handleLogin() {
        const key = pwInput;
        if (!key) {
            setPwError("Enter the admin password");
            setTimeout(() => setPwError(""), 3000);
            return;
        }
        setLoggingIn(true);
        setPwError("");
        try {
            // Validate the password server-side by calling a protected admin endpoint.
            // The secret is never compared locally and never stored anywhere but React state.
            const response = await fetch(API + "/admin/user-emails", {
                method: "GET",
                headers: { "Content-Type": "application/json", "x-admin-key": key },
            });
            if (response.ok) {
                setAdminKey(key);
                setAuthed(true);
                setPwInput("");
            } else {
                setPwError("Incorrect password");
                setTimeout(() => setPwError(""), 3000);
            }
        } catch {
            setPwError("Could not reach the server. Please try again.");
            setTimeout(() => setPwError(""), 3000);
        } finally {
            setLoggingIn(false);
        }
    }

    useEffect(() => {
        if (!supabase) return;
        if (!authed) return;
        fetchAll();
        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, [authed]);

    // One timer for the page message: a new message restarts it, so an older
    // message's timer can't clear a newer one early.
    useEffect(() => {
        if (!saveMsg) return undefined;
        const t = setTimeout(() => setSaveMsg(""), 5000);
        return () => clearTimeout(t);
    }, [saveMsg]);

    useEffect(() => {
        localStorage.setItem("admin_theme", theme);
        document.body.style.background = theme === "dark" ? "#12110f" : "#f4f2ec";
    }, [theme]);

    useEffect(() => {
        if (!supabase || !authed || activePage !== "webhooks") return undefined;
        let cancelled = false;
        let channel = null;

        (async () => {
            setWebhookLogsError("");
            const { data, error } = await supabase
                .from("webhook_inbound_logs")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(250);
            if (cancelled) return;
            if (error) {
                setWebhookLogs([]);
                setWebhookLogsError(error.message || "Could not load webhook logs (did you run supabase_webhook_inbound_logs.sql?)");
                return;
            }
            setWebhookLogs(data || []);

            channel = supabase
                .channel("admin_webhook_logs")
                .on("postgres_changes", { event: "INSERT", schema: "public", table: "webhook_inbound_logs" },
                    (payload) => { setWebhookLogs((prev) => [payload.new, ...prev].slice(0, 500)); })
                .subscribe();
        })();

        return () => {
            cancelled = true;
            if (channel) supabase.removeChannel(channel);
        };
    }, [authed, activePage]);

    async function fetchAll() {
        const [{ data: biz }, { data: ord }, { data: custRows }] = await Promise.all([
            supabase.from("businesses").select("*").order("created_at", { ascending: false }),
            supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
            supabase.from("customers").select("*").order("registered_at", { ascending: false }).limit(500),
        ]);
        setRegisteredCustomers(custRows || []);
        
        // Fetch user emails from backend (which has service role access)
        let userMap = {};
        if (biz && biz.length > 0) {
            try {
                console.log("Fetching user emails from:", API + "/admin/user-emails");
                const response = await fetch(API + "/admin/user-emails", {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "x-admin-key": adminKey
                    }
                });
                
                console.log("User emails response status:", response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log("User emails response data:", data);
                    userMap = data.userMap || {};
                    console.log("Fetched user emails:", Object.keys(userMap).length, "users", userMap);
                } else {
                    const errorText = await response.text();
                    console.error("Failed to fetch user emails:", response.status, errorText);
                }
            } catch (err) {
                console.error("Could not fetch user emails:", err);
            }
        }
        
        // Attach email to each business
        if (biz) {
            const businessesWithEmails = biz.map(b => ({
                ...b,
                email: userMap[b.user_id] || b.user_id || "—"
            }));
            console.log("Businesses with emails (first 3):", businessesWithEmails.slice(0, 3).map(b => ({ name: b.name, email: b.email, user_id: b.user_id })));
            setBusinesses(businessesWithEmails);
        }
        
        if (ord) {
            setOrders(ord);
            setLastOrder(ord[0] || null);
        }
        const { data: botSettings } = await supabase.from('bot_settings').select('*').eq('id', 1).maybeSingle();
        if (botSettings) {
            setBotActive(botSettings.bot_active ?? true);
            setBotOfflineMessage(botSettings.offline_message || "Sorry, we are currently unavailable. Please try again later. 🙏");
        }
    }

    async function checkHealth() {
        try {
            const r = await fetch(API + "/", { signal: AbortSignal.timeout(5000) });
            setHealth(h => ({ ...h, backend: r.ok ? "ok" : "error" }));
        } catch { setHealth(h => ({ ...h, backend: "error" })); }

        try {
            const { error } = await supabase.from("businesses").select("id").limit(1);
            setHealth(h => ({ ...h, supabase: error ? "error" : "ok" }));
        } catch { setHealth(h => ({ ...h, supabase: "error" })); }

        try {
            // The bot's WhatsApp route, and whether its Meta settings are present
            const r = await fetch(API + "/whatsapp/health", { signal: AbortSignal.timeout(5000) });
            const j = r.ok ? await r.json().catch(() => ({})) : {};
            const metaOk = j.meta && j.meta.META_PHONE_NUMBER_ID_configured && j.meta.META_ACCESS_TOKEN_configured;
            setHealth(h => ({ ...h, groq: r.ok && metaOk ? "ok" : "warn" }));
        } catch { setHealth(h => ({ ...h, groq: "warn" })); }
    }

    async function approveBusiness(id) {
        setActionLoading(p => ({ ...p, [id]: "approving" }));
        const biz = businesses.find(b => b.id === id);
        if (!biz) { setActionLoading(p => ({ ...p, [id]: null })); return; }

        const r = await fetch(API + "/admin/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
            body: JSON.stringify({ id, businessName: biz.name, phone: biz.phone, botGreeting: biz.bot_greeting })
        });
        const data = await r.json();

        if (!r.ok || data.error) {
            setSaveMsg("Could not approve: " + (data.error || "unknown error"));
        } else {
            setSaveMsg(biz.name + " approved and live on bot ✓");
            setBusinesses(prev => prev.map(b => b.id === id ? { ...b, status: "active" } : b));
        }
        setActionLoading(p => ({ ...p, [id]: null }));
        await fetchAll();
    }

    async function rejectBusiness(id) {
        if (!window.confirm("Reject this business? It will be removed from the bot and customers can't order from it.")) return;
        setActionLoading(p => ({ ...p, [id]: "rejecting" }));
        const biz = businesses.find(b => b.id === id);
        if (!biz) { setActionLoading(p => ({ ...p, [id]: null })); return; }

        const r = await fetch(API + "/admin/reject", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
            body: JSON.stringify({ id, businessName: biz.name })
        });

        if (r.ok) {
            setBusinesses(prev => prev.map(b => b.id === id ? { ...b, status: "rejected" } : b));
            setSaveMsg(biz.name + " rejected ✓");
        }
        setActionLoading(p => ({ ...p, [id]: null }));
        await fetchAll();
    }

    async function suspendBusiness(id, current) {
        const newStatus = current === "suspended" ? "active" : "suspended";
        setActionLoading(p => ({ ...p, [id]: "suspending" }));
        const biz = businesses.find(b => b.id === id);
        if (!biz) { setActionLoading(p => ({ ...p, [id]: null })); return; }

        const r = await fetch(API + "/admin/suspend", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
            body: JSON.stringify({ id, businessName: biz.name, newStatus, phone: biz.phone, botGreeting: biz.bot_greeting })
        });
        const data = await r.json();

        if (!r.ok || data.error) {
            setSaveMsg("Action failed: " + (data.error || "unknown error"));
        } else {
            setSaveMsg(biz.name + (newStatus === "suspended" ? " suspended ✓" : " reactivated ✓"));
            setBusinesses(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
        }
        setActionLoading(p => ({ ...p, [id]: null }));
        await fetchAll();
    }

    function openBotConfig(biz) {
        setSelectedBiz(biz);
        setBotConfig({
            bot_name: biz.bot_name || "DelivaGH",
            bot_greeting: biz.bot_greeting || "",
            delivery_zones: biz.delivery_zones || "",
            min_order_amount: biz.min_order_amount || 0,
            bot_type: biz.bot_type || "food",
            business_context: typeof biz.business_context === "string" ? biz.business_context : "",
            bot_persona: biz.bot_persona || "",
            bot_location: biz.bot_location || "",
            bot_special_instructions: biz.bot_special_instructions || "",
            bot_boundaries: biz.bot_boundaries || "",
        });
        setActivePage("botconfig");
    }

    async function saveBotConfig() {
        if (!selectedBiz) return;
        setSaving(true);

        // Each field is saved on its own and the bot reads them separately, so
        // editing one later always takes effect.
        const r = await fetch(API + "/admin/update-bot-config", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
            body: JSON.stringify({ id: selectedBiz.id, ...botConfig, business_context: (botConfig.business_context || "").trim() })
        });

        const data = await r.json();
        if (!r.ok || data.error) {
            setSaveMsg("Could not save: " + (data.error || "unknown error"));
        } else {
            setSaveMsg("Saved!");
        }
        setSaving(false);
        await fetchAll();
    }

    function openPaymentConfig(biz) {
        setSelectedBiz(biz);
        setPaymentConfig({
            commission_type: biz.commission_type || "flat",
            commission_value: typeof biz.commission_value === "number" ? biz.commission_value : (parseFloat(biz.commission_value) || 1),
        });
        setPaymentMsg("");
        setActivePage("payments");
    }

    async function savePaymentConfig() {
        if (!selectedBiz) return;
        setPaymentSaving(true);
        setPaymentMsg("");
        const payload = {
            commission_type: paymentConfig.commission_type || "flat",
            commission_value: parseFloat(paymentConfig.commission_value) || 0,
        };
        const { error } = await supabase.from("businesses").update(payload).eq("id", selectedBiz.id);
        if (error) {
            if (await handleAuthError(error)) return;
            setPaymentMsg("Could not save: " + error.message);
            setPaymentSaving(false);
            return;
        }
        setPaymentMsg("Commission saved");
        setPaymentSaving(false);
        await fetchAll();
    }

    async function resyncBotBusinesses() {
        setResyncingBot(true);
        setSaveMsg("");
        try {
            const r = await fetch(API + "/whatsapp/resync-businesses", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
            });
            const data = await r.json();
            if (!r.ok || !data?.success) {
                const reason = data?.error || (data?.failures?.[0]?.error) || "unknown error";
                setSaveMsg("Bot resync failed: " + reason);
            } else {
                setSaveMsg(`Bot resync complete: ${data.synced}/${data.totalActive} active businesses synced`);
            }
        } catch (e) {
            if (await handleAuthError(e)) return;
            setSaveMsg("Bot resync failed: " + e.message);
        } finally {
            setResyncingBot(false);
        }
    }

    function randomPassword() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
        let out = "";
        for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
        return out;
    }

    async function saveBotSwitch() {
        setBotSwitchLoading(true);
        await supabase.from('bot_settings').upsert({
            id: 1,
            bot_active: botActive,
            offline_message: botOfflineMessage,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        setBotSwitchLoading(false);
        setBotSwitchSaved(true);
        setTimeout(() => setBotSwitchSaved(false), 3000);
    }

    function openCreateVendorModal() {
        setCreateVendorMsg("");
        setCreateVendorErr("");
        setVendorForm({
            businessName: "",
            ownerName: "",
            email: "",
            phone: "",
            password: randomPassword(),
        });
        setShowCreateVendorModal(true);
    }

    function closeCreateVendorModal() {
        if (creatingVendor) return;
        setShowCreateVendorModal(false);
    }

    async function createVendor(e) {
        e.preventDefault();
        if (creatingVendor) return;
        setCreateVendorMsg("");
        setCreateVendorErr("");

        if (!vendorForm.businessName.trim() || !vendorForm.ownerName.trim() || !vendorForm.email.trim() || !vendorForm.phone.trim()) {
            setCreateVendorErr("Please fill in all required fields.");
            return;
        }

        setCreatingVendor(true);
        try {
            const r = await fetch(API + "/api/admin/create-vendor", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
                body: JSON.stringify({
                    businessName: vendorForm.businessName.trim(),
                    ownerName: vendorForm.ownerName.trim(),
                    email: vendorForm.email.trim(),
                    phone: vendorForm.phone.trim(),
                    password: vendorForm.password.trim(),
                })
            });
            const data = await r.json();
            if (!r.ok || data.error) {
                setCreateVendorErr(data.error || "Could not create vendor.");
                setCreatingVendor(false);
                return;
            }

            setCreateVendorMsg("Vendor created successfully.");
            await fetchAll();
            setTimeout(() => {
                setShowCreateVendorModal(false);
                setCreateVendorMsg("");
            }, 900);
        } catch (err) {
            if (await handleAuthError(err)) return;
            setCreateVendorErr(err.message || "Could not create vendor.");
        } finally {
            setCreatingVendor(false);
        }
    }

    // Stats
    const pending = businesses.filter(b => b.status === "pending");
    const active = businesses.filter(b => b.status === "active");
    const today = new Date().toDateString();
    const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today);

    function bizOrders(name) { return orders.filter(o => o.business_name === name); }
    function bizRevenue(name) { return orders.filter(o => o.business_name === name && o.payment_status === "paid").reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0); }
    const bizByName = businesses.reduce((acc, biz) => ({ ...acc, [biz.name]: biz }), {});

    function orderPlatformCut(order, biz) {
        if (!biz || order.payment_status !== "paid") return 0;
        const orderAmount = parseFloat(order.total_amount) || 0;
        const commissionType = biz.commission_type || "flat";
        const commissionValue = parseFloat(biz.commission_value) || 0;
        if (commissionType === "percent") return (orderAmount * commissionValue) / 100;
        if (commissionType === "flat") return commissionValue;
        return 0;
    }

    // MoMo payments land in the DelivaGH Kora account; cash goes straight to the vendor.
    // The vendor is owed the MoMo money minus the platform's commission on all paid orders.
    function bizPayout(name) {
        const paid = orders.filter(o => o.business_name === name && o.payment_status === "paid");
        const sum = list => list.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
        const momo = sum(paid.filter(o => o.payment_method === "momo"));
        const cash = sum(paid.filter(o => o.payment_method !== "momo"));
        const commission = bizPlatformEarnings(name);
        return { momo, cash, commission, owed: momo - commission };
    }

    function bizPlatformEarnings(name) {
        const biz = bizByName[name];
        return orders.filter(o => o.business_name === name).reduce((sum, order) => sum + orderPlatformCut(order, biz), 0);
    }

    const platformRevenueByRules = orders.reduce((sum, order) => {
        const biz = bizByName[order.business_name];
        return sum + orderPlatformCut(order, biz);
    }, 0);


    const whFilter = webhookFilter.trim().toLowerCase();
    const filteredWebhookLogs = whFilter
        ? webhookLogs.filter((row) => {
            const hay = [row.body, row.business_name, row.customer_phone, row.outcome, row.skip_reason, row.reply_preview, row.error_message, row.message_id, row.source]
                .filter(Boolean).join(" ").toLowerCase();
            return hay.includes(whFilter);
        })
        : webhookLogs;

    // ── Presentation ────────────────────────────────────────────
    const money = n => (parseFloat(n) || 0).toFixed(2);
    const shortId = id => "#" + String(id || "").substring(0, 8).toUpperCase();
    const phoneOf = p => String(p || "").replace(/^whatsapp:/i, "");
    const dateOf = iso => iso ? new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" }) : "—";
    const paidTotal = orders.filter(o => o.payment_status === "paid").reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
    const statusTag = status => {
        const map = { active: ["is-accent", "Active"], pending: ["is-attn", "Waiting for approval"], suspended: ["", "Suspended"], rejected: ["is-danger", "Rejected"] };
        const [cls, label] = map[status] || map.pending;
        return <span className={"dx-tag " + cls}>{label}</span>;
    };
    const orderTag = o => {
        const map = { pending: ["is-attn", "New"], confirmed: ["is-accent", "Accepted"], preparing: ["is-accent", "Preparing"], ready: ["is-accent", "Ready"], delivered: ["is-plain is-outline", "Delivered"], rejected: ["is-danger", "Rejected"], cancelled: ["is-danger", "Cancelled"] };
        const [cls, label] = map[o.status] || ["", o.status || "—"];
        return <span className={"dx-tag " + cls}>{label}</span>;
    };
    const outcomeTag = outcome => {
        const x = (outcome || "").toLowerCase();
        const cls = x === "replied" ? "is-accent" : x === "skipped" ? "is-attn" : x === "no_reply" ? "" : "is-danger";
        return <span className={"dx-tag " + cls}>{outcome || "—"}</span>;
    };
    const health_ = status => {
        const map = { ok: ["is-ok", "Working"], warn: ["is-warn", "Needs a look"], error: ["is-down", "Down"], checking: ["", "Checking…"] };
        const [cls, label] = map[status] || ["", "Unknown"];
        return <span className={"dx-health " + cls}><span className="dx-led" />{label}</span>;
    };
    const commissionText = biz => biz.commission_type === "percent" ? `${parseFloat(biz.commission_value || 0)}%`
        : biz.commission_type === "none" ? "None" : `GHS ${money(biz.commission_value)}`;
    const shopInitial = name => (name || "?").trim().charAt(0).toUpperCase();
    const themeName = theme === "dark" ? "dark" : "light";
    const toggleTheme = () => setTheme(themeName === "dark" ? "light" : "dark");
    const flashIsError = /^(Could not|Action failed|Bot resync failed)/.test(saveMsg);

    const pageNames = {
        overview: "Overview", approvals: "Approvals", businesses: "Shops", customers: "Customers", payments: "Payouts",
        analytics: "Analytics", botcontrol: "Bot switch", webhooks: "Message log", health: "System health", botconfig: "Bot settings",
    };
    const navGroups = [
        { label: "Platform", items: [
            { id: "overview", label: "Overview", icon: "today" },
            { id: "approvals", label: "Approvals", icon: "approvals", badge: pending.length },
            { id: "businesses", label: "Shops", icon: "store" },
            { id: "customers", label: "Customers", icon: "customers" },
            { id: "payments", label: "Payouts", icon: "coins" },
            { id: "analytics", label: "Analytics", icon: "insights" },
        ] },
        { label: "Bot", items: [
            { id: "botcontrol", label: "Bot switch", icon: "power" },
            { id: "webhooks", label: "Message log", icon: "webhook" },
            { id: "health", label: "System health", icon: "pulse" },
        ] },
    ];
    const allNav = navGroups.flatMap(g => g.items);
    const go = id => { if (id === "payments") setSelectedBiz(null); setActivePage(id); window.scrollTo({ top: 0 }); };
    const shopsShown = bizFilter === "all" ? businesses : businesses.filter(b => (b.status || "pending") === bizFilter);
    const Brand = ({ sub }) => <div className="dx-wordmark">Delivagh<i>.</i>{sub && <small>{sub}</small>}</div>;

    if (!supabase) return (
        <div className="dx" data-theme={themeName}><div className="dx-center">
            <div className="dx-card is-wide">
                <Brand sub="Admin" />
                <h1 className="dx-title-sm">The admin panel isn't configured</h1>
                <p className="dx-sub">Set <code className="mono">VITE_SUPABASE_URL</code> and <code className="mono">VITE_SUPABASE_KEY</code> in the Vercel environment variables, then redeploy.</p>
            </div>
        </div></div>
    );

    if (!authed) return (
        <div className="dx" data-theme={themeName}><div className="dx-center">
            <div className="dx-card">
                <div className="dx-spread" style={{ alignItems: "flex-start" }}>
                    <Brand sub="Admin" />
                    <button type="button" className="dx-icon-btn" aria-label={themeName === "dark" ? "Use light theme" : "Use dark theme"} onClick={toggleTheme}>
                        <Icon name={themeName === "dark" ? "sun" : "moon"} />
                    </button>
                </div>
                <h1 className="dx-title-sm">Sign in</h1>
                <p className="dx-sub" style={{ marginBottom: 20 }}>For the Delivagh team only.</p>
                <form className="dx-stack" style={{ gap: 12 }} onSubmit={e => { e.preventDefault(); if (!loggingIn) handleLogin(); }}>
                    <label className="dx-field"><span className="dx-label">Admin password</span>
                        <input className={"dx-input" + (pwError ? " is-invalid" : "")} type="password" autoComplete="current-password" autoFocus value={pwInput} onChange={e => setPwInput(e.target.value)} /></label>
                    {pwError && <p className="dx-msg is-error" role="alert">{pwError}</p>}
                    <button type="submit" className="dx-btn is-primary is-lg is-block" disabled={loggingIn}>{loggingIn ? "Checking…" : "Sign in"}</button>
                </form>
            </div>
        </div></div>
    );

    return (
        <div className="dx" data-theme={themeName}>
            <div className="dx-shell">
                <aside className="dx-side" aria-label="Admin navigation">
                    <div className="dx-brand"><Brand sub="Admin" /></div>
                    <nav className="dx-nav">
                        {navGroups.map(group => (
                            <React.Fragment key={group.label}>
                                <div className="dx-nav-label">{group.label}</div>
                                {group.items.map(item => (
                                    <button key={item.id} type="button" className="dx-nav-item" onClick={() => go(item.id)}
                                        aria-current={activePage === item.id || (item.id === "businesses" && activePage === "botconfig") ? "page" : undefined}>
                                        <Icon name={item.icon} /><span>{item.label}</span>
                                        {item.badge > 0 && <span className="dx-count">{item.badge}</span>}
                                    </button>
                                ))}
                            </React.Fragment>
                        ))}
                    </nav>
                    <div className="dx-side-foot">
                        <button type="button" className="dx-nav-item" onClick={toggleTheme}><Icon name={themeName === "dark" ? "sun" : "moon"} /><span>{themeName === "dark" ? "Light theme" : "Dark theme"}</span></button>
                        <button type="button" className="dx-nav-item" onClick={() => { setAdminKey(""); setAuthed(false); }}><Icon name="logout" /><span>Sign out</span></button>
                    </div>
                </aside>

                <main className="dx-main">
                    <header className="dx-top">
                        <div className="dx-row" style={{ flexWrap: "nowrap", minWidth: 0 }}>
                            <div className="dx-show-phone dx-wordmark" style={{ fontSize: 22 }}>Delivagh<i>.</i></div>
                            <span className="dx-crumb dx-hide-phone">Admin / <strong>{pageNames[activePage] || "Overview"}</strong></span>
                        </div>
                        <div className="dx-top-actions">
                            <button type="button" className="dx-btn is-sm" onClick={resyncBotBusinesses} disabled={resyncingBot} title="Re-list every active shop in the bot's shop picker">
                                <Icon name="bot" size={15} />{resyncingBot ? "Syncing…" : <span className="dx-hide-phone">Resync bot shops</span>}
                            </button>
                            <button type="button" className="dx-icon-btn" aria-label="Reload data" onClick={() => { fetchAll(); checkHealth(); }}><Icon name="refresh" /></button>
                            <button type="button" className="dx-icon-btn dx-show-phone" aria-label={themeName === "dark" ? "Use light theme" : "Use dark theme"} onClick={toggleTheme}><Icon name={themeName === "dark" ? "sun" : "moon"} /></button>
                        </div>
                    </header>

                    <div className="dx-content">
                        {/* Phone navigation */}
                        <div className="dx-seg dx-show-phone" role="group" aria-label="Admin pages" style={{ marginBottom: 16, display: "flex" }}>
                            {allNav.map(item => (
                                <button key={item.id} type="button" aria-pressed={activePage === item.id} onClick={() => go(item.id)}>
                                    {item.label}{item.badge > 0 && <span className="dx-count">{item.badge}</span>}
                                </button>
                            ))}
                        </div>

                        {saveMsg && activePage !== "botconfig" && (
                            <p className={"dx-msg " + (flashIsError ? "is-error" : "is-ok")} role="status" style={{ marginBottom: 16 }}>{saveMsg.replace(/ ✓$/, ".")}</p>
                        )}

                        {/* OVERVIEW */}
                        {activePage === "overview" && (
                            <div className="dx-stack" style={{ gap: 24 }}>
                                <div className="dx-page-head" style={{ marginBottom: 0 }}>
                                    <div>
                                        <p className="dx-crumb" style={{ margin: 0 }}>{new Date().toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long" })}</p>
                                        <h1 className="dx-title" style={{ marginTop: 6 }}>Overview</h1>
                                    </div>
                                </div>
                                {pending.length > 0 && (
                                    <div className="dx-panel dx-panel-body dx-spread" style={{ background: "var(--attn-soft)", borderColor: "var(--attn-line)" }}>
                                        <div>
                                            <strong>{pending.length} {pending.length === 1 ? "shop is" : "shops are"} waiting for approval</strong>
                                            <div className="dx-hint" style={{ color: "var(--ink-2)" }}>{pending.map(b => b.name).join(", ")}</div>
                                        </div>
                                        <button type="button" className="dx-btn" onClick={() => go("approvals")}>Review</button>
                                    </div>
                                )}
                                <div className="dx-kpis">
                                    <div className="dx-kpi"><p className="dx-kpi-label">Live shops</p><p className="dx-kpi-value">{active.length}</p><p className="dx-kpi-note">{businesses.length} signed up</p></div>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Orders today</p><p className="dx-kpi-value">{todayOrders.length}</p><p className="dx-kpi-note">{orders.length} in the last 500</p></div>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Paid order value</p><p className="dx-kpi-value"><small>GHS</small>{money(paidTotal)}</p><p className="dx-kpi-note">All shops</p></div>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Platform earnings</p><p className="dx-kpi-value"><small>GHS</small>{money(platformRevenueByRules)}</p><p className="dx-kpi-note">From each shop's commission</p></div>
                                </div>
                                <div className="dx-grid-2">
                                    <section className="dx-panel">
                                        <div className="dx-panel-head"><h2 className="dx-panel-title">Latest orders</h2><span className="dx-hint">All shops</span></div>
                                        {orders.length === 0 ? <div className="dx-empty"><p>No orders yet.</p></div> : (
                                            <div className="dx-table-wrap">
                                                <table className="dx-table">
                                                    <thead><tr><th>Order</th><th>Shop</th><th className="is-right">GHS</th><th>Status</th></tr></thead>
                                                    <tbody>
                                                        {orders.slice(0, 8).map(o => (
                                                            <tr key={o.id}>
                                                                <td><div className="mono">{shortId(o.id)}</div><div className="dx-cell-sub num">{new Date(o.created_at).toLocaleString("en-GH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div></td>
                                                                <td><div className="dx-cell-main truncate" style={{ maxWidth: 200 }}>{o.business_name}</div><div className="dx-cell-sub">{o.customer_name || phoneOf(o.customer_phone)}</div></td>
                                                                <td className="is-right dx-price">{money(o.total_amount)}</td>
                                                                <td>{orderTag(o)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </section>
                                    <section className="dx-panel">
                                        <div className="dx-panel-head"><h2 className="dx-panel-title">System</h2><button type="button" className="dx-link" onClick={() => go("health")}>Details</button></div>
                                        <div className="dx-list">
                                            {[["Backend API", health.backend], ["Database", health.supabase], ["WhatsApp bot", health.groq]].map(([label, st]) => (
                                                <div key={label} className="dx-list-row"><span style={{ flex: 1 }}>{label}</span>{health_(st)}</div>
                                            ))}
                                            <div className="dx-list-row"><span style={{ flex: 1 }}>Bot replies</span><span className={"dx-tag " + (botActive ? "is-accent" : "is-danger")}>{botActive ? "On" : "Off for everyone"}</span></div>
                                        </div>
                                        <div className="dx-panel-body" style={{ borderTop: "1px solid var(--line)", paddingTop: 12, paddingBottom: 14 }}>
                                            <p className="dx-hint">Last order {lastOrder ? `${new Date(lastOrder.created_at).toLocaleString("en-GH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} at ${lastOrder.business_name}` : "— none yet"}</p>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}

                        {/* APPROVALS */}
                        {activePage === "approvals" && (
                            <div>
                                <div className="dx-page-head">
                                    <div>
                                        <h1 className="dx-title">Approvals</h1>
                                        <p className="dx-sub">New shops can't take orders until you approve them. Approving adds the shop to the bot.</p>
                                    </div>
                                </div>
                                {pending.length === 0 ? (
                                    <div className="dx-panel dx-empty"><h3>Nothing to review</h3><p>New sign-ups show up here.</p></div>
                                ) : (
                                    <div className="dx-stack">
                                        {pending.map(biz => (
                                            <article key={biz.id} className="dx-panel">
                                                <div className="dx-panel-body dx-spread" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                                                    <div className="dx-row" style={{ alignItems: "flex-start", gap: 14, flexWrap: "nowrap" }}>
                                                        <div className="dx-avatar" style={{ width: 44, height: 44, borderRadius: 12, fontSize: 18 }}>{shopInitial(biz.name)}</div>
                                                        <div>
                                                            <h2 className="dx-panel-title" style={{ fontSize: 16 }}>{biz.name}</h2>
                                                            <p className="dx-hint">Signed up {new Date(biz.created_at).toLocaleString("en-GH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                                                            <dl className="dx-dl" style={{ marginTop: 12, gridTemplateColumns: "80px minmax(0,1fr)" }}>
                                                                {biz.owner_name && <><dt>Owner</dt><dd>{biz.owner_name}</dd></>}
                                                                <dt>Phone</dt><dd className="num">{biz.phone || "Not given"}</dd>
                                                                <dt>Email</dt><dd>{String(biz.email || "").includes("@") ? biz.email : "Not loaded"}</dd>
                                                                {biz.bot_type && <><dt>Type</dt><dd style={{ textTransform: "capitalize" }}>{String(biz.bot_type).replace("_", " ")}</dd></>}
                                                            </dl>
                                                        </div>
                                                    </div>
                                                    <div className="dx-row">
                                                        <button type="button" className="dx-btn is-ghost" onClick={() => openBotConfig(biz)}>Bot settings</button>
                                                        <button type="button" className="dx-btn is-danger" onClick={() => rejectBusiness(biz.id)} disabled={!!actionLoading[biz.id]}>{actionLoading[biz.id] === "rejecting" ? "Rejecting…" : "Reject"}</button>
                                                        <button type="button" className="dx-btn is-primary" onClick={() => approveBusiness(biz.id)} disabled={!!actionLoading[biz.id]}>{actionLoading[biz.id] === "approving" ? "Approving…" : "Approve"}</button>
                                                    </div>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* SHOPS */}
                        {activePage === "businesses" && (
                            <div>
                                <div className="dx-page-head">
                                    <div>
                                        <h1 className="dx-title">Shops</h1>
                                        <p className="dx-sub">Every shop on Delivagh, its bot settings and payouts.</p>
                                    </div>
                                    <button type="button" className="dx-btn is-primary" onClick={openCreateVendorModal}><Icon name="plus" size={16} />Add shop</button>
                                </div>
                                <div className="dx-seg" role="group" aria-label="Filter shops" style={{ marginBottom: 14 }}>
                                    {[["all", "All"], ["active", "Active"], ["pending", "Waiting"], ["suspended", "Suspended"], ["rejected", "Rejected"]].map(([id, label]) => (
                                        <button key={id} type="button" aria-pressed={bizFilter === id} onClick={() => setBizFilter(id)}>
                                            {label}<span className="num">{id === "all" ? businesses.length : businesses.filter(b => (b.status || "pending") === id).length}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="dx-panel">
                                    {shopsShown.length === 0 ? <div className="dx-empty"><p>No shops here.</p></div> : (
                                        <>
                                            <div className="dx-table-wrap dx-hide-phone">
                                                <table className="dx-table">
                                                    <thead><tr><th>Shop</th><th>Status</th><th className="is-right">Orders</th><th className="is-right">Paid (GHS)</th><th>Commission</th><th>Joined</th><th><span className="sr-only">Actions</span></th></tr></thead>
                                                    <tbody>
                                                        {shopsShown.map(biz => (
                                                            <tr key={biz.id}>
                                                                <td>
                                                                    <div className="dx-row" style={{ flexWrap: "nowrap", gap: 10 }}>
                                                                        <div className="dx-avatar">{shopInitial(biz.name)}</div>
                                                                        <div style={{ minWidth: 0 }}><div className="dx-cell-main truncate">{biz.name}</div><div className="dx-cell-sub truncate">{String(biz.email || "").includes("@") ? biz.email : phoneOf(biz.phone)}</div></div>
                                                                    </div>
                                                                </td>
                                                                <td>{statusTag(biz.status || "pending")}</td>
                                                                <td className="is-right num">{bizOrders(biz.name).length}</td>
                                                                <td className="is-right dx-price">{money(bizRevenue(biz.name))}</td>
                                                                <td className="num">{commissionText(biz)}</td>
                                                                <td className="muted num nowrap">{dateOf(biz.created_at)}</td>
                                                                <td className="is-right">
                                                                    <div className="dx-row" style={{ justifyContent: "flex-end", flexWrap: "nowrap", gap: 4 }}>
                                                                        <button type="button" className="dx-btn is-sm is-ghost" onClick={() => openBotConfig(biz)}>Bot</button>
                                                                        <button type="button" className="dx-btn is-sm is-ghost" onClick={() => openPaymentConfig(biz)}>Payouts</button>
                                                                        {biz.status === "pending" && <button type="button" className="dx-btn is-sm is-primary" disabled={!!actionLoading[biz.id]} onClick={() => approveBusiness(biz.id)}>{actionLoading[biz.id] ? "…" : "Approve"}</button>}
                                                                        {biz.status === "active" && <button type="button" className="dx-btn is-sm" disabled={!!actionLoading[biz.id]} onClick={() => { if (window.confirm(`Suspend ${biz.name}? Customers won't be able to order from it.`)) suspendBusiness(biz.id, biz.status); }}>{actionLoading[biz.id] ? "…" : "Suspend"}</button>}
                                                                        {biz.status === "suspended" && <button type="button" className="dx-btn is-sm" disabled={!!actionLoading[biz.id]} onClick={() => suspendBusiness(biz.id, biz.status)}>{actionLoading[biz.id] ? "…" : "Reactivate"}</button>}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="dx-list dx-show-phone">
                                                {shopsShown.map(biz => (
                                                    <div key={biz.id} className="dx-list-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                                                        <div className="dx-spread">
                                                            <div className="dx-row" style={{ flexWrap: "nowrap", gap: 10, minWidth: 0 }}>
                                                                <div className="dx-avatar">{shopInitial(biz.name)}</div>
                                                                <div style={{ minWidth: 0 }}><div className="dx-cell-main truncate">{biz.name}</div><div className="dx-cell-sub">{bizOrders(biz.name).length} orders · GHS {money(bizRevenue(biz.name))}</div></div>
                                                            </div>
                                                            {statusTag(biz.status || "pending")}
                                                        </div>
                                                        <div className="dx-row" style={{ gap: 6 }}>
                                                            <button type="button" className="dx-btn is-sm" onClick={() => openBotConfig(biz)}>Bot</button>
                                                            <button type="button" className="dx-btn is-sm" onClick={() => openPaymentConfig(biz)}>Payouts</button>
                                                            {biz.status === "pending" && <button type="button" className="dx-btn is-sm is-primary" onClick={() => approveBusiness(biz.id)}>Approve</button>}
                                                            {biz.status === "active" && <button type="button" className="dx-btn is-sm" onClick={() => { if (window.confirm(`Suspend ${biz.name}?`)) suspendBusiness(biz.id, biz.status); }}>Suspend</button>}
                                                            {biz.status === "suspended" && <button type="button" className="dx-btn is-sm" onClick={() => suspendBusiness(biz.id, biz.status)}>Reactivate</button>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* CUSTOMERS */}
                        {activePage === "customers" && (
                            <div>
                                <div className="dx-page-head">
                                    <div>
                                        <h1 className="dx-title">Customers</h1>
                                        <p className="dx-sub">{registeredCustomers.length} people who signed up through the WhatsApp form.</p>
                                    </div>
                                </div>
                                <div className="dx-panel">
                                    {registeredCustomers.length === 0 ? (
                                        <div className="dx-empty"><h3>No sign-ups yet</h3><p>Customers appear here after they finish the WhatsApp sign-up form.</p></div>
                                    ) : (
                                        <div className="dx-table-wrap">
                                            <table className="dx-table" style={{ minWidth: 560 }}>
                                                <thead><tr><th>Name</th><th>WhatsApp</th><th>Email</th><th>Signed up</th></tr></thead>
                                                <tbody>
                                                    {registeredCustomers.map(c => (
                                                        <tr key={c.id || c.phone}>
                                                            <td className="dx-cell-main">{c.full_name || c.first_name || "—"}</td>
                                                            <td className="num">{phoneOf(c.phone)}</td>
                                                            <td className="muted">{c.email || "—"}</td>
                                                            <td className="muted num nowrap">{dateOf(c.registered_at)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* MESSAGE LOG */}
                        {activePage === "webhooks" && (
                            <div>
                                <div className="dx-page-head">
                                    <div>
                                        <h1 className="dx-title">Message log</h1>
                                        <p className="dx-sub">Live feed of messages customers send the bot, and what the bot did with each.</p>
                                    </div>
                                </div>
                                {webhookLogsError && <p className="dx-msg is-error" role="alert" style={{ marginBottom: 14 }}>{webhookLogsError}</p>}
                                <div className="dx-row" style={{ marginBottom: 14 }}>
                                    <input className="dx-input" style={{ maxWidth: 420 }} type="search" value={webhookFilter} onChange={e => setWebhookFilter(e.target.value)}
                                        placeholder="Search phone, shop, message or outcome" aria-label="Search the message log" />
                                    <span className="dx-hint num">{filteredWebhookLogs.length} {filteredWebhookLogs.length === 1 ? "message" : "messages"}</span>
                                </div>
                                <div className="dx-panel dx-table-wrap" style={{ maxHeight: "70vh" }}>
                                    <table className="dx-table" style={{ minWidth: 920 }}>
                                        <thead style={{ position: "sticky", top: 0, zIndex: 1 }}><tr><th>Time</th><th>Customer</th><th>Shop</th><th>Message</th><th>Outcome</th><th>Note or reply</th></tr></thead>
                                        <tbody>
                                            {filteredWebhookLogs.length === 0 && !webhookLogsError && (
                                                <tr><td colSpan={6}><div className="dx-empty" style={{ padding: 24 }}><p>No messages yet.</p></div></td></tr>
                                            )}
                                            {filteredWebhookLogs.map(row => {
                                                const note = row.skip_reason || row.error_message || row.reply_preview || "—";
                                                return (
                                                    <tr key={row.id} style={{ verticalAlign: "top" }}>
                                                        <td className="muted num nowrap">{row.created_at ? new Date(row.created_at).toLocaleString("en-GH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—"}</td>
                                                        <td className="num nowrap">{phoneOf(row.customer_phone) || "—"}{row.source && <div className="dx-cell-sub">{row.source}</div>}</td>
                                                        <td className="muted">{row.business_name || "—"}</td>
                                                        <td style={{ maxWidth: 280 }} title={row.body || ""}><div style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{row.body || "—"}</div></td>
                                                        <td>{outcomeTag(row.outcome)}</td>
                                                        <td className="muted" style={{ maxWidth: 320 }} title={note}><div style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{note}</div></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* SYSTEM HEALTH */}
                        {activePage === "health" && (
                            <div>
                                <div className="dx-page-head">
                                    <div>
                                        <h1 className="dx-title">System health</h1>
                                        <p className="dx-sub">Checked every 30 seconds while this page is open.</p>
                                    </div>
                                    <button type="button" className="dx-btn" onClick={checkHealth}><Icon name="refresh" size={16} />Check now</button>
                                </div>
                                <div className="dx-stack" style={{ gap: 20 }}>
                                    <section className="dx-panel dx-list">
                                        {[
                                            { label: "Backend API", sub: "api.delivagh.app", status: health.backend, detail: health.backend === "ok" ? "Responding" : "Not reachable" },
                                            { label: "Database", sub: "Supabase", status: health.supabase, detail: health.supabase === "ok" ? "Queries working" : "Connection failed" },
                                            { label: "WhatsApp bot", sub: "Webhook route and Meta settings", status: health.groq, detail: health.groq === "ok" ? "Responding, Meta settings present" : "Unreachable, or Meta settings missing" },
                                        ].map(s => (
                                            <div key={s.label} className="dx-list-row" style={{ padding: "16px 18px" }}>
                                                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{s.label}</div><div className="dx-cell-sub">{s.sub} · {s.detail}</div></div>
                                                {health_(s.status)}
                                            </div>
                                        ))}
                                        <div className="dx-list-row" style={{ padding: "16px 18px" }}>
                                            <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>WhatsApp delivery</div><div className="dx-cell-sub">Meta's own status isn't visible from here. Check Meta Business Manager if messages stop arriving.</div></div>
                                            <a className="dx-btn is-sm is-ghost" href="https://business.facebook.com/" target="_blank" rel="noopener noreferrer"><Icon name="external" size={15} />Open</a>
                                        </div>
                                    </section>
                                    <section className="dx-panel">
                                        <div className="dx-panel-head"><h2 className="dx-panel-title">Latest orders</h2><span className="dx-hint num">{orders.length} loaded · {businesses.length} shops</span></div>
                                        <div className="dx-table-wrap">
                                            <table className="dx-table">
                                                <thead><tr><th>Order</th><th>Shop</th><th>Customer</th><th className="is-right">GHS</th><th>Status</th><th>Time</th></tr></thead>
                                                <tbody>
                                                    {orders.slice(0, 10).map(o => (
                                                        <tr key={o.id}>
                                                            <td className="mono">{shortId(o.id)}</td>
                                                            <td className="dx-cell-main">{o.business_name}</td>
                                                            <td className="muted num">{phoneOf(o.customer_phone)}</td>
                                                            <td className="is-right dx-price">{money(o.total_amount)}</td>
                                                            <td>{orderTag(o)}</td>
                                                            <td className="muted num nowrap">{new Date(o.created_at).toLocaleString("en-GH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}

                        {/* ANALYTICS */}
                        {activePage === "analytics" && (
                            <div>
                                <div className="dx-page-head">
                                    <div>
                                        <h1 className="dx-title">Analytics</h1>
                                        <p className="dx-sub">Based on the latest 500 orders.</p>
                                    </div>
                                </div>
                                <div className="dx-kpis" style={{ "--cols": 3, marginBottom: 20 }}>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Paid order value</p><p className="dx-kpi-value"><small>GHS</small>{money(paidTotal)}</p></div>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Platform earnings</p><p className="dx-kpi-value"><small>GHS</small>{money(platformRevenueByRules)}</p><p className="dx-kpi-note">From each shop's commission</p></div>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Average order</p><p className="dx-kpi-value"><small>GHS</small>{money(orders.filter(o => o.total_amount).length ? orders.filter(o => o.total_amount).reduce((s, o) => s + parseFloat(o.total_amount || 0), 0) / orders.filter(o => o.total_amount).length : 0)}</p></div>
                                </div>
                                <section className="dx-panel">
                                    <div className="dx-panel-head"><h2 className="dx-panel-title">By shop</h2></div>
                                    <div className="dx-table-wrap">
                                        <table className="dx-table" style={{ minWidth: 760 }}>
                                            <thead><tr><th>Shop</th><th className="is-right">Orders</th><th className="is-right">Today</th><th className="is-right">Delivered</th><th className="is-right">Waiting</th><th className="is-right">Paid (GHS)</th><th className="is-right">Earnings (GHS)</th></tr></thead>
                                            <tbody>
                                                {businesses.map(biz => {
                                                    const bo = bizOrders(biz.name);
                                                    return (
                                                        <tr key={biz.id}>
                                                            <td><div className="dx-cell-main">{biz.name}</div><div className="dx-cell-sub">{statusTag(biz.status || "pending")}</div></td>
                                                            <td className="is-right num">{bo.length}</td>
                                                            <td className="is-right num">{bo.filter(o => new Date(o.created_at).toDateString() === today).length}</td>
                                                            <td className="is-right num">{bo.filter(o => o.status === "delivered").length}</td>
                                                            <td className={"is-right num" + (bo.some(o => o.status === "pending") ? " attn-text" : "")}>{bo.filter(o => o.status === "pending").length}</td>
                                                            <td className="is-right dx-price">{money(bizRevenue(biz.name))}</td>
                                                            <td className="is-right dx-price">{money(bizPlatformEarnings(biz.name))}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* PAYOUTS */}
                        {activePage === "payments" && (
                            <div>
                                {!selectedBiz ? (
                                    <>
                                        <div className="dx-page-head">
                                            <div>
                                                <h1 className="dx-title">Payouts</h1>
                                                <p className="dx-sub">MoMo payments land in the Delivagh Kora account. Pay each shop its share yourself, using these figures.</p>
                                            </div>
                                        </div>
                                        <div className="dx-panel dx-table-wrap">
                                            <table className="dx-table" style={{ minWidth: 640 }}>
                                                <thead><tr><th>Shop</th><th className="is-right">MoMo held</th><th className="is-right">Commission</th><th className="is-right">To pay the shop</th><th><span className="sr-only">Open</span></th></tr></thead>
                                                <tbody>
                                                    {businesses.filter(b => b.status !== "rejected").map(b => {
                                                        const p = bizPayout(b.name);
                                                        return (
                                                            <tr key={b.id} className="is-clickable" onClick={() => openPaymentConfig(b)}>
                                                                <td className="dx-cell-main">{b.name}</td>
                                                                <td className="is-right dx-price">{money(p.momo)}</td>
                                                                <td className="is-right num muted">{money(p.commission)}</td>
                                                                <td className={"is-right dx-price" + (p.owed < 0 ? " danger-text" : "")}>{p.owed < 0 ? "−" : ""}{money(Math.abs(p.owed))}</td>
                                                                <td className="is-right faint"><Icon name="chevronRight" size={16} /></td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                ) : (() => {
                                    const p = bizPayout(selectedBiz.name);
                                    return (
                                        <>
                                            <div className="dx-page-head">
                                                <div>
                                                    <button type="button" className="dx-link dx-row" style={{ gap: 4, marginBottom: 8 }} onClick={() => { setSelectedBiz(null); setPaymentMsg(""); }}><Icon name="chevronLeft" size={15} />All payouts</button>
                                                    <h1 className="dx-title">{selectedBiz.name}</h1>
                                                    <p className="dx-sub">All paid orders so far.</p>
                                                </div>
                                            </div>
                                            <div className="dx-kpis" style={{ marginBottom: 24 }}>
                                                <div className="dx-kpi"><p className="dx-kpi-label">MoMo held by Delivagh</p><p className="dx-kpi-value"><small>GHS</small>{money(p.momo)}</p><p className="dx-kpi-note">In the Kora account</p></div>
                                                <div className="dx-kpi"><p className="dx-kpi-label">Cash taken by the shop</p><p className="dx-kpi-value"><small>GHS</small>{money(p.cash)}</p><p className="dx-kpi-note">Already with them</p></div>
                                                <div className="dx-kpi"><p className="dx-kpi-label">Commission</p><p className="dx-kpi-value"><small>GHS</small>{money(p.commission)}</p><p className="dx-kpi-note">{commissionText(selectedBiz)} per paid order</p></div>
                                                <div className={"dx-kpi" + (p.owed < 0 ? " is-attn" : "")}><p className="dx-kpi-label">{p.owed >= 0 ? "To pay the shop" : "Shop owes Delivagh"}</p><p className="dx-kpi-value"><small>GHS</small>{money(Math.abs(p.owed))}</p><p className="dx-kpi-note">MoMo held minus commission</p></div>
                                            </div>
                                            <section className="dx-setting-group" style={{ paddingTop: 0, borderTop: 0 }}>
                                                <div><h2>Commission</h2><p>What Delivagh keeps from each paid order of this shop.</p></div>
                                                <form className="dx-setting-fields" onSubmit={e => { e.preventDefault(); savePaymentConfig(); }}>
                                                    <div className="dx-form-grid">
                                                        <label className="dx-field"><span className="dx-label">Type</span>
                                                            <select className="dx-select" value={paymentConfig.commission_type || "flat"} onChange={e => setPaymentConfig(c => ({ ...c, commission_type: e.target.value }))}>
                                                                <option value="flat">Fixed amount per order (GHS)</option>
                                                                <option value="percent">Percentage of the order</option>
                                                                <option value="none">No commission</option>
                                                            </select></label>
                                                        <label className="dx-field"><span className="dx-label">{paymentConfig.commission_type === "percent" ? "Percent" : "Amount (GHS)"}</span>
                                                            <input className="dx-input num" type="number" min="0" step="0.01" disabled={paymentConfig.commission_type === "none"} value={paymentConfig.commission_value ?? 0}
                                                                onChange={e => setPaymentConfig(c => ({ ...c, commission_value: e.target.value }))} /></label>
                                                    </div>
                                                    {paymentMsg && <p className={"dx-msg " + (paymentMsg.startsWith("Could not") ? "is-error" : "is-ok")} role="status">{paymentMsg}</p>}
                                                    <button type="submit" className="dx-btn is-primary" style={{ alignSelf: "flex-start" }} disabled={paymentSaving}>{paymentSaving ? "Saving…" : "Save commission"}</button>
                                                </form>
                                            </section>
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {/* BOT SETTINGS (per shop) */}
                        {activePage === "botconfig" && selectedBiz && (
                            <div>
                                <div className="dx-page-head">
                                    <div>
                                        <button type="button" className="dx-link dx-row" style={{ gap: 4, marginBottom: 8 }} onClick={() => go("businesses")}><Icon name="chevronLeft" size={15} />Shops</button>
                                        <h1 className="dx-title">{selectedBiz.name}</h1>
                                        <p className="dx-sub">What this shop's WhatsApp bot knows and how it talks.</p>
                                    </div>
                                </div>
                                <form className="dx-settings" onSubmit={e => { e.preventDefault(); saveBotConfig(); }}>
                                    <section className="dx-setting-group">
                                        <div><h2>Kind of shop</h2><p>Changes how the bot words things, e.g. "being prepared" or "being packed".</p></div>
                                        <div className="dx-setting-fields">
                                            <div role="radiogroup" aria-label="Kind of shop" className="dx-choice-grid">
                                                {[
                                                    { id: "food", label: "Restaurant", desc: "Meals, delivery or pickup" },
                                                    { id: "food_fast", label: "Fast food", desc: "Quick orders, combos" },
                                                    { id: "chop_bar", label: "Chop bar", desc: "Local dishes, daily specials" },
                                                    { id: "bakery", label: "Bakery", desc: "Bread, cakes, pre-orders" },
                                                    { id: "grocery", label: "Groceries", desc: "Shopping lists, sizes" },
                                                    { id: "retail", label: "Shop", desc: "Clothes, phones, beauty" },
                                                ].map(type => (
                                                    <button key={type.id} type="button" role="radio" aria-checked={(botConfig.bot_type || "food") === type.id} className="dx-choice"
                                                        onClick={() => setBotConfig(c => ({ ...c, bot_type: type.id }))}>
                                                        <strong>{type.label}</strong><span>{type.desc}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </section>
                                    <section className="dx-setting-group">
                                        <div><h2>Voice</h2><p>How the bot introduces itself and sounds.</p></div>
                                        <div className="dx-setting-fields">
                                            <label className="dx-field"><span className="dx-label">Bot name</span>
                                                <input className="dx-input" value={botConfig.bot_name || ""} onChange={e => setBotConfig(c => ({ ...c, bot_name: e.target.value }))} placeholder="e.g. Esi" /></label>
                                            <label className="dx-field"><span className="dx-label">Tone</span>
                                                <textarea className="dx-textarea" rows={2} value={botConfig.bot_persona || ""} onChange={e => setBotConfig(c => ({ ...c, bot_persona: e.target.value }))} placeholder="e.g. Warm and motherly, like a friendly Ghanaian auntie." /></label>
                                            <label className="dx-field"><span className="dx-label">Welcome message</span>
                                                <textarea className="dx-textarea" rows={2} value={botConfig.bot_greeting || ""} onChange={e => setBotConfig(c => ({ ...c, bot_greeting: e.target.value }))} placeholder={`e.g. Welcome to ${selectedBiz?.name}! What can I get you?`} /></label>
                                        </div>
                                    </section>
                                    <section className="dx-setting-group">
                                        <div><h2>What the bot knows</h2><p>The bot only states facts written here or on the menu. Anything else, it tells the customer the shop will confirm.</p></div>
                                        <div className="dx-setting-fields">
                                            <label className="dx-field"><span className="dx-label">Location and pickup</span>
                                                <input className="dx-input" value={botConfig.bot_location || ""} onChange={e => setBotConfig(c => ({ ...c, bot_location: e.target.value }))} placeholder="e.g. Behind the Engineering Block, UMaT" /></label>
                                            <label className="dx-field"><span className="dx-label">Delivery areas</span>
                                                <input className="dx-input" value={botConfig.delivery_zones || ""} onChange={e => setBotConfig(c => ({ ...c, delivery_zones: e.target.value }))} placeholder="e.g. East Legon, Madina, Osu" />
                                                <span className="dx-hint">For anywhere not listed, the bot says the shop will confirm.</span></label>
                                            <label className="dx-field"><span className="dx-label">Special instructions</span>
                                                <textarea className="dx-textarea" rows={3} value={botConfig.bot_special_instructions || ""} onChange={e => setBotConfig(c => ({ ...c, bot_special_instructions: e.target.value }))} placeholder="e.g. Closed on Sundays. Ask campus customers for their hall and room number." /></label>
                                            <label className="dx-field"><span className="dx-label">Rules the bot must follow</span>
                                                <input className="dx-input" value={botConfig.bot_boundaries || ""} onChange={e => setBotConfig(c => ({ ...c, bot_boundaries: e.target.value }))} placeholder="e.g. Only talk about our food. Never mention other shops." /></label>
                                            <label className="dx-field"><span className="dx-label">Extra information <span className="faint" style={{ fontWeight: 400 }}>(optional)</span></span>
                                                <textarea className="dx-textarea" rows={4} value={botConfig.business_context || ""} onChange={e => setBotConfig(c => ({ ...c, business_context: e.target.value }))} placeholder="Anything else, e.g. 'We cater for events. Large orders need a day's notice.'" /></label>
                                        </div>
                                    </section>
                                    <section className="dx-setting-group">
                                        <div><h2>Orders</h2><p>Limits the bot checks at checkout.</p></div>
                                        <div className="dx-setting-fields">
                                            <label className="dx-field" style={{ maxWidth: 220 }}><span className="dx-label">Minimum order (GHS)</span>
                                                <input className="dx-input num" type="number" min="0" step="1" value={botConfig.min_order_amount || ""} onChange={e => setBotConfig(c => ({ ...c, min_order_amount: e.target.value }))} placeholder="0" />
                                                <span className="dx-hint">0 means no minimum.</span></label>
                                        </div>
                                    </section>
                                    <div className="dx-savebar">
                                        <span className={saveMsg ? (flashIsError ? "danger-text" : "accent-text") : "dx-hint"} role="status" style={{ fontSize: 13, fontWeight: saveMsg ? 550 : 400 }}>
                                            {saveMsg ? saveMsg.replace("Saved!", "Saved. The bot uses the new settings from the next message.") : "Changes apply to the bot's next reply."}
                                        </span>
                                        <button type="submit" className="dx-btn is-primary" disabled={saving}>{saving ? "Saving…" : "Save bot settings"}</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* BOT SWITCH */}
                        {activePage === "botcontrol" && (
                            <div>
                                <div className="dx-page-head">
                                    <div>
                                        <h1 className="dx-title">Bot switch</h1>
                                        <p className="dx-sub">Turns the bot off for every shop at once. Use it for maintenance or an emergency.</p>
                                    </div>
                                </div>
                                <form className="dx-stack" style={{ maxWidth: 640, gap: 18 }} onSubmit={e => {
                                    e.preventDefault();
                                    if (!botActive && !window.confirm("Turn the bot off for every shop? Customers will only get the offline message.")) return;
                                    saveBotSwitch();
                                }}>
                                    <div className={"dx-panel dx-panel-body dx-spread"} style={botActive ? undefined : { background: "var(--danger-soft)", borderColor: "var(--danger-line)" }}>
                                        <div>
                                            <strong style={{ fontSize: 16 }}>{botActive ? "The bot is replying to customers" : "The bot is off for everyone"}</strong>
                                            <p className="dx-hint" style={{ marginTop: 2 }}>{botActive ? "Switch off and save to send the offline message instead." : "Customers get the offline message below."}</p>
                                        </div>
                                        <button type="button" role="switch" aria-checked={botActive} aria-label="Bot replies" className="dx-switch" onClick={() => setBotActive(v => !v)} />
                                    </div>
                                    <label className="dx-field"><span className="dx-label">Offline message</span>
                                        <textarea className="dx-textarea" rows={3} value={botOfflineMessage} onChange={e => setBotOfflineMessage(e.target.value)} /></label>
                                    <div className="dx-chat" aria-label="Preview"><div className="dx-bubble">{botOfflineMessage || <span className="faint">Offline message</span>}<small>now</small></div></div>
                                    <div className="dx-row">
                                        <button type="submit" className="dx-btn is-primary" disabled={botSwitchLoading}>{botSwitchLoading ? "Saving…" : "Save"}</button>
                                        {botSwitchSaved && <span className="accent-text dx-row" style={{ gap: 4, fontSize: 13, fontWeight: 550 }}><Icon name="check" size={15} />Saved</span>}
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {showCreateVendorModal && (
                <div className="dx-overlay" onClick={closeCreateVendorModal}>
                    <form className="dx-sheet" role="dialog" aria-modal="true" aria-label="Add a shop" onClick={e => e.stopPropagation()} onSubmit={createVendor}>
                        <div className="dx-sheet-head">
                            <div>
                                <h2 className="dx-title-sm">Add a shop</h2>
                                <p className="dx-sub" style={{ marginTop: 4 }}>Creates the owner's login and the shop together.</p>
                            </div>
                            <button type="button" className="dx-icon-btn" aria-label="Close" onClick={closeCreateVendorModal}><Icon name="close" /></button>
                        </div>
                        <div className="dx-sheet-body">
                            <label className="dx-field"><span className="dx-label">Shop name</span>
                                <input className="dx-input" required value={vendorForm.businessName} onChange={e => setVendorForm(p => ({ ...p, businessName: e.target.value }))} placeholder="e.g. Auntie Esi's Kitchen" /></label>
                            <label className="dx-field"><span className="dx-label">Owner's full name</span>
                                <input className="dx-input" required value={vendorForm.ownerName} onChange={e => setVendorForm(p => ({ ...p, ownerName: e.target.value }))} placeholder="e.g. Esi Quansah" /></label>
                            <div className="dx-form-grid">
                                <label className="dx-field"><span className="dx-label">Email</span>
                                    <input className="dx-input" type="email" required value={vendorForm.email} onChange={e => setVendorForm(p => ({ ...p, email: e.target.value }))} placeholder="owner@example.com" /></label>
                                <label className="dx-field"><span className="dx-label">WhatsApp number</span>
                                    <input className="dx-input num" type="tel" required value={vendorForm.phone} onChange={e => setVendorForm(p => ({ ...p, phone: e.target.value }))} placeholder="024 123 4567" /></label>
                            </div>
                            <div className="dx-field">
                                <label className="dx-label" htmlFor="vendor-pw">Temporary password</label>
                                <div className="dx-row" style={{ flexWrap: "nowrap" }}>
                                    <input id="vendor-pw" className="dx-input mono" value={vendorForm.password} onChange={e => setVendorForm(p => ({ ...p, password: e.target.value }))} />
                                    <button type="button" className="dx-btn" onClick={() => setVendorForm(p => ({ ...p, password: randomPassword() }))}>New</button>
                                </div>
                                <span className="dx-hint">Send it to the owner privately. They can change it in Settings.</span>
                            </div>
                            {createVendorErr && <p className="dx-msg is-error" role="alert">{createVendorErr}</p>}
                            {createVendorMsg && <p className="dx-msg is-ok" role="status">Shop created.</p>}
                        </div>
                        <div className="dx-sheet-foot">
                            <button type="button" className="dx-btn" onClick={closeCreateVendorModal} disabled={creatingVendor}>Cancel</button>
                            <button type="submit" className="dx-btn is-primary" disabled={creatingVendor}>{creatingVendor ? "Creating…" : "Create shop"}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
