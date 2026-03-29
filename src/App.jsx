import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import Login from "./Login";
import Signup from "./Signup";

export default function App() {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [page, setPage] = useState("login");
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, delivered: 0 });
    const [activeTab, setActiveTab] = useState("all");
    const [activePage, setActivePage] = useState("orders");
    const [businessName, setBusinessName] = useState("");
    const [menuItems, setMenuItems] = useState([]);
    const [newItem, setNewItem] = useState({ item_name: "", item_price: "", item_description: "" });

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
                .channel("orders")
                .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
                .subscribe();
            return () => supabase.removeChannel(subscription);
        }
    }, [user]);

    async function fetchBusinessName() {
        const { data } = await supabase
            .from("businesses")
            .select("name")
            .eq("user_id", user.id)
            .limit(1);
        if (data && data.length > 0) {
            const name = data[0].name;
            setBusinessName(name);
            const { data: menuData } = await supabase
                .from("menus")
                .select("*")
                .eq("business_name", name)
                .order("created_at", { ascending: false });
            if (menuData) setMenuItems(menuData);
        }
    }

    async function fetchOrders() {
        setLoading(true);
        const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
        if (!error && data) {
            setOrders(data);
            setStats({
                total: data.length,
                pending: data.filter(o => o.status === "pending").length,
                confirmed: data.filter(o => o.status === "confirmed").length,
                delivered: data.filter(o => o.status === "delivered").length,
            });
        }
        setLoading(false);
    }

    async function fetchMenuItems() {
        const { data } = await supabase
            .from("menus")
            .select("*")
            .eq("business_name", businessName)
            .order("created_at", { ascending: false });
        if (data) setMenuItems(data);
    }

    async function addMenuItem() {
        if (!newItem.item_name || !newItem.item_price) return;
        await supabase.from("menus").insert([{
            business_name: businessName,
            item_name: newItem.item_name,
            item_price: parseFloat(newItem.item_price),
            item_description: newItem.item_description,
            available: true
        }]);
        setNewItem({ item_name: "", item_price: "", item_description: "" });
        fetchMenuItems();
    }

    async function toggleAvailable(id, current) {
        await supabase.from("menus").update({ available: !current }).eq("id", id);
        fetchMenuItems();
    }

    async function deleteMenuItem(id) {
        await supabase.from("menus").delete().eq("id", id);
        fetchMenuItems();
    }

    async function updateStatus(id, status, customerPhone, deliveryType) {
        await supabase.from("orders").update({ status }).eq("id", id);
        try {
            await fetch("https://web-production-a3a4.up.railway.app/whatsapp/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerPhone, orderId: id.substring(0, 8).toUpperCase(), status, deliveryType })
            });
        } catch (error) { console.log("Notification error:", error); }
        fetchOrders();
    }

    async function handleLogout() {
        await supabase.auth.signOut();
        setUser(null);
    }

    function getStatusStyle(status) {
        switch (status) {
            case "pending": return { bg: "#fef3c7", color: "#d97706", dot: "#f59e0b" };
            case "confirmed": return { bg: "#dbeafe", color: "#1d4ed8", dot: "#3b82f6" };
            case "delivered": return { bg: "#d1fae5", color: "#065f46", dot: "#10b981" };
            default: return { bg: "#f3f4f6", color: "#6b7280", dot: "#9ca3af" };
        }
    }

    function getDeliveryStyle(type) {
        switch (type) {
            case "pickup": return { label: "Pickup", bg: "#ede9fe", color: "#6d28d9" };
            case "delivery": return { label: "Delivery", bg: "#e0f2fe", color: "#0369a1" };
            default: return { label: "Pending", bg: "#f3f4f6", color: "#6b7280" };
        }
    }

    const filteredOrders = orders.filter(o => activeTab === "all" ? true : o.status === activeTab);
    const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());

    if (authLoading) return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
            <div style={{ textAlign: "center" }}>
                <h2 style={{ color: "white", fontSize: "24px", fontWeight: "800" }}>DelivaGH</h2>
                <p style={{ color: "#64748b", marginTop: "8px" }}>Loading your dashboard...</p>
            </div>
        </div>
    );

    if (!user && page === "signup") return <Signup onSignup={(u) => { setUser(u); setPage("login"); }} onLogin={() => setPage("login")} />;
    if (!user) return <Login onLogin={(u) => setUser(u)} onSignup={() => setPage("signup")} />;

    return (
        <div style={{ display: "flex", width: "100vw", minHeight: "100vh", backgroundColor: "#f1f5f9", fontFamily: "'Segoe UI', Arial, sans-serif", overflow: "hidden" }}>

            {/* Sidebar */}
            <div style={{ width: "260px", minHeight: "100vh", backgroundColor: "#0f172a", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100 }}>
                <div style={{ padding: "28px 24px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "36px", height: "36px", backgroundColor: "#16a34a", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "white", fontWeight: "800" }}>D</div>
                        <div>
                            <h1 style={{ color: "white", margin: 0, fontSize: "18px", fontWeight: "800" }}>DelivaGH</h1>
                            <p style={{ color: "#64748b", margin: 0, fontSize: "11px" }}>Order Management</p>
                        </div>
                    </div>
                </div>

                <div style={{ padding: "8px 12px", flex: 1 }}>
                    <p style={{ color: "#475569", fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 12px", marginBottom: "8px" }}>Orders</p>
                    {[
                        { label: "Overview", icon: "▦", tab: "all", count: stats.total },
                        { label: "Pending", icon: "◷", tab: "pending", count: stats.pending },
                        { label: "Confirmed", icon: "◉", tab: "confirmed", count: stats.confirmed },
                        { label: "Delivered", icon: "◎", tab: "delivered", count: stats.delivered },
                    ].map(item => (
                        <button key={item.tab}
                            onClick={() => { setActivePage("orders"); setActiveTab(item.tab); }}
                            style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "11px 12px", borderRadius: "10px", border: "none", cursor: "pointer", marginBottom: "2px", backgroundColor: activePage === "orders" && activeTab === item.tab ? "#1e293b" : "transparent", color: activePage === "orders" && activeTab === item.tab ? "white" : "#94a3b8", fontSize: "14px", fontWeight: activePage === "orders" && activeTab === item.tab ? "600" : "400", textAlign: "left" }}>
                            <span style={{ fontSize: "16px", width: "20px", textAlign: "center" }}>{item.icon}</span>
                            <span style={{ flex: 1 }}>{item.label}</span>
                            <span style={{ backgroundColor: activePage === "orders" && activeTab === item.tab ? "#16a34a" : "#1e293b", color: activePage === "orders" && activeTab === item.tab ? "white" : "#64748b", borderRadius: "999px", padding: "2px 8px", fontSize: "11px", fontWeight: "600" }}>
                                {item.count}
                            </span>
                        </button>
                    ))}

                    <p style={{ color: "#475569", fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.1em", padding: "12px 12px 8px", marginTop: "8px" }}>Business</p>
                    <button onClick={() => setActivePage("menu")}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "11px 12px", borderRadius: "10px", border: "none", cursor: "pointer", marginBottom: "2px", backgroundColor: activePage === "menu" ? "#1e293b" : "transparent", color: activePage === "menu" ? "white" : "#94a3b8", fontSize: "14px", fontWeight: activePage === "menu" ? "600" : "400", textAlign: "left" }}>
                        <span style={{ fontSize: "16px", width: "20px", textAlign: "center" }}>☰</span>
                        <span style={{ flex: 1 }}>Menu Manager</span>
                        <span style={{ backgroundColor: activePage === "menu" ? "#16a34a" : "#1e293b", color: activePage === "menu" ? "white" : "#64748b", borderRadius: "999px", padding: "2px 8px", fontSize: "11px", fontWeight: "600" }}>
                            {menuItems.length}
                        </span>
                    </button>
                </div>

                <div style={{ padding: "16px", borderTop: "1px solid #1e293b" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                        <div style={{ width: "36px", height: "36px", backgroundColor: "#16a34a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "700", fontSize: "14px" }}>
                            {user.email?.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, overflow: "hidden" }}>
                            <p style={{ color: "white", margin: 0, fontSize: "13px", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{businessName || user.email?.split("@")[0]}</p>
                            <p style={{ color: "#64748b", margin: 0, fontSize: "11px" }}>Admin</p>
                        </div>
                    </div>
                    <button onClick={handleLogout}
                        style={{ width: "100%", backgroundColor: "#1e293b", color: "#94a3b8", border: "none", padding: "9px", borderRadius: "8px", fontSize: "13px", cursor: "pointer", fontWeight: "500" }}>
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Main */}
            <div style={{ marginLeft: "260px", flex: 1, padding: "32px", minWidth: 0, overflowY: "auto", maxHeight: "100vh" }}>

                {activePage === "menu" ? (
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: "26px", fontWeight: "800", color: "#0f172a" }}>Menu Manager</h2>
                                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "14px" }}>{businessName} — {menuItems.length} items</p>
                            </div>
                        </div>

                        <div style={{ backgroundColor: "white", borderRadius: "16px", padding: "24px", border: "1px solid #e2e8f0", marginBottom: "24px" }}>
                            <h3 style={{ margin: "0 0 20px", fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>Add New Item</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto", gap: "12px", alignItems: "end" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Item Name</label>
                                    <input value={newItem.item_name} onChange={e => setNewItem({ ...newItem, item_name: e.target.value })} placeholder="e.g. Jollof Rice"
                                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Price (GHS)</label>
                                    <input value={newItem.item_price} onChange={e => setNewItem({ ...newItem, item_price: e.target.value })} placeholder="e.g. 35" type="number"
                                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }} />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Description</label>
                                    <input value={newItem.item_description} onChange={e => setNewItem({ ...newItem, item_description: e.target.value })} placeholder="e.g. Served with chicken and salad"
                                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" }} />
                                </div>
                                <button onClick={addMenuItem}
                                    style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", fontSize: "14px", cursor: "pointer", fontWeight: "600", whiteSpace: "nowrap" }}>
                                    Add Item
                                </button>
                            </div>
                        </div>

                        <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                            <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9" }}>
                                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>Current Menu</h3>
                            </div>
                            {menuItems.length === 0 ? (
                                <div style={{ padding: "64px", textAlign: "center" }}>
                                    <p style={{ fontSize: "40px", margin: "0 0 12px" }}>🍽️</p>
                                    <p style={{ color: "#64748b", fontSize: "15px", fontWeight: "500", margin: 0 }}>No menu items yet</p>
                                    <p style={{ color: "#94a3b8", fontSize: "13px", margin: "4px 0 0" }}>Add your first item above</p>
                                </div>
                            ) : (
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ backgroundColor: "#f8fafc" }}>
                                            {["Item", "Price", "Description", "Status", "Actions"].map(h => (
                                                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "700" }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {menuItems.map((item, i) => (
                                            <tr key={item.id} style={{ borderTop: "1px solid #f8fafc", backgroundColor: i % 2 === 0 ? "white" : "#fafafa" }}>
                                                <td style={{ padding: "14px 16px", fontSize: "14px", fontWeight: "600", color: "#0f172a" }}>{item.item_name}</td>
                                                <td style={{ padding: "14px 16px", fontSize: "14px", color: "#16a34a", fontWeight: "700" }}>GHS {item.item_price}</td>
                                                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#64748b" }}>{item.item_description || "-"}</td>
                                                <td style={{ padding: "14px 16px" }}>
                                                    <span style={{ backgroundColor: item.available ? "#d1fae5" : "#fee2e2", color: item.available ? "#065f46" : "#991b1b", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "600" }}>
                                                        {item.available ? "Available" : "Unavailable"}
                                                    </span>
                                                </td>
                                                <td style={{ padding: "14px 16px" }}>
                                                    <div style={{ display: "flex", gap: "8px" }}>
                                                        <button onClick={() => toggleAvailable(item.id, item.available)}
                                                            style={{ backgroundColor: item.available ? "#fef3c7" : "#d1fae5", color: item.available ? "#d97706" : "#065f46", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>
                                                            {item.available ? "Hide" : "Show"}
                                                        </button>
                                                        <button onClick={() => deleteMenuItem(item.id)}
                                                            style={{ backgroundColor: "#fee2e2", color: "#991b1b", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                ) : (
                    <div>
                        {/* Top bar */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: "26px", fontWeight: "800", color: "#0f172a" }}>
                                    Welcome Back, {businessName || user.email?.split("@")[0]}!
                                </h2>
                                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "14px" }}>
                                    {new Date().toLocaleDateString("en-GH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                                </p>
                            </div>
                            <button onClick={fetchOrders}
                                style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 20px", borderRadius: "10px", fontSize: "13px", cursor: "pointer", fontWeight: "600" }}>
                                Refresh
                            </button>
                        </div>

                        {/* Stats */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", marginBottom: "28px" }}>
                            {[
                                { label: "Total Orders", value: stats.total, sub: "All time", bg: "#0f172a", valueColor: "#22c55e", subColor: "#64748b" },
                                { label: "Pending", value: stats.pending, sub: "Needs attention", bg: "white", valueColor: "#f59e0b", subColor: "#64748b" },
                                { label: "Confirmed", value: stats.confirmed, sub: "In progress", bg: "white", valueColor: "#3b82f6", subColor: "#64748b" },
                                { label: "Delivered", value: stats.delivered, sub: "Completed", bg: "white", valueColor: "#10b981", subColor: "#64748b" },
                            ].map((stat) => (
                                <div key={stat.label} style={{ backgroundColor: stat.bg, borderRadius: "16px", padding: "22px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: stat.bg === "white" ? "1px solid #e2e8f0" : "none" }}>
                                    <p style={{ margin: 0, color: stat.subColor, fontSize: "13px", fontWeight: "500" }}>{stat.label}</p>
                                    <p style={{ margin: "10px 0 4px", fontSize: "40px", fontWeight: "800", color: stat.valueColor, lineHeight: 1 }}>{stat.value}</p>
                                    <p style={{ margin: 0, color: stat.subColor, fontSize: "12px" }}>{stat.sub}</p>
                                </div>
                            ))}
                        </div>

                        {/* Today + Recent */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px", marginBottom: "28px" }}>
                            <div style={{ backgroundColor: "#16a34a", borderRadius: "16px", padding: "24px" }}>
                                <p style={{ color: "#bbf7d0", margin: "0 0 4px", fontSize: "13px", fontWeight: "500" }}>Today's Orders</p>
                                <p style={{ color: "white", margin: "0 0 16px", fontSize: "42px", fontWeight: "800", lineHeight: 1 }}>{todayOrders.length}</p>
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <div style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "8px", padding: "8px 12px", flex: 1 }}>
                                        <p style={{ color: "#bbf7d0", margin: 0, fontSize: "11px" }}>Pickup</p>
                                        <p style={{ color: "white", margin: "2px 0 0", fontSize: "20px", fontWeight: "700" }}>
                                            {todayOrders.filter(o => o.delivery_type === "pickup").length}
                                        </p>
                                    </div>
                                    <div style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "8px", padding: "8px 12px", flex: 1 }}>
                                        <p style={{ color: "#bbf7d0", margin: 0, fontSize: "11px" }}>Delivery</p>
                                        <p style={{ color: "white", margin: "2px 0 0", fontSize: "20px", fontWeight: "700" }}>
                                            {todayOrders.filter(o => o.delivery_type === "delivery").length}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div style={{ backgroundColor: "white", borderRadius: "16px", padding: "24px", border: "1px solid #e2e8f0" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>Recent Activity</h3>
                                    <span style={{ color: "#64748b", fontSize: "12px" }}>Last 5 orders</span>
                                </div>
                                {orders.slice(0, 5).map(order => {
                                    const s = getStatusStyle(order.status);
                                    return (
                                        <div key={order.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: "1px solid #f8fafc" }}>
                                            <div style={{ width: "36px", height: "36px", backgroundColor: s.bg, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                                                {order.delivery_type === "pickup" ? "🏪" : "🚚"}
                                            </div>
                                            <div style={{ flex: 1, overflow: "hidden" }}>
                                                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.items}</p>
                                                {order.notes && (
                                                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#d97706", fontWeight: "500" }}>Note: {order.notes}</p>
                                                )}
                                                <p style={{ margin: "1px 0 0", fontSize: "11px", color: "#94a3b8" }}>{order.business_name || "DelivaGH"} • {order.customer_phone?.replace("whatsapp:", "")}</p>
                                            </div>
                                            <span style={{ backgroundColor: s.bg, color: s.color, padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "600", flexShrink: 0 }}>
                                                {order.status}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Orders Table */}
                        <div style={{ backgroundColor: "white", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                            <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>
                                        {activeTab === "all" ? "All Orders" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1) + " Orders"}
                                    </h3>
                                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>{filteredOrders.length} orders total</p>
                                </div>
                            </div>

                            {loading ? (
                                <div style={{ padding: "64px", textAlign: "center" }}>
                                    <p style={{ color: "#94a3b8", fontSize: "14px" }}>Loading orders...</p>
                                </div>
                            ) : filteredOrders.length === 0 ? (
                                <div style={{ padding: "64px", textAlign: "center" }}>
                                    <p style={{ fontSize: "40px", margin: "0 0 12px" }}>📭</p>
                                    <p style={{ color: "#64748b", fontSize: "15px", fontWeight: "500", margin: 0 }}>No orders here yet</p>
                                </div>
                            ) : (
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
                                        <thead>
                                            <tr style={{ backgroundColor: "#f8fafc" }}>
                                                {["Order", "Business", "Customer", "Items", "Notes", "Type", "Address", "Status", "Payment", "Time", "Action"].map(h => (
                                                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "700", borderBottom: "1px solid #f1f5f9" }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                let lastDate = null;
                                                return filteredOrders.map((order, i) => {
                                                    const orderDate = new Date(order.created_at).toDateString();
                                                    const isNewDate = orderDate !== lastDate;
                                                    lastDate = orderDate;
                                                    const isToday = orderDate === new Date().toDateString();
                                                    const isYesterday = orderDate === new Date(Date.now() - 86400000).toDateString();
                                                    const dateLabel = isToday ? "Today" : isYesterday ? "Yesterday" : new Date(order.created_at).toLocaleDateString("en-GH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
                                                    const s = getStatusStyle(order.status);
                                                    const d = getDeliveryStyle(order.delivery_type);
                                                    return (
                                                        <>
                                                            {isNewDate && (
                                                                <tr key={"date-" + orderDate}>
                                                                    <td colSpan="11" style={{ padding: "16px 16px 8px", backgroundColor: "#f8fafc" }}>
                                                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                                            <span style={{ fontSize: "12px", fontWeight: "700", backgroundColor: isToday ? "#dcfce7" : "#f1f5f9", color: isToday ? "#16a34a" : "#64748b", padding: "4px 12px", borderRadius: "999px" }}>
                                                                                {dateLabel}
                                                                            </span>
                                                                            <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }}></div>
                                                                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                                                                                {filteredOrders.filter(o => new Date(o.created_at).toDateString() === orderDate).length} orders
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                            <tr key={order.id} style={{ borderBottom: "1px solid #f8fafc", backgroundColor: i % 2 === 0 ? "white" : "#fafafa" }}>
                                                                <td style={{ padding: "14px 16px" }}>
                                                                    <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: "700", color: "#0f172a", backgroundColor: "#f1f5f9", padding: "3px 8px", borderRadius: "6px" }}>
                                                                        #{order.id.substring(0, 8).toUpperCase()}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151", fontWeight: "500" }}>{order.business_name || "-"}</td>
                                                                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#64748b" }}>{order.customer_phone?.replace("whatsapp:", "")}</td>
                                                                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#374151", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.items}</td>
                                                                <td style={{ padding: "14px 16px", maxWidth: "150px" }}>
                                                                    {order.notes ? (
                                                                        <span style={{ backgroundColor: "#fef3c7", color: "#d97706", padding: "4px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: "600", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                            {order.notes}
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>-</span>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: "14px 16px" }}>
                                                                    <span style={{ backgroundColor: d.bg, color: d.color, padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "600" }}>{d.label}</span>
                                                                </td>
                                                                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#94a3b8", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.delivery_address || "-"}</td>
                                                                <td style={{ padding: "14px 16px" }}>
                                                                    <span style={{ backgroundColor: s.bg, color: s.color, padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                                                                        <span style={{ width: "5px", height: "5px", backgroundColor: s.dot, borderRadius: "50%", display: "inline-block" }}></span>
                                                                        {order.status}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: "14px 16px" }}>
                                                                    <span style={{ backgroundColor: order.payment_status === "paid" ? "#d1fae5" : "#fef9c3", color: order.payment_status === "paid" ? "#065f46" : "#854d0e", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "600" }}>
                                                                        {order.payment_status}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: "14px 16px", fontSize: "12px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                                                                    {new Date(order.created_at).toLocaleString("en-GH", { hour: "2-digit", minute: "2-digit" })}
                                                                </td>
                                                                <td style={{ padding: "14px 16px" }}>
                                                                    {order.status === "pending" && (
                                                                        <button onClick={() => updateStatus(order.id, "confirmed", order.customer_phone, order.delivery_type)}
                                                                            style={{ backgroundColor: "#3b82f6", color: "white", border: "none", padding: "6px 14px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>
                                                                            Confirm
                                                                        </button>
                                                                    )}
                                                                    {order.status === "confirmed" && (
                                                                        <button onClick={() => updateStatus(order.id, "delivered", order.customer_phone, order.delivery_type)}
                                                                            style={{ backgroundColor: "#10b981", color: "white", border: "none", padding: "6px 14px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>
                                                                            Delivered
                                                                        </button>
                                                                    )}
                                                                    {order.status === "delivered" && (
                                                                        <span style={{ color: "#10b981", fontSize: "12px", fontWeight: "600" }}>Done</span>
                                                                    )}
                                                                </td>
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
            </div>
        </div>
    );
}