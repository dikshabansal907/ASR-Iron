import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Menu,
  X,
  Trash2,
  Calculator,
  BarChart3,
  FolderPlus,
  PlusCircle,
  History,
  CheckCircle2,
  LogOut,
  UserPlus,
  Copy,
  MessageCircle,
  Send,
  TrendingUp,
  TrendingDown,
  MinusCircle,
  RefreshCw,
  Clock,
  Bell,
  Megaphone,
  Search,
  ChevronDown,
  Printer,
  ClipboardList,
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import {
  enablePushForUser,
  sendSystemPushNotification,
  getPushPermission,
} from "./pushNotifications";
import {
  asrNaturalSizeCompare,
  asrSortSizes,
  num,
  round05,
  inr,
  today,
  ago,
} from "./utils";

// Build the up / down / flat rate-change indicator shown against a market row.
function delta(r) {
  const d = Number((num(r.daily_rate) - num(r.previous_daily_rate)).toFixed(2));
  if (d > 0)
    return { cls: "up", icon: <TrendingUp size={12} />, txt: `+${inr(d)}` };
  if (d < 0)
    return {
      cls: "down",
      icon: <TrendingDown size={12} />,
      txt: `-${inr(Math.abs(d))}`,
    };
  return { cls: "flat", icon: <MinusCircle size={12} />, txt: "No change" };
}
// ASR logo image. `dark` uses the white variant; `loading` adds the pulse animation.
function Logo({ dark = false, loading = false }) {
  return (
    <img
      src={dark ? "/asr-logo-white.png" : "/asr-logo.png"}
      alt="ASR Iron"
      className={`asr-logo ${loading ? "asr-logo-loading" : ""}`}
      draggable="false"
    />
  );
}
export default function App() {
  /* ASR_SCROLL_UNLOCK_SAFETY_START */
  // On mobile browsers the add-item modal locks page scrolling; make sure the
  // lock is always released when the tab/app regains focus or becomes visible.
  useEffect(() => {
    const unlockPage = () => {
      document.documentElement.classList.remove('asr-add-item-lock');
      document.body.classList.remove('asr-add-item-lock');
      document.documentElement.style.removeProperty('overflow');
      document.documentElement.style.removeProperty('position');
      document.documentElement.style.removeProperty('top');
      document.documentElement.style.removeProperty('width');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('position');
      document.body.style.removeProperty('top');
      document.body.style.removeProperty('width');
    };

    unlockPage();
    window.addEventListener('pageshow', unlockPage);
    window.addEventListener('focus', unlockPage);
    document.addEventListener('visibilitychange', unlockPage);

    return () => {
      unlockPage();
      window.removeEventListener('pageshow', unlockPage);
      window.removeEventListener('focus', unlockPage);
      document.removeEventListener('visibilitychange', unlockPage);
    };
  }, []);
  /* ASR_SCROLL_UNLOCK_SAFETY_END */

  // Clear every quotation item and reset the editable quote text.
  // Only the state setters that actually exist in this component are used; the
  // textarea sweep gives instant visual feedback for the controlled quote field.
  const clearAllQuotes = () => {
    setCart([]);
    setQuoteText("");
    setQuoteEdited(true);
    document.querySelectorAll("textarea").forEach((ta) => {
      const meta = [
        ta.className || "",
        ta.id || "",
        ta.name || "",
        ta.placeholder || "",
        ta.value || "",
        ta.parentElement?.textContent || "",
      ]
        .join(" ")
        .toLowerCase();
      if (
        meta.includes("quote") ||
        meta.includes("quotation") ||
        meta.includes("asr iron") ||
        meta.includes("share")
      ) {
        ta.value = "";
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    setToast("Quotation cleared.");
  };

  // Ask for confirmation before clearing all quotation items.
  const asrAskClearAllQuotes = () =>
    askDelete("Delete all added items?", clearAllQuotes);

  // Inject a visible "delete all" trash button next to the Reset/Share buttons.
  // The share panel is rendered without this button in JSX, so it is added here.
  useEffect(() => {
    let stopped = false;
    const addButton = () => {
      if (stopped || document.querySelector(".asr-force-clear-btn")) return;

      const buttons = Array.from(document.querySelectorAll("button"));
      // Prefer the Reset button, but fall back to a share/copy action button.
      let anchor = buttons.find((btn) => {
        const text = (btn.textContent || "").toLowerCase().trim();
        const title = (btn.getAttribute("title") || "").toLowerCase();
        const label = (btn.getAttribute("aria-label") || "").toLowerCase();
        return (
          text.includes("reset") ||
          title.includes("reset") ||
          label.includes("reset")
        );
      });

      if (!anchor) {
        anchor = buttons.find((btn) => {
          const text = (btn.textContent || "").toLowerCase().trim();
          return (
            text.includes("share") ||
            text.includes("whatsapp") ||
            text.includes("copy")
          );
        });
      }
      if (!anchor || !anchor.parentElement) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "asr-force-clear-btn";
      btn.title = "Delete all added items";
      btn.setAttribute("aria-label", "Delete all added items");
      btn.innerHTML = '<span aria-hidden="true">🗑</span>';
      btn.addEventListener("click", asrAskClearAllQuotes);
      anchor.insertAdjacentElement("afterend", btn);
    };

    addButton();
    const timer = setInterval(addButton, 700);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  // ASR_QUANTITY_ZERO_RUNTIME_FIX_V2: show quantity 0 as grey and let typing replace it directly.
  useEffect(() => {
    const isQuantityInput = (input) => {
      if (!input || input.tagName !== "INPUT") return false;
      const meta = [
        input.id || "",
        input.name || "",
        input.placeholder || "",
        input.getAttribute("aria-label") || "",
        input.parentElement?.textContent || "",
        input.closest("label")?.textContent || "",
        input.closest(".field")?.textContent || "",
        input.closest("div")?.textContent || "",
      ]
        .join(" ")
        .toLowerCase();
      return (
        meta.includes("quantity kg") ||
        meta.includes("quantity load") ||
        meta.includes("quantity") ||
        meta.includes("qty")
      );
    };

    const markInput = (input) => {
      if (!isQuantityInput(input)) return;
      input.setAttribute("placeholder", "0");
      input.setAttribute("inputmode", "decimal");

      const syncClass = () => {
        const value = String(input.value ?? "").trim();
        if (value === "0" || value === "")
          input.classList.add("asr-quantity-zero-placeholder");
        else input.classList.remove("asr-quantity-zero-placeholder");
      };

      if (!input.dataset.asrQtyZeroFixed) {
        input.dataset.asrQtyZeroFixed = "true";

        input.addEventListener("focus", () => {
          if (String(input.value ?? "").trim() === "0") {
            setTimeout(() => input.select(), 0);
          }
          syncClass();
        });

        input.addEventListener("click", () => {
          if (String(input.value ?? "").trim() === "0") {
            setTimeout(() => input.select(), 0);
          }
          syncClass();
        });

        input.addEventListener("input", syncClass);
        input.addEventListener("blur", syncClass);
      }

      syncClass();
    };

    const decorateQuantityInputs = () => {
      document.querySelectorAll("input").forEach(markInput);
    };

    decorateQuantityInputs();
    const timer = setTimeout(decorateQuantityInputs, 100);
    const observer = new MutationObserver(() =>
      setTimeout(decorateQuantityInputs, 0),
    );
    if (document.body)
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    window.addEventListener("resize", decorateQuantityInputs);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", decorateQuantityInputs);
    };
  }, []);

  // ASR_FORCE_TEXTAREA_EXPAND_V4: force editable quote textarea to expand and keep bottom visible.
  useEffect(() => {
    let lastTextSnapshot = "";

    const isEditableQuoteTextarea = (el) => {
      if (!el || el.tagName !== "TEXTAREA") return false;
      const meta = [
        el.className || "",
        el.id || "",
        el.name || "",
        el.placeholder || "",
        el.getAttribute("aria-label") || "",
        el.parentElement?.textContent || "",
      ]
        .join(" ")
        .toLowerCase();
      return (
        meta.includes("quote") ||
        meta.includes("quotation") ||
        meta.includes("share") ||
        meta.includes("editable") ||
        (el.value || "").includes("ASR Iron")
      );
    };

    const resizeOne = (el, revealBottom = false) => {
      if (!isEditableQuoteTextarea(el)) return;

      const previousHeight = el.offsetHeight || 0;
      el.style.setProperty("height", "auto", "important");
      el.style.setProperty("overflow-y", "hidden", "important");
      el.style.setProperty("max-height", "none", "important");
      el.style.setProperty("resize", "none", "important");

      const nextHeight = Math.max(el.scrollHeight + 18, 190);
      el.style.setProperty("height", String(nextHeight) + "px", "important");

      const textChanged = (el.value || "") !== lastTextSnapshot;
      const grew = nextHeight > previousHeight + 6;
      if (textChanged) lastTextSnapshot = el.value || "";

      if (
        (revealBottom || textChanged || grew) &&
        document.activeElement !== el
      ) {
        requestAnimationFrame(() => {
          try {
            const rect = el.getBoundingClientRect();
            const bottomSpace = window.innerHeight - rect.bottom;
            if (bottomSpace < 95) {
            }
          } catch {}
        });
      }
    };

    const resizeAll = (revealBottom = false) => {
      document
        .querySelectorAll("textarea")
        .forEach((el) => resizeOne(el, revealBottom));
    };

    const onInput = (event) => {
      if (event.target && event.target.tagName === "TEXTAREA")
        resizeOne(event.target, true);
    };

    resizeAll(false);
    requestAnimationFrame(() => resizeAll(true));
    const timer1 = setTimeout(() => resizeAll(true), 60);
    const timer2 = setTimeout(() => resizeAll(true), 250);

    const observer = new MutationObserver(() => {
      requestAnimationFrame(() => resizeAll(true));
    });
    if (document.body)
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

    document.addEventListener("input", onInput, true);
    window.addEventListener("resize", resizeAll);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      observer.disconnect();
      document.removeEventListener("input", onInput, true);
      window.removeEventListener("resize", resizeAll);
    };
  }, []);

  const [screen, setScreen] = useState("login"),
    [user, setUser] = useState(null),
    [fabricators, setFabricators] = useState([]),
    [businessUsers, setBusinessUsers] = useState([]),
    [submissions, setSubmissions] = useState([]),
    [items, setItems] = useState([]),
    [categories, setCategories] = useState([]),
    [rateItems, setRateItems] = useState([]),
    [loading, setLoading] = useState(true),
    [pullRefreshDistance, setPullRefreshDistance] = useState(0),
    [toast, setToast] = useState(""),
    [confirmBox, setConfirmBox] = useState(null),
    [sideOpen, setSideOpen] = useState(false);
  const pullRefreshDistanceRef = useRef(0);
  // 2) Add this state inside App():
  const [pushPermission, setPushPermission] = useState(getPushPermission());

  // 3) Add this function inside App():
  async function enablePhoneNotifications() {
    const subscription = await enablePushForUser(user, setToast);
    setPushPermission(getPushPermission());
    return subscription;
  }
  const [loginId, setLoginId] = useState(""),
    [loginPassword, setLoginPassword] = useState(""),
    [loginError, setLoginError] = useState(""),
    [signup, setSignup] = useState({
      registrationType: "partner",
      name: "",
      userId: "",
      mobile: "",
      address: "",
      password: "",
    }),
    [signupOk, setSignupOk] = useState(false),
    [signupError, setSignupError] = useState("");
  const [adminTab, setAdminTab] = useState("calculator"),
    [fabTab, setFabTab] = useState("apply"),
    [categoryId, setCategoryId] = useState(""),
    [sizeId, setSizeId] = useState(""),
    [qty, setQty] = useState(""),
    [qtyUnit, setQtyUnit] = useState("kg"),
    [margin, setMargin] = useState(() => {
    try {
      return localStorage.getItem('asr_calculator_margin') ?? '';
    } catch {
      return '';
    }
  }),
    [cart, setCart] = useState([]),
    [quoteText, setQuoteText] = useState(""),
    [quoteEdited, setQuoteEdited] = useState(false);
  const [orderFirms, setOrderFirms] = useState([]),
    [orders, setOrders] = useState([]),
    [orderFirmId, setOrderFirmId] = useState(""),
    [newFirmName, setNewFirmName] = useState(""),
    [orderStatusFilter, setOrderStatusFilter] = useState("Pending"),
    [orderAlert, setOrderAlert] = useState(null);
  const [sizePickerOpen, setSizePickerOpen] = useState(false),
    [sizePickerQuery, setSizePickerQuery] = useState("");
  const [newSegment, setNewSegment] = useState({
      name: "",
      rate: "",
      freight: "",
    }),
    [newSizeName, setNewSizeName] = useState(""),
    [newSizeDiff, setNewSizeDiff] = useState(""),
    [marketSearch, setMarketSearch] = useState(""),
    [sizeSearch, setSizeSearch] = useState(""),
    [newItem, setNewItem] = useState({ name: "", unit: "kg", points: "" });
  const [claimItemId, setClaimItemId] = useState(""),
    [claimQty, setClaimQty] = useState(""),
    [redemptions, setRedemptions] = useState([]),
    [redeemModalOpen, setRedeemModalOpen] = useState(false),
    [redeemPoints, setRedeemPoints] = useState(""),
    [redeemError, setRedeemError] = useState(""),
    [redeemNarrations, setRedeemNarrations] = useState({}),
    [siteName, setSiteName] = useState(""),
    [claimOk, setClaimOk] = useState(false);
  // Which approved fabricator's history panel is currently expanded (admin view).
  const [openFabId, setOpenFabId] = useState(null),
    [fabSearch, setFabSearch] = useState("");
  const [notifications, setNotifications] = useState([]),
    [newNotification, setNewNotification] = useState({
      target: "all",
      fabricator_id: "",
      title: "",
      message: "",
    });
  const [hiddenNotificationIds, setHiddenNotificationIds] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("asr_hidden_notification_ids") || "[]",
      );
    } catch {
      return [];
    }
  });

  const [alertPromptOpen, setAlertPromptOpen] = useState(false);

  const [alertsPreference, setAlertsPreference] = useState(
    () => localStorage.getItem("asr_alerts_preference") || "on",
  );

  const notificationKey = (n) =>
    String(n?.id || `${n?.title || ""}-${n?.created_at || ""}`);
  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) =>
        String(a.name).localeCompare(String(b.name), undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      ),
    [categories],
  );
  const marketCategories = useMemo(
    () =>
      sortedCategories.filter((c) =>
        String(c.name).toLowerCase().includes(marketSearch.toLowerCase()),
      ),
    [sortedCategories, marketSearch],
  );
  const visibleSizes = useMemo(() => {
    let rows = asrSortSizes(rateItems.filter((x) => x.category_id === categoryId));
    if (sizeSearch)
      rows = rows.filter((x) =>
        String(x.name).toLowerCase().includes(sizeSearch.toLowerCase()),
      );
    return rows;
  }, [rateItems, categoryId, sizeSearch]);
  const activeFabricator = useMemo(
    () => fabricators.find((f) => f.id === user?.id) || user,
    [fabricators, user],
  );
  const activeBusiness = useMemo(
    () =>
      businessUsers.find(
        (b) =>
          String(b.id) === String(user?.id) ||
          (user?.userId &&
            String(b.user_id || '').trim().toLowerCase() ===
              String(user.userId).trim().toLowerCase()),
      ) || user,
    [businessUsers, user],
  );
  const myClaims = useMemo(
    () => submissions.filter((s) => s.fabricator_id === user?.id),
    [submissions, user],
  );
  const pendingPoints = useMemo(
    () =>
      myClaims
        .filter((s) => s.status === "Pending")
        .reduce((sum, s) => sum + num(s.points_earned), 0),
    [myClaims],
  );
  const myRedemptions = useMemo(
    () => redemptions.filter((r) => String(r.fabricator_id) === String(user?.id)),
    [redemptions, user],
  );
  const pendingRedemptionPoints = useMemo(
    () => myRedemptions
      .filter((r) => String(r.status).toLowerCase() === "pending")
      .reduce((sum, r) => sum + num(r.points ?? r.points_requested), 0),
    [myRedemptions],
  );
  const availableRedemptionPoints = Math.max(
    0,
    num(activeFabricator?.total_points) - pendingRedemptionPoints,
  );
  const visibleNotifications = useMemo(() => {
    if (!user) return [];
    const role = String(user.role || "").toLowerCase();
    const hidden = new Set(hiddenNotificationIds);
    return notifications.filter(
      (n) =>
        !hidden.has(notificationKey(n)) &&
        (n.target === "all" ||
          n.target === role ||
          (role === "fabricator" && n.target === "fabricator") ||
          (role === "fabricator" && n.target === `fabricator:${user.id}`)),
    );
  }, [notifications, user, hiddenNotificationIds]);
  async function loadNotifications() {
    try {
      const local = JSON.parse(
        localStorage.getItem("asr_notifications") || "[]",
      );
      if (!supabase) {
        setNotifications(local);
        return;
      }
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        setNotifications(local);
        return;
      }
      setNotifications(data || []);
    } catch {
      setNotifications([]);
    }
  }
  async function loadOrderData() {
    if (!supabase) return;
    const [firmsResult, ordersResult] = await Promise.all([
      supabase.from("order_firms").select("*").order("name"),
      supabase
        .from("orders")
        .select("*")
        .order("order_datetime", { ascending: false }),
    ]);
    if (!firmsResult.error) setOrderFirms(firmsResult.data || []);
    if (!ordersResult.error) setOrders(ordersResult.data || []);
  }
  async function saveNotificationLocal(payload) {
    const existing = JSON.parse(
      localStorage.getItem("asr_notifications") || "[]",
    );
    const row = {
      ...payload,
      id: `local_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    const updated = [row, ...existing];
    localStorage.setItem("asr_notifications", JSON.stringify(updated));
    setNotifications(updated);
    return row;
  }
  /* ASR_REDEMPTION_REFRESH_AFTER_STATE_START */
  useEffect(() => {
    if (!user || !supabase) return;

    const role = String(user.role || '').toLowerCase();
    const shouldRefresh =
      (role === 'admin' && adminTab === 'redemptions') ||
      (role === 'fabricator' && fabTab === 'history');

    if (!shouldRefresh) return;

    let cancelled = false;

    const refresh = async () => {
      const { data, error } = await supabase
        .from('redemption_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error('Could not load redemption requests', error);
        setToast(error.message || 'Could not load redemption requests.');
        return;
      }

      setRedemptions(data || []);
    };

    refresh();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role, adminTab, fabTab]);
  /* ASR_REDEMPTION_REFRESH_AFTER_STATE_END */

  async function loadAll() {
    setLoading(true);
    if (!supabase) {
      await loadNotifications();
      setToast("Supabase env missing. Add .env.local and restart.");
      setLoading(false);
      return;
    }
    const [f, s, i, c, r, rd, bu] = await Promise.all([
      supabase.from("fabricators").select("*").order("created_at"),
      supabase
        .from("submissions")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("incentive_items").select("*").order("created_at"),
      supabase.from("rate_categories").select("*").order("name"),
      supabase.from("rate_items").select("*").order("created_at"),
      supabase.from("redemption_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("business_users").select("id, business_name, user_id, mobile, address, status, margin, created_at, updated_at").order("created_at", { ascending: false }),
    ]);
    if (f.error || s.error || i.error || c.error || r.error || rd.error || bu.error)
      setToast("Database load failed. Check Supabase/RLS and run the redemption SQL.");
    else {
      setFabricators(f.data || []);
      setSubmissions(s.data || []);
      setItems(i.data || []);
      setCategories(c.data || []);
      setRateItems(r.data || []);
      setRedemptions(rd.data || []);
      setBusinessUsers(bu.data || []);
      if (!categoryId && c.data?.length) setCategoryId(c.data[0].id);
    }
    await loadNotifications();
    await loadOrderData();
    setLoading(false);
  }
  useEffect(() => {
    loadAll();
    const saved = JSON.parse(localStorage.getItem("asrLogin") || "null");
    if (saved?.role === "fabricator" && saved?.tab === "alerts") saved.tab = "apply";
    /* ASR_SALESMAN_STALE_ALERTS_GUARD_START */
    if (saved?.role === "salesman" && saved?.tab === "alerts") saved.tab = "calculator";
    /* ASR_SALESMAN_STALE_ALERTS_GUARD_END */
    if (saved?.auto) {
      setLoginId(saved.loginId || "");
      setLoginPassword(saved.loginPassword || "");
      setUser(saved.user);
      setScreen(
        saved.role === "admin"
          ? "admin"
          : saved.role === "salesman"
            ? "salesman"
            : "fabricator",
      );
      setAdminTab("calculator");
      setFabTab(saved.role === "salesman" ? "calculator" : "apply");
    }
    if ("serviceWorker" in navigator)
      window.addEventListener("load", () =>
        navigator.serviceWorker.register("/sw.js").catch(() => {}),
      );
  }, []);
  useEffect(() => {
    const clearRestoredCalculator = (event) => {
      if (!event.persisted) return;
      setCart([]);
      setQuoteText("");
      setQuoteEdited(true);
      setSizeId("");
      setQty("");
    };
    window.addEventListener("pageshow", clearRestoredCalculator);
    return () => window.removeEventListener("pageshow", clearRestoredCalculator);
  }, []);
  useEffect(() => {
    let startY = 0;
    let startX = 0;
    let tracking = false;

    const onTouchStart = (event) => {
      const target = event.target;
      if (target.closest("input, textarea, select, button")) return;
      const scrollTop = document.scrollingElement?.scrollTop || window.scrollY;
      if (scrollTop > 0) return;
      startY = event.touches[0]?.clientY || 0;
      startX = event.touches[0]?.clientX || 0;
      tracking = true;
    };

    const onTouchMove = (event) => {
      if (!tracking) return;
      const touch = event.touches[0];
      const distance = touch.clientY - startY;
      const horizontalDistance = Math.abs(touch.clientX - startX);
      if (distance <= 0 || horizontalDistance > distance) {
        pullRefreshDistanceRef.current = 0;
        setPullRefreshDistance(0);
        return;
      }
      const nextDistance = Math.min(distance, 92);
      pullRefreshDistanceRef.current = nextDistance;
      setPullRefreshDistance(nextDistance);
    };

    const onTouchEnd = () => {
      if (!tracking) return;
      tracking = false;
      const shouldRefresh = pullRefreshDistanceRef.current >= 70;
      pullRefreshDistanceRef.current = 0;
      setPullRefreshDistance(0);
      if (shouldRefresh) {
        setCart([]);
        setQuoteText("");
        setQuoteEdited(true);
        setSizeId("");
        setQty("");
        loadAll();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!quoteEdited) setQuoteText(buildQuote());
  }, [cart, quoteEdited]);
  useEffect(() => {
    if (!user || !visibleNotifications.length) return;
    const seenKey = `asr_seen_notification_ids_${user.role}_${user.id || user.name || "user"}`;
    let seen = [];
    try {
      seen = JSON.parse(localStorage.getItem(seenKey) || "[]");
    } catch {
      seen = [];
    }
    const seenSet = new Set(seen);
    // Notifications are sorted newest-first, so the first unseen one is the latest.
    const newest = visibleNotifications.find(
      (n) => !seenSet.has(notificationKey(n)),
    );
    if (!newest) return;
    // Mark every currently visible notification as seen in one pass so older
    // ones don't trickle out one-by-one on each app reopen.
    const updated = Array.from(
      new Set([...visibleNotifications.map(notificationKey), ...seen]),
    ).slice(0, 200);
    localStorage.setItem(seenKey, JSON.stringify(updated));
    if (String(newest.title).toLowerCase().includes("new order")) {
      setOrderAlert(newest);
    } else {
      setToast(`🔔 ${newest.title}: ${newest.message}`);
    }
  }, [visibleNotifications, user]);
  useEffect(() => {
    if (!orderAlert) return;
    let audioContext;
    const ring = () => {
      try {
        audioContext ||= new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.32);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.34);
      } catch {}
    };
    ring();
    const timer = setInterval(ring, 1400);
    return () => {
      clearInterval(timer);
      audioContext?.close().catch(() => {});
    };
  }, [orderAlert]);
  // Prompt to enable phone alerts each time the app opens while they are off.
  useEffect(() => {
    if (!user) return;
    const permission =
      typeof Notification !== "undefined"
        ? Notification.permission
        : pushPermission;
    const alertsOn = alertsPreference !== "off" && permission === "granted";
    if (alertsOn) return;
    const t = setTimeout(() => setAlertPromptOpen(true), 800);
    return () => clearTimeout(t);
  }, [user?.id]);
  useEffect(() => {
    const role = String(user?.role || "").toLowerCase();
    if (!user || !["admin", "salesman"].includes(role)) return;
    const timer = setInterval(loadNotifications, 15000);
    return () => clearInterval(timer);
  }, [user?.id, user?.role]);
  const getCategory = (id) => categories.find((c) => c.id === id),
    unitRate = (catId, diff) => {
      const c = getCategory(catId) || {};
      return round05((num(c.daily_rate) + num(diff) + num(c.freight)) * 1.18);
    },
    askDelete = (title, onYes) => setConfirmBox({ title, onYes }),
    saveLogin = (role, u) =>
      localStorage.setItem(
        "asrLogin",
        JSON.stringify({ role, user: u, loginId, loginPassword, auto: true }),
      );
  function logout() {
    localStorage.removeItem("asrLogin");
    setUser(null);
    setScreen("login");
    setLoginId("");
    setLoginPassword("");
  }
  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    if (loginId.trim().toLowerCase() === "admin" && loginPassword === "admin") {
      const u = { id: "admin", name: "Admin", role: "admin" };
      setUser(u);
      setScreen("admin");
      setAdminTab("calculator");
      saveLogin("admin", u);
      return;
    }
const { data: businessRows, error: businessError } = await supabase.rpc("login_business", {
      p_user_id: loginId.trim(),
      p_password: loginPassword,
    });
    const business = Array.isArray(businessRows) ? businessRows[0] : businessRows;
    if (!businessError && business) {
      if (business.status !== "Approved") {
        return setLoginError(
          `Your Business account is ${business.status}. Admin approval is required.`,
        );
      }

      // Always fetch the latest Business row so the assigned Margin is not
      // taken from an older RPC/session payload.
      const loginUserId = String(
        business.login_user_id || business.user_id || loginId.trim(),
      ).trim();

      let latestBusiness = null;
      const { data: latestRow, error: latestError } = await supabase
        .from("business_users")
        .select(
          "id, business_name, user_id, mobile, address, status, margin, created_at, updated_at",
        )
        .ilike("user_id", loginUserId)
        .maybeSingle();

      if (!latestError && latestRow) latestBusiness = latestRow;

      const profile = latestBusiness || business;
      const latestMargin = num(profile.margin ?? business.margin);

      const u = {
        id: profile.id || business.business_id,
        name: profile.business_name || business.business_name,
        userId: profile.user_id || business.login_user_id || loginUserId,
        mobile: profile.mobile || business.mobile,
        address: profile.address || business.address,
        status: profile.status || business.status,
        margin: latestMargin,
        role: "salesman",
      };

      if (latestBusiness) {
        setBusinessUsers((prev) => {
          const exists = prev.some(
            (row) => String(row.id) === String(latestBusiness.id),
          );
          return exists
            ? prev.map((row) =>
                String(row.id) === String(latestBusiness.id)
                  ? latestBusiness
                  : row,
              )
            : [latestBusiness, ...prev];
        });
      }

      setUser(u);
      setScreen("salesman");
      setFabTab("calculator");
      saveLogin("salesman", u);
      return;
    }

    const { data, error } = await supabase
      .from("fabricators")
      .select("*")
      .eq("mobile", loginId.trim())
      .maybeSingle();
    if (error || !data)
      return setLoginError("No profile registered under this mobile number.");
    if (data.password !== loginPassword)
      return setLoginError("Incorrect password.");
    if (data.status !== "Approved")
      return setLoginError(
        `Your profile is ${data.status}. Admin approval is required.`,
      );
    const u = { ...data, role: "fabricator" };
    setUser(u);
    setScreen("fabricator");
    setFabTab("apply");
    saveLogin("fabricator", u);
  }
  async function handleSignup(e) {
    e.preventDefault();
    setSignupError("");
    if (signup.registrationType === "business") {
      if (!signup.userId.trim()) return setSignupError("User ID is required.");
      const { error } = await supabase.rpc("register_business", {
        p_business_name: signup.name.trim(),
        p_user_id: signup.userId.trim(),
        p_mobile: signup.mobile.trim(),
        p_address: signup.address.trim(),
        p_password: signup.password,
      });
      if (error) return setSignupError(error.message);
    } else {
      const { error } = await supabase.from("fabricators").insert({
        name: signup.name.trim(),
        mobile: signup.mobile.trim(),
        address: signup.address.trim(),
        password: signup.password,
        total_points: 0,
        status: "Pending",
      });
      if (error) return setSignupError(error.message);
    }
    setSignupOk(true);
    setSignup({
      registrationType: signup.registrationType,
      name: "",
      userId: "",
      mobile: "",
      address: "",
      password: "",
    });
    await loadAll();
  }
  async function submitClaim(e) {
    e.preventDefault();
    if (!siteName.trim()) {
      setToast("Please enter the Site Name.");
      return;
    }
    const item = items.find((i) => i.id === claimItemId);
    if (!item || !claimQty || Number(claimQty) <= 0) return;
    const q = Number(claimQty),
      points = q * num(item.points_per_unit);
    const payload = {
      fabricator_id: user.id,
      site_name: siteName.trim(),
      item_id: item.id,
      item_name: item.name,
      quantity: q,
      unit: item.unit,
      points_earned: points,
      status: "Pending",
    };
    const { data, error } = await supabase
      .from("submissions")
      .insert(payload)
      .select()
      .single();
    if (error) return setToast(error.message);
    setSubmissions((prev) => [data, ...prev]);
    setClaimItemId("");
    setClaimQty("");
    setSiteName("");
    setClaimOk(true);
    setToast("Claim submitted for admin approval.");
    setTimeout(() => setClaimOk(false), 1800);
  }
  async function sendNotification(e) {
    e.preventDefault();
    if (!newNotification.title.trim() || !newNotification.message.trim())
      return setToast("Enter notification title and message.");
    let target = newNotification.target;
    if (target === "specific_fabricator") {
      if (!newNotification.fabricator_id)
        return setToast("Select a fabricator.");
      target = `fabricator:${newNotification.fabricator_id}`;
    }
    const payload = {
      target,
      title: newNotification.title.trim(),
      message: newNotification.message.trim(),
      created_by: user?.name || "Admin",
      created_at: new Date().toISOString(),
    };
    if (!supabase) {
      await saveNotificationLocal(payload);
      setToast("Notification saved locally.");
      setNewNotification({
        target: "all",
        fabricator_id: "",
        title: "",
        message: "",
      });
      return;
    }
    const { data, error } = await supabase
      .from("notifications")
      .insert(payload)
      .select()
      .single();
    if (error) {
      await saveNotificationLocal(payload);
      setToast(
        "Notifications table missing. Saved locally. Run SQL setup for live notifications.",
      );
    } else {
      setNotifications((prev) => [data, ...prev]);
      setToast("Notification sent.");
    }
    setNewNotification({
      target: "all",
      fabricator_id: "",
      title: "",
      message: "",
    });
    try {
      await sendSystemPushNotification({
        target,
        title: newNotification.title.trim(),
        message: newNotification.message.trim(),
      });
    } catch (err) {
      console.warn("Push send failed", err);
    }
  }
  async function placeOrder(e) {
    e.preventDefault();
    const firmName = newFirmName.trim() || orderFirms.find((firm) => firm.id === orderFirmId)?.name;
    if (!firmName) return setToast("Select or enter a firm name.");
    if (!cart.length) return setToast("Add at least one calculator item before placing an order.");
    if (!supabase) return setToast("Supabase is not connected. Cannot place order.");

    let firm = orderFirms.find((row) => row.id === orderFirmId);
    if (!firm || firm.name.toLowerCase() !== firmName.toLowerCase()) {
      const { data, error } = await supabase
        .from("order_firms")
        .upsert({ name: firmName, created_by: user?.name || user?.id || "user" }, { onConflict: "name" })
        .select()
        .single();
      if (error) return setToast(error.message || "Could not save firm name.");
      firm = data;
      setOrderFirms((prev) => [firm, ...prev.filter((row) => row.id !== firm.id)].sort((a, b) => a.name.localeCompare(b.name)));
    }

    const total = cart.reduce((sum, item) => sum + num(item.total), 0);
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        firm_id: firm.id,
        firm_name: firm.name,
        placed_by_id: String(user?.id || ""),
        placed_by_name: user?.name || user?.userId || "User",
        placed_by_role: String(user?.role || "salesman").toLowerCase(),
        order_datetime: new Date().toISOString(),
        status: "Pending",
        total,
        items: cart,
        quote_text: getCurrentQuoteText(),
      })
      .select()
      .single();
    if (orderError) return setToast(orderError.message || "Could not place order.");

    setOrders((prev) => [order, ...prev]);
    const notificationPayload = {
      title: "New order placed",
      message: `${firm.name} order for ${inr(total)} is pending approval.`,
      created_by: user?.name || "User",
      created_at: new Date().toISOString(),
    };
    await supabase.from("notifications").insert([
      { ...notificationPayload, target: "admin" },
      { ...notificationPayload, target: "salesman" },
    ]);
    await Promise.all([
      sendSystemPushNotification({ target: "admin", title: notificationPayload.title, message: notificationPayload.message }),
      sendSystemPushNotification({ target: "salesman", title: notificationPayload.title, message: notificationPayload.message }),
    ]);
    setCart([]);
    setQuoteText("");
    setQuoteEdited(false);
    setOrderFirmId("");
    setNewFirmName("");
    setToast("Order placed and sent for approval.");
  }
  async function updateOrderStatus(order, status) {
    if (!supabase) return;
    const { error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    if (error) return setToast(error.message || "Could not update order status.");
    setOrders((prev) => prev.map((row) => (row.id === order.id ? { ...row, status } : row)));
    setToast(`Order marked ${status.toLowerCase()}.`);
  }
  function orderInvoiceItems(order) {
    return Array.isArray(order?.items) ? order.items : [];
  }
  function orderPage() {
    const filteredOrders = orders.filter(
      (order) => orderStatusFilter === "all" || order.status === orderStatusFilter,
    );
    const selectedFirm = orderFirms.find((firm) => firm.id === orderFirmId);
    return (
      <div className="orders-page">
        <div className="order-compose area">
          <div className="order-page-heading">
            <div>
              <h2 className="section-title">Place Order</h2>
              <p className="section-note">Create an order from the items in the calculator.</p>
            </div>
          </div>
          <form onSubmit={placeOrder}>
            <div className="order-form-grid">
              <div className="field">
                <label className="label">Firm</label>
                <select className="input" value={orderFirmId} onChange={(e) => setOrderFirmId(e.target.value)}>
                  <option value="">Select saved firm</option>
                  {orderFirms.map((firm) => <option key={firm.id} value={firm.id}>{firm.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">New firm name</label>
                <input className="input" value={newFirmName} onChange={(e) => setNewFirmName(e.target.value)} placeholder="Enter to save a new firm" />
              </div>
            </div>
            {selectedFirm && !newFirmName && <div className="order-selected-firm">Selected firm: <b>{selectedFirm.name}</b></div>}
            <div className="order-invoice">
              <div className="order-invoice-head">
                <div><span>Invoice preview</span><b>{newFirmName.trim() || selectedFirm?.name || "Select a firm"}</b></div>
              </div>
              <textarea
                className="input order-quote-editor"
                value={quoteText}
                onChange={(e) => {
                  setQuoteText(e.target.value);
                  setQuoteEdited(true);
                }}
                aria-label="Editable order quotation"
              />
            </div>
            <button className="btn btn-primary order-submit-btn" disabled={!cart.length}>Place Order</button>
          </form>
        </div>
        <div className="orders-history area">
          <div className="order-history-head">
            <h2 className="section-title">Order History</h2>
            <select className="order-filter" value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
              <option value="all">All</option><option value="Pending">Pending</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option>
            </select>
          </div>
          {filteredOrders.length === 0 ? <div className="empty">No orders found.</div> : filteredOrders.map((order) => (
            <div className="order-history-card" key={order.id}>
              <div className="order-history-card-head">
                <div><b>{order.firm_name}</b><small>{new Date(order.order_datetime).toLocaleString("en-IN")}</small><small>By {order.placed_by_name || "User"}</small></div>
                <div><span className={`order-status-badge ${String(order.status).toLowerCase()}`}>{order.status}</span></div>
              </div>
              <div className="order-history-quote">{order.quote_text || orderInvoiceItems(order).map((item) => `${item.itemName} · ${inr(item.total)}`).join("\n")}</div>
              {["admin", "salesman"].includes(String(user?.role).toLowerCase()) && order.status === "Pending" && (
                <div className="order-status-actions"><button className="btn btn-danger" onClick={() => updateOrderStatus(order, "Cancelled")}>Cancel</button><button className="btn btn-success" onClick={() => updateOrderStatus(order, "Completed")}>Complete</button></div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
  async function deleteNotification(n) {
    askDelete(`Delete notification ${n.title}?`, async () => {
      if (String(n.id || "").startsWith("local_") || !supabase) {
        const updated = notifications.filter((x) => x.id !== n.id);
        localStorage.setItem("asr_notifications", JSON.stringify(updated));
        setNotifications(updated);
        setToast("Notification deleted.");
        return;
      }
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", n.id);
      if (error) return setToast(error.message);
      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
      setToast("Notification deleted.");
    });
  }
  function clearNotificationHistory() {
    const rows = user?.role === "Admin" ? notifications : visibleNotifications;
    if (!rows.length) return setToast("No notifications to clear.");
    askDelete("Clear notification history on this device?", () => {
      const ids = rows.map(notificationKey);
      const merged = Array.from(new Set([...hiddenNotificationIds, ...ids]));
      localStorage.setItem(
        "asr_hidden_notification_ids",
        JSON.stringify(merged),
      );
      setHiddenNotificationIds(merged);
      setToast("Notification history cleared from this device.");
    });
  }
  async function refreshRedemptionsOnly() {
    const { data, error } = await supabase
      .from("redemption_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Could not load redemption requests", error);
      setToast(error.message || "Could not load redemption requests.");
      return [];
    }

    setRedemptions(data || []);
    return data || [];
  }

  async function submitRedemptionRequest(e) {
    e.preventDefault();
    setRedeemError("");

    const requested = num(redeemPoints);
    if (requested <= 0) {
      setRedeemError("Enter points greater than zero.");
      return;
    }
    if (requested > availableRedemptionPoints) {
      setRedeemError(
        "Insufficient points. Available for redemption: " +
          availableRedemptionPoints.toLocaleString("en-IN") +
          " pts.",
      );
      return;
    }

    try {
      const { data, error } = await supabase.rpc("request_redemption", {
        p_fabricator_id: String(user.id),
        p_points: requested,
      });

      if (error) {
        setRedeemError(error.message || "Could not submit redemption request.");
        return;
      }

      const createdId =
        typeof data === "string" || typeof data === "number"
          ? data
          : data?.id || data?.request_id;

      const optimisticRow = {
        id: createdId || "pending-" + Date.now(),
        fabricator_id: String(user.id),
        points: requested,
        status: "Pending",
        narration: null,
        created_at: new Date().toISOString(),
      };

      setRedemptions((prev) => [
        optimisticRow,
        ...prev.filter((row) => String(row.id) !== String(optimisticRow.id)),
      ]);
      setRedeemPoints("");
      setRedeemError("");
      setRedeemModalOpen(false);
      await refreshRedemptionsOnly();
      setFabTab("history");
      setToast("Redemption request sent for admin approval.");
      await loadAll();
    } catch (error) {
      console.error("Redemption request failed", error);
      setRedeemError(error?.message || "Could not submit redemption request.");
    }
  }

  async function approveRedemption(row) {
    const narration = String(redeemNarrations[row.id] || "").trim();
    if (!narration) {
      setToast("Enter redemption narration, for example UPI or Cash.");
      return;
    }
    const { error } = await supabase.rpc("approve_redemption", {
      p_redemption_id: row.id,
      p_narration: narration,
    });
    if (error) return setToast(error.message);
    setRedeemNarrations((prev) => ({ ...prev, [row.id]: "" }));
    setToast("Redemption approved and points deducted.");
    await loadAll();
  }

  async function rejectRedemption(row) {
    const narration = String(redeemNarrations[row.id] || "").trim();
    if (!narration) {
      setToast("Enter a narration/reason before rejecting.");
      return;
    }
    const { error } = await supabase.rpc("reject_redemption", {
      p_redemption_id: row.id,
      p_narration: narration,
    });
    if (error) return setToast(error.message);
    setRedeemNarrations((prev) => ({ ...prev, [row.id]: "" }));
    setRedemptions((prev) =>
      prev.map((x) =>
        x.id === row.id ? { ...x, status: "Rejected", narration } : x,
      ),
    );
    setToast("Redemption request rejected.");
  }

  /* ASR_EDIT_CATEGORY_NAME_START */
  async function updateCategoryName(row, nextValue) {
    const nextName = String(nextValue || '').trim();
    const currentName = String(row?.name || '').trim();

    if (!nextName) {
      setToast('Category name cannot be empty.');
      return false;
    }

    if (nextName === currentName) return true;

    const duplicate = categories.some(
      (category) =>
        category.id !== row.id &&
        String(category.name || '').trim().toLowerCase() === nextName.toLowerCase(),
    );

    if (duplicate) {
      setToast('A category with this name already exists.');
      return false;
    }

    const { error } = await supabase
      .from('rate_categories')
      .update({ name: nextName })
      .eq('id', row.id);

    if (error) {
      setToast(error.message || 'Could not update category name.');
      return false;
    }

    setCategories((prev) =>
      prev.map((category) =>
        category.id === row.id ? { ...category, name: nextName } : category,
      ),
    );

    setCart((prev) =>
      prev.map((item) =>
        item.category === currentName ? { ...item, category: nextName } : item,
      ),
    );

    setToast('Category name updated.');
    return true;
  }
  /* ASR_EDIT_CATEGORY_NAME_END */

  async function updateMarketRate(row, newRate, newFreight = row.freight) {
    const patch = {
      previous_daily_rate: num(row.daily_rate),
      daily_rate: num(newRate),
      freight: num(newFreight),
      updated_at: new Date().toISOString(),
    };
    setCategories((prev) =>
      prev.map((x) => (x.id === row.id ? { ...x, ...patch } : x)),
    );
    const { error } = await supabase
      .from("rate_categories")
      .update(patch)
      .eq("id", row.id);
    if (error) {
      setToast(error.message);
      await loadAll();
    }
  }
  async function addMarket(e) {
    e.preventDefault();
    if (!newSegment.name.trim()) return;
    const initial = num(newSegment.rate);
    const { data, error } = await supabase
      .from("rate_categories")
      .insert({
        name: newSegment.name.trim(),
        daily_rate: initial,
        previous_daily_rate: initial,
        freight: num(newSegment.freight),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) return setToast(error.message);
    setCategories((prev) => [...prev, data]);
    setNewSegment({ name: "", rate: "", freight: "" });
  }
  function deleteSegment(row) {
    askDelete(`Delete ${row.name}?`, async () => {
      await supabase.from("rate_items").delete().eq("category_id", row.id);
      const { error } = await supabase
        .from("rate_categories")
        .delete()
        .eq("id", row.id);
      if (error) return setToast(error.message);
      setCategories((prev) => prev.filter((x) => x.id !== row.id));
      setRateItems((prev) => prev.filter((x) => x.category_id !== row.id));
      setCart((prev) => prev.filter((x) => x.category !== row.name));
      setToast(`${row.name} deleted.`);
    });
  }
  async function addSize(e) {
    e.preventDefault();
    if (!newSizeName.trim() || !categoryId) return;
    const { data, error } = await supabase
      .from("rate_items")
      .insert({
        category_id: categoryId,
        name: newSizeName,
        fixed_difference: num(newSizeDiff),
      })
      .select()
      .single();
    if (error) return setToast(error.message);
    setRateItems((prev) => [...prev, data]);
    setNewSizeName("");
    setNewSizeDiff("");
  }
  function deleteSize(item) {
    askDelete(`Delete ${item.name}?`, async () => {
      const { error } = await supabase
        .from("rate_items")
        .delete()
        .eq("id", item.id);
      if (error) return setToast(error.message);
      setRateItems((prev) => prev.filter((x) => x.id !== item.id));
      setCart([]);
      setToast(`${item.name} deleted.`);
    });
  }
  async function updateSizeName(item, value) {
    if (!value.trim()) return;
    setRateItems((prev) =>
      prev.map((x) => (x.id === item.id ? { ...x, name: value } : x)),
    );
    const { error } = await supabase
      .from("rate_items")
      .update({ name: value })
      .eq("id", item.id);
    if (error) {
      setToast(error.message);
      await loadAll();
    }
  }
  async function updateDiff(item, value) {
    setRateItems((prev) =>
      prev.map((x) =>
        x.id === item.id ? { ...x, fixed_difference: num(value) } : x,
      ),
    );
    const { error } = await supabase
      .from("rate_items")
      .update({ fixed_difference: num(value) })
      .eq("id", item.id);
    if (error) {
      setToast(error.message);
      await loadAll();
    }
  }
  function addCalc(e) {
    e.preventDefault();
    if (!categoryId || !sizeId || Number(qty || 0) < 0) return;
    const s = rateItems.find((x) => x.id === sizeId),
      c = getCategory(categoryId);
    if (!s || !c) return;

    const isSalesCalculator = screen === "salesman" || user?.role === "salesman",
      assignedSalesMargin = num(activeBusiness?.margin ?? user?.margin),
      baseUnitRate = unitRate(categoryId, s.fixed_difference),
      marginValue = isSalesCalculator ? assignedSalesMargin : num(margin),
      marginWithGst = round05(marginValue * 1.18),
      finalUnitRate = round05(baseUnitRate + marginWithGst),
      q = isSalesCalculator ? 0 : Number(qty || 0),
      total = q === 0 ? finalUnitRate : round05(finalUnitRate * q);

    setCart([
      ...cart,
      {
        id: `cart-${Date.now()}`,
        category: c.name,
        itemName: s.name,
        qty: q,
        qtyUnit,
        baseUnitRate,
        margin: marginValue,
        marginWithGst,
        unitRate: finalUnitRate,
        total,
      },
    ]);
    setQuoteEdited(false);
    setSizeId("");
    setQty("");
    
  }
  function deleteQuoteRow(item) {
    askDelete(`Delete ${item.itemName}?`, () => {
      setCart(cart.filter((x) => x.id !== item.id));
      setQuoteEdited(false);
      setToast(`${item.itemName} deleted.`);
    });
  }
  async function addIncentive(e) {
    e.preventDefault();
    if (!newItem.name || !newItem.points) return;
    const { data, error } = await supabase
      .from("incentive_items")
      .insert({
        name: newItem.name,
        unit: newItem.unit,
        points_per_unit: num(newItem.points),
      })
      .select()
      .single();
    if (error) return setToast(error.message);
    setItems((prev) => [...prev, data]);
    setNewItem({ name: "", unit: "kg", points: "" });
  }
  function deleteIncentive(item) {
    askDelete(`Delete ${item.name}?`, async () => {
      await supabase.from("incentive_items").delete().eq("id", item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      setToast(`${item.name} deleted.`);
    });
  }
  async function approveFab(f) {
    await supabase
      .from("fabricators")
      .update({ status: "Approved" })
      .eq("id", f.id);
    setFabricators((prev) =>
      prev.map((x) => (x.id === f.id ? { ...x, status: "Approved" } : x)),
    );
    setToast(`${f.name} approved.`);
  }
  async function rejectFab(f) {
    await supabase
      .from("fabricators")
      .update({ status: "Rejected" })
      .eq("id", f.id);
    setFabricators((prev) =>
      prev.map((x) => (x.id === f.id ? { ...x, status: "Rejected" } : x)),
    );
    setToast(`${f.name} rejected.`);
  }
  async function approveSub(s) {
    const { error } = await supabase.rpc("approve_submission", {
      p_submission_id: s.id,
    });
    if (error) return setToast(error.message);
    setSubmissions((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, status: "Approved" } : x)),
    );
    await loadAll();
  }
  async function rejectSub(s) {
    const { error } = await supabase.rpc("reject_submission", {
      p_submission_id: s.id,
    });
    if (error) return setToast(error.message);
    setSubmissions((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, status: "Rejected" } : x)),
    );
  }
  function buildQuote() {
    const lines = [];
    // Short enough to stay on one line on narrow phones (textarea + WhatsApp).
    const divider = "-".repeat(24);
    lines.push("📝 *ASR Iron* ");
    lines.push("   *" + today() + "*");
    lines.push(divider);
    if (!cart.length) {
      lines.push("No items added");
    } else {
      cart.forEach((item, index) => {
        const qtyValue = num(item.qty ?? item.quantity ?? 0);
        const rateValue = num(item.unitRate ?? item.rate ?? 0);
        const quantityUnit = item.qtyUnit || item.unit || "kg";
        const category = item.category || item.categoryName || "";
        const spec = item.itemName || item.sizeName || item.name || "";
        lines.push(
          `${index + 1}. *${category} - ${spec}* : ${inr(rateValue)} : ${
            qtyValue ? `${qtyValue}${quantityUnit}` : ""
          }`,
        );
        lines.push("");
      });
    }
    lines.push(divider);
    lines.push("");
    lines.push("Thankyou!");
    return lines.join("\n");
  }
  function ticker() {
    return (
      <div className="market-ticker">
        <div className="market-strip">
          {sortedCategories
            .filter((c) => c.show_in_ticker !== false)
            .map((row, i) => {
              const d = delta(row);
              return (
                <div
                  className={`rate-chip ${i < 4 ? "fixed" : ""}`}
                  key={row.id}
                >
                  <div className="rate-name">{row.name}</div>
                  <div className="rate-value">{inr(row.daily_rate)}</div>
                  <div className={`rate-change ${d.cls}`}>
                    {d.icon}
                    {d.txt}
                  </div>
                  <div className="rate-time">
                    Updated {ago(row.updated_at || row.created_at)}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  }
  async function updateTickerVisibility(categoryId, checked) {
    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId ? { ...c, show_in_ticker: checked } : c,
      ),
    );
    if (!supabase) return;
    const { error } = await supabase
      .from("rate_categories")
      .update({ show_in_ticker: checked })
      .eq("id", categoryId);
    if (error)
      setToast(error.message || "Could not update top list visibility.");
  }

  function topScrollVisibilityPanel() {
    const rows = [...categories].sort((a, b) =>
      String(a.name).localeCompare(String(b.name), undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
    return (
      <div className="area top-scroll-visibility-panel">
        <div className="visibility-panel-head">
          <div>
            <h2 className="section-title">
              <Bell size={18} />
              Top Scroll Visibility
            </h2>
            <p className="muted">
              Toggle which Market items appear in the top scrollable list.
            </p>
          </div>
        </div>
        <div className="visibility-toggle-grid">
          {rows.map((cat) => (
            <label
              key={cat.id}
              className={`visibility-toggle-card ${cat.show_in_ticker !== false ? "on" : "off"}`}
            >
              <span className="visibility-name">{cat.name}</span>
              <span className="visibility-state">
                {cat.show_in_ticker !== false ? "ON" : "OFF"}
              </span>
              <input
                type="checkbox"
                checked={cat.show_in_ticker !== false}
                onChange={(e) =>
                  updateTickerVisibility(cat.id, e.target.checked)
                }
              />
            </label>
          ))}
        </div>
      </div>
    );
  }

  function dailyRateItemTopToggle(item) {
    if (!item) return null;
    return (
      <label
        className="market-card-top-toggle"
        title="Show/hide this item in top scroll list"
        onClick={(e) => e.stopPropagation()}
      >
        <span>Top</span>
        <input
          type="checkbox"
          checked={item.show_in_ticker !== false}
          onChange={(e) => updateTickerVisibility(item.id, e.target.checked)}
        />
      </label>
    );
  }

  function marketPage() {
    return (
      <div className="grid">
        <div className="area">
          <h2 className="section-title">
            <BarChart3 size={20} /> Daily Market Rates
          </h2>
          <p className="section-note">
            Increment/decrement compares current value with previous saved
            update and remains after refresh.
          </p>
          <input
            className="input search-box"
            placeholder="Search market category..."
            value={marketSearch}
            onChange={(e) => setMarketSearch(e.target.value)}
          />
          <form className="small-card" onSubmit={addMarket}>
            <h3>Add New Market Item</h3>
            <div className="grid grid-3">
              <input
                className="input"
                placeholder="Name"
                value={newSegment.name}
                onChange={(e) =>
                  setNewSegment({ ...newSegment, name: e.target.value })
                }
              />
              <input
                className="input"
                type="number"
                placeholder="Daily Rate"
                value={newSegment.rate}
                onChange={(e) =>
                  setNewSegment({ ...newSegment, rate: e.target.value })
                }
              />
              <input
                className="input"
                type="number"
                placeholder="Freight"
                value={newSegment.freight}
                onChange={(e) =>
                  setNewSegment({ ...newSegment, freight: e.target.value })
                }
              />
            </div>
            <button className="btn btn-primary full">Add to Market</button>
            <button
              type="button"
              className="asr-clear-all-quote-jsx-btn"
              title="Delete all added items"
              aria-label="Delete all added items"
              onClick={asrAskClearAllQuotes}
            >
              🗑
            </button>
          </form>
        </div>
        <div className="market-grid">
          {marketCategories.map((row) => {
            const d = delta(row);
            return (
              <div className="market-card" key={row.id}>
                <div className="market-category-row">
                  <input
                    className="market-category-name-input"
                    defaultValue={row.name}
                    aria-label={`Edit ${row.name} category name`}
                    title="Edit category name"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                    onBlur={async (event) => {
                      const saved = await updateCategoryName(row, event.target.value);
                      if (!saved) event.target.value = row.name;
                    }}
                  />
                </div>
                <div className="market-rate-row">
                  <div className="market-card-content">
                    <div className="rate-value">{inr(row.daily_rate)}</div>
                    <div className={`rate-change ${d.cls}`}>
                      {d.icon}
                      {d.txt}
                    </div>
                    <div className="rate-time">
                      Last updated {ago(row.updated_at || row.created_at)}
                    </div>
                  </div>
                  <div className="market-card-actions">
                    {dailyRateItemTopToggle(row)}
                    <button
                      className="market-delete-btn"
                      onClick={() => deleteSegment(row)}
                      aria-label={`Delete ${row.name} category`}
                      title="Delete category"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="market-update-grid">
                  <div className="field">
                    <label className="label">Daily Rate</label>
                    <input
                      className="input"
                      type="number"
                      defaultValue={row.daily_rate}
                      onBlur={(e) =>
                        updateMarketRate(row, e.target.value, row.freight)
                      }
                    />
                  </div>
                  <div className="field">
                    <label className="label">Freight</label>
                    <input
                      className="input"
                      type="number"
                      defaultValue={row.freight}
                      onBlur={(e) =>
                        updateMarketRate(row, row.daily_rate, e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  function dailyPage() {
    return (
      <div className="area">
        <h2 className="section-title">Sizes Configuration</h2>
        <div className="field">
          <label className="label">Select Segment</label>
          <select data-asr-size-select="1"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setSizeSearch("");
            }}
          >
            {sortedCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <input
          className="input search-box"
          placeholder="Search size/name..."
          value={sizeSearch}
          onChange={(e) => setSizeSearch(e.target.value)}
        />
        <form className="small-card" onSubmit={addSize}>
          <div className="grid grid-3">
            <input
              className="input"
              value={newSizeName}
              onChange={(e) => setNewSizeName(e.target.value)}
              placeholder="Size name"
            />
            <input
              className="input"
              type="number"
              value={newSizeDiff}
              onChange={(e) => setNewSizeDiff(e.target.value)}
              placeholder="Diff"
            />
            <button className="btn btn-primary">Add Size</button>
          </div>
        </form>
        <div className="size-card-list">
          {visibleSizes.map((s) => (
            <div className="size-edit-card" key={s.id}>
              <div className="size-edit-main">
                <input
                  className="input size-name-input"
                  defaultValue={s.name}
                  onBlur={(e) => updateSizeName(s, e.target.value)}
                />
                <div className="size-preview">
                  Preview:{" "}
                  <b>{inr(unitRate(s.category_id, s.fixed_difference))}/kg</b>
                </div>
              </div>
              <div className="size-edit-side">
                <input
                  className="input diff-input"
                  type="number"
                  defaultValue={s.fixed_difference}
                  onBlur={(e) => updateDiff(s, e.target.value)}
                />
                <button
                  className="size-delete-btn"
                  onClick={() => deleteSize(s)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function getCurrentQuoteText() {
    try {
      return quoteText && String(quoteText).trim() ? quoteText : buildQuote();
    } catch {
      return quoteText || "";
    }
  }

  async function copyQuote() {
    const text = getCurrentQuoteText();
    if (!text) return setToast("No quote text to copy.");
    try {
      await navigator.clipboard.writeText(text);
      setToast("Quotation copied.");
    } catch {
      setToast("Copy failed. Please copy manually.");
    }
  }

  // Open WhatsApp with the quotation text prefilled.
  function whatsapp() {
    const text = getCurrentQuoteText();
    if (!text) return setToast("No quote text to share.");
    window.open(
      "https://wa.me/?text=" + encodeURIComponent(text),
      "_blank",
      "noopener,noreferrer",
    );
  }

  // Share via the device's native share sheet, falling back to clipboard copy.
  async function nativeShare() {
    const text = getCurrentQuoteText();
    if (!text) return setToast("No quote text to share.");
    if (navigator.share) {
      try {
        await navigator.share({ title: "ASR Iron Quotation", text });
      } catch {
        /* user dismissed the share sheet */
      }
      return;
    }
    await copyQuote();
  }

  // Reset the editable quote text back to the auto-generated version.
  function resetQuote() {
    try {
      setQuoteText(buildQuote());
      setQuoteEdited(false);
      setToast("Quote text reset.");
    } catch {
      setQuoteEdited(false);
    }
  }

  // Print the quotation via a dedicated print window.
  function printQuote() {
    const text = getCurrentQuoteText();
    if (!text) return setToast("No quote text to print.");
    const win = window.open("", "_blank", "width=480,height=640");
    if (!win) return setToast("Allow pop-ups to print the quotation.");
    win.document.write(
      `<!doctype html><html><head><title>ASR Iron Quotation</title>` +
        `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
        `<style>body{font-family:'Segoe UI',Arial,sans-serif;padding:20px;color:#0f172a}` +
        `pre{white-space:pre-wrap;word-wrap:break-word;font-size:14px;line-height:1.5;margin:0}</style>` +
        `</head><body><pre>${text.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]))}</pre></body></html>`,
    );
    win.document.close();
      win.focus();
      setTimeout(() => win.print(), 250);
  }

  function openOrderPage() {
    if (screen === "salesman") setFabTab("orders");
    else setAdminTab("orders");
  }

  function calculatorPage() {
    const isSalesCalculator = screen === "salesman" || user?.role === "salesman";
    const assignedSalesMargin = num(activeBusiness?.margin ?? user?.margin);
    const activeSizes = asrSortSizes(rateItems.filter((x) => x.category_id === categoryId)),
      sizePickerRows = activeSizes.filter((s) =>
        String(s.name || "").toLowerCase().includes(sizePickerQuery.trim().toLowerCase()),
      ),
      total = cart.reduce((s, i) => s + i.total, 0);
    return (
      <div className="grid grid-5">
        <div className="area">
          <h3 className="section-title">
            <Calculator size={20} /> Generate New Estimate
          </h3>
          <form onSubmit={addCalc}>
            <div className="field">
              <label className="label">Step 1: Select Category</label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSizeId("");
                  setQty("");
                  setSizePickerOpen(false);
                  setSizePickerQuery("");
                }}
                required
              >
                <option value="">-- Choose Category --</option>
                {sortedCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {categoryId && (
              <div className="field asr-size-picker-field">
                <label className="label">Step 2: Choose Size</label>
                <div className="asr-size-picker-row">
                  <select
                    value={sizeId}
                    onChange={(e) => {
                      setSizeId(e.target.value);
                      setQty("");
                      setSizePickerOpen(false);
                      setSizePickerQuery("");
                    }}
                    required
                  >
                    <option value="">-- Select Size --</option>
                    {activeSizes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Diff: ₹{s.fixed_difference})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="asr-size-picker-search-btn"
                    aria-label="Search size"
                    title="Search size"
                    onClick={() => {
                      setSizePickerOpen((open) => !open);
                      setSizePickerQuery("");
                    }}
                  >
                    <Search size={19} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>
                {sizePickerOpen && (
<div className="asr-size-picker-popover">
  <div className="asr-size-picker-head">
    <div className="asr-size-picker-title">Search Size</div>

    <button
      type="button"
      className="asr-size-picker-close"
      aria-label="Close size search"
      title="Close"
      onClick={() => {
        setSizePickerOpen(false);
        setSizePickerQuery("");
      }}
    >
      ×
    </button>
  </div>

  <input
    className="asr-size-picker-input"
    autoFocus
    placeholder="Type to search size..."
    value={sizePickerQuery}
    onChange={(e) => setSizePickerQuery(e.target.value)}
  />
                    <div className="asr-size-picker-list">
                      {sizePickerRows.length === 0 ? (
                        <div className="asr-size-picker-empty">No matching size</div>
                      ) : (
                        sizePickerRows.map((s) => (
                          <button
                            type="button"
                            key={s.id}
                            className="asr-size-picker-option"
                            onClick={() => {
                              setSizeId(s.id);
                              setQty("");
                              setSizePickerOpen(false);
                              setSizePickerQuery("");
                            }}
                          >
                            <span>{s.name}</span>
                            <small>Diff: ₹{s.fixed_difference}</small>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
{!isSalesCalculator && (
              <div className="small-card quantity-margin-card">
                <div className="quantity-margin-grid">
                  <div className="field">
                    <label className="label">Step 3: Quantity</label>
                    <input className="input quantity-input" type="number" inputMode="decimal" min="0" step="0.1" value={qty} placeholder="0" onChange={(e) => setQty(e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="label">Unit</label>
                    <select className="input quantity-unit-select" value={qtyUnit} onChange={(e) => setQtyUnit(e.target.value)} aria-label="Quantity unit">
                      <option value="kg">kg</option>
                      <option value="pcs">pcs</option>
                      <option value="bundle">bundle</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="label">Margin ₹/kg</label>
                    <input className="input margin-input" type="number" inputMode="decimal" step="0.01" value={margin} placeholder="0" onChange={(e) => {
                      const nextMargin = e.target.value;
                      setMargin(nextMargin);
                      try { localStorage.setItem("asr_calculator_margin", nextMargin); } catch {}
                    }} />
                  </div>
                </div>
              </div>
            )}
            <button
              className="btn btn-primary full"
              disabled={!categoryId || !sizeId || Number(qty || 0) < 0}            >
              Add Item
            </button>
          </form>
        </div>
        <div className="area quote-summary-area">
          <h3 className="section-title compact-title">
            Calculated Quote Summary
          </h3>
          {cart.length === 0 ? (
            <div className="empty compact-empty">
              <Calculator size={32} />
              <p>No items added.</p>
            </div>
          ) : (
            <>
              <div className="quote-mini-list">
                {cart.map((i) => (
                  <div className="quote-mini-row" key={i.id}>
                    <div>
                      <div className="quote-mini-item">{i.itemName}</div>
                      <div className="quote-mini-cat">
                        {i.category} . {inr(i.unitRate)}
                        {i.qty === 0 ? "" : ` * ${i.qty} ${i.qtyUnit || "kg"}`}
                      </div>
                    </div>
                    <button
                      className="quote-mini-delete"
                      onClick={() => deleteQuoteRow(i)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="editable-quote">
                <label className="label">Editable quotation text</label>
                <textarea
                  className="input quotation-textarea"
                  value={quoteText}
                  onChange={(e) => {
                    setQuoteText(e.target.value);
                    setQuoteEdited(true);
                  }}
                />
              </div>
              <button
                type="button"
                className="btn btn-primary full calculator-order-btn"
                onClick={openOrderPage}
                disabled={!cart.length}
              >
                Place Order
              </button>
              <div className="share-panel compact-share">
                <button className="share-btn copy" onClick={copyQuote}>
                  <Copy size={15} />
                  <span>Copy</span>
                </button>
                <button className="share-btn whatsapp" onClick={whatsapp}>
                  <MessageCircle size={15} />
                  <span>WhatsApp</span>
                </button>
                <button className="share-btn native" onClick={nativeShare}>
                  <Send size={15} />
                  <span>Share</span>
                </button>
                <button className="share-btn print" onClick={printQuote}>
                  <Printer size={15} />
                  <span>Print</span>
                </button>
                <button className="share-btn reset" onClick={resetQuote}>
                  <X size={15} />
                  <span>Reset</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  function itemsPage() {
    return (
      <div className="items-page-wrap">
        <div className="area">
          <h2 className="section-title">Add Item</h2>
          <form onSubmit={addIncentive}>
            <div className="field">
              <input
                className="input"
                placeholder="Item"
                value={newItem.name}
                onChange={(e) =>
                  setNewItem({ ...newItem, name: e.target.value })
                }
                required
              />
            </div>
            <div className="field">
              <select
                className="input"
                value={newItem.unit}
                onChange={(e) =>
                  setNewItem({ ...newItem, unit: e.target.value })
                }
              >
                <option value="kg">kg</option>
                <option value="pcs">pcs</option>
                <option value="ft">ft</option>
              </select>
            </div>
            <div className="field">
              <input
                className="input"
                type="number"
                placeholder="Points"
                value={newItem.points}
                onChange={(e) =>
                  setNewItem({ ...newItem, points: e.target.value })
                }
                required
              />
            </div>
            <button className="btn btn-primary full">Save</button>
          </form>
        </div>
        <div className="items-list-wrap">
          {items.map((i) => (
            <div className="incentive-item-card" key={i.id}>
              <div className="item-name-chip">{i.name}</div>
              <div className="item-points-chip">
                {i.points_per_unit} points / {i.unit}
              </div>
              <button
                className="item-delete-strip"
                onClick={() => deleteIncentive(i)}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }
  async function approveBusiness(row) {
    const { error } = await supabase.rpc("approve_business", { p_business_id: row.id });
    if (error) return setToast(error.message);
    setBusinessUsers((prev) => prev.map((b) => b.id === row.id ? { ...b, status: "Approved" } : b));
    setToast(`${row.business_name} approved.`);
  }
  async function rejectBusiness(row) {
    const { error } = await supabase.rpc("reject_business", { p_business_id: row.id });
    if (error) return setToast(error.message);
    setBusinessUsers((prev) => prev.map((b) => b.id === row.id ? { ...b, status: "Rejected" } : b));
    setToast(`${row.business_name} rejected.`);
  }
  async function saveBusinessMargin(row, value) {
    const marginValue = Math.max(0, num(value));
    const { error } = await supabase.rpc("set_business_margin", {
      p_business_id: row.id,
      p_margin: marginValue,
    });
    if (error) return setToast(error.message);
    setBusinessUsers((prev) => prev.map((b) => b.id === row.id ? { ...b, margin: marginValue } : b));
    setToast(`Margin saved for ${row.business_name}.`);
  }
  async function resetBusinessPassword(row, value) {
    const nextPassword = String(value || "").trim();
    if (nextPassword.length < 6) return setToast("Temporary password must have at least 6 characters.");
    const { error } = await supabase.rpc("reset_business_password", {
      p_business_id: row.id,
      p_new_password: nextPassword,
    });
    if (error) return setToast(error.message);
    setToast(`Temporary password updated for ${row.business_name}.`);
  }
  function salesmenPage() {
    const pending = businessUsers.filter((b) => b.status === "Pending");
    const approved = businessUsers.filter((b) => b.status === "Approved");
    return (
      <div className="grid salesman-admin-page">
        <div className="area">
          <h2 className="section-title"><UserPlus size={20} /> Pending Business Signups</h2>
          {pending.length === 0 ? <div className="empty">No pending Business signups.</div> : pending.map((b) => (
            <div className="signup-card business-signup-card" key={b.id}>
              <div>
                <b>{b.business_name}</b>
                <p>User ID: <strong>{b.user_id}</strong></p>
                <p>{b.mobile} • {b.address}</p>
              </div>
              <div className="signup-actions">
                <button className="btn btn-success" onClick={() => approveBusiness(b)}>Approve</button>
                <button className="btn btn-danger" onClick={() => rejectBusiness(b)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
        <div className="area">
          <h2 className="section-title"><Calculator size={20} /> Approved SalesMan</h2>
          {approved.length === 0 ? <div className="empty">No approved Business accounts.</div> : approved.map((b) => (
            <div className="salesman-manage-card" key={b.id}>
              <div className="salesman-manage-head">
                <div><b>{b.business_name}</b><p>User ID: <strong>{b.user_id}</strong> • {b.mobile}</p></div>
                <span className="status-pill approved">Approved</span>
              </div>
              <div className="salesman-manage-grid">
                <div className="field">
                  <label className="label">Margin ₹/kg</label>
                  <input className="input" type="number" min="0" step="0.01" defaultValue={b.margin || 0} onBlur={(e) => saveBusinessMargin(b, e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Set Temporary Password</label>
                  <input className="input" type="password" placeholder="Minimum 6 characters" onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      resetBusinessPassword(b, e.currentTarget.value);
                      e.currentTarget.value = "";
                    }
                  }} />
                  <small className="salesman-password-note">Existing passwords are protected and cannot be viewed. Press Enter to save a temporary password.</small>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  function signupsPage() {
    const pending = fabricators.filter((f) => f.status === "Pending"),
      approved = fabricators.filter((f) => f.status === "Approved");
    const query = fabSearch.trim().toLowerCase();
    const approvedFabricators = query
      ? approved.filter(
          (f) =>
            String(f.name || "").toLowerCase().includes(query) ||
            String(f.mobile || "").toLowerCase().includes(query),
        )
      : approved;
    return (
      <div className="grid">
        <div className="area">
          <h2 className="section-title">Pending Signups</h2>
          {pending.length === 0 ? (
            <div className="empty">No pending signups.</div>
          ) : (
            pending.map((f) => (
              <div className="signup-card" key={f.id}>
                <div>
                  <b>{f.name}</b>
                  <p>
                    {f.mobile} • {f.address}
                  </p>
                </div>
                <div className="signup-actions">
                  <button
                    className="btn btn-success"
                    onClick={() => approveFab(f)}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => rejectFab(f)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="area">
          <h2 className="section-title">
            <UserPlus size={20} /> Approved Fabricators
          </h2>
          <input
            className="input search-box"
            placeholder="Search fabricator by name or User ID..."
            value={fabSearch}
            onChange={(e) => setFabSearch(e.target.value)}
          />
          {approvedFabricators.length === 0 ? (
            <div className="empty">No approved fabricators.</div>
          ) : (
            approvedFabricators.map((f) => {
              const isOpen = String(openFabId) === String(f.id);
              // All submissions and redemptions belonging to this fabricator,
              // newest first, so the admin sees the full activity trail.
              const claims = submissions
                .filter((s) => String(s.fabricator_id) === String(f.id))
                .sort(
                  (a, b) =>
                    new Date(b.created_at || 0) - new Date(a.created_at || 0),
                );
              const reds = redemptions
                .filter((r) => String(r.fabricator_id) === String(f.id))
                .sort(
                  (a, b) =>
                    new Date(b.created_at || 0) - new Date(a.created_at || 0),
                );
              const approvedPts = claims
                .filter((s) => String(s.status).toLowerCase() === "approved")
                .reduce((sum, s) => sum + num(s.points_earned), 0);
              const paidPts = reds
                .filter((r) => String(r.status).toLowerCase() === "approved")
                .reduce(
                  (sum, r) => sum + num(r.points ?? r.points_requested),
                  0,
                );
              return (
                <div
                  className={`fab-manage-card ${isOpen ? "open" : ""}`}
                  key={f.id}
                >
                  <button
                    type="button"
                    className="fab-manage-head"
                    onClick={() => setOpenFabId(isOpen ? null : f.id)}
                    aria-expanded={isOpen}
                  >
                    <div className="fab-manage-id">
                      <b>{f.name}</b>
                      <p>
                        User ID: <strong>{f.mobile}</strong>
                      </p>
                    </div>
                    <div className="fab-manage-points">
                      <span>
                        {num(f.total_points).toLocaleString("en-IN")} pts
                      </span>
                      <ChevronDown
                        size={18}
                        className={`fab-chevron ${isOpen ? "up" : ""}`}
                      />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="fab-manage-body">
                      <div className="fab-stat-row">
                        <div>
                          <span>Approved Points</span>
                          <b>{approvedPts.toLocaleString("en-IN")}</b>
                        </div>
                        <div>
                          <span>Paid / Redeemed</span>
                          <b>{paidPts.toLocaleString("en-IN")}</b>
                        </div>
                        <div>
                          <span>Available</span>
                          <b>
                            {num(f.total_points).toLocaleString("en-IN")}
                          </b>
                        </div>
                      </div>

                      <h4 className="fab-sub-head">Claim History</h4>
                      {claims.length === 0 ? (
                        <div className="empty compact-empty">
                          No claims yet.
                        </div>
                      ) : (
                        claims.map((s) => (
                          <div className="fab-history-row" key={s.id}>
                            <div>
                              <b>{s.item_name}</b>
                              <small>
                                {s.site_name || "No site"} • {s.quantity}{" "}
                                {s.unit} •{" "}
                                {new Date(
                                  s.created_at || s.submission_date,
                                ).toLocaleDateString("en-GB")}
                              </small>
                            </div>
                            <div className="fab-history-right">
                              <span className="fab-history-points">
                                {num(s.points_earned).toLocaleString("en-IN")}{" "}
                                pts
                              </span>
                              <span
                                className={`status-pill ${String(
                                  s.status,
                                ).toLowerCase()}`}
                              >
                                {s.status}
                              </span>
                            </div>
                          </div>
                        ))
                      )}

                      <h4 className="fab-sub-head">Redemption / Paid History</h4>
                      {reds.length === 0 ? (
                        <div className="empty compact-empty">
                          No redemption requests yet.
                        </div>
                      ) : (
                        reds.map((r) => (
                          <div className="fab-history-row" key={r.id}>
                            <div>
                              <b>
                                {num(
                                  r.points ?? r.points_requested,
                                ).toLocaleString("en-IN")}{" "}
                                pts
                              </b>
                              <small>
                                {new Date(r.created_at).toLocaleDateString(
                                  "en-GB",
                                )}
                                {r.narration ? ` • ${r.narration}` : ""}
                              </small>
                            </div>
                            <div className="fab-history-right">
                              <span
                                className={`status-pill ${String(
                                  r.status,
                                ).toLowerCase()}`}
                              >
                                {r.status}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }
  function claimsPage() {
    const pending = submissions.filter((s) => s.status === "Pending");
    return (
      <div className="area">
        <h2 className="section-title">Pending Claims</h2>
        {pending.length === 0 ? (
          <div className="empty">No pending claims.</div>
        ) : (
          pending.map((s) => {
            const fab = fabricators.find((f) => f.id === s.fabricator_id);
            return (
              <div className="claim-admin-card" key={s.id}>
                <div className="claim-admin-top">
                  <div>
                    <div className="claim-item-name">{s.item_name}</div>
                    <div className="claim-by-line">
                      Claim by: <b>{fab?.name || "Unknown Fabricator"}</b>
                      {fab?.mobile ? <span> · {fab.mobile}</span> : null}
                    </div>
                    <div className="claim-details-grid admin-claim-details">
                      <div className="claim-detail-site">
                        <span>Site Name</span>
                        <b>{s.site_name || "Not provided"}</b>
                      </div>
                      <div>
                        <span>Date</span>
                        <b>{new Date(s.created_at || s.submission_date).toLocaleDateString("en-GB")}</b>
                      </div>
                      <div>
                        <span>Quantity</span>
                        <b>{s.quantity} {s.unit}</b>
                      </div>
                      <div>
                        <span>Points</span>
                        <b>{s.points_earned} pts</b>
                      </div>
                    </div>
                  </div>
                  <div className="claim-points-badge">
                    +{s.points_earned}
                    <span>pts</span>
                  </div>
                </div>
                <div className="signup-actions claim-actions-row">
                  <button
                    className="btn btn-success"
                    onClick={() => approveSub(s)}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => rejectSub(s)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }
  function redemptionsPage() {
    const pending = redemptions.filter((r) => String(r.status).toLowerCase() === "pending");
    return (
      <div className="area">
        <h2 className="section-title">Redemption Requests</h2>
        {pending.length === 0 ? (
          <div className="empty">No pending redemption requests.</div>
        ) : (
          pending.map((r) => {
            const fab = fabricators.find((f) => String(f.id) === String(r.fabricator_id));
            return (
              <div className="redemption-admin-card" key={r.id}>
                <div className="redemption-admin-head">
                  <div>
                    <b>{fab?.name || "Unknown Fabricator"}</b>
                    <p>{fab?.mobile || ""}</p>
                  </div>
                  <div className="redemption-points-badge">
                    {num(r.points ?? r.points_requested).toLocaleString("en-IN")} pts
                  </div>
                </div>
                <div className="redemption-balance-line">
                  Current balance: <b>{num(fab?.total_points).toLocaleString("en-IN")} pts</b>
                </div>
                <div className="field">
                  <label className="label">Narration / Redemption Method</label>
                  <input
                    className="input"
                    value={redeemNarrations[r.id] || ""}
                    onChange={(e) =>
                      setRedeemNarrations((prev) => ({
                        ...prev,
                        [r.id]: e.target.value,
                      }))
                    }
                    placeholder="Example: UPI paid to mobile, Cash, Gift item"
                  />
                </div>
                <div className="redemption-admin-actions">
                  <button
                    className="btn btn-danger"
                    onClick={() => rejectRedemption(r)}
                  >
                    Reject
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={() => approveRedemption(r)}
                    disabled={num(r.points ?? r.points_requested) > num(fab?.total_points)}
                  >
                    Approve
                  </button>
                </div>
                {num(r.points ?? r.points_requested) > num(fab?.total_points) && (
                  <div className="redeem-insufficient">
                    Insufficient current balance. Approval is blocked.
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  }

  function historyPage() {
    return (
      <div className="area">
        <h2 className="section-title">Processed Logs</h2>
        {submissions
          .filter((s) => s.status !== "Pending")
          .map((s) => (
            <div className="small-card" key={s.id}>
              <b>{s.item_name}</b>
              <p>
                {s.points_earned} pts • {s.status}
              </p>
            </div>
          ))}
      </div>
    );
  }
  function fabricatorHome() {
    const name = activeFabricator?.name || user?.name || "Partner";
    return (
      <div className="fabricator-wrap">
        <div className="fabricator-tabs">
          <button
            className={fabTab === "apply" ? "active" : ""}
            onClick={() => setFabTab("apply")}
          >
            <PlusCircle size={17} />
            Apply Incentive
          </button>
          <button
            className={fabTab === "history" ? "active" : ""}
            onClick={() => setFabTab("history")}
          >
            <History size={17} />
            History
          </button>
        </div>
        <div className="points-card">
          <div>
            <span>ASR IRON APPROVED POINTS</span>
            <div className="points-gold-box">
              <strong>
                {num(activeFabricator?.total_points).toLocaleString()}
              </strong>
              <em>pts</em>
            </div>
            <button
              type="button"
              className="redeem-points-btn"
              onClick={() => {
                setRedeemPoints("");
                setRedeemError("");
                setRedeemModalOpen(true);
              }}
            >
              Redeem Points
            </button>
          </div>
          
        </div>
        {redeemModalOpen && (
          <div className="redeem-modal-backdrop">
            <div className="redeem-modal-card">
              <button
                type="button"
                className="redeem-modal-close"
                onClick={() => { setRedeemError(""); setRedeemModalOpen(false); }}
                aria-label="Close redemption form"
              >
                <X size={18} />
              </button>
              <h3>Redeem Points</h3>
              <p>
                Available: <b>{availableRedemptionPoints.toLocaleString("en-IN")} pts</b>
              </p>
              <form onSubmit={submitRedemptionRequest}>
                <label className="label">Points to redeem</label>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.value)}
                  placeholder="Enter points"
                  required
                />
                {redeemError && (
                  <div className="redeem-insufficient">{redeemError}</div>
                )}
                {num(redeemPoints) > availableRedemptionPoints && !redeemError && (
                  <div className="redeem-insufficient">
                    Insufficient points. You can request up to {availableRedemptionPoints.toLocaleString("en-IN")} pts.
                  </div>
                )}
                <div className="redeem-modal-actions">
                  <button
                    type="button"
                    className="btn btn-soft"
                    onClick={() => { setRedeemError(""); setRedeemModalOpen(false); }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={
                      num(redeemPoints) <= 0 ||
                      num(redeemPoints) > availableRedemptionPoints
                    }
                  >
                    Request Approval
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* ASR_HIDE_ZERO_PENDING_EXACT_START */}
        {num(pendingPoints) > 0 && (
          <div className="pending-card">
          <div>
            <Clock size={16} />
            Awaiting Review
          </div>
          <span>Pending Claims Points</span>
          <strong>
            {pendingPoints.toLocaleString()} <em>pts</em>
          </strong>
        </div>
        )}
        {/* ASR_HIDE_ZERO_PENDING_EXACT_END */}
        {fabTab === "apply" ? applyIncentivePage() : fabricatorHistoryPage()}
      </div>
    );
  }
  function applyIncentivePage() {
    const item = items.find((i) => i.id === claimItemId);
    return (
      <div className="area fab-apply-card">
        <h2 className="section-title">
          <PlusCircle size={20} />
          Apply for Incentive
        </h2>
        {claimOk && (
          <div className="success">Submitted for admin approval.</div>
        )}
        <form onSubmit={submitClaim}>
          <div className="field">
            <label className="label">Select Fabrication Item</label>
            <select
              value={claimItemId}
              onChange={(e) => {
                setClaimItemId(e.target.value);
                setClaimQty("");
              }}
              required
            >
              <option value="">-- Click to Select an Item --</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.points_per_unit} Pts/{i.unit})
                </option>
              ))}
            </select>
          </div>
          {item && (
            <div className="quantity-box">
              <label className="label">
                Completed Quantity (in {item.unit})
              </label>
              <div className="qty-input-wrap">
                <input
                  className="input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder={`Enter quantity in ${item.unit}`}
                  value={claimQty}
                  onChange={(e) => setClaimQty(e.target.value)}
                  required
                />
                <span>{item.unit.toUpperCase()}</span>
              </div>
              {claimQty && (
                <p className="claim-preview">
                  Points:{" "}
                  <b>
                    {(
                      Number(claimQty) * num(item.points_per_unit)
                    ).toLocaleString()}{" "}
                    pts
                  </b>
                </p>
              )}
            </div>
          )}
          <div className="field site-name-field">
            <label className="label" htmlFor="fabricator-site-name">
              Site Name <span className="required-mark">*</span>
            </label>
            <input
              id="fabricator-site-name"
              name="site_name"
              className="input"
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Enter project / site name"
              autoComplete="organization"
              required
            />
          </div>
          <button className="btn btn-primary full submit-claim-btn">
            Submit for Admin Approval
          </button>
        </form>
      </div>
    );
  }
  /* ASR_PENDING_CLAIM_DELETE_EXACT_START */
  function deletePendingClaim(claim) {
    if (!claim || String(claim.status || '').toLowerCase() !== 'pending') return;

    askDelete(`Delete request for ${claim.item_name || 'this item'}?`, async () => {
      const { error } = await supabase
        .from('submissions')
        .delete()
        .eq('id', claim.id)
        .eq('fabricator_id', user.id)
        .eq("status", "Pending");

      if (error) {
        setToast(error.message || 'Could not delete the request.');
        return;
      }

      setSubmissions((prev) => prev.filter((row) => row.id !== claim.id));
      setToast('Pending request deleted.');
    });
  }
  /* ASR_PENDING_CLAIM_DELETE_EXACT_END */

  /* ASR_FABRICATOR_STATUS_ICON_HELPER_START */
  function fabricatorClaimStatusIcon(status) {
    const value = String(status || '').toLowerCase();

    if (value === 'approved') {
      return (
        <span
          className="fabricator-claim-status-icon approved"
          title="Approved"
          aria-label="Approved"
        >
          <CheckCircle2 size={18} strokeWidth={2.4} aria-hidden="true" />
        </span>
      );
    }

    if (value === 'rejected') {
      return (
        <span
          className="fabricator-claim-status-icon rejected"
          title="Rejected"
          aria-label="Rejected"
        >
          <X size={18} strokeWidth={2.4} aria-hidden="true" />
        </span>
      );
    }

    return (
      <span
        className="fabricator-claim-status-icon pending"
        title="Pending"
        aria-label="Pending"
      >
        <Clock size={17} strokeWidth={2.4} aria-hidden="true" />
      </span>
    );
  }
  /* ASR_FABRICATOR_STATUS_ICON_HELPER_END */

  /* ASR_STAMP_SVG_HELPER_START */
  function stampSVG(type, uid, size) {
    const color = type === 'approved' ? '#08b83f' : '#f12f2f';
    const label = type === 'approved' ? 'APPROVED' : 'REJECTED';
    const ringText = type === 'approved'
      ? '\u2022 APPROVED \u2022 APPROVED \u2022 APPROVED \u2022 APPROVED \u2022 APPROVED \u2022 APPROVED \u2022'
      : '\u2022 REJECTED \u2022 REJECTED \u2022 REJECTED \u2022 REJECTED \u2022 REJECTED \u2022 REJECTED \u2022';

    const cx = 100, cy = 100;
    const scallopBase = 84;
    const scallopPeak = 95;
    const innerR = 62;
    const textR = 74;
    const N = 24;
    const svgSize = size != null ? size : 110;

    // Generate scalloped outer border path (clockwise, starting from top)
    let d = '';
    for (let i = 0; i < N; i++) {
      const a1 = (i / N) * 2 * Math.PI - Math.PI / 2;
      const a2 = ((i + 0.5) / N) * 2 * Math.PI - Math.PI / 2;
      const a3 = ((i + 1) / N) * 2 * Math.PI - Math.PI / 2;
      const x1 = (cx + scallopBase * Math.cos(a1)).toFixed(2);
      const y1 = (cy + scallopBase * Math.sin(a1)).toFixed(2);
      const px = (cx + scallopPeak * Math.cos(a2)).toFixed(2);
      const py = (cy + scallopPeak * Math.sin(a2)).toFixed(2);
      const x3 = (cx + scallopBase * Math.cos(a3)).toFixed(2);
      const y3 = (cy + scallopBase * Math.sin(a3)).toFixed(2);
      d += i === 0 ? `M${x1} ${y1} ` : '';
      d += `Q${px} ${py} ${x3} ${y3} `;
    }
    d += 'Z';

    // Circular path for ring text (clockwise from top)
    const pathId = `asr-tp-${uid}-${type}`;
    const textCircle = `M${cx} ${cy - textR} A${textR} ${textR} 0 0 1 ${cx} ${cy + textR} A${textR} ${textR} 0 0 1 ${cx} ${cy - textR}`;
    const circumference = (2 * Math.PI * textR).toFixed(1);

    return (
      <svg
        viewBox="0 0 200 200"
        width={svgSize}
        height={svgSize}
        style={{ display: 'block', margin: '0 auto', transform: 'rotate(-7deg)', overflow: 'visible', flexShrink: 0 }}
        aria-label={label}
        role="img"
      >
        <defs>
          <path id={pathId} d={textCircle} />
        </defs>
        {/* Scalloped shape — white fill, then colored stroke */}
        <path d={d} fill="white" />
        <path d={d} fill="none" stroke={color} strokeWidth="3.5" />
        {/* Inner circle */}
        <circle cx={cx} cy={cy} r={innerR} fill="white" stroke={color} strokeWidth="3" />
        {/* Ring text going all the way around */}
        <text fill={color} fontSize="10" fontWeight="800" fontFamily="'Arial','Helvetica',sans-serif">
          <textPath
            href={`#${pathId}`}
            startOffset="50%"
            textAnchor="middle"
            textLength={circumference}
            lengthAdjust="spacing"
          >
            {ringText}
          </textPath>
        </text>
        {/* Icon */}
        {type === 'approved' ? (
          <polyline
            points="74,102 89,118 126,82"
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <line x1="77" y1="77" x2="123" y2="123" stroke={color} strokeWidth="9" strokeLinecap="round" />
            <line x1="123" y1="77" x2="77" y2="123" stroke={color} strokeWidth="9" strokeLinecap="round" />
          </>
        )}
      </svg>
    );
  }
  /* ASR_STAMP_SVG_HELPER_END */

  /* ASR_LARGE_CLAIM_STAMP_HELPER_START */
  function fabricatorClaimStatusStamp(status, uid) {
    const value = String(status || '').toLowerCase();
    if (value === 'approved') return stampSVG('approved', uid);
    if (value === 'rejected') return stampSVG('rejected', uid);
    return (
      <span className="fabricator-claim-pending" aria-label="Pending">
        <Clock size={15} strokeWidth={2.3} aria-hidden="true" />
        <span>Pending</span>
      </span>
    );
  }
  /* ASR_LARGE_CLAIM_STAMP_HELPER_END */

  function fabricatorHistoryPage() {
    return (
      <div className="area">
        <h2 className="section-title">
          <History size={20} />
          My Claim History
        </h2>
        {myClaims.length === 0 ? (
          <div className="empty">No claims submitted yet.</div>
        ) : (
          myClaims.map((s) => (
            <div className="claim-history-card asr-claim-history-card" key={s.id}>
              {String(s.status || '').toLowerCase() === 'pending' && (
                <button
                  type="button"
                  className="asr-pending-claim-delete"
                  onClick={() => deletePendingClaim(s)}
                  aria-label={`Delete ${s.item_name || 'pending request'}`}
                  title="Delete pending request"
                >
                  <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              )}
              <div>
                <b>{s.item_name}</b>
                <div className="claim-details-grid fabricator-claim-details">
                  <div className="claim-detail-site">
                    <span>Site Name</span>
                    <b>{s.site_name || "Not provided"}</b>
                  </div>
                  <div>
                    <span>Date</span>
                    <b>{new Date(s.created_at || s.submission_date).toLocaleDateString("en-GB")}</b>
                  </div>
                  <div>
                    <span>Quantity</span>
                    <b>{s.quantity} {s.unit}</b>
                  </div>
                  <div>
                    <span>Points</span>
                    <b>{s.points_earned} pts</b>
                  </div>
                </div>
              </div>
              {fabricatorClaimStatusStamp(s.status, s.id)}
            </div>
          ))
        )}
        <div className="redemption-history-section">
          <h3>Redemption History</h3>
          {myRedemptions.length === 0 ? (
            <div className="empty compact-empty">No redemption requests yet.</div>
          ) : (
            myRedemptions.map((r) => (
              <div className="redemption-history-card" key={r.id}>
                <div>
                  <b>{num(r.points ?? r.points_requested).toLocaleString("en-IN")} pts</b>
                  <p>{new Date(r.created_at).toLocaleDateString("en-GB")}</p>
                  {r.narration && <small>{r.narration}</small>}
                </div>
                {(() => {
                  const st = String(r.status || '').toLowerCase();
                  if (st === 'approved') return stampSVG('approved', r.id, 76);
                  if (st === 'rejected') return stampSVG('rejected', r.id, 76);
                  return <span className={`status-pill ${st}`}>{r.status}</span>;
                })()}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }
  function notificationPanel() {
    return (
      <div className="notification-panel">
        <div className="notification-panel-head">
          <Bell size={16} />
          <span>Notifications</span>
        </div>
        {visibleNotifications.slice(0, 3).map((n) => (
          <div
            className="notification-mini-card"
            key={n.id || `${n.title}-${n.created_at}`}
          >
            <b>{n.title}</b>
            <p>{n.message}</p>
            <small>
              {n.created_by ? `From ${n.created_by} • ` : ""}
              {ago(n.created_at)}
            </small>
          </div>
        ))}
      </div>
    );
  }
  function notificationsPage() {
    return (
      <div className="grid">
        <div className="area notification-compose">
          <h2 className="section-title">
            <Megaphone size={20} />
            Send Notification
          </h2>
          <form onSubmit={sendNotification}>
            <div className="field">
              <label className="label">Send to</label>
              <select
                className="input"
                value={newNotification.target}
                onChange={(e) =>
                  setNewNotification({
                    ...newNotification,
                    target: e.target.value,
                    fabricator_id: "",
                  })
                }
              >
                <option value="all">Everyone</option>
                <option value="admin">Admins</option>
                <option value="salesman">Salesman</option>
                <option value="fabricator">All Fabricators</option>
                <option value="specific_fabricator">Specific Fabricator</option>
              </select>
            </div>
            {newNotification.target === "specific_fabricator" && (
              <div className="field">
                <label className="label">Fabricator</label>
                <select
                  className="input"
                  value={newNotification.fabricator_id}
                  onChange={(e) =>
                    setNewNotification({
                      ...newNotification,
                      fabricator_id: e.target.value,
                    })
                  }
                >
                  <option value="">-- Select Fabricator --</option>
                  {fabricators
                    .filter((f) => f.status === "Approved")
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} - {f.mobile}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div className="field">
              <label className="label">Title</label>
              <input
                className="input"
                placeholder="Example: New market rate update"
                value={newNotification.title}
                onChange={(e) =>
                  setNewNotification({
                    ...newNotification,
                    title: e.target.value,
                  })
                }
              />
            </div>
            <div className="field">
              <label className="label">Message</label>
              <textarea
                className="input notification-textarea"
                placeholder="Write notification message..."
                value={newNotification.message}
                onChange={(e) =>
                  setNewNotification({
                    ...newNotification,
                    message: e.target.value,
                  })
                }
              />
            </div>
            <button className="btn btn-primary full">Send Notification</button>
          </form>
        </div>
      </div>
    );
  }

  async function setAlertsOnOff(nextOn) {
    if (nextOn) {
      localStorage.setItem("asr_alerts_preference", "on");
      if (typeof setAlertsPreference === "function") setAlertsPreference("on");
      try {
        if (typeof enablePhoneNotifications === "function")
          await enablePhoneNotifications();
        if (
          typeof setPushPermission === "function" &&
          typeof getPushPermission === "function"
        )
          setPushPermission(getPushPermission());
        setToast("Alerts turned on for this device.");
      } catch (err) {
        console.warn("Enable alerts failed", err);
        setToast("Could not enable alerts on this device.");
      }
    } else {
      localStorage.setItem("asr_alerts_preference", "off");
      if (typeof setAlertsPreference === "function") setAlertsPreference("off");
      setToast("Alerts turned off on this device.");
    }
  }

  function alertsPage() {
    const historyRows =
      user?.role === "Admin"
        ? notifications.filter(
            (n) => !hiddenNotificationIds.includes(notificationKey(n)),
          )
        : visibleNotifications;
    return (
      <div className="grid">
        <div className="area">
          <div className="notification-history-head">
            <h2 className="section-title">
              <Bell size={20} />
              Notification History
            </h2>
            {historyRows.length > 0 && (
              <button
                className="btn btn-soft"
                onClick={clearNotificationHistory}
              >
                Clear History
              </button>
            )}
          </div>
          {historyRows.length === 0 ? (
            <div className="empty">No notifications to show.</div>
          ) : (
            historyRows.map((n) => (
              <div
                className="notification-history-card"
                key={notificationKey(n)}
              >
                <div>
                  <div className="notification-target-pill">
                    {String(n.target || "all").startsWith("fabricator:")
                      ? "Specific Fabricator"
                      : n.target}
                  </div>
                  <b>{n.title}</b>
                  <p>{n.message}</p>
                  <small>
                    {n.created_by ? `By ${n.created_by} • ` : ""}
                    {ago(n.created_at)}
                  </small>
                </div>
                {user?.role === "Admin" && (
                  <button
                    className="notification-delete"
                    onClick={() => deleteNotification(n)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  const adminMenu = [
      { id: "calculator", label: "Calculator", icon: <Calculator size={18} /> },
      { id: "orders", label: "Orders", icon: <ClipboardList size={18} /> },
      { id: "market", label: "Daily Rate", icon: <BarChart3 size={18} /> },
      { id: "daily", label: "Sizes", icon: <FolderPlus size={18} /> },
      { id: "claims", label: "Claims", icon: <CheckCircle2 size={18} /> },
      { id: "redemptions", label: "Redeem", icon: <RefreshCw size={18} /> },
      { id: "signups", label: "Signups", icon: <UserPlus size={18} /> },
      { id: "salesmen", label: "SalesMan", icon: <Calculator size={18} /> },
      { id: "items", label: "Items", icon: <PlusCircle size={18} /> },
      { id: "notifications", label: "Notify", icon: <Megaphone size={18} /> },
      { id: "alerts", label: "Alerts", icon: <Bell size={18} /> },
      { id: "history", label: "History", icon: <History size={18} /> },
    ],
    fabMenu = [
      { id: "apply", label: "Apply", icon: <PlusCircle size={18} /> },

      { id: "history", label: "History", icon: <History size={18} /> },
    ],
    salesMenu = [
      { id: "calculator", label: "Calculator", icon: <Calculator size={18} /> },
      { id: "orders", label: "Orders", icon: <ClipboardList size={18} /> },
    ];

  function sideMenu(type) {
    const isAdmin = type === "admin",
      isSales = type === "salesman",
      list = isSales ? salesMenu : isAdmin ? adminMenu : fabMenu,
      current = isAdmin ? adminTab : fabTab,
      setTab = isAdmin ? setAdminTab : setFabTab;
    return (
      <>
        <div
          className={`sidebar-backdrop ${sideOpen ? "show" : ""}`}
          onClick={() => setSideOpen(false)}
        />
        <aside className={`side-menu ${sideOpen ? "open" : ""}`}>
          <div className="side-menu-head">
            <div className="side-logo-card">
              <Logo />
            </div>
            <button className="side-close" onClick={() => setSideOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="side-menu-title">
            {isSales
              ? "Salesman Menu"
              : isAdmin
                ? "Admin Menu"
                : "Fabricator Menu"}
          </div>
          <div className="side-menu-list">
            {list.map((item) => (
              <button
                key={item.id}
                className={`side-menu-item ${current === item.id ? "active" : ""}`}
                onClick={() => {
                  setTab(item.id);
                  setSideOpen(false);
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </aside>
      </>
    );
  }
  function bottomNav(type) {
    const isAdmin = type === "admin",
      isSales = type === "salesman",
      base = isSales ? salesMenu : isAdmin ? adminMenu : fabMenu,
      list = isAdmin
        ? base
        : [
            ...base,
            { id: "logout", label: "Logout", icon: <LogOut size={18} /> },
          ],
      current = isAdmin ? adminTab : fabTab;
    return (
      <div className="bottom-nav-scroll">
        {list.map((item) => (
          <button
            key={item.id}
            className={current === item.id ? "active" : ""}
            onClick={() =>
              item.id === "logout"
                ? logout()
                : isAdmin
                  ? setAdminTab(item.id)
                  : setFabTab(item.id)
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    );
  }
  function confirmDialog() {
    if (!confirmBox) return null;
    return (
      <div className="confirm-backdrop">
        <div className="confirm-box">
          <button className="confirm-x" onClick={() => setConfirmBox(null)}>
            <X size={16} />
          </button>
          <div className="confirm-icon">
            <Trash2 size={20} />
          </div>
          <h3>{confirmBox.title}</h3>
          <p>This action cannot be undone.</p>
          <div className="confirm-actions">
            <button
              className="btn btn-soft"
              onClick={() => setConfirmBox(null)}
            >
              No
            </button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                const fn = confirmBox.onYes;
                setConfirmBox(null);
                await fn();
              }}
            >
              Yes, delete
            </button>
          </div>
        </div>
      </div>
    );
  }
  function alertEnablePopup() {
    if (!alertPromptOpen || !user) return null;
    return (
      <div className="confirm-backdrop">
        <div className="confirm-box">
          <button
            className="confirm-x"
            onClick={() => setAlertPromptOpen(false)}
          >
            <X size={16} />
          </button>
          <div className="confirm-icon">
            <Bell size={20} />
          </div>
          <h3>Enable ASR Iron notifications?</h3>
          <p>Stay updated with important ASR Iron alerts on this device.</p>
          <div className="confirm-actions">
            <button
              className="btn btn-soft"
              onClick={() => setAlertPromptOpen(false)}
            >
              Later
            </button>
            <button
              className="btn btn-gold"
              onClick={async () => {
                setAlertPromptOpen(false);
                await setAlertsOnOff(true);
              }}
            >
              Enable
            </button>
          </div>
        </div>
      </div>
    );
  }

  function Header({ type }) {
    const browserAlertPermission =
      typeof Notification !== "undefined"
        ? Notification.permission
        : pushPermission;
    const alertsOn =
      alertsPreference !== "off" && browserAlertPermission === "granted";
    const roleLabel =
      type === "admin"
        ? "ADMIN"
        : type === "salesman"
          ? "SALESMAN"
          : "FABRICATOR PARTNER";
    const displayName =
      type === "fabricator"
        ? activeFabricator?.name || user?.name || ""
        : user?.name || (type === "admin" ? "Admin" : "Sales");
    return (
      <>
        <header className="header app-light-header">
          <div className="head-inner app-light-head-inner">
            <div className="brand-row app-light-brand-row">
              <button
                className="hamburger-btn app-light-menu-btn"
                onClick={() => setSideOpen(true)}
                aria-label="Open menu"
              >
                <Menu size={22} />
              </button>
              <Logo />
              <span className="partner-badge app-light-role-badge">
                {roleLabel}
                <br />
                <b>{displayName}</b>
              </span>
            </div>

            <div className="head-actions">
              <button
                type="button"
                className={`fabricator-alert-status-icon ${alertsOn ? "on" : "off"}`}
                onClick={() => {
                  if (alertsOn) {
                    setAlertsOnOff(false);
                  } else {
                    setAlertPromptOpen(true);
                  }
                }}
                aria-label={alertsOn ? "Phone alerts are on" : "Phone alerts are off"}
                title={alertsOn ? "Alerts On" : "Alerts Off"}
              >
                <Bell size={17} strokeWidth={2} aria-hidden="true" />
                <span className="fabricator-alert-status-dot" />
              </button>
              <button
                className="btn btn-soft header-logout-btn app-light-logout-btn"
                onClick={logout}
                aria-label="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>
        {sideMenu(type)}
      </>
    );
  }

  function dashboard(type) {
    const isAdmin = type === "admin",
      isSales = type === "salesman",
      tab = isAdmin ? adminTab : fabTab;
    return (
      <div className="screen">
        <Header type={type} />
        <main className="main">
          {isSales && tab === "calculator" && calculatorPage()}
          {isSales && tab === "orders" && orderPage()}
          {isAdmin &&
            ["calculator", "market", "daily"].includes(tab) &&
            ticker()}
          {isAdmin && tab === "calculator" && (
            <div className="area">{calculatorPage()}</div>
          )}
          {isAdmin && tab === "market" && marketPage()}
          {isAdmin && tab === "daily" && dailyPage()}
          {isAdmin && tab === "orders" && orderPage()}
          {isAdmin && tab === "claims" && claimsPage()}
          {isAdmin && tab === "redemptions" && redemptionsPage()}
          {isAdmin && tab === "signups" && signupsPage()}
          {isAdmin && tab === "salesmen" && salesmenPage()}
          {isAdmin && tab === "items" && itemsPage()}
          {isAdmin && tab === "notifications" && notificationsPage()}
          {tab === "alerts" && type === "admin" && alertsPage()}
          {isAdmin && tab === "history" && historyPage()}
          {!isAdmin && tab === "notifications" && notificationsPage()}
          {type === "fabricator" && !["notifications", "alerts"].includes(tab) && fabricatorHome()}
        </main>
        {bottomNav(type)}
      </div>
    );
  }
  function loginPage() {
    return (
      <div className="screen center">
        <div className="login-card card">
          <div className="login-head">
            <Logo />
            <div className="bar" />
            <p className="subtitle">Incentive Reward Portal</p>
          </div>
          <div className="login-body">
            {loginError && <div className="error">{loginError}</div>}
            <form onSubmit={handleLogin}>
              <div className="field">
                <label className="label">Mobile / Username</label>
                <input
                  className="input"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
              <button className="btn btn-primary full">Sign In</button>
            </form>
            <div style={{ height: 20 }} />
            <button
              className="btn btn-outline full"
              onClick={() => {
                setScreen("signup");
                setSignupOk(false);
              }}
            >
              <UserPlus size={18} />
              Register Business / Partner
            </button>
          </div>
        </div>
      </div>
    );
  }
  function signupPage() {
    return (
      <div className="screen center">
        <div className="login-card card">
          <div className="login-head">
            <Logo />
            <div className="bar" />
            <p className="subtitle">Business / Partner Sign Up</p>
          </div>
          <div className="login-body">
            {signupOk ? (
              <div>
                <CheckCircle2 size={56} color="#059669" />
                <h3>Registration Complete</h3>
                <p className="muted">
                  Admin approval is required before login.
                </p>
                <button
                  className="btn btn-primary full"
                  onClick={() => setScreen("login")}
                >
                  Back
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignup}>
                <div className="registration-type-switch">
                  <button type="button" className={signup.registrationType === "business" ? "active" : ""} onClick={() => setSignup({ ...signup, registrationType: "business" })}>Business</button>
                  <button type="button" className={signup.registrationType === "partner" ? "active" : ""} onClick={() => setSignup({ ...signup, registrationType: "partner" })}>Partner</button>
                </div>
                {signupError && <div className="error">{signupError}</div>}
                <input
                  className="input"
                  placeholder={signup.registrationType === "business" ? "Business Name" : "Shop / Partner Name"}
                  value={signup.name}
                  onChange={(e) =>
                    setSignup({ ...signup, name: e.target.value })
                  }
                  required
                />
                <br />
                <br />
                {signup.registrationType === "business" && (
                  <>
                    <input className="input" placeholder="Unique User ID" value={signup.userId} onChange={(e) => setSignup({ ...signup, userId: e.target.value })} required />
                    <br /><br />
                  </>
                )}
                <input
                  className="input"
                  placeholder="Mobile"
                  pattern="[0-9]{10}"
                  value={signup.mobile}
                  onChange={(e) =>
                    setSignup({ ...signup, mobile: e.target.value })
                  }
                  required
                />
                <br />
                <br />
                <textarea
                  className="input"
                  placeholder="Address"
                  value={signup.address}
                  onChange={(e) =>
                    setSignup({ ...signup, address: e.target.value })
                  }
                  required
                />
                <br />
                <br />
                <input
                  className="input"
                  type="password"
                  placeholder="Password"
                  value={signup.password}
                  onChange={(e) =>
                    setSignup({ ...signup, password: e.target.value })
                  }
                  required
                />
                <br />
                <br />
                <button className="btn btn-primary full">
                  Submit for Approval
                </button>
                <button
                  type="button"
                  className="btn btn-soft full"
                  onClick={() => setScreen("login")}
                >
                  Back
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }
  if (loading)
    return (
      <div className="asr-loading-screen">
        <div className="asr-loading-card">
          <Logo loading />
          <div className="asr-loading-dots">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    );
  return (
    <div>
      {pullRefreshDistance > 0 && (
        <div
          className="ios-pull-refresh"
          style={{ transform: `translate(-50%, ${Math.min(pullRefreshDistance, 70)}px)` }}
        >
          <RefreshCw
            size={16}
            className={pullRefreshDistance >= 70 ? "ready" : ""}
          />
          <span>{pullRefreshDistance >= 70 ? "Release to refresh" : "Pull to refresh"}</span>
        </div>
      )}
      {toast && (
        <div className="toast toast-message">
          <span>{toast}</span>
          <button className="toast-close" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {confirmDialog()}
      {alertEnablePopup()}
      {orderAlert && (
        <div className="order-alert-backdrop">
          <div className="order-alert-modal">
            <div className="order-alert-icon"><Bell size={24} /></div>
            <h2>New order placed</h2>
            <p>{orderAlert.message}</p>
            <button className="btn btn-primary full" onClick={() => setOrderAlert(null)}>OK, seen</button>
          </div>
        </div>
      )}
      {screen === "login" && loginPage()}
      {screen === "signup" && signupPage()}
      {screen === "admin" && user && dashboard("admin")}
      {screen === "fabricator" && user && dashboard("fabricator")}
      {screen === "salesman" && user && dashboard("salesman")}
    </div>
  );
}
