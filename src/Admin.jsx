import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const ADMIN_PASSWORD = "delivagh_admin_2024";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://api.delivagh.app";
const API = BACKEND_URL;

export default function Admin() {
    const [authed, setAuthed] = useState(() => sessionStorage.getItem("admin_auth") === "true");
    const [pwInput, setPwInput] = useState("");
    const [pwError, setPwError] = useState("");
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
    const [loading, setLoading] = useState(true);
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
    const [webhookLogs, setWebhookLogs] = useState([]);
    const [webhookLogsError, setWebhookLogsError] = useState("");
    const [webhookFilter, setWebhookFilter] = useState("");
    const [theme, setTheme] = useState(() => localStorage.getItem("admin_theme") || "dark");

    // Bot Learnings
    const [learnings, setLearnings] = useState([]);
    const [learningsLoading, setLearningsLoading] = useState(false);
    const [learningsFilter, setLearningsFilter] = useState("pending");
    const [learningsBiz, setLearningsBiz] = useState("all");

    const themes = {
        dark: {
            bg: "#080f0a", bg2: "#0d1610", bg3: "#122019", card: "#101b14",
            border: "rgba(255,255,255,0.10)", text: "#ecfdf3", muted: "rgba(236,253,243,0.62)", strongMuted: "rgba(236,253,243,0.8)",
            hover: "rgba(255,255,255,0.06)", input: "rgba(255,255,255,0.06)", inputBorder: "rgba(255,255,255,0.12)", shadow: "0 8px 20px rgba(0,0,0,0.28)",
        },
        light: {
            bg: "#f0fdf4", bg2: "#ffffff", bg3: "#f7fff9", card: "#ffffff",
            border: "#d1fae5", text: "#052e16", muted: "#166534", strongMuted: "#065f46",
            hover: "#ecfdf5", input: "#ffffff", inputBorder: "#a7f3d0", shadow: "0 8px 20px rgba(6,95,70,0.08)",
        },
    };
    const d = themes[theme] || themes.dark;
    const isDark = theme === "dark";
    const accent = "#22c55e";
    const accentSoft = isDark ? "rgba(34,197,94,0.12)" : "#ecfdf5";

    function handleLogin() {
        if (pwInput === ADMIN_PASSWORD) {
            sessionStorage.setItem("admin_auth", "true");
            setAuthed(true);
        } else {
            setPwError("Incorrect password");
            setTimeout(() => setPwError(""), 3000);
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

    useEffect(() => {
        localStorage.setItem("admin_theme", theme);
        document.body.style.background = d.bg;
    }, [theme, d.bg]);

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
    }, [supabase, authed, activePage]);

    useEffect(() => {
        if (!supabase || !authed || activePage !== "learnings") return;
        fetchLearnings();
    }, [authed, activePage]);

    async function fetchAll() {
        setLoading(true);
        const [{ data: biz }, { data: ord }] = await Promise.all([
            supabase.from("businesses").select("*").order("created_at", { ascending: false }),
            supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
        ]);
        if (biz) setBusinesses(biz);
        if (ord) {
            setOrders(ord);
            setLastOrder(ord[0] || null);
        }
        setLoading(false);
    }

    async function fetchLearnings() {
        setLearningsLoading(true);
        const { data } = await supabase
            .from("bot_learnings")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(200);
        setLearnings(data || []);
        setLearningsLoading(false);
    }

    async function approveLearning(id) {
        await supabase.from("bot_learnings").update({
            status: "approved",
            approved_by: "admin",
            approved_at: new Date().toISOString()
        }).eq("id", id);
        setLearnings(prev => prev.map(l => l.id === id ? { ...l, status: "approved" } : l));
    }

    async function rejectLearning(id) {
        await supabase.from("bot_learnings").update({ status: "rejected" }).eq("id", id);
        setLearnings(prev => prev.map(l => l.id === id ? { ...l, status: "rejected" } : l));
    }

    async function deleteLearning(id) {
        await supabase.from("bot_learnings").delete().eq("id", id);
        setLearnings(prev => prev.filter(l => l.id !== id));
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
            const r = await fetch(API + "/whatsapp/health", { signal: AbortSignal.timeout(5000) });
            setHealth(h => ({ ...h, groq: r.ok ? "ok" : "warn" }));
        } catch { setHealth(h => ({ ...h, groq: "warn" })); }
    }

    async function approveBusiness(id) {
        setActionLoading(p => ({ ...p, [id]: "approving" }));
        const biz = businesses.find(b => b.id === id);
        if (!biz) { setActionLoading(p => ({ ...p, [id]: null })); return; }

        const r = await fetch(API + "/admin/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_PASSWORD },
            body: JSON.stringify({ id, businessName: biz.name, phone: biz.phone, botGreeting: biz.bot_greeting })
        });
        const data = await r.json();

        if (!r.ok || data.error) {
            setSaveMsg("Could not approve: " + (data.error || "unknown error"));
        } else {
            setSaveMsg(biz.name + " approved and live on bot ✓");
            setBusinesses(prev => prev.map(b => b.id === id ? { ...b, status: "active" } : b));
        }
        setTimeout(() => setSaveMsg(""), 4000);
        setActionLoading(p => ({ ...p, [id]: null }));
        await fetchAll();
    }

    async function rejectBusiness(id) {
        if (!window.confirm("Reject and delete this business account?")) return;
        setActionLoading(p => ({ ...p, [id]: "rejecting" }));
        const biz = businesses.find(b => b.id === id);
        if (!biz) { setActionLoading(p => ({ ...p, [id]: null })); return; }

        const r = await fetch(API + "/admin/reject", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_PASSWORD },
            body: JSON.stringify({ id, businessName: biz.name })
        });

        if (r.ok) {
            setBusinesses(prev => prev.map(b => b.id === id ? { ...b, status: "rejected" } : b));
            setSaveMsg(biz.name + " rejected ✓");
            setTimeout(() => setSaveMsg(""), 4000);
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
            headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_PASSWORD },
            body: JSON.stringify({ id, businessName: biz.name, newStatus, phone: biz.phone, botGreeting: biz.bot_greeting })
        });
        const data = await r.json();

        if (!r.ok || data.error) {
            setSaveMsg("Action failed: " + (data.error || "unknown error"));
        } else {
            setSaveMsg(biz.name + (newStatus === "suspended" ? " suspended ✓" : " reactivated ✓"));
            setBusinesses(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
        }
        setTimeout(() => setSaveMsg(""), 4000);
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

        let finalContext = (botConfig.business_context || "").trim();
        if (!finalContext) {
            const parts = [];
            if (botConfig.bot_persona?.trim()) parts.push("PERSONA & VIBE:\n" + botConfig.bot_persona.trim());
            if (botConfig.bot_location?.trim()) parts.push("LOCATION & PICKUP:\n" + botConfig.bot_location.trim());
            if (botConfig.bot_special_instructions?.trim()) parts.push("SPECIAL INSTRUCTIONS:\n" + botConfig.bot_special_instructions.trim());
            if (botConfig.bot_boundaries?.trim()) parts.push("BOUNDARIES (strictly follow):\n" + botConfig.bot_boundaries.trim());
            finalContext = parts.join("\n\n");
        }

        const r = await fetch(API + "/admin/update-bot-config", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_PASSWORD },
            body: JSON.stringify({ id: selectedBiz.id, ...botConfig, business_context: finalContext })
        });

        const data = await r.json();
        if (!r.ok || data.error) {
            setSaveMsg("Could not save: " + (data.error || "unknown error"));
        } else {
            setSaveMsg("Saved!");
        }
        setTimeout(() => setSaveMsg(""), 3000);
        setSaving(false);
        await fetchAll();
    }

    function openPaymentConfig(biz) {
        setSelectedBiz(biz);
        setPaymentConfig({
            subaccount_code: biz.subaccount_code || "",
            split_code: biz.split_code || biz.subaccount_code || "",
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
            subaccount_code: (paymentConfig.subaccount_code || "").trim(),
            split_code: (paymentConfig.subaccount_code || "").trim(),
            commission_type: paymentConfig.commission_type || "flat",
            commission_value: parseFloat(paymentConfig.commission_value) || 0,
        };
        const { error } = await supabase.from("businesses").update(payload).eq("id", selectedBiz.id);
        if (error) {
            setPaymentMsg("Could not save: " + error.message);
            setPaymentSaving(false);
            return;
        }
        setPaymentMsg("Payment settings saved");
        setPaymentSaving(false);
        await fetchAll();
    }

    async function resyncBotBusinesses() {
        setResyncingBot(true);
        setSaveMsg("");
        try {
            const r = await fetch(API + "/whatsapp/resync-businesses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const data = await r.json();
            if (!r.ok || !data?.success) {
                const reason = data?.error || (data?.failures?.[0]?.error) || "unknown error";
                setSaveMsg("Bot resync failed: " + reason);
            } else {
                setSaveMsg(`Bot resync complete: ${data.synced}/${data.totalActive} active businesses synced`);
            }
            setTimeout(() => setSaveMsg(""), 5000);
        } catch (e) {
            setSaveMsg("Bot resync failed: " + e.message);
            setTimeout(() => setSaveMsg(""), 5000);
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
                headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_PASSWORD },
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
    const totalRevenue = orders.filter(o => o.payment_status === "paid").reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
    const pendingLearnings = learnings.filter(l => l.status === "pending").length;

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

    function bizPlatformEarnings(name) {
        const biz = bizByName[name];
        return orders.filter(o => o.business_name === name).reduce((sum, order) => sum + orderPlatformCut(order, biz), 0);
    }

    const platformRevenueByRules = orders.reduce((sum, order) => {
        const biz = bizByName[order.business_name];
        return sum + orderPlatformCut(order, biz);
    }, 0);

    function HealthDot({ status }) {
        const colors = { ok: "#22c55e", warn: "#f59e0b", error: "#ef4444", checking: "#64748b" };
        const labels = { ok: "Operational", warn: "Degraded", error: "Down", checking: "Checking..." };
        return (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: colors[status] || "#64748b", boxShadow: status === "ok" ? `0 0 6px ${colors.ok}` : "none" }} />
                <span style={{ fontSize: "12px", color: colors[status] || "#64748b", fontWeight: "600" }}>{labels[status] || "Unknown"}</span>
            </div>
        );
    }

    function StatusBadge({ status }) {
        const cfg = {
            pending: { bg: "rgba(245,158,11,0.1)", c: "#f59e0b", border: "rgba(245,158,11,0.2)", label: "Pending" },
            active: { bg: "rgba(34,197,94,0.1)", c: "#22c55e", border: "rgba(34,197,94,0.2)", label: "Active" },
            rejected: { bg: "rgba(239,68,68,0.1)", c: "#ef4444", border: "rgba(239,68,68,0.2)", label: "Rejected" },
            suspended: { bg: "rgba(100,116,139,0.1)", c: "#64748b", border: "rgba(100,116,139,0.2)", label: "Suspended" },
        };
        const s = cfg[status] || cfg.pending;
        return (
            <span style={{ backgroundColor: s.bg, color: s.c, border: `1px solid ${s.border}`, padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>{s.label}</span>
        );
    }

    const inp = (extra = {}) => ({ padding: "10px 13px", backgroundColor: d.input, border: `1px solid ${d.inputBorder}`, borderRadius: "8px", fontSize: "13px", color: d.text, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit", ...extra });
    const cardStyle = { backgroundColor: d.card, border: `1px solid ${d.border}`, borderRadius: "12px" };
    const pageNames = {
        overview: "Overview",
        approvals: "Pending Approvals",
        businesses: "Businesses",
        webhooks: "Webhook Logs",
        health: "System Health",
        analytics: "Analytics",
        botconfig: "Bot Configuration",
        payments: "Payment Settings",
        learnings: "Bot Learnings",
    };

    const navItems = [
        { id: "overview", label: "Overview", icon: "▦" },
        { id: "approvals", label: "Approvals", icon: "✓", badge: pending.length },
        { id: "businesses", label: "Businesses", icon: "🏪" },
        { id: "webhooks", label: "Webhook Logs", icon: "📡" },
        { id: "payments", label: "Payments", icon: "💳" },
        { id: "health", label: "System Health", icon: "❤" },
        { id: "analytics", label: "Analytics", icon: "📊" },
        { id: "learnings", label: "Bot Learnings", icon: "🧠", badge: pendingLearnings },
    ];

    function outcomeStyle(o) {
        const x = (o || "").toLowerCase();
        if (x === "replied") return { bg: "rgba(34,197,94,0.12)", c: "#86efac", b: "rgba(34,197,94,0.25)" };
        if (x === "skipped") return { bg: "rgba(245,158,11,0.12)", c: "#fcd34d", b: "rgba(245,158,11,0.25)" };
        if (x === "no_reply") return { bg: "rgba(148,163,184,0.12)", c: "#94a3b8", b: "rgba(148,163,184,0.2)" };
        if (x === "send_failed") return { bg: "rgba(249,115,22,0.12)", c: "#fdba74", b: "rgba(249,115,22,0.25)" };
        return { bg: "rgba(239,68,68,0.12)", c: "#fca5a5", b: "rgba(239,68,68,0.25)" };
    }

    const whFilter = webhookFilter.trim().toLowerCase();
    const filteredWebhookLogs = whFilter
        ? webhookLogs.filter((row) => {
            const hay = [row.body, row.business_name, row.customer_phone, row.outcome, row.skip_reason, row.reply_preview, row.error_message, row.message_id, row.source]
                .filter(Boolean).join(" ").toLowerCase();
            return hay.includes(whFilter);
        })
        : webhookLogs;

    if (!supabase) return (
        <div style={{ minHeight: "100vh", backgroundColor: d.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", color: d.text, padding: "24px" }}>
            <div style={{ ...cardStyle, maxWidth: "640px", padding: "22px" }}>
                <h2 style={{ margin: "0 0 10px", fontSize: "18px" }}>Missing Supabase Configuration</h2>
                <p style={{ margin: "0 0 8px", fontSize: "14px", color: d.strongMuted }}>Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` in your Vercel environment variables, then redeploy.</p>
                <p style={{ margin: 0, fontSize: "12px", color: d.muted }}>The admin panel cannot query businesses or orders until this is configured.</p>
            </div>
        </div>
    );

    if (!authed) return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
            <div style={{ minHeight: "100vh", backgroundColor: d.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", color: d.text }}>
                <div style={{ width: "100%", maxWidth: "360px", padding: "20px" }}>
                    <div style={{ textAlign: "center", marginBottom: "40px" }}>
                        <div style={{ fontSize: "20px", fontWeight: "800", color: d.text, marginBottom: "4px", fontFamily: "'Playfair Display', serif" }}>Delivagh<span style={{ color: accent }}>.</span></div>
                        <p style={{ fontSize: "12px", color: d.muted }}>Admin Portal</p>
                    </div>
                    <div style={{ ...cardStyle, borderRadius: "16px", padding: "32px", boxShadow: d.shadow }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
                            <button onClick={() => setTheme(isDark ? "light" : "dark")}
                                style={{ padding: "6px 10px", backgroundColor: "transparent", border: `1px solid ${d.border}`, borderRadius: "8px", color: d.strongMuted, fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                                {isDark ? "Light Mode" : "Dark Mode"}
                            </button>
                        </div>
                        <h2 style={{ color: d.text, fontSize: "18px", fontWeight: "700", marginBottom: "24px", textAlign: "center" }}>Admin Access</h2>
                        {pwError && <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" }}>{pwError}</div>}
                        <input type="password" value={pwInput} onChange={e => setPwInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
                            placeholder="Admin password" style={{ width: "100%", padding: "12px 14px", backgroundColor: d.input, border: `1px solid ${d.inputBorder}`, borderRadius: "10px", fontSize: "14px", color: d.text, outline: "none", boxSizing: "border-box", marginBottom: "14px", fontFamily: "inherit" }} />
                        <button onClick={handleLogin} style={{ width: "100%", padding: "12px", backgroundColor: accent, color: "white", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>
                            Enter Admin
                        </button>
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
            <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'DM Sans', sans-serif; }
                body { background: ${d.bg}; }
                ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: ${d.border}; border-radius: 2px; }
                .row-h:hover td { background: ${d.hover} !important; }
                @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>

            <div style={{ display: "flex", minHeight: "100vh", backgroundColor: d.bg, color: d.text }}>

                {/* SIDEBAR */}
                <aside style={{ width: "220px", backgroundColor: d.bg2, borderRight: `1px solid ${d.border}`, position: "fixed", top: 0, left: 0, bottom: 0, display: "flex", flexDirection: "column", zIndex: 50 }}>
                    <div style={{ padding: "20px 16px", borderBottom: `1px solid ${d.border}` }}>
                        <div style={{ fontSize: "15px", fontWeight: "800", color: d.text, fontFamily: "'Playfair Display', serif" }}>Delivagh<span style={{ color: accent }}>.</span></div>
                        <p style={{ fontSize: "10px", color: d.muted, marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Admin Portal</p>
                    </div>
                    <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: "2px" }}>
                        {navItems.map(item => (
                            <button key={item.id} onClick={() => setActivePage(item.id)}
                                style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 12px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "12px", textAlign: "left", backgroundColor: activePage === item.id ? accentSoft : "transparent", color: activePage === item.id ? accent : d.muted, transition: "all 0.12s" }}>
                                <span>{item.icon}</span>
                                <span style={{ flex: 1 }}>{item.label}</span>
                                {item.badge > 0 && <span style={{ backgroundColor: "#ef4444", color: "white", fontSize: "9px", padding: "1px 6px", borderRadius: "999px", fontWeight: "800" }}>{item.badge}</span>}
                            </button>
                        ))}
                    </nav>
                    <div style={{ padding: "12px", borderTop: `1px solid ${d.border}` }}>
                        <button onClick={() => setTheme(isDark ? "light" : "dark")}
                            style={{ width: "100%", marginBottom: "8px", padding: "9px", backgroundColor: "transparent", border: `1px solid ${d.border}`, borderRadius: "8px", color: d.muted, fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>
                            {isDark ? "Switch to Light" : "Switch to Dark"}
                        </button>
                        <button onClick={() => { sessionStorage.removeItem("admin_auth"); setAuthed(false); }}
                            style={{ width: "100%", padding: "9px", backgroundColor: "transparent", border: `1px solid ${d.border}`, borderRadius: "8px", color: d.muted, fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>
                            Sign Out
                        </button>
                    </div>
                </aside>

                {/* MAIN */}
                <main style={{ marginLeft: "220px", flex: 1, padding: "24px 28px", overflowY: "auto" }}>
                    <div style={{ ...cardStyle, marginBottom: "20px", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: d.shadow }}>
                        <div>
                            <p style={{ fontSize: "10px", fontWeight: "700", color: d.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "3px" }}>Current Section</p>
                            <p style={{ fontSize: "16px", fontWeight: "700", color: d.text }}>{pageNames[activePage] || "Dashboard"}</p>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button onClick={fetchAll}
                                style={{ padding: "8px 12px", backgroundColor: "transparent", border: `1px solid ${d.border}`, borderRadius: "8px", color: d.strongMuted, fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                                Refresh Data
                            </button>
                            <button onClick={resyncBotBusinesses} disabled={resyncingBot}
                                style={{ padding: "8px 12px", backgroundColor: resyncingBot ? d.muted : accent, border: "none", borderRadius: "8px", color: "white", fontSize: "12px", fontWeight: "700", cursor: resyncingBot ? "not-allowed" : "pointer" }}>
                                {resyncingBot ? "Resyncing..." : "Resync Bot Directory"}
                            </button>
                            <button onClick={() => setTheme(isDark ? "light" : "dark")}
                                style={{ padding: "8px 12px", backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "rgba(15,23,42,0.07)", border: `1px solid ${isDark ? "rgba(245,158,11,0.25)" : d.border}`, borderRadius: "8px", color: isDark ? "#f59e0b" : d.strongMuted, fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                                {isDark ? "Light Mode" : "Dark Mode"}
                            </button>
                        </div>
                    </div>

                    {/* ── OVERVIEW ── */}
                    {activePage === "overview" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "slideDown 0.2s ease" }}>
                            <div>
                                <h1 style={{ fontSize: "18px", fontWeight: "700", color: d.text, marginBottom: "4px" }}>Overview</h1>
                                <p style={{ fontSize: "12px", color: d.muted }}>{new Date().toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
                                {[
                                    { label: "Total Businesses", value: businesses.length, sub: `${active.length} active`, color: accent },
                                    { label: "Pending Approval", value: pending.length, sub: "Need review", color: pending.length > 0 ? "#f59e0b" : d.muted, alert: pending.length > 0 },
                                    { label: "Total Orders", value: orders.length, sub: `${todayOrders.length} today`, color: "#22c55e" },
                                    { label: "Platform Revenue", value: "GHS " + (orders.length * 1).toFixed(2), sub: "@ GHS 1/order", color: "#8b5cf6" },
                                ].map((s, i) => (
                                    <div key={i} style={{ ...cardStyle, padding: "18px", borderColor: s.alert ? "rgba(245,158,11,0.3)" : d.border }}>
                                        <p style={{ fontSize: "10px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>{s.label}</p>
                                        <p style={{ fontSize: "28px", fontWeight: "800", color: s.color, lineHeight: 1, marginBottom: "4px" }}>{s.value}</p>
                                        <p style={{ fontSize: "11px", color: d.muted }}>{s.sub}</p>
                                    </div>
                                ))}
                            </div>
                            <div style={cardStyle}>
                                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${d.border}` }}>
                                    <p style={{ fontSize: "13px", fontWeight: "700", color: d.text }}>System Status</p>
                                </div>
                                <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                                    {[
                                        { label: "Backend (Railway)", status: health.backend },
                                        { label: "Database (Supabase)", status: health.supabase },
                                        { label: "AI Bot (Groq)", status: health.groq },
                                    ].map((h, i) => (
                                        <div key={i} style={{ backgroundColor: d.bg3, borderRadius: "8px", padding: "12px 14px", border: `1px solid ${d.border}` }}>
                                            <p style={{ fontSize: "11px", color: d.muted, marginBottom: "6px" }}>{h.label}</p>
                                            <HealthDot status={h.status} />
                                        </div>
                                    ))}
                                </div>
                                <div style={{ padding: "12px 18px", borderTop: `1px solid ${d.border}` }}>
                                    <p style={{ fontSize: "11px", color: d.muted }}>
                                        Last order: {lastOrder ? new Date(lastOrder.created_at).toLocaleString("en-GH") : "No orders yet"} {lastOrder ? `— ${lastOrder.business_name}` : ""}
                                    </p>
                                </div>
                            </div>
                            {pending.length > 0 && (
                                <div style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "12px", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div>
                                        <p style={{ fontSize: "14px", fontWeight: "700", color: "#f59e0b", marginBottom: "3px" }}>{pending.length} business{pending.length > 1 ? "es" : ""} waiting for approval</p>
                                        <p style={{ fontSize: "12px", color: "rgba(245,158,11,0.6)" }}>{pending.map(b => b.name).join(", ")}</p>
                                    </div>
                                    <button onClick={() => setActivePage("approvals")} style={{ padding: "8px 18px", backgroundColor: "#f59e0b", color: "#0a0d12", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                                        Review Now
                                    </button>
                                </div>
                            )}
                            <div style={cardStyle}>
                                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${d.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <p style={{ fontSize: "13px", fontWeight: "700", color: d.text }}>Recent Businesses</p>
                                    <button onClick={() => setActivePage("businesses")} style={{ fontSize: "11px", color: accent, background: "none", border: "none", cursor: "pointer", fontWeight: "600" }}>View all</button>
                                </div>
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                        <thead><tr style={{ backgroundColor: d.bg3 }}>
                                            {["Business", "Phone", "Email", "Status", "Orders", "Revenue", "Joined"].map(h => (
                                                <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: "10px", fontWeight: "700", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {businesses.slice(0, 6).map(biz => (
                                                <tr key={biz.id} className="row-h" style={{ borderTop: `1px solid ${d.border}` }}>
                                                    <td style={{ padding: "11px 14px", fontSize: "13px", fontWeight: "600", color: d.text }}>{biz.name}</td>
                                                    <td style={{ padding: "11px 14px", fontSize: "12px", color: d.muted }}>{biz.phone || "—"}</td>
                                                    <td style={{ padding: "11px 14px", fontSize: "12px", color: d.muted }}>{biz.user_id?.substring(0, 20)}...</td>
                                                    <td style={{ padding: "11px 14px" }}><StatusBadge status={biz.status || "pending"} /></td>
                                                    <td style={{ padding: "11px 14px", fontSize: "12px", fontWeight: "700", color: d.text }}>{bizOrders(biz.name).length}</td>
                                                    <td style={{ padding: "11px 14px", fontSize: "12px", fontWeight: "700", color: "#22c55e" }}>GHS {bizRevenue(biz.name).toFixed(2)}</td>
                                                    <td style={{ padding: "11px 14px", fontSize: "11px", color: d.muted }}>{new Date(biz.created_at).toLocaleDateString("en-GH")}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── APPROVALS ── */}
                    {activePage === "approvals" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "slideDown 0.2s ease" }}>
                            <div>
                                <h1 style={{ fontSize: "18px", fontWeight: "700", color: d.text, marginBottom: "4px" }}>Pending Approvals</h1>
                                <p style={{ fontSize: "12px", color: d.muted }}>{pending.length} business{pending.length !== 1 ? "es" : ""} waiting for review</p>
                            </div>
                            {pending.length === 0 ? (
                                <div style={{ ...cardStyle, padding: "64px", textAlign: "center" }}>
                                    <p style={{ fontSize: "32px", marginBottom: "12px" }}>✅</p>
                                    <p style={{ fontSize: "14px", fontWeight: "600", color: d.text, marginBottom: "4px" }}>All caught up!</p>
                                    <p style={{ fontSize: "12px", color: d.muted }}>No pending approvals right now</p>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                    {pending.map(biz => (
                                        <div key={biz.id} style={{ ...cardStyle, padding: "22px", borderColor: "rgba(245,158,11,0.2)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                                                        <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "16px", color: "white", flexShrink: 0 }}>
                                                            {biz.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p style={{ fontSize: "15px", fontWeight: "700", color: d.text, margin: 0 }}>{biz.name}</p>
                                                            <p style={{ fontSize: "11px", color: d.muted, margin: 0 }}>Registered {new Date(biz.created_at).toLocaleString("en-GH")}</p>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", maxWidth: "400px" }}>
                                                        {[
                                                            { label: "Phone", value: biz.phone || "Not provided" },
                                                            { label: "User ID", value: biz.user_id?.substring(0, 16) + "..." },
                                                        ].map(row => (
                                                            <div key={row.label} style={{ backgroundColor: d.bg3, borderRadius: "8px", padding: "10px 12px", border: `1px solid ${d.border}` }}>
                                                                <p style={{ fontSize: "10px", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px" }}>{row.label}</p>
                                                                <p style={{ fontSize: "12px", fontWeight: "600", color: d.text }}>{row.value}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                                                    <button onClick={() => openBotConfig(biz)} style={{ padding: "8px 16px", backgroundColor: "transparent", border: `1px solid ${d.border}`, borderRadius: "8px", color: d.muted, fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                                                        Configure Bot
                                                    </button>
                                                    <button onClick={() => rejectBusiness(biz.id)} disabled={actionLoading[biz.id] === "rejecting"}
                                                        style={{ padding: "8px 16px", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", color: "#ef4444", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                                                        {actionLoading[biz.id] === "rejecting" ? "..." : "Reject"}
                                                    </button>
                                                    <button onClick={() => approveBusiness(biz.id)} disabled={actionLoading[biz.id] === "approving"}
                                                        style={{ padding: "8px 20px", backgroundColor: "#22c55e", border: "none", borderRadius: "8px", color: "#0a0d12", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                                                        {actionLoading[biz.id] === "approving" ? "..." : "Approve"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── BUSINESSES ── */}
                    {activePage === "businesses" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "slideDown 0.2s ease" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                                <div>
                                    <h1 style={{ fontSize: "18px", fontWeight: "700", color: d.text, marginBottom: "4px" }}>All Businesses</h1>
                                    <p style={{ fontSize: "12px", color: d.muted }}>{businesses.length} registered businesses</p>
                                </div>
                                <button onClick={openCreateVendorModal}
                                    style={{ padding: "9px 14px", backgroundColor: accent, border: "none", borderRadius: "8px", color: "white", fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>
                                    + Add Vendor
                                </button>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
                                        <thead><tr style={{ backgroundColor: d.bg3 }}>
                                            {["Business", "Phone", "Status", "Subaccount", "Commission", "Orders", "Revenue", "Platform Cut", "Joined", "Actions"].map(h => (
                                                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "10px", fontWeight: "700", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {businesses.map(biz => (
                                                <tr key={biz.id} className="row-h" style={{ borderTop: `1px solid ${d.border}` }}>
                                                    <td style={{ padding: "12px 14px" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                                                            <div style={{ width: "30px", height: "30px", borderRadius: "7px", backgroundColor: accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "12px", color: "white", flexShrink: 0 }}>{biz.name.charAt(0).toUpperCase()}</div>
                                                            <span style={{ fontSize: "13px", fontWeight: "600", color: d.text }}>{biz.name}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: "12px 14px", fontSize: "12px", color: d.muted }}>{biz.phone || "—"}</td>
                                                    <td style={{ padding: "12px 14px" }}><StatusBadge status={biz.status || "pending"} /></td>
                                                    <td style={{ padding: "12px 14px", fontSize: "12px", color: d.text }}>{biz.subaccount_code || "—"}</td>
                                                    <td style={{ padding: "12px 14px", fontSize: "12px", color: d.text }}>
                                                        {biz.commission_type === "percent" ? `${parseFloat(biz.commission_value || 0).toFixed(2)}%` : `GHS ${(parseFloat(biz.commission_value || 0) || 0).toFixed(2)}`}
                                                    </td>
                                                    <td style={{ padding: "12px 14px", fontSize: "12px", fontWeight: "700", color: d.text }}>{bizOrders(biz.name).length}</td>
                                                    <td style={{ padding: "12px 14px", fontSize: "12px", fontWeight: "700", color: "#22c55e" }}>GHS {bizRevenue(biz.name).toFixed(2)}</td>
                                                    <td style={{ padding: "12px 14px", fontSize: "12px", fontWeight: "700", color: "#8b5cf6" }}>GHS {bizPlatformEarnings(biz.name).toFixed(2)}</td>
                                                    <td style={{ padding: "12px 14px", fontSize: "11px", color: d.muted, whiteSpace: "nowrap" }}>{new Date(biz.created_at).toLocaleDateString("en-GH")}</td>
                                                    <td style={{ padding: "12px 14px" }}>
                                                        <div style={{ display: "flex", gap: "6px" }}>
                                                            <button onClick={() => openBotConfig(biz)} style={{ padding: "5px 10px", backgroundColor: accentSoft, border: `1px solid ${isDark ? "rgba(34,197,94,0.35)" : "#86efac"}`, borderRadius: "6px", color: accent, fontSize: "11px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }}>Bot Config</button>
                                                            <button onClick={() => openPaymentConfig(biz)} style={{ padding: "5px 10px", backgroundColor: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.28)", borderRadius: "6px", color: "#8b5cf6", fontSize: "11px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }}>Payments</button>
                                                            {biz.status === "active" && (
                                                                <button onClick={() => suspendBusiness(biz.id, biz.status)} disabled={actionLoading[biz.id] === "suspending"}
                                                                    style={{ padding: "5px 10px", backgroundColor: "rgba(100,116,139,0.1)", border: "1px solid rgba(100,116,139,0.2)", borderRadius: "6px", color: "#64748b", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>
                                                                    {actionLoading[biz.id] ? "..." : "Suspend"}
                                                                </button>
                                                            )}
                                                            {biz.status === "suspended" && (
                                                                <button onClick={() => suspendBusiness(biz.id, biz.status)} disabled={actionLoading[biz.id] === "suspending"}
                                                                    style={{ padding: "5px 10px", backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "6px", color: "#22c55e", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>
                                                                    {actionLoading[biz.id] ? "..." : "Reactivate"}
                                                                </button>
                                                            )}
                                                            {biz.status === "pending" && (
                                                                <button onClick={() => approveBusiness(biz.id)} disabled={actionLoading[biz.id] === "approving"}
                                                                    style={{ padding: "5px 10px", backgroundColor: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "6px", color: "#22c55e", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>
                                                                    {actionLoading[biz.id] ? "..." : "Approve"}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── WEBHOOK LOGS ── */}
                    {activePage === "webhooks" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "slideDown 0.2s ease", maxWidth: "1200px" }}>
                            <div>
                                <h1 style={{ fontSize: "18px", fontWeight: "700", color: d.text, marginBottom: "4px" }}>Webhook logs</h1>
                                <p style={{ fontSize: "12px", color: d.muted, lineHeight: 1.5 }}>Live feed of inbound customer messages (Meta + Twilio paths).</p>
                            </div>
                            {webhookLogsError && (
                                <div style={{ ...cardStyle, padding: "14px 18px", borderColor: "rgba(239,68,68,0.35)", backgroundColor: "rgba(239,68,68,0.06)" }}>
                                    <p style={{ margin: 0, fontSize: "13px", color: "#fca5a5", fontWeight: "600" }}>{webhookLogsError}</p>
                                </div>
                            )}
                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                                <input value={webhookFilter} onChange={(e) => setWebhookFilter(e.target.value)}
                                    placeholder="Filter: phone, business, text, outcome…"
                                    style={{ ...inp({ flex: "1", minWidth: "220px", maxWidth: "420px" }) }} />
                                <span style={{ fontSize: "12px", color: d.muted }}>{filteredWebhookLogs.length} row{filteredWebhookLogs.length !== 1 ? "s" : ""}</span>
                            </div>
                            <div style={{ ...cardStyle, overflow: "hidden" }}>
                                <div style={{ overflowX: "auto", maxHeight: "70vh", overflowY: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "960px" }}>
                                        <thead>
                                            <tr style={{ backgroundColor: d.bg3, position: "sticky", top: 0, zIndex: 1 }}>
                                                {["Time", "Src", "Customer", "Business", "Message", "Outcome", "Note / reply"].map((h) => (
                                                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: "10px", fontWeight: "700", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap", borderBottom: `1px solid ${d.border}` }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredWebhookLogs.length === 0 && !webhookLogsError && (
                                                <tr><td colSpan={7} style={{ padding: "28px", textAlign: "center", color: d.muted, fontSize: "13px" }}>No log rows yet.</td></tr>
                                            )}
                                            {filteredWebhookLogs.map((row) => {
                                                const os = outcomeStyle(row.outcome);
                                                const t = row.created_at ? new Date(row.created_at).toLocaleString("en-GH", { hour12: false }) : "—";
                                                const msg = (row.body || "").length > 120 ? (row.body || "").slice(0, 120) + "…" : row.body || "—";
                                                const note = row.skip_reason || row.error_message || (row.reply_preview ? row.reply_preview.slice(0, 160) + (row.reply_preview.length > 160 ? "…" : "") : "—");
                                                return (
                                                    <tr key={row.id} className="row-h" style={{ borderTop: `1px solid ${d.border}`, verticalAlign: "top" }}>
                                                        <td style={{ padding: "10px 12px", fontSize: "11px", color: d.muted, whiteSpace: "nowrap" }}>{t}</td>
                                                        <td style={{ padding: "10px 12px", fontSize: "11px", color: d.text, fontWeight: "600" }}>{row.source || "—"}</td>
                                                        <td style={{ padding: "10px 12px", fontSize: "11px", color: d.text, maxWidth: "140px", wordBreak: "break-all" }}>{(row.customer_phone || "").replace("whatsapp:", "") || "—"}</td>
                                                        <td style={{ padding: "10px 12px", fontSize: "11px", color: d.strongMuted, maxWidth: "120px" }}>{row.business_name || "—"}</td>
                                                        <td style={{ padding: "10px 12px", fontSize: "12px", color: d.text, maxWidth: "280px" }} title={row.body || ""}>{msg}</td>
                                                        <td style={{ padding: "10px 12px" }}>
                                                            <span style={{ display: "inline-block", backgroundColor: os.bg, color: os.c, border: `1px solid ${os.b}`, padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800" }}>{row.outcome || "—"}</span>
                                                        </td>
                                                        <td style={{ padding: "10px 12px", fontSize: "11px", color: d.muted, maxWidth: "320px" }} title={note}>{note}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── SYSTEM HEALTH ── */}
                    {activePage === "health" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "slideDown 0.2s ease" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                    <h1 style={{ fontSize: "18px", fontWeight: "700", color: d.text, marginBottom: "4px" }}>System Health</h1>
                                    <p style={{ fontSize: "12px", color: d.muted }}>Live status of all platform services</p>
                                </div>
                                <button onClick={checkHealth} style={{ padding: "8px 16px", backgroundColor: accentSoft, border: `1px solid ${isDark ? "rgba(34,197,94,0.35)" : "#86efac"}`, borderRadius: "8px", color: accent, fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                                    Refresh
                                </button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                                {[
                                    { label: "Backend API", sub: "Railway — Node.js/Express", status: health.backend, detail: health.backend === "ok" ? "Responding normally" : "Not reachable" },
                                    { label: "Database", sub: "Supabase — PostgreSQL", status: health.supabase, detail: health.supabase === "ok" ? "Connected, queries working" : "Connection failed" },
                                    { label: "AI Bot", sub: "Groq — llama-3.3-70b", status: health.groq, detail: health.groq === "ok" ? "API responding" : "Degraded or unreachable" },
                                    { label: "WhatsApp Bridge", sub: "Meta Cloud API", status: "warn", detail: "Check Meta Business Manager for status" },
                                ].map((s, i) => (
                                    <div key={i} style={{ ...cardStyle, padding: "22px" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                                            <div>
                                                <p style={{ fontSize: "14px", fontWeight: "700", color: d.text, marginBottom: "3px" }}>{s.label}</p>
                                                <p style={{ fontSize: "11px", color: d.muted }}>{s.sub}</p>
                                            </div>
                                            <HealthDot status={s.status} />
                                        </div>
                                        <p style={{ fontSize: "12px", color: d.muted, padding: "10px 12px", backgroundColor: d.bg3, borderRadius: "8px", border: `1px solid ${d.border}` }}>{s.detail}</p>
                                    </div>
                                ))}
                            </div>
                            <div style={cardStyle}>
                                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${d.border}` }}>
                                    <p style={{ fontSize: "13px", fontWeight: "700", color: d.text }}>Database Tables</p>
                                </div>
                                <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                                    {[
                                        { table: "orders", count: orders.length },
                                        { table: "businesses", count: businesses.length },
                                        { table: "bot_learnings", count: learnings.length },
                                        { table: "conversations", count: "—" },
                                    ].map((t, i) => (
                                        <div key={i} style={{ backgroundColor: d.bg3, borderRadius: "8px", padding: "12px 14px", border: `1px solid ${d.border}` }}>
                                            <p style={{ fontSize: "10px", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>{t.table}</p>
                                            <p style={{ fontSize: "22px", fontWeight: "800", color: d.text }}>{t.count}</p>
                                            <p style={{ fontSize: "10px", color: d.muted }}>rows</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${d.border}` }}>
                                    <p style={{ fontSize: "13px", fontWeight: "700", color: d.text }}>Recent Orders (All Businesses)</p>
                                </div>
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                        <thead><tr style={{ backgroundColor: d.bg3 }}>
                                            {["Order", "Business", "Customer", "Amount", "Status", "Time"].map(h => (
                                                <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: "10px", fontWeight: "700", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {orders.slice(0, 10).map(o => (
                                                <tr key={o.id} className="row-h" style={{ borderTop: `1px solid ${d.border}` }}>
                                                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: "11px", color: d.muted }}>#{o.id.substring(0, 8).toUpperCase()}</td>
                                                    <td style={{ padding: "10px 14px", fontSize: "12px", fontWeight: "600", color: d.text }}>{o.business_name}</td>
                                                    <td style={{ padding: "10px 14px", fontSize: "12px", color: d.muted }}>{o.customer_phone?.replace("whatsapp:", "")}</td>
                                                    <td style={{ padding: "10px 14px", fontSize: "12px", fontWeight: "700", color: "#22c55e" }}>{o.total_amount ? "GHS " + parseFloat(o.total_amount).toFixed(2) : "—"}</td>
                                                    <td style={{ padding: "10px 14px" }}>
                                                        <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "5px", backgroundColor: o.status === "delivered" ? "rgba(34,197,94,0.1)" : o.status === "pending" ? "rgba(245,158,11,0.1)" : accentSoft, color: o.status === "delivered" ? "#22c55e" : o.status === "pending" ? "#f59e0b" : accent }}>
                                                            {o.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: "10px 14px", fontSize: "11px", color: d.muted, whiteSpace: "nowrap" }}>{new Date(o.created_at).toLocaleString("en-GH", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── ANALYTICS ── */}
                    {activePage === "analytics" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "slideDown 0.2s ease" }}>
                            <h1 style={{ fontSize: "18px", fontWeight: "700", color: d.text }}>Platform Analytics</h1>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
                                {[
                                    { label: "Total Revenue Processed", value: "GHS " + orders.filter(o => o.payment_status === "paid").reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0).toFixed(2), sub: "All paid orders", color: "#22c55e" },
                                    { label: "Platform Earnings", value: "GHS " + platformRevenueByRules.toFixed(2), sub: "Based on configured commission rules", color: "#8b5cf6" },
                                    { label: "Avg Order Value", value: "GHS " + (orders.length > 0 ? (orders.filter(o => o.total_amount).reduce((s, o) => s + parseFloat(o.total_amount || 0), 0) / orders.filter(o => o.total_amount).length || 0).toFixed(2) : "0.00"), sub: "Across all businesses", color: accent },
                                ].map((s, i) => (
                                    <div key={i} style={{ ...cardStyle, padding: "20px" }}>
                                        <p style={{ fontSize: "10px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>{s.label}</p>
                                        <p style={{ fontSize: "26px", fontWeight: "800", color: s.color, marginBottom: "4px" }}>{s.value}</p>
                                        <p style={{ fontSize: "11px", color: d.muted }}>{s.sub}</p>
                                    </div>
                                ))}
                            </div>
                            <div style={cardStyle}>
                                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${d.border}` }}>
                                    <p style={{ fontSize: "13px", fontWeight: "700", color: d.text }}>Business Performance</p>
                                </div>
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                        <thead><tr style={{ backgroundColor: d.bg3 }}>
                                            {["Business", "Status", "Total Orders", "Today", "Revenue", "Platform Cut", "Paid", "Pending", "Delivered"].map(h => (
                                                <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: "10px", fontWeight: "700", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {businesses.map(biz => {
                                                const bo = bizOrders(biz.name);
                                                const bt = bo.filter(o => new Date(o.created_at).toDateString() === today);
                                                return (
                                                    <tr key={biz.id} className="row-h" style={{ borderTop: `1px solid ${d.border}` }}>
                                                        <td style={{ padding: "11px 14px", fontSize: "13px", fontWeight: "600", color: d.text }}>{biz.name}</td>
                                                        <td style={{ padding: "11px 14px" }}><StatusBadge status={biz.status || "pending"} /></td>
                                                        <td style={{ padding: "11px 14px", fontSize: "13px", fontWeight: "700", color: d.text }}>{bo.length}</td>
                                                        <td style={{ padding: "11px 14px", fontSize: "13px", color: accent, fontWeight: "700" }}>{bt.length}</td>
                                                        <td style={{ padding: "11px 14px", fontSize: "12px", fontWeight: "700", color: "#22c55e" }}>GHS {bizRevenue(biz.name).toFixed(2)}</td>
                                                        <td style={{ padding: "11px 14px", fontSize: "12px", fontWeight: "700", color: "#8b5cf6" }}>GHS {bizPlatformEarnings(biz.name).toFixed(2)}</td>
                                                        <td style={{ padding: "11px 14px", fontSize: "12px", color: "#22c55e" }}>{bo.filter(o => o.payment_status === "paid").length}</td>
                                                        <td style={{ padding: "11px 14px", fontSize: "12px", color: "#f59e0b" }}>{bo.filter(o => o.status === "pending").length}</td>
                                                        <td style={{ padding: "11px 14px", fontSize: "12px", color: "#22c55e" }}>{bo.filter(o => o.status === "delivered").length}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── PAYMENT SETTINGS ── */}
                    {activePage === "payments" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "slideDown 0.2s ease", maxWidth: "760px" }}>
                            {!selectedBiz ? (
                                <div style={cardStyle}>
                                    <div style={{ padding: "14px 18px", borderBottom: `1px solid ${d.border}` }}>
                                        <p style={{ fontSize: "13px", fontWeight: "700", color: d.text }}>Choose a business</p>
                                    </div>
                                    <div style={{ padding: "14px 18px", display: "flex", flexWrap: "wrap", gap: "10px" }}>
                                        {businesses.map(b => (
                                            <button key={b.id} onClick={() => openPaymentConfig(b)}
                                                style={{ padding: "8px 12px", borderRadius: "8px", border: `1px solid ${d.border}`, backgroundColor: d.bg3, color: d.text, fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>
                                                {b.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <button onClick={() => { setSelectedBiz(null); setPaymentMsg(""); }} style={{ background: "none", border: `1px solid ${d.border}`, borderRadius: "8px", padding: "6px 12px", color: d.muted, fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>← All Businesses</button>
                                        <div>
                                            <h1 style={{ fontSize: "18px", fontWeight: "700", color: d.text, marginBottom: "2px" }}>Payment Settings — {selectedBiz.name}</h1>
                                            <p style={{ fontSize: "12px", color: d.muted }}>Configure vendor subaccount routing and platform commission rule</p>
                                        </div>
                                    </div>
                                    <div style={cardStyle}>
                                        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${d.border}` }}>
                                            <p style={{ fontSize: "13px", fontWeight: "700", color: d.text }}>Settlement Routing</p>
                                        </div>
                                        <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
                                            <div>
                                                <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Subaccount Code</label>
                                                <input value={paymentConfig.subaccount_code || ""} onChange={e => setPaymentConfig(p => ({ ...p, subaccount_code: e.target.value }))}
                                                    placeholder="e.g. ACCT_6e3jqm4w80k0w4e" style={inp()} />
                                                <p style={{ fontSize: "11px", color: d.muted, marginTop: "5px" }}>Used when initializing split payment so funds route to this vendor.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={cardStyle}>
                                        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${d.border}` }}>
                                            <p style={{ fontSize: "13px", fontWeight: "700", color: d.text }}>Platform Commission Rule</p>
                                        </div>
                                        <div style={{ padding: "18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                                            <div>
                                                <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Commission Type</label>
                                                <select value={paymentConfig.commission_type || "flat"} onChange={e => setPaymentConfig(p => ({ ...p, commission_type: e.target.value }))} style={inp()}>
                                                    <option value="flat">Flat amount (GHS)</option>
                                                    <option value="percent">Percentage (%)</option>
                                                    <option value="none">No commission</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Commission Value</label>
                                                <input type="number" min="0" step="0.01" value={paymentConfig.commission_value ?? 0}
                                                    onChange={e => setPaymentConfig(p => ({ ...p, commission_value: e.target.value }))}
                                                    placeholder={paymentConfig.commission_type === "percent" ? "e.g. 7.5" : "e.g. 1.00"} style={inp()} />
                                            </div>
                                        </div>
                                    </div>
                                    <div style={cardStyle}>
                                        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${d.border}` }}>
                                            <p style={{ fontSize: "13px", fontWeight: "700", color: d.text }}>Business Earnings Snapshot</p>
                                        </div>
                                        <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                                            <div style={{ backgroundColor: d.bg3, borderRadius: "8px", padding: "12px 14px", border: `1px solid ${d.border}` }}>
                                                <p style={{ fontSize: "10px", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Paid Revenue</p>
                                                <p style={{ fontSize: "22px", fontWeight: "800", color: "#22c55e" }}>GHS {bizRevenue(selectedBiz.name).toFixed(2)}</p>
                                            </div>
                                            <div style={{ backgroundColor: d.bg3, borderRadius: "8px", padding: "12px 14px", border: `1px solid ${d.border}` }}>
                                                <p style={{ fontSize: "10px", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Platform Cut</p>
                                                <p style={{ fontSize: "22px", fontWeight: "800", color: "#8b5cf6" }}>GHS {bizPlatformEarnings(selectedBiz.name).toFixed(2)}</p>
                                            </div>
                                            <div style={{ backgroundColor: d.bg3, borderRadius: "8px", padding: "12px 14px", border: `1px solid ${d.border}` }}>
                                                <p style={{ fontSize: "10px", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Net to Vendor</p>
                                                <p style={{ fontSize: "22px", fontWeight: "800", color: d.text }}>GHS {(bizRevenue(selectedBiz.name) - bizPlatformEarnings(selectedBiz.name)).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                        <button onClick={savePaymentConfig} disabled={paymentSaving}
                                            style={{ padding: "12px 28px", backgroundColor: paymentSaving ? d.muted : "#8b5cf6", color: "white", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "700", cursor: paymentSaving ? "not-allowed" : "pointer" }}>
                                            {paymentSaving ? "Saving..." : "Save Payment Settings"}
                                        </button>
                                        {paymentMsg && <span style={{ fontSize: "13px", color: paymentMsg.startsWith("Could not") ? "#ef4444" : "#22c55e", fontWeight: "600" }}>{paymentMsg}</span>}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ── BOT CONFIG ── */}
                    {activePage === "botconfig" && selectedBiz && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "slideDown 0.2s ease", maxWidth: "600px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <button onClick={() => setActivePage("businesses")} style={{ background: "none", border: `1px solid ${d.border}`, borderRadius: "8px", padding: "6px 12px", color: d.muted, fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>← Back</button>
                                <div>
                                    <h1 style={{ fontSize: "18px", fontWeight: "700", color: d.text, marginBottom: "2px" }}>Bot Config — {selectedBiz.name}</h1>
                                    <p style={{ fontSize: "12px", color: d.muted }}>Customize how the WhatsApp bot behaves for this business.</p>
                                </div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${d.border}` }}>
                                    <p style={{ fontSize: "13px", fontWeight: "700", color: d.text }}>Bot Type</p>
                                    <p style={{ fontSize: "11px", color: d.muted, marginTop: "2px" }}>What kind of business is this?</p>
                                </div>
                                <div style={{ padding: "18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                    {[
                                        { id: "food", label: "Food & Restaurant", icon: "🍽️", desc: "Menu ordering, delivery/pickup, meal customizations" },
                                        { id: "food_fast", label: "Fast Food", icon: "🍔", desc: "Quick orders, combos, simple menu" },
                                        { id: "chop_bar", label: "Chop Bar / Canteen", icon: "🍲", desc: "Local Ghanaian food, daily specials" },
                                        { id: "bakery", label: "Bakery & Pastry", icon: "🥐", desc: "Baked goods, custom cakes, pre-orders" },
                                    ].map(type => {
                                        const selected = (botConfig.bot_type || "food") === type.id;
                                        return (
                                            <div key={type.id} onClick={() => setBotConfig(p => ({ ...p, bot_type: type.id }))}
                                                style={{ padding: "14px", borderRadius: "10px", border: `1px solid ${selected ? accent : d.border}`, backgroundColor: selected ? accentSoft : d.bg3, cursor: "pointer", transition: "all 0.15s" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                                                    <span style={{ fontSize: "18px" }}>{type.icon}</span>
                                                    <span style={{ fontSize: "12px", fontWeight: "700", color: selected ? accent : d.text }}>{type.label}</span>
                                                </div>
                                                <p style={{ fontSize: "11px", color: d.muted, margin: 0, lineHeight: "1.4" }}>{type.desc}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${d.border}` }}>
                                    <p style={{ fontSize: "13px", fontWeight: "700", color: d.text }}>Bot Identity</p>
                                    <p style={{ fontSize: "11px", color: d.muted, marginTop: "2px" }}>Define the AI personality for this business.</p>
                                </div>
                                <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
                                    <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Bot Name</label>
                                        <input value={botConfig.bot_name || ""} onChange={e => setBotConfig(p => ({ ...p, bot_name: e.target.value }))} placeholder="e.g. Mama's Bot" style={inp()} />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>🎭 Persona & Vibe</label>
                                        <textarea value={botConfig.bot_persona || ""} onChange={e => setBotConfig(p => ({ ...p, bot_persona: e.target.value }))}
                                            placeholder="e.g. Warm and motherly. Speaks like a friendly Ghanaian aunty."
                                            style={{ ...inp({ height: "80px", resize: "none" }) }} />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>📍 Location & Pickup Info</label>
                                        <input value={botConfig.bot_location || ""} onChange={e => setBotConfig(p => ({ ...p, bot_location: e.target.value }))}
                                            placeholder="e.g. Behind the Engineering Block, UMaT." style={inp()} />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>📌 Special Instructions</label>
                                        <textarea value={botConfig.bot_special_instructions || ""} onChange={e => setBotConfig(p => ({ ...p, bot_special_instructions: e.target.value }))}
                                            placeholder="e.g. Closed on Sundays. Delivery is GHS 5."
                                            style={{ ...inp({ height: "80px", resize: "none" }) }} />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>🚫 Boundaries</label>
                                        <input value={botConfig.bot_boundaries || ""} onChange={e => setBotConfig(p => ({ ...p, bot_boundaries: e.target.value }))}
                                            placeholder="e.g. Only sell food items. Do not discuss other businesses." style={inp()} />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Custom Greeting</label>
                                        <textarea value={botConfig.bot_greeting || ""} onChange={e => setBotConfig(p => ({ ...p, bot_greeting: e.target.value }))}
                                            placeholder={`e.g. Welcome to ${selectedBiz?.name}! 👋`}
                                            style={{ ...inp({ height: "70px", resize: "none" }) }} />
                                    </div>
                                    <div style={{ borderTop: `1px solid ${d.border}`, paddingTop: "14px" }}>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>⚙️ Advanced: Full AI Context Override</label>
                                        <textarea value={botConfig.business_context || ""} onChange={e => setBotConfig(p => ({ ...p, business_context: e.target.value }))}
                                            placeholder="Optional: Write a full custom AI system prompt. Overrides all structured fields above."
                                            style={{ ...inp({ height: "120px", resize: "vertical" }) }} />
                                    </div>
                                </div>
                            </div>
                            <div style={cardStyle}>
                                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${d.border}` }}>
                                    <p style={{ fontSize: "13px", fontWeight: "700", color: d.text }}>Delivery Settings</p>
                                </div>
                                <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
                                    <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Delivery Zones</label>
                                        <input value={botConfig.delivery_zones || ""} onChange={e => setBotConfig(p => ({ ...p, delivery_zones: e.target.value }))}
                                            placeholder="e.g. Accra, Tema, Madina, East Legon" style={inp()} />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "11px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Minimum Order Amount (GHS)</label>
                                        <input type="number" value={botConfig.min_order_amount || ""} onChange={e => setBotConfig(p => ({ ...p, min_order_amount: e.target.value }))} placeholder="0" style={inp()} />
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                <button onClick={saveBotConfig} disabled={saving}
                                    style={{ padding: "12px 28px", backgroundColor: saving ? d.muted : accent, color: "white", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer" }}>
                                    {saving ? "Saving..." : "Save Configuration"}
                                </button>
                                {saveMsg && <span style={{ fontSize: "13px", color: "#22c55e", fontWeight: "600" }}>✓ {saveMsg}</span>}
                            </div>
                        </div>
                    )}

                    {/* ── BOT LEARNINGS ── */}
                    {activePage === "learnings" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "slideDown 0.2s ease" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                                <div>
                                    <h1 style={{ fontSize: "18px", fontWeight: "700", color: d.text, marginBottom: "4px" }}>🧠 Bot Learnings</h1>
                                    <p style={{ fontSize: "12px", color: d.muted }}>Review what the bot learned from real conversations. Approve to activate, reject to discard.</p>
                                </div>
                                <button onClick={fetchLearnings}
                                    style={{ padding: "8px 16px", backgroundColor: accentSoft, color: accent, border: `1px solid ${accent}`, borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                                    ↻ Refresh
                                </button>
                            </div>

                            {/* Stats */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
                                {[
                                    { label: "Pending Review", value: learnings.filter(l => l.status === "pending").length, color: "#f59e0b" },
                                    { label: "Approved", value: learnings.filter(l => l.status === "approved").length, color: "#22c55e" },
                                    { label: "Corrections", value: learnings.filter(l => l.learning_type === "correction").length, color: "#818cf8" },
                                    { label: "Popular Items", value: learnings.filter(l => l.learning_type === "popular_item").length, color: "#38bdf8" },
                                ].map(stat => (
                                    <div key={stat.label} style={{ ...cardStyle, padding: "14px 16px" }}>
                                        <p style={{ fontSize: "22px", fontWeight: "800", color: stat.color, margin: 0 }}>{stat.value}</p>
                                        <p style={{ fontSize: "11px", color: d.muted, margin: "2px 0 0" }}>{stat.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Filters */}
                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                {["all", "pending", "approved", "rejected"].map(f => (
                                    <button key={f} onClick={() => setLearningsFilter(f)}
                                        style={{ padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: "600", cursor: "pointer", border: `1px solid ${learningsFilter === f ? accent : d.border}`, backgroundColor: learningsFilter === f ? accentSoft : "transparent", color: learningsFilter === f ? accent : d.muted, transition: "all 0.15s" }}>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                ))}
                                <select value={learningsBiz} onChange={e => setLearningsBiz(e.target.value)}
                                    style={{ ...inp({ width: "auto", padding: "6px 12px", fontSize: "12px" }) }}>
                                    <option value="all">All Businesses</option>
                                    {[...new Set(learnings.map(l => l.business_name))].map(biz => (
                                        <option key={biz} value={biz}>{biz}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Learning cards */}
                            {learningsLoading ? (
                                <div style={{ textAlign: "center", padding: "40px", color: d.muted, fontSize: "14px" }}>Loading learnings...</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {learnings
                                        .filter(l => learningsFilter === "all" || l.status === learningsFilter)
                                        .filter(l => learningsBiz === "all" || l.business_name === learningsBiz)
                                        .map(learning => {
                                            const typeColors = {
                                                correction: { bg: "rgba(129,114,248,0.1)", c: "#818cf8", icon: "🔧" },
                                                popular_item: { bg: "rgba(56,189,248,0.1)", c: "#38bdf8", icon: "🔥" },
                                                frequent_question: { bg: "rgba(251,191,36,0.1)", c: "#fbbf24", icon: "❓" },
                                            };
                                            const tc = typeColors[learning.learning_type] || typeColors.correction;
                                            const statusColor = learning.status === "approved" ? "#22c55e" : learning.status === "rejected" ? "#ef4444" : "#f59e0b";

                                            return (
                                                <div key={learning.id} style={{ ...cardStyle, padding: "16px", borderLeft: `3px solid ${tc.c}` }}>
                                                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                                                        <div style={{ flex: 1, minWidth: "200px" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                                                                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "5px", backgroundColor: tc.bg, color: tc.c, fontWeight: "700" }}>
                                                                    {tc.icon} {learning.learning_type.replace("_", " ").toUpperCase()}
                                                                </span>
                                                                <span style={{ fontSize: "11px", color: d.muted }}>{learning.business_name}</span>
                                                                <span style={{ fontSize: "11px", color: statusColor, fontWeight: "600" }}>● {learning.status}</span>
                                                                {learning.times_seen > 1 && (
                                                                    <span style={{ fontSize: "11px", color: d.muted }}>seen {learning.times_seen}x</span>
                                                                )}
                                                            </div>
                                                            {learning.trigger_phrase && (
                                                                <div style={{ marginBottom: "6px" }}>
                                                                    <span style={{ fontSize: "11px", color: d.muted, fontWeight: "600" }}>TRIGGER: </span>
                                                                    <span style={{ fontSize: "12px", color: d.text, fontStyle: "italic" }}>"{learning.trigger_phrase}"</span>
                                                                </div>
                                                            )}
                                                            <div style={{ marginBottom: "6px" }}>
                                                                <span style={{ fontSize: "11px", color: d.muted, fontWeight: "600" }}>BEHAVIOR: </span>
                                                                <span style={{ fontSize: "12px", color: d.text }}>{learning.correct_behavior}</span>
                                                            </div>
                                                            {learning.source_context && (
                                                                <details style={{ marginTop: "8px" }}>
                                                                    <summary style={{ fontSize: "11px", color: d.muted, cursor: "pointer" }}>View conversation context</summary>
                                                                    <pre style={{ fontSize: "11px", color: d.muted, backgroundColor: d.bg3, padding: "8px", borderRadius: "6px", marginTop: "6px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                                                        {learning.source_context}
                                                                    </pre>
                                                                </details>
                                                            )}
                                                            <p style={{ fontSize: "11px", color: d.muted, margin: "8px 0 0" }}>{new Date(learning.created_at).toLocaleString()}</p>
                                                        </div>
                                                        {learning.status === "pending" && (
                                                            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                                                                <button onClick={() => approveLearning(learning.id)}
                                                                    style={{ padding: "7px 14px", backgroundColor: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "7px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                                                                    ✓ Approve
                                                                </button>
                                                                <button onClick={() => rejectLearning(learning.id)}
                                                                    style={{ padding: "7px 14px", backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "7px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                                                                    ✗ Reject
                                                                </button>
                                                            </div>
                                                        )}
                                                        {learning.status !== "pending" && (
                                                            <button onClick={() => deleteLearning(learning.id)}
                                                                style={{ padding: "7px 12px", backgroundColor: "transparent", color: d.muted, border: `1px solid ${d.border}`, borderRadius: "7px", fontSize: "11px", cursor: "pointer" }}>
                                                                🗑 Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    {learnings.filter(l => learningsFilter === "all" || l.status === learningsFilter).filter(l => learningsBiz === "all" || l.business_name === learningsBiz).length === 0 && (
                                        <div style={{ textAlign: "center", padding: "40px", color: d.muted }}>
                                            <p style={{ fontSize: "32px", margin: "0 0 8px" }}>🧠</p>
                                            <p style={{ fontSize: "14px", fontWeight: "600" }}>No learnings yet</p>
                                            <p style={{ fontSize: "12px", margin: "4px 0 0" }}>The bot will start learning as customers interact with it.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                </main>
            </div>

            {showCreateVendorModal && (
                <div onClick={closeCreateVendorModal}
                    style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "520px", ...cardStyle, boxShadow: d.shadow }}>
                        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${d.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: d.text }}>Add Vendor</h2>
                                <p style={{ margin: "4px 0 0", fontSize: "12px", color: d.muted }}>Create auth user + vendor records in one step</p>
                            </div>
                            <button onClick={closeCreateVendorModal} style={{ background: "transparent", border: `1px solid ${d.border}`, borderRadius: "7px", color: d.muted, cursor: "pointer", fontSize: "12px", padding: "5px 10px" }}>Close</button>
                        </div>

                        <form onSubmit={createVendor} style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: d.muted, textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.06em" }}>Business Name</label>
                                <input value={vendorForm.businessName} onChange={(e) => setVendorForm((p) => ({ ...p, businessName: e.target.value }))} placeholder="e.g. Ama's Kitchen" style={inp()} required />
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: d.muted, textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.06em" }}>Owner Full Name</label>
                                <input value={vendorForm.ownerName} onChange={(e) => setVendorForm((p) => ({ ...p, ownerName: e.target.value }))} placeholder="e.g. Ama Mensah" style={inp()} required />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: d.muted, textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.06em" }}>Email Address</label>
                                    <input type="email" value={vendorForm.email} onChange={(e) => setVendorForm((p) => ({ ...p, email: e.target.value }))} placeholder="owner@business.com" style={inp()} required />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: d.muted, textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.06em" }}>Phone Number</label>
                                    <input value={vendorForm.phone} onChange={(e) => setVendorForm((p) => ({ ...p, phone: e.target.value }))} placeholder="WhatsApp number" style={inp()} required />
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "end" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: d.muted, textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.06em" }}>Password</label>
                                    <input value={vendorForm.password} onChange={(e) => setVendorForm((p) => ({ ...p, password: e.target.value }))} placeholder="Set or auto-generate password" style={inp()} />
                                </div>
                                <button type="button" onClick={() => setVendorForm((p) => ({ ...p, password: randomPassword() }))}
                                    style={{ height: "40px", padding: "0 12px", backgroundColor: accentSoft, border: `1px solid ${isDark ? "rgba(34,197,94,0.35)" : "#86efac"}`, borderRadius: "8px", color: accent, fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                                    Generate
                                </button>
                            </div>
                            {createVendorErr && <p style={{ margin: 0, fontSize: "12px", color: "#ef4444", fontWeight: "700" }}>{createVendorErr}</p>}
                            {createVendorMsg && <p style={{ margin: 0, fontSize: "12px", color: "#22c55e", fontWeight: "700" }}>{createVendorMsg}</p>}

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "6px" }}>
                                <button type="button" onClick={closeCreateVendorModal}
                                    style={{ padding: "9px 14px", backgroundColor: "transparent", border: `1px solid ${d.border}`, borderRadius: "8px", color: d.muted, fontSize: "12px", fontWeight: "700", cursor: creatingVendor ? "not-allowed" : "pointer" }} disabled={creatingVendor}>
                                    Cancel
                                </button>
                                <button type="submit"
                                    style={{ padding: "9px 14px", backgroundColor: creatingVendor ? d.muted : accent, border: "none", borderRadius: "8px", color: "white", fontSize: "12px", fontWeight: "700", cursor: creatingVendor ? "not-allowed" : "pointer" }} disabled={creatingVendor}>
                                    {creatingVendor ? "Creating..." : "Create Vendor"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}