import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import { handleAuthError } from "./authUtils";
import Login from "./Login";
import Signup from "./Signup";
import Onboarding from "./Onboarding";
import CompleteVendorProfile from "./CompleteVendorProfile";
import Icon from "./ui/Icon";
import "./ui/dash.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://api.delivagh.app";
const API = BACKEND_URL;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Authorization header for backend calls that require a logged-in vendor.
 * Sends the current Supabase access token so the server can verify identity
 * (via requireVendor middleware). No admin secret is ever used here.
 */
async function vendorAuthHeader() {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

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
        }
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
}

function formatCallDisplay(order) {
    const raw = (order.contact_phone || "").replace(/\D/g, '');
    if (!raw) return null;
    if (raw.startsWith('233')) return '+' + raw;
    if (raw.startsWith('0')) return '+233' + raw.slice(1);
    return '+' + raw;
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
    const [settings, setSettings] = useState({
        auto_accept: false,
        is_open: true,
        open_time: "08:00",
        close_time: "22:00",
        delivery_enabled: true,
        pickup_enabled: true,
        pay_directly_enabled: true,
        pay_online_enabled: true,
        delivery_fee: 0,
    });
    const [botConfig, setBotConfig] = useState({
        bot_name: "",
        bot_greeting: "",
        bot_persona: "",
        bot_special_instructions: "",
    });
    const [botConfigSaved, setBotConfigSaved] = useState(false);
    const [broadcastMsg, setBroadcastMsg] = useState("");
    const [broadcastSending, setBroadcastSending] = useState(false);
    const [broadcastResult, setBroadcastResult] = useState(null);
    const [insights, setInsights] = useState({ topItems: [], totalCustomers: 0, avgOrderValue: 0, avgRating: 0, ratingsCount: 0 });
    const [darkMode, setDarkMode] = useState(() => {
        const stored = localStorage.getItem("delivagh_dark");
        if (stored === null) return false;
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
    const [waLinkCopied, setWaLinkCopied] = useState(false);
    const [newItemImage, setNewItemImage] = useState(null);
    const [editItemImage, setEditItemImage] = useState(null);
    const [profilePicture, setProfilePicture] = useState("");
    const [newProfilePic, setNewProfilePic] = useState(null);
    const [contactNumber, setContactNumber] = useState("");
    const [momoNumber, setMomoNumber] = useState("");
    const [isPasswordResetMode, setIsPasswordResetMode] = useState(false);
    const [resetPassword, setResetPassword] = useState("");
    const [resetConfirmPassword, setResetConfirmPassword] = useState("");
    const [resetPasswordError, setResetPasswordError] = useState("");
    const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
    const [resetPasswordDone, setResetPasswordDone] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);

    const ordersRef = useRef([]);
    const audioCtxRef = useRef(null);
    const businessNameRef = useRef("");
    const notifIdRef = useRef(0);
    const sessionPolicySignOutLockRef = useRef(false);
    const fetchedBusinessNameForUserRef = useRef(null);
    const checkedAccountStatusForUserRef = useRef(null);

    async function uploadImageToStorage(file, path) {
        const { error } = await supabase.storage
            .from('delivagh-media')
            .upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw new Error(error.message);
        const { data: urlData } = supabase.storage.from('delivagh-media').getPublicUrl(path);
        return urlData.publicUrl;
    }

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
            setMenuItems([]);
            setOrders([]);
            ordersRef.current = [];
            setSelectedOrder(null);
            fetchedBusinessNameForUserRef.current = null;
            checkedAccountStatusForUserRef.current = null;
            setPage("login");
            sessionPolicySignOutLockRef.current = false;
        }
    }, []);

    // ── LOUD SOUND ──
    function playNotification() {
        try {
            // Ensure AudioContext exists
            if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            
            // Resume if suspended (browser autoplay policy)
            if (ctx.state === "suspended") {
                ctx.resume().then(() => {
                    console.log("[sound] AudioContext resumed");
                    playSound(ctx);
                }).catch(e => console.log("[sound] Resume failed:", e));
            } else {
                playSound(ctx);
            }
        } catch (e) { 
            console.log("[sound] Error:", e); 
        }
    }
    
    function playSound(ctx) {
        try {
            console.log("[sound] Playing notification sound");
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
        } catch (e) {
            console.log("[sound] Playback error:", e);
        }
    }

    useEffect(() => {
        const unlock = () => {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                console.log("[sound] AudioContext created on user interaction");
            }
            if (audioCtxRef.current.state === "suspended") {
                audioCtxRef.current.resume().then(() => {
                    console.log("[sound] AudioContext unlocked");
                });
            }
        };
        // Listen for multiple interaction types to ensure unlock
        document.addEventListener("click", unlock, { once: true });
        document.addEventListener("touchstart", unlock, { once: true });
        document.addEventListener("keydown", unlock, { once: true });
        return () => {
            document.removeEventListener("click", unlock);
            document.removeEventListener("touchstart", unlock);
            document.removeEventListener("keydown", unlock);
        };
    }, []);

    useEffect(() => {
        if (!supabase) {
            setAuthLoading(false);
            return;
        }
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            const u = session?.user ?? null;
            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordResetMode(true);
                setUser(u);
                setAuthLoading(false);
                window.history.replaceState({}, '', '/');
                return;
            }
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
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setAuthLoading(false), 5000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!authLoading || isPasswordResetMode) return;
        const timer = setTimeout(() => {
            setAuthLoading(false);
            setAuthNotice("Your reset link has expired. Please request a new one.");
            setPage('login');
        }, 10000);
        return () => clearTimeout(timer);
    }, [authLoading, isPasswordResetMode]);

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
    }, [user?.id, signOutForSessionPolicy]);

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
    }, [user?.id, signOutForSessionPolicy]);

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
    }, [user?.id]);

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
    }, [user?.id]);

    // Subscribe after businessName is known
    useEffect(() => {
        if (!user || !businessName) return;

        fetchOrders();

        const channel = supabase.channel("orders-rt-" + user.id)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
                // FIX: Only process orders belonging to this business
                if (payload.new.business_name !== businessNameRef.current) return;
                console.log("RT INSERT:", payload.new.id, "status:", payload.new.status);
                setOrders(prev => {
                    if (prev.find(o => o.id === payload.new.id)) return prev;
                    const updated = [payload.new, ...prev];
                    ordersRef.current = updated;
                    updateStats(updated);
                    computeInsights(updated);
                    return updated;
                });
                // Play sound for new orders (pending OR auto-accepted confirmed orders)
                if (payload.new.status === "pending" || payload.new.status === "confirmed") {
                    console.log("[notification] Playing sound for new order");
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

                setProfilePicture(biz.profile_picture || "");
                setContactNumber(biz.contact_number || "");
                setMomoNumber(biz.momo_number || "");

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
                        open_time: sd.open_time || prev.open_time,
                        close_time: sd.close_time || prev.close_time,
                        delivery_enabled: sd.delivery_enabled ?? true,
                        pickup_enabled: sd.pickup_enabled ?? true,
                        pay_directly_enabled: sd.pay_directly_enabled ?? true,
                        pay_online_enabled: sd.pay_online_enabled ?? true,
                        delivery_fee: sd.delivery_fee ?? 0,
                    }));
                }

                setBotConfig({
                    bot_name: biz.bot_name || "",
                    bot_greeting: biz.bot_greeting || "",
                    bot_persona: biz.bot_persona || "",
                    bot_special_instructions: biz.bot_special_instructions || "",
                });

                if (linkedViaDirectory) {
                    localStorage.setItem("onboarding_done_" + user.id, "true");
                    setOnboardingDone(true);
                } else {
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

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        // Handle PKCE code exchange for password reset
        const code = params.get('code');

        // Handle error from Supabase
        const error = params.get('error');
        const errorCode = params.get('error_code');
        if (error === 'access_denied' || errorCode === 'otp_expired') {
            window.history.replaceState({}, '', '/');
            setAuthNotice("Your password reset link has expired. Please request a new one.");
            setAuthLoading(false);
            return;
        }

        // Handle hash-based flow (fallback)
        const hash = window.location.hash;
        const hashParams = new URLSearchParams(hash.replace('#', ''));
        const type = hashParams.get('type');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (type === 'recovery' && accessToken) {
            window.history.replaceState({}, '', '/');
            supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || ''
            }).then(({ error: sessionError }) => {
                if (sessionError) {
                    setAuthNotice("Your reset link has expired. Please request a new one.");
                    setAuthLoading(false);
                } else {
                    setIsPasswordResetMode(true);
                    setAuthLoading(false);
                }
            });
            return;
        }

        // Handle PKCE code param — exchange code for session
        if (code && window.location.pathname === '/reset-password') {
            window.history.replaceState({}, '', '/');
            supabase.auth.exchangeCodeForSession(code).then(({ error: exchError }) => {
                if (exchError) {
                    setAuthNotice("Your reset link has expired. Please request a new one.");
                    setAuthLoading(false);
                } else {
                    setIsPasswordResetMode(true);
                    setAuthLoading(false);
                }
            });
            return;
        }
    }, []);

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
        let imageUrl = null;
        if (newItemImage) {
            try {
                const ext = newItemImage.name.split('.').pop();
                const path = `menu-items/${name}/${Date.now()}.${ext}`;
                imageUrl = await uploadImageToStorage(newItemImage, path);
            } catch (e) { console.error('Image upload failed:', e.message); }
        }
        const { data, error } = await supabase.from("menus").insert([{
            business_name: name, item_name: newItem.item_name.trim(),
            item_price: parseFloat(newItem.item_price), item_description: newItem.item_description.trim(),
            category: (newItem.category || "").trim() || "Main", available: true, image_url: imageUrl
        }]).select();
        if (error) { if (await handleAuthError(error)) return; alert("Error: " + error.message); return; }
        setNewItem({ item_name: "", item_price: "", item_description: "", category: "Main" });
        setNewItemImage(null);
        setShowAddModal(false);
        if (data && data.length > 0) setMenuItems(prev => [data[0], ...prev]);
        await fetchMenuItems();
    }

    async function saveEditItem() {
        if (!editItem?.item_name || !editItem?.item_price) return;
        let imageUrl = editItem.image_url || null;
        if (editItemImage) {
            try {
                const name = businessNameRef.current || businessName;
                const ext = editItemImage.name.split('.').pop();
                const path = `menu-items/${name}/${Date.now()}.${ext}`;
                imageUrl = await uploadImageToStorage(editItemImage, path);
            } catch (e) { console.error('Image upload failed:', e.message); }
        }
        await supabase.from("menus").update({
            item_name: editItem.item_name, item_price: parseFloat(editItem.item_price),
            item_description: editItem.item_description, category: (editItem.category || "").trim() || "Main",
            image_url: imageUrl
        }).eq("id", editItem.id);
        setShowEditModal(false); setEditItem(null); setEditItemImage(null);
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
            const response = await fetch(API + "/api/menu/extract", { method: "POST", headers: { ...(await vendorAuthHeader()) }, body: fd });
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
            if (await handleAuthError(e)) return;
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
                headers: { "Content-Type": "application/json", ...(await vendorAuthHeader()) },
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
            if (await handleAuthError(e)) return;
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
        try { 
            await supabase.from("orders").update({ payment_status: "paid" }).eq("id", id); 
            
            // Get order details for customer notification
            const order = orders.find(o => o.id === id);
            if (order?.customer_phone) {
                // Send WhatsApp notification to customer
                try {
                    await fetch(API + '/whatsapp/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...(await vendorAuthHeader()) },
                        body: JSON.stringify({
                            phone: order.customer_phone,
                            message: '✅ Payment confirmed!\n\nYour order is being prepared. Thank you! 🎉'
                        })
                    });
                } catch (notifyError) {
                    console.error('Failed to send customer notification:', notifyError);
                }
            }
            
            addNotif("Payment marked as received", "success"); 
        }
        catch (e) { if (await handleAuthError(e)) return; fetchOrders(); }
        finally { setButtonLoading(prev => ({ ...prev, [id + "_pay"]: false })); }
    }

    async function saveSettings() {
        const name = businessNameRef.current || businessName;
        if (!supabase || !name) return;
        try {
            const payload = {
                business_name: name,
                open_time: settings.open_time,
                close_time: settings.close_time,
                is_open: settings.is_open,
                auto_accept: settings.auto_accept,
                delivery_enabled: settings.delivery_enabled,
                pickup_enabled: settings.pickup_enabled,
                pay_directly_enabled: settings.pay_directly_enabled,
                pay_online_enabled: settings.pay_online_enabled,
                delivery_fee: parseFloat(settings.delivery_fee) || 0,
            };
            const { error } = await supabase
                .from("business_settings")
                .upsert(payload, { onConflict: "business_name" })
                .select("*");
            if (error) throw error;
            // Upload new profile pic if selected
            if (newProfilePic) {
                try {
                    const ext = newProfilePic.name.split('.').pop();
                    const path = `profiles/${name}/${Date.now()}.${ext}`;
                    const url = await uploadImageToStorage(newProfilePic, path);
                    setProfilePicture(url);
                    await supabase.from('businesses').update({ profile_picture: url }).eq('name', name);
                    setNewProfilePic(null);
                } catch (e) { console.error('Profile pic upload failed:', e.message); }
            }
            // Save contact number
            if (contactNumber !== undefined) {
                await supabase.from('businesses').update({ contact_number: contactNumber }).eq('name', name);
            }
            // Save MoMo number
            if (momoNumber !== undefined) {
                await supabase.from('businesses').update({ momo_number: momoNumber }).eq('name', name);
            }
            setSettings(prev => ({ ...prev }));
            setSettingsSaved(true);
            setTimeout(() => setSettingsSaved(false), 3000);
            addNotif("Settings saved", "success");
        } catch (e) {
            if (await handleAuthError(e)) return;
            console.error("Failed to save settings:", e?.message || e);
            alert("Failed to save settings: " + (e?.message || "Unknown error"));
        }
    }

    async function saveBotConfig() {
        const name = businessNameRef.current || businessName;
        if (!supabase || !name) return;
        try {
            const { error } = await supabase.from("businesses").update({
                bot_name: botConfig.bot_name,
                bot_greeting: botConfig.bot_greeting,
                bot_persona: botConfig.bot_persona,
                bot_special_instructions: botConfig.bot_special_instructions,
            }).eq("name", name);
            if (error) throw error;
            setBotConfigSaved(true);
            setTimeout(() => setBotConfigSaved(false), 3000);
            addNotif("Bot configuration saved", "success");
        } catch (e) {
            if (await handleAuthError(e)) return;
            alert("Failed to save bot config: " + (e?.message || "Unknown error"));
        }
    }

    async function sendBroadcast() {
        if (!broadcastMsg.trim()) return;
        setBroadcastSending(true); setBroadcastResult(null);
        try {
            const res = await fetch(API + "/whatsapp/broadcast", { method: "POST", headers: { "Content-Type": "application/json", ...(await vendorAuthHeader()) }, body: JSON.stringify({ businessName, message: broadcastMsg }) });
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

    // ── Presentation ────────────────────────────────────────────
    // Re-render every 30s so "waiting for 6 min" stays true
    const [, setClockTick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setClockTick(x => x + 1), 30000);
        return () => clearInterval(t);
    }, []);
    useEffect(() => {
        document.body.style.background = darkMode ? "#12110f" : "#f4f2ec";
    }, [darkMode]);

    const theme = darkMode ? "dark" : "light";
    const money = n => (parseFloat(n) || 0).toFixed(2);
    const shortId = id => "#" + String(id || "").substring(0, 8).toUpperCase();
    const phoneOf = o => (o.customer_phone || "").replace("whatsapp:", "");
    const custName = o => o.customer_name || phoneOf(o) || "Customer";
    const noteOf = o => o.special_instructions || o.notes || "";
    const minutesSince = iso => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    function ageText(iso) {
        const m = minutesSince(iso);
        if (m < 1) return "Just now";
        if (m < 60) return m + " min";
        if (m < 60 * 24) return Math.floor(m / 60) + "h " + (m % 60) + "m";
        return new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "short" });
    }
    function agoText(iso) {
        const m = minutesSince(iso);
        if (m < 1) return "just now";
        if (m < 60) return m + " min ago";
        if (m < 60 * 24) return Math.floor(m / 60) + " h ago";
        if (m < 60 * 48) return "yesterday";
        return new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "short" });
    }
    const timeOf = iso => new Date(iso).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" });
    function parseItems(text) {
        return String(text || "").split(/,\s*(?=\d+x\s)/).map(s => s.trim()).filter(Boolean).map(s => {
            const m = s.match(/^(\d+)x\s+(.+?)(?:\s*-\s*GHS\s*([\d.]+))?$/i);
            return m ? { qty: m[1], name: m[2], price: m[3] } : { qty: "", name: s, price: null };
        });
    }
    const itemsShort = o => parseItems(o.items).map(i => (i.qty ? i.qty + "× " : "") + i.name).join(", ");

    const STEPS = { pending: 1, confirmed: 2, preparing: 3, ready: 4, delivered: 5 };
    function statusLabel(o) {
        switch (o.status) {
            case "pending": return "New";
            case "confirmed": return "Accepted";
            case "preparing": return "Preparing";
            case "ready": return o.delivery_type === "delivery" ? "On the way" : "Ready for pickup";
            case "delivered": return o.delivery_type === "pickup" ? "Collected" : "Delivered";
            case "rejected": return "Rejected";
            case "cancelled": return o.cancelled_by === "customer" ? "Cancelled by customer" : "Cancelled";
            default: return o.status || "—";
        }
    }
    function renderProgress(o) {
        const step = STEPS[o.status] || 0;
        const stopped = o.status === "rejected" || o.status === "cancelled";
        return (
            <span className={"dx-progress" + (o.status === "pending" ? " is-new" : "") + (stopped ? " is-stopped" : "")}>
                <span className="dx-progress-label">{statusLabel(o)}</span>
                <span className="dx-progress-track" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map(i => <i key={i} className={!stopped && i <= step ? "is-on" : ""} />)}
                </span>
            </span>
        );
    }
    function renderPay(o) {
        const how = o.payment_method === "momo" ? "MoMo" : o.delivery_type === "pickup" ? "Cash on pickup" : "Cash on delivery";
        if (o.payment_status === "paid") return <span className="dx-tag is-accent">Paid · {o.payment_method === "momo" ? "MoMo" : "Cash"}</span>;
        if (o.payment_method === "momo") return <span className="dx-tag is-attn">MoMo not paid yet</span>;
        return <span className="dx-tag is-plain is-outline">{how}</span>;
    }
    function nextStep(o) {
        switch (o.status) {
            case "pending": return { status: "confirmed", label: "Accept" };
            case "confirmed": return { status: "preparing", label: "Start preparing" };
            case "preparing": return { status: "ready", label: o.delivery_type === "delivery" ? "Send out" : "Mark ready" };
            case "ready": return { status: "delivered", label: o.delivery_type === "delivery" ? "Mark delivered" : "Mark collected" };
            default: return null;
        }
    }
    function renderActions(o, { size = "sm", block = false } = {}) {
        const step = nextStep(o);
        if (!step) return null;
        const busy = !!buttonLoading[o.id];
        const go = status => async e => {
            e.stopPropagation();
            if (busy) return;
            if (status === "rejected" && !window.confirm("Reject this order? The customer will be told on WhatsApp.")) return;
            await updateStatus(o.id, status, o.customer_phone, o.delivery_type);
        };
        return (
            <div className="dx-row" style={{ flexWrap: "nowrap", width: block ? "100%" : undefined }} onClick={e => e.stopPropagation()}>
                {o.status === "pending" && <button type="button" className={`dx-btn is-danger is-${size}`} disabled={busy} onClick={go("rejected")}>Reject</button>}
                <button type="button" className={`dx-btn is-primary is-${size}` + (block ? " is-block" : "")} style={block ? { flex: 1 } : undefined} disabled={busy} onClick={go(step.status)}>
                    {busy ? "Updating…" : step.label}
                </button>
            </div>
        );
    }
    function renderTicket(o) {
        const mins = minutesSince(o.created_at);
        const urgency = mins >= 10 ? " is-late" : mins >= 5 ? " is-waiting" : "";
        const note = noteOf(o);
        return (
            <article key={o.id} className={"dx-ticket" + urgency} onClick={() => setSelectedOrder(o)}>
                <div className="dx-ticket-head">
                    <div className="dx-ticket-who">
                        <div className="dx-ticket-name truncate">{custName(o)}</div>
                        <div className="dx-ticket-meta">
                            <span className="mono">{shortId(o.id)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{o.delivery_type === "pickup" ? "Pickup" : "Delivery"}</span>
                        </div>
                    </div>
                    <span className="dx-age" title={new Date(o.created_at).toLocaleString("en-GH")}>
                        <Icon name="clock" size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{ageText(o.created_at)}
                    </span>
                </div>
                <ul className="dx-ticket-items">
                    {parseItems(o.items).map((it, i) => (
                        <li key={i}><span className="dx-qty">{it.qty ? it.qty + "×" : ""}</span><span>{it.name}</span><span className="faint num">{it.price ? money(it.price) : ""}</span></li>
                    ))}
                </ul>
                {note && <div className="dx-ticket-note"><small>Customer note</small>{note}</div>}
                {o.delivery_type === "delivery" && o.delivery_address && (
                    <div className="dx-ticket-addr"><Icon name="pin" size={14} /><span>{o.delivery_address}</span></div>
                )}
                <div className="dx-ticket-foot">
                    <div className="dx-stack" style={{ gap: 6 }}>
                        <div className="dx-total"><small>GHS</small>{money(o.total_amount)}</div>
                        {renderPay(o)}
                    </div>
                    {renderActions(o)}
                </div>
            </article>
        );
    }

    const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
    const todayRevenue = todayOrders.filter(o => o.payment_status === "paid").reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
    const DELIVAGH_WA_LINK = "https://wa.me/233276295769?text=Hi";
    const ORDER_GROUPS = {
        all: () => true,
        pending: o => o.status === "pending",
        active: o => ["confirmed", "preparing", "ready"].includes(o.status),
        delivered: o => o.status === "delivered",
        closed: o => ["rejected", "cancelled"].includes(o.status),
    };
    const filteredOrders = orders.filter(ORDER_GROUPS[activeTab] || ORDER_GROUPS.all);
    const waitingOrders = orders.filter(ORDER_GROUPS.pending).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const activeOrders = orders.filter(ORDER_GROUPS.active);
    // Sections are free text so any kind of shop can use its own ("Drinks", "Rice & Grains", ...)
    const filteredMenu = menuFilter === "All" ? menuItems : menuItems.filter(i => (i.category || "Main") === menuFilter);
    const usedSections = [...new Set(menuItems.map(i => i.category || "Main"))];
    const menuSections = [...new Set([...usedSections, "Main", "Sides", "Extras", "Drinks"])];
    const customers = Object.values(
        orders.reduce((acc, order) => {
            const phone = phoneOf(order) || "Unknown";
            if (!acc[phone]) {
                acc[phone] = { phone, name: order.customer_name || "", orders: 0, delivered: 0, pending: 0, revenue: 0, lastOrderAt: order.created_at };
            }
            if (!acc[phone].name && order.customer_name) acc[phone].name = order.customer_name;
            acc[phone].orders += 1;
            if (order.status === "delivered") acc[phone].delivered += 1;
            if (order.status === "pending") acc[phone].pending += 1;
            if (order.payment_status === "paid") acc[phone].revenue += parseFloat(order.total_amount) || 0;
            if (new Date(order.created_at) > new Date(acc[phone].lastOrderAt)) acc[phone].lastOrderAt = order.created_at;
            return acc;
        }, {})
    ).sort((a, b) => new Date(b.lastOrderAt) - new Date(a.lastOrderAt));
    const unreadNotifs = notifications.length;

    async function toggleShopOpen() {
        const name = businessNameRef.current || businessName;
        if (!supabase || !name) return;
        const next = !settings.is_open;
        setSettings(s => ({ ...s, is_open: next }));
        const { error } = await supabase.from("business_settings").upsert({ business_name: name, is_open: next }, { onConflict: "business_name" });
        if (error) {
            setSettings(s => ({ ...s, is_open: !next }));
            addNotif("Could not change shop status: " + error.message, "error");
            return;
        }
        addNotif(next ? "Shop opened. Customers can order." : "Shop closed. The bot tells customers you're closed.", "success");
    }

    const navItems = [
        { id: "overview", label: "Today", icon: "today" },
        { id: "pending", label: "Orders", icon: "orders", badge: stats.pending },
        { id: "menu", label: "Menu", icon: "menu" },
        { id: "customers", label: "Customers", icon: "customers" },
        { id: "insights", label: "Insights", icon: "insights" },
        { id: "settings", label: "Settings", icon: "settings" },
    ];
    const goTo = id => { setActivePage(id); if (id === "pending") setActiveTab("all"); window.scrollTo({ top: 0 }); };

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const todayLong = new Date().toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "long" });
    const hoursText = settings.open_time && settings.close_time ? `${String(settings.open_time).slice(0, 5)} – ${String(settings.close_time).slice(0, 5)}` : "";

    const Brand = ({ sub }) => <div className="dx-wordmark">Delivagh<i>.</i>{sub && <small>{sub}</small>}</div>;
    const Screen = ({ children }) => <div className="dx" data-theme={theme}><div className="dx-center">{children}</div></div>;

    if (!supabase) return (
        <Screen>
            <div className="dx-card is-wide">
                <Brand />
                <h1 className="dx-title-sm">The dashboard isn't configured</h1>
                <p className="dx-sub">Set <code className="mono">VITE_SUPABASE_URL</code> and <code className="mono">VITE_SUPABASE_KEY</code> in the Vercel environment variables, then redeploy.</p>
            </div>
        </Screen>
    );

    if (authLoading) return (
        <Screen><div className="dx-loading"><Brand /><p>Loading…</p></div></Screen>
    );

    if (isPasswordResetMode && !resetPasswordDone) {
        return (
            <Screen>
                <div className="dx-card">
                    <Brand />
                    <h1 className="dx-title-sm">Set a new password</h1>
                    <p className="dx-sub" style={{ marginBottom: 20 }}>Use at least 6 characters.</p>
                    <form className="dx-stack" style={{ gap: 12 }} onSubmit={async e => {
                        e.preventDefault();
                        setResetPasswordError("");
                        if (!resetPassword) { setResetPasswordError("Enter a new password."); return; }
                        if (resetPassword.length < 6) { setResetPasswordError("Password must be at least 6 characters."); return; }
                        if (resetPassword !== resetConfirmPassword) { setResetPasswordError("The passwords don't match."); return; }
                        setResetPasswordLoading(true);
                        const { error } = await supabase.auth.updateUser({ password: resetPassword });
                        if (error) {
                            setResetPasswordError(error.message);
                            setResetPasswordLoading(false);
                            return;
                        }
                        await supabase.auth.signOut({ scope: 'others' });
                        setResetPasswordDone(true);
                        setResetPasswordLoading(false);
                        setTimeout(async () => {
                            await supabase.auth.signOut();
                            setIsPasswordResetMode(false);
                            setUser(null);
                            setPage('login');
                        }, 3000);
                    }}>
                        <label className="dx-field"><span className="dx-label">New password</span>
                            <input className="dx-input" type="password" autoComplete="new-password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} /></label>
                        <label className="dx-field"><span className="dx-label">Confirm new password</span>
                            <input className="dx-input" type="password" autoComplete="new-password" value={resetConfirmPassword} onChange={e => setResetConfirmPassword(e.target.value)} /></label>
                        {resetPasswordError && <p className="dx-msg is-error" role="alert">{resetPasswordError}</p>}
                        <button type="submit" className="dx-btn is-primary is-lg is-block" disabled={resetPasswordLoading}>{resetPasswordLoading ? "Saving…" : "Set new password"}</button>
                    </form>
                </div>
            </Screen>
        );
    }

    if (isPasswordResetMode && resetPasswordDone) {
        return (
            <Screen>
                <div className="dx-loading"><Brand /><p className="accent-text" style={{ fontSize: 15, fontWeight: 600 }}>Password updated</p><p>Taking you to sign in…</p></div>
            </Screen>
        );
    }

    if (!user && page === "signup") return <Signup />;
    if (!user && page !== "signup" && accountStatus) return (
        <Screen>
            <div className="dx-card is-wide">
                <Brand />
                <p className="dx-crumb" style={{ margin: 0 }}>Account status</p>
                <h1 className="dx-title-sm" style={{ marginTop: 4 }}>
                    {accountStatus.type === "verify_email" ? "Confirm your email" : accountStatus.type === "pending" ? "Waiting for approval" : accountStatus.type === "rejected" ? "Application not approved" : "Account suspended"}
                </h1>
                <p className="dx-sub" style={{ marginBottom: 22 }}>{accountStatus.message}</p>
                <div className="dx-row" style={{ flexWrap: "nowrap" }}>
                    <button type="button" className="dx-btn is-block" style={{ flex: 1 }} onClick={() => { setAccountStatus(null); setAuthNotice(""); }}>Back to sign in</button>
                    <button type="button" className="dx-btn is-primary" style={{ flex: 1 }} onClick={() => { setAccountStatus(null); setAuthNotice(""); setPage("signup"); }}>Use another account</button>
                </div>
            </div>
        </Screen>
    );
    if (!user) return <Login notice={authNotice} />;

    // Avoid flashing dashboard before onboarding decision finishes.
    if (user && !onboardingChecked) return (
        <Screen><div className="dx-loading"><Brand /><p>Getting your shop ready…</p></div></Screen>
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

    const shopName = businessName || user.email?.split("@")[0] || "Your shop";
    const avatar = (cls = "") => (
        <div className={"dx-avatar " + cls}>
            {profilePicture ? <img src={profilePicture} alt="" /> : (businessName || user.email || "?").charAt(0).toUpperCase()}
        </div>
    );
    const statusPill = (
        <button type="button" className={"dx-status-pill " + (settings.is_open ? "is-open" : "is-closed")} onClick={toggleShopOpen}
            title={settings.is_open ? "Tap to close the shop" : "Tap to open the shop"} aria-pressed={settings.is_open}>
            <span className="dx-led" />{settings.is_open ? "Open" : "Closed"}
            {hoursText && <span className="faint dx-hide-phone num" style={{ fontWeight: 500 }}>{hoursText}</span>}
        </button>
    );
    const switchEl = (checked, onChange, label) => (
        <button type="button" role="switch" aria-checked={!!checked} aria-label={label} className="dx-switch" onClick={onChange} />
    );

    return (
        <div className="dx" data-theme={theme}>
            {/* NEW ORDER TOAST */}
            {newOrderAlert && (
                <div className="dx-toast" role="status">
                    <span className="dx-led" />
                    <div><strong>New order</strong><span>A customer just ordered on WhatsApp</span></div>
                    <button type="button" className="dx-btn is-sm" onClick={() => { setNewOrderAlert(false); goTo("overview"); }}>View</button>
                </div>
            )}

            {/* ORDER DETAIL */}
            {selectedOrder && (() => {
                const o = orders.find(x => x.id === selectedOrder.id) || selectedOrder;
                const callDisplay = o.contact_phone ? formatCallDisplay(o) : null;
                const note = noteOf(o);
                return (
                    <div className="dx-overlay" onClick={() => setSelectedOrder(null)}>
                        <div className="dx-sheet" role="dialog" aria-modal="true" aria-label="Order details" onClick={e => e.stopPropagation()}>
                            <div className="dx-sheet-head">
                                <div>
                                    <p className="dx-crumb" style={{ margin: 0 }}><span className="mono">{shortId(o.id)}</span> · {new Date(o.created_at).toLocaleString("en-GH", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                                    <h2 className="dx-title-sm" style={{ marginTop: 4 }}>{custName(o)}</h2>
                                </div>
                                <button type="button" className="dx-icon-btn" aria-label="Close" onClick={() => setSelectedOrder(null)}><Icon name="close" /></button>
                            </div>
                            <div className="dx-sheet-body">
                                <div className="dx-spread" style={{ alignItems: "flex-start" }}>
                                    {renderProgress(o)}
                                    <div className="dx-stack" style={{ gap: 6, alignItems: "flex-end" }}>
                                        {renderPay(o)}
                                        {o.payment_status !== "paid" && !["rejected", "cancelled"].includes(o.status) && (
                                            <button type="button" className="dx-link" disabled={buttonLoading[o.id + "_pay"]} onClick={() => markAsPaid(o.id)}>
                                                {buttonLoading[o.id + "_pay"] ? "Saving…" : "Mark as paid"}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="dx-panel" style={{ background: "var(--surface-2)", border: 0 }}>
                                    <ul className="dx-ticket-items" style={{ padding: "14px 16px" }}>
                                        {parseItems(o.items).map((it, i) => (
                                            <li key={i}><span className="dx-qty">{it.qty ? it.qty + "×" : ""}</span><span>{it.name}</span><span className="num muted">{it.price ? money(it.price) : ""}</span></li>
                                        ))}
                                        {parseFloat(o.delivery_fee) > 0 && <li><span /><span className="muted">Delivery</span><span className="num muted">{money(o.delivery_fee)}</span></li>}
                                    </ul>
                                    <div className="dx-spread" style={{ padding: "10px 16px 14px", borderTop: "1px dashed var(--line-strong)" }}>
                                        <span className="muted">Total</span>
                                        <span className="dx-total"><small>GHS</small>{money(o.total_amount)}</span>
                                    </div>
                                </div>
                                {note && <div className="dx-ticket-note" style={{ margin: 0 }}><small>Customer note</small>{note}</div>}
                                <dl className="dx-dl">
                                    <dt>{o.delivery_type === "pickup" ? "Pickup" : "Delivery to"}</dt>
                                    <dd>{o.delivery_type === "pickup" ? "Customer collects from you" : (o.delivery_address || "No address given")}</dd>
                                    <dt>WhatsApp</dt><dd className="num">{phoneOf(o) || "—"}</dd>
                                    {callDisplay && <><dt>Call on</dt><dd><a className="dx-link num" href={"tel:" + callDisplay}>{callDisplay}</a></dd></>}
                                    {o.momo_number && <><dt>MoMo number</dt><dd className="num">{o.momo_number}</dd></>}
                                    <dt>Payment</dt>
                                    <dd>{o.payment_method === "momo" ? "MoMo" : o.delivery_type === "pickup" ? "Cash on pickup" : "Cash on delivery"}</dd>
                                </dl>
                                {o.payment_method === 'manual_momo' && o.payment_screenshot_url && (
                                    <div className="dx-field">
                                        <span className="dx-label">Payment screenshot</span>
                                        <a href={o.payment_screenshot_url} target="_blank" rel="noopener noreferrer">
                                            <img src={o.payment_screenshot_url} alt="Customer's payment screenshot" style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 10, border: "1px solid var(--line)" }} />
                                        </a>
                                    </div>
                                )}
                            </div>
                            {nextStep(o) && <div className="dx-sheet-foot">{renderActions(o, { size: "lg", block: true })}</div>}
                        </div>
                    </div>
                );
            })()}

            {/* CUSTOMER DETAIL */}
            {selectedCustomer && (() => {
                const customerOrders = orders
                    .filter(o => phoneOf(o) === selectedCustomer.phone)
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                const first = customerOrders[customerOrders.length - 1];
                return (
                    <div className="dx-overlay" onClick={() => setSelectedCustomer(null)}>
                        <div className="dx-sheet" role="dialog" aria-modal="true" aria-label="Customer details" onClick={e => e.stopPropagation()}>
                            <div className="dx-sheet-head">
                                <div>
                                    <p className="dx-crumb num" style={{ margin: 0 }}>{selectedCustomer.phone}</p>
                                    <h2 className="dx-title-sm" style={{ marginTop: 4 }}>{selectedCustomer.name || "Customer"}</h2>
                                </div>
                                <button type="button" className="dx-icon-btn" aria-label="Close" onClick={() => setSelectedCustomer(null)}><Icon name="close" /></button>
                            </div>
                            <div className="dx-sheet-body">
                                <div className="dx-kpis" style={{ "--cols": 3 }}>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Orders</p><p className="dx-kpi-value">{selectedCustomer.orders}</p></div>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Paid</p><p className="dx-kpi-value"><small>GHS</small>{money(selectedCustomer.revenue)}</p></div>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Customer since</p><p className="dx-kpi-value" style={{ fontSize: 17 }}>{first ? new Date(first.created_at).toLocaleDateString("en-GH", { day: "numeric", month: "short" }) : "—"}</p></div>
                                </div>
                                <div className="dx-row">
                                    <a className="dx-btn is-sm" href={"https://wa.me/" + selectedCustomer.phone.replace(/\D/g, "")} target="_blank" rel="noopener noreferrer"><Icon name="external" size={15} />Message on WhatsApp</a>
                                </div>
                                <div>
                                    <h3 className="dx-section-title">Order history</h3>
                                    <div className="dx-panel dx-list">
                                        {customerOrders.slice(0, 8).map(o => (
                                            <button type="button" key={o.id} className="dx-list-row" onClick={() => { setSelectedCustomer(null); setSelectedOrder(o); }}>
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div className="truncate" style={{ fontWeight: 550 }}>{itemsShort(o)}</div>
                                                    <div className="dx-cell-sub">{new Date(o.created_at).toLocaleDateString("en-GH", { day: "numeric", month: "short" })} · {statusLabel(o)}</div>
                                                </div>
                                                <span className="dx-price">GHS {money(o.total_amount)}</span>
                                            </button>
                                        ))}
                                        {customerOrders.length === 0 && <div className="dx-empty"><p>No orders found.</p></div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ADD / EDIT MENU ITEM */}
            {(showAddModal || (showEditModal && editItem)) && (() => {
                const isEdit = !showAddModal;
                const item = isEdit ? editItem : newItem;
                const set = patch => isEdit ? setEditItem({ ...editItem, ...patch }) : setNewItem({ ...newItem, ...patch });
                const close = () => { if (isEdit) { setShowEditModal(false); setEditItem(null); } else setShowAddModal(false); };
                const file = isEdit ? editItemImage : newItemImage;
                return (
                    <div className="dx-overlay" onClick={close}>
                        <form className="dx-sheet" role="dialog" aria-modal="true" aria-label={isEdit ? "Edit item" : "Add item"} onClick={e => e.stopPropagation()}
                            onSubmit={e => { e.preventDefault(); isEdit ? saveEditItem() : addMenuItem(); }}>
                            <div className="dx-sheet-head">
                                <h2 className="dx-title-sm">{isEdit ? "Edit item" : "Add an item"}</h2>
                                <button type="button" className="dx-icon-btn" aria-label="Close" onClick={close}><Icon name="close" /></button>
                            </div>
                            <div className="dx-sheet-body">
                                <label className="dx-field"><span className="dx-label">Name</span>
                                    <input className="dx-input" required value={item.item_name || ""} onChange={e => set({ item_name: e.target.value })} placeholder="e.g. Jollof rice with chicken" /></label>
                                <div className="dx-form-grid">
                                    <label className="dx-field"><span className="dx-label">Price (GHS)</span>
                                        <input className="dx-input num" required type="number" min="0" step="0.5" inputMode="decimal" value={item.item_price ?? ""} onChange={e => set({ item_price: e.target.value })} placeholder="45" /></label>
                                    <label className="dx-field"><span className="dx-label">Section</span>
                                        <input className="dx-input" list="menu-sections" value={item.category || ""} onChange={e => set({ category: e.target.value })} placeholder="Main, Drinks…" />
                                        <datalist id="menu-sections">{menuSections.map(c => <option key={c} value={c} />)}</datalist></label>
                                </div>
                                <label className="dx-field"><span className="dx-label">Description <span className="faint" style={{ fontWeight: 400 }}>(optional)</span></span>
                                    <textarea className="dx-textarea" value={item.item_description || ""} onChange={e => set({ item_description: e.target.value })} placeholder="What's in it. The bot uses this to answer questions, e.g. about pepper or allergies." /></label>
                                <div className="dx-field">
                                    <span className="dx-label">Photo <span className="faint" style={{ fontWeight: 400 }}>(optional)</span></span>
                                    {isEdit && editItem.image_url && !editItemImage && (
                                        <div className="dx-row">
                                            <img src={editItem.image_url} alt="" className="dx-thumb" />
                                            <button type="button" className="dx-btn is-danger is-sm" onClick={async () => {
                                                try {
                                                    await supabase.from('menus').update({ image_url: null }).eq('id', editItem.id);
                                                    setEditItem({ ...editItem, image_url: null });
                                                    addNotif("Photo removed", "success");
                                                } catch {
                                                    addNotif("Couldn't remove the photo", "error");
                                                }
                                            }}>Remove photo</button>
                                        </div>
                                    )}
                                    <label className="dx-btn is-sm" style={{ alignSelf: "flex-start" }}>
                                        <Icon name="upload" size={15} />{file ? "Choose another photo" : "Choose photo"}
                                        <input type="file" accept="image/*" className="sr-only" onChange={e => (isEdit ? setEditItemImage : setNewItemImage)(e.target.files?.[0] || null)} />
                                    </label>
                                    {file && <p className="dx-hint accent-text">Selected: {file.name}</p>}
                                </div>
                            </div>
                            <div className="dx-sheet-foot">
                                <button type="button" className="dx-btn" onClick={close}>Cancel</button>
                                <button type="submit" className="dx-btn is-primary">{isEdit ? "Save changes" : "Add item"}</button>
                            </div>
                        </form>
                    </div>
                );
            })()}

            {/* UPLOAD MENU */}
            {showUploadMenuModal && (
                <div className="dx-overlay" onClick={closeUploadMenuModal}>
                    <div className="dx-sheet is-wide" role="dialog" aria-modal="true" aria-label="Upload menu" onClick={e => e.stopPropagation()}>
                        <div className="dx-sheet-head">
                            <div>
                                <h2 className="dx-title-sm">Upload your menu</h2>
                                <p className="dx-sub" style={{ marginTop: 4 }}>A photo or PDF of your menu. We read the items for you; check them before saving.</p>
                            </div>
                            <button type="button" className="dx-icon-btn" aria-label="Close" onClick={closeUploadMenuModal}><Icon name="close" /></button>
                        </div>
                        <div className="dx-sheet-body">
                            <input ref={menuFileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" style={{ display: "none" }}
                                onChange={e => { pickUploadMenuFile(e.target.files?.[0]); e.target.value = ""; }} />
                            {!uploadMenuFile ? (
                                <div className={"dx-drop" + (uploadMenuDragActive ? " is-active" : "")} role="button" tabIndex={0}
                                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") menuFileInputRef.current?.click(); }}
                                    onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setUploadMenuDragActive(true); }}
                                    onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setUploadMenuDragActive(false); }}
                                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                                    onDrop={e => { e.preventDefault(); e.stopPropagation(); setUploadMenuDragActive(false); pickUploadMenuFile(e.dataTransfer.files?.[0]); }}
                                    onClick={() => menuFileInputRef.current?.click()}>
                                    <Icon name="upload" size={22} />
                                    <p style={{ margin: "8px 0 2px", fontWeight: 600 }}>Drop a photo or PDF here</p>
                                    <p className="dx-hint">or tap to choose · JPG, PNG, WEBP or PDF · up to 10 MB</p>
                                </div>
                            ) : (
                                <div className="dx-row" style={{ alignItems: "flex-start", gap: 14 }}>
                                    {uploadImagePreviewUrl
                                        ? <img alt="Menu preview" src={uploadImagePreviewUrl} style={{ width: 120, maxHeight: 160, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }} />
                                        : <div className="dx-thumb" style={{ width: 120, height: 90, fontSize: 13, fontFamily: "var(--font)" }}>PDF</div>}
                                    <div className="dx-stack" style={{ gap: 8, minWidth: 0 }}>
                                        <span className="truncate" style={{ fontWeight: 600 }}>{uploadMenuFile.name}</span>
                                        <button type="button" className="dx-btn is-sm" onClick={() => menuFileInputRef.current?.click()}>Choose another file</button>
                                    </div>
                                </div>
                            )}
                            {uploadMenuError && <p className="dx-msg is-error" role="alert">{uploadMenuError}</p>}
                            {uploadExtractLoading && (
                                <div className="dx-stack" style={{ gap: 8 }} aria-live="polite">
                                    <p className="dx-hint">Reading your menu…</p>
                                    {[0, 1, 2, 3].map(i => <div key={i} className="dx-skel" style={{ height: 38 }} />)}
                                </div>
                            )}
                            {!uploadExtractLoading && uploadExtracted.length > 0 && (
                                <div className="dx-stack" style={{ gap: 10 }}>
                                    <div className="dx-spread">
                                        <p className="dx-label" style={{ margin: 0 }}>{uploadExtracted.length} items found. Edit anything that's wrong.</p>
                                        <button type="button" className="dx-btn is-ghost is-sm" onClick={() => { setUploadExtracted([]); setUploadMenuError(""); }}>Read again</button>
                                    </div>
                                    <div className="dx-panel dx-table-wrap" style={{ maxHeight: 360 }}>
                                        <table className="dx-table" style={{ minWidth: 640 }}>
                                            <thead><tr><th>Name</th><th style={{ width: 110 }}>Price (GHS)</th><th style={{ width: 140 }}>Section</th><th>Description</th></tr></thead>
                                            <tbody>
                                                {uploadExtracted.map((row, idx) => (
                                                    <tr key={row.rowKey || idx}>
                                                        <td style={{ padding: 6 }}><input className="dx-input" aria-label="Name" value={row.name ?? ""} onChange={e => patchUploadExtractedRow(idx, { name: e.target.value })} /></td>
                                                        <td style={{ padding: 6 }}><input className="dx-input num" aria-label="Price" type="number" step="0.01" min="0" value={row.price ?? ""} onChange={e => patchUploadExtractedRow(idx, { price: e.target.value === "" ? "" : parseFloat(e.target.value) })} /></td>
                                                        <td style={{ padding: 6 }}><input className="dx-input" aria-label="Section" value={row.category ?? ""} onChange={e => patchUploadExtractedRow(idx, { category: e.target.value })} /></td>
                                                        <td style={{ padding: 6 }}><input className="dx-input" aria-label="Description" value={row.description ?? ""} onChange={e => patchUploadExtractedRow(idx, { description: e.target.value })} /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="dx-sheet-foot">
                            <button type="button" className="dx-btn" onClick={closeUploadMenuModal}>Cancel</button>
                            {uploadExtracted.length > 0
                                ? <button type="button" className="dx-btn is-primary" disabled={uploadSaveLoading} onClick={saveExtractedMenuItems}>{uploadSaveLoading ? "Saving…" : `Add ${uploadExtracted.length} items to menu`}</button>
                                : <button type="button" className="dx-btn is-primary" disabled={!uploadMenuFile || uploadExtractLoading} onClick={extractMenuFromUpload}>{uploadExtractLoading ? "Reading…" : "Read menu"}</button>}
                        </div>
                    </div>
                </div>
            )}

            <div className={"dx-shell" + (sidebarCollapsed ? " is-collapsed" : "")}>
                {/* SIDEBAR (desktop) */}
                <aside className="dx-side" aria-label="Main navigation">
                    <div className="dx-brand">
                        {sidebarCollapsed ? <div className="dx-wordmark">D<i>.</i></div> : <Brand sub="Vendor" />}
                        {!sidebarCollapsed && (
                            <button type="button" className="dx-icon-btn" aria-label="Collapse sidebar" onClick={() => setSidebarCollapsed(true)}><Icon name="sidebar" size={17} /></button>
                        )}
                    </div>
                    {sidebarCollapsed && (
                        <button type="button" className="dx-icon-btn" style={{ margin: "0 auto 10px" }} aria-label="Expand sidebar" onClick={() => setSidebarCollapsed(false)}><Icon name="sidebar" size={17} /></button>
                    )}
                    <nav className="dx-nav">
                        {navItems.map(item => (
                            <button key={item.id} type="button" className="dx-nav-item" aria-current={activePage === item.id ? "page" : undefined}
                                title={sidebarCollapsed ? item.label : undefined} onClick={() => goTo(item.id)}>
                                <Icon name={item.icon} />
                                <span>{item.label}</span>
                                {item.badge > 0 && !sidebarCollapsed && <span className="dx-count">{item.badge}</span>}
                            </button>
                        ))}
                    </nav>
                    <div className="dx-side-foot">
                        <div className="dx-me">
                            {avatar()}
                            <div className="dx-hide-collapsed" style={{ minWidth: 0 }}>
                                <div className="dx-me-name truncate">{shopName}</div>
                                <div className="dx-me-sub truncate">{user.email}</div>
                            </div>
                        </div>
                        <button type="button" className="dx-nav-item" onClick={handleLogout} title={sidebarCollapsed ? "Sign out" : undefined}>
                            <Icon name="logout" /><span>Sign out</span>
                        </button>
                    </div>
                </aside>

                <main className="dx-main">
                    <header className="dx-top">
                        <div className="dx-row" style={{ flexWrap: "nowrap", minWidth: 0 }}>
                            <div className="dx-show-phone dx-wordmark" style={{ fontSize: 22 }}>Delivagh<i>.</i></div>
                            {statusPill}
                        </div>
                        <div className="dx-top-actions">
                            {stats.pending > 0 && (
                                <button type="button" className="dx-btn is-sm dx-hide-phone" onClick={() => goTo("overview")}>
                                    <span className="dx-count">{stats.pending}</span>waiting
                                </button>
                            )}
                            <div style={{ position: "relative" }}>
                                <button type="button" className="dx-icon-btn" aria-label="Notifications" aria-expanded={showNotifPanel} onClick={() => setShowNotifPanel(p => !p)}>
                                    <Icon name="bell" />
                                    {unreadNotifs > 0 && <span className="dx-dot" />}
                                </button>
                                {showNotifPanel && (
                                    <div className="dx-popover" role="dialog" aria-label="Notifications">
                                        <div className="dx-panel-head" style={{ padding: "12px 16px" }}>
                                            <p className="dx-panel-title">Notifications</p>
                                            {notifications.length > 0 && <button type="button" className="dx-link" onClick={() => { setNotifications([]); setShowNotifPanel(false); }}>Clear</button>}
                                        </div>
                                        <div style={{ maxHeight: 340, overflowY: "auto" }}>
                                            {notifications.length === 0
                                                ? <div className="dx-empty" style={{ padding: 28 }}><p>Nothing yet. Order updates and new orders show up here.</p></div>
                                                : notifications.map(n => (
                                                    <div key={n.id} className="dx-list-row" style={{ alignItems: "flex-start" }}>
                                                        <span className={n.type === "error" ? "danger-text" : n.type === "new" ? "attn-text" : "accent-text"} style={{ marginTop: 2 }}>
                                                            <Icon name={n.type === "error" ? "close" : n.type === "new" ? "bell" : "check"} size={16} />
                                                        </span>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontSize: 13.5, fontWeight: 500 }}>{n.message}</div>
                                                            <div className="dx-cell-sub">{n.time.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <button type="button" className="dx-icon-btn" aria-label={darkMode ? "Use light theme" : "Use dark theme"} onClick={toggleDark}>
                                <Icon name={darkMode ? "sun" : "moon"} />
                            </button>
                        </div>
                    </header>

                    <div className="dx-content">

                        {/* TODAY */}
                        {activePage === "overview" && (
                            <div className="dx-stack" style={{ gap: 28 }}>
                                <div className="dx-page-head" style={{ marginBottom: 0 }}>
                                    <div>
                                        <p className="dx-crumb" style={{ margin: 0 }}>{todayLong}</p>
                                        <h1 className="dx-title" style={{ marginTop: 6 }}>{greeting}, {shopName}</h1>
                                        <p className="dx-sub">
                                            {waitingOrders.length > 0
                                                ? `${waitingOrders.length} ${waitingOrders.length === 1 ? "order is" : "orders are"} waiting for you to accept.`
                                                : settings.is_open ? "You're open and taking orders on WhatsApp." : "Your shop is closed. Customers are told you're closed."}
                                        </p>
                                    </div>
                                </div>

                                <div className="dx-kpis">
                                    <div className="dx-kpi"><p className="dx-kpi-label">Orders today</p><p className="dx-kpi-value">{todayOrders.length}</p>
                                        <p className="dx-kpi-note">{todayOrders.filter(o => o.delivery_type === "pickup").length} pickup · {todayOrders.filter(o => o.delivery_type === "delivery").length} delivery</p></div>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Paid today</p><p className="dx-kpi-value"><small>GHS</small>{money(todayRevenue)}</p>
                                        <p className="dx-kpi-note">GHS {money(stats.revenue)} all time</p></div>
                                    <div className={"dx-kpi" + (stats.unpaidRevenue > 0 ? " is-attn" : "")}><p className="dx-kpi-label">Not paid yet</p><p className="dx-kpi-value"><small>GHS</small>{money(stats.unpaidRevenue)}</p>
                                        <p className="dx-kpi-note">Accepted orders awaiting payment</p></div>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Delivered today</p><p className="dx-kpi-value">{todayOrders.filter(o => o.status === "delivered").length}</p>
                                        <p className="dx-kpi-note">{activeOrders.length} in progress now</p></div>
                                </div>

                                <section aria-labelledby="waiting-h">
                                    <div className="dx-spread" style={{ marginBottom: 12 }}>
                                        <h2 id="waiting-h" className="dx-title-sm">Waiting for you {waitingOrders.length > 0 && <span className="dx-count" style={{ verticalAlign: "4px", marginLeft: 6 }}>{waitingOrders.length}</span>}</h2>
                                        {waitingOrders.length > 0 && <span className="dx-hint dx-hide-phone">Oldest first · amber after 5 min, red after 10</span>}
                                    </div>
                                    {loading ? (
                                        <div className="dx-tickets">{[0, 1].map(i => <div key={i} className="dx-skel" style={{ height: 210, borderRadius: 12 }} />)}</div>
                                    ) : waitingOrders.length === 0 ? (
                                        <div className="dx-panel dx-empty">
                                            <h3>All caught up</h3>
                                            <p>New orders appear here with a chime. Keep this tab open, or turn the sound up on your phone.</p>
                                        </div>
                                    ) : (
                                        <div className="dx-tickets">{waitingOrders.map(renderTicket)}</div>
                                    )}
                                </section>

                                <div className="dx-grid-2">
                                    <section className="dx-panel" aria-labelledby="kitchen-h">
                                        <div className="dx-panel-head">
                                            <h2 id="kitchen-h" className="dx-panel-title">In progress</h2>
                                            <button type="button" className="dx-link" onClick={() => { setActivePage("pending"); setActiveTab("active"); }}>All orders</button>
                                        </div>
                                        {activeOrders.length === 0 ? (
                                            <div className="dx-empty" style={{ padding: 28 }}><p>Nothing being prepared right now.</p></div>
                                        ) : (
                                            <div className="dx-list">
                                                {activeOrders.map(o => (
                                                    <div key={o.id} className="dx-list-row" role="button" tabIndex={0} style={{ cursor: "pointer" }}
                                                        onClick={() => setSelectedOrder(o)} onKeyDown={e => { if (e.key === "Enter") setSelectedOrder(o); }}>
                                                        <div style={{ minWidth: 0, flex: 1 }}>
                                                            <div className="dx-row" style={{ gap: 6, flexWrap: "nowrap" }}>
                                                                <span className="truncate" style={{ fontWeight: 600 }}>{custName(o)}</span>
                                                                {noteOf(o) && <span className="dx-note-flag" title={noteOf(o)}>· note</span>}
                                                            </div>
                                                            <div className="dx-items-line truncate">{itemsShort(o)}</div>
                                                        </div>
                                                        <span className="dx-hide-phone">{renderProgress(o)}</span>
                                                        {renderActions(o)}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                    <div className="dx-stack">
                                        <section className="dx-panel">
                                            <div className="dx-panel-body dx-stack" style={{ gap: 12 }}>
                                                <div>
                                                    <h2 className="dx-panel-title">Your order link</h2>
                                                    <p className="dx-hint" style={{ marginTop: 4 }}>Customers tap it and WhatsApp opens, ready to order. Put it on your status, flyers and Instagram bio.</p>
                                                </div>
                                                <div className="dx-share">
                                                    <code>{DELIVAGH_WA_LINK}</code>
                                                    <button type="button" className="dx-btn is-sm" onClick={() => { navigator.clipboard.writeText(DELIVAGH_WA_LINK); setWaLinkCopied(true); setTimeout(() => setWaLinkCopied(false), 2000); }}>
                                                        <Icon name={waLinkCopied ? "check" : "copy"} size={15} />{waLinkCopied ? "Copied" : "Copy"}
                                                    </button>
                                                    <a className="dx-btn is-sm is-ghost" href={DELIVAGH_WA_LINK} target="_blank" rel="noopener noreferrer"><Icon name="external" size={15} />Open</a>
                                                </div>
                                            </div>
                                        </section>
                                        <section className="dx-panel">
                                            <div className="dx-panel-body dx-spread">
                                                <div>
                                                    <h2 className="dx-panel-title">{settings.is_open ? "Taking orders" : "Not taking orders"}</h2>
                                                    <p className="dx-hint" style={{ marginTop: 4 }}>{hoursText ? `Opening hours ${hoursText}` : "No opening hours set"}</p>
                                                </div>
                                                {switchEl(settings.is_open, toggleShopOpen, "Shop open")}
                                            </div>
                                        </section>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ORDERS */}
                        {activePage === "pending" && (
                            <div>
                                <div className="dx-page-head">
                                    <div>
                                        <h1 className="dx-title">Orders</h1>
                                        <p className="dx-sub">Every order customers placed with your bot.</p>
                                    </div>
                                </div>
                                <div className="dx-seg" role="group" aria-label="Filter orders" style={{ marginBottom: 14 }}>
                                    {[
                                        { id: "all", label: "All" },
                                        { id: "pending", label: "New" },
                                        { id: "active", label: "In progress" },
                                        { id: "delivered", label: "Delivered" },
                                        { id: "closed", label: "Cancelled" },
                                    ].map(tab => (
                                        <button key={tab.id} type="button" aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                                            {tab.label}<span className="num">{orders.filter(ORDER_GROUPS[tab.id]).length}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="dx-panel">
                                    {loading ? (
                                        <div className="dx-panel-body dx-stack" style={{ gap: 10 }}>{[0, 1, 2, 3].map(i => <div key={i} className="dx-skel" style={{ height: 44 }} />)}</div>
                                    ) : filteredOrders.length === 0 ? (
                                        <div className="dx-empty"><h3>No orders here</h3><p>{activeTab === "all" ? "When a customer orders on WhatsApp it shows up here." : "Try another filter."}</p></div>
                                    ) : (
                                        <>
                                            <div className="dx-table-wrap dx-hide-phone">
                                                <table className="dx-table">
                                                    <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th className="is-right">Total</th><th>Payment</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead>
                                                    <tbody>
                                                        {(() => {
                                                            let lastDate = null;
                                                            return filteredOrders.map(o => {
                                                                const od = new Date(o.created_at).toDateString();
                                                                const isNew = od !== lastDate; lastDate = od;
                                                                const dl = od === new Date().toDateString() ? "Today" : od === new Date(Date.now() - 86400000).toDateString() ? "Yesterday"
                                                                    : new Date(o.created_at).toLocaleDateString("en-GH", { weekday: "long", day: "numeric", month: "short" });
                                                                return (
                                                                    <React.Fragment key={o.id}>
                                                                        {isNew && <tr className="dx-group"><td colSpan="7">{dl}</td></tr>}
                                                                        <tr className="is-clickable" onClick={() => setSelectedOrder(o)}>
                                                                            <td><div className="mono">{shortId(o.id)}</div><div className="dx-cell-sub num">{timeOf(o.created_at)}</div></td>
                                                                            <td><div className="dx-cell-main">{custName(o)}</div><div className="dx-cell-sub">{o.delivery_type === "pickup" ? "Pickup" : "Delivery"}</div></td>
                                                                            <td style={{ maxWidth: 280 }}>
                                                                                <div className="truncate">{itemsShort(o)}</div>
                                                                                {noteOf(o) && <div className="dx-note-flag truncate" title={noteOf(o)}>Note: {noteOf(o)}</div>}
                                                                            </td>
                                                                            <td className="is-right dx-price">{money(o.total_amount)}</td>
                                                                            <td>{renderPay(o)}</td>
                                                                            <td>{renderProgress(o)}</td>
                                                                            <td className="is-right">{renderActions(o)}</td>
                                                                        </tr>
                                                                    </React.Fragment>
                                                                );
                                                            });
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="dx-list dx-show-phone">
                                                {filteredOrders.map(o => (
                                                    <div key={o.id} className="dx-list-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10, cursor: "pointer" }} onClick={() => setSelectedOrder(o)}>
                                                        <div className="dx-spread" style={{ alignItems: "flex-start" }}>
                                                            <div style={{ minWidth: 0 }}>
                                                                <div style={{ fontWeight: 600 }} className="truncate">{custName(o)}</div>
                                                                <div className="dx-cell-sub"><span className="mono">{shortId(o.id)}</span> · {agoText(o.created_at)} · {o.delivery_type === "pickup" ? "Pickup" : "Delivery"}</div>
                                                            </div>
                                                            <span className="dx-price">GHS {money(o.total_amount)}</span>
                                                        </div>
                                                        <div className="dx-items-line">{itemsShort(o)}</div>
                                                        {noteOf(o) && <div className="dx-note-flag">Note: {noteOf(o)}</div>}
                                                        <div className="dx-spread">{renderProgress(o)}{renderActions(o)}</div>
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
                                        <p className="dx-sub">Everyone who has ordered from you on WhatsApp.</p>
                                    </div>
                                </div>
                                <div className="dx-kpis" style={{ "--cols": 3, marginBottom: 20 }}>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Customers</p><p className="dx-kpi-value">{customers.length}</p></div>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Came back</p><p className="dx-kpi-value">{customers.filter(c => c.orders > 1).length}</p>
                                        <p className="dx-kpi-note">Ordered more than once</p></div>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Ordered today</p><p className="dx-kpi-value">{customers.filter(c => new Date(c.lastOrderAt).toDateString() === new Date().toDateString()).length}</p></div>
                                </div>
                                <div className="dx-panel">
                                    {customers.length === 0 ? (
                                        <div className="dx-empty"><h3>No customers yet</h3><p>Share your order link to get your first order.</p></div>
                                    ) : (
                                        <>
                                            <div className="dx-table-wrap dx-hide-phone">
                                                <table className="dx-table">
                                                    <thead><tr><th>Customer</th><th className="is-right">Orders</th><th className="is-right">Delivered</th><th className="is-right">Paid (GHS)</th><th>Last order</th></tr></thead>
                                                    <tbody>
                                                        {customers.map(c => (
                                                            <tr key={c.phone} className="is-clickable" onClick={() => setSelectedCustomer(c)}>
                                                                <td><div className="dx-cell-main">{c.name || "Customer"}</div><div className="dx-cell-sub num">{c.phone}</div></td>
                                                                <td className="is-right num">{c.orders}{c.pending > 0 && <span className="dx-count" style={{ marginLeft: 8 }}>{c.pending} new</span>}</td>
                                                                <td className="is-right num">{c.delivered}</td>
                                                                <td className="is-right dx-price">{money(c.revenue)}</td>
                                                                <td className="muted num">{new Date(c.lastOrderAt).toLocaleString("en-GH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="dx-list dx-show-phone">
                                                {customers.map(c => (
                                                    <button type="button" key={c.phone} className="dx-list-row" onClick={() => setSelectedCustomer(c)}>
                                                        <div className="dx-avatar">{(c.name || "?").charAt(0).toUpperCase()}</div>
                                                        <div style={{ minWidth: 0, flex: 1 }}>
                                                            <div style={{ fontWeight: 600 }} className="truncate">{c.name || c.phone}</div>
                                                            <div className="dx-cell-sub">{c.orders} {c.orders === 1 ? "order" : "orders"} · last {agoText(c.lastOrderAt)}</div>
                                                        </div>
                                                        <span className="dx-price">GHS {money(c.revenue)}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* MENU */}
                        {activePage === "menu" && (
                            <div>
                                <div className="dx-page-head">
                                    <div>
                                        <h1 className="dx-title">Menu</h1>
                                        <p className="dx-sub">What your bot can sell. Switch an item off when it runs out and the bot stops offering it.</p>
                                    </div>
                                    <div className="dx-row">
                                        <button type="button" className="dx-btn" onClick={() => setShowUploadMenuModal(true)}><Icon name="upload" size={16} />Upload menu</button>
                                        <button type="button" className="dx-btn is-primary" onClick={() => setShowAddModal(true)}><Icon name="plus" size={16} />Add item</button>
                                    </div>
                                </div>
                                {menuItems.length > 0 && (
                                    <div className="dx-seg" role="group" aria-label="Filter by section" style={{ marginBottom: 18 }}>
                                        {["All", ...usedSections].map(cat => (
                                            <button key={cat} type="button" aria-pressed={menuFilter === cat} onClick={() => setMenuFilter(cat)}>
                                                {cat}<span className="num">{cat === "All" ? menuItems.length : menuItems.filter(i => (i.category || "Main") === cat).length}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {filteredMenu.length === 0 ? (
                                    <div className="dx-panel dx-empty">
                                        <h3>Your menu is empty</h3>
                                        <p>Add items one by one, or upload a photo of your printed menu and we'll read it for you.</p>
                                        <div className="dx-row" style={{ justifyContent: "center" }}>
                                            <button type="button" className="dx-btn" onClick={() => setShowUploadMenuModal(true)}>Upload menu</button>
                                            <button type="button" className="dx-btn is-primary" onClick={() => setShowAddModal(true)}>Add first item</button>
                                        </div>
                                    </div>
                                ) : (
                                    [...new Set(filteredMenu.map(i => i.category || "Main"))].map(section => {
                                        const items = filteredMenu.filter(i => (i.category || "Main") === section);
                                        return (
                                            <section key={section} className="dx-menu-section">
                                                <div className="dx-menu-section-head">
                                                    <h2>{section}</h2>
                                                    <span className="dx-hint">{items.filter(i => i.available).length} of {items.length} available</span>
                                                </div>
                                                <div className="dx-panel">
                                                    {items.map(item => (
                                                        <div key={item.id} className={"dx-menu-item" + (item.available ? "" : " is-off")}>
                                                            {item.image_url ? <img className="dx-thumb" src={item.image_url} alt="" /> : <div className="dx-thumb" aria-hidden="true">{item.item_name.charAt(0)}</div>}
                                                            <div className="dx-menu-text" style={{ minWidth: 0 }}>
                                                                <div className="dx-menu-name">{item.item_name} {!item.available && <span className="dx-tag is-plain" style={{ marginLeft: 6 }}>Sold out</span>}</div>
                                                                {item.item_description && <p className="dx-menu-desc">{item.item_description}</p>}
                                                            </div>
                                                            <span className="dx-price">GHS {money(item.item_price)}</span>
                                                            <div className="dx-menu-actions">
                                                                {switchEl(item.available, () => toggleAvailable(item.id, item.available), (item.available ? "Available: " : "Sold out: ") + item.item_name)}
                                                                <button type="button" className="dx-icon-btn" aria-label={"Edit " + item.item_name} onClick={() => { setEditItem({ ...item }); setShowEditModal(true); }}><Icon name="edit" size={17} /></button>
                                                                <button type="button" className="dx-icon-btn" aria-label={"Delete " + item.item_name} onClick={() => deleteMenuItem(item.id)}><Icon name="trash" size={17} /></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* INSIGHTS */}
                        {activePage === "insights" && (
                            <div>
                                <div className="dx-page-head">
                                    <div>
                                        <h1 className="dx-title">Insights</h1>
                                        <p className="dx-sub">What sells, and a way to reach every customer at once.</p>
                                    </div>
                                </div>
                                <div className="dx-kpis" style={{ "--cols": 3, marginBottom: 20 }}>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Customers</p><p className="dx-kpi-value">{insights.totalCustomers}</p><p className="dx-kpi-note">Unique WhatsApp numbers</p></div>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Average order</p><p className="dx-kpi-value"><small>GHS</small>{money(insights.avgOrderValue)}</p></div>
                                    <div className="dx-kpi"><p className="dx-kpi-label">Delivered</p><p className="dx-kpi-value">{Math.round((stats.delivered / (stats.total || 1)) * 100)}<small style={{ marginLeft: 2 }}>%</small></p><p className="dx-kpi-note">{stats.delivered} of {stats.total} orders</p></div>
                                </div>
                                <div className="dx-grid-2">
                                    <section className="dx-panel">
                                        <div className="dx-panel-head"><h2 className="dx-panel-title">Best sellers</h2><span className="dx-hint">Portions ordered</span></div>
                                        <div className="dx-panel-body">
                                            {insights.topItems.length === 0 ? <p className="dx-hint">Your best sellers show up after your first orders.</p> : (
                                                <div className="dx-bars">
                                                    {insights.topItems.map(item => (
                                                        <div key={item.name} className="dx-bar-row">
                                                            <span className="truncate">{item.name}</span>
                                                            <span className="num" style={{ fontWeight: 600 }}>{item.count}</span>
                                                            <div className="dx-bar"><i style={{ width: Math.round((item.count / (insights.topItems[0]?.count || 1)) * 100) + "%" }} /></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                    <section className="dx-panel">
                                        <div className="dx-panel-head"><h2 className="dx-panel-title">Message all customers</h2><span className="dx-hint num">{insights.totalCustomers} people</span></div>
                                        <div className="dx-panel-body dx-stack" style={{ gap: 12 }}>
                                            <label className="dx-field"><span className="sr-only">Message</span>
                                                <textarea className="dx-textarea" value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} maxLength={900}
                                                    placeholder="e.g. Fresh banku and tilapia from 12pm today. Reply 'menu' to order." /></label>
                                            <div className="dx-chat" aria-label="Preview">
                                                <div className="dx-bubble">{broadcastMsg.trim() || <span className="faint">Your message preview</span>}<small>{timeOf(new Date().toISOString())}</small></div>
                                            </div>
                                            <div className="dx-spread">
                                                <span className="dx-hint">Sent on WhatsApp from your shop's bot.</span>
                                                <button type="button" className="dx-btn is-primary" disabled={broadcastSending || !broadcastMsg.trim()} onClick={() => {
                                                    if (window.confirm(`Send this message to ${insights.totalCustomers} customers?`)) sendBroadcast();
                                                }}>{broadcastSending ? "Sending…" : "Send"}</button>
                                            </div>
                                            {broadcastResult && (
                                                <p className={"dx-msg " + (broadcastResult.success ? "is-ok" : "is-error")} role="status">
                                                    {broadcastResult.success ? `Sent to ${broadcastResult.sent} of ${broadcastResult.total} customers.` : "Couldn't send: " + broadcastResult.error}
                                                </p>
                                            )}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}

                        {/* SETTINGS */}
                        {activePage === "settings" && (
                            <div>
                                <div className="dx-page-head">
                                    <div>
                                        <h1 className="dx-title">Settings</h1>
                                        <p className="dx-sub">How your shop, your bot and your payments work.</p>
                                    </div>
                                </div>
                                <div className="dx-settings">
                                    <section className="dx-setting-group">
                                        <div><h2>Shop profile</h2><p>Shown to customers in WhatsApp.</p></div>
                                        <div className="dx-setting-fields">
                                            <div className="dx-row" style={{ gap: 16 }}>
                                                {avatar("is-lg")}
                                                <div className="dx-stack" style={{ gap: 8 }}>
                                                    <label className="dx-btn is-sm" style={{ alignSelf: "flex-start" }}>
                                                        <Icon name="upload" size={15} />{profilePicture ? "Change picture" : "Add a picture"}
                                                        <input type="file" accept="image/*" className="sr-only" onChange={e => setNewProfilePic(e.target.files?.[0] || null)} />
                                                    </label>
                                                    {newProfilePic && <p className="dx-hint accent-text">New picture ready. Save to apply.</p>}
                                                    {profilePicture && !newProfilePic && (
                                                        <button type="button" className="dx-btn is-danger is-sm" style={{ alignSelf: "flex-start" }} onClick={async () => {
                                                            try {
                                                                await supabase.from('businesses').update({ profile_picture: null }).eq('name', businessNameRef.current || businessName);
                                                                setProfilePicture("");
                                                                addNotif("Shop picture removed", "success");
                                                            } catch {
                                                                addNotif("Couldn't remove the picture", "error");
                                                            }
                                                        }}>Remove picture</button>
                                                    )}
                                                </div>
                                            </div>
                                            <label className="dx-field"><span className="dx-label">Contact number</span>
                                                <input className="dx-input num" type="tel" inputMode="tel" value={contactNumber} onChange={e => setContactNumber(e.target.value)} placeholder="024 123 4567" />
                                                <span className="dx-hint">The bot gives customers this number when they need to reach you.</span></label>
                                            <label className="dx-field"><span className="dx-label">MoMo number</span>
                                                <input className="dx-input num" type="tel" inputMode="tel" value={momoNumber} onChange={e => setMomoNumber(e.target.value)} placeholder="024 123 4567" />
                                                <span className="dx-hint">Can be different from your contact number.</span></label>
                                        </div>
                                    </section>

                                    <section className="dx-setting-group">
                                        <div><h2>Opening hours</h2><p>Outside these hours the bot tells customers you're closed and when you open.</p></div>
                                        <div className="dx-setting-fields">
                                            <div className="dx-toggle-row">
                                                <div><strong>Shop is {settings.is_open ? "open" : "closed"}</strong><span>Turn off to stop all orders, e.g. on a day off.</span></div>
                                                {switchEl(settings.is_open, () => setSettings(s => ({ ...s, is_open: !s.is_open })), "Shop open")}
                                            </div>
                                            <div className="dx-form-grid">
                                                <label className="dx-field"><span className="dx-label">Opens at</span>
                                                    <input className="dx-input num" type="time" value={settings.open_time} onChange={e => setSettings(s => ({ ...s, open_time: e.target.value }))} /></label>
                                                <label className="dx-field"><span className="dx-label">Closes at</span>
                                                    <input className="dx-input num" type="time" value={settings.close_time} onChange={e => setSettings(s => ({ ...s, close_time: e.target.value }))} /></label>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="dx-setting-group">
                                        <div><h2>Orders and delivery</h2><p>How customers get their food.</p></div>
                                        <div className="dx-setting-fields">
                                            <div className="dx-toggle-row">
                                                <div><strong>Accept orders automatically</strong><span>{settings.auto_accept ? "On: orders are accepted as they arrive." : "Off: you accept each order yourself."}</span></div>
                                                {switchEl(settings.auto_accept, () => setSettings(s => ({ ...s, auto_accept: !s.auto_accept })), "Accept orders automatically")}
                                            </div>
                                            <div className="dx-toggle-row">
                                                <div><strong>Delivery</strong><span>You or your rider brings the order.</span></div>
                                                {switchEl(settings.delivery_enabled, () => setSettings(s => ({ ...s, delivery_enabled: !s.delivery_enabled })), "Delivery")}
                                            </div>
                                            <div className="dx-toggle-row">
                                                <div><strong>Pickup</strong><span>The customer collects from you.</span></div>
                                                {switchEl(settings.pickup_enabled, () => setSettings(s => ({ ...s, pickup_enabled: !s.pickup_enabled })), "Pickup")}
                                            </div>
                                            <label className="dx-field" style={{ maxWidth: 220 }}><span className="dx-label">Delivery fee (GHS)</span>
                                                <input className="dx-input num" type="number" min="0" step="0.5" inputMode="decimal" value={settings.delivery_fee} onChange={e => setSettings(s => ({ ...s, delivery_fee: e.target.value }))} placeholder="0" />
                                                <span className="dx-hint">0 means free delivery.</span></label>
                                        </div>
                                    </section>

                                    <section className="dx-setting-group">
                                        <div><h2>Payments</h2><p>The ways customers can pay you.</p></div>
                                        <div className="dx-setting-fields">
                                            <div className="dx-toggle-row">
                                                <div><strong>MoMo</strong><span>Customers get a MoMo prompt on their phone.</span></div>
                                                {switchEl(settings.pay_online_enabled, () => setSettings(s => ({ ...s, pay_online_enabled: !s.pay_online_enabled })), "MoMo payments")}
                                            </div>
                                            <div className="dx-toggle-row">
                                                <div><strong>Cash</strong><span>Paid when the order is delivered or picked up.</span></div>
                                                {switchEl(settings.pay_directly_enabled, () => setSettings(s => ({ ...s, pay_directly_enabled: !s.pay_directly_enabled })), "Cash payments")}
                                            </div>
                                        </div>
                                    </section>

                                    <section className="dx-setting-group">
                                        <div><h2>Your bot</h2><p>How the WhatsApp bot introduces itself and talks to customers. Saved separately.</p></div>
                                        <div className="dx-setting-fields">
                                            <label className="dx-field"><span className="dx-label">Bot name</span>
                                                <input className="dx-input" value={botConfig.bot_name} onChange={e => setBotConfig(s => ({ ...s, bot_name: e.target.value }))} placeholder="e.g. Esi" /></label>
                                            <label className="dx-field"><span className="dx-label">Welcome message</span>
                                                <textarea className="dx-textarea" rows={3} value={botConfig.bot_greeting} onChange={e => setBotConfig(s => ({ ...s, bot_greeting: e.target.value }))}
                                                    placeholder="e.g. Hi! Welcome to Auntie Esi's Kitchen. What can I get you today?" /></label>
                                            <label className="dx-field"><span className="dx-label">Tone</span>
                                                <input className="dx-input" value={botConfig.bot_persona} onChange={e => setBotConfig(s => ({ ...s, bot_persona: e.target.value }))} placeholder="e.g. Warm and friendly, short replies" /></label>
                                            <label className="dx-field"><span className="dx-label">Things the bot should know</span>
                                                <textarea className="dx-textarea" rows={3} value={botConfig.bot_special_instructions} onChange={e => setBotConfig(s => ({ ...s, bot_special_instructions: e.target.value }))}
                                                    placeholder="e.g. Waakye is only sold in the morning. Large orders need a day's notice." /></label>
                                            <div className="dx-row">
                                                <button type="button" className="dx-btn is-primary" onClick={saveBotConfig}>Save bot settings</button>
                                                {botConfigSaved && <span className="accent-text dx-row" style={{ gap: 4, fontSize: 13, fontWeight: 550 }}><Icon name="check" size={15} />Saved</span>}
                                            </div>
                                        </div>
                                    </section>

                                    <section className="dx-setting-group">
                                        <div><h2>Password</h2><p>Enter your current password to set a new one.</p></div>
                                        <form className="dx-setting-fields" onSubmit={async e => {
                                            e.preventDefault();
                                            setPasswordError("");
                                            setPasswordSuccess(false);
                                            if (!currentPassword) { setPasswordError("Enter your current password."); return; }
                                            if (!newPassword) { setPasswordError("Enter a new password."); return; }
                                            if (newPassword.length < 6) { setPasswordError("The new password must be at least 6 characters."); return; }
                                            if (newPassword !== confirmPassword) { setPasswordError("The new passwords don't match."); return; }
                                            if (currentPassword === newPassword) { setPasswordError("The new password must be different from the current one."); return; }
                                            setPasswordLoading(true);
                                            try {
                                                const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
                                                if (signInError) {
                                                    setPasswordError("Your current password is incorrect.");
                                                    setPasswordLoading(false);
                                                    return;
                                                }
                                                const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
                                                if (updateError) {
                                                    setPasswordError(updateError.message);
                                                    setPasswordLoading(false);
                                                    return;
                                                }
                                                setPasswordSuccess(true);
                                                setCurrentPassword("");
                                                setNewPassword("");
                                                setConfirmPassword("");
                                                setTimeout(() => setPasswordSuccess(false), 4000);
                                            } catch {
                                                setPasswordError("Something went wrong. Please try again.");
                                            }
                                            setPasswordLoading(false);
                                        }}>
                                            <label className="dx-field"><span className="dx-label">Current password</span>
                                                <input className="dx-input" type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label>
                                            <div className="dx-form-grid">
                                                <label className="dx-field"><span className="dx-label">New password</span>
                                                    <input className="dx-input" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
                                                <label className="dx-field"><span className="dx-label">Confirm new password</span>
                                                    <input className="dx-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>
                                            </div>
                                            {passwordError && <p className="dx-msg is-error" role="alert">{passwordError}</p>}
                                            {passwordSuccess && <p className="dx-msg is-ok" role="status">Password updated.</p>}
                                            <button type="submit" className="dx-btn" style={{ alignSelf: "flex-start" }} disabled={passwordLoading}>{passwordLoading ? "Checking…" : "Update password"}</button>
                                        </form>
                                    </section>
                                </div>
                                <div className="dx-savebar">
                                    <span className="dx-hint">Profile, hours, delivery and payments are saved together.</span>
                                    <button type="button" className="dx-btn is-primary" onClick={saveSettings}>
                                        {settingsSaved ? <><Icon name="check" size={15} />Saved</> : "Save settings"}
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </main>
            </div>

            {/* BOTTOM TABS (phones) */}
            <nav className="dx-tabs-bar" style={{ "--tabs": navItems.length }} aria-label="Main navigation">
                {navItems.map(item => (
                    <button key={item.id} type="button" className="dx-tab" aria-current={activePage === item.id ? "page" : undefined} onClick={() => goTo(item.id)}>
                        <Icon name={item.icon} size={21} />
                        {item.label}
                        {item.badge > 0 && <span className="dx-count">{item.badge}</span>}
                    </button>
                ))}
            </nav>
        </div>
    );
}
