import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import Login from "./Login";
import Signup from "./Signup";
import Onboarding from "./Onboarding";

const API = "https://web-production-a3a4.up.railway.app";

function waDigitsFromOrder(order) {
    return (order.customer_phone || "").replace("whatsapp:", "").replace(/\D/g, "");
}

/** Number the vendor should call (customer may use a different line than WhatsApp). */
function callDigitsForOrder(order) {
    const c = (order.contact_phone || "").replace(/\D/g, "");
    return c || waDigitsFromOrder(order);
}

function formatCallDisplay(order) {
    const d = callDigitsForOrder(order);
    return d || "—";
}

export default function App() {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [page, setPage] = useState("login");
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, delivered: 0, revenue: 0, unpaidRevenue: 0 });
    const [activePage, setActivePage] = useState("overview");
    const [activeTab, setActiveTab] = useState("all");
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [businessName, setBusinessName] = useState("");
    const [menuItems, setMenuItems] = useState([]);
    const [newItem, setNewItem] = useState({ item_name: "", item_price: "", item_description: "", category: "Main" });
    const [editItem, setEditItem] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [newOrderAlert, setNewOrderAlert] = useState(false);
    const [menuFilter, setMenuFilter] = useState("All");
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [settings, setSettings] = useState({ auto_accept: false, is_open: true, open_time: "08:00", close_time: "22:00" });
    const [broadcastMsg, setBroadcastMsg] = useState("");
    const [broadcastSending, setBroadcastSending] = useState(false);
    const [broadcastResult, setBroadcastResult] = useState(null);
    const [insights, setInsights] = useState({ topItems: [], totalCustomers: 0, avgOrderValue: 0, avgRating: 0, ratingsCount: 0 });
    const [darkMode, setDarkMode] = useState(() => {
        const stored = localStorage.getItem("delivagh_dark");
        if (stored === null) return true;
        return stored === "true";
    });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [buttonLoading, setButtonLoading] = useState({});
    const [settingsSaved, setSettingsSaved] = useState(false);
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [authNotice, setAuthNotice] = useState("");
    const [accountStatus, setAccountStatus] = useState(null); // { type, message }
    // ── ONBOARDING ──
    const [onboardingDone, setOnboardingDone] = useState(false);
    const [onboardingChecked, setOnboardingChecked] = useState(false);

    const ordersRef = useRef([]);
    const audioCtxRef = useRef(null);
    const businessNameRef = useRef("");
    const notifIdRef = useRef(0);

    const dm = darkMode;
    const d = dm ? {
        bg: "#080f0a", bg2: "#0d1610", bg3: "#122019", card: "#101b14",
        border: "rgba(255,255,255,0.10)", text: "#ecfdf3", muted: "rgba(236,253,243,0.62)",
        hover: "rgba(255,255,255,0.06)", input: "rgba(255,255,255,0.06)", inputBorder: "rgba(255,255,255,0.12)",
    } : {
        bg: "#f0fdf4", bg2: "#ffffff", bg3: "#f7fff9", card: "#ffffff",
        border: "#d1fae5", text: "#052e16", muted: "#166534",
        hover: "#ecfdf5", input: "#ffffff", inputBorder: "#a7f3d0",
    };

    function toggleDark() {
        const next = !darkMode;
        setDarkMode(next);
        localStorage.setItem("delivagh_dark", String(next));
    }

    function addNotif(message, type = "success") {
        const id = ++notifIdRef.current;
        setNotifications(prev => [{ id, message, type, time: new Date() }, ...prev.slice(0, 19)]);
    }

    // ── LOUD SOUND ──
    function playNotification() {
        try {
            if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            if (ctx.state === "suspended") ctx.resume();
            [[523, 0], [659, 0.18], [784, 0.36], [1047, 0.54]].forEach(([freq, start]) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.type = "square"; osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, ctx.currentTime + start);
                gain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + start + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.18);
                osc.start(ctx.currentTime + start);
                osc.stop(ctx.currentTime + start + 0.2);
            });
        } catch (e) { console.log("Sound error:", e); }
    }

    useEffect(() => {
        const unlock = () => {
            if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
        };
        document.addEventListener("click", unlock, { once: true });
        return () => document.removeEventListener("click", unlock);
    }, []);

    useEffect(() => {
        if (!supabase) {
            setAuthLoading(false);
            return;
        }
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setAuthLoading(false);
        });
        supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    }, []);

    useEffect(() => {
        if (!supabase) return;
        // If vendor intentionally goes to signup while already logged in, switch account cleanly.
        if (page === "signup" && user) {
            supabase.auth.signOut().finally(() => setUser(null));
        }
    }, [page, user]);

    useEffect(() => {
        if (!supabase || !user) return;
        let cancelled = false;
        (async () => {
            const { data } = await supabase.from("businesses").select("status").eq("user_id", user.id).limit(1);
            if (cancelled) return;
            const status = data?.[0]?.status;
            if (status === "pending" || status === "rejected" || status === "suspended") {
                const msg =
                    status === "pending"
                        ? "Your account is pending admin approval. You will be notified once approved."
                        : status === "rejected"
                            ? "Your account application was not approved. Please contact support."
                            : "Your account has been suspended. Please contact support.";
                setAuthNotice(msg);
                setAccountStatus({ type: status, message: msg });
                await supabase.auth.signOut();
                if (!cancelled) {
                    setUser(null);
                    setBusinessName("");
                    setOnboardingChecked(false);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [user]);

    // ── REAL-TIME — filtered by business ──
    useEffect(() => {
        if (!user) return;
        fetchBusinessName();

        const poll = setInterval(() => {
            if (businessNameRef.current) fetchOrders();
        }, 30000);

        return () => clearInterval(poll);
    }, [user]);

    // Subscribe after businessName is known
    useEffect(() => {
        if (!user || !businessName) return;

        fetchOrders();

        const channel = supabase.channel("orders-rt-" + user.id)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
                // FIX: Only process orders belonging to this business
                if (payload.new.business_name !== businessNameRef.current) return;
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
                    addNotif("New order from " + (payload.new.customer_phone?.replace("whatsapp:", "") || "customer"), "new");
                }
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
                if (payload.new.business_name !== businessNameRef.current) return;
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

        return () => supabase.removeChannel(channel);
    }, [user, businessName]);

    function updateStats(data) {
        const paid = data.filter(o => o.payment_status === "paid");
        const revenue = paid.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
        const unpaidRevenue = data.filter(o => o.payment_status !== "paid" && o.status !== "pending" && o.status !== "rejected")
            .reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
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
            (order.items || '').match(/\d+x\s+([^,\n]+)/g)?.forEach(m => {
                const p = m.match(/(\d+)x\s+(.+)/);
                if (p) itemCounts[p[2].trim().replace(/\s*-\s*GHS.*/, '')] = (itemCounts[p[2].trim().replace(/\s*-\s*GHS.*/, '')] || 0) + parseInt(p[1]);
            });
        });
        const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
        const uniqueCustomers = new Set(data.map(o => o.customer_phone)).size;
        const completed = data.filter(o => o.total_amount > 0);
        const avg = completed.length > 0 ? completed.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0) / completed.length : 0;
        const rated = data.filter(o => o.status === "delivered" && o.rating >= 1 && o.rating <= 5);
        const avgRating = rated.length > 0 ? rated.reduce((s, o) => s + Number(o.rating), 0) / rated.length : 0;
        setInsights({ topItems, totalCustomers: uniqueCustomers, avgOrderValue: avg, avgRating, ratingsCount: rated.length });
    }

    async function fetchBusinessName() {
        setOnboardingChecked(false);
        const { data } = await supabase.from("businesses").select("*").eq("user_id", user.id).limit(1);
        if (data && data.length > 0) {
            const biz = data[0];
            const name = biz.name;
            setBusinessName(name);
            businessNameRef.current = name;

            const { data: menuData } = await supabase.from("menus").select("*").eq("business_name", name).order("created_at", { ascending: false });
            if (menuData) setMenuItems(menuData);

            const { data: sd } = await supabase.from("business_settings").select("*").eq("business_name", name).single();
            if (sd) setSettings(sd);

            // ── ONBOARDING CHECK ──
            const done = localStorage.getItem("onboarding_done_" + user.id) === "true";
            if (done) {
                setOnboardingDone(true);
            } else {
                // Existing vendors should not get forced back into onboarding.
                const hasMenu = !!(menuData && menuData.length > 0);
                const { data: existingOrders } = await supabase
                    .from("orders")
                    .select("id")
                    .eq("business_name", name)
                    .limit(1);
                const hasOrders = !!(existingOrders && existingOrders.length > 0);
                if (hasMenu || hasOrders) {
                    localStorage.setItem("onboarding_done_" + user.id, "true");
                    setOnboardingDone(true);
                } else {
                    setOnboardingDone(false);
                }
            }
            setOnboardingChecked(true);
        } else {
            // If no business profile yet, don't block on onboarding.
            setOnboardingDone(true);
            setOnboardingChecked(true);
        }
    }

    // ── FIX: fetchOrders filtered by business ──
    async function fetchOrders() {
        const name = businessNameRef.current;
        if (!name) return;
        setLoading(true);
        const { data, error } = await supabase
            .from("orders")
            .select("*")
            .eq("business_name", name)  // ← THE FIX
            .order("created_at", { ascending: false })
            .limit(100);
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
        const name = businessNameRef.current || businessName;
        const { data, error } = await supabase.from("menus").insert([{
            business_name: name, item_name: newItem.item_name.trim(),
            item_price: parseFloat(newItem.item_price), item_description: newItem.item_description.trim(),
            category: newItem.category, available: true
        }]).select();
        if (error) { alert("Error: " + error.message); return; }
        setNewItem({ item_name: "", item_price: "", item_description: "", category: "Main" });
        setShowAddModal(false);
        if (data && data.length > 0) setMenuItems(prev => [data[0], ...prev]);
        await fetchMenuItems();
    }

    async function saveEditItem() {
        if (!editItem?.item_name || !editItem?.item_price) return;
        await supabase.from("menus").update({
            item_name: editItem.item_name, item_price: parseFloat(editItem.item_price),
            item_description: editItem.item_description, category: editItem.category
        }).eq("id", editItem.id);
        setShowEditModal(false); setEditItem(null);
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

    async function updateStatus(id, status, customerPhone, deliveryType) {
        setButtonLoading(prev => ({ ...prev, [id]: true }));
        setOrders(prev => {
            const updated = prev.map(o => o.id === id ? { ...o, status } : o);
            ordersRef.current = updated; updateStats(updated); return updated;
        });
        setSelectedOrder(sel => sel?.id === id ? { ...sel, status } : sel);
        const msgs = {
            confirmed: "Order confirmed — customer notified",
            preparing: "Preparing order — customer notified",
            ready: deliveryType === "delivery" ? "Order on the way — customer notified" : "Order ready for pickup — customer notified",
            delivered: "Order delivered — customer notified",
            rejected: "Order rejected — customer notified",
        };
        try {
            const { error } = await supabase.from("orders").update({ status }).eq("id", id);
            if (error) { fetchOrders(); return; }
            fetch(API + "/whatsapp/notify", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerPhone, orderId: id, status, deliveryType })
            }).catch(e => console.log("Notify error:", e));
            addNotif(msgs[status] || "Order updated", "success");
        } catch (e) { fetchOrders(); }
        finally { setButtonLoading(prev => ({ ...prev, [id]: false })); }
    }

    async function markAsPaid(id) {
        setButtonLoading(prev => ({ ...prev, [id + "_pay"]: true }));
        setOrders(prev => { const u = prev.map(o => o.id === id ? { ...o, payment_status: "paid" } : o); ordersRef.current = u; updateStats(u); return u; });
        setSelectedOrder(sel => sel?.id === id ? { ...sel, payment_status: "paid" } : sel);
        try { await supabase.from("orders").update({ payment_status: "paid" }).eq("id", id); addNotif("Payment marked as received", "success"); }
        catch (e) { fetchOrders(); }
        finally { setButtonLoading(prev => ({ ...prev, [id + "_pay"]: false })); }
    }

    async function saveSettings() {
        try {
            const name = businessNameRef.current || businessName;
            const { error } = await supabase.from("business_settings").upsert({ business_name: name, ...settings }, { onConflict: "business_name" });
            if (error) throw error;
            setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 3000);
            addNotif("Settings saved", "success");
        } catch (e) { alert("Failed to save settings."); }
    }

    async function sendBroadcast() {
        if (!broadcastMsg.trim()) return;
        setBroadcastSending(true); setBroadcastResult(null);
        try {
            const res = await fetch(API + "/whatsapp/broadcast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName, message: broadcastMsg }) });
            const data = await res.json(); setBroadcastResult(data);
            if (data.success) setBroadcastMsg("");
        } catch (e) { setBroadcastResult({ success: false, error: e.message }); }
        setBroadcastSending(false);
    }

    async function handleLogout() { await supabase.auth.signOut(); setUser(null); }

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
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: s.dot, flexShrink: 0 }} />{s.label}
            </span>
        );
    }

    function PaymentBadge({ status, paymentMethod, orderId, showMarkPaid }) {
        const isPaid = status === "paid";
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", backgroundColor: isPaid ? "#dcfce7" : "#fef3c7", color: isPaid ? "#14532d" : "#92400e", padding: "3px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: isPaid ? "#22c55e" : "#f59e0b", flexShrink: 0 }} />{isPaid ? "Paid" : "Unpaid"}
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
            <button disabled={isLoading} style={{ backgroundColor: isLoading ? "#94a3b8" : bg, color: "white", border: "none", padding: "6px 12px", borderRadius: "7px", fontSize: "11px", fontWeight: "600", cursor: isLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: isLoading ? 0.7 : 1 }}
                onClick={async e => { e.stopPropagation(); if (!isLoading) await cb(); }}>
                {isLoading ? "..." : label}
            </button>
        );
        switch (order.status) {
            case "pending": return (<div style={{ display: "flex", gap: "5px" }}>{btn("#2563eb", "Accept", () => updateStatus(order.id, "confirmed", order.customer_phone, order.delivery_type))}{btn("#dc2626", "Reject", () => updateStatus(order.id, "rejected", order.customer_phone, order.delivery_type))}</div>);
            case "confirmed": return btn("#db2777", "Preparing", () => updateStatus(order.id, "preparing", order.customer_phone, order.delivery_type));
            case "preparing": return btn("#7c3aed", order.delivery_type === "delivery" ? "On the Way" : "Ready", () => updateStatus(order.id, "ready", order.customer_phone, order.delivery_type));
            case "ready": return btn("#16a34a", "Delivered", () => updateStatus(order.id, "delivered", order.customer_phone, order.delivery_type));
            case "delivered": return <span style={{ color: "#16a34a", fontSize: "11px", fontWeight: "700" }}>Done</span>;
            case "rejected": return <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: "700" }}>Rejected</span>;
            default: return null;
        }
    }

    const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
    const todayRevenue = todayOrders.filter(o => o.payment_status === "paid").reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
    const filteredOrders = activeTab === "all" ? orders : orders.filter(o => o.status === activeTab);
    const filteredMenu = menuFilter === "All" ? menuItems : menuItems.filter(i => i.category === menuFilter);
    const customers = Object.values(
        orders.reduce((acc, order) => {
            const phone = (order.customer_phone || "").replace("whatsapp:", "") || "Unknown";
            if (!acc[phone]) {
                acc[phone] = {
                    phone,
                    orders: 0,
                    delivered: 0,
                    pending: 0,
                    revenue: 0,
                    lastOrderAt: order.created_at,
                };
            }
            acc[phone].orders += 1;
            if (order.status === "delivered") acc[phone].delivered += 1;
            if (order.status === "pending") acc[phone].pending += 1;
            if (order.payment_status === "paid") acc[phone].revenue += parseFloat(order.total_amount) || 0;
            if (new Date(order.created_at) > new Date(acc[phone].lastOrderAt)) acc[phone].lastOrderAt = order.created_at;
            return acc;
        }, {})
    ).sort((a, b) => new Date(b.lastOrderAt) - new Date(a.lastOrderAt));
    const sidebarW = sidebarCollapsed ? "60px" : "240px";
    const unreadNotifs = notifications.length;
    const accent = "#22c55e";
    const accentSoft = dm ? "rgba(34,197,94,0.12)" : "#ecfdf5";
    const accentBorder = dm ? "rgba(34,197,94,0.3)" : "#86efac";
    const inp = (extra = {}) => ({ padding: "10px 12px", backgroundColor: d.input, border: `1px solid ${d.inputBorder}`, borderRadius: "8px", fontSize: "13px", color: d.text, outline: "none", width: "100%", boxSizing: "border-box", ...extra });

    const navItems = [
        { id: "overview", label: "Overview", icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> },
        { id: "pending", label: "Orders", badge: stats.pending, icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></svg> },
        { id: "customers", label: "Customers", icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg> },
        { id: "menu", label: "Menu", icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg> },
        { id: "insights", label: "Insights", icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg> },
        { id: "settings", label: "Settings", icon: <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg> },
    ];

    if (!supabase) return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1117", color: "#e6edf3", padding: "24px", fontFamily: "Inter, sans-serif" }}>
            <div style={{ maxWidth: "640px", background: "#161b22", border: "1px solid #30363d", borderRadius: "12px", padding: "20px" }}>
                <h2 style={{ margin: "0 0 10px", fontSize: "18px" }}>Missing Supabase Configuration</h2>
                <p style={{ margin: "0 0 8px", color: "#9fb0c3", fontSize: "14px" }}>Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` in your Vercel environment variables, then redeploy.</p>
                <p style={{ margin: 0, color: "#7d8590", fontSize: "12px" }}>Until that is configured, the dashboard cannot load.</p>
            </div>
        </div>
    );

    if (authLoading) return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1117" }}>
            <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "white" }}>Delivagh<span style={{ color: "#2563eb" }}>.</span></div>
                <p style={{ color: "#7d8590", marginTop: "8px", fontSize: "13px" }}>Loading...</p>
            </div>
        </div>
    );

    if (!user && page === "signup") return <Signup onSignup={() => {
        const msg = "Account created. Wait for admin approval before first login.";
        setAuthNotice(msg);
        setAccountStatus({ type: "pending", message: msg });
        setPage("login");
        if (supabase) supabase.auth.signOut().finally(() => setUser(null));
    }} onLogin={() => setPage("login")} />;
    if (!user && page !== "signup" && accountStatus) return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080f0a", padding: "24px", fontFamily: "'DM Sans', sans-serif" }}>
            <div style={{ width: "100%", maxWidth: "520px", backgroundColor: "#101b14", border: "1px solid rgba(255,255,255,0.10)", borderRadius: "16px", padding: "26px" }}>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "white", marginBottom: "6px", fontFamily: "'Playfair Display', serif" }}>
                    Delivagh<span style={{ color: accent }}>.</span>
                </div>
                <p style={{ margin: "0 0 16px", fontSize: "12px", color: "rgba(236,253,243,0.55)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Account Status</p>
                <h2 style={{ margin: "0 0 10px", fontSize: "24px", color: "#ecfdf3", fontFamily: "'Playfair Display', serif" }}>
                    {accountStatus.type === "pending" ? "Approval Pending" : accountStatus.type === "rejected" ? "Application Rejected" : "Account Suspended"}
                </h2>
                <p style={{ margin: "0 0 18px", color: "rgba(236,253,243,0.75)", fontSize: "14px", lineHeight: 1.6 }}>{accountStatus.message}</p>
                <div style={{ display: "flex", gap: "10px" }}>
                    <button
                        onClick={() => { setAccountStatus(null); setAuthNotice(""); }}
                        style={{ flex: 1, padding: "12px", backgroundColor: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", color: "rgba(236,253,243,0.75)", fontWeight: "700", cursor: "pointer" }}
                    >
                        Back to Login
                    </button>
                    <button
                        onClick={() => { setAccountStatus(null); setAuthNotice(""); setPage("signup"); }}
                        style={{ flex: 1, padding: "12px", backgroundColor: accent, border: "none", borderRadius: "10px", color: "white", fontWeight: "700", cursor: "pointer" }}
                    >
                        Use Different Account
                    </button>
                </div>
            </div>
        </div>
    );
    if (!user) return <Login notice={authNotice} onLogin={u => { setAuthNotice(""); setUser(u); }} onSignup={() => { setAuthNotice(""); setPage("signup"); }} />;

    // Avoid flashing dashboard before onboarding decision finishes.
    if (user && !onboardingChecked) return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: d.bg }}>
            <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: "800", color: d.text, fontFamily: "'Playfair Display', serif" }}>Delivagh<span style={{ color: accent }}>.</span></div>
                <p style={{ color: d.muted, marginTop: "8px", fontSize: "13px" }}>Preparing your workspace...</p>
            </div>
        </div>
    );

    // ── ONBOARDING SCREEN ──
    if (user && businessName && onboardingChecked && !onboardingDone) {
        return <Onboarding
            user={user}
            businessName={businessName}
            menuItems={menuItems}
            onComplete={() => {
                localStorage.setItem("onboarding_done_" + user.id, "true");
                setOnboardingDone(true);
            }}
        />;
    }

    // DEAD CODE BELOW — kept for reference, never reached
    if (false) {
        return (
            <>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
                <div style={{ minHeight: "100vh", backgroundColor: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "Inter, sans-serif" }}>
                    <div style={{ width: "100%", maxWidth: "560px" }}>

                        {/* Logo */}
                        <div style={{ textAlign: "center", marginBottom: "40px" }}>
                            <div style={{ fontSize: "24px", fontWeight: "800", color: "white" }}>Delivagh<span style={{ color: "#2563eb" }}>.</span></div>
                            <p style={{ color: "#7d8590", fontSize: "13px", marginTop: "6px" }}>Let's get {businessName} set up 🚀</p>
                        </div>

                        {/* Progress Steps */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0", marginBottom: "40px" }}>
                            {[1, 2, 3].map((n, i) => (
                                <>
                                    <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: onboardingStep > n ? "#2563eb" : onboardingStep === n ? "#2563eb" : "#1c2128", border: `2px solid ${onboardingStep >= n ? "#2563eb" : "#30363d"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", color: onboardingStep >= n ? "white" : "#7d8590", transition: "all 0.3s" }}>
                                            {onboardingStep > n ? "✓" : n}
                                        </div>
                                        <span style={{ fontSize: "10px", color: onboardingStep >= n ? "#2563eb" : "#7d8590", fontWeight: "600", whiteSpace: "nowrap" }}>
                                            {n === 1 ? "Menu" : n === 2 ? "Share" : "Go Live"}
                                        </span>
                                    </div>
                                    {i < 2 && <div style={{ width: "80px", height: "2px", backgroundColor: onboardingStep > n ? "#2563eb" : "#30363d", marginBottom: "22px", transition: "background 0.3s" }} />}
                                </>
                            ))}
                        </div>

                        {/* Step Card */}
                        <div style={{ backgroundColor: "#161b22", borderRadius: "16px", border: "1px solid #30363d", padding: "32px", marginBottom: "24px" }}>

                            {/* Step 1 — Add Menu Item */}
                            {onboardingStep === 1 && (
                                <div>
                                    <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "16px" }}>🍽️</div>
                                    <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "800", color: "white" }}>Add your first menu item</h2>
                                    <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#7d8590", lineHeight: "1.6" }}>Add at least one item so your customers can start placing orders through WhatsApp.</p>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                        <input value={newItem.item_name} onChange={e => setNewItem({ ...newItem, item_name: e.target.value })} placeholder="Item name (e.g. Jollof Rice)" style={{ ...inp(), backgroundColor: "#1c2128", borderColor: "#30363d" }} />
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                            <input value={newItem.item_price} onChange={e => setNewItem({ ...newItem, item_price: e.target.value })} placeholder="Price (GHS)" type="number" style={{ ...inp(), backgroundColor: "#1c2128", borderColor: "#30363d" }} />
                                            <select value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} style={{ ...inp(), backgroundColor: "#1c2128", borderColor: "#30363d" }}>
                                                <option value="Main">Main</option>
                                                <option value="Sides">Sides</option>
                                                <option value="Extras">Extras</option>
                                            </select>
                                        </div>
                                        <textarea value={newItem.item_description} onChange={e => setNewItem({ ...newItem, item_description: e.target.value })} placeholder="Brief description (optional)" style={{ ...inp({ height: "80px", resize: "none", backgroundColor: "#1c2128", borderColor: "#30363d" }) }} />
                                        <button onClick={addMenuItem} disabled={!newItem.item_name || !newItem.item_price}
                                            style={{ padding: "13px", backgroundColor: !newItem.item_name || !newItem.item_price ? "#1c2128" : "#2563eb", color: !newItem.item_name || !newItem.item_price ? "#7d8590" : "white", border: "none", borderRadius: "10px", fontWeight: "700", fontSize: "14px", cursor: !newItem.item_name || !newItem.item_price ? "not-allowed" : "pointer" }}>
                                            Add Item & Continue →
                                        </button>
                                    </div>

                                    {menuItems.length > 0 && (
                                        <button onClick={() => setOnboardingStep(2)} style={{ width: "100%", marginTop: "12px", padding: "10px", backgroundColor: "transparent", border: "1px solid #30363d", borderRadius: "10px", color: "#7d8590", fontSize: "13px", cursor: "pointer", fontWeight: "600" }}>
                                            Skip — I already have {menuItems.length} item{menuItems.length > 1 ? "s" : ""}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Step 2 — Share Number */}
                            {onboardingStep === 2 && (
                                <div>
                                    <div style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: "rgba(37,99,235,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", marginBottom: "16px" }}>📱</div>
                                    <h2 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "800", color: "white" }}>Share your WhatsApp number</h2>
                                    <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#7d8590", lineHeight: "1.6" }}>Customers message this number to order from <strong style={{ color: "white" }}>{businessName}</strong>. Share it on social media, your menu boards, and receipts.</p>

                                    <div style={{ backgroundColor: "#1c2128", borderRadius: "12px", padding: "20px", border: "1px solid #30363d", marginBottom: "20px" }}>
                                        <p style={{ margin: "0 0 6px", fontSize: "10px", fontWeight: "700", color: "#7d8590", textTransform: "uppercase", letterSpacing: "0.08em" }}>Your DelivaGH WhatsApp Number</p>
                                        <p style={{ margin: "0 0 12px", fontSize: "22px", fontWeight: "800", color: "#2563eb", fontFamily: "monospace" }}>+1 415 523 8886</p>
                                        <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#7d8590" }}>Customers send <strong style={{ color: "white" }}>"Hi"</strong> to start ordering from your menu</p>
                                        <button onClick={() => { navigator.clipboard.writeText("+14155238886"); addNotif("Number copied!", "success"); }}
                                            style={{ padding: "8px 16px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                                            Copy Number
                                        </button>
                                    </div>

                                    <div style={{ backgroundColor: "#0d2137", borderRadius: "10px", padding: "14px 16px", border: "1px solid #1e4a72", marginBottom: "20px" }}>
                                        <p style={{ margin: 0, fontSize: "12px", color: "#60a5fa", lineHeight: "1.6" }}>
                                            <strong>Note:</strong> This is the Twilio sandbox number. You'll get your own dedicated WhatsApp number once you upgrade to Meta WhatsApp Cloud API. We'll guide you through that setup.
                                        </p>
                                    </div>

                                    <button onClick={() => setOnboardingStep(3)} style={{ width: "100%", padding: "13px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "10px", fontWeight: "700", fontSize: "14px", cursor: "pointer" }}>
                                        I've shared it → Continue
                                    </button>
                                </div>
                            )}

                            {/* Step 3 — Done */}
                            {onboardingStep === 3 && (
                                <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: "56px", marginBottom: "20px" }}>🎉</div>
                                    <h2 style={{ margin: "0 0 12px", fontSize: "22px", fontWeight: "800", color: "white" }}>You're live!</h2>
                                    <p style={{ margin: "0 0 28px", fontSize: "14px", color: "#7d8590", lineHeight: "1.7" }}>
                                        <strong style={{ color: "white" }}>{businessName}</strong> is now on DelivaGH. Your AI bot is active and ready to take orders 24/7.
                                    </p>

                                    <div style={{ backgroundColor: "#1c2128", borderRadius: "12px", padding: "16px", border: "1px solid #30363d", marginBottom: "24px", textAlign: "left" }}>
                                        <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "700", color: "#7d8590", textTransform: "uppercase" }}>What happens next</p>
                                        {[
                                            "Customer messages +1 415 523 8886",
                                            "Bot shows your menu & takes order",
                                            "You get a notification on this dashboard",
                                            "Accept order → customer gets payment link",
                                            "Customer pays → order confirmed"
                                        ].map((s, i) => (
                                            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                                                <span style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#2563eb", color: "white", fontSize: "10px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                                                <span style={{ fontSize: "13px", color: "#e6edf3" }}>{s}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <button onClick={completeOnboarding} style={{ width: "100%", padding: "14px", backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "10px", fontWeight: "700", fontSize: "15px", cursor: "pointer" }}>
                                        Go to Dashboard →
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Skip entirely for existing businesses */}
                        {onboardingStep < 3 && (
                            <p style={{ textAlign: "center", fontSize: "12px", color: "#7d8590" }}>
                                <span onClick={completeOnboarding} style={{ cursor: "pointer", textDecoration: "underline" }}>Skip setup, go to dashboard</span>
                            </p>
                        )}
                    </div>
                </div>
            </>
        );
    } // end dead code

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
            <style>{`
                * { font-family: 'DM Sans', -apple-system, sans-serif; box-sizing: border-box; }
                body { margin: 0; background: ${d.bg}; }
                ::-webkit-scrollbar { width: 4px; height: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: ${d.border}; border-radius: 2px; }
                @keyframes slideIn { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
                @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
                .row-hover:hover td { background: ${d.hover} !important; cursor: pointer; }
            `}</style>

            <div style={{ display: "flex", minHeight: "100vh", backgroundColor: d.bg, color: d.text }}>

                {/* NEW ORDER TOAST */}
                {newOrderAlert && (
                    <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, animation: "slideIn 0.3s ease" }}>
                        <div style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)", color: "white", padding: "16px 20px", borderRadius: "14px", boxShadow: "0 16px 48px rgba(220,38,38,0.45)", display: "flex", alignItems: "center", gap: "12px", minWidth: "290px", animation: "pulse 1.5s infinite" }}>
                            <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>🔔</div>
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontWeight: "800", fontSize: "14px" }}>New Order!</p>
                                <p style={{ margin: "2px 0 0", fontSize: "12px", opacity: 0.9 }}>A customer placed an order</p>
                            </div>
                            <button onClick={() => { setNewOrderAlert(false); setActivePage("pending"); setActiveTab("pending"); }}
                                style={{ background: "rgba(255,255,255,0.25)", border: "none", color: "white", padding: "6px 12px", borderRadius: "7px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>View</button>
                        </div>
                    </div>
                )}

                {/* ORDER DETAIL MODAL */}
                {selectedOrder && (() => {
                    const liveOrder = orders.find(o => o.id === selectedOrder.id) || selectedOrder;
                    const paymentOptions = liveOrder.delivery_type === "pickup" ? ["MoMo", "Pay on Pickup"] : ["MoMo", "Pay on Delivery"];
                    return (
                        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }} onClick={() => setSelectedOrder(null)}>
                            <div style={{ backgroundColor: d.card, borderRadius: "18px", padding: "26px", width: "100%", maxWidth: "480px", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", maxHeight: "90vh", overflowY: "auto", border: `1px solid ${d.border}` }} onClick={e => e.stopPropagation()}>
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
                                        { label: "Customer", value: (liveOrder.customer_name || liveOrder.customer_phone?.replace("whatsapp:", "") || "Customer") },
                                        { label: "Phone (for calls)", value: formatCallDisplay(liveOrder) },
                                        ...(waDigitsFromOrder(liveOrder) && callDigitsForOrder(liveOrder) !== waDigitsFromOrder(liveOrder)
                                            ? [{ label: "WhatsApp (chat)", value: waDigitsFromOrder(liveOrder) }]
                                            : []),
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
                                            <p style={{ margin: "0 0 3px", fontSize: "10px", fontWeight: "700", color: "#92400e", textTransform: "uppercase" }}>Kitchen / special requests</p>
                                            <p style={{ margin: 0, fontSize: "13px", color: "#78350f" }}>{liveOrder.notes}</p>
                                        </div>
                                    )}
                                    {(liveOrder.rating >= 1 && liveOrder.rating <= 5) && (
                                        <div style={{ padding: "11px 13px", backgroundColor: dm ? "rgba(34,197,94,0.1)" : "#ecfdf5", borderRadius: "8px", border: `1px solid ${accentBorder}` }}>
                                            <p style={{ margin: "0 0 3px", fontSize: "10px", fontWeight: "700", color: accent, textTransform: "uppercase" }}>Customer rating</p>
                                            <p style={{ margin: 0, fontSize: "15px", color: d.text }}>{"★".repeat(liveOrder.rating)}{"☆".repeat(5 - liveOrder.rating)} <span style={{ fontSize: "12px", color: d.muted }}>({liveOrder.rating}/5)</span></p>
                                        </div>
                                    )}
                                    {liveOrder.feedback_comment && (
                                        <div style={{ padding: "11px 13px", backgroundColor: dm ? "rgba(37,99,235,0.1)" : "#eff6ff", borderRadius: "8px", border: "1px solid rgba(37,99,235,0.25)" }}>
                                            <p style={{ margin: "0 0 3px", fontSize: "10px", fontWeight: "700", color: "#2563eb", textTransform: "uppercase" }}>Post-delivery feedback</p>
                                            <p style={{ margin: 0, fontSize: "13px", color: d.text }}>{liveOrder.feedback_comment}</p>
                                        </div>
                                    )}
                                    <div style={{ padding: "11px 13px", backgroundColor: d.hover, borderRadius: "8px" }}>
                                        <p style={{ margin: "0 0 6px", fontSize: "10px", fontWeight: "700", color: d.muted, textTransform: "uppercase" }}>Payment Options</p>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            {paymentOptions.map(opt => <span key={opt} style={{ backgroundColor: d.bg3, border: `1px solid ${d.border}`, color: d.text, padding: "4px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}>{opt}</span>)}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: "9px" }}>
                                    <div style={{ flex: 1 }}>{getNextAction(liveOrder.id)}</div>
                                    <button onClick={() => setSelectedOrder(null)} style={{ flex: 1, backgroundColor: d.hover, color: d.muted, border: `1px solid ${d.border}`, padding: "8px 16px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>Close</button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* CUSTOMER DETAIL MODAL */}
                {selectedCustomer && (() => {
                    const customerOrders = orders
                        .filter(o => (o.customer_phone || "").replace("whatsapp:", "") === selectedCustomer.phone)
                        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    const latest = customerOrders[0];
                    return (
                        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }} onClick={() => setSelectedCustomer(null)}>
                            <div style={{ backgroundColor: d.card, borderRadius: "18px", padding: "24px", width: "100%", maxWidth: "820px", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", maxHeight: "90vh", overflowY: "auto", border: `1px solid ${d.border}` }} onClick={e => e.stopPropagation()}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: d.text }}>Customer Details</h2>
                                        <p style={{ margin: "4px 0 0", fontSize: "12px", color: d.muted }}>{selectedCustomer.phone}</p>
                                    </div>
                                    <button onClick={() => setSelectedCustomer(null)} style={{ background: d.hover, border: `1px solid ${d.border}`, borderRadius: "7px", padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontWeight: "600", color: d.muted }}>Close</button>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px", marginBottom: "14px" }}>
                                    <div style={{ backgroundColor: d.bg3, border: `1px solid ${d.border}`, borderRadius: "10px", padding: "14px" }}>
                                        <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "700", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Customer Information</p>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                            {[
                                                { label: "Phone", value: selectedCustomer.phone },
                                                { label: "First Seen", value: customerOrders.length ? new Date(customerOrders[customerOrders.length - 1].created_at).toLocaleDateString("en-GH") : "—" },
                                                { label: "Total Orders", value: selectedCustomer.orders },
                                                { label: "Revenue", value: "GHS " + selectedCustomer.revenue.toFixed(2) },
                                            ].map(row => (
                                                <div key={row.label} style={{ backgroundColor: d.card, borderRadius: "8px", padding: "10px 11px", border: `1px solid ${d.border}` }}>
                                                    <p style={{ margin: "0 0 2px", fontSize: "10px", color: d.muted }}>{row.label}</p>
                                                    <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: d.text }}>{row.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ backgroundColor: d.bg3, border: `1px solid ${d.border}`, borderRadius: "10px", padding: "14px" }}>
                                        <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: "700", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Order Statistics</p>
                                        <p style={{ margin: "0 0 6px", fontSize: "12px", color: d.text }}>Delivered: <strong style={{ color: "#16a34a" }}>{selectedCustomer.delivered}</strong></p>
                                        <p style={{ margin: "0 0 6px", fontSize: "12px", color: d.text }}>Pending: <strong style={{ color: "#d97706" }}>{selectedCustomer.pending}</strong></p>
                                        <p style={{ margin: 0, fontSize: "12px", color: d.text }}>Last Order: <strong>{latest ? new Date(latest.created_at).toLocaleDateString("en-GH") : "—"}</strong></p>
                                    </div>
                                </div>
                                <div style={{ backgroundColor: d.bg3, border: `1px solid ${d.border}`, borderRadius: "10px", padding: "12px" }}>
                                    <p style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: "700", color: d.text }}>Recent Orders</p>
                                    {customerOrders.length === 0 ? (
                                        <p style={{ margin: 0, color: d.muted, fontSize: "12px" }}>No orders found for this customer.</p>
                                    ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                            {customerOrders.slice(0, 6).map(order => (
                                                <div key={order.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr auto auto auto", alignItems: "center", gap: "8px", backgroundColor: d.card, border: `1px solid ${d.border}`, borderRadius: "8px", padding: "9px 10px" }}>
                                                    <span style={{ fontFamily: "monospace", fontSize: "11px", color: d.muted }}>#{order.id.substring(0, 8).toUpperCase()}</span>
                                                    <span style={{ fontSize: "11px", color: d.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{order.items}</span>
                                                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#2563eb" }}>{order.total_amount ? "GHS " + parseFloat(order.total_amount).toFixed(2) : "—"}</span>
                                                    <StatusBadge status={order.status} />
                                                    <button onClick={() => { setSelectedCustomer(null); setSelectedOrder(order); }} style={{ padding: "4px 8px", backgroundColor: "rgba(37,99,235,0.12)", color: "#2563eb", border: "1px solid rgba(37,99,235,0.22)", borderRadius: "6px", fontSize: "10px", fontWeight: "700", cursor: "pointer" }}>Open</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* ADD MENU MODAL */}
                {showAddModal && (
                    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }} onClick={() => setShowAddModal(false)}>
                        <div style={{ backgroundColor: d.card, borderRadius: "18px", padding: "26px", width: "100%", maxWidth: "420px", boxShadow: "0 24px 64px rgba(0,0,0,0.3)", border: `1px solid ${d.border}` }} onClick={e => e.stopPropagation()}>
                            <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: "700", color: d.text }}>Add Menu Item</h2>
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <input value={newItem.item_name} onChange={e => setNewItem({ ...newItem, item_name: e.target.value })} placeholder="Item name (e.g. Jollof Rice)" style={inp()} />
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                    <input value={newItem.item_price} onChange={e => setNewItem({ ...newItem, item_price: e.target.value })} placeholder="Price (GHS)" type="number" style={inp()} />
                                    <select value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} style={inp()}>
                                        <option value="Main">Main</option><option value="Sides">Sides</option><option value="Extras">Extras</option>
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

                {/* EDIT MENU MODAL */}
                {showEditModal && editItem && (
                    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(4px)" }} onClick={() => setShowEditModal(false)}>
                        <div style={{ backgroundColor: d.card, borderRadius: "18px", padding: "26px", width: "100%", maxWidth: "420px", boxShadow: "0 24px 64px rgba(0,0,0,0.3)", border: `1px solid ${d.border}` }} onClick={e => e.stopPropagation()}>
                            <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: "700", color: d.text }}>Edit Item</h2>
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <input value={editItem.item_name} onChange={e => setEditItem({ ...editItem, item_name: e.target.value })} placeholder="Item name" style={inp()} />
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                    <input value={editItem.item_price} onChange={e => setEditItem({ ...editItem, item_price: e.target.value })} placeholder="Price (GHS)" type="number" style={inp()} />
                                    <select value={editItem.category} onChange={e => setEditItem({ ...editItem, category: e.target.value })} style={inp()}>
                                        <option value="Main">Main</option><option value="Sides">Sides</option><option value="Extras">Extras</option>
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

                {/* SIDEBAR */}
                <aside style={{ width: sidebarW, backgroundColor: d.bg2, borderRight: `1px solid ${d.border}`, display: "flex", flexDirection: "column", flexShrink: 0, position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100, transition: "width 0.2s ease", overflow: "hidden" }}>
                    <div style={{ padding: sidebarCollapsed ? "18px 0" : "18px 14px", display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "space-between", borderBottom: `1px solid ${d.border}`, flexShrink: 0 }}>
                        {!sidebarCollapsed && <div style={{ fontSize: "15px", fontWeight: "800", color: d.text, fontFamily: "'Playfair Display',serif" }}>Delivagh<span style={{ color: accent }}>.</span></div>}
                        <button onClick={() => setSidebarCollapsed(c => !c)} style={{ width: "26px", height: "26px", borderRadius: "6px", border: `1px solid ${d.border}`, backgroundColor: d.hover, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: d.muted, fontSize: "11px", flexShrink: 0 }}>
                            {sidebarCollapsed ? "»" : "«"}
                        </button>
                    </div>
                    <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" }}>
                        {navItems.map(item => {
                            const isActive = activePage === item.id;
                            return (
                                <button key={item.id} onClick={() => { setActivePage(item.id); if (item.id === "pending") setActiveTab("all"); }}
                                    title={sidebarCollapsed ? item.label : ""}
                                    style={{ display: "flex", alignItems: "center", gap: "9px", padding: sidebarCollapsed ? "10px" : "10px 11px", borderRadius: "8px", border: "none", cursor: "pointer", textAlign: "left", fontWeight: "600", fontSize: "12px", transition: "all 0.12s", backgroundColor: isActive ? accentSoft : "transparent", color: isActive ? accent : d.muted, justifyContent: sidebarCollapsed ? "center" : "flex-start", position: "relative" }}>
                                    <span style={{ flexShrink: 0, color: isActive ? accent : d.muted }}>{item.icon}</span>
                                    {!sidebarCollapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                                    {item.badge > 0 && !sidebarCollapsed && <span style={{ backgroundColor: "#dc2626", color: "white", fontSize: "10px", padding: "1px 6px", borderRadius: "999px", fontWeight: "800", animation: "pulse 2s infinite" }}>{item.badge}</span>}
                                    {item.badge > 0 && sidebarCollapsed && <span style={{ position: "absolute", top: "5px", right: "5px", backgroundColor: "#dc2626", color: "white", fontSize: "8px", width: "14px", height: "14px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800" }}>{item.badge}</span>}
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
                                <div style={{ width: "30px", height: "30px", borderRadius: "7px", backgroundColor: accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "13px", color: "white", flexShrink: 0 }}>
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

                {/* MAIN */}
                <main style={{ marginLeft: sidebarW, flex: 1, display: "flex", flexDirection: "column", minWidth: 0, transition: "margin-left 0.2s ease" }}>
                    <header style={{ height: "58px", backgroundColor: d.bg2, borderBottom: `1px solid ${d.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", position: "sticky", top: 0, zIndex: 50, flexShrink: 0 }}>
                        <div>
                            <h1 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: d.text }}>{{ overview: "Overview", pending: "Orders", customers: "Customers", menu: "Menu Manager", insights: "Insights", settings: "Settings" }[activePage]}</h1>
                            <p style={{ margin: 0, fontSize: "10px", color: d.muted }}>{new Date().toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {activePage === "menu" && <button onClick={() => setShowAddModal(true)} style={{ display: "flex", alignItems: "center", gap: "5px", backgroundColor: accent, color: "white", padding: "7px 14px", borderRadius: "8px", fontWeight: "600", fontSize: "12px", border: "none", cursor: "pointer" }}>+ Add Item</button>}
                            {stats.pending > 0 && (
                                <button onClick={() => { setActivePage("pending"); setActiveTab("pending"); }} style={{ display: "flex", alignItems: "center", gap: "5px", backgroundColor: "#fef3c7", color: "#92400e", padding: "6px 12px", borderRadius: "8px", fontWeight: "700", fontSize: "11px", border: "1px solid #fde68a", cursor: "pointer" }}>
                                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#f59e0b", animation: "blink 1.2s infinite" }} />{stats.pending} pending
                                </button>
                            )}
                            {/* NOTIFICATION BELL */}
                            <div style={{ position: "relative" }}>
                                <button onClick={() => setShowNotifPanel(p => !p)} style={{ width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${d.border}`, backgroundColor: d.hover, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", position: "relative" }}>
                                    🔔
                                    {unreadNotifs > 0 && <span style={{ position: "absolute", top: "4px", right: "4px", backgroundColor: "#dc2626", color: "white", fontSize: "8px", width: "14px", height: "14px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800" }}>{unreadNotifs > 9 ? "9+" : unreadNotifs}</span>}
                                </button>
                                {showNotifPanel && (
                                    <div style={{ position: "absolute", top: "42px", right: 0, width: "320px", backgroundColor: d.card, borderRadius: "12px", border: `1px solid ${d.border}`, boxShadow: "0 16px 48px rgba(0,0,0,0.2)", zIndex: 200, animation: "slideDown 0.2s ease", overflow: "hidden" }}>
                                        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${d.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: d.text }}>Notifications</p>
                                            <button onClick={() => { setNotifications([]); setShowNotifPanel(false); }} style={{ background: "none", border: "none", fontSize: "11px", color: d.muted, cursor: "pointer", fontWeight: "600" }}>Clear all</button>
                                        </div>
                                        <div style={{ maxHeight: "320px", overflowY: "auto" }}>
                                            {notifications.length === 0
                                                ? <p style={{ padding: "24px", textAlign: "center", color: d.muted, fontSize: "13px", margin: 0 }}>No notifications yet</p>
                                                : notifications.map(n => (
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

                        {/* OVERVIEW */}
                        {activePage === "overview" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
                                    {[
                                        { label: "Total Orders", value: stats.total, sub: "All time" },
                                        { label: "Pending", value: stats.pending, sub: "Need action", accent: stats.pending > 0 },
                                        { label: "Delivered Today", value: todayOrders.filter(o => o.status === "delivered").length, sub: "Completed" },
                                        { label: "Today's Orders", value: todayOrders.length, sub: "Since midnight" },
                                    ].map((s, i) => (
                                        <div key={i} style={{ backgroundColor: d.card, border: `1px solid ${s.accent ? "#fde68a" : d.border}`, borderRadius: "12px", padding: "16px", transition: "transform 0.15s" }}
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
                                        { label: "Today's Revenue", value: "GHS " + todayRevenue.toFixed(2), c: accent, bg: dm ? "rgba(34,197,94,0.08)" : "#ecfdf5", br: accentBorder },
                                        { label: "Pending Payment", value: "GHS " + stats.unpaidRevenue.toFixed(2), c: "#d97706", bg: dm ? "rgba(217,119,6,0.07)" : "#fffbeb", br: dm ? "rgba(217,119,6,0.18)" : "#fde68a" },
                                    ].map((s, i) => (
                                        <div key={i} style={{ backgroundColor: s.bg, border: `1px solid ${s.br}`, borderRadius: "12px", padding: "16px" }}>
                                            <p style={{ margin: "0 0 5px", fontSize: "10px", fontWeight: "600", color: s.c, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.8 }}>{s.label}</p>
                                            <p style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: s.c, lineHeight: 1 }}>{s.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "14px" }}>
                                    <div style={{ backgroundColor: d.card, borderRadius: "12px", border: `1px solid ${d.border}`, overflow: "hidden" }}>
                                        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${d.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: d.text }}>Recent Orders</p>
                                            <button onClick={() => setActivePage("pending")} style={{ fontSize: "11px", fontWeight: "600", color: accent, background: "none", border: "none", cursor: "pointer" }}>View all</button>
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
                                                        <tr key={order.id} className="row-hover" onClick={() => setSelectedOrder(order)} style={{ borderTop: `1px solid ${d.border}` }}>
                                                            <td style={{ padding: "10px 14px" }}>
                                                                <div style={{ fontFamily: "monospace", fontSize: "11px", fontWeight: "700", color: d.muted }}>#{order.id.substring(0, 8).toUpperCase()}</div>
                                                                <div style={{ fontSize: "11px", fontWeight: "700", color: d.text, marginTop: "2px", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                    {order.customer_name || order.customer_phone?.replace("whatsapp:", "") || "Customer"}
                                                                </div>
                                                                <div style={{ fontSize: "10px", color: d.muted, marginTop: "2px", fontFamily: "monospace" }}>{formatCallDisplay(order)}</div>
                                                            </td>
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
                                                {[{ label: "Pickup", value: todayOrders.filter(o => o.delivery_type === "pickup").length }, { label: "Delivery", value: todayOrders.filter(o => o.delivery_type === "delivery").length }].map((s, i) => (
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
                                                    { label: "Customers", action: () => setActivePage("customers") },
                                                    { label: "Insights", action: () => setActivePage("insights") },
                                                    { label: "Orders", action: () => setActivePage("pending") },
                                                ].map(btn => (
                                                    <button key={btn.label} onClick={btn.action} style={{ padding: "10px 6px", backgroundColor: d.bg3, border: `1px solid ${d.border}`, borderRadius: "8px", cursor: "pointer", fontSize: "11px", fontWeight: "600", color: d.muted }}
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

                        {/* ORDERS */}
                        {activePage === "pending" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
                                    {[{ id: "all", label: "All", count: orders.length }, { id: "pending", label: "Pending", count: stats.pending }, { id: "confirmed", label: "Confirmed", count: stats.confirmed }, { id: "delivered", label: "Delivered", count: stats.delivered }].map(tab => (
                                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                            style={{ padding: "7px 14px", borderRadius: "8px", border: `1px solid ${activeTab === tab.id ? accent : d.border}`, cursor: "pointer", fontSize: "12px", fontWeight: "600", backgroundColor: activeTab === tab.id ? accentSoft : "transparent", color: activeTab === tab.id ? accent : d.muted, display: "flex", alignItems: "center", gap: "6px" }}>
                                            {tab.label}
                                            <span style={{ backgroundColor: activeTab === tab.id ? accent : d.border, color: activeTab === tab.id ? "white" : d.muted, borderRadius: "999px", padding: "1px 6px", fontSize: "10px", fontWeight: "700" }}>{tab.count}</span>
                                        </button>
                                    ))}
                                </div>
                                <div style={{ backgroundColor: d.card, borderRadius: "12px", border: `1px solid ${d.border}`, overflow: "hidden" }}>
                                    {loading ? <div style={{ padding: "48px", textAlign: "center", color: d.muted, fontSize: "13px" }}>Loading orders...</div>
                                        : filteredOrders.length === 0 ? (
                                            <div style={{ padding: "64px", textAlign: "center" }}>
                                                <p style={{ fontSize: "32px", margin: "0 0 10px" }}>📭</p>
                                                <p style={{ color: d.muted, fontSize: "14px", fontWeight: "600", margin: 0 }}>No orders here</p>
                                            </div>
                                        ) : (
                                            <div style={{ overflowX: "auto" }}>
                                                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                                                    <thead><tr style={{ backgroundColor: d.bg3 }}>
                                                        {["Order", "Customer", "Items", "Total", "Kitchen notes", "Rating", "Type", "Payment", "Status", "Time", "Action"].map(h => (
                                                            <th key={h} style={{ padding: "10px 13px", textAlign: "left", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: d.muted, whiteSpace: "nowrap" }}>{h}</th>
                                                        ))}
                                                    </tr></thead>
                                                    <tbody>
                                                        {(() => {
                                                            let lastDate = null;
                                                            return filteredOrders.map(order => {
                                                                const od = new Date(order.created_at).toDateString();
                                                                const isNew = od !== lastDate; lastDate = od;
                                                                const isToday = od === new Date().toDateString();
                                                                const isYest = od === new Date(Date.now() - 86400000).toDateString();
                                                                const dl = isToday ? "Today" : isYest ? "Yesterday" : new Date(order.created_at).toLocaleDateString("en-GH", { weekday: "short", month: "short", day: "numeric" });
                                                                return (
                                                                    <>
                                                                        {isNew && <tr key={"d-" + od}><td colSpan="11" style={{ padding: "10px 13px 5px" }}><span style={{ fontSize: "10px", fontWeight: "700", backgroundColor: isToday ? (dm ? "rgba(37,99,235,0.12)" : "#eff6ff") : d.bg3, color: isToday ? "#2563eb" : d.muted, padding: "3px 10px", borderRadius: "5px" }}>{dl}</span></td></tr>}
                                                                        <tr key={order.id} className="row-hover" onClick={() => setSelectedOrder(order)} style={{ borderTop: `1px solid ${d.border}` }}>
                                                                            <td style={{ padding: "11px 13px", fontFamily: "monospace", fontSize: "11px", fontWeight: "700", color: d.muted }}>#{order.id.substring(0, 8).toUpperCase()}</td>
                                                                            <td style={{ padding: "11px 13px", fontSize: "12px", color: d.muted }}>
                                                                                <div style={{ fontWeight: "700", color: d.text }}>{order.customer_name || order.customer_phone?.replace("whatsapp:", "") || "Customer"}</div>
                                                                                <div style={{ fontSize: "10px", fontFamily: "monospace", marginTop: "2px" }}>{formatCallDisplay(order)}</div>
                                                                            </td>
                                                                            <td style={{ padding: "11px 13px", fontSize: "12px", color: d.text, maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.items}</td>
                                                                            <td style={{ padding: "11px 13px", fontSize: "12px", fontWeight: "700", color: d.text, whiteSpace: "nowrap" }}>{order.total_amount ? "GHS " + parseFloat(order.total_amount).toFixed(2) : "—"}</td>
                                                                            <td style={{ padding: "11px 13px", maxWidth: "110px" }}>
                                                                                {order.notes ? <span title={order.notes} style={{ backgroundColor: dm ? "#2a1f0a" : "#fffbeb", color: "#d97706", padding: "3px 8px", borderRadius: "5px", fontSize: "10px", fontWeight: "700", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.notes}</span>
                                                                                    : <span style={{ color: d.muted, fontSize: "12px" }}>—</span>}
                                                                            </td>
                                                                            <td style={{ padding: "11px 13px", fontSize: "11px", color: d.text, whiteSpace: "nowrap", maxWidth: "100px" }}>
                                                                                {order.rating >= 1 && order.rating <= 5 ? <span title={order.feedback_comment || ""} style={{ fontWeight: "700", color: "#f59e0b" }}>{"★".repeat(order.rating)}</span> : <span style={{ color: d.muted }}>—</span>}
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

                        {/* CUSTOMERS */}
                        {activePage === "customers" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
                                    {[
                                        { label: "Total Customers", value: customers.length, sub: "Unique WhatsApp numbers" },
                                        { label: "Active Today", value: customers.filter(c => new Date(c.lastOrderAt).toDateString() === new Date().toDateString()).length, sub: "Ordered today" },
                                        { label: "Pending Attention", value: customers.filter(c => c.pending > 0).length, sub: "With pending orders" },
                                        { label: "Customer Revenue", value: "GHS " + customers.reduce((s, c) => s + c.revenue, 0).toFixed(2), sub: "Paid order value" },
                                    ].map((s, i) => (
                                        <div key={i} style={{ backgroundColor: d.card, border: `1px solid ${d.border}`, borderRadius: "12px", padding: "16px" }}>
                                            <p style={{ margin: "0 0 6px", fontSize: "10px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</p>
                                            <p style={{ margin: "0 0 3px", fontSize: "24px", fontWeight: "800", color: d.text, lineHeight: 1 }}>{s.value}</p>
                                            <p style={{ margin: 0, fontSize: "11px", color: d.muted }}>{s.sub}</p>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ backgroundColor: d.card, borderRadius: "12px", border: `1px solid ${d.border}`, overflow: "hidden" }}>
                                    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${d.border}` }}>
                                        <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: d.text }}>Customer Directory</p>
                                    </div>
                                    {customers.length === 0 ? (
                                        <div style={{ padding: "64px", textAlign: "center" }}>
                                            <p style={{ fontSize: "32px", margin: "0 0 10px" }}>👥</p>
                                            <p style={{ color: d.muted, fontSize: "14px", fontWeight: "600", margin: 0 }}>No customers yet</p>
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: "auto" }}>
                                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "840px" }}>
                                                <thead><tr style={{ backgroundColor: d.bg3 }}>
                                                    {["Customer", "Orders", "Delivered", "Pending", "Paid Revenue", "Last Order", "Actions"].map(h => (
                                                        <th key={h} style={{ padding: "10px 13px", textAlign: "left", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: d.muted, whiteSpace: "nowrap" }}>{h}</th>
                                                    ))}
                                                </tr></thead>
                                                <tbody>
                                                    {customers.map(c => (
                                                        <tr key={c.phone} className="row-hover" style={{ borderTop: `1px solid ${d.border}` }}>
                                                            <td style={{ padding: "11px 13px", fontSize: "12px", fontWeight: "700", color: d.text }}>{c.phone}</td>
                                                            <td style={{ padding: "11px 13px", fontSize: "12px", color: d.text }}>{c.orders}</td>
                                                            <td style={{ padding: "11px 13px", fontSize: "12px", color: "#16a34a", fontWeight: "700" }}>{c.delivered}</td>
                                                            <td style={{ padding: "11px 13px", fontSize: "12px", color: c.pending > 0 ? "#d97706" : d.muted, fontWeight: "700" }}>{c.pending}</td>
                                                            <td style={{ padding: "11px 13px", fontSize: "12px", color: "#2563eb", fontWeight: "700" }}>GHS {c.revenue.toFixed(2)}</td>
                                                            <td style={{ padding: "11px 13px", fontSize: "11px", color: d.muted }}>{new Date(c.lastOrderAt).toLocaleString("en-GH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                                                            <td style={{ padding: "11px 13px" }}>
                                                                <button onClick={() => setSelectedCustomer(c)} style={{ padding: "5px 10px", backgroundColor: "rgba(37,99,235,0.12)", color: "#2563eb", border: "1px solid rgba(37,99,235,0.22)", borderRadius: "6px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>View</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* MENU */}
                        {activePage === "menu" && (
                            <div>
                                <div style={{ display: "flex", gap: "7px", marginBottom: "16px" }}>
                                    {["All", "Main", "Sides", "Extras"].map(cat => (
                                        <button key={cat} onClick={() => setMenuFilter(cat)} style={{ padding: "6px 14px", borderRadius: "8px", border: `1px solid ${menuFilter === cat ? accent : d.border}`, cursor: "pointer", fontSize: "12px", fontWeight: "600", backgroundColor: menuFilter === cat ? accentSoft : d.card, color: menuFilter === cat ? accent : d.muted }}>
                                            {cat === "All" ? "All Items" : cat}
                                        </button>
                                    ))}
                                </div>
                                {filteredMenu.length === 0 ? (
                                    <div style={{ textAlign: "center", padding: "72px 20px", backgroundColor: d.card, borderRadius: "12px", border: `1px solid ${d.border}` }}>
                                        <p style={{ fontSize: "32px", margin: "0 0 10px" }}>🍽️</p>
                                        <p style={{ color: d.text, fontSize: "14px", fontWeight: "600", margin: "0 0 4px" }}>No items yet</p>
                                        <p style={{ color: d.muted, fontSize: "12px", margin: "0 0 20px" }}>Click "+ Add Item" to get started</p>
                                        <button onClick={() => setShowAddModal(true)} style={{ padding: "10px 24px", backgroundColor: accent, color: "white", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>+ Add First Item</button>
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
                                                    <div onClick={() => toggleAvailable(item.id, item.available)} style={{ width: "36px", height: "20px", backgroundColor: item.available ? "#2563eb" : d.border, borderRadius: "10px", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                                                        <div style={{ position: "absolute", width: "14px", height: "14px", backgroundColor: "white", borderRadius: "50%", top: "3px", left: item.available ? "19px" : "3px", transition: "left 0.2s" }} />
                                                    </div>
                                                </div>
                                                <p style={{ fontSize: "12px", color: d.muted, margin: "0 0 14px", lineHeight: "1.5" }}>{item.item_description || "No description"}</p>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${d.border}`, paddingTop: "12px" }}>
                                                    <span style={{ color: "#2563eb", fontWeight: "800", fontSize: "14px" }}>GHS {parseFloat(item.item_price).toFixed(2)}</span>
                                                    <div style={{ display: "flex", gap: "6px" }}>
                                                        <button onClick={() => { setEditItem({ ...item }); setShowEditModal(true); }} style={{ background: "none", border: `1px solid ${d.border}`, cursor: "pointer", color: d.muted, padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600" }}
                                                            onMouseEnter={e => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.color = "#2563eb"; }}
                                                            onMouseLeave={e => { e.currentTarget.style.borderColor = d.border; e.currentTarget.style.color = d.muted; }}>Edit</button>
                                                        <button onClick={() => deleteMenuItem(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: d.border, fontSize: "14px", padding: "4px 5px", borderRadius: "5px" }}
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

                        {/* INSIGHTS */}
                        {activePage === "insights" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
                                    {[
                                        { label: "Total Customers", value: insights.totalCustomers, sub: "Unique WhatsApp numbers" },
                                        { label: "Avg Order Value", value: "GHS " + insights.avgOrderValue.toFixed(2), sub: "Per completed order" },
                                        { label: "Completion Rate", value: Math.round((stats.delivered / (stats.total || 1)) * 100) + "%", sub: "Orders delivered" },
                                        { label: "Avg Rating", value: insights.ratingsCount > 0 ? insights.avgRating.toFixed(1) + " / 5" : "—", sub: insights.ratingsCount > 0 ? insights.ratingsCount + " ratings from delivered orders" : "No ratings yet" },
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
                                        <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="e.g. Special offer today! 20% off all orders." style={{ width: "100%", padding: "10px 12px", backgroundColor: d.input, border: `1px solid ${d.inputBorder}`, borderRadius: "8px", fontSize: "12px", color: d.text, outline: "none", height: "80px", resize: "none", boxSizing: "border-box", marginBottom: "9px" }} />
                                        <button onClick={sendBroadcast} disabled={broadcastSending || !broadcastMsg.trim()} style={{ width: "100%", padding: "10px", backgroundColor: broadcastSending ? d.muted : accent, color: "white", border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "12px", cursor: broadcastSending ? "not-allowed" : "pointer" }}>
                                            {broadcastSending ? "Sending..." : "Send to All Customers"}
                                        </button>
                                        {broadcastResult && (
                                            <div style={{ marginTop: "8px", padding: "9px 12px", backgroundColor: broadcastResult.success ? (dm ? "rgba(22,163,74,0.08)" : "#f0fdf4") : (dm ? "rgba(220,38,38,0.08)" : "#fef2f2"), borderRadius: "7px" }}>
                                                <p style={{ margin: 0, fontSize: "11px", fontWeight: "600", color: broadcastResult.success ? "#16a34a" : "#dc2626" }}>{broadcastResult.success ? "Sent to " + broadcastResult.sent + "/" + broadcastResult.total + " customers" : "Error: " + broadcastResult.error}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SETTINGS */}
                        {activePage === "settings" && (
                            <div style={{ maxWidth: "520px", display: "flex", flexDirection: "column", gap: "14px" }}>
                                <div style={{ backgroundColor: d.card, borderRadius: "12px", padding: "20px", border: `1px solid ${d.border}` }}>
                                    <h2 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: "700", color: d.text }}>Business Hours</h2>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: "600", fontSize: "13px", color: d.text }}>Shop Status</p>
                                            <p style={{ margin: "2px 0 0", fontSize: "11px", color: d.muted }}>Customers can't order when closed</p>
                                        </div>
                                        <div onClick={() => setSettings(s => ({ ...s, is_open: !s.is_open }))} style={{ width: "44px", height: "22px", backgroundColor: settings.is_open ? "#22c55e" : d.border, borderRadius: "11px", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                                            <div style={{ position: "absolute", width: "16px", height: "16px", backgroundColor: "white", borderRadius: "50%", top: "3px", left: settings.is_open ? "25px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                                        </div>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                                        {[{ label: "Opening Time", key: "open_time" }, { label: "Closing Time", key: "close_time" }].map(f => (
                                            <div key={f.key}>
                                                <label style={{ display: "block", fontSize: "10px", fontWeight: "600", color: d.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>{f.label}</label>
                                                <input type="time" value={settings[f.key]} onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))} style={{ width: "100%", padding: "9px 11px", backgroundColor: d.input, border: `1px solid ${d.inputBorder}`, borderRadius: "8px", fontSize: "13px", fontWeight: "600", color: d.text, outline: "none", boxSizing: "border-box" }} />
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
                                        <div onClick={() => setSettings(s => ({ ...s, auto_accept: !s.auto_accept }))} style={{ width: "44px", height: "22px", backgroundColor: settings.auto_accept ? accent : d.border, borderRadius: "11px", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                                            <div style={{ position: "absolute", width: "16px", height: "16px", backgroundColor: "white", borderRadius: "50%", top: "3px", left: settings.auto_accept ? "25px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                                        </div>
                                    </div>
                                </div>
                                <button onClick={saveSettings} style={{ padding: "12px", backgroundColor: settingsSaved ? "#16a34a" : accent, color: "white", border: "none", borderRadius: "10px", fontWeight: "700", fontSize: "13px", cursor: "pointer", transition: "background 0.3s" }}>
                                    {settingsSaved ? "✓ Saved!" : "Save Settings"}
                                </button>
                            </div>
                        )}

                    </div>
                </main>
            </div>
        </>
    );
}