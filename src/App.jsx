import React, { useEffect, useMemo, useState } from 'react';
import {
  PlusCircle, History, LogOut, ClipboardList, CheckCircle2, Clock, Check, X,
  AlertCircle, Plus, Trash2, UserPlus, Phone, MapPin, Calculator, FolderPlus,
  RefreshCw, Menu, Copy, Mail, Send, MessageCircle, TrendingUp, TrendingDown,
  MinusCircle, BarChart3
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';

function AsrIronLogo({ className = '' }) {
  return (
    <svg viewBox="0 0 420 150" className={`app-logo ${className}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="roofBlue" x1="0" x2="1">
          <stop offset="0%" stopColor="#0A3E7A" />
          <stop offset="100%" stopColor="#105AA5" />
        </linearGradient>
      </defs>
      <circle cx="250" cy="42" r="16" fill="#F29E18" />
      <path d="M135 68 L205 28 L290 66" fill="none" stroke="url(#roofBlue)" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M155 72 L205 42 L270 72 Z" fill="#0A3E7A" opacity="0.96" />
      <text x="210" y="118" textAnchor="middle" fontWeight="900" fontFamily="Arial" fontSize="42" fill="#0A3E7A">ASR IRON</text>
      <path d="M125 128 C170 120 230 136 292 121" fill="none" stroke="#F29E18" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const num = (v) => Number(v || 0);
const inr = (v) => `₹${num(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const formatDate = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};
function timeAgo(value) {
  if (!value) return 'not updated';
  const ms = Date.now() - new Date(value).getTime();
  if (ms < 60000) return 'just now';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
function changeInfo(row) {
  const diff = Number((num(row.daily_rate) - num(row.previous_daily_rate)).toFixed(2));
  if (diff > 0) return { cls: 'up', icon: <TrendingUp size={13} />, text: `+${inr(diff)}` };
  if (diff < 0) return { cls: 'down', icon: <TrendingDown size={13} />, text: `-${inr(Math.abs(diff))}` };
  return { cls: 'flat', icon: <MinusCircle size={13} />, text: 'No change' };
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [fabricators, setFabricators] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [items, setItems] = useState([]);
  const [rateCategories, setRateCategories] = useState([]);
  const [rateItems, setRateItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loginMobile, setLoginMobile] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [signup, setSignup] = useState({ name: '', mobile: '', address: '', password: '' });
  const [signUpSuccessMsg, setSignUpSuccessMsg] = useState(false);
  const [signUpError, setSignUpError] = useState('');

  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [showClaimSuccess, setShowClaimSuccess] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', unit: 'kg', points: '' });

  const [selectedRateCategoryId, setSelectedRateCategoryId] = useState('');
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeDiff, setNewSizeDiff] = useState('');
  const [newSegment, setNewSegment] = useState({ name: '', rate: '', freight: '' });

  const [adminTab, setAdminTab] = useState('market');
  const [fabTab, setFabTab] = useState('market');
  const [calcCategoryId, setCalcCategoryId] = useState('');
  const [calcItemId, setCalcItemId] = useState('');
  const [calcQty, setCalcQty] = useState('');
  const [calculatorCart, setCalculatorCart] = useState([]);
  const [quoteText, setQuoteText] = useState('');
  const [quoteEdited, setQuoteEdited] = useState(false);

  const selectedItem = items.find((x) => x.id === selectedItemId);
  const activeFabricator = fabricators.find((f) => f.id === currentUser?.id);
  const selectedRateCategory = rateCategories.find((c) => c.id === selectedRateCategoryId) || rateCategories[0];
  const topRates = useMemo(() => {
    const priority = ['ANGLE', 'PIPE', 'FLAT', 'TMT'];
    return [...rateCategories].sort((a, b) => {
      const ia = priority.indexOf(String(a.name).toUpperCase());
      const ib = priority.indexOf(String(b.name).toUpperCase());
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.name.localeCompare(b.name);
    });
  }, [rateCategories]);

  async function loadAll() {
    setLoading(true);
    const [f, s, i, c, r] = await Promise.all([
      supabase.from('fabricators').select('*').order('created_at'),
      supabase.from('submissions').select('*').order('created_at', { ascending: false }),
      supabase.from('incentive_items').select('*').order('created_at'),
      supabase.from('rate_categories').select('*').order('name'),
      supabase.from('rate_items').select('*, rate_categories(name)').order('created_at')
    ]);
    if (f.error || s.error || i.error || c.error || r.error) {
      setToast('Database load failed. Check Supabase keys, RLS policies, and market migration.');
    } else {
      setFabricators(f.data || []);
      setSubmissions(s.data || []);
      setItems(i.data || []);
      setRateCategories(c.data || []);
      setRateItems(r.data || []);
      if (!selectedRateCategoryId && c.data?.length) setSelectedRateCategoryId(c.data[0].id);
    }
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (!quoteEdited) setQuoteText(buildQuotationMessage()); }, [calculatorCart, quoteEdited]);

  const getCategory = (id) => rateCategories.find((c) => c.id === id);
  function calculateUnitRate(categoryId, diff) {
    const c = getCategory(categoryId) || { daily_rate: 0, freight: 0 };
    return Number(((num(c.daily_rate) + num(diff) + num(c.freight)) * 1.18).toFixed(2));
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setLoginError('');
    if (loginMobile.trim().toLowerCase() === 'admin' && loginPassword === 'admin') {
      setCurrentUser({ id: 'admin', name: 'Program Administrator', role: 'admin' });
      setCurrentScreen('admin');
      setAdminTab('market');
      return;
    }
    const { data, error } = await supabase.from('fabricators').select('*').eq('mobile', loginMobile.trim()).maybeSingle();
    if (error || !data) return setLoginError('No profile registered under this mobile number.');
    if (data.password !== loginPassword) return setLoginError('Incorrect password.');
    if (data.status === 'Pending') return setLoginError('Your profile is pending approval.');
    if (data.status === 'Rejected') return setLoginError('Your profile application has been rejected.');
    setCurrentUser({ ...data, role: 'fabricator' });
    setCurrentScreen('fabricator');
    setFabTab('market');
  }

  async function handleSignUpSubmit(e) {
    e.preventDefault();
    setSignUpError('');
    const { error } = await supabase.from('fabricators').insert({
      name: signup.name,
      mobile: signup.mobile,
      address: signup.address,
      password: signup.password,
      total_points: 0,
      status: 'Pending'
    });
    if (error) return setSignUpError(error.code === '23505' ? 'This mobile number is already registered.' : error.message);
    setSignUpSuccessMsg(true);
    setSignup({ name: '', mobile: '', address: '', password: '' });
    await loadAll();
  }

  async function updateMarketRate(row, newRate, newFreight = row.freight) {
    const { error } = await supabase.from('rate_categories').update({
      previous_daily_rate: num(row.daily_rate),
      daily_rate: num(newRate),
      freight: num(newFreight),
      updated_at: new Date().toISOString()
    }).eq('id', row.id);
    if (error) setToast(error.message);
    await loadAll();
  }

  async function addMarketCategory(e) {
    e.preventDefault();
    if (!newSegment.name.trim()) return;
    const initialRate = num(newSegment.rate);
    const { data, error } = await supabase.from('rate_categories').insert({
      name: newSegment.name.trim().replace(/[^a-zA-Z0-9 ]/g, ''),
      daily_rate: initialRate,
      previous_daily_rate: initialRate,
      freight: num(newSegment.freight),
      updated_at: new Date().toISOString()
    }).select().single();
    if (error) return setToast(error.message);
    setSelectedRateCategoryId(data.id);
    setNewSegment({ name: '', rate: '', freight: '' });
    await loadAll();
  }

  async function handleIncentiveSubmit(e) {
    e.preventDefault();
    if (!selectedItem || !quantity || Number(quantity) <= 0) return;
    const qty = Number(quantity);
    const pts = qty * num(selectedItem.points_per_unit);
    const { error } = await supabase.from('submissions').insert({
      fabricator_id: currentUser.id,
      item_id: selectedItem.id,
      item_name: selectedItem.name,
      quantity: qty,
      unit: selectedItem.unit,
      points_earned: pts,
      status: 'Pending'
    });
    if (error) return setToast(error.message);
    setSelectedItemId('');
    setQuantity('');
    setShowClaimSuccess(true);
    await loadAll();
    setTimeout(() => setShowClaimSuccess(false), 2200);
  }

  async function handleAddToCalculator(e) {
    e.preventDefault();
    // Allow quantity 0. Block only blank or negative quantity.
    if (!calcCategoryId || !calcItemId || calcQty === '' || Number(calcQty) < 0) return;
    const matched = rateItems.find((i) => i.id === calcItemId);
    const c = getCategory(calcCategoryId);
    if (!matched || !c) return;
    const unitRate = calculateUnitRate(calcCategoryId, matched.fixed_difference);
    const qty = Number(calcQty);
    // IMPORTANT: if quantity is 0, final price is the unit rate itself.
    const finalTotal = qty === 0 ? unitRate : Number((unitRate * qty).toFixed(2));
    setCalculatorCart([...calculatorCart, {
      id: `cart-${Date.now()}`,
      category: c.name,
      itemName: matched.name,
      qty,
      unitRate,
      total: finalTotal
    }]);
    setQuoteEdited(false);
    setCalcItemId('');
    setCalcQty('');
  }

  async function addSize(e) {
    e.preventDefault();
    if (!newSizeName.trim() || !selectedRateCategoryId) return;
    const { error } = await supabase.from('rate_items').insert({
      category_id: selectedRateCategoryId,
      name: newSizeName,
      fixed_difference: num(newSizeDiff)
    });
    if (error) return setToast(error.message);
    setNewSizeName('');
    setNewSizeDiff('');
    await loadAll();
  }
  async function deleteSize(id) { await supabase.from('rate_items').delete().eq('id', id); setCalculatorCart([]); setQuoteEdited(false); await loadAll(); }
  async function updateDiff(id, value) { await supabase.from('rate_items').update({ fixed_difference: num(value) }).eq('id', id); await loadAll(); }
  async function approveFab(id) { await supabase.from('fabricators').update({ status: 'Approved' }).eq('id', id); await loadAll(); }
  async function rejectFab(id) { await supabase.from('fabricators').update({ status: 'Rejected' }).eq('id', id); await loadAll(); }
  async function approveSub(id) { const { error } = await supabase.rpc('approve_submission', { p_submission_id: id }); if (error) setToast(error.message); await loadAll(); }
  async function rejectSub(id) { const { error } = await supabase.rpc('reject_submission', { p_submission_id: id }); if (error) setToast(error.message); await loadAll(); }
  async function addNewItem(e) { e.preventDefault(); if (!newItem.name || !newItem.points) return; await supabase.from('incentive_items').insert({ name: newItem.name, unit: newItem.unit, points_per_unit: num(newItem.points) }); setNewItem({ name: '', unit: 'kg', points: '' }); await loadAll(); }
  async function deleteItem(id) { await supabase.from('incentive_items').delete().eq('id', id); await loadAll(); }
  function logout() { setCurrentUser(null); setCurrentScreen('login'); setLoginMobile(''); setLoginPassword(''); setSidebarOpen(false); }

  function statusBadge(status) {
    const cls = status === 'Approved' ? 'approved' : status === 'Rejected' ? 'rejected' : 'pending';
    return <span className={`pill ${cls}`}>{status}</span>;
  }

  function buildQuotationMessage() {
    const date = formatDate();
    if (!calculatorCart.length) return `📝 *ASR Iron* \n   *${date}*\n-----------------------------------------\n-----------------------------------------\nThankyou!`;
    if (calculatorCart.length === 1) {
      const item = calculatorCart[0];
      return `📝 *ASR Iron* \n   *${date}*\n-----------------------------------------\n   *${item.category.toUpperCase()} - ${item.itemName}* : *${inr(item.total)}*\n-----------------------------------------\nThankyou!`;
    }
    const lines = ['📝 *ASR Iron* ', `   *${date}*`, '-----------------------------------------'];
    calculatorCart.forEach((item, index) => {
      lines.push(`${index + 1}. *${item.category.toUpperCase()} - ${item.itemName}* : *${inr(item.total)}*`, '');
    });
    const total = calculatorCart.reduce((sum, item) => sum + item.total, 0);
    lines.push('-----------------------------------------', `💰 *Total Value: ${inr(total)}*`, 'Thankyou!');
    return lines.join('\n');
  }
  const finalQuoteText = () => quoteText || buildQuotationMessage();
  async function copyQuotation() { try { await navigator.clipboard.writeText(finalQuoteText()); setToast('Quotation copied.'); } catch { setToast('Clipboard copy failed.'); } }
  function shareWhatsApp() { window.open(`https://wa.me/?text=${encodeURIComponent(finalQuoteText())}`, '_blank'); }
  function shareTelegram() { window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(finalQuoteText())}`, '_blank'); }
  function shareEmail() { window.open(`mailto:?subject=${encodeURIComponent('ASR Iron Quotation')}&body=${encodeURIComponent(finalQuoteText())}`, '_blank'); }
  async function nativeShareQuotation() { if (navigator.share) { try { await navigator.share({ title: 'ASR Iron Quotation', text: finalQuoteText() }); } catch {} } else await copyQuotation(); }
  function resetQuoteText() { setQuoteText(buildQuotationMessage()); setQuoteEdited(false); }

  const adminMenu = [
    { id: 'market', label: 'Market', icon: <BarChart3 size={18} /> },
    { id: 'rate-update', label: 'Daily Rate', icon: <FolderPlus size={18} /> },
    { id: 'rate-calculator', label: 'Calculator', icon: <Calculator size={18} /> },
    { id: 'approvals', label: 'Claims', icon: <CheckCircle2 size={18} /> },
    { id: 'fabricators', label: 'Signups', icon: <UserPlus size={18} /> },
    { id: 'items', label: 'Items', icon: <PlusCircle size={18} /> },
    { id: 'history', label: 'History', icon: <History size={18} /> }
  ];
  const fabricatorMenu = [
    { id: 'market', label: 'Market', icon: <BarChart3 size={18} /> },
    { id: 'incentives', label: 'Claims', icon: <PlusCircle size={18} /> },
    { id: 'live-calculator', label: 'Rates', icon: <Calculator size={18} /> }
  ];

  function rateChip(row, fixed = false) {
    const ch = changeInfo(row);
    return <div className={`rate-chip ${fixed ? 'fixed' : ''}`} key={row.id}><div className="rate-name">{row.name}</div><div className="rate-value">{inr(row.daily_rate)}</div><div className={`rate-change ${ch.cls}`}>{ch.icon}{ch.text}</div><div className="rate-time">Updated {timeAgo(row.updated_at || row.created_at)}</div></div>;
  }
  function marketTicker() { return <div className="market-ticker"><div className="market-strip">{topRates.map((r, i) => rateChip(r, i < 4))}</div></div>; }
  function marketPage() {
    return <div className="grid"><div className="area"><h2 className="section-title"><BarChart3 size={20} /> Daily Market Rates</h2><p className="section-note">Update daily rates here. Changes are saved to Supabase and used by Daily Rate and Calculator pages.</p><form className="small-card" onSubmit={addMarketCategory}><h3>Add New Market Item</h3><div className="grid grid-3"><input className="input" placeholder="e.g. Cement" value={newSegment.name} onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })} /><input className="input" type="number" step="0.01" placeholder="Daily Rate" value={newSegment.rate} onChange={(e) => setNewSegment({ ...newSegment, rate: e.target.value })} /><input className="input" type="number" step="0.01" placeholder="Freight" value={newSegment.freight} onChange={(e) => setNewSegment({ ...newSegment, freight: e.target.value })} /></div><button className="btn btn-primary full">Add to Market</button></form></div><div className="market-grid">{topRates.map((row) => { const ch = changeInfo(row); return <div className="market-card" key={row.id}><div className="market-card-head"><div><div className="rate-name">{row.name}</div><div className="rate-value">{inr(row.daily_rate)}</div><div className={`rate-change ${ch.cls}`}>{ch.icon}{ch.text}</div><div className="rate-time">Last updated {timeAgo(row.updated_at || row.created_at)}</div></div></div><div className="market-update-grid"><div className="field"><label className="label">New Daily Rate</label><input className="input" type="number" step="0.01" defaultValue={row.daily_rate} onBlur={(e) => updateMarketRate(row, e.target.value, row.freight)} /></div><div className="field"><label className="label">Freight</label><input className="input" type="number" step="0.01" defaultValue={row.freight} onBlur={(e) => updateMarketRate(row, row.daily_rate, e.target.value)} /></div></div></div>; })}</div></div>;
  }

  function sidebarMenu(type) {
    const isAdmin = type === 'admin', list = isAdmin ? adminMenu : fabricatorMenu, current = isAdmin ? adminTab : fabTab, setTab = isAdmin ? setAdminTab : setFabTab;
    return <><div className={`sidebar-backdrop ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} /><aside className={`side-menu ${sidebarOpen ? 'open' : ''}`}><div className="side-menu-head"><AsrIronLogo /><button className="side-close" onClick={() => setSidebarOpen(false)}><X size={20} /></button></div><div className="side-menu-title">{isAdmin ? 'Admin Menu' : 'Fabricator Menu'}</div><div className="side-menu-list">{list.map((item) => <button key={item.id} className={`side-menu-item ${current === item.id ? 'active' : ''}`} onClick={() => { setTab(item.id); setSidebarOpen(false); }}>{item.icon}<span>{item.label}</span>{item.id === 'approvals' && submissions.filter((s) => s.status === 'Pending').length > 0 && <span className="side-count">{submissions.filter((s) => s.status === 'Pending').length}</span>}</button>)}</div></aside></>;
  }
  function bottomNav(type) {
    const isAdmin = type === 'admin', list = isAdmin ? adminMenu : [...fabricatorMenu, { id: 'logout', label: 'Logout', icon: <LogOut size={18} /> }], current = isAdmin ? adminTab : fabTab;
    return <div className="bottom-nav-scroll">{list.map((item) => <button key={item.id} className={current === item.id ? 'active' : ''} onClick={() => item.id === 'logout' ? logout() : isAdmin ? setAdminTab(item.id) : setFabTab(item.id)}>{item.icon}<span>{item.label}</span></button>)}</div>;
  }

  function calculatorEngine() {
    const activeSizes = rateItems.filter((x) => x.category_id === calcCategoryId);
    const total = calculatorCart.reduce((s, i) => s + i.total, 0);
    const previewItem = rateItems.find((i) => i.id === calcItemId);
    const previewCategory = getCategory(calcCategoryId);
    return <div className="grid grid-5"><div className="area"><h3 className="section-title"><Calculator size={20} /> Generate New Estimate</h3><form onSubmit={handleAddToCalculator}><div className="field"><label className="label">Step 1: Select Category</label><select value={calcCategoryId} onChange={(e) => { setCalcCategoryId(e.target.value); setCalcItemId(''); setCalcQty(''); }} required><option value="">-- Choose Category --</option>{rateCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>{calcCategoryId && <div className="field"><label className="label">Step 2: Choose Size</label><select value={calcItemId} onChange={(e) => setCalcItemId(e.target.value)} required><option value="">-- Select Size --</option>{activeSizes.map((item) => <option key={item.id} value={item.id}>{item.name} (Diff: ₹{item.fixed_difference})</option>)}</select></div>}{calcCategoryId && calcItemId && <div className="small-card"><div className="field"><label className="label">Step 3: Quantity kg</label><input className="input" type="number" step="0.1" min="0" value={calcQty} onChange={(e) => setCalcQty(e.target.value)} required /></div>{calcQty !== '' && Number(calcQty) >= 0 && <div className="small-card"><p>Base: <b>{inr(previewCategory?.daily_rate)}</b></p><p>Diff: <b>{inr(previewItem?.fixed_difference)}</b></p><p>Freight: <b>{inr(previewCategory?.freight)}</b></p><p><b>Unit incl. GST: {inr(calculateUnitRate(calcCategoryId, previewItem?.fixed_difference))}/kg</b></p>{Number(calcQty) === 0 && <p className="muted"><b>Qty is 0, so final price will use the rate itself.</b></p>}</div>}</div>}<button className="btn btn-primary full">Add Item</button></form></div><div className="area"><h3 className="section-title">Calculated Quote Summary</h3>{calculatorCart.length === 0 ? <div className="empty"><Calculator size={42} /><p>No items computed yet.</p></div> : <><div className="table-wrap"><table className="table"><thead><tr><th>Item</th><th>Weight</th><th>Rate</th><th>Final</th><th></th></tr></thead><tbody>{calculatorCart.map((item) => <tr key={item.id}><td data-label="Item"><b>{item.itemName}</b><br /><span className="muted">{item.category}</span></td><td data-label="Weight">{item.qty} kg</td><td data-label="Rate">{inr(item.unitRate)}/kg</td><td data-label="Final"><b>{inr(item.total)}</b>{item.qty === 0 && <div className="muted">Rate used because qty is 0</div>}</td><td data-label="Action"><button className="btn btn-soft" onClick={() => { setCalculatorCart(calculatorCart.filter((x) => x.id !== item.id)); setQuoteEdited(false); }}><X size={14} /></button></td></tr>)}</tbody></table></div><div className="editable-quote"><label className="label">Editable quotation text</label><textarea className="input" value={quoteText} onChange={(e) => { setQuoteText(e.target.value); setQuoteEdited(true); }} /></div><div className="share-panel"><button className="btn btn-primary" onClick={copyQuotation}><Copy size={16} />Copy</button><button className="btn btn-success" onClick={shareWhatsApp}><MessageCircle size={16} />WhatsApp</button><button className="btn btn-soft" onClick={shareTelegram}><Send size={16} />Telegram</button><button className="btn btn-soft" onClick={shareEmail}><Mail size={16} />Email</button><button className="btn btn-gold" onClick={nativeShareQuotation}><Send size={16} />Share</button><button className="btn btn-soft" onClick={resetQuoteText}>Reset Text</button></div><div className="quote-total"><div><div className="label">Total kg</div><b>{calculatorCart.reduce((s, i) => s + i.qty, 0).toFixed(1)} kg</b></div><div><div className="label">Estimated Invoice</div><div className="big-green">{inr(total)}</div></div></div></>}</div></div>;
  }

  if (loading) return <div className="screen center"><div className="card"><RefreshCw /> Loading database...</div></div>;
  return <div>{toast && <div className="toast error" onClick={() => setToast('')}>{toast}</div>}{currentScreen === 'login' && loginScreen()}{currentScreen === 'signup' && signupScreen()}{currentScreen === 'fabricator' && currentUser && fabricatorScreen()}{currentScreen === 'admin' && currentUser && adminScreen()}</div>;

  function loginScreen() { return <div className="screen center"><div className="login-card card"><div className="login-head"><AsrIronLogo /><div className="bar" /><p className="subtitle">Incentive Reward Portal</p></div><div className="login-body">{loginError && <div className="error">{loginError}</div>}<form onSubmit={handleLoginSubmit}><div className="field"><label className="label">Mobile / Username</label><input className="input" value={loginMobile} onChange={(e) => setLoginMobile(e.target.value)} required /></div><div className="field"><label className="label">Password</label><input className="input" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required /></div><button className="btn btn-primary full">Sign In</button></form><div style={{ height: 20 }} /><button className="btn btn-outline full" onClick={() => { setCurrentScreen('signup'); setSignUpSuccessMsg(false); }}><UserPlus size={18} />Register as Partner</button></div></div></div>; }
  function signupScreen() { return <div className="screen center"><div className="login-card card"><div className="login-head"><AsrIronLogo /><div className="bar" /><p className="subtitle">Fabricator Sign Up</p></div><div className="login-body">{signUpSuccessMsg ? <div><CheckCircle2 size={56} color="#059669" /><h3>Registration Complete</h3><button className="btn btn-primary full" onClick={() => setCurrentScreen('login')}>Back</button></div> : <form onSubmit={handleSignUpSubmit}>{signUpError && <div className="error">{signUpError}</div>}<input className="input" placeholder="Shop Name" value={signup.name} onChange={(e) => setSignup({ ...signup, name: e.target.value })} required /><br /><br /><input className="input" placeholder="Mobile" pattern="[0-9]{10}" value={signup.mobile} onChange={(e) => setSignup({ ...signup, mobile: e.target.value })} required /><br /><br /><textarea className="input" placeholder="Address" value={signup.address} onChange={(e) => setSignup({ ...signup, address: e.target.value })} required /><br /><br /><input className="input" type="password" placeholder="Password" value={signup.password} onChange={(e) => setSignup({ ...signup, password: e.target.value })} required /><br /><br /><button className="btn btn-primary full">Submit for Approval</button><button type="button" className="btn btn-soft full" onClick={() => setCurrentScreen('login')}>Back</button></form>}</div></div></div>; }
  function fabricatorScreen() { return <div className="screen"><header className="header"><div className="head-inner"><div className="brand-row"><button className="hamburger-btn" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button><AsrIronLogo /></div><button className="btn btn-soft" onClick={logout}><LogOut size={16} /></button></div></header>{sidebarMenu('fabricator')}<main className="main">{['market', 'live-calculator'].includes(fabTab) && marketTicker()}{fabTab === 'market' && marketPage()}{fabTab === 'incentives' && fabricatorClaims()}{fabTab === 'live-calculator' && calculatorEngine()}</main>{bottomNav('fabricator')}</div>; }
  function adminScreen() { return <div className="screen"><header className="header dark"><div className="head-inner"><div className="brand-row"><button className="hamburger-btn" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button><AsrIronLogo /><span className="admin-badge">ADMIN</span></div><button className="btn btn-soft" onClick={logout}><LogOut size={16} /> Sign Out</button></div></header>{sidebarMenu('admin')}<main className="main">{['market', 'rate-update', 'rate-calculator'].includes(adminTab) && marketTicker()}{adminTab === 'market' && marketPage()}{adminTab === 'rate-update' && rateUpdate()}{adminTab === 'rate-calculator' && <div className="area">{calculatorEngine()}</div>}{adminTab === 'approvals' && approvals()}{adminTab === 'fabricators' && fabricatorsPage()}{adminTab === 'items' && itemsConfig()}{adminTab === 'history' && historyLogs()}</main>{bottomNav('admin')}</div>; }

  function fabricatorClaims() { return <div className="grid"><div className="grid grid-3"><div className="stat-card" style={{ gridColumn: 'span 2' }}><h2>ASR IRON Approved Points</h2><div className="value">{num(activeFabricator?.total_points).toLocaleString()} pts</div><p>{currentUser.address}</p></div><div className="small-card"><span className="pill pending">Awaiting Review</span><h3>Pending Claims Points</h3><div className="big-green">{submissions.filter((s) => s.fabricator_id === currentUser.id && s.status === 'Pending').reduce((sum, s) => sum + num(s.points_earned), 0)} pts</div></div></div><div className="grid grid-5"><div className="area"><h3 className="section-title"><PlusCircle size={18} />Apply for Incentive</h3>{showClaimSuccess ? <div className="success">Applied!</div> : <form onSubmit={handleIncentiveSubmit}><select value={selectedItemId} onChange={(e) => { setSelectedItemId(e.target.value); setQuantity(''); }} required><option value="">-- Select Item --</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.points_per_unit} pts/{i.unit})</option>)}</select>{selectedItem && <div className="small-card"><input className="input" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity" required />{quantity && <p><b>+{Number(quantity) * selectedItem.points_per_unit} pts</b></p>}</div>}<button className="btn btn-primary full">Submit</button></form>}</div><div className="area"><h3 className="section-title"><History size={18} />My Claims</h3>{submissions.filter((s) => s.fabricator_id === currentUser.id).map((sub) => <div className="small-card" key={sub.id}><b>{sub.item_name}</b><p>{sub.quantity} {sub.unit}</p>{statusBadge(sub.status)}</div>)}</div></div></div>; }
  function rateUpdate() { return <div className="area"><h2 className="section-title">Daily Rate Configuration</h2><p className="section-note">Use Market page for daily rates. Use this page for size/difference setup.</p><div className="field"><label className="label">Select Segment</label><select value={selectedRateCategoryId} onChange={(e) => setSelectedRateCategoryId(e.target.value)}>{rateCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><form className="small-card" onSubmit={addSize}><div className="grid grid-3"><input className="input" value={newSizeName} onChange={(e) => setNewSizeName(e.target.value)} placeholder="Size name" /><input className="input" type="number" step="0.01" value={newSizeDiff} onChange={(e) => setNewSizeDiff(e.target.value)} placeholder="Diff" /><button className="btn btn-primary">Add Size</button></div></form><div className="table-wrap"><table className="table"><thead><tr><th>Size</th><th>Diff</th><th>Preview</th><th></th></tr></thead><tbody>{rateItems.filter((i) => i.category_id === selectedRateCategoryId).map((item) => <tr key={item.id}><td data-label="Size"><b>{item.name}</b></td><td data-label="Diff"><input className="input" type="number" defaultValue={item.fixed_difference} onBlur={(e) => updateDiff(item.id, e.target.value)} /></td><td data-label="Preview">{inr(calculateUnitRate(item.category_id, item.fixed_difference))}/kg</td><td data-label="Action"><button className="btn btn-danger" onClick={() => deleteSize(item.id)}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div></div>; }
  function approvals() { const pending = submissions.filter((s) => s.status === 'Pending'); return <div className="area"><h2 className="section-title">Pending Claims</h2>{pending.map((sub) => { const fab = fabricators.find((f) => f.id === sub.fabricator_id); return <div className="small-card" key={sub.id}><b>{fab?.name || 'Unknown'}</b><p>{sub.item_name} • {sub.points_earned} pts</p><button className="btn btn-success" onClick={() => approveSub(sub.id)}>Approve</button> <button className="btn btn-danger" onClick={() => rejectSub(sub.id)}>Decline</button></div>; })}</div>; }
  function fabricatorsPage() { return <div className="grid"><div className="area"><h2 className="section-title">Pending Signups</h2>{fabricators.filter((f) => f.status === 'Pending').map((f) => <div className="small-card" key={f.id}><b>{f.name}</b><p>{f.mobile} • {f.address}</p><button className="btn btn-success" onClick={() => approveFab(f.id)}>Approve</button> <button className="btn btn-danger" onClick={() => rejectFab(f.id)}>Reject</button></div>)}</div><div className="area"><h2 className="section-title">Approved Fabricators</h2>{fabricators.filter((f) => f.status === 'Approved').map((f) => <div className="small-card" key={f.id}><b>{f.name}</b><p>{f.mobile} • {f.total_points} pts</p></div>)}</div></div>; }
  function itemsConfig() { return <div className="grid grid-3"><div className="area"><h2 className="section-title">Add Item</h2><form onSubmit={addNewItem}><input className="input" placeholder="Item" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} /><br /><br /><select value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}><option value="kg">kg</option><option value="pcs">pcs</option><option value="ft">ft</option></select><br /><br /><input className="input" type="number" placeholder="Points" value={newItem.points} onChange={(e) => setNewItem({ ...newItem, points: e.target.value })} /><br /><br /><button className="btn btn-primary full">Save</button></form></div><div className="area" style={{ gridColumn: 'span 2' }}>{items.map((i) => <div className="small-card" key={i.id}><b>{i.name}</b><p>{i.points_per_unit} points / {i.unit}</p><button className="btn btn-danger" onClick={() => deleteItem(i.id)}><Trash2 size={16} /></button></div>)}</div></div>; }
  function historyLogs() { return <div className="area"><h2 className="section-title">Processed Logs</h2>{submissions.filter((s) => s.status !== 'Pending').map((s) => <div className="small-card" key={s.id}><b>{s.item_name}</b><p>{s.points_earned} pts</p>{statusBadge(s.status)}</div>)}</div>; }
}
