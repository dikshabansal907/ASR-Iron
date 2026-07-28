import React, { useEffect, useMemo, useState } from "react";
import {

// ASR_NATURAL_NUMERIC_SIZE_SORT: Sort size/spec names by their leading numeric values, then full text.
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
  Mail,
  TrendingUp,
  TrendingDown,
  MinusCircle,
  RefreshCw,
  Clock,
  Bell,
  Megaphone,
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import {
  enablePushForUser,
  sendSystemPushNotification,
  isPushSupported,
  getPushPermission,
} from "./pushNotifications";

function asrSortSizes(list) {
  return [...(list || [])].sort((a, b) => asrNaturalSizeCompare(a, b));
}


// ASR_NATURAL_NUMERIC_SIZE_SORT: Sort size/spec names by numeric chunks first, then text.
const num = (v) => Number(v || 0),
  round05 = (v) => Math.round(num(v) * 20) / 20,
  inr = (v) =>
    `₹${round05(v).toLocaleString("en-IN", { minimumFractionDigits: round05(v) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};
function ago(v) {
  if (!v) return "not updated";
  const ms = Date.now() - new Date(v).getTime();
  if (ms < 6e4) return "just now";
  const m = Math.floor(ms / 6e4);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}
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
  // ASR_MOBILE_ADD_ITEM_SCROLL_FINAL_FIX: prevent mobile jump after Add Item by locking viewport and blocking textarea focus during the update.
  useEffect(() => {
    let lockActive = false;
    let savedX = 0;
    let savedY = 0;
    let unlockTimer = 0;
    let restoreTimers = [];
    const originalTextareaFocus = window.HTMLTextAreaElement?.prototype?.focus;

    const textOf = (el) =>
      [
        el?.textContent,
        el?.value,
        el?.getAttribute?.("aria-label"),
        el?.getAttribute?.("title"),
        el?.getAttribute?.("data-action"),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    const looksLikeCalculatorArea = (el) => {
      const container = el?.closest?.(
        "form, .calculator, .calculator-page, .quote, .quotation, .proposal, main, section, .area, .card",
      );
      const text = textOf(container || el);
      return (
        text.includes("quantity") ||
        text.includes("category") ||
        text.includes("quote") ||
        text.includes("quotation") ||
        text.includes("summary") ||
        text.includes("estimate")
      );
    };

    const isAddControl = (target) => {
      const btn = target?.closest?.(
        'button, input[type="submit"], [role="button"]',
      );
      if (!btn) return false;
      const txt = textOf(btn);
      if (txt.includes("add")) return true;
      if (txt.includes("+") && looksLikeCalculatorArea(btn)) return true;
      return false;
    };

    const restore = () => {
      if (!lockActive) return;
      try {
        window.scrollTo(savedX, savedY);
      } catch {}
    };

    const lock = () => {
      if (lockActive) return;
      savedX = window.scrollX || document.documentElement.scrollLeft || 0;
      savedY = window.scrollY || document.documentElement.scrollTop || 0;
      lockActive = true;
      try {
        document.activeElement?.blur?.();
      } catch {}

      // Prevent textarea focus from pulling the browser to the quote box while add/update is happening.
      if (originalTextareaFocus && window.HTMLTextAreaElement?.prototype) {
        window.HTMLTextAreaElement.prototype.focus =
          function patchedTextareaFocus(...args) {
            if (lockActive) return;
            return originalTextareaFocus.apply(this, args);
          };
      }

      document.documentElement.classList.add("asr-add-item-lock");
      document.body.classList.add("asr-add-item-lock");
      document.documentElement.style.setProperty(
        "overflow",
        "hidden",
        "important",
      );
      document.body.style.setProperty("overflow", "hidden", "important");
    };

    const unlock = () => {
      if (!lockActive) return;
      lockActive = false;
      if (originalTextareaFocus && window.HTMLTextAreaElement?.prototype) {
        window.HTMLTextAreaElement.prototype.focus = originalTextareaFocus;
      }
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.documentElement.classList.remove("asr-add-item-lock");
      document.body.classList.remove("asr-add-item-lock");
      try {
        window.scrollTo(savedX, savedY);
      } catch {}
    };

    const schedule = () => {
      restoreTimers.forEach(clearTimeout);
      restoreTimers = [0, 25, 75, 150, 300, 550, 850].map((ms) =>
        setTimeout(restore, ms),
      );
      clearTimeout(unlockTimer);
      unlockTimer = setTimeout(unlock, 950);
    };

    const beforeAction = (event) => {
      if (isAddControl(event.target)) lock();
    };
    const afterAction = (event) => {
      if (isAddControl(event.target)) {
        lock();
        schedule();
      }
    };
    const onSubmit = (event) => {
      if (event.submitter && isAddControl(event.submitter)) {
        lock();
        schedule();
      }
    };

    document.addEventListener("touchstart", beforeAction, true);
    document.addEventListener("pointerdown", beforeAction, true);
    document.addEventListener("mousedown", beforeAction, true);
    document.addEventListener("click", afterAction, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      restoreTimers.forEach(clearTimeout);
      clearTimeout(unlockTimer);
      unlock();
      document.removeEventListener("touchstart", beforeAction, true);
      document.removeEventListener("pointerdown", beforeAction, true);
      document.removeEventListener("mousedown", beforeAction, true);
      document.removeEventListener("click", afterAction, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  // ASR_FORCE_VISIBLE_CLEAR_BUTTON_V4: force a visible delete-all button beside Reset, without MutationObserver loops.
  const asrClearEveryQuoteState = () => {
    try {
      if (typeof setQuoteItems === "function") setQuoteItems([]);
    } catch {}
    try {
      if (typeof setCalculatorCart === "function") setCalculatorCart([]);
    } catch {}
    try {
      if (typeof setCart === "function") setCart([]);
    } catch {}
    try {
      if (typeof setQuoteRows === "function") setQuoteRows([]);
    } catch {}
    try {
      if (typeof setProposalRows === "function") setProposalRows([]);
    } catch {}
    try {
      if (typeof setInvoiceRows === "function") setInvoiceRows([]);
    } catch {}
    try {
      if (typeof setEstimateItems === "function") setEstimateItems([]);
    } catch {}
    try {
      if (typeof setSummaryItems === "function") setSummaryItems([]);
    } catch {}
    try {
      if (typeof setLineItems === "function") setLineItems([]);
    } catch {}
    try {
      if (typeof setSelectedItems === "function") setSelectedItems([]);
    } catch {}

    try {
      if (typeof setQuoteText === "function") setQuoteText("");
    } catch {}
    try {
      if (typeof setEditedQuoteText === "function") setEditedQuoteText("");
    } catch {}
    try {
      if (typeof setQuoteManualText === "function") setQuoteManualText("");
    } catch {}
    try {
      if (typeof setEditableQuoteText === "function") setEditableQuoteText("");
    } catch {}
    try {
      if (typeof setShareText === "function") setShareText("");
    } catch {}
    try {
      if (typeof setQuoteEdited === "function") setQuoteEdited(false);
    } catch {}

    // Also clear the actual textarea immediately for visual feedback.
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

    try {
      if (typeof setToast === "function") setToast("Quotation cleared.");
    } catch {}
  };

  const asrConfirmClearEveryQuoteState = () => {
    const message = "Delete all added items?";
    const run = () => asrClearEveryQuoteState();
    try {
      if (typeof askDelete === "function") return askDelete(message, run);
    } catch {}
    try {
      if (typeof askConfirmation === "function")
        return askConfirmation(message, run);
    } catch {}
    try {
      if (typeof setConfirmBox === "function")
        return setConfirmBox({ title: message, onYes: run });
    } catch {}
    try {
      if (typeof setConfirmModal === "function")
        return setConfirmModal({ isOpen: true, message, onConfirm: run });
    } catch {}
    if (window.confirm("Are you sure you want to delete all the added items?"))
      run();
  };

  useEffect(() => {
    let stopped = false;
    const addButton = () => {
      if (stopped || document.querySelector(".asr-force-clear-btn")) return;

      const buttons = Array.from(document.querySelectorAll("button"));
      // Prefer the Reset button, but fall back to the last share/action row button if needed.
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
      btn.addEventListener("click", asrConfirmClearEveryQuoteState);
      anchor.insertAdjacentElement("afterend", btn);
    };

    addButton();
    const timer = setInterval(addButton, 700);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);
  // ASR_FORCE_VISIBLE_CLEAR_BUTTON_V4_END

  function asrClearAllQuotesNow() {
    try {
      if (typeof setQuoteItems === "function") setQuoteItems([]);
    } catch {}
    try {
      if (typeof setCalculatorCart === "function") setCalculatorCart([]);
    } catch {}
    try {
      if (typeof setCart === "function") setCart([]);
    } catch {}
    try {
      if (typeof setQuoteRows === "function") setQuoteRows([]);
    } catch {}
    try {
      if (typeof setProposalRows === "function") setProposalRows([]);
    } catch {}
    try {
      if (typeof setInvoiceRows === "function") setInvoiceRows([]);
    } catch {}
    try {
      if (typeof setEstimateItems === "function") setEstimateItems([]);
    } catch {}
    try {
      if (typeof setSummaryItems === "function") setSummaryItems([]);
    } catch {}
    try {
      if (typeof setLineItems === "function") setLineItems([]);
    } catch {}
    try {
      if (typeof setSelectedItems === "function") setSelectedItems([]);
    } catch {}

    try {
      if (typeof setQuoteText === "function") setQuoteText("");
    } catch {}
    try {
      if (typeof setEditedQuoteText === "function") setEditedQuoteText("");
    } catch {}
    try {
      if (typeof setQuoteManualText === "function") setQuoteManualText("");
    } catch {}
    try {
      if (typeof setEditableQuoteText === "function") setEditableQuoteText("");
    } catch {}
    try {
      if (typeof setShareText === "function") setShareText("");
    } catch {}
    try {
      if (typeof setQuoteEdited === "function") setQuoteEdited(false);
    } catch {}

    try {
      if (typeof setToast === "function") setToast("Quotation cleared.");
    } catch {}
  }

  function asrAskClearAllQuotes() {
    const message = "Delete all added items?";
    const run = () => asrClearAllQuotesNow();
    try {
      if (typeof askDelete === "function") return askDelete(message, run);
    } catch {}
    try {
      if (typeof askConfirmation === "function")
        return askConfirmation(message, run);
    } catch {}
    try {
      if (typeof setConfirmBox === "function")
        return setConfirmBox({ title: message, onYes: run });
    } catch {}
    try {
      if (typeof setConfirmModal === "function")
        return setConfirmModal({ isOpen: true, message, onConfirm: run });
    } catch {}
    if (window.confirm("Are you sure you want to delete all the added items?"))
      run();
  }

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
        characterData: true,
      });
    window.addEventListener("resize", decorateQuantityInputs);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("resize", decorateQuantityInputs);
    };
  });

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
  });

  const [screen, setScreen] = useState("login"),
    [user, setUser] = useState(null),
    [fabricators, setFabricators] = useState([]),
    [submissions, setSubmissions] = useState([]),
    [items, setItems] = useState([]),
    [categories, setCategories] = useState([]),
    [rateItems, setRateItems] = useState([]),
    [loading, setLoading] = useState(true),
    [toast, setToast] = useState(""),
    [confirmBox, setConfirmBox] = useState(null),
    [sideOpen, setSideOpen] = useState(false);
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
      name: "",
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
    [qty, setQty] = useState("0"),
    [cart, setCart] = useState([]),
    [quoteText, setQuoteText] = useState(""),
    [quoteEdited, setQuoteEdited] = useState(false);
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
    [claimOk, setClaimOk] = useState(false);
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
    let rows = rateItems.filter((x) => x.category_id === categoryId);
    const c = categories.find((x) => x.id === categoryId);
    //if (c?.name?.toLowerCase() === "pipe") rows = [...rows].reverse();
    //else
      rows = [...rows].sort((a, b) =>
        String(a.name).localeCompare(String(b.name), undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
    if (sizeSearch)
      rows = rows.filter((x) =>
        String(x.name).toLowerCase().includes(sizeSearch.toLowerCase()),
      );
    return rows;
  }, [rateItems, categoryId, categories, sizeSearch]);
  const activeFabricator = useMemo(
    () => fabricators.find((f) => f.id === user?.id) || user,
    [fabricators, user],
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
  async function loadAll() {
    setLoading(true);
    if (!supabase) {
      await loadNotifications();
      setToast("Supabase env missing. Add .env.local and restart.");
      setLoading(false);
      return;
    }
    const [f, s, i, c, r] = await Promise.all([
      supabase.from("fabricators").select("*").order("created_at"),
      supabase
        .from("submissions")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("incentive_items").select("*").order("created_at"),
      supabase.from("rate_categories").select("*").order("name"),
      supabase.from("rate_items").select("*").order("created_at"),
    ]);
    if (f.error || s.error || i.error || c.error || r.error)
      setToast("Database load failed. Check Supabase/RLS.");
    else {
      setFabricators(f.data || []);
      setSubmissions(s.data || []);
      setItems(i.data || []);
      setCategories(c.data || []);
      setRateItems(r.data || []);
      if (!categoryId && c.data?.length) setCategoryId(c.data[0].id);
    }
    await loadNotifications();
    setLoading(false);
  }
  useEffect(() => {
    loadAll();
    const saved = JSON.parse(localStorage.getItem("asrLogin") || "null");
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
      setFabTab("apply");
    }
    if ("serviceWorker" in navigator)
      window.addEventListener("load", () =>
        navigator.serviceWorker.register("/sw.js").catch(() => {}),
      );
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
    const next = visibleNotifications.find(
      (n) => !seenSet.has(notificationKey(n)),
    );
    if (!next) return;
    const updated = [notificationKey(next), ...seen].slice(0, 200);
    localStorage.setItem(seenKey, JSON.stringify(updated));
    setToast(`🔔 ${next.title}: ${next.message}`);
  }, [visibleNotifications, user]);
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
    if (
      ["sales", "salesman"].includes(loginId.trim().toLowerCase()) &&
      ["sales123", "salesman"].includes(loginPassword)
    ) {
      const u = { id: "salesman", name: "Salesman", role: "salesman" };
      setUser(u);
      setScreen("salesman");
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
    const { error } = await supabase
      .from("fabricators")
      .insert({ ...signup, total_points: 0, status: "Pending" });
    if (error) return setSignupError(error.message);
    setSignupOk(true);
    setSignup({ name: "", mobile: "", address: "", password: "" });
    await loadAll();
  }
  async function submitClaim(e) {
    e.preventDefault();
    const item = items.find((i) => i.id === claimItemId);
    if (!item || !claimQty || Number(claimQty) <= 0) return;
    const q = Number(claimQty),
      points = q * num(item.points_per_unit);
    const payload = {
      fabricator_id: user.id,
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
    if (!categoryId || !sizeId || qty === "" || Number(qty) < 0) return;
    const s = rateItems.find((x) => x.id === sizeId),
      c = getCategory(categoryId);
    if (!s || !c) return;
    const u = unitRate(categoryId, s.fixed_difference),
      q = Number(qty),
      total = q === 0 ? u : round05(u * q);
    setCart([
      ...cart,
      {
        id: `cart-${Date.now()}`,
        category: c.name,
        itemName: s.name,
        qty: q,
        unitRate: u,
        total,
      },
    ]);
    setQuoteEdited(false);
    setSizeId("");
    setQty("0");
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
    lines.push("📝 *ASR Iron* ");
    lines.push("   *" + today() + "*");
    lines.push("-------------------------------------");
    if (!cart.length) {
      lines.push("No items added");
    } else {
      cart.forEach((item, index) => {
        const qtyValue = num(item.qty ?? item.quantity ?? 0);
        const rateValue = num(item.unitRate ?? item.rate ?? 0);
        const totalValue = num(
          item.total ??
            item.finalTotal ??
            (qtyValue === 0 ? rateValue : rateValue * qtyValue),
        );
        const category = item.category || item.categoryName || "";
        const spec = item.itemName || item.sizeName || item.name || "";
        if (qtyValue === 0) {
          lines.push(
            index +
              1 +
              ". *" +
              category +
              " - " +
              spec +
              "* : *" +
              inr(rateValue) +
              "*",
          );
        } else {
          lines.push(
            index +
              1 +
              ". *" +
              category +
              " - " +
              spec +
              "* : " +
              inr(rateValue) +
              "*" +
              qtyValue +
              "kg : *" +
              inr(totalValue) +
              "*",
          );
        }
        lines.push("");
      });
    }
    lines.push("-------------------------------------");
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
                placeholder="Sizes"
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
                <div className="market-card-head">
                  <div>
                    <div className="rate-name">{row.name}</div>
                    {dailyRateItemTopToggle(row)}
                    <div className="rate-value">{inr(row.daily_rate)}</div>
                    <div className={`rate-change ${d.cls}`}>
                      {d.icon}
                      {d.txt}
                    </div>
                    <div className="rate-time">
                      Last updated {ago(row.updated_at || row.created_at)}
                    </div>
                  </div>
                  <button
                    className="market-delete-btn"
                    onClick={() => deleteSegment(row)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="market-update-grid">
                  <div className="field">
                    <label className="label">New Sizes</label>
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
          <select
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

  function shareWhatsApp() {
    const text = getCurrentQuoteText();
    if (!text) return setToast("No quote text to share.");
    window.open(
      "https://wa.me/?text=" + encodeURIComponent(text),
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function shareQuote() {
    const text = getCurrentQuoteText();
    if (!text) return setToast("No quote text to share.");
    if (navigator.share) {
      try {
        await navigator.share({ title: "ASR Iron Quotation", text });
        return;
      } catch {
        return;
      }
    }
    await copyQuote();
  }

  const nativeShareQuote = shareQuote;
  const nativeShareQuotation = shareQuote;
  const overallShare = shareQuote;

  function resetQuoteText() {
    try {
      setQuoteText(buildQuote());
      setQuoteEdited(false);
      setToast("Quote text reset.");
    } catch {
      setQuoteEdited(false);
    }
  }

  function whatsapp() {
    if (typeof shareWhatsApp === "function") return shareWhatsApp();
    if (typeof shareQuotation === "function") return shareQuotation("whatsapp");
    try {
      const text =
        quoteText && String(quoteText).trim() ? quoteText : buildQuote();
      if (!text) return setToast("No quote text to share.");
      window.open(
        "https://wa.me/?text=" + encodeURIComponent(text),
        "_blank",
        "noopener,noreferrer",
      );
    } catch {
      setToast("WhatsApp share failed.");
    }
  }

  // Legacy fallback only: Telegram UI is intentionally removed.
  function telegram() {
    return null;
  }

  // Legacy fallback only: Email UI is intentionally removed.
  function email() {
    return null;
  }

  function _asrCurrentQuoteText() {
    try {
      if (
        typeof quoteText !== "undefined" &&
        quoteText &&
        String(quoteText).trim()
      )
        return quoteText;
      if (typeof buildQuote === "function") return buildQuote();
    } catch {}
    return "";
  }

  async function copyText() {
    return copyQuote();
  }

  const nativeShare = shareQuote;

  const share = shareQuote;

  function resetText() {
    return resetQuoteText();
  }

  // Legacy fallback only: Telegram UI is intentionally removed.
  function shareTelegram() {
    return null;
  }

  // Legacy fallback only: Email UI is intentionally removed.
  function shareEmail() {
    return null;
  }

  function resetQuote() {
    return resetQuoteText();
  }

  function resetQuotation() {
    return resetQuoteText();
  }

  function resetShareText() {
    return resetQuoteText();
  }

  function calculatorPage() {
    const activeSizes = rateItems.filter((x) => x.category_id === categoryId),
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
                  setQty("0");
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
              <div className="field">
                <label className="label">Step 2: Choose Size</label>
                <select
                  value={sizeId}
                  onChange={(e) => {
                    setSizeId(e.target.value);
                    setQty("0");
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
              </div>
            )}
            {categoryId && sizeId && (
              <div className="small-card">
                <div className="field">
                  <label className="label">Quantity kg</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
            <button
              className="btn btn-primary full"
              disabled={!categoryId || !sizeId || qty === "" || Number(qty) < 0}
            >
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
                        {i.qty === 0 ? "" : ` * ${i.qty}`}
                      </div>
                    </div>
                    <div className="quote-mini-price">{inr(i.total)}</div>
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
                <button className="share-btn reset" onClick={resetQuote}>
                  <X size={15} />
                  <span>Reset</span>
                </button>
              </div>
              <div className="quote-total compact-total">
                <div>
                  <div className="label">Total kg</div>
                  <b>{cart.reduce((s, i) => s + i.qty, 0).toFixed(1)} kg</b>
                </div>
                <div>
                  <div className="label">Estimated Invoice</div>
                  <div className="big-green">{inr(total)}</div>
                </div>
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
  function signupsPage() {
    const pending = fabricators.filter((f) => f.status === "Pending"),
      approved = fabricators.filter((f) => f.status === "Approved");
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
          <h2 className="section-title">Approved Fabricators</h2>
          {approved.map((f) => (
            <div className="small-card" key={f.id}>
              <b>{f.name}</b>
              <p>
                {f.mobile} • {f.total_points} pts
              </p>
            </div>
          ))}
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
                    <p className="claim-meta">
                      {s.quantity} {s.unit} • {s.points_earned} pts
                    </p>
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
          </div>
          <div className="workshop-pill">
            Registered Workshop:<b>{name}</b>
          </div>
        </div>
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
          <button className="btn btn-primary full submit-claim-btn">
            Submit for Admin Approval
          </button>
        </form>
      </div>
    );
  }
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
            <div className="claim-history-card" key={s.id}>
              <div>
                <b>{s.item_name}</b>
                <p>
                  {s.quantity} {s.unit} • {s.points_earned} pts
                </p>
              </div>
              <span className={`status-pill ${String(s.status).toLowerCase()}`}>
                {s.status}
              </span>
            </div>
          ))
        )}
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
    const alertOn = alertsPreference !== "off" && pushPermission === "granted";
    const historyRows =
      user?.role === "Admin"
        ? notifications.filter(
            (n) => !hiddenNotificationIds.includes(notificationKey(n)),
          )
        : visibleNotifications;
    return (
      <div className="grid">
        <div className={`area alerts-settings-card ${alertOn ? "on" : "off"}`}>
          <div>
            <h2 className="section-title">
              <Bell size={20} />
              Alerts
            </h2>
            <p className="muted">
              Phone notifications are $
              {alertOn ? "enabled" : "off or not enabled"} on this device.
            </p>
          </div>
          <label className="alerts-radio-row">
            <span
              className={alertOn ? "alert-status-green" : "alert-status-muted"}
            >
              {alertOn ? "Alerts ON" : "Alerts OFF"}
            </span>
            <input
              type="checkbox"
              checked={alertOn}
              onChange={(e) => setAlertsOnOff(e.target.checked)}
            />
          </label>
        </div>
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
      { id: "market", label: "Daily Rate", icon: <BarChart3 size={18} /> },
      { id: "daily", label: "Sizes", icon: <FolderPlus size={18} /> },
      { id: "claims", label: "Claims", icon: <CheckCircle2 size={18} /> },
      { id: "signups", label: "Signups", icon: <UserPlus size={18} /> },
      { id: "items", label: "Items", icon: <PlusCircle size={18} /> },
      { id: "notifications", label: "Notify", icon: <Megaphone size={18} /> },
      { id: "alerts", label: "Alerts", icon: <Bell size={18} /> },
      { id: "history", label: "History", icon: <History size={18} /> },
    ],
    fabMenu = [
      { id: "apply", label: "Apply", icon: <PlusCircle size={18} /> },
      { id: "alerts", label: "Alerts", icon: <Bell size={18} /> },
      { id: "history", label: "History", icon: <History size={18} /> },
    ],
    salesMenu = [
      { id: "calculator", label: "Calculator", icon: <Calculator size={18} /> },
      { id: "alerts", label: "Alerts", icon: <Bell size={18} /> },
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
          <h3>Enable phone notifications?</h3>
          <p>Turn on WhatsApp-like ASR Iron alerts for this device.</p>
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

            <button
              className="btn btn-soft header-logout-btn app-light-logout-btn"
              onClick={logout}
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
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
          {isSales && ticker()}
          {isSales && calculatorPage()}
          {isAdmin &&
            ["calculator", "market", "daily"].includes(tab) &&
            ticker()}
          {isAdmin && tab === "calculator" && (
            <div className="area">{calculatorPage()}</div>
          )}
          {isAdmin && tab === "market" && marketPage()}
          {isAdmin && tab === "daily" && dailyPage()}
          {isAdmin && tab === "claims" && claimsPage()}
          {isAdmin && tab === "signups" && signupsPage()}
          {isAdmin && tab === "items" && itemsPage()}
          {isAdmin && tab === "notifications" && notificationsPage()}
          {tab === "alerts" && alertsPage()}
          {isAdmin && tab === "history" && historyPage()}
          {!isAdmin && tab === "notifications" && notificationsPage()}
          {type === "fabricator" && tab !== "notifications" && fabricatorHome()}
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
            <p className="muted" style={{ fontSize: 12 }}>
              Salesman: sales / sales123
            </p>
            <div style={{ height: 20 }} />
            <button
              className="btn btn-outline full"
              onClick={() => {
                setScreen("signup");
                setSignupOk(false);
              }}
            >
              <UserPlus size={18} />
              Register as Partner
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
            <p className="subtitle">Fabricator Sign Up</p>
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
                {signupError && <div className="error">{signupError}</div>}
                <input
                  className="input"
                  placeholder="Shop Name"
                  value={signup.name}
                  onChange={(e) =>
                    setSignup({ ...signup, name: e.target.value })
                  }
                  required
                />
                <br />
                <br />
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
      {alertEnablePopup()}
      {screen === "login" && loginPage()}
      {screen === "signup" && signupPage()}
      {screen === "admin" && user && dashboard("admin")}
      {screen === "fabricator" && user && dashboard("fabricator")}
      {screen === "salesman" && user && dashboard("salesman")}
    </div>
  );
}
