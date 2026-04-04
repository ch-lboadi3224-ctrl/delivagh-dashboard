import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import Login from "./Login";
import Signup from "./Signup";

const API = "https://web-production-a3a4.up.railway.app";

export default function App() {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [page, setPage] = useState("login");
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, delivered: 0, revenue: 0, unpaidRevenue: 0 });
    const [activePage, setActivePage] = useState("overview");
    const [activeTab, setActiveTab] = useState("all");
    const [businessName, setBusinessName] = useState("");
    const [menuItems, setMenuItems] = useState([]);
    const [newItem, setNewItem] = useState({ item_name: "", item_price: "", item_description: "", category: "Main" });
    const [editItem, setEditItem] = useState(null); // for editing menu items
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [notifications, setNotifications] = useState([]); // action notifications
    const [newOrderAlert, setNewOrderAlert] = useState(false);
    const [menuFilter, setMenuFilter] = useState("All");
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [settings, setSettings] = useState({ auto_accept: false, is_open: true, open_time: "08:00", close_time: "22:00" });
    const [broadcastMsg, setBroadcastMsg] = useState("");
    const [broadcastSending, setBroadcastSending] = useState(false);
    const [broadcastResult, setBroadcastResult] = useState(null);
    const [insights, setInsights] = useState({ topItems: [], totalCustomers: 0, avgOrderValue: 0 });
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem("delivagh_dark") === "true");
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [buttonLoading, setButtonLoading] = useState({});
    const [settingsSaved, setSettingsSaved] = useState(false);
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [audioReady, setAudioReady] = useState(false);
    const ordersRef = useRef([]);
    const audioCtxRef = useRef(null);
    const audioBufferRef = useRef(null);
    const audioReadyRef = useRef(false);
    const businessNameRef = useRef("");
    const notifIdRef = useRef(0);


    // ── THEME ──
    const dm = darkMode;
    const d = dm ? {
        bg: "#0f1117", bg2: "#161b22", bg3: "#1c2128", card: "#1c2128",
        border: "#30363d", text: "#e6edf3", muted: "#7d8590", sidebar: "#0d1117",
        hover: "#21262d", input: "#21262d", inputBorder: "#30363d",
    } : {
        bg: "#f4f6f9", bg2: "#ffffff", bg3: "#f8fafc", card: "#ffffff",
        border: "#e8ecf0", text: "#0f172a", muted: "#64748b", sidebar: "#ffffff",
        hover: "#f1f5f9", input: "#f8fafc", inputBorder: "#e2e8f0",
    };

    function toggleDark() {
        const next = !darkMode;
        setDarkMode(next);
        localStorage.setItem("delivagh_dark", String(next));
    }

    // ── ADD ACTION NOTIFICATION ──
    function addNotif(message, type = "success") {
        const id = ++notifIdRef.current;
        setNotifications(prev => [{ id, message, type, time: new Date() }, ...prev.slice(0, 19)]);
        setTimeout(() => {
            // auto-dismiss toast after 4s but keep in bell panel
        }, 4000);
    }
    // ── AUDIO ──
    async function initAudio() {
        try {
            if (audioReadyRef.current) return;
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            audioCtxRef.current = ctx;
            await ctx.resume();
            const sr = ctx.sampleRate;
            const buffer = ctx.createBuffer(1, sr * 1.5, sr);
            const data = buffer.getChannelData(0);
            const notes = [{ f: 523, s: 0 }, { f: 659, s: 0.2 }, { f: 784, s: 0.4 }, { f: 1047, s: 0.6 }];
            for (let i = 0; i < data.length; i++) {
                const t = i / sr;
                let v = 0;
                notes.forEach(({ f, s }) => {
                    if (t >= s && t < s + 0.18) {
                        const env = Math.min((t - s) / 0.01, 1) * Math.max(1 - (t - s - 0.1) / 0.08, 0);
                        v += 0.5 * env * Math.sign(Math.sin(2 * Math.PI * f * t));
                    }
                });
                data[i] = Math.max(-1, Math.min(1, v));
            }
            audioBufferRef.current = buffer;
            audioReadyRef.current = true;
            setAudioReady(true);
            console.log("Audio ready ✓");
        } catch (e) { console.log("Audio init error:", e); }
    }

    function playNotification() {
        try {
            const ctx = audioCtxRef.current;
            const buffer = audioBufferRef.current;
            if (!ctx || !buffer || !audioReadyRef.current) {
                console.log("Audio not ready yet");
                return;
            }
            if (ctx.state === "suspended") ctx.resume();
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start(0);
            console.log("Playing notification sound ✓");
        } catch (e) { console.log("Sound play error:", e); }
    }

    // Init audio on ANY user interaction
    useEffect(() => {
        const events = ["click", "keydown", "touchstart", "mousedown"];
        const handler = () => { initAudio(); };
        events.forEach(e => document.addEventListener(e, handler, { once: false, passive: true }));
        return () => events.forEach(e => document.removeEventListener(e, handler));
    }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setAuthLoading(false);
        });
        supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });
    }, []);

    // ── REAL-TIME SUBSCRIPTION ──
    useEffect(() => {
        if (!user) return;
        fetchOrders();
        fetchBusinessName();

        const channel = supabase.channel("orders-rt-" + user.id);
        channel
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
                console.log("RT INSERT:", payload.new.id);
                setOrders(prev => {
                    if (prev.find(o => o.id === payload.new.id)) return prev;
                    const updated = [payload.new, ...prev];
                    ordersRef.current = updated;
                    updateStats(updated);
                    computeInsights(updated);
                    return updated;
                });
                if (payload.new.status === "pending") {
                    playNotification();
                    setNewOrderAlert(true);
                    setTimeout(() => setNewOrderAlert(false), 8000);
                    addNotif("New order received from " + (payload.new.customer_phone?.replace("whatsapp:", "") || "customer"), "new");
                }
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
                console.log("RT UPDATE:", payload.new.id, payload.new.status);
                setOrders(prev => {
                    const updated = prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o);
                    ordersRef.current = updated;
                    updateStats(updated);
                    computeInsights(updated);
                    return updated;
                });
                setSelectedOrder(sel => sel?.id === payload.new.id ? { ...sel, ...payload.new } : sel);
                setButtonLoading(prev => ({ ...prev, [payload.new.id]: false }));
            })
            .subscribe(status => console.log("RT status:", status));

        // Poll every 30s as backup for realtime
        const poll = setInterval(() => fetchOrders(), 30000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(poll);
        };
    }, [user]);

    function updateStats(data) {
        const paidOrders = data.filter(o => o.payment_status === "paid");
        const revenue = paidOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
        const unpaidRevenue = data.filter(o => o.payment_status !== "paid" && o.status !== "pending" && o.status !== "rejected")
            .reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
        setStats({
            total: data.length,
            pending: data.filter(o => o.status === "pending").length,
            confirmed: data.filter(o => o.status === "confirmed").length,
            delivered: data.filter(o => o.status === "delivered").length,
            revenue, unpaidRevenue,
        });
    }

    function computeInsights(data) {
        const itemCounts = {};
        data.forEach(order => {
            (order.items || '').match(/\d+x\s+([^,\n]+)/g)?.forEach(match => {
                const parts = match.match(/(\d+)x\s+(.+)/);
                if (parts) {
                    const qty = parseInt(parts[1]);
                    const name = parts[2].trim().replace(/\s*-\s*GHS.*/, '');
                    itemCounts[name] = (itemCounts[name] || 0) + qty;
                }
            });
        });
        const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
        const uniqueCustomers = new Set(data.map(o => o.customer_phone)).size;
        const completedOrders = data.filter(o => o.total_amount > 0);
        const avg = completedOrders.length > 0 ? completedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0) / completedOrders.length : 0;
        setInsights({ topItems, totalCustomers: uniqueCustomers, avgOrderValue: avg });
    }

    async function fetchBusinessName() {
        const { data } = await supabase.from("businesses").select("name").eq("user_id", user.id).limit(1);
        if (data && data.length > 0) {
            const name = data[0].name;
            setBusinessName(name);
            businessNameRef.current = name;
            const { data: menuData } = await supabase.from("menus").select("*").eq("business_name", name).order("created_at", { ascending: false });
            if (menuData) setMenuItems(menuData);
            // FIX: load settings from Supabase directly
            const { data: sd } = await supabase.from("business_settings").select("*").eq("business_name", name).single();
            if (sd) setSettings(sd);
        }
    }

    async function fetchOrders() {
        setLoading(true);
        const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100);
        if (!error && data) {
            ordersRef.current = data;
            setOrders(data);
            updateStats(data);
            computeInsights(data);
        }
        setLoading(false);
    }

    async function fetchMenuItems() {
        const name = businessNameRef.current || businessName;
        if (!name) return;
        const { data } = await supabase.from("menus").select("*").eq("business_name", name).order("created_at", { ascending: false });
        if (data) setMenuItems(data);
    }

    async function addMenuItem() {
        if (!newItem.item_name || !newItem.item_price) return;
        const name = businessName || businessNameRef.current;
        if (!name) {
            alert("Business name not loaded yet. Please wait a moment and try again.");
            return;
        }
        console.log("Adding item to business:", name); // debug
        const { data, error } = await supabase.from("menus").insert([{
            business_name: name,
            item_name: newItem.item_name.trim(),
            item_price: parseFloat(newItem.item_price),
            item_description: newItem.item_description.trim(),
            category: newItem.category,
            available: true
        }]).select();

        console.log("Insert result:", data, error); // debug
        if (error) {
            alert("Error saving item: " + error.message);
            return;
        }
        setNewItem({ item_name: "", item_price: "", item_description: "", category: "Main" });
        setShowAddModal(false);
        // Optimistic update - add to local state immediately
        if (data && data.length > 0) {
            setMenuItems(prev => [data[0], ...prev]);
        }
        await fetchMenuItems();
    }

    // FIX: Edit menu item
    async function saveEditItem() {
        if (!editItem || !editItem.item_name || !editItem.item_price) return;
        await supabase.from("menus").update({
            item_name: editItem.item_name,
            item_price: parseFloat(editItem.item_price),
            item_description: editItem.item_description,
            category: editItem.category
        }).eq("id", editItem.id);
        setShowEditModal(false);
        setEditItem(null);
        await fetchMenuItems();
    }

    async function toggleAvailable(id, current) {
        await supabase.from("menus").update({ available: !current }).eq("id", id);
        await fetchMenuItems();
    }

    async function deleteMenuItem(id) {
        if (window.confirm("Delete this item?")) {
            await supabase.from("menus").delete().eq("id", id);
            await fetchMenuItems();
        }
    }

    // ── UPDATE ORDER STATUS with action notifications ──
    async function updateStatus(id, status, customerPhone, deliveryType) {
        setButtonLoading(prev => ({ ...prev, [id]: true }));

        // Optimistic update
        setOrders(prev => {
            const updated = prev.map(o => o.id === id ? { ...o, status } : o);
            ordersRef.current = updated;
            updateStats(updated);
            return updated;
        });
        setSelectedOrder(sel => sel?.id === id ? { ...sel, status } : sel);

        const statusMessages = {
            confirmed: "Order confirmed — customer notified",
            preparing: "Order marked as preparing — customer notified",
            ready: deliveryType === "delivery" ? "Order on the way — customer notified" : "Order ready for pickup — customer notified",
            delivered: "Order delivered — customer notified",
            rejected: "Order rejected — customer notified",
        };

        try {
            const { error } = await supabase.from("orders").update({ status }).eq("id", id);
            if (error) { fetchOrders(); return; }

            fetch(API + "/whatsapp/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerPhone, orderId: id, status, deliveryType })
            }).catch(e => console.log("Notify error:", e));

            // FIX: Show action notification in bell panel
            addNotif(statusMessages[status] || "Order updated", "success");

        } catch (e) {
            console.log("UpdateStatus error:", e);
            fetchOrders();
        } finally {
            setButtonLoading(prev => ({ ...prev, [id]: false }));
        }
    }

    async function markAsPaid(id) {
        setButtonLoading(prev => ({ ...prev, [id + "_pay"]: true }));
        setOrders(prev => {
            const updated = prev.map(o => o.id === id ? { ...o, payment_status: "paid" } : o);
            ordersRef.current = updated;
            updateStats(updated);
            return updated;
        });
        setSelectedOrder(sel => sel?.id === id ? { ...sel, payment_status: "paid" } : sel);
        try {
            await supabase.from("orders").update({ payment_status: "paid" }).eq("id", id);
            addNotif("Payment marked as received", "success");
        } catch (e) { fetchOrders(); }
        finally { setButtonLoading(prev => ({ ...prev, [id + "_pay"]: false })); }
    }

    // FIX: Save settings properly
    async function saveSettings() {
        try {
            const name = businessNameRef.current || businessName;
            const { error } = await supabase.from("business_settings")
                .upsert({ business_name: name, ...settings }, { onConflict: "business_name" });
            if (error) throw error;
            setSettingsSaved(true);
            setTimeout(() => setSettingsSaved(false), 3000);
            addNotif("Settings saved successfully", "success");
        } catch (e) {
            alert("Failed to save settings.");
        }
    }

    async function sendBroadcast() {
        if (!broadcastMsg.trim()) return;
        setBroadcastSending(true);
        setBroadcastResult(null);
        try {
            const res = await fetch(API + "/whatsapp/broadcast", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ businessName, message: broadcastMsg })
            });
            const data = await res.json();
            setBroadcastResult(data);
            if (data.success) setBroadcastMsg("");
        } catch (e) { setBroadcastResult({ success: false, error: e.message }); }
        setBroadcastSending(false);
    }

    async function handleLogout() {
        await supabase.auth.signOut();
        setUser(null);
    }

    // ── BADGES ──
    function StatusBadge({ status }) {
        const cfg = {
            pending: { bg: "#fef3c7", c: "#92400e", dot: "#f59e0b", label: "Pending" },
            confirmed: { bg: "#dbeafe", c: "#1e40af", dot: "#3b82f6", label: "Confirmed" },
            preparing: { bg: "#fce7f3", c: "#9d174d", dot: "#ec4899", label: "Preparing" },
            ready: { bg: "#ede9fe", c: "#5b21b6", dot: "#8b5cf6", label: "Ready" },
            delivered: { bg: "#dcfce7", c: "#14532d", dot: "#22c55e", label: "Delivered" },
            rejected: { bg: "#fee2e2", c: "#7f1d1d", dot: "#ef4444", label: "Rejected" },
        };
        const s = cfg[status] || { bg: "#f3f4f6", c: "#374151", dot: "#9ca3af", label: status || "—" };
        return (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", backgroundColor: s.bg, color: s.c, padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: s.dot, flexShrink: 0 }} />
                {s.label}
            </span>
        );
    }

    function PaymentBadge({ status, paymentMethod, orderId, showMarkPaid }) {
        const isPaid = status === "paid";
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", backgroundColor: isPaid ? "#dcfce7" : "#fef3c7", color: isPaid ? "#14532d" : "#92400e", padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: isPaid ? "#22c55e" : "#f59e0b", flexShrink: 0 }} />
                    {isPaid ? "Paid" : "Unpaid"}
                </span>
                {!isPaid && showMarkPaid && (
                    <button onClick={e => { e.stopPropagation(); markAsPaid(orderId); }} disabled={buttonLoading[orderId + "_pay"]}
                        style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "3px 10px", borderRadius: "5px", fontSize: "10px", fontWeight: "700", cursor: "pointer" }}>
                        {buttonLoading[orderId + "_pay"] ? "..." : "Mark Paid"}
                    </button>
                )}
            </div>
        );
    }

    function getNextAction(orderId) {
        const order = ordersRef.current.find(o => o.id === orderId) || orders.find(o => o.id === orderId);
        if (!order) return null;
        const isLoading = buttonLoading[orderId];
        const btn = (bg, label, cb) => (
            <button disabled={isLoading}
                style={{ backgroundColor: isLoading ? "#94a3b8" : bg, color: "white", border: "none", padding: "6px 12px", borderRadius: "7px", fontSize: "11px", fontWeight: "600", cursor: isLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: isLoading ? 0.7 : 1 }}
                onClick={async e => { e.stopPropagation(); if (!isLoading) await cb(); }}>
                {isLoading ? "..." : label}
            </button>
        );
        switch (order.status) {
            case "pending": return (
                <div style={{ display: "flex", gap: "5px" }}>
                    {btn("#2563eb", "Accept", () => updateStatus(order.id, "confirmed", order.customer_phone, order.delivery_type))}
                    {btn("#dc2626", "Reject", () => updateStatus(order.id, "rejected", order.customer_phone, order.delivery_type))}
                </div>
            );
            case "confirmed": return btn("#db2777", "Preparing", () => updateStatus(order.id, "preparing", order.customer_phone, order.delivery_type));
            case "preparing": return btn("#7c3aed", order.delivery_type === "delivery" ? "On the Way" : "Ready", () => updateStatus(order.id, "ready", order.customer_phone, order.delivery_type));
            case "ready": return btn("#16a34a", "Delivered", () => updateStatus(order.id, "delivered", order.customer_phone, order.delivery_type));
            case "delivered": return <span style={{ color: "#16a34a", fontSize: "11px", fontWeight: "700" }}>Done</span>;
            case "rejected": return <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: "700" }}>Rejected</span>;
            default: return null;
        }
    }

    const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
    const todayRevenue = todayOrders.filter(o => o.payment_status === "paid").reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
    const filteredOrders = activeTab === "all" ? orders : orders.filter(o => o.status === activeTab);
    const filteredMenu = menuFilter === "All" ? menuItems : menuItems.filter(i => i.category === menuFilter);
    const sidebarW = sidebarCollapsed ? "60px" : "240px";
    const unreadNotifs = notifications.length;

    const inp = (extra = {}) => ({
        padding: "10px 12px", backgroundColor: d.input, border: `1px solid ${d.inputBorder}`,
        borderRadius: "8px", fontSize: "13px", color: d.text, outline: "none",
        width: "100%", boxSizing: "border-box", ...extra
    });

    const navItems = [
        {
            id: "overview", label: "Overview",
            icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
        },
        {
            id: "pending", label: "Orders", badge: stats.pending,
            icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></svg>
        },
        {
            id: "menu", label: "Menu",
            icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
        },
        {
            id: "insights", label: "Insights",
            icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
        },
        {
            id: "settings", label: "Settings",
            icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
        },
    ];

    if (authLoading) return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1117" }}>
            <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "white" }}>Delivagh<span style={{ color: "#2563eb" }}>.</span></div>
                <p style={{ color: "#7d8590", marginTop: "8px", fontSize: "13px" }}>Loading...</p>
            </div>
        </div>
    );

    if (!user && page === "signup") return <Signup onSignup={u => { setUser(u); setPage("login"); }} onLogin={() => setPage("login")} />;
    if (!user) return <Login onLogin={u => setUser(u)} onSignup={() => setPage("signup")} />;

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
            <style>{`
                * { font-family: 'Inter', -apple-system, sans-serif; box-sizing: border-box; }
                body { margin: 0; background: ${d.bg}; }
                ::-webkit-scrollbar { width: 4px; height: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: ${d.border}; border-radius: 2px; }
                @keyframes slideIn { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
                @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
                .row-hover:hover td { background: ${d.hover} !important; }
            `}</style>

            <div style={{ display: "flex", minHeight: "100vh", backgroundColor: d.bg, color: d.text }}>

                {/* ── NEW ORDER TOAST ── */}
                {newOrderAlert && (
                    <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}>
                        {/* Flashing border around entire screen */}
                        <div style={{ position: "absolute", inset: 0, border: "4px solid #dc2626", animation: "blink 0.5s infinite", borderRadius: "0" }} />

                        {/* Big centered notification */}
                        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "all" }}>
                            <div style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)", color: "white", padding: "32px 48px", borderRadius: "24px", boxShadow: "0 24px 80px rgba(220,38,38,0.7)", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", minWidth: "360px", animation: "pulse 0.8s infinite", textAlign: "center" }}>
                                <div style={{ fontSize: "56px", animation: "blink 0.6s infinite" }}>🔔</div>
                                <div>
                                    <p style={{ margin: 0, fontWeight: "900", fontSize: "28px", letterSpacing: "-0.5px" }}>NEW ORDER!</p>
                                    <p style={{ margin: "6px 0 0", fontSize: "15px", opacity: 0.9 }}>A customer just placed an order</p>
                                </div>
                                <button onClick={() => { setNewOrderAlert(false); setActivePage("pending"); setActiveTab("pending"); }}
                                    style={{ background: "white", border: "none", color: "#dc2626", padding: "12px 32px", borderRadius: "12px", cursor: "pointer", fontSize: "15px", fontWeight: "800", width: "100%" }}>
                                    View Order →
                                </button>
                                <button onClick={() => setNewOrderAlert(false)}
                                    style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", padding: "8px 24px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
                                    Dismiss
                                </button>
                            </div>
                        </div>

                        {/* Corner toast as well */}
                        <div style={{ position: "absolute", top: "20px", right: "20px", background: "#dc2626", color: "white", padding: "14px 20px", borderRadius: "12px", boxShadow: "0 8px 32px rgba(220,38,38,0.5)", display: "flex", alignItems: "center", gap: "10px", animation: "slideIn 0.3s ease" }}>
                            <span style={{ fontSize: "20px" }}>🔔</span>
                            <div>
                                <p style={{ margin: 0, fontWeight: "800", fontSize: "13px" }}>New Order!</p>
                                <p style={{ margin: 0, fontSize: "11px", opacity: 0.85 }}>{stats.pending} pending</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── ORDER DETAIL MODAL ── */}
                {selectedOrder && (() => {
                    const liveOrder = orders.find(o => o.id === selectedOrder.id) || selectedOrder;
                    // FIX: payment options based on delivery type
                    const paymentOptions = liveOrder.delivery_type === "pickup"
                        ? ["MoMo", "Pay on Pickup"]
                        : ["MoMo", "Pay on Delivery"];
                    return (
                        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}
                            onClick={() => setSelectedOrder(null)}>
                            <div style={{ backgroundColor: d.card, borderRadius: "18px", padding: "26px", width: "100%", maxWidth: "480px", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", maxHeight: "90vh", overflowY: "auto", border: `1px solid ${d.border}` }}
                                onClick={e => e.stopPropagation()}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: d.text }}>Order Details</h2>
                                        <p style={{ margin: "3px 0 0", fontSize: "11px", color: d.muted, fontFamily: "monospace" }}>#{liveOrder.id.substring(0, 8).toUpperCase()}</p>
                                    </div>
                                    <button onClick={() => setSelectedOrder(null)} style={{ background: d.hover, border: `1px solid ${d.border}`, borderRadius: "7px", padding: "5px 12px", cursor: "pointer", fontSize: "12px", fontWeight: "600", color: d.muted }}>Close</button>
                                </div>

                                <div style={{ display: "flex", gap: "7px", marginBottom: "18px", flexWrap: "wrap", alignItems: "center" }}>
                                    <StatusBadge status={liveOrder.status} />
                                    <PaymentBadge status={liveOrder.payment_status} paymentMethod={liveOrder.payment_method} orderId={liveOrder.id} showMarkPaid={true} />
                                    {liveOrder.payment_method && (
                                        <span style={{ backgroundColor: d.hover, color: d.muted, padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>
                                            {liveOrder.payment_method === "momo" ? "MoMo" : liveOrder.delivery_type === "pickup" ? "Pay on Pickup" : "Pay on Delivery"}
                                        </span>
                                    )}
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "7px", marginBottom: "18px" }}>
                                    {[
                                        { label: "Customer", value: liveOrder.customer_phone?.replace("whatsapp:", "") },
                                        { label: "Items", value: liveOrder.items },
                                        { label: "Total", value: liveOrder.total_amount ? "GHS " + parseFloat(liveOrder.total_amount).toFixed(2) : "-" },
                                        ...(liveOrder.momo_number ? [{ label: "MoMo #", value: liveOrder.momo_number }] : []),
                                        { label: "Type", value: liveOrder.delivery_type === "pickup" ? "Pickup" : "Delivery" },
                                        ...(liveOrder.delivery_address ? [{ label: "Address", value: liveOrder.delivery_address }] : []),
                                        { label: "Time", value: new Date(liveOrder.created_at).toLocaleString("en-GH", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) },
                                    ].map(item => (
                                        <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "9px 13px", backgroundColor: d.hover, borderRadius: "8px" }}>
                                            <span style={{ fontSize: "11px", color: d.muted, fontWeight: "500", flexShrink: 0, marginRight: "12px" }}>{item.label}</span>
                                            <span style={{ fontSize: "12px", fontWeight: "600", color: d.text, textAlign: "right" }}>{item.value}</span>
                                        </div>
                                    ))}
                                    {liveOrder.notes && (
                                        <div style={{ padding: "11px 13px", backgroundColor: "#fefce8", borderRadius: "8px", border: "1px solid #fde68a" }}>
                                            <p style={{ margin: "0 0 3px", fontSize: "10px", fontWeight: "700", color: "#92400e", textTransform: "uppercase" }}>Special Instructions</p>
                                            <p style={{ margin: 0, fontSize: "13px", color: "#78350f" }}>{liveOrder.notes}</p>
                                        </div>
                                    )}
                                    {/* FIX: payment options based on delivery type */}
                                    <div style={{ padding: "11px 13px", backgroundColor: d.hover, borderRadius: "8px" }}>
                                        <p style={{ margin: "0 0 6px", fontSize: "10px", fontWeight: "700", color: d.muted, textTransform: "uppercase" }}>Payment Options</p>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            {paymentOptions.map(opt => (
                                                <span key={opt} style={{ backgroundColor: d.bg3, border: `1px solid ${d.border}`, color: d.text, padding: "4px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>{opt}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: "flex", gap: "9px" }}>
                                    <div style={{ flex: 1 }}>{getNextAction(liveOrder.id)}</div>
                                    <button onClick={() => setSelectedOrder(null)}
                                        style={{ flex: 1, backgroundColor: d.hover, color: d.muted, border: `1px solid ${d.border}`, padding: "8px 16px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* ── ADD MENU MODAL ── */}
                {showAddModal && (
                    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}
                        onClick={() => setShowAddModal(false)}>
                        <div style={{ backgroundColor: d.card, borderRadius: "18px", padding: "26px", width: "100%", maxWidth: "420px", boxShadow: "0 24px 64px rgba(0,0,0,0.3)", border: `1px solid ${d.border}` }}
                            onClick={e => e.stopPropagation()}>
                            <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: "700", color: d.text }}>Add Menu Item</h2>
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <input value={newItem.item_name} onChange={e => setNewItem({ ...newItem, item_name: e.target.value })} placeholder="Item name (e.g. Jollof Rice)" style={inp()} />
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                    <input value={newItem.item_price} onChange={e => setNewItem({ ...newItem, item_price: e.target.value })} placeholder="Price (GHS)" type="number" style={inp()} />
                                    <select value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} style={inp()}>
                                        <option value="Main">Main</option>
                                        <option value="Sides">Sides</option>
                                        <option value="Extras">Extras</option>
                                    </select>
                                </div>
                                <textarea value={newItem.item_description} onChange={e => setNewItem({ ...newItem, item_description: e.target.value })} placeholder="Description..." style={inp({ height: "80px", resize: "none" })} />
                                <div style={{ display: "flex", gap: "10px", paddingTop: "4px" }}>
                                    <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: "11px", backgroundColor: "transparent", border: `1px solid ${d.border}`, borderRadius: "9px", cursor: "pointer", fontWeight: "600", color: d.muted, fontSize: "13px" }}>Cancel</button>
                                    <button onClick={addMenuItem} style={{ flex: 2, padding: "11px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "9px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>Save Item</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── EDIT MENU MODAL ── */}
                {showEditModal && editItem && (
                    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }}
                        onClick={() => setShowEditModal(false)}>
                        <div style={{ backgroundColor: d.card, borderRadius: "18px", padding: "26px", width: "100%", maxWidth: "420px", boxShadow: "0 24px 64px rgba(0,0,0,0.3)", border: `1px solid ${d.border}` }}
                            onClick={e => e.stopPropagation()}>
                            <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: "700", color: d.text }}>Edit Item</h2>
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <input value={editItem.item_name} onChange={e => setEditItem({ ...editItem, item_name: e.target.value })} placeholder="Item name" style={inp()} />
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                    <input value={editItem.item_price} onChange={e => setEditItem({ ...editItem, item_price: e.target.value })} placeholder="Price (GHS)" type="number" style={inp()} />
                                    <select value={editItem.category} onChange={e => setEditItem({ ...editItem, category: e.target.value })} style={inp()}>
                                        <option value="Main">Main</option>
                                        <option value="Sides">Sides</option>
                                        <option value="Extras">Extras</option>
                                    </select>
                                </div>
                                <textarea value={editItem.item_description} onChange={e => setEditItem({ ...editItem, item_description: e.target.value })} placeholder="Description..." style={inp({ height: "80px", resize: "none" })} />
                                <div style={{ display: "flex", gap: "10px", paddingTop: "4px" }}>
                                    <button onClick={() => { setShowEditModal(false); setEditItem(null); }} style={{ flex: 1, padding: "11px", backgroundColor: "transparent", border: `1px solid ${d.border}`, borderRadius: "9px", cursor: "pointer", fontWeight: "600", color: d.muted, fontSize: "13px" }}>Cancel</button>
                                    <button onClick={saveEditItem} style={{ flex: 2, padding: "11px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "9px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>Save Changes</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── SIDEBAR ── */}
                <aside style={{ width: sidebarW, backgroundColor: d.bg2, borderRight: `1px solid ${d.border}`, display: "flex", flexDirection: "column", flexShrink: 0, position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100, transition: "width 0.2s ease", overflow: "hidden" }}>
                    <div style={{ padding: sidebarCollapsed ? "18px 0" : "18px 14px", display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "space-between", borderBottom: `1px solid ${d.border}`, flexShrink: 0 }}>
                        {!sidebarCollapsed && <div style={{ fontSize: "15px", fontWeight: "800", color: d.text, letterSpacing: "-0.3px" }}>Delivagh<span style={{ color: "#2563eb" }}>.</span></div>}
                        <button onClick={() => setSidebarCollapsed(c => !c)} style={{ width: "26px", height: "26px", borderRadius: "6px", border: `1px solid ${d.border}`, backgroundColor: d.hover, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: d.muted, fontSize: "11px", flexShrink: 0 }}>
                            {sidebarCollapsed ? "»" : "«"}
                        </button>
                    </div>
                    <nav style={{ flex: 1, padding: sidebarCollapsed ? "10px 8px" : "10px 8px", display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" }}>
                        {navItems.map(item => {
                            const isActive = activePage === item.id;
                            return (
                                <button key={item.id} onClick={() => { setActivePage(item.id); if (item.id === "pending") setActiveTab("all"); }}
                                    title={sidebarCollapsed ? item.label : ""}
                                    style={{ display: "flex", alignItems: "center", gap: "9px", padding: sidebarCollapsed ? "10px" : "10px 11px", borderRadius: "8px", border: "none", cursor: "pointer", textAlign: "left", fontWeight: "600", fontSize: "12px", transition: "all 0.12s", backgroundColor: isActive ? (dm ? "rgba(37,99,235,0.12)" : "#eff6ff") : "transparent", color: isActive ? "#2563eb" : d.muted, justifyContent: sidebarCollapsed ? "center" : "flex-start", position: "relative" }}>
                                    <span style={{ flexShrink: 0, color: isActive ? "#2563eb" : d.muted }}>{item.icon}</span>
                                    {!sidebarCollapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                                    {item.badge > 0 && !sidebarCollapsed && (
                                        <span style={{ backgroundColor: "#dc2626", color: "white", fontSize: "10px", padding: "1px 6px", borderRadius: "999px", fontWeight: "800", animation: "pulse 2s infinite" }}>{item.badge}</span>
                                    )}
                                    {item.badge > 0 && sidebarCollapsed && (
                                        <span style={{ position: "absolute", top: "5px", right: "5px", backgroundColor: "#dc2626", color: "white", fontSize: "8px", width: "14px", height: "14px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800" }}>{item.badge}</span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                    {!sidebarCollapsed && (
                        <div style={{ padding: "10px 10px 6px", borderTop: `1px solid ${d.border}`, flexShrink: 0 }}>
                            <div style={{ backgroundColor: d.bg3, borderRadius: "9px", padding: "11px", border: `1px solid ${d.border}`, marginBottom: "9px" }}>
                                <p style={{ margin: "0 0 2px", fontSize: "9px", fontWeight: "700", color: d.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Revenue</p>
                                <p style={{ margin: "0 0 1px", fontSize: "17px", fontWeight: "800", color: "#16a34a", lineHeight: 1 }}>GHS {stats.revenue.toFixed(2)}</p>
                                <p style={{ margin: 0, fontSize: "10px", color: d.muted }}>GHS {stats.unpaidRevenue.toFixed(2)} pending</p>
                                <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "5px" }}>
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: settings.is_open ? "#22c55e" : "#ef4444" }} />
                                    <span style={{ fontSize: "10px", color: settings.is_open ? "#16a34a" : "#dc2626", fontWeight: "700" }}>{settings.is_open ? "Open" : "Closed"}</span>
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", padding: "0 2px" }}>
                                <div style={{ width: "30px", height: "30px", borderRadius: "7px", backgroundColor: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "13px", color: "white", flexShrink: 0 }}>
                                    {(businessName || user.email || "?").charAt(0).toUpperCase()}
                                </div>
                                <div style={{ overflow: "hidden" }}>
                                    <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: d.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{businessName || user.email?.split("@")[0]}</p>
                                    <p style={{ margin: 0, fontSize: "10px", color: d.muted }}>Vendor</p>
                                </div>
                            </div>
                        </div>
                    )}
                    <div style={{ padding: sidebarCollapsed ? "8px" : "0 10px 10px", flexShrink: 0 }}>
                        <button onClick={handleLogout} title={sidebarCollapsed ? "Sign Out" : ""}
                            style={{ width: "100%", backgroundColor: d.hover, color: d.muted, border: `1px solid ${d.border}`, padding: "8px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                            onMouseEnter={e => { e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.borderColor = "#fca5a5"; }}
                            onMouseLeave={e => { e.currentTarget.style.color = d.muted; e.currentTarget.style.borderColor = d.border; }}>
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                            {!sidebarCollapsed && "Sign Out"}
                        </button>
                    </div>
                </aside>

                {/* ── MAIN ── */}
                <main style={{ marginLeft: sidebarW, flex: 1, display: "flex", flexDirection: "column", minWidth: 0, transition: "margin-left 0.2s ease" }}>

                    {/* HEADER */}
                    <header style={{ height: "58px", backgroundColor: d.bg2, borderBottom: `1px solid ${d.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", position: "sticky", top: 0, zIndex: 50, flexShrink: 0 }}>
                        <div>
                            <h1 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: d.text }}>
                                {{ overview: "Overview", pending: "Orders", menu: "Menu Manager", insights: "Insights", settings: "Settings" }[activePage]}
                            </h1>
                            <p style={{ margin: 0, fontSize: "10px", color: d.muted }}>{new Date().toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {activePage === "menu" && (
                                <button onClick={() => setShowAddModal(true)} style={{ display: "flex", alignItems: "center", gap: "5px", backgroundColor: "#2563eb", color: "white", padding: "7px 14px", borderRadius: "8px", fontWeight: "600", fontSize: "12px", border: "none", cursor: "pointer" }}>
                                    + Add Item
                                </button>
                            )}
                            {!audioReady && (
                                <button onClick={initAudio}
                                    style={{ display: "flex", alignItems: "center", gap: "5px", backgroundColor: "#fef3c7", color: "#92400e", padding: "6px 12px", borderRadius: "8px", fontWeight: "700", fontSize: "11px", border: "1px solid #fde68a", cursor: "pointer" }}
                                    title="Click to enable notification sounds">
                                    🔔 Enable Sound
                                </button>
                            )}
                            {stats.pending > 0 && (
                                <button onClick={() => { setActivePage("pending"); setActiveTab("pending"); }}
                                    style={{ display: "flex", alignItems: "center", gap: "5px", backgroundColor: "#fef3c7", color: "#92400e", padding: "6px 12px", borderRadius: "8px", fontWeight: "700", fontSize: "11px", border: "1px solid #fde68a", cursor: "pointer" }}>
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#f59e0b", animation: "blink 1.2s infinite" }} />
                                    {stats.pending} pending
                                </button>
                            )}

                            {/* ── NOTIFICATION BELL ── */}
                            <div style={{ position: "relative" }}>
                                <button onClick={() => setShowNotifPanel(p => !p)}
                                    style={{ width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${d.border}`, backgroundColor: d.hover, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", position: "relative" }}>
                                    🔔
                                    {unreadNotifs > 0 && (
                                        <span style={{ position: "absolute", top: "4px", right: "4px", backgroundColor: "#dc2626", color: "white", fontSize: "8px", width: "14px", height: "14px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800" }}>
                                            {unreadNotifs > 9 ? "9+" : unreadNotifs}
                                        </span>
                                    )}
                                </button>
                                {showNotifPanel && (
                                    <div style={{ position: "absolute", top: "42px", right: 0, width: "320px", backgroundColor: d.card, borderRadius: "12px", border: `1px solid ${d.border}`, boxShadow: "0 16px 48px rgba(0,0,0,0.2)", zIndex: 200, animation: "slideDown 0.2s ease", overflow: "hidden" }}>
                                        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${d.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: d.text }}>Notifications</p>
                                            <button onClick={() => { setNotifications([]); setShowNotifPanel(false); }} style={{ background: "none", border: "none", fontSize: "11px", color: d.muted, cursor: "pointer", fontWeight: "600" }}>Clear all</button>
                                        </div>
                                        <div style={{ maxHeight: "320px", overflowY: "auto" }}>
                                            {notifications.length === 0 ? (
                                                <p style={{ padding: "24px", textAlign: "center", color: d.muted, fontSize: "13px", margin: 0 }}>No notifications yet</p>
                                            ) : notifications.map(n => (
                                                <div key={n.id} style={{ padding: "11px 16px", borderBottom: `1px solid ${d.border}`, display: "flex", alignItems: "flex-start", gap: "10px" }}>
                                                    <span style={{ fontSize: "16px", flexShrink: 0 }}>{n.type === "new" ? "🔔" : "✅"}</span>
                                                    <div>
                                                        <p style={{ margin: "0 0 2px", fontSize: "12px", fontWeight: "600", color: d.text }}>{n.message}</p>
                                                        <p style={{ margin: 0, fontSize: "10px", color: d.muted }}>{n.time.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button onClick={toggleDark} style={{ width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${d.border}`, backgroundColor: d.hover, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                                {darkMode ? "☀️" : "🌙"}
                            </button>
                        </div>
                    </header>

                    <div style={{ padding: "20px 22px", flex: 1, overflowY: "auto" }}>

                        {/* ── OVERVIEW ── */}
                        {activePage === "overview" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
                                    {[
                                        { label: "Total Orders", value: stats.total, sub: "All time" },
                                        { label: "Pending", value: stats.pending, sub: "Need action", accent: stats.pending > 0 },
                                        { label: "Delivered Today", value: todayOrders.filter(o => o.status === "delivered").length, sub: "Completed" },
                                        { label: "Today's Orders", value: todayOrders.length, sub: "Since midnight" },
                                    ].map((s, i) => (
                                        <div key={i} style={{ backgroundColor: d.card, border: `1px solid ${s.accent ? "#fde68a" : d.border}`, borderRadius: "12px", padding: "16px", transition: "transform 0.15s", cursor: "default" }}
                                            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                                            onMouseLeave={e => e.currentTarget.style.transform = ""}>
                                            <p style={{ margin: "0 0 6px", fontSize: "10px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
                                            <p style={{ margin: "0 0 3px", fontSize: "28px", fontWeight: "800", color: s.accent ? "#d97706" : d.text, lineHeight: 1 }}>{s.value}</p>
                                            <p style={{ margin: 0, fontSize: "11px", color: s.accent ? "#d97706" : d.muted }}>{s.sub}</p>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
                                    {[
                                        { label: "Total Revenue", value: "GHS " + stats.revenue.toFixed(2), c: "#16a34a", bg: dm ? "rgba(22,163,74,0.07)" : "#f0fdf4", br: dm ? "rgba(22,163,74,0.18)" : "#bbf7d0" },
                                        { label: "Today's Revenue", value: "GHS " + todayRevenue.toFixed(2), c: "#2563eb", bg: dm ? "rgba(37,99,235,0.07)" : "#eff6ff", br: dm ? "rgba(37,99,235,0.18)" : "#bfdbfe" },
                                        { label: "Pending Payment", value: "GHS " + stats.unpaidRevenue.toFixed(2), c: "#d97706", bg: dm ? "rgba(217,119,6,0.07)" : "#fffbeb", br: dm ? "rgba(217,119,6,0.18)" : "#fde68a" },
                                    ].map((s, i) => (
                                        <div key={i} style={{ backgroundColor: s.bg, border: `1px solid ${s.br}`, borderRadius: "12px", padding: "16px" }}>
                                            <p style={{ margin: "0 0 5px", fontSize: "10px", fontWeight: "600", color: s.c, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.8 }}>{s.label}</p>
                                            <p style={{ margin: "0", fontSize: "22px", fontWeight: "800", color: s.c, lineHeight: 1 }}>{s.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "14px" }}>
                                    <div style={{ backgroundColor: d.card, borderRadius: "12px", border: `1px solid ${d.border}`, overflow: "hidden" }}>
                                        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${d.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: d.text }}>Recent Orders</p>
                                            <button onClick={() => setActivePage("pending")} style={{ fontSize: "11px", fontWeight: "600", color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>View all</button>
                                        </div>
                                        <div style={{ overflowX: "auto" }}>
                                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "480px" }}>
                                                <thead><tr style={{ backgroundColor: d.bg3 }}>
                                                    {["Order", "Items", "Total", "Payment", "Status", "Action"].map(h => (
                                                        <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: d.muted }}>{h}</th>
                                                    ))}
                                                </tr></thead>
                                                <tbody>
                                                    {orders.slice(0, 8).map(order => (
                                                        <tr key={order.id} className="row-hover" onClick={() => setSelectedOrder(order)} style={{ borderTop: `1px solid ${d.border}`, cursor: "pointer" }}>
                                                            <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: "11px", fontWeight: "700", color: d.muted }}>#{order.id.substring(0, 8).toUpperCase()}</td>
                                                            <td style={{ padding: "10px 14px", fontSize: "12px", color: d.text, maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.items}</td>
                                                            <td style={{ padding: "10px 14px", fontSize: "12px", fontWeight: "700", color: d.text, whiteSpace: "nowrap" }}>{order.total_amount ? "GHS " + parseFloat(order.total_amount).toFixed(2) : "—"}</td>
                                                            <td style={{ padding: "10px 14px" }}><PaymentBadge status={order.payment_status} paymentMethod={order.payment_method} orderId={order.id} showMarkPaid={false} /></td>
                                                            <td style={{ padding: "10px 14px" }}><StatusBadge status={order.status} /></td>
                                                            <td style={{ padding: "10px 14px" }} onClick={e => e.stopPropagation()}>{getNextAction(order.id)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                        <div style={{ backgroundColor: d.card, borderRadius: "12px", border: `1px solid ${d.border}`, padding: "16px" }}>
                                            <p style={{ margin: "0 0 10px", fontSize: "10px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Today</p>
                                            <p style={{ margin: "0 0 12px", fontSize: "30px", fontWeight: "800", color: d.text, lineHeight: 1 }}>{todayOrders.length} <span style={{ fontSize: "12px", color: d.muted, fontWeight: "500" }}>orders</span></p>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                                {[
                                                    { label: "Pickup", value: todayOrders.filter(o => o.delivery_type === "pickup").length },
                                                    { label: "Delivery", value: todayOrders.filter(o => o.delivery_type === "delivery").length },
                                                ].map((s, i) => (
                                                    <div key={i} style={{ backgroundColor: d.bg3, borderRadius: "8px", padding: "10px", border: `1px solid ${d.border}` }}>
                                                        <p style={{ margin: "0 0 2px", fontSize: "10px", color: d.muted, fontWeight: "600" }}>{s.label}</p>
                                                        <p style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: d.text }}>{s.value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div style={{ backgroundColor: d.card, borderRadius: "12px", border: `1px solid ${d.border}`, padding: "16px" }}>
                                            <p style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: "700", color: d.text }}>Quick Actions</p>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" }}>
                                                {[
                                                    { label: "Add Item", action: () => { setActivePage("menu"); setShowAddModal(true); } },
                                                    { label: "Menu", action: () => setActivePage("menu") },
                                                    { label: "Insights", action: () => setActivePage("insights") },
                                                    { label: "Settings", action: () => setActivePage("settings") },
                                                ].map(btn => (
                                                    <button key={btn.label} onClick={btn.action}
                                                        style={{ padding: "10px 6px", backgroundColor: d.bg3, border: `1px solid ${d.border}`, borderRadius: "8px", cursor: "pointer", fontSize: "11px", fontWeight: "600", color: d.muted }}
                                                        onMouseEnter={e => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.color = "#2563eb"; }}
                                                        onMouseLeave={e => { e.currentTarget.style.borderColor = d.border; e.currentTarget.style.color = d.muted; }}>
                                                        {btn.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── ORDERS ── */}
                        {activePage === "pending" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
                                    {[
                                        { id: "all", label: "All", count: orders.length },
                                        { id: "pending", label: "Pending", count: stats.pending },
                                        { id: "confirmed", label: "Confirmed", count: stats.confirmed },
                                        { id: "delivered", label: "Delivered", count: stats.delivered },
                                    ].map(tab => (
                                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                            style={{ padding: "7px 14px", borderRadius: "8px", border: `1px solid ${activeTab === tab.id ? "#2563eb" : d.border}`, cursor: "pointer", fontSize: "12px", fontWeight: "600", backgroundColor: activeTab === tab.id ? (dm ? "rgba(37,99,235,0.12)" : "#eff6ff") : "transparent", color: activeTab === tab.id ? "#2563eb" : d.muted, display: "flex", alignItems: "center", gap: "6px" }}>
                                            {tab.label}
                                            <span style={{ backgroundColor: activeTab === tab.id ? "#2563eb" : d.border, color: activeTab === tab.id ? "white" : d.muted, borderRadius: "999px", padding: "1px 6px", fontSize: "10px", fontWeight: "700" }}>{tab.count}</span>
                                        </button>
                                    ))}
                                    {!audioReadyRef.current && (
                                        <button onClick={initAudio}
                                            style={{ display: "flex", alignItems: "center", gap: "5px", backgroundColor: "#fef3c7", color: "#92400e", padding: "5px 10px", borderRadius: "7px", fontSize: "11px", fontWeight: "700", border: "1px solid #fde68a", cursor: "pointer" }}>
                                            🔔 Enable Sound
                                        </button>
                                    )}
                                </div>
                                <div style={{ backgroundColor: d.card, borderRadius: "12px", border: `1px solid ${d.border}`, overflow: "hidden" }}>
                                    {loading ? (
                                        <div style={{ padding: "48px", textAlign: "center", color: d.muted, fontSize: "13px" }}>Loading orders...</div>
                                    ) : filteredOrders.length === 0 ? (
                                        <div style={{ padding: "64px", textAlign: "center" }}>
                                            <p style={{ fontSize: "32px", margin: "0 0 10px" }}>📭</p>
                                            <p style={{ color: d.muted, fontSize: "14px", fontWeight: "600", margin: 0 }}>No orders here</p>
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: "auto" }}>
                                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                                                <thead><tr style={{ backgroundColor: d.bg3 }}>
                                                    {["Order", "Customer", "Items", "Total", "Notes", "Type", "Payment", "Status", "Time", "Action"].map(h => (
                                                        <th key={h} style={{ padding: "10px 13px", textAlign: "left", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: d.muted, whiteSpace: "nowrap" }}>{h}</th>
                                                    ))}
                                                </tr></thead>
                                                <tbody>
                                                    {(() => {
                                                        let lastDate = null;
                                                        return filteredOrders.map(order => {
                                                            const orderDate = new Date(order.created_at).toDateString();
                                                            const isNewDate = orderDate !== lastDate;
                                                            lastDate = orderDate;
                                                            const isToday = orderDate === new Date().toDateString();
                                                            const isYest = orderDate === new Date(Date.now() - 86400000).toDateString();
                                                            const dateLabel = isToday ? "Today" : isYest ? "Yesterday" : new Date(order.created_at).toLocaleDateString("en-GH", { weekday: "short", month: "short", day: "numeric" });
                                                            return (
                                                                <>
                                                                    {isNewDate && (
                                                                        <tr key={"d-" + orderDate}><td colSpan="10" style={{ padding: "10px 13px 5px" }}>
                                                                            <span style={{ fontSize: "10px", fontWeight: "700", backgroundColor: isToday ? (dm ? "rgba(37,99,235,0.12)" : "#eff6ff") : d.bg3, color: isToday ? "#2563eb" : d.muted, padding: "3px 10px", borderRadius: "5px" }}>{dateLabel}</span>
                                                                        </td></tr>
                                                                    )}
                                                                    <tr key={order.id} className="row-hover" onClick={() => setSelectedOrder(order)} style={{ borderTop: `1px solid ${d.border}`, cursor: "pointer" }}>
                                                                        <td style={{ padding: "11px 13px", fontFamily: "monospace", fontSize: "11px", fontWeight: "700", color: d.muted }}>#{order.id.substring(0, 8).toUpperCase()}</td>
                                                                        <td style={{ padding: "11px 13px", fontSize: "12px", color: d.muted }}>{order.customer_phone?.replace("whatsapp:", "")}</td>
                                                                        <td style={{ padding: "11px 13px", fontSize: "12px", color: d.text, maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.items}</td>
                                                                        <td style={{ padding: "11px 13px", fontSize: "12px", fontWeight: "700", color: d.text, whiteSpace: "nowrap" }}>{order.total_amount ? "GHS " + parseFloat(order.total_amount).toFixed(2) : "—"}</td>
                                                                        <td style={{ padding: "11px 13px", maxWidth: "110px" }}>
                                                                            {order.notes ? <span title={order.notes} style={{ backgroundColor: dm ? "#2a1f0a" : "#fffbeb", color: "#d97706", padding: "3px 8px", borderRadius: "5px", fontSize: "10px", fontWeight: "700", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.notes}</span>
                                                                                : <span style={{ color: d.muted, fontSize: "12px" }}>—</span>}
                                                                        </td>
                                                                        <td style={{ padding: "11px 13px" }}>
                                                                            <span style={{ backgroundColor: order.delivery_type === "pickup" ? (dm ? "rgba(124,58,237,0.12)" : "#ede9fe") : (dm ? "rgba(37,99,235,0.12)" : "#eff6ff"), color: order.delivery_type === "pickup" ? "#7c3aed" : "#2563eb", padding: "3px 8px", borderRadius: "5px", fontSize: "10px", fontWeight: "700" }}>
                                                                                {order.delivery_type === "pickup" ? "Pickup" : "Delivery"}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: "11px 13px" }}><PaymentBadge status={order.payment_status} paymentMethod={order.payment_method} orderId={order.id} showMarkPaid={false} /></td>
                                                                        <td style={{ padding: "11px 13px" }}><StatusBadge status={order.status} /></td>
                                                                        <td style={{ padding: "11px 13px", fontSize: "11px", color: d.muted, whiteSpace: "nowrap" }}>{new Date(order.created_at).toLocaleString("en-GH", { hour: "2-digit", minute: "2-digit" })}</td>
                                                                        <td style={{ padding: "11px 13px" }} onClick={e => e.stopPropagation()}>{getNextAction(order.id)}</td>
                                                                    </tr>
                                                                </>
                                                            );
                                                        });
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── MENU ── */}
                        {activePage === "menu" && (
                            <div>
                                <div style={{ display: "flex", gap: "7px", marginBottom: "16px" }}>
                                    {["All", "Main", "Sides", "Extras"].map(cat => (
                                        <button key={cat} onClick={() => setMenuFilter(cat)}
                                            style={{ padding: "6px 14px", borderRadius: "8px", border: `1px solid ${menuFilter === cat ? "#2563eb" : d.border}`, cursor: "pointer", fontSize: "12px", fontWeight: "600", backgroundColor: menuFilter === cat ? (dm ? "rgba(37,99,235,0.12)" : "#eff6ff") : d.card, color: menuFilter === cat ? "#2563eb" : d.muted }}>
                                            {cat === "All" ? "All Items" : cat}
                                        </button>
                                    ))}
                                </div>
                                {filteredMenu.length === 0 ? (
                                    <div style={{ textAlign: "center", padding: "72px 20px", backgroundColor: d.card, borderRadius: "12px", border: `1px solid ${d.border}` }}>
                                        <p style={{ fontSize: "32px", margin: "0 0 10px" }}>🍽️</p>
                                        <p style={{ color: d.text, fontSize: "14px", fontWeight: "600", margin: "0 0 4px" }}>No items yet</p>
                                        <p style={{ color: d.muted, fontSize: "12px", margin: 0 }}>Click "+ Add Item" to get started</p>
                                    </div>
                                ) : (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "14px" }}>
                                        {filteredMenu.map(item => (
                                            <div key={item.id} style={{ backgroundColor: d.card, padding: "18px", borderRadius: "12px", border: `1px solid ${d.border}`, opacity: item.available ? 1 : 0.55, transition: "all 0.15s" }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = d.border; e.currentTarget.style.transform = ""; }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                                                    <div>
                                                        <span style={{ fontSize: "9px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: d.muted }}>{item.category || "Main"}</span>
                                                        <h3 style={{ margin: "2px 0 0", fontSize: "14px", fontWeight: "700", color: d.text }}>{item.item_name}</h3>
                                                    </div>
                                                    <div onClick={() => toggleAvailable(item.id, item.available)}
                                                        style={{ width: "36px", height: "20px", backgroundColor: item.available ? "#2563eb" : d.border, borderRadius: "10px", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                                                        <div style={{ position: "absolute", width: "14px", height: "14px", backgroundColor: "white", borderRadius: "50%", top: "3px", left: item.available ? "19px" : "3px", transition: "left 0.2s" }} />
                                                    </div>
                                                </div>
                                                <p style={{ fontSize: "12px", color: d.muted, margin: "0 0 14px", lineHeight: "1.5" }}>{item.item_description || "No description"}</p>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${d.border}`, paddingTop: "12px" }}>
                                                    <span style={{ color: "#2563eb", fontWeight: "800", fontSize: "14px" }}>GHS {parseFloat(item.item_price).toFixed(2)}</span>
                                                    <div style={{ display: "flex", gap: "6px" }}>
                                                        {/* FIX: Edit button */}
                                                        <button onClick={() => { setEditItem({ ...item }); setShowEditModal(true); }}
                                                            style={{ background: "none", border: `1px solid ${d.border}`, cursor: "pointer", color: d.muted, padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}
                                                            onMouseEnter={e => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.color = "#2563eb"; }}
                                                            onMouseLeave={e => { e.currentTarget.style.borderColor = d.border; e.currentTarget.style.color = d.muted; }}>
                                                            Edit
                                                        </button>
                                                        <button onClick={() => deleteMenuItem(item.id)}
                                                            style={{ background: "none", border: "none", cursor: "pointer", color: d.border, fontSize: "14px", padding: "4px 5px", borderRadius: "5px" }}
                                                            onMouseEnter={e => e.currentTarget.style.color = "#dc2626"}
                                                            onMouseLeave={e => e.currentTarget.style.color = d.border}>🗑</button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── INSIGHTS ── */}
                        {activePage === "insights" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
                                    {[
                                        { label: "Total Customers", value: insights.totalCustomers, sub: "Unique WhatsApp numbers" },
                                        { label: "Avg Order Value", value: "GHS " + insights.avgOrderValue.toFixed(2), sub: "Per completed order" },
                                        { label: "Completion Rate", value: Math.round((stats.delivered / (stats.total || 1)) * 100) + "%", sub: "Orders delivered" },
                                    ].map((s, i) => (
                                        <div key={i} style={{ backgroundColor: d.card, padding: "18px", borderRadius: "12px", border: `1px solid ${d.border}` }}>
                                            <p style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
                                            <p style={{ margin: "0 0 3px", fontSize: "26px", fontWeight: "800", color: d.text, lineHeight: 1 }}>{s.value}</p>
                                            <p style={{ margin: 0, fontSize: "11px", color: d.muted }}>{s.sub}</p>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                                    <div style={{ backgroundColor: d.card, borderRadius: "12px", padding: "18px", border: `1px solid ${d.border}` }}>
                                        <h2 style={{ margin: "0 0 14px", fontSize: "13px", fontWeight: "700", color: d.text }}>Best Sellers</h2>
                                        {insights.topItems.length === 0 ? <p style={{ color: d.muted, fontSize: "13px" }}>No data yet</p>
                                            : insights.topItems.map((item, i) => (
                                                <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "11px" }}>
                                                    <span style={{ width: "20px", height: "20px", borderRadius: "5px", backgroundColor: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#d97706" : d.bg3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "800", color: i < 3 ? "white" : d.muted, flexShrink: 0 }}>{i + 1}</span>
                                                    <span style={{ flex: 1, fontSize: "12px", fontWeight: "500", color: d.text }}>{item.name}</span>
                                                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#2563eb" }}>{item.count}x</span>
                                                    <div style={{ width: "60px", height: "3px", backgroundColor: d.bg3, borderRadius: "2px", overflow: "hidden" }}>
                                                        <div style={{ height: "100%", backgroundColor: "#2563eb", width: Math.round((item.count / (insights.topItems[0]?.count || 1)) * 100) + "%" }} />
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                    <div style={{ backgroundColor: d.card, borderRadius: "12px", padding: "18px", border: `1px solid ${d.border}` }}>
                                        <h2 style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: "700", color: d.text }}>Broadcast</h2>
                                        <p style={{ margin: "0 0 12px", fontSize: "11px", color: d.muted }}>Send to all {insights.totalCustomers} customers</p>
                                        <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)}
                                            placeholder="e.g. Special offer today! 20% off all orders."
                                            style={{ width: "100%", padding: "10px 12px", backgroundColor: d.input, border: `1px solid ${d.inputBorder}`, borderRadius: "8px", fontSize: "12px", color: d.text, outline: "none", height: "80px", resize: "none", boxSizing: "border-box", marginBottom: "9px" }} />
                                        <button onClick={sendBroadcast} disabled={broadcastSending || !broadcastMsg.trim()}
                                            style={{ width: "100%", padding: "10px", backgroundColor: broadcastSending ? d.muted : "#2563eb", color: "white", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "12px", cursor: broadcastSending ? "not-allowed" : "pointer" }}>
                                            {broadcastSending ? "Sending..." : "Send to All Customers"}
                                        </button>
                                        {broadcastResult && (
                                            <div style={{ marginTop: "8px", padding: "9px 12px", backgroundColor: broadcastResult.success ? (dm ? "rgba(22,163,74,0.08)" : "#f0fdf4") : (dm ? "rgba(220,38,38,0.08)" : "#fef2f2"), borderRadius: "7px" }}>
                                                <p style={{ margin: 0, fontSize: "11px", fontWeight: "600", color: broadcastResult.success ? "#16a34a" : "#dc2626" }}>
                                                    {broadcastResult.success ? "Sent to " + broadcastResult.sent + "/" + broadcastResult.total + " customers" : "Error: " + broadcastResult.error}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── SETTINGS ── */}
                        {activePage === "settings" && (
                            <div style={{ maxWidth: "520px", display: "flex", flexDirection: "column", gap: "14px" }}>
                                <div style={{ backgroundColor: d.card, borderRadius: "12px", padding: "20px", border: `1px solid ${d.border}` }}>
                                    <h2 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: "700", color: d.text }}>Business Hours</h2>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: "600", fontSize: "13px", color: d.text }}>Shop Status</p>
                                            <p style={{ margin: "2px 0 0", fontSize: "11px", color: d.muted }}>Customers can't order when closed</p>
                                        </div>
                                        <div onClick={() => setSettings(s => ({ ...s, is_open: !s.is_open }))}
                                            style={{ width: "44px", height: "22px", backgroundColor: settings.is_open ? "#22c55e" : d.border, borderRadius: "11px", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                                            <div style={{ position: "absolute", width: "16px", height: "16px", backgroundColor: "white", borderRadius: "50%", top: "3px", left: settings.is_open ? "25px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                                        </div>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                        {[{ label: "Opening Time", key: "open_time" }, { label: "Closing Time", key: "close_time" }].map(f => (
                                            <div key={f.key}>
                                                <label style={{ display: "block", fontSize: "10px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>{f.label}</label>
                                                <input type="time" value={settings[f.key]} onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))}
                                                    style={{ width: "100%", padding: "9px 11px", backgroundColor: d.input, border: `1px solid ${d.inputBorder}`, borderRadius: "8px", fontSize: "13px", fontWeight: "600", color: d.text, outline: "none", boxSizing: "border-box" }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ backgroundColor: d.card, borderRadius: "12px", padding: "20px", border: `1px solid ${d.border}` }}>
                                    <h2 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: "700", color: d.text }}>Auto-Accept Orders</h2>
                                    <p style={{ margin: "0 0 14px", fontSize: "11px", color: d.muted }}>Orders confirmed & payment link sent automatically</p>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: "600", fontSize: "13px", color: d.text }}>Auto-Accept</p>
                                            <p style={{ margin: "2px 0 0", fontSize: "11px", color: settings.auto_accept ? "#16a34a" : d.muted }}>{settings.auto_accept ? "Enabled" : "Disabled — manual review required"}</p>
                                        </div>
                                        <div onClick={() => setSettings(s => ({ ...s, auto_accept: !s.auto_accept }))}
                                            style={{ width: "44px", height: "22px", backgroundColor: settings.auto_accept ? "#2563eb" : d.border, borderRadius: "11px", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                                            <div style={{ position: "absolute", width: "16px", height: "16px", backgroundColor: "white", borderRadius: "50%", top: "3px", left: settings.auto_accept ? "25px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                                        </div>
                                    </div>
                                </div>
                                <button onClick={saveSettings}
                                    style={{ padding: "12px", backgroundColor: settingsSaved ? "#16a34a" : "#2563eb", color: "white", border: "none", borderRadius: "10px", fontWeight: "700", fontSize: "13px", cursor: "pointer", transition: "background 0.3s" }}>
                                    {settingsSaved ? "Saved!" : "Save Settings"}
                                </button>
                            </div>
                        )}

                    </div>
                </main>
            </div>
        </>
    );
}