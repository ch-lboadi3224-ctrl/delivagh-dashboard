import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import Login from "./Login";
import Signup from "./Signup";
import Onboarding from "./Onboarding";
import CompleteVendorProfile from "./CompleteVendorProfile";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://api.delivagh.app";
const API = BACKEND_URL;

/** Wall-clock session length for vendor portal (7 days). */
const VENDOR_SESSION_START_KEY = "delivagh_vendor_session_start";
const VENDOR_MAX_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const VENDOR_INACTIVITY_MS = 4 * 60 * 60 * 1000;
const VENDOR_ACTIVITY_THROTTLE_MS = 1000;

function clearVendorPersistedLocalStorage(userId) {
    try {
        localStorage.removeItem(VENDOR_SESSION_START_KEY);
        if (userId) {
            localStorage.removeItem("onboarding_done_" + userId);
            localStorage.removeItem("onboarding_last_step_" + userId);
            localStorage.removeItem("empty_menu_banner_dismissed_" + userId);
        }
    } catch (_) { /* ignore */ }
}

/** Ensure 7-day wall clock exists as soon as we have a confirmed auth user id (idempotent). */
function ensureVendorSessionStartTimestamp(userId) {
    if (!userId) return;
    try {
        const raw = localStorage.getItem(VENDOR_SESSION_START_KEY);
        const parsed = raw != null ? parseInt(raw, 10) : NaN;
        if (!raw || !Number.isFinite(parsed)) {
            const ts = String(Date.now());
            localStorage.setItem(VENDOR_SESSION_START_KEY, ts);
        
        }
    } catch (e) {
        
    }
}

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

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    componentDidCatch(error, info) { console.error("[ErrorBoundary] crashed:", error, info); }
    static getDerivedStateFromError(error) { return { error }; }
    render() {
        if (this.state.error) return (
            <div style={{ padding: "40px", color: "red", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                <h2>Dashboard crashed:</h2>
                <p>{this.state.error?.message}</p>
                <p>{this.state.error?.stack}</p>
            </div>
        );
        return this.props.children;
    }
}

export default function App() {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [page, setPage] = useState("dashboard");
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
    const [showUploadMenuModal, setShowUploadMenuModal] = useState(false);
    const [uploadMenuFile, setUploadMenuFile] = useState(null);
    const [uploadImagePreviewUrl, setUploadImagePreviewUrl] = useState(null);
    const [uploadExtracted, setUploadExtracted] = useState([]);
    const [uploadExtractLoading, setUploadExtractLoading] = useState(false);
    const [uploadSaveLoading, setUploadSaveLoading] = useState(false);
    const [uploadMenuError, setUploadMenuError] = useState("");
    const [uploadMenuDragActive, setUploadMenuDragActive] = useState(false);
    const menuFileInputRef = useRef(null);
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
    const [needsVendorProfile, setNeedsVendorProfile] = useState(false);
    // ── ONBOARDING ──
    const [onboardingDone, setOnboardingDone] = useState(false);
    const [onboardingChecked, setOnboardingChecked] = useState(false);
    const [isAdminLinkedVendor, setIsAdminLinkedVendor] = useState(false);
    const [showEmptyMenuBanner, setShowEmptyMenuBanner] = useState(false);

    const ordersRef = useRef([]);
    const audioCtxRef = useRef(null);
    const businessNameRef = useRef("");
    const notifIdRef = useRef(0);
    const sessionPolicySignOutLockRef = useRef(false);
    const fetchedBusinessNameForUserRef = useRef(null);
    const checkedAccountStatusForUserRef = useRef(null);

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

    const signOutForSessionPolicy = useCallback(async (userId) => {
        if (!supabase || sessionPolicySignOutLockRef.current) return;
        sessionPolicySignOutLockRef.current = true;
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.warn("Session policy signOut:", e);
        } finally {
            clearVendorPersistedLocalStorage(userId);
            setAuthNotice("You were signed out due to inactivity.");
            setUser(null);
            setBusinessName("");
            businessNameRef.current = "";
            setOnboardingChecked(false);
            setOnboardingDone(false);
            setNeedsVendorProfile(false);
            setIsAdminLinkedVendor(false);
            setShowEmptyMenuBanner(false);
            setMenuItems([]);
            setOrders([]);
            ordersRef.current = [];
            setSelectedOrder(null);
            fetchedBusinessNameForUserRef.current = null;
            checkedAccountStatusForUserRef.current = null;
            setPage("login");
            sessionPolicySignOutLockRef.current = false;
        }
    }, [supabase]);

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
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            const u = session?.user ?? null;
            setUser(u);
            if (event === "SIGNED_IN") {
                setAuthLoading(false);
            } else if (event === "SIGNED_OUT") {
                setAuthLoading(false);
            } else if (event === "INITIAL_SESSION") {
                setAuthLoading(false);
            } else {
                setAuthLoading(false);
            }
            const uid = u?.id;
            if (uid && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
                console.log("[vendorSession] onAuthStateChange", event, { userId: uid });
                ensureVendorSessionStartTimestamp(uid);
            }
        });
        supabase.auth.getSession().then(({ data: { session } }) => {
            const u = session?.user ?? null;
            setUser(u);
            const uid = u?.id;
            if (uid) {
                console.log("[vendorSession] getSession resolved", { userId: uid });
                ensureVendorSessionStartTimestamp(uid);
            }
            setAuthLoading(false);
        }).catch(() => {
            setAuthLoading(false);
        });
        return () => subscription.unsubscribe();
    }, [supabase]);

    useEffect(() => {
        const timer = setTimeout(() => setAuthLoading(false), 5000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!supabase) return;
        // If vendor intentionally goes to signup while already logged in, switch account cleanly.
        if (page === "signup" && user) {
            const uid = user.id;
            supabase.auth.signOut().finally(() => {
                clearVendorPersistedLocalStorage(uid);
                setUser(null);
            });
        }
    }, [page, user]);

    // ── Max session length (7 days) — checked whenever a vendor session is active ──
    useEffect(() => {
        if (!supabase) {
            console.log("[vendorSession] maxSession effect skip: no supabase");
            return;
        }
        const uid = user?.id;
        if (!uid) {
            console.log("[vendorSession] maxSession effect skip: no user.id yet");
            return;
        }
        console.log("[vendorSession] maxSession effect run", { userId: uid });
        const now = Date.now();
        let raw;
        try {
            raw = localStorage.getItem(VENDOR_SESSION_START_KEY);
        } catch (e) {
            console.warn("[vendorSession] maxSession read localStorage failed", e);
            return;
        }
        if (!raw || !Number.isFinite(parseInt(raw, 10))) {
            ensureVendorSessionStartTimestamp(uid);
            return;
        }
        const start = parseInt(raw, 10);
        if (now - start <= VENDOR_MAX_SESSION_MS) return;
        void signOutForSessionPolicy(uid);
    }, [supabase, user?.id, signOutForSessionPolicy]);

    // ── Inactivity timeout (4 hours) ──
    useEffect(() => {
        if (!supabase || !user?.id) return;
        const uid = user.id;
        let inactivityTimerId = null;
        let lastThrottle = 0;

        function bumpActivity() {
            const t = Date.now();
            if (t - lastThrottle < VENDOR_ACTIVITY_THROTTLE_MS) return;
            lastThrottle = t;
            if (inactivityTimerId != null) clearTimeout(inactivityTimerId);
            inactivityTimerId = setTimeout(() => {
                void signOutForSessionPolicy(uid);
            }, VENDOR_INACTIVITY_MS);
        }

        bumpActivity();

        const opts = { capture: true };
        window.addEventListener("mousemove", bumpActivity, opts);
        window.addEventListener("keydown", bumpActivity, opts);
        window.addEventListener("click", bumpActivity, opts);
        window.addEventListener("scroll", bumpActivity, opts);

        return () => {
            if (inactivityTimerId != null) clearTimeout(inactivityTimerId);
            window.removeEventListener("mousemove", bumpActivity, opts);
            window.removeEventListener("keydown", bumpActivity, opts);
            window.removeEventListener("click", bumpActivity, opts);
            window.removeEventListener("scroll", bumpActivity, opts);
        };
    }, [supabase, user?.id, signOutForSessionPolicy]);

    useEffect(() => {
        if (!supabase || !user?.id) return;
        if (checkedAccountStatusForUserRef.current === user.id) return;
        checkedAccountStatusForUserRef.current = user.id;
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
                setNeedsVendorProfile(false);
                await supabase.auth.signOut();
                clearVendorPersistedLocalStorage(user.id);
                if (!cancelled) {
                    setUser(null);
                    setBusinessName("");
                    businessNameRef.current = "";
                    setOnboardingChecked(false);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [supabase, user?.id]);

    useEffect(() => {
        if (!user?.id) return;
        const timer = setTimeout(() => {
            setOnboardingChecked(prev => {
                if (!prev) {
                    console.warn("[delivagh] onboardingChecked timeout — forcing true");
                    setNeedsVendorProfile(true);
                }
                return true;
            });
        }, 6000);
        return () => clearTimeout(timer);
    }, [user?.id]);

    // ── REAL-TIME — filtered by business ──
    useEffect(() => {
        if (!supabase || !user?.id) return;
        if (fetchedBusinessNameForUserRef.current === user.id) return;
        fetchedBusinessNameForUserRef.current = user.id;
        fetchBusinessName();

        const poll = setInterval(() => {
            if (businessNameRef.current) fetchOrders();
        }, 30000);

        return () => clearInterval(poll);
    }, [supabase, user?.id]);

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
        if (!supabase || !user?.id) return;
        setOnboardingChecked(false);
        setNeedsVendorProfile(false);
        setIsAdminLinkedVendor(false);
        setShowEmptyMenuBanner(false);

        try {
            let biz = null;
            let linkedViaDirectory = false;
            let businessNameFromDirectory = null;

            const { data: byUserId } = await supabase.from("businesses").select("*").eq("user_id", user.id).limit(1);
            console.log("[debug] byUserId result:", byUserId, "user.id:", user.id);
            if (byUserId && byUserId.length > 0) {
                biz = byUserId[0];
            } else {
                // Admin-created vendors may not be linked by user_id yet.
                // Resolve business_name from registered_businesses without filtering by missing columns.
                const { data: regData } = await supabase
                    .from("registered_businesses")
                    .select("business_name")
                    .limit(10);
                businessNameFromDirectory = regData?.[0]?.business_name || null;
                if (!businessNameFromDirectory) {
                    businessNameFromDirectory = user.user_metadata?.business_name || null;
                }

                if (businessNameFromDirectory) {
                    let byName = null;
                    const { data: bizByName } = await supabase
                        .from("businesses")
                        .select("*")
                        .eq("name", businessNameFromDirectory)
                        .limit(1);
                    byName = bizByName?.[0] || null;
                    if (!byName) {
                        const { data: bizByBusinessName } = await supabase
                            .from("businesses")
                            .select("*")
                            .eq("business_name", businessNameFromDirectory)
                            .limit(1);
                        byName = bizByBusinessName?.[0] || null;
                    }
                    if (byName) {
                        biz = byName;
                        linkedViaDirectory = true;
                    }
                }
            }

            if (biz) {
                console.log("[debug] biz found:", biz);
                console.log("[debug] name:", biz.name || biz.business_name);
                const name = biz.name || biz.business_name || "";
                setBusinessName(name);
                businessNameRef.current = name;

                const { data: menuData } = await supabase.from("menus").select("*").eq("business_name", name).order("created_at", { ascending: false });
                console.log("[debug] checkpoint 1 - after menu fetch");
                if (menuData) setMenuItems(menuData);

                const { data: sd } = await supabase
                    .from("business_settings")
                    .select("*")
                    .eq("business_name", name)
                    .maybeSingle();
                console.log("[debug] checkpoint 2 - after settings fetch");
                if (sd) {
                    setSettings(prev => ({
                        ...prev,
                        auto_accept: !!sd.auto_accept,
                        is_open: sd.is_open ?? true,
                        open_time: sd.opening_time || prev.open_time,
                        close_time: sd.closing_time || prev.close_time,
                    }));
                }

                if (linkedViaDirectory) {
                    setIsAdminLinkedVendor(true);
                    localStorage.setItem("onboarding_done_" + user.id, "true");
                    setOnboardingDone(true);
                    const dismissed = localStorage.getItem("empty_menu_banner_dismissed_" + user.id) === "true";
                    const isMenuEmpty = !menuData || menuData.length === 0;
                    setShowEmptyMenuBanner(isMenuEmpty && !dismissed);
                } else {
                    setIsAdminLinkedVendor(false);
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
                }
                console.log("[debug] checkpoint 3 - before setOnboardingChecked");
                console.log("[debug] setting onboardingChecked to true");
                setOnboardingChecked(true);
            } else {
                const meta = user.user_metadata || {};
                const pendingName = meta.pending_business_name;
                const pendingPhone = meta.pending_business_phone;
                if (pendingName && pendingPhone) {
                    const { error: insErr } = await supabase.from("businesses").insert([{
                        name: String(pendingName).trim(),
                        phone: String(pendingPhone).trim(),
                        user_id: user.id,
                        status: "pending",
                    }]);
                    if (!insErr) {
                        await supabase.auth.updateUser({
                            data: { pending_business_name: null, pending_business_phone: null },
                        });
                        const { data: data2 } = await supabase.from("businesses").select("*").eq("user_id", user.id).limit(1);
                        if (data2 && data2.length > 0) {
                            const biz = data2[0];
                            const name = biz.name;
                            setBusinessName(name);
                            businessNameRef.current = name;
                            const { data: menuData } = await supabase.from("menus").select("*").eq("business_name", name).order("created_at", { ascending: false });
                            if (menuData) setMenuItems(menuData);
                            const { data: sd } = await supabase
                                .from("business_settings")
                                .select("*")
                                .eq("business_name", name)
                                .maybeSingle();
                            if (sd) {
                                setSettings(prev => ({
                                    ...prev,
                                    auto_accept: !!sd.auto_accept,
                                    is_open: sd.is_open ?? true,
                                    open_time: sd.opening_time || prev.open_time,
                                    close_time: sd.closing_time || prev.close_time,
                                }));
                            }
                            const done = localStorage.getItem("onboarding_done_" + user.id) === "true";
                            if (done) {
                                setOnboardingDone(true);
                            } else {
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
                            return;
                        }
                    }
                }
                setBusinessName("");
                businessNameRef.current = "";
                setIsAdminLinkedVendor(false);
                setShowEmptyMenuBanner(false);
                setNeedsVendorProfile(true);
                setOnboardingDone(true);
                setOnboardingChecked(true);
            }
        } catch (e) {
            console.error("[fetchBusinessName] crashed:", e);
            setOnboardingChecked(true);
            setNeedsVendorProfile(true);
        }
    }

    useEffect(() => {
        if (!isAdminLinkedVendor) {
            setShowEmptyMenuBanner(false);
            return;
        }
        if (menuItems.length > 0) {
            setShowEmptyMenuBanner(false);
        }
    }, [isAdminLinkedVendor, menuItems]);

    useEffect(() => {
        if (!showUploadMenuModal || !uploadMenuFile) {
            setUploadImagePreviewUrl(null);
            return;
        }
        if (!uploadMenuFile.type.startsWith("image/")) {
            setUploadImagePreviewUrl(null);
            return;
        }
        const u = URL.createObjectURL(uploadMenuFile);
        setUploadImagePreviewUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [showUploadMenuModal, uploadMenuFile]);

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

    const MENU_UPLOAD_MIMES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

    function closeUploadMenuModal() {
        setShowUploadMenuModal(false);
        setUploadMenuFile(null);
        setUploadExtracted([]);
        setUploadMenuError("");
        setUploadExtractLoading(false);
        setUploadSaveLoading(false);
        setUploadMenuDragActive(false);
        if (menuFileInputRef.current) menuFileInputRef.current.value = "";
    }

    function pickUploadMenuFile(file) {
        if (!file) return;
        setUploadMenuError("");
        setUploadExtracted([]);
        if (!MENU_UPLOAD_MIMES.includes(file.type)) {
            setUploadMenuError("Please use JPG, PNG, WEBP, or PDF.");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setUploadMenuError("File must be 10MB or smaller.");
            return;
        }
        setUploadMenuFile(file);
    }

    async function extractMenuFromUpload() {
        if (!uploadMenuFile) {
            setUploadMenuError("Choose a menu image or PDF first.");
            return;
        }
        setUploadExtractLoading(true);
        setUploadMenuError("");
        try {
            const fd = new FormData();
            fd.append("menuFile", uploadMenuFile);
            const response = await fetch(API + "/api/menu/extract", { method: "POST", body: fd });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Extraction failed");
            const items = data.items; // already an array, do NOT JSON.parse this
            if (!Array.isArray(items) || items.length === 0) throw new Error("No menu items found. Try a clearer scan.");
            setUploadExtracted(items.map((it, i) => ({
                ...it,
                rowKey: "ex-" + i + "-" + String(it?.name ?? "").slice(0, 24)
            })));
        } catch (e) {
            setUploadMenuError(String(e.message || e));
        } finally {
            setUploadExtractLoading(false);
        }
    }

    async function saveExtractedMenuItems() {
        const vendor = businessNameRef.current || businessName;
        if (!vendor) {
            addNotif("Could not resolve your business.", "error");
            return;
        }
        const valid = uploadExtracted.filter(r => String(r.name ?? "").trim());
        if (valid.length === 0) {
            addNotif("Add at least one row with an item name before saving.", "error");
            return;
        }
        setUploadSaveLoading(true);
        try {
            const payload = valid.map(r => ({
                business_name: vendor,
                item_name: String(r.name).trim(),
                item_price: typeof r.price === "number" && Number.isFinite(r.price) ? r.price : parseFloat(String(r.price)) || 0,
                item_description: String(r.description ?? "").trim(),
                category: String(r.category ?? "").trim() || "Main",
                available: true
            }));
            const { error } = await supabase.from("menus").insert(payload);
            if (error) throw new Error(error.message);
            addNotif("Saved " + payload.length + " item(s) to your menu.", "success");
            closeUploadMenuModal();
            await fetchMenuItems();
        } catch (e) {
            addNotif(String(e.message || e), "error");
        } finally {
            setUploadSaveLoading(false);
        }
    }

    function patchUploadExtractedRow(idx, patch) {
        setUploadExtracted(prev => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
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
            const notifyUrl = API + "/whatsapp/notify";
            const resp = await fetch(notifyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerPhone, orderId: id, status, deliveryType })
            });
            if (!resp.ok) {
                const body = await resp.text().catch(() => "");
                console.log("Notify HTTP error:", resp.status, body);
                let errDetail = body;
                try {
                    const json = JSON.parse(body);
                    errDetail = json?.error || json?.message || errDetail;
                } catch { /* response not JSON */ }
                throw new Error("WhatsApp notify failed: HTTP " + resp.status + (errDetail ? (" - " + errDetail) : ""));
            }
            addNotif(msgs[status] || "Order updated", "success");
        } catch (e) {
            console.log("Notify failed:", e?.message || e);
            addNotif(e?.message ? ("Notify failed: " + e.message) : "Notify failed", "error");
            fetchOrders();
        }
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
        const name = businessNameRef.current || businessName;
        if (!supabase || !name) return;
        try {
            const payload = {
                business_name: name,
                opening_time: settings.open_time,
                closing_time: settings.close_time,
                is_open: settings.is_open,
                auto_accept: settings.auto_accept,
            };
            const { error } = await supabase
                .from("business_settings")
                .upsert(payload, { onConflict: "business_name" })
                .select("*");
            if (error) throw error;
            setSettings(prev => ({ ...prev }));
            setSettingsSaved(true);
            setTimeout(() => setSettingsSaved(false), 3000);
            addNotif("Settings saved", "success");
        } catch (e) {
            console.error("Failed to save settings:", e?.message || e);
            alert("Failed to save settings: " + (e?.message || "Unknown error"));
        }
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

    async function handleLogout() {
        const uid = user?.id;
        await supabase.auth.signOut();
        clearVendorPersistedLocalStorage(uid);
        setUser(null);
        setBusinessName("");
        businessNameRef.current = "";
        fetchedBusinessNameForUserRef.current = null;
        checkedAccountStatusForUserRef.current = null;
        setOnboardingChecked(false);
    }

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

    if (!user && page === "signup") return <Signup onSignup={(opts) => {
        if (opts?.kind === "verify_email") {
            const msg = `We sent a confirmation link to ${opts.email || "your email"}. Open it to verify your account, then sign in. Your vendor application will be created on first login and will await admin approval.`;
            setAuthNotice(msg);
            setAccountStatus({ type: "verify_email", message: msg });
            setPage("login");
            return;
        }
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
                    Delivagh<span style={{ color: "#22c55e" }}>.</span>
                </div>
                <p style={{ margin: "0 0 16px", fontSize: "12px", color: "rgba(236,253,243,0.55)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Account Status</p>
                <h2 style={{ margin: "0 0 10px", fontSize: "24px", color: "#ecfdf3", fontFamily: "'Playfair Display', serif" }}>
                    {accountStatus.type === "verify_email" ? "Confirm your email" : accountStatus.type === "pending" ? "Approval Pending" : accountStatus.type === "rejected" ? "Application Rejected" : "Account Suspended"}
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
                        style={{ flex: 1, padding: "12px", backgroundColor: "#22c55e", border: "none", borderRadius: "10px", color: "white", fontWeight: "700", cursor: "pointer" }}
                    >
                        Use Different Account
                    </button>
                </div>
            </div>
        </div>
    );
    if (!user) return <Login notice={authNotice} onLogin={u => { setAuthNotice(""); setUser(u); }} onSignup={() => { setAuthNotice(""); setPage("signup"); }} />;

    console.log("[render] state:", {
        user: !!user,
        authLoading,
        onboardingChecked,
        onboardingDone,
        businessName,
        needsVendorProfile,
        page,
        accountStatus: !!accountStatus
    });
    // Avoid flashing dashboard before onboarding decision finishes.
    if (user && !onboardingChecked) return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: d.bg }}>
            <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: "800", color: d.text, fontFamily: "'Playfair Display', serif" }}>Delivagh<span style={{ color: accent }}>.</span></div>
                <p style={{ color: d.muted, marginTop: "8px", fontSize: "13px" }}>Preparing your workspace...</p>
            </div>
        </div>
    );

    if (user && needsVendorProfile) {
        return (
            <CompleteVendorProfile
                user={user}
                onRegistered={() => {
                    const msg = "Account created. Wait for admin approval before first login.";
                    setAuthNotice(msg);
                    setAccountStatus({ type: "pending", message: msg });
                    setNeedsVendorProfile(false);
                    if (supabase) {
                        supabase.auth.signOut().finally(() => {
                            setUser(null);
                            setBusinessName("");
                            businessNameRef.current = "";
                            setOnboardingChecked(false);
                        });
                    }
                }}
            />
        );
    }

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

    const orderTabs = [
        { id: "all", label: "All" },
        { id: "pending", label: "Pending" },
        { id: "confirmed", label: "Confirmed" },
        { id: "preparing", label: "Preparing" },
        { id: "ready", label: "Ready" },
        { id: "delivered", label: "Delivered" },
        { id: "rejected", label: "Rejected" },
    ];

    const menuCategories = [...new Set(menuItems.map(m => m.category).filter(Boolean))];

    const cardShadow = dm ? "0 8px 24px rgba(0,0,0,0.35)" : "0 8px 24px rgba(5,46,22,0.06)";

    return (
        <ErrorBoundary>
            <>
                <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />
                <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", display: "flex", background: d.bg, color: d.text }}>
                    <aside style={{
                        width: sidebarW,
                        flexShrink: 0,
                        transition: "width 0.2s ease",
                        borderRight: `1px solid ${d.border}`,
                        background: d.bg2,
                        display: "flex",
                        flexDirection: "column",
                        padding: "12px 10px",
                    }}>
                        <div style={{ padding: "8px 6px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ fontSize: sidebarCollapsed ? "14px" : "18px", fontWeight: "800", fontFamily: "'Playfair Display', serif", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {sidebarCollapsed ? "D." : <>Delivagh<span style={{ color: accent }}>.</span></>}
                            </div>
                            <button type="button" onClick={() => setSidebarCollapsed(c => !c)} title={sidebarCollapsed ? "Expand" : "Collapse"}
                                style={{ background: accentSoft, border: `1px solid ${accentBorder}`, color: accent, borderRadius: "8px", padding: "4px 8px", cursor: "pointer", fontSize: "12px", flexShrink: 0 }}>
                                {sidebarCollapsed ? "›" : "‹"}
                            </button>
                        </div>
                        <nav style={{ flex: 1 }}>
                            {navItems.map(item => {
                                const active = activePage === item.id;
                                return (
                                    <button key={item.id} type="button" onClick={() => setActivePage(item.id)}
                                        style={{
                                            width: "100%",
                                            marginBottom: "4px",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: sidebarCollapsed ? "0" : "10px",
                                            justifyContent: sidebarCollapsed ? "center" : "flex-start",
                                            padding: "10px 10px",
                                            borderRadius: "10px",
                                            border: "none",
                                            cursor: "pointer",
                                            fontWeight: active ? "700" : "600",
                                            fontSize: "13px",
                                            color: active ? accent : d.muted,
                                            background: active ? accentSoft : "transparent",
                                            boxShadow: active ? `inset 0 0 0 1px ${accentBorder}` : "none",
                                            transition: "background 0.15s",
                                        }}>
                                        <span style={{ display: "flex", opacity: active ? 1 : 0.85 }}>{item.icon}</span>
                                        {!sidebarCollapsed && <>
                                            <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
                                            {typeof item.badge === "number" && item.badge > 0 && (
                                                <span style={{ fontSize: "11px", background: dm ? accent : "#bbf7d0", color: dm ? accent : "#14532d", padding: "2px 7px", borderRadius: "999px", fontWeight: "700" }}>
                                                    {item.badge}
                                                </span>
                                            )}
                                        </>}
                                    </button>
                                );
                            })}
                        </nav>
                        <button type="button" onClick={handleLogout}
                            style={{ marginTop: "8px", width: "100%", padding: "10px", borderRadius: "10px", border: `1px solid ${d.border}`, background: dm ? "rgba(239,68,68,0.12)" : "#fef2f2", color: "#fecaca", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}>
                            {!sidebarCollapsed ? "Log out" : "⇥"}
                        </button>
                    </aside>

                    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <header style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "14px 20px",
                            borderBottom: `1px solid ${d.border}`,
                            background: d.bg3,
                            flexShrink: 0,
                        }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: "11px", color: d.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{businessName || "Vendor"}</p>
                                <h1 style={{ margin: "4px 0 0", fontSize: "20px", fontWeight: "800", fontFamily: "'Playfair Display', serif" }}>
                                    {activePage === "overview" && "Overview"}
                                    {activePage === "pending" && "Orders"}
                                    {activePage === "customers" && "Customers"}
                                    {activePage === "menu" && "Menu"}
                                    {activePage === "insights" && "Insights"}
                                    {activePage === "settings" && "Settings"}
                                </h1>
                            </div>
                            {newOrderAlert && (
                                <div style={{ animation: "none", padding: "8px 12px", borderRadius: "10px", background: dm ? "rgba(34,197,94,0.15)" : "#dcfce7", border: `1px solid ${accentBorder}`, color: accent, fontSize: "12px", fontWeight: "700" }}>
                                    New order
                                    <button type="button" onClick={() => setNewOrderAlert(false)} style={{ marginLeft: "8px", background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: "800" }}>×</button>
                                </div>
                            )}
                            <button type="button" title="Notifications" onClick={() => setShowNotifPanel(v => !v)}
                                style={{
                                    position: "relative",
                                    background: dm ? accentSoft : accentSoft,
                                    border: `1px solid ${accentBorder}`,
                                    color: d.text,
                                    borderRadius: "10px",
                                    padding: "8px 12px",
                                    cursor: "pointer",
                                    fontWeight: "700",
                                    fontSize: "13px",
                                }}>
                                🔔 {!sidebarCollapsed ? `(${unreadNotifs})` : ""}
                            </button>
                            <button type="button" onClick={toggleDark} style={{
                                padding: "8px 12px",
                                borderRadius: "10px",
                                border: `1px solid ${d.border}`,
                                background: d.hover,
                                color: d.text,
                                fontWeight: "600",
                                fontSize: "12px",
                                cursor: "pointer",
                            }}>
                                {darkMode ? "☀️ Light" : "🌙 Dark"}
                            </button>
                            {activePage === "pending" && (
                                <button type="button" onClick={() => void fetchOrders()} style={{
                                    background: accent,
                                    border: "none",
                                    borderRadius: "10px",
                                    color: dm ? "#080f0a" : "white",
                                    padding: "8px 14px",
                                    fontWeight: "700",
                                    fontSize: "12px",
                                    cursor: "pointer",
                                }}>
                                    Refresh orders
                                </button>
                            )}
                        </header>

                        {showEmptyMenuBanner && (
                            <div style={{
                                margin: "12px 20px 0",
                                padding: "12px 16px",
                                borderRadius: "12px",
                                background: dm ? accentSoft : "#ecfdf5",
                                border: `1px solid ${accentBorder}`,
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: "12px",
                            }}>
                                <span style={{ fontSize: "13px", fontWeight: "600", color: d.text, flex: 1 }}>
                                    Your menu is empty — add dishes so customers can order.
                                </span>
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <button type="button" onClick={() => setShowUploadMenuModal(true)} style={{
                                        background: accent,
                                        border: "none",
                                        color: dm ? "#080f0a" : "white",
                                        fontWeight: "700",
                                        padding: "8px 14px",
                                        borderRadius: "10px",
                                        cursor: "pointer",
                                        fontSize: "12px",
                                    }}>
                                        Upload menu
                                    </button>
                                    <button type="button" onClick={() => setShowAddModal(true)} style={{
                                        border: `1px solid ${d.border}`,
                                        background: d.card,
                                        color: d.text,
                                        padding: "8px 14px",
                                        borderRadius: "10px",
                                        cursor: "pointer",
                                        fontWeight: "600",
                                        fontSize: "12px",
                                    }}>
                                        Add item
                                    </button>
                                    <button type="button"
                                        onClick={() => {
                                            try { localStorage.setItem("empty_menu_banner_dismissed_" + user.id, "true"); } catch (_) { /* ignore */ }
                                            setShowEmptyMenuBanner(false);
                                        }}
                                        style={{ border: "none", background: "transparent", color: d.muted, fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}>
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        )}

                        <main style={{ flex: 1, padding: "20px", overflowY: "auto" }}>
                            {activePage === "overview" && (
                                <div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "14px", marginBottom: "20px" }}>
                                        {[
                                            ["Total orders", stats.total],
                                            ["Pending", stats.pending],
                                            ["Confirmed", stats.confirmed],
                                            ["Delivered", stats.delivered],
                                            ["Revenue (paid)", `GHS ${stats.revenue.toFixed(2)}`],
                                            ["Unpaid pipeline", `GHS ${stats.unpaidRevenue.toFixed(2)}`],
                                        ].map(([l, v]) => (
                                            <div key={l} style={{
                                                padding: "16px",
                                                borderRadius: "14px",
                                                border: `1px solid ${d.border}`,
                                                background: d.card,
                                                boxShadow: cardShadow,
                                            }}>
                                                <div style={{ fontSize: "11px", color: d.muted, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
                                                <div style={{ fontSize: "22px", fontWeight: "800", color: d.text }}>{v}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                                        <div style={{ padding: "20px", borderRadius: "14px", background: dm ? accentSoft : "#ecfdf5", border: `1px solid ${accentBorder}`, boxShadow: cardShadow }}>
                                            <div style={{ fontWeight: "700", color: d.text, marginBottom: "12px", fontSize: "14px" }}>Today</div>
                                            <div style={{ fontSize: "32px", fontWeight: "800", color: accent }}>{todayOrders.length}<span style={{ fontSize: "14px", color: d.muted, fontWeight: "600", marginLeft: "8px" }}>orders</span></div>
                                            <div style={{ marginTop: "12px", color: d.muted, fontSize: "13px" }}>
                                                Paid today: <span style={{ fontWeight: "700", color: accent }}>GHS {todayRevenue.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div style={{ padding: "20px", borderRadius: "14px", border: `1px solid ${d.border}`, background: d.card, boxShadow: cardShadow }}>
                                            <div style={{ fontWeight: "700", marginBottom: "12px", fontSize: "14px" }}>Recent orders</div>
                                            {(orders.slice(0, 5)).length === 0 ? (
                                                <div style={{ color: d.muted, fontSize: "13px" }}>No orders yet.</div>
                                            ) : orders.slice(0, 5).map(o => (
                                                <button key={o.id} type="button" onClick={() => { setSelectedOrder(o); setActivePage("pending"); }}
                                                    style={{ width: "100%", textAlign: "left", display: "flex", gap: "10px", padding: "8px 0", borderTop: `1px solid ${d.border}`, borderLeft: "none", borderRight: "none", borderBottom: "none", background: "none", cursor: "pointer", color: "inherit" }}>
                                                    <StatusBadge status={o.status} />
                                                    <span style={{ fontSize: "12px", color: d.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{o.items}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activePage === "pending" && (
                                <div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                                        {orderTabs.map(t => {
                                            const on = activeTab === t.id;
                                            return (
                                                <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
                                                    style={{
                                                        padding: "8px 14px",
                                                        borderRadius: "999px",
                                                        border: on ? `1px solid ${accentBorder}` : `1px solid ${d.border}`,
                                                        background: on ? accentSoft : "transparent",
                                                        color: on ? accent : d.muted,
                                                        fontWeight: on ? "700" : "600",
                                                        cursor: "pointer",
                                                        fontSize: "12px",
                                                    }}>
                                                    {t.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div style={{ borderRadius: "14px", border: `1px solid ${d.border}`, overflow: "hidden", background: d.card, boxShadow: cardShadow }}>
                                        {loading ? (
                                            <div style={{ padding: "48px", textAlign: "center", color: d.muted }}>Loading orders…</div>
                                        ) : filteredOrders.length === 0 ? (
                                            <div style={{ padding: "48px", textAlign: "center", color: d.muted }}>No orders in this tab.</div>
                                        ) : (
                                            <div style={{ overflowX: "auto" }}>
                                                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "960px" }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: `1px solid ${d.border}`, background: d.bg3 }}>
                                                            {["Summary", "Customer", "Delivery", "Total", "Status", "Payment", "Actions"].map(h => (
                                                                <th key={h} style={{ textAlign: "left", padding: "12px 14px", fontSize: "10px", textTransform: "uppercase", color: d.muted, letterSpacing: "0.06em", fontWeight: "700" }}>{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredOrders.map((o, i) => (
                                                            <tr key={o.id} onClick={() => setSelectedOrder(o)}
                                                                style={{ borderBottom: `1px solid ${d.border}`, background: i % 2 === 0 ? "transparent" : d.hover, cursor: "pointer" }}>
                                                                <td style={{ padding: "12px 14px", maxWidth: "200px", fontSize: "13px" }}>
                                                                    <span style={{ fontFamily: "monospace", fontSize: "11px", background: dm ? accentSoft : "#f0fdf4", padding: "2px 8px", borderRadius: "6px" }}>#{(String(o.id || "").substring(0, 8)).toUpperCase()}</span>
                                                                    <div style={{ marginTop: "6px", color: d.muted, fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(o.items || "").slice(0, 96)}{String(o.items || "").length > 96 ? "…" : ""}</div>
                                                                </td>
                                                                <td style={{ padding: "12px 14px", fontSize: "13px" }}>{formatCallDisplay(o)}</td>
                                                                <td style={{ padding: "12px 14px", fontSize: "12px", textTransform: "capitalize", color: d.muted }}>
                                                                    {String(o.delivery_type || "").replace("-", " ") || "—"}
                                                                    {o.delivery_address ? <><br /><span style={{ fontSize: "11px" }}>{String(o.delivery_address).slice(0, 60)}</span></> : null}
                                                                </td>
                                                                <td style={{ padding: "12px 14px", fontWeight: "700" }}>GHS {parseFloat(o.total_amount) || 0}</td>
                                                                <td style={{ padding: "12px 14px" }}><StatusBadge status={o.status} /></td>
                                                                <td style={{ padding: "12px 14px" }} onClick={e => e.stopPropagation()}><PaymentBadge status={o.payment_status} paymentMethod={o.payment_method} orderId={o.id} showMarkPaid={o.status !== "pending" && o.status !== "rejected"} /></td>
                                                                <td style={{ padding: "12px 14px" }} onClick={e => e.stopPropagation()}>{getNextAction(o.id)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activePage === "customers" && (
                                <div style={{ borderRadius: "14px", border: `1px solid ${d.border}`, background: d.card, boxShadow: cardShadow, overflow: "hidden" }}>
                                    {customers.length === 0 ? (
                                        <div style={{ padding: "48px", textAlign: "center", color: d.muted }}>No customers yet.</div>
                                    ) : (
                                        customers.map((c, i) => (
                                            <button key={c.phone} type="button" onClick={() => setSelectedCustomer(c)}
                                                style={{
                                                    width: "100%",
                                                    padding: "14px 18px",
                                                    border: "none",
                                                    borderBottom: i === customers.length - 1 ? "none" : `1px solid ${d.border}`,
                                                    background: selectedCustomer?.phone === c.phone ? accentSoft : "transparent",
                                                    cursor: "pointer",
                                                    textAlign: "left",
                                                    display: "grid",
                                                    gridTemplateColumns: "1fr repeat(4, minmax(80px, 1fr))",
                                                    gap: "10px",
                                                    alignItems: "center",
                                                    color: "inherit",
                                                }}>
                                                <div>
                                                    <div style={{ fontWeight: "700", fontFamily: "monospace" }}>{c.phone}</div>
                                                    <div style={{ fontSize: "11px", color: d.muted }}>{new Date(c.lastOrderAt).toLocaleString()}</div>
                                                </div>
                                                <div style={{ fontSize: "13px", color: d.text }}>{c.orders} orders</div>
                                                <div style={{ fontSize: "13px" }}>{c.pending} pending</div>
                                                <div style={{ fontSize: "13px" }}>{c.delivered} done</div>
                                                <div style={{ fontWeight: "700", color: accent }}>GHS {c.revenue.toFixed(2)}</div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {activePage === "menu" && (
                                <div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
                                        <select value={menuFilter} onChange={e => setMenuFilter(e.target.value)} style={inp({ maxWidth: "200px", width: "auto" })}>
                                            <option value="All">All categories</option>
                                            {menuCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                        <button type="button" onClick={() => setShowAddModal(true)} style={{ padding: "10px 18px", borderRadius: "10px", background: accent, border: "none", color: dm ? "#080f0a" : "white", fontWeight: "700", cursor: "pointer" }}>
                                            Add item
                                        </button>
                                        <button type="button" onClick={() => setShowUploadMenuModal(true)} style={{ padding: "10px 18px", borderRadius: "10px", border: `1px solid ${accentBorder}`, background: accentSoft, color: d.text, fontWeight: "700", cursor: "pointer" }}>
                                            Scan / upload menu
                                        </button>
                                        <button type="button" onClick={() => void fetchMenuItems()} style={{ padding: "10px 16px", borderRadius: "10px", border: `1px solid ${d.border}`, background: d.hover, color: d.text, fontWeight: "600", cursor: "pointer" }}>
                                            Refresh
                                        </button>
                                    </div>
                                    <div style={{ borderRadius: "14px", border: `1px solid ${d.border}`, overflow: "hidden", background: d.card, boxShadow: cardShadow }}>
                                        {filteredMenu.length === 0 ? (
                                            <div style={{ padding: "48px", textAlign: "center", color: d.muted }}>No menu items — add dishes or scan a menu image.</div>
                                        ) : (
                                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                                <thead style={{ borderBottom: `1px solid ${d.border}`, background: d.bg3 }}>
                                                    <tr>{["Item", "Price", "Category", "Description", "Status", ""].map(h => (
                                                        <th key={h} style={{ textAlign: "left", padding: "12px 14px", fontSize: "10px", textTransform: "uppercase", color: d.muted, letterSpacing: "0.06em", fontWeight: "700" }}>{h}</th>
                                                    ))}</tr>
                                                </thead>
                                                <tbody>
                                                    {filteredMenu.map((item, i) => (
                                                        <tr key={item.id} style={{ borderBottom: `1px solid ${d.border}`, background: i % 2 ? d.hover : "transparent" }}>
                                                            <td style={{ padding: "12px 14px", fontWeight: "700", fontSize: "13px" }}>{item.item_name}</td>
                                                            <td style={{ padding: "12px 14px", color: accent, fontWeight: "800" }}>GHS {item.item_price}</td>
                                                            <td style={{ padding: "12px 14px", color: d.muted, fontSize: "13px" }}>{item.category || "Main"}</td>
                                                            <td style={{ padding: "12px 14px", color: d.muted, fontSize: "12px", maxWidth: "220px" }}>{item.item_description || "—"}</td>
                                                            <td style={{ padding: "12px 14px" }}>
                                                                <span style={{ padding: "3px 10px", borderRadius: "999px", fontWeight: "700", fontSize: "11px", background: item.available ? accentSoft : "rgba(248,113,113,0.15)", border: item.available ? `1px solid ${accentBorder}` : "1px solid rgba(239,68,68,0.35)", color: item.available ? accent : "#fecaca" }}>{item.available ? "Listed" : "Hidden"}</span>
                                                            </td>
                                                            <td style={{ padding: "12px 14px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                                <button type="button" onClick={() => toggleAvailable(item.id, item.available)}
                                                                    style={{ fontSize: "11px", fontWeight: "700", borderRadius: "8px", border: `1px solid ${d.border}`, background: d.bg2, cursor: "pointer", padding: "6px 10px", color: d.text }}>
                                                                    {item.available ? "Hide" : "Show"}
                                                                </button>
                                                                <button type="button" onClick={() => { setEditItem({ ...item }); setShowEditModal(true); }}
                                                                    style={{ fontSize: "11px", fontWeight: "700", borderRadius: "8px", border: `1px solid ${accentBorder}`, background: accentSoft, cursor: "pointer", padding: "6px 10px", color: d.text }}>
                                                                    Edit
                                                                </button>
                                                                <button type="button" onClick={() => void deleteMenuItem(item.id)}
                                                                    style={{ fontSize: "11px", fontWeight: "700", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.35)", background: dm ? "rgba(239,68,68,0.12)" : "#fef2f2", cursor: "pointer", padding: "6px 10px", color: "#fecaca" }}>
                                                                    Delete
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activePage === "insights" && (
                                <div style={{ display: "grid", gap: "16px" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                                        {[
                                            ["Unique customers", insights.totalCustomers],
                                            ["Avg order value", `GHS ${Number(insights.avgOrderValue || 0).toFixed(2)}`],
                                            ["Avg rating", `${Number(insights.avgRating || 0).toFixed(2)}★ (${insights.ratingsCount})`],
                                        ].map(([l, v]) => (
                                            <div key={l} style={{ borderRadius: "14px", border: `1px solid ${d.border}`, background: d.card, padding: "18px", boxShadow: cardShadow }}>
                                                <div style={{ fontSize: "11px", color: d.muted, marginBottom: "8px", textTransform: "uppercase" }}>{l}</div>
                                                <div style={{ fontWeight: "800", fontSize: "20px", color: d.text }}>{v}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ borderRadius: "14px", border: `1px solid ${d.border}`, padding: "20px", background: d.card }}>
                                        <h3 style={{ margin: "0 0 12px", fontSize: "14px", color: d.text }}>Top items</h3>
                                        {(insights.topItems || []).length === 0 ? <div style={{ color: d.muted, fontSize: "13px" }}>Not enough orders to rank items.</div> : insights.topItems.map((it, i) => (
                                            <div key={it.name || i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${d.border}` }}>
                                                <span style={{ fontWeight: "700" }}>{it.name}</span>
                                                <span style={{ fontWeight: "800", color: accent }}>{it.count} sold</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activePage === "settings" && (
                                <div style={{ display: "grid", gap: "20px", maxWidth: "720px" }}>
                                    <div style={{ borderRadius: "14px", border: `1px solid ${d.border}`, padding: "20px", background: d.card }}>
                                        <h3 style={{ margin: "0 0 14px", fontSize: "15px" }}>Hours & storefront</h3>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                            <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", fontWeight: "600", color: d.muted }}>
                                                Open time
                                                <input type="time" value={settings.open_time}
                                                    onChange={e => setSettings(s => ({ ...s, open_time: e.target.value }))} style={inp()} />
                                            </label>
                                            <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", fontWeight: "600", color: d.muted }}>
                                                Close time
                                                <input type="time" value={settings.close_time}
                                                    onChange={e => setSettings(s => ({ ...s, close_time: e.target.value }))} style={inp()} />
                                            </label>
                                            <label style={{ display: "flex", alignItems: "center", gap: "12px", fontWeight: "600", fontSize: "13px" }}>
                                                <input type="checkbox" checked={settings.is_open} onChange={e => setSettings(s => ({ ...s, is_open: e.target.checked }))} />
                                                Restaurant is open now
                                            </label>
                                            <label style={{ display: "flex", alignItems: "center", gap: "12px", fontWeight: "600", fontSize: "13px" }}>
                                                <input type="checkbox" checked={settings.auto_accept} onChange={e => setSettings(s => ({ ...s, auto_accept: e.target.checked }))} />
                                                Auto-accept new orders (when feasible)
                                            </label>
                                        </div>
                                        <button type="button" onClick={() => void saveSettings()} style={{ marginTop: "16px", padding: "10px 20px", borderRadius: "10px", background: accent, border: "none", color: dm ? "#080f0a" : "white", fontWeight: "800", cursor: "pointer" }}>
                                            Save settings {settingsSaved ? "✓" : ""}
                                        </button>
                                    </div>
                                    <div style={{ borderRadius: "14px", border: `1px solid ${d.border}`, padding: "20px", background: d.card }}>
                                        <h3 style={{ margin: "0 0 14px", fontSize: "15px" }}>Broadcast to WhatsApp subscribers</h3>
                                        <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Type a short update for your loyal customers..."
                                            style={{ ...inp({ height: "100px", resize: "vertical" }) }} />
                                        <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                                            <button type="button" disabled={broadcastSending || !broadcastMsg.trim()} onClick={() => void sendBroadcast()}
                                                style={{ padding: "10px 18px", borderRadius: "10px", background: accent, border: "none", fontWeight: "800", opacity: broadcastSending ? 0.6 : 1, cursor: "pointer", color: dm ? "#080f0a" : "white" }}>
                                                {broadcastSending ? "Sending…" : "Send broadcast"}
                                            </button>
                                            {broadcastResult && (
                                                <span style={{ fontSize: "12px", color: broadcastResult.success ? accent : "#fecaca", alignSelf: "center", fontWeight: "600" }}>
                                                    {broadcastResult.success ? ("Sent to " + (broadcastResult.count ?? broadcastResult.sent ?? "customers")) : ("Error: " + (broadcastResult.error || "failed"))}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </main>
                    </div>

                    {/* Order detail */}
                    {selectedOrder && (
                        <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50 }} onMouseDown={() => setSelectedOrder(null)}>
                            <div role="dialog" onMouseDown={e => e.stopPropagation()}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    right: 0,
                                    bottom: 0,
                                    width: "min(460px, 100vw)",
                                    background: d.bg2,
                                    borderLeft: `1px solid ${d.border}`,
                                    padding: "20px",
                                    overflowY: "auto",
                                    boxShadow: "-8px 0 32px rgba(0,0,0,0.25)",
                                    color: d.text,
                                }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                                    <div>
                                        <p style={{ margin: 0, fontFamily: "monospace", fontSize: "13px", color: d.muted }}>#{String(selectedOrder.id).substring(0, 8)}</p>
                                        <StatusBadge status={selectedOrder.status} />
                                    </div>
                                    <button type="button" onClick={() => setSelectedOrder(null)} style={{
                                        border: `1px solid ${d.border}`, background: "none", cursor: "pointer", fontSize: "18px",
                                        padding: "2px 10px", borderRadius: "10px", color: d.muted }}>
                                        ×
                                    </button>
                                </div>
                                <p style={{ color: d.muted, fontSize: "13px", marginBottom: "8px" }}>Customer</p>
                                <div style={{ fontWeight: "800", marginBottom: "16px", fontFamily: "monospace" }}>{formatCallDisplay(selectedOrder)}</div>
                                <p style={{ color: d.muted, fontSize: "13px", marginBottom: "8px" }}>Delivery</p>
                                <div style={{ marginBottom: "16px", fontSize: "13px", textTransform: "capitalize" }}>
                                    {(selectedOrder.delivery_type || "").replace("-", " ") || "—"}
                                    <div style={{ marginTop: "6px", color: d.text }}>{selectedOrder.delivery_address || "—"}</div>
                                </div>
                                <p style={{ color: d.muted, fontSize: "13px", marginBottom: "8px" }}>Items</p>
                                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "'DM Sans', sans-serif", fontSize: "13px", background: dm ? d.hover : "#f9fafb", padding: "12px", borderRadius: "12px", border: `1px solid ${d.border}`, marginBottom: "16px" }}>{selectedOrder.items || "—"}</pre>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", fontWeight: "800", fontSize: "16px" }}>
                                    Total
                                    <span style={{ color: accent }}>GHS {parseFloat(selectedOrder.total_amount) || 0}</span>
                                </div>
                                <PaymentBadge status={selectedOrder.payment_status} paymentMethod={selectedOrder.payment_method} orderId={selectedOrder.id}
                                    showMarkPaid={selectedOrder.status !== "pending" && selectedOrder.status !== "rejected"} />
                                <div style={{ marginTop: "20px" }}>
                                    {getNextAction(selectedOrder.id)}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Notifications */}
                    {showNotifPanel && (
                        <div style={{ position: "fixed", top: "64px", right: "24px", zIndex: 40, width: "min(340px, 92vw)", background: d.card, borderRadius: "14px", border: `1px solid ${d.border}`, boxShadow: cardShadow, maxHeight: "70vh", overflow: "hidden" }}>
                            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${d.border}`, fontWeight: "800", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center", background: d.bg3 }}>
                                Notifications
                                <button type="button" onClick={() => setNotifications([])} style={{ border: "none", background: "none", cursor: "pointer", color: d.muted, fontSize: "12px" }}>
                                    Clear all
                                </button>
                            </div>
                            <div style={{ padding: "12px", maxHeight: "58vh", overflowY: "auto" }}>
                                {notifications.length === 0 ? (
                                    <div style={{ color: d.muted, fontSize: "13px", textAlign: "center", padding: "16px 0" }}>No alerts yet.</div>
                                ) : notifications.map(n => (
                                    <div key={n.id} style={{
                                        padding: "10px 12px",
                                        borderRadius: "10px",
                                        marginBottom: "8px",
                                        fontSize: "12px",
                                        borderLeft: `3px solid ${n.type === "error" ? "#f97373" : n.type === "new" ? accent : accentBorder}`,
                                        background: d.hover,
                                        color: d.text,
                                    }}>
                                        <div style={{ fontWeight: "700", marginBottom: "4px", textTransform: "uppercase", fontSize: "10px", color: d.muted }}>{n.type}</div>
                                        {n.message}
                                        <div style={{ fontSize: "10px", color: d.muted, marginTop: "6px" }}>{n.time?.toLocaleString?.() ?? ""}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Customer sidebar */}
                    {selectedCustomer && (
                        <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 45 }} onMouseDown={() => setSelectedCustomer(null)}>
                            <aside onMouseDown={e => e.stopPropagation()} style={{
                                position: "absolute",
                                bottom: 0,
                                left: 0,
                                right: 0,
                                maxHeight: "70vh",
                                background: d.bg2,
                                borderRadius: "20px 20px 0 0",
                                borderTop: `1px solid ${d.border}`,
                                padding: "20px",
                                color: d.text,
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
                                    <strong style={{ fontFamily: "monospace" }}>{selectedCustomer.phone}</strong>
                                    <button type="button" onClick={() => setSelectedCustomer(null)} style={{ border: `1px solid ${d.border}`, background: "transparent", cursor: "pointer", borderRadius: "10px", padding: "4px 10px", color: d.text }}>Close</button>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px" }}>
                                    <div>Orders: <b>{selectedCustomer.orders}</b></div>
                                    <div>Delivered: <b>{selectedCustomer.delivered}</b></div>
                                    <div>Pending: <b>{selectedCustomer.pending}</b></div>
                                    <div>Revenue paid: <b style={{ color: accent }}>GHS {selectedCustomer.revenue.toFixed(2)}</b></div>
                                </div>
                            </aside>
                        </div>
                    )}

                    {/* Add modal */}
                    {showAddModal && (
                        <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }} onMouseDown={() => setShowAddModal(false)}>
                            <div onMouseDown={e => e.stopPropagation()} style={{ width: "100%", maxWidth: "420px", background: d.card, borderRadius: "16px", border: `1px solid ${d.border}`, padding: "24px", color: d.text }}>
                                <h3 style={{ margin: "0 0 14px", fontSize: "16px" }}>New menu item</h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                    <input value={newItem.item_name} placeholder="Name" style={inp()} onChange={e => setNewItem({ ...newItem, item_name: e.target.value })} />
                                    <input type="number" placeholder="Price (GHS)" style={inp()} value={newItem.item_price} onChange={e => setNewItem({ ...newItem, item_price: e.target.value })} />
                                    <select value={newItem.category} style={inp()} onChange={e => setNewItem({ ...newItem, category: e.target.value })}>
                                        <option value="Main">Main</option>
                                        <option value="Sides">Sides</option>
                                        <option value="Extras">Extras</option>
                                        <option value="Drinks">Drinks</option>
                                    </select>
                                    <textarea value={newItem.item_description} placeholder="Description" style={inp({ height: "72px", resize: "vertical" })}
                                        onChange={e => setNewItem({ ...newItem, item_description: e.target.value })} />
                                </div>
                                <div style={{ display: "flex", gap: "10px", marginTop: "18px", justifyContent: "flex-end" }}>
                                    <button type="button" onClick={() => setShowAddModal(false)} style={{ ...inp({ cursor: "pointer", fontWeight: "700", border: `1px solid ${d.border}` }) }}>Cancel</button>
                                    <button type="button" onClick={() => void addMenuItem()} style={{
                                        ...inp({
                                            cursor: "pointer",
                                            fontWeight: "800",
                                            background: accent,
                                            border: `1px solid ${accent}`,
                                            color: dm ? "#080f0a" : "white",
                                        }),
                                        opacity: (!newItem.item_name || !newItem.item_price) ? 0.5 : 1,
                                    }}>
                                        Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Edit modal */}
                    {showEditModal && editItem && (
                        <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }} onMouseDown={() => { setShowEditModal(false); setEditItem(null); }}>
                            <div onMouseDown={e => e.stopPropagation()} style={{ width: "100%", maxWidth: "420px", background: d.card, borderRadius: "16px", border: `1px solid ${d.border}`, padding: "24px", color: d.text }}>
                                <h3 style={{ margin: "0 0 14px", fontSize: "16px" }}>Edit item</h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                    <input value={editItem.item_name} style={inp()} onChange={e => setEditItem({ ...editItem, item_name: e.target.value })} />
                                    <input type="number" value={editItem.item_price} style={inp()} onChange={e => setEditItem({ ...editItem, item_price: e.target.value })} />
                                    <select value={editItem.category} style={inp()} onChange={e => setEditItem({ ...editItem, category: e.target.value })}>
                                        <option value="Main">Main</option>
                                        <option value="Sides">Sides</option>
                                        <option value="Extras">Extras</option>
                                        <option value="Drinks">Drinks</option>
                                    </select>
                                    <textarea value={editItem.item_description || ""} style={inp({ height: "72px", resize: "vertical" })}
                                        onChange={e => setEditItem({ ...editItem, item_description: e.target.value })} />
                                </div>
                                <div style={{ display: "flex", gap: "10px", marginTop: "18px", justifyContent: "flex-end" }}>
                                    <button type="button" onClick={() => { setShowEditModal(false); setEditItem(null); }} style={{ ...inp({ cursor: "pointer", fontWeight: "700" }) }}>Cancel</button>
                                    <button type="button" onClick={() => void saveEditItem()} style={{
                                        ...inp({ cursor: "pointer", fontWeight: "800", background: accent, color: dm ? "#080f0a" : "white", border: `1px solid ${accent}` }),
                                    }}>
                                        Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Upload modal */}
                    {showUploadMenuModal && (
                        <div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 65, padding: "16px", overflowY: "auto" }}
                            onMouseDown={() => { if (!uploadExtractLoading && !uploadSaveLoading) closeUploadMenuModal(); }}>
                            <div onMouseDown={e => e.stopPropagation()}
                                style={{
                                    maxWidth: "720px",
                                    margin: "32px auto",
                                    background: d.card,
                                    borderRadius: "18px",
                                    border: `1px solid ${d.border}`,
                                    padding: "24px",
                                    color: d.text,
                                }}>
                                <h3 style={{ margin: "0 0 14px", fontSize: "17px", fontFamily: "'Playfair Display', serif" }}>Scan menu photo or PDF</h3>
                                <div
                                    onDragOver={e => { e.preventDefault(); setUploadMenuDragActive(true); }}
                                    onDragLeave={() => setUploadMenuDragActive(false)}
                                    onDrop={e => { e.preventDefault(); setUploadMenuDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) pickUploadMenuFile(f); }}
                                    style={{
                                        border: `2px dashed ${uploadMenuDragActive ? accent : d.border}`,
                                        borderRadius: "14px",
                                        padding: "28px",
                                        textAlign: "center",
                                        background: uploadMenuDragActive ? accentSoft : dm ? "rgba(255,255,255,0.02)" : "#f9fafb",
                                        marginBottom: "16px",
                                    }}>
                                    <p style={{ color: d.muted, fontSize: "13px", marginBottom: "10px" }}>Drop JPG, PNG, WEBP, or PDF (max 10MB)</p>
                                    <button type="button" onClick={() => menuFileInputRef.current?.click()} style={{
                                        padding: "10px 18px",
                                        borderRadius: "10px",
                                        border: `1px solid ${accentBorder}`,
                                        background: accentSoft,
                                        fontWeight: "700",
                                        cursor: "pointer",
                                        fontSize: "13px",
                                        color: d.text,
                                    }}>
                                        Browse files
                                    </button>
                                    <input ref={menuFileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/*,application/pdf"
                                        style={{ display: "none" }}
                                        onChange={e => { const f = e.target.files?.[0]; if (f) pickUploadMenuFile(f); }} />
                                    {uploadMenuFile && (
                                        <p style={{ marginTop: "12px", fontSize: "13px", color: accent, fontWeight: "700" }}>{uploadMenuFile.name}</p>
                                    )}
                                    {uploadImagePreviewUrl && <img alt="Preview" src={uploadImagePreviewUrl} style={{ marginTop: "16px", maxHeight: "200px", borderRadius: "10px", border: `1px solid ${d.border}` }} />}
                                </div>
                                {uploadMenuError && <div style={{ color: "#fca5a5", fontWeight: "600", fontSize: "13px", marginBottom: "10px" }}>{uploadMenuError}</div>}
                                <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
                                    <button type="button" disabled={uploadExtractLoading || !uploadMenuFile} onClick={() => void extractMenuFromUpload()}
                                        style={{ padding: "10px 16px", borderRadius: "10px", background: accent, border: "none", fontWeight: "800", color: dm ? "#080f0a" : "white", opacity: uploadExtractLoading ? 0.6 : 1, cursor: "pointer" }}>
                                        {uploadExtractLoading ? "Extracting…" : "Extract items"}
                                    </button>
                                    <button type="button" disabled={uploadSaveLoading} onClick={() => void saveExtractedMenuItems()}
                                        style={{ padding: "10px 16px", borderRadius: "10px", border: `1px solid ${accentBorder}`, background: accentSoft, fontWeight: "800", cursor: "pointer", opacity: uploadSaveLoading ? 0.5 : 1 }}>
                                        Save to menu {uploadExtracted.length ? ("(" + uploadExtracted.length + ")") : ""}
                                    </button>
                                    <button type="button" onClick={() => closeUploadMenuModal()}
                                        style={{ padding: "10px 16px", borderRadius: "10px", border: `1px solid ${d.border}`, background: "transparent", fontWeight: "700", cursor: "pointer" }}>
                                        Cancel
                                    </button>
                                </div>
                                {uploadExtracted.length > 0 && (
                                    <div style={{ maxHeight: "320px", overflowY: "auto", borderRadius: "12px", border: `1px solid ${d.border}` }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                            <thead style={{ borderBottom: `1px solid ${d.border}`, background: d.bg3 }}>
                                                <tr>
                                                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: "11px", color: d.muted }}>Name</th>
                                                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: "11px", color: d.muted }}>Price</th>
                                                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: "11px", color: d.muted }}>Category</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {uploadExtracted.map((row, idx) => (
                                                    <tr key={row.rowKey || idx}>
                                                        <td style={{ padding: "8px" }}><input value={row.name || ""} onChange={e => patchUploadExtractedRow(idx, { name: e.target.value })} style={{ ...inp(), fontSize: "12px" }} /></td>
                                                        <td style={{ padding: "8px" }}><input value={row.price ?? ""} onChange={e => patchUploadExtractedRow(idx, { price: e.target.value })} style={{ ...inp(), fontSize: "12px" }} /></td>
                                                        <td style={{ padding: "8px" }}><input value={row.category || ""} onChange={e => patchUploadExtractedRow(idx, { category: e.target.value })} style={{ ...inp(), fontSize: "12px" }} /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </>
        </ErrorBoundary>
    );
}