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
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [newOrderAlert, setNewOrderAlert] = useState(false);
    const [menuFilter, setMenuFilter] = useState("All");
    const [showAddModal, setShowAddModal] = useState(false);
    const [settings, setSettings] = useState({ auto_accept: false, is_open: true, open_time: "08:00", close_time: "22:00" });
    const [broadcastMsg, setBroadcastMsg] = useState("");
    const [broadcastSending, setBroadcastSending] = useState(false);
    const [broadcastResult, setBroadcastResult] = useState(null);
    const [insights, setInsights] = useState({ topItems: [], totalCustomers: 0, avgOrderValue: 0 });
    const ordersRef = useRef([]);

    function playNotification() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(880, ctx.currentTime);
            oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.4);
        } catch (e) { console.log("Sound error:", e); }
    }

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setAuthLoading(false);
        });
        supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });
    }, []);

    useEffect(() => {
        if (user) {
            fetchOrders();
            fetchBusinessName();
            const subscription = supabase
                .channel("orders-realtime")
                .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
                    setOrders(prev => {
                        const updated = [payload.new, ...prev];
                        const prevPending = ordersRef.current.filter(o => o.status === "pending").length;
                        const newPending = updated.filter(o => o.status === "pending").length;
                        if (newPending > prevPending) {
                            playNotification();
                            setNewOrderAlert(true);
                            setTimeout(() => setNewOrderAlert(false), 5000);
                        }
                        ordersRef.current = updated;
                        updateStats(updated);
                        computeInsights(updated);
                        return updated;
                    });
                })
                .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
                    setOrders(prev => {
                        const updated = prev.map(o => o.id === payload.new.id ? payload.new : o);
                        ordersRef.current = updated;
                        updateStats(updated);
                        computeInsights(updated);
                        setSelectedOrder(sel => sel?.id === payload.new.id ? payload.new : sel);
                        return updated;
                    });
                })
                .subscribe();
            return () => supabase.removeChannel(subscription);
        }
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
        // Top items
        const itemCounts = {};
        data.forEach(order => {
            const itemStr = order.items || '';
            const matches = itemStr.match(/\d+x\s+([^,\n]+)/g) || [];
            matches.forEach(match => {
                const parts = match.match(/(\d+)x\s+(.+)/);
                if (parts) {
                    const qty = parseInt(parts[1]);
                    const name = parts[2].trim().replace(/\s*-\s*GHS.*/, '');
                    itemCounts[name] = (itemCounts[name] || 0) + qty;
                }
            });
        });
        const topItems = Object.entries(itemCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        const uniqueCustomers = new Set(data.map(o => o.customer_phone)).size;
        const completedOrders = data.filter(o => o.total_amount > 0);
        const avgOrderValue = completedOrders.length > 0
            ? completedOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0) / completedOrders.length
            : 0;

        setInsights({ topItems, totalCustomers: uniqueCustomers, avgOrderValue });
    }

    async function fetchBusinessName() {
        const { data } = await supabase.from("businesses").select("name").eq("user_id", user.id).limit(1);
        if (data && data.length > 0) {
            const name = data[0].name;
            setBusinessName(name);
            const { data: menuData } = await supabase.from("menus").select("*").eq("business_name", name).order("created_at", { ascending: false });
            if (menuData) setMenuItems(menuData);
            // Load settings
            const { data: settingsData } = await supabase.from("business_settings").select("*").eq("business_name", name).single();
            if (settingsData) setSettings(settingsData);
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
        const { data } = await supabase.from("menus").select("*").eq("business_name", businessName).order("created_at", { ascending: false });
        if (data) setMenuItems(data);
    }

    async function addMenuItem() {
        if (!newItem.item_name || !newItem.item_price) return;
        await supabase.from("menus").insert([{
            business_name: businessName,
            item_name: newItem.item_name,
            item_price: parseFloat(newItem.item_price),
            item_description: newItem.item_description,
            category: newItem.category,
            available: true
        }]);
        setNewItem({ item_name: "", item_price: "", item_description: "", category: "Main" });
        setShowAddModal(false);
        fetchMenuItems();
    }

    async function toggleAvailable(id, current) {
        await supabase.from("menus").update({ available: !current }).eq("id", id);
        fetchMenuItems();
    }

    async function deleteMenuItem(id) {
        if (window.confirm("Delete this item from your menu?")) {
            await supabase.from("menus").delete().eq("id", id);
            fetchMenuItems();
        }
    }

    async function updateStatus(id, status, customerPhone, deliveryType) {
        try {
            const { error } = await supabase.from("orders").update({ status }).eq("id", id);
            if (error) { console.log("Supabase update error:", error); return; }
            const response = await fetch(API + "/whatsapp/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerPhone, orderId: id, status, deliveryType })
            });
            if (!response.ok) console.log("Notification failed:", response.status);
        } catch (error) {
            console.log("UpdateStatus error:", error);
        }
    }

    async function saveSettings() {
        try {
            await fetch(API + "/whatsapp/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ businessName, ...settings })
            });
            alert("Settings saved!");
        } catch (e) {
            console.log("Settings save error:", e);
        }
    }

    async function sendBroadcast() {
        if (!broadcastMsg.trim()) return;
        setBroadcastSending(true);
        setBroadcastResult(null);
        try {
            const response = await fetch(API + "/whatsapp/broadcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ businessName, message: broadcastMsg })
            });
            const data = await response.json();
            setBroadcastResult(data);
            if (data.success) setBroadcastMsg("");
        } catch (e) {
            setBroadcastResult({ success: false, error: e.message });
        }
        setBroadcastSending(false);
    }

    async function handleLogout() {
        await supabase.auth.signOut();
        setUser(null);
    }

    function getStatusBadge(status) {
        const styles = {
            pending: { bg: "#fef3c7", color: "#d97706", label: "PENDING" },
            confirmed: { bg: "#dbeafe", color: "#1d4ed8", label: "CONFIRMED" },
            preparing: { bg: "#fce7f3", color: "#be185d", label: "PREPARING" },
            ready: { bg: "#ede9fe", color: "#6d28d9", label: "READY" },
            delivered: { bg: "#d1fae5", color: "#065f46", label: "DELIVERED" },
            rejected: { bg: "#fee2e2", color: "#dc2626", label: "REJECTED" },
        };
        const s = styles[status] || { bg: "#f3f4f6", color: "#6b7280", label: status?.toUpperCase() };
        return (
            <span style={{ backgroundColor: s.bg, color: s.color, padding: "3px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "800", letterSpacing: "0.05em" }}>
                {s.label}
            </span>
        );
    }

    function getPaymentBadge(status) {
        const isPaid = status === "paid";
        return (
            <span style={{ backgroundColor: isPaid ? "#d1fae5" : "#fef3c7", color: isPaid ? "#065f46" : "#d97706", padding: "3px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "800" }}>
                {isPaid ? "PAID" : "UNPAID"}
            </span>
        );
    }

    function getNextAction(order) {
        const btn = (bg, label, onClick) => (
            <button style={{ backgroundColor: bg, color: "white", border: "none", padding: "6px 12px", borderRadius: "8px", fontSize: "11px", cursor: "pointer", fontWeight: "700", whiteSpace: "nowrap" }}
                onClick={async (e) => { e.stopPropagation(); e.currentTarget.disabled = true; e.currentTarget.textContent = "..."; await onClick(); }}>
                {label}
            </button>
        );
        switch (order.status) {
            case "pending": return (
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {btn("#3b82f6", "✓ Accept", () => updateStatus(order.id, "confirmed", order.customer_phone, order.delivery_type))}
                    {btn("#ef4444", "✗ Reject", () => updateStatus(order.id, "rejected", order.customer_phone, order.delivery_type))}
                </div>
            );
            case "confirmed": return btn("#ec4899", "👨‍🍳 Preparing", () => updateStatus(order.id, "preparing", order.customer_phone, order.delivery_type));
            case "preparing": return btn("#8b5cf6", order.delivery_type === "delivery" ? "🛵 On the way" : "✅ Ready", () => updateStatus(order.id, "ready", order.customer_phone, order.delivery_type));
            case "ready": return btn("#10b981", "🎉 Delivered", () => updateStatus(order.id, "delivered", order.customer_phone, order.delivery_type));
            case "delivered": return <span style={{ color: "#10b981", fontSize: "11px", fontWeight: "700" }}>✓ Done</span>;
            case "rejected": return <span style={{ color: "#ef4444", fontSize: "11px", fontWeight: "700" }}>✗ Rejected</span>;
            default: return null;
        }
    }

    const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
    const todayRevenue = todayOrders.filter(o => o.payment_status === "paid").reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
    const filteredOrders = orders.filter(o => activeTab === "all" ? true : o.status === activeTab);
    const filteredMenu = menuFilter === "All" ? menuItems : menuItems.filter(i => i.category === menuFilter);

    if (authLoading) return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#111827" }}>
            <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "32px", fontWeight: "900", fontFamily: "Montserrat, sans-serif", color: "white", fontStyle: "italic" }}>
                    Delivagh<span style={{ color: "#FF4B4B" }}>.</span>
                </div>
                <p style={{ color: "#6b7280", marginTop: "8px", fontSize: "13px" }}>Loading your dashboard...</p>
            </div>
        </div>
    );

    if (!user && page === "signup") return <Signup onSignup={(u) => { setUser(u); setPage("login"); }} onLogin={() => setPage("login")} />;
    if (!user) return <Login onLogin={(u) => setUser(u)} onSignup={() => setPage("signup")} />;

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "Inter, sans-serif", color: "#1e293b" }}>

                {/* New Order Alert */}
                {newOrderAlert && (
                    <div style={{ position: "fixed", top: "20px", right: "20px", backgroundColor: "#FF4B4B", color: "white", padding: "16px 24px", borderRadius: "16px", boxShadow: "0 10px 30px rgba(255,75,75,0.4)", zIndex: 300, display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "20px" }}>🔔</span>
                        <div>
                            <p style={{ margin: 0, fontWeight: "700", fontSize: "14px" }}>New Order!</p>
                            <p style={{ margin: 0, fontSize: "12px", opacity: 0.9 }}>A new order just came in</p>
                        </div>
                    </div>
                )}

                {/* Order Detail Modal */}
                {selectedOrder && (
                    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
                        onClick={() => setSelectedOrder(null)}>
                        <div style={{ backgroundColor: "white", borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "500px", boxShadow: "0 25px 50px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" }}
                            onClick={e => e.stopPropagation()}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "900", fontFamily: "Montserrat, sans-serif" }}>Order Details</h2>
                                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#94a3b8", fontWeight: "700" }}>#{selectedOrder.id.substring(0, 8).toUpperCase()}</p>
                                </div>
                                <button onClick={() => setSelectedOrder(null)}
                                    style={{ backgroundColor: "#f1f5f9", border: "none", borderRadius: "10px", padding: "8px 14px", cursor: "pointer", fontSize: "13px", fontWeight: "700", color: "#64748b" }}>
                                    Close
                                </button>
                            </div>

                            <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
                                {getStatusBadge(selectedOrder.status)}
                                {getPaymentBadge(selectedOrder.payment_status)}
                                {selectedOrder.payment_method && (
                                    <span style={{ backgroundColor: "#f1f5f9", color: "#374151", padding: "3px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: "800" }}>
                                        {selectedOrder.payment_method === "momo" ? "📱 MoMo" : "💵 Cash"}
                                    </span>
                                )}
                            </div>

                            <div style={{ display: "grid", gap: "10px", marginBottom: "24px" }}>
                                {[
                                    { label: "Business", value: selectedOrder.business_name || "-" },
                                    { label: "Customer", value: selectedOrder.customer_phone?.replace("whatsapp:", "") },
                                    { label: "Items", value: selectedOrder.items },
                                    { label: "Total", value: selectedOrder.total_amount ? "GHS " + parseFloat(selectedOrder.total_amount).toFixed(2) : "-" },
                                    { label: "Payment", value: selectedOrder.payment_status === "paid" ? "✅ Paid" : "⏳ Unpaid" },
                                    ...(selectedOrder.momo_number ? [{ label: "MoMo #", value: selectedOrder.momo_number }] : []),
                                    { label: "Delivery", value: selectedOrder.delivery_type === "pickup" ? "Pickup" : "Delivery" },
                                    { label: "Address", value: selectedOrder.delivery_address || "-" },
                                    { label: "Time", value: new Date(selectedOrder.created_at).toLocaleString("en-GH", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) },
                                ].map(item => (
                                    <div key={item.label} style={{ backgroundColor: "#f8fafc", borderRadius: "12px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.label}</span>
                                        <span style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", textAlign: "right", maxWidth: "60%" }}>{item.value}</span>
                                    </div>
                                ))}
                                {selectedOrder.notes && (
                                    <div style={{ backgroundColor: "#fef3c7", borderRadius: "12px", padding: "12px 16px", border: "1px solid #fcd34d" }}>
                                        <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "#d97706", textTransform: "uppercase" }}>Special Instructions</p>
                                        <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#92400e" }}>{selectedOrder.notes}</p>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                <div style={{ flex: 1 }}>{getNextAction(selectedOrder)}</div>
                                <button onClick={() => setSelectedOrder(null)}
                                    style={{ flex: 1, backgroundColor: "#f1f5f9", color: "#374151", border: "none", padding: "12px", borderRadius: "10px", fontSize: "13px", cursor: "pointer", fontWeight: "700" }}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Menu Item Modal */}
                {showAddModal && (
                    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
                        onClick={() => setShowAddModal(false)}>
                        <div style={{ backgroundColor: "white", borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "440px", boxShadow: "0 25px 50px rgba(0,0,0,0.3)" }}
                            onClick={e => e.stopPropagation()}>
                            <h2 style={{ margin: "0 0 24px", fontSize: "22px", fontWeight: "900", fontFamily: "Montserrat, sans-serif" }}>Add New Item</h2>
                            <div style={{ display: "grid", gap: "12px" }}>
                                <input value={newItem.item_name} onChange={e => setNewItem({ ...newItem, item_name: e.target.value })}
                                    placeholder="Item Name (e.g. Jollof Rice)"
                                    style={{ padding: "14px 16px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "14px", outline: "none", width: "100%", boxSizing: "border-box" }} />
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                    <input value={newItem.item_price} onChange={e => setNewItem({ ...newItem, item_price: e.target.value })}
                                        placeholder="Price (GHS)" type="number"
                                        style={{ padding: "14px 16px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
                                    <select value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                        style={{ padding: "14px 16px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "13px", fontWeight: "700", outline: "none" }}>
                                        <option value="Main">Main Dish</option>
                                        <option value="Sides">Side</option>
                                        <option value="Extras">Extra</option>
                                    </select>
                                </div>
                                <textarea value={newItem.item_description} onChange={e => setNewItem({ ...newItem, item_description: e.target.value })}
                                    placeholder="Brief description..."
                                    style={{ padding: "14px 16px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "14px", outline: "none", height: "96px", resize: "none", width: "100%", boxSizing: "border-box" }} />
                                <div style={{ display: "flex", gap: "12px", paddingTop: "8px" }}>
                                    <button onClick={() => setShowAddModal(false)}
                                        style={{ flex: 1, padding: "14px", backgroundColor: "transparent", border: "none", cursor: "pointer", fontWeight: "700", color: "#94a3b8", fontSize: "14px" }}>Cancel</button>
                                    <button onClick={addMenuItem}
                                        style={{ flex: 2, padding: "14px", backgroundColor: "#111827", color: "white", border: "none", borderRadius: "14px", fontWeight: "800", fontSize: "14px", cursor: "pointer" }}>Save Item</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sidebar */}
                <aside style={{ width: "256px", backgroundColor: "#111827", color: "white", display: "flex", flexDirection: "column", flexShrink: 0, position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100 }}>
                    <div style={{ padding: "32px" }}>
                        <div style={{ fontSize: "24px", fontWeight: "900", fontFamily: "Montserrat, sans-serif", fontStyle: "italic", letterSpacing: "-1px" }}>
                            Delivagh<span style={{ color: "#FF4B4B" }}>.</span>
                        </div>
                        <p style={{ fontSize: "10px", color: "#6b7280", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.15em", marginTop: "4px" }}>Vendor Portal v2.0</p>
                    </div>

                    <nav style={{ flex: 1, padding: "0 16px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {[
                            { id: "overview", label: "Overview", icon: "▦" },
                            { id: "pending", label: "Pending Orders", icon: "◷", badge: stats.pending },
                            { id: "menu", label: "Menu Manager", icon: "☰" },
                            { id: "insights", label: "Insights", icon: "📊" },
                            { id: "settings", label: "Settings", icon: "⚙" },
                        ].map(item => (
                            <button key={item.id} onClick={() => { setActivePage(item.id); if (item.id === "pending") setActiveTab("all"); }}
                                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "12px", border: "none", cursor: "pointer", textAlign: "left", fontWeight: "600", fontSize: "13px", transition: "all 0.2s", backgroundColor: activePage === item.id ? "rgba(255,75,75,0.1)" : "transparent", color: activePage === item.id ? "#FF4B4B" : "#9ca3af", borderLeft: activePage === item.id ? "4px solid #FF4B4B" : "4px solid transparent" }}>
                                <span style={{ fontSize: "16px" }}>{item.icon}</span>
                                <span style={{ flex: 1 }}>{item.label}</span>
                                {item.badge > 0 && (
                                    <span style={{ backgroundColor: "#FF4B4B", color: "white", fontSize: "10px", padding: "2px 7px", borderRadius: "999px", fontWeight: "800" }}>{item.badge}</span>
                                )}
                            </button>
                        ))}
                    </nav>

                    {/* Revenue in sidebar */}
                    <div style={{ margin: "0 16px 16px", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "16px", padding: "16px" }}>
                        <p style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280" }}>Total Revenue</p>
                        <p style={{ margin: "0 0 2px", fontSize: "22px", fontWeight: "900", fontFamily: "Montserrat, sans-serif", color: "#10b981" }}>GHS {stats.revenue.toFixed(2)}</p>
                        <p style={{ margin: 0, fontSize: "10px", color: "#6b7280" }}>GHS {stats.unpaidRevenue.toFixed(2)} pending</p>
                        <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: settings.is_open ? "#10b981" : "#ef4444" }}></div>
                            <span style={{ fontSize: "10px", color: settings.is_open ? "#10b981" : "#ef4444", fontWeight: "700" }}>{settings.is_open ? "OPEN" : "CLOSED"}</span>
                        </div>
                    </div>

                    <div style={{ padding: "24px", borderTop: "1px solid #1f2937" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                            <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#FF4B4B", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "16px" }}>
                                {businessName?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ overflow: "hidden" }}>
                                <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{businessName || user.email?.split("@")[0]}</p>
                                <p style={{ margin: 0, fontSize: "10px", color: "#6b7280" }}>Vendor Account</p>
                            </div>
                        </div>
                        <button onClick={handleLogout}
                            style={{ width: "100%", backgroundColor: "#1f2937", color: "#9ca3af", border: "none", padding: "10px", borderRadius: "10px", fontSize: "12px", cursor: "pointer", fontWeight: "700" }}>
                            Sign Out
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main style={{ marginLeft: "256px", flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <header style={{ height: "80px", backgroundColor: "white", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", position: "sticky", top: 0, zIndex: 10 }}>
                        <div>
                            <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>
                                {activePage === "overview" ? "Business Overview" : activePage === "pending" ? "Orders" : activePage === "menu" ? "Menu Manager" : activePage === "insights" ? "Smart Insights" : "Settings"}
                            </h1>
                            <p style={{ margin: 0, fontSize: "10px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.15em" }}>Vendor Command Center</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            {activePage === "menu" && (
                                <button onClick={() => setShowAddModal(true)}
                                    style={{ backgroundColor: "#FF4B4B", color: "white", padding: "10px 20px", borderRadius: "12px", fontWeight: "700", fontSize: "13px", border: "none", cursor: "pointer" }}>
                                    + Add Item
                                </button>
                            )}
                            <span style={{ fontWeight: "600", fontSize: "13px", color: "#64748b" }}>
                                {new Date().toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                            </span>
                        </div>
                    </header>

                    <div style={{ padding: "32px", overflowY: "auto", flex: 1 }}>

                        {/* ── OVERVIEW ── */}
                        {activePage === "overview" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                                {/* Stats Row */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px" }}>
                                    {[
                                        { label: "Total Orders", value: stats.total, sub: "All time", bg: "white" },
                                        { label: "Active Orders", value: stats.pending + stats.confirmed, sub: stats.pending + " pending approval", bg: "white", subColor: "#FF4B4B" },
                                        { label: "Delivered Today", value: todayOrders.filter(o => o.status === "delivered").length, sub: "Completed today", bg: "white" },
                                        { label: "Bot Activity", value: orders.length, sub: "Total chats", bg: "#FF4B4B", white: true },
                                    ].map((stat, i) => (
                                        <div key={i} style={{ backgroundColor: stat.bg, padding: "24px", borderRadius: "20px", border: stat.white ? "none" : "1px solid #f1f5f9", boxShadow: stat.white ? "0 8px 24px rgba(255,75,75,0.2)" : "0 1px 3px rgba(0,0,0,0.05)", transition: "transform 0.2s", cursor: "pointer" }}
                                            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
                                            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                                            <p style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", color: stat.white ? "rgba(255,255,255,0.7)" : "#94a3b8" }}>{stat.label}</p>
                                            <h3 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: "900", fontFamily: "Montserrat, sans-serif", color: stat.white ? "white" : "#0f172a" }}>{stat.value}</h3>
                                            <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: stat.white ? "rgba(255,255,255,0.7)" : (stat.subColor || "#94a3b8") }}>{stat.sub}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Revenue Row */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
                                    {[
                                        { label: "Total Revenue", value: "GHS " + stats.revenue.toFixed(2), sub: "From paid orders", color: "#10b981", bg: "#f0fdf4", border: "#bbf7d0" },
                                        { label: "Today's Revenue", value: "GHS " + todayRevenue.toFixed(2), sub: "Paid today", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
                                        { label: "Pending Payment", value: "GHS " + stats.unpaidRevenue.toFixed(2), sub: "Awaiting payment", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
                                    ].map((stat, i) => (
                                        <div key={i} style={{ backgroundColor: stat.bg, padding: "24px", borderRadius: "20px", border: "1px solid " + stat.border, transition: "transform 0.2s" }}
                                            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
                                            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                                            <p style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", color: stat.color, opacity: 0.7 }}>{stat.label}</p>
                                            <h3 style={{ margin: "0 0 8px", fontSize: "26px", fontWeight: "900", fontFamily: "Montserrat, sans-serif", color: stat.color }}>{stat.value}</h3>
                                            <p style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: stat.color, opacity: 0.6 }}>{stat.sub}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Recent Orders + Side Panel */}
                                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
                                    <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #f1f5f9", overflow: "hidden" }}>
                                        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>Recent Orders</h2>
                                            <button onClick={() => setActivePage("pending")} style={{ fontSize: "10px", fontWeight: "800", color: "#FF4B4B", textTransform: "uppercase", letterSpacing: "0.1em", background: "none", border: "none", cursor: "pointer" }}>View All</button>
                                        </div>
                                        <div style={{ overflowX: "auto" }}>
                                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: "#f8fafc" }}>
                                                        {["Order", "Items", "Total", "Payment", "Status", "Action"].map(h => (
                                                            <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8" }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {orders.slice(0, 6).map(order => (
                                                        <tr key={order.id} onClick={() => setSelectedOrder(order)}
                                                            style={{ borderTop: "1px solid #f8fafc", cursor: "pointer", transition: "background 0.15s" }}
                                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = "#fafafa"}
                                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                                                            <td style={{ padding: "14px 16px", fontWeight: "700", fontSize: "12px" }}>#{order.id.substring(0, 8).toUpperCase()}</td>
                                                            <td style={{ padding: "14px 16px", fontSize: "12px", color: "#64748b", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.items}</td>
                                                            <td style={{ padding: "14px 16px", fontSize: "12px", fontWeight: "700" }}>{order.total_amount ? "GHS " + parseFloat(order.total_amount).toFixed(2) : "—"}</td>
                                                            <td style={{ padding: "14px 16px" }}>{getPaymentBadge(order.payment_status)}</td>
                                                            <td style={{ padding: "14px 16px" }}>{getStatusBadge(order.status)}</td>
                                                            <td style={{ padding: "14px 16px" }} onClick={e => e.stopPropagation()}>{getNextAction(order)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                                        <div style={{ backgroundColor: "#111827", borderRadius: "24px", padding: "24px", color: "white" }}>
                                            <p style={{ margin: "0 0 4px", fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280" }}>Today</p>
                                            <h3 style={{ margin: "0 0 16px", fontSize: "36px", fontWeight: "900", fontFamily: "Montserrat, sans-serif" }}>{todayOrders.length} <span style={{ fontSize: "14px", color: "#6b7280", fontWeight: "600" }}>orders</span></h3>
                                            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                                                <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "12px" }}>
                                                    <p style={{ margin: "0 0 4px", fontSize: "10px", color: "#6b7280", fontWeight: "700" }}>Pickup</p>
                                                    <p style={{ margin: 0, fontSize: "22px", fontWeight: "900" }}>{todayOrders.filter(o => o.delivery_type === "pickup").length}</p>
                                                </div>
                                                <div style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "12px" }}>
                                                    <p style={{ margin: "0 0 4px", fontSize: "10px", color: "#6b7280", fontWeight: "700" }}>Delivery</p>
                                                    <p style={{ margin: 0, fontSize: "22px", fontWeight: "900" }}>{todayOrders.filter(o => o.delivery_type === "delivery").length}</p>
                                                </div>
                                            </div>
                                            <div style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "12px" }}>
                                                <p style={{ margin: "0 0 8px", fontSize: "10px", color: "#6b7280", fontWeight: "700" }}>Payment Today</p>
                                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                                    <div><p style={{ margin: 0, fontSize: "10px", color: "#10b981", fontWeight: "700" }}>PAID</p><p style={{ margin: 0, fontSize: "18px", fontWeight: "900" }}>{todayOrders.filter(o => o.payment_status === "paid").length}</p></div>
                                                    <div><p style={{ margin: 0, fontSize: "10px", color: "#f59e0b", fontWeight: "700" }}>UNPAID</p><p style={{ margin: 0, fontSize: "18px", fontWeight: "900" }}>{todayOrders.filter(o => o.payment_status !== "paid").length}</p></div>
                                                    <div><p style={{ margin: 0, fontSize: "10px", color: "#6b7280", fontWeight: "700" }}>REVENUE</p><p style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: "#10b981" }}>GHS {todayRevenue.toFixed(0)}</p></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ backgroundColor: "white", borderRadius: "24px", padding: "24px", border: "1px solid #f1f5f9" }}>
                                            <h2 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: "700" }}>Quick Actions</h2>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                                {[
                                                    { label: "Add Item", icon: "+", action: () => { setActivePage("menu"); setShowAddModal(true); } },
                                                    { label: "Edit Menu", icon: "✎", action: () => setActivePage("menu") },
                                                    { label: "Insights", icon: "📊", action: () => setActivePage("insights") },
                                                    { label: "Settings", icon: "⚙", action: () => setActivePage("settings") },
                                                ].map(btn => (
                                                    <button key={btn.label} onClick={btn.action}
                                                        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px", backgroundColor: "#f8fafc", borderRadius: "14px", border: "none", cursor: "pointer", gap: "6px", transition: "all 0.2s" }}
                                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#fff0f0"; }}
                                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#f8fafc"; }}>
                                                        <span style={{ fontSize: "20px" }}>{btn.icon}</span>
                                                        <span style={{ fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>{btn.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── ORDERS PAGE ── */}
                        {activePage === "pending" && (
                            <div>
                                <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
                                    {["all", "pending", "confirmed", "preparing", "ready", "delivered", "rejected"].map(tab => (
                                        <button key={tab} onClick={() => setActiveTab(tab)}
                                            style={{ padding: "8px 16px", borderRadius: "10px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "700", textTransform: "capitalize", backgroundColor: activeTab === tab ? "#111827" : "white", color: activeTab === tab ? "white" : "#64748b", boxShadow: activeTab === tab ? "none" : "0 1px 3px rgba(0,0,0,0.05)" }}>
                                            {tab === "all" ? "All" : tab}
                                            {tab === "pending" && stats.pending > 0 && (
                                                <span style={{ marginLeft: "6px", backgroundColor: "#FF4B4B", color: "white", fontSize: "10px", padding: "1px 6px", borderRadius: "999px" }}>{stats.pending}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <div style={{ backgroundColor: "white", borderRadius: "24px", border: "1px solid #f1f5f9", overflow: "hidden" }}>
                                    <div style={{ padding: "20px 24px", borderBottom: "1px solid #f8fafc" }}>
                                        <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>{activeTab === "all" ? "All Orders" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1) + " Orders"}</h2>
                                        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>{filteredOrders.length} orders • Click any row for details</p>
                                    </div>

                                    {filteredOrders.length === 0 ? (
                                        <div style={{ padding: "64px", textAlign: "center" }}>
                                            <p style={{ fontSize: "40px", margin: "0 0 12px" }}>📭</p>
                                            <p style={{ color: "#64748b", fontSize: "15px", fontWeight: "600", margin: 0 }}>No orders here yet</p>
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: "auto" }}>
                                            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1100px" }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: "#f8fafc" }}>
                                                        {["Order", "Customer", "Items", "Total", "Pay Method", "Notes", "Type", "Address", "Payment", "Status", "Time", "Action"].map(h => (
                                                            <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        let lastDate = null;
                                                        return filteredOrders.map((order) => {
                                                            const orderDate = new Date(order.created_at).toDateString();
                                                            const isNewDate = orderDate !== lastDate;
                                                            lastDate = orderDate;
                                                            const isToday = orderDate === new Date().toDateString();
                                                            const isYesterday = orderDate === new Date(Date.now() - 86400000).toDateString();
                                                            const dateLabel = isToday ? "Today" : isYesterday ? "Yesterday" : new Date(order.created_at).toLocaleDateString("en-GH", { weekday: "long", month: "long", day: "numeric" });
                                                            return (
                                                                <>
                                                                    {isNewDate && (
                                                                        <tr key={"date-" + orderDate}>
                                                                            <td colSpan="12" style={{ padding: "12px 14px 6px", backgroundColor: "#f8fafc" }}>
                                                                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                                                    <span style={{ fontSize: "11px", fontWeight: "800", backgroundColor: isToday ? "#fff0f0" : "#f1f5f9", color: isToday ? "#FF4B4B" : "#64748b", padding: "3px 10px", borderRadius: "999px" }}>{dateLabel}</span>
                                                                                    <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }}></div>
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                    <tr key={order.id} onClick={() => setSelectedOrder(order)}
                                                                        style={{ borderTop: "1px solid #f8fafc", cursor: "pointer", transition: "background 0.15s", backgroundColor: order.status === "pending" ? "#fffbeb" : "transparent" }}
                                                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "#fafafa"}
                                                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = order.status === "pending" ? "#fffbeb" : "transparent"}>
                                                                        <td style={{ padding: "12px 14px", fontWeight: "700", fontSize: "12px", fontFamily: "monospace" }}>#{order.id.substring(0, 8).toUpperCase()}</td>
                                                                        <td style={{ padding: "12px 14px", fontSize: "12px", color: "#64748b" }}>{order.customer_phone?.replace("whatsapp:", "")}</td>
                                                                        <td style={{ padding: "12px 14px", fontSize: "12px", maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.items}</td>
                                                                        <td style={{ padding: "12px 14px", fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap" }}>{order.total_amount ? "GHS " + parseFloat(order.total_amount).toFixed(2) : "—"}</td>
                                                                        <td style={{ padding: "12px 14px" }}>
                                                                            <span style={{ fontSize: "11px", fontWeight: "700", color: order.payment_method === "momo" ? "#7c3aed" : "#64748b" }}>
                                                                                {order.payment_method === "momo" ? "📱 MoMo" : order.payment_method === "cash" ? "💵 Cash" : "—"}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: "12px 14px", maxWidth: "100px" }}>
                                                                            {order.notes ? <span title={order.notes} style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "700", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.notes}</span> : <span style={{ color: "#cbd5e1" }}>—</span>}
                                                                        </td>
                                                                        <td style={{ padding: "12px 14px" }}>
                                                                            <span style={{ backgroundColor: order.delivery_type === "pickup" ? "#ede9fe" : "#e0f2fe", color: order.delivery_type === "pickup" ? "#6d28d9" : "#0369a1", padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "700" }}>
                                                                                {order.delivery_type === "pickup" ? "Pickup" : "Delivery"}
                                                                            </span>
                                                                        </td>
                                                                        <td style={{ padding: "12px 14px", fontSize: "12px", color: "#94a3b8", maxWidth: "90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.delivery_address || "—"}</td>
                                                                        <td style={{ padding: "12px 14px" }}>{getPaymentBadge(order.payment_status)}</td>
                                                                        <td style={{ padding: "12px 14px" }}>{getStatusBadge(order.status)}</td>
                                                                        <td style={{ padding: "12px 14px", fontSize: "11px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                                                                            {new Date(order.created_at).toLocaleString("en-GH", { hour: "2-digit", minute: "2-digit" })}
                                                                        </td>
                                                                        <td style={{ padding: "12px 14px" }} onClick={e => e.stopPropagation()}>{getNextAction(order)}</td>
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

                        {/* ── MENU MANAGER ── */}
                        {activePage === "menu" && (
                            <div>
                                <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
                                    {["All", "Main", "Sides", "Extras"].map(cat => (
                                        <button key={cat} onClick={() => setMenuFilter(cat)}
                                            style={{ padding: "8px 20px", borderRadius: "10px", border: menuFilter === cat ? "none" : "1px solid #e2e8f0", cursor: "pointer", fontSize: "12px", fontWeight: "700", backgroundColor: menuFilter === cat ? "#111827" : "white", color: menuFilter === cat ? "white" : "#64748b" }}>
                                            {cat === "All" ? "All Items" : cat}
                                        </button>
                                    ))}
                                </div>
                                {filteredMenu.length === 0 ? (
                                    <div style={{ textAlign: "center", padding: "64px" }}>
                                        <p style={{ fontSize: "40px", margin: "0 0 12px" }}>🍽️</p>
                                        <p style={{ color: "#64748b", fontSize: "15px", fontWeight: "600" }}>No items yet</p>
                                    </div>
                                ) : (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
                                        {filteredMenu.map(item => (
                                            <div key={item.id} style={{ backgroundColor: "white", padding: "24px", borderRadius: "24px", border: "1px solid #f1f5f9", opacity: item.available ? 1 : 0.5, filter: item.available ? "none" : "grayscale(1)" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                                                    <div>
                                                        <span style={{ fontSize: "9px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.15em", color: "#94a3b8" }}>{item.category || "Main"}</span>
                                                        <h3 style={{ margin: "2px 0 0", fontSize: "16px", fontWeight: "700" }}>{item.item_name}</h3>
                                                    </div>
                                                    <div onClick={() => toggleAvailable(item.id, item.available)}
                                                        style={{ width: "40px", height: "22px", backgroundColor: item.available ? "#FF4B4B" : "#e2e8f0", borderRadius: "20px", cursor: "pointer", position: "relative", transition: "background 0.3s", flexShrink: 0 }}>
                                                        <div style={{ position: "absolute", width: "16px", height: "16px", backgroundColor: "white", borderRadius: "50%", top: "3px", left: item.available ? "21px" : "3px", transition: "left 0.3s" }}></div>
                                                    </div>
                                                </div>
                                                <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 20px" }}>{item.item_description || "No description"}</p>
                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f8fafc", paddingTop: "16px" }}>
                                                    <span style={{ color: "#FF4B4B", fontWeight: "900", fontSize: "16px" }}>GHS {parseFloat(item.item_price).toFixed(2)}</span>
                                                    <button onClick={() => deleteMenuItem(item.id)} style={{ backgroundColor: "transparent", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: "16px" }}
                                                        onMouseEnter={e => e.currentTarget.style.color = "#FF4B4B"}
                                                        onMouseLeave={e => e.currentTarget.style.color = "#cbd5e1"}>🗑</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── INSIGHTS ── */}
                        {activePage === "insights" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
                                    {[
                                        { label: "Total Customers", value: insights.totalCustomers, icon: "👥", sub: "Unique WhatsApp numbers" },
                                        { label: "Avg Order Value", value: "GHS " + insights.avgOrderValue.toFixed(2), icon: "💰", sub: "Per order" },
                                        { label: "Completion Rate", value: Math.round((stats.delivered / (stats.total || 1)) * 100) + "%", icon: "✅", sub: "Orders delivered" },
                                    ].map((stat, i) => (
                                        <div key={i} style={{ backgroundColor: "white", padding: "28px", borderRadius: "20px", border: "1px solid #f1f5f9" }}>
                                            <p style={{ margin: "0 0 8px", fontSize: "28px" }}>{stat.icon}</p>
                                            <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8" }}>{stat.label}</p>
                                            <h3 style={{ margin: "0 0 4px", fontSize: "28px", fontWeight: "900", fontFamily: "Montserrat, sans-serif" }}>{stat.value}</h3>
                                            <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>{stat.sub}</p>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                                    {/* Top Items */}
                                    <div style={{ backgroundColor: "white", borderRadius: "24px", padding: "28px", border: "1px solid #f1f5f9" }}>
                                        <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: "700" }}>🏆 Best Sellers</h2>
                                        {insights.topItems.length === 0 ? (
                                            <p style={{ color: "#94a3b8", fontSize: "13px" }}>No data yet</p>
                                        ) : (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                                {insights.topItems.map((item, i) => (
                                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                        <span style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#d97706" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", color: i < 3 ? "white" : "#64748b", flexShrink: 0 }}>{i + 1}</span>
                                                        <span style={{ flex: 1, fontSize: "13px", fontWeight: "600" }}>{item.name}</span>
                                                        <span style={{ fontSize: "12px", fontWeight: "800", color: "#FF4B4B" }}>{item.count}x</span>
                                                        <div style={{ width: "80px", height: "6px", backgroundColor: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                                                            <div style={{ height: "100%", backgroundColor: "#FF4B4B", borderRadius: "999px", width: Math.round((item.count / (insights.topItems[0]?.count || 1)) * 100) + "%" }}></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Broadcast */}
                                    <div style={{ backgroundColor: "white", borderRadius: "24px", padding: "28px", border: "1px solid #f1f5f9" }}>
                                        <h2 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: "700" }}>📢 One-Tap Broadcast</h2>
                                        <p style={{ margin: "0 0 20px", fontSize: "12px", color: "#94a3b8" }}>Send a promo or update to all {insights.totalCustomers} customers</p>
                                        <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)}
                                            placeholder="e.g. 🎉 Special offer today! Get 20% off all orders. Type Hi to order now!"
                                            style={{ width: "100%", padding: "14px 16px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "13px", outline: "none", height: "100px", resize: "none", boxSizing: "border-box", marginBottom: "12px" }} />
                                        <button onClick={sendBroadcast} disabled={broadcastSending || !broadcastMsg.trim()}
                                            style={{ width: "100%", padding: "14px", backgroundColor: broadcastSending ? "#94a3b8" : "#FF4B4B", color: "white", border: "none", borderRadius: "12px", fontWeight: "800", fontSize: "14px", cursor: broadcastSending ? "not-allowed" : "pointer" }}>
                                            {broadcastSending ? "Sending..." : "📢 Send to All Customers"}
                                        </button>
                                        {broadcastResult && (
                                            <div style={{ marginTop: "12px", padding: "12px 16px", backgroundColor: broadcastResult.success ? "#f0fdf4" : "#fef2f2", borderRadius: "10px" }}>
                                                <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: broadcastResult.success ? "#065f46" : "#dc2626" }}>
                                                    {broadcastResult.success ? "✅ Sent to " + broadcastResult.sent + "/" + broadcastResult.total + " customers!" : "❌ Error: " + broadcastResult.error}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── SETTINGS ── */}
                        {activePage === "settings" && (
                            <div style={{ maxWidth: "600px", display: "flex", flexDirection: "column", gap: "20px" }}>

                                {/* Business Hours */}
                                <div style={{ backgroundColor: "white", borderRadius: "24px", padding: "28px", border: "1px solid #f1f5f9" }}>
                                    <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: "700" }}>🕐 Business Hours</h2>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: "700", fontSize: "14px" }}>Shop Status</p>
                                            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>Customers can't order when closed</p>
                                        </div>
                                        <div onClick={() => setSettings(s => ({ ...s, is_open: !s.is_open }))}
                                            style={{ width: "52px", height: "28px", backgroundColor: settings.is_open ? "#10b981" : "#e2e8f0", borderRadius: "20px", cursor: "pointer", position: "relative", transition: "background 0.3s" }}>
                                            <div style={{ position: "absolute", width: "20px", height: "20px", backgroundColor: "white", borderRadius: "50%", top: "4px", left: settings.is_open ? "28px" : "4px", transition: "left 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}></div>
                                        </div>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                        <div>
                                            <label style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Opening Time</label>
                                            <input type="time" value={settings.open_time} onChange={e => setSettings(s => ({ ...s, open_time: e.target.value }))}
                                                style={{ display: "block", width: "100%", marginTop: "6px", padding: "12px 14px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "14px", fontWeight: "700", outline: "none", boxSizing: "border-box" }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Closing Time</label>
                                            <input type="time" value={settings.close_time} onChange={e => setSettings(s => ({ ...s, close_time: e.target.value }))}
                                                style={{ display: "block", width: "100%", marginTop: "6px", padding: "12px 14px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", fontSize: "14px", fontWeight: "700", outline: "none", boxSizing: "border-box" }} />
                                        </div>
                                    </div>
                                </div>

                                {/* Auto Accept */}
                                <div style={{ backgroundColor: "white", borderRadius: "24px", padding: "28px", border: "1px solid #f1f5f9" }}>
                                    <h2 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: "700" }}>⚡ Auto-Accept Orders</h2>
                                    <p style={{ margin: "0 0 20px", fontSize: "12px", color: "#94a3b8" }}>Orders are automatically confirmed and payment link sent immediately — no manual review needed</p>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: "700", fontSize: "14px" }}>Auto-Accept</p>
                                            <p style={{ margin: "2px 0 0", fontSize: "12px", color: settings.auto_accept ? "#10b981" : "#94a3b8" }}>{settings.auto_accept ? "✅ Enabled — orders confirmed instantly" : "⏸ Disabled — manual review required"}</p>
                                        </div>
                                        <div onClick={() => setSettings(s => ({ ...s, auto_accept: !s.auto_accept }))}
                                            style={{ width: "52px", height: "28px", backgroundColor: settings.auto_accept ? "#FF4B4B" : "#e2e8f0", borderRadius: "20px", cursor: "pointer", position: "relative", transition: "background 0.3s" }}>
                                            <div style={{ position: "absolute", width: "20px", height: "20px", backgroundColor: "white", borderRadius: "50%", top: "4px", left: settings.auto_accept ? "28px" : "4px", transition: "left 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}></div>
                                        </div>
                                    </div>
                                </div>

                                <button onClick={saveSettings}
                                    style={{ width: "100%", padding: "16px", backgroundColor: "#111827", color: "white", border: "none", borderRadius: "16px", fontWeight: "800", fontSize: "15px", cursor: "pointer" }}>
                                    💾 Save Settings
                                </button>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </>
    );
}
