import React, { useEffect, useState } from 'react';
import {
  PlusCircle, History, LogOut, ClipboardList, CheckCircle2, Clock, Check, X,
  AlertCircle, Plus, Trash2, UserPlus, Phone, MapPin, Calculator, FileText,
  FolderPlus, RefreshCw, Menu, Copy, Mail, Send, MessageCircle
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';

function AsrIronLogo({ className = '' }) {
  return (
    <svg viewBox="0 0 420 150" className={`app-logo ${className}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ASR Iron Logo">
      <defs>
        <linearGradient id="roofBlue" x1="0" x2="1">
          <stop offset="0%" stopColor="#0A3E7A" />
          <stop offset="100%" stopColor="#105AA5" />
        </linearGradient>
      </defs>
      <circle cx="250" cy="42" r="16" fill="#F29E18" />
      <path d="M135 68 L205 28 L290 66" fill="none" stroke="url(#roofBlue)" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M155 72 L205 42 L270 72 Z" fill="#0A3E7A" opacity="0.96" />
      <rect x="190" y="62" width="10" height="10" rx="1.5" fill="#fff" opacity="0.85" />
      <rect x="205" y="62" width="10" height="10" rx="1.5" fill="#fff" opacity="0.85" />
      <rect x="190" y="77" width="10" height="10" rx="1.5" fill="#fff" opacity="0.85" />
      <rect x="205" y="77" width="10" height="10" rx="1.5" fill="#fff" opacity="0.85" />
      <text x="210" y="118" textAnchor="middle" fontWeight="900" fontFamily="Arial, sans-serif" fontSize="42" fill="#0A3E7A" letterSpacing="-1">ASR IRON</text>
      <path d="M125 128 C170 120 230 136 292 121" fill="none" stroke="#F29E18" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const num = (v) => Number(v || 0);
const inr = (v) => `₹${num(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

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

  const [adminTab, setAdminTab] = useState('rate-update');
  const [fabTab, setFabTab] = useState('incentives');
  const [calcCategoryId, setCalcCategoryId] = useState('');
  const [calcItemId, setCalcItemId] = useState('');
  const [calcQty, setCalcQty] = useState('');
  const [calculatorCart, setCalculatorCart] = useState([]);

  const selectedItem = items.find((x) => x.id === selectedItemId);
  const activeFabricator = fabricators.find((f) => f.id === currentUser?.id);
  const selectedRateCategory = rateCategories.find((c) => c.id === selectedRateCategoryId) || rateCategories[0];

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
      setToast('Database load failed. Check Supabase keys, RLS policies, and table schema.');
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

  function getCategory(id) { return rateCategories.find((c) => c.id === id); }

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
      setAdminTab('rate-update');
      return;
    }

    const { data, error } = await supabase.from('fabricators').select('*').eq('mobile', loginMobile.trim()).maybeSingle();
    if (error || !data) return setLoginError('No profile registered under this mobile number.');
    if (data.password !== loginPassword) return setLoginError('Incorrect password. Please verify and try again.');
    if (data.status === 'Pending') return setLoginError('Your profile is pending approval from our administration.');
    if (data.status === 'Rejected') return setLoginError('Your profile application has been rejected.');

    setCurrentUser({ ...data, role: 'fabricator' });
    setCurrentScreen('fabricator');
    setFabTab('incentives');
    setSelectedItemId('');
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
    if (!calcCategoryId || !calcItemId || !calcQty || Number(calcQty) <= 0) return;
    const matched = rateItems.find((i) => i.id === calcItemId);
    const c = getCategory(calcCategoryId);
    if (!matched || !c) return;
    const unitRate = calculateUnitRate(calcCategoryId, matched.fixed_difference);
    const qty = Number(calcQty);
    setCalculatorCart([...calculatorCart, {
      id: `cart-${Date.now()}`,
      category: c.name,
      itemName: matched.name,
      qty,
      unitRate,
      total: Number((unitRate * qty).toFixed(2))
    }]);
    setCalcItemId('');
    setCalcQty('');
  }

  async function addSegment(e) {
    e.preventDefault();
    if (!newSegment.name.trim()) return;
    const { data, error } = await supabase.from('rate_categories').insert({
      name: newSegment.name.trim().replace(/[^a-zA-Z0-9 ]/g, ''),
      daily_rate: num(newSegment.rate),
      freight: num(newSegment.freight)
    }).select().single();
    if (error) return alert(error.code === '23505' ? 'This segment already exists.' : error.message);
    setSelectedRateCategoryId(data.id);
    setNewSegment({ name: '', rate: '', freight: '' });
    await loadAll();
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

  async function deleteSize(id) { await supabase.from('rate_items').delete().eq('id', id); setCalculatorCart([]); await loadAll(); }
  async function updateCategory(field, value) { if (!selectedRateCategoryId) return; await supabase.from('rate_categories').update({ [field]: num(value) }).eq('id', selectedRateCategoryId); await loadAll(); }
  async function updateDiff(id, value) { await supabase.from('rate_items').update({ fixed_difference: num(value) }).eq('id', id); await loadAll(); }
  async function approveFab(id) { await supabase.from('fabricators').update({ status: 'Approved' }).eq('id', id); await loadAll(); }
  async function rejectFab(id) { await supabase.from('fabricators').update({ status: 'Rejected' }).eq('id', id); await loadAll(); }
  async function approveSub(id) { const { error } = await supabase.rpc('approve_submission', { p_submission_id: id }); if (error) setToast(error.message); await loadAll(); }
  async function rejectSub(id) { const { error } = await supabase.rpc('reject_submission', { p_submission_id: id }); if (error) setToast(error.message); await loadAll(); }
  async function addNewItem(e) { e.preventDefault(); if (!newItem.name || !newItem.points) return; await supabase.from('incentive_items').insert({ name: newItem.name, unit: newItem.unit, points_per_unit: num(newItem.points) }); setNewItem({ name: '', unit: 'kg', points: '' }); await loadAll(); }
  async function deleteItem(id) { await supabase.from('incentive_items').delete().eq('id', id); await loadAll(); }

  function logout() {
    setCurrentUser(null);
    setCurrentScreen('login');
    setLoginMobile('');
    setLoginPassword('');
    setSidebarOpen(false);
  }

  function statusBadge(status) {
    const cls = status === 'Approved' ? 'approved' : status === 'Rejected' ? 'rejected' : 'pending';
    return <span className={`pill ${cls}`}>{status === 'Approved' ? <CheckCircle2 size={14} /> : status === 'Rejected' ? <AlertCircle size={14} /> : <Clock size={14} />} {status}</span>;
  }

  function getQuotationMessage() {
    const today = new Date().toLocaleDateString('en-IN');
    if (!calculatorCart.length) {
      return `📝 *ASR Iron*\n   *Date: ${today}*\n-----------------------------------------\nNo quotation items added yet.\n-----------------------------------------\nThankyou!`;
    }
    const lines = ['📝 *ASR Iron*', `   *Date: ${today}*`, '-----------------------------------------'];
    calculatorCart.forEach((item, index) => {
      lines.push(`${index + 1}. *${item.category.toUpperCase()} - ${item.itemName}*`, '', `   Item Net Subtotal: *${inr(item.total)}*`, '');
    });
    const total = calculatorCart.reduce((sum, item) => sum + item.total, 0);
    lines.push('-----------------------------------------', `💰 *Aggregate Quotation Value: ${inr(total)}*`, 'Thankyou!');
    return lines.join('\n');
  }

  async function copyQuotation() {
    try { await navigator.clipboard.writeText(getQuotationMessage()); setToast('Quotation copied successfully.'); }
    catch { setToast('Clipboard copy failed. Please copy manually.'); }
  }
  function shareWhatsApp() { window.open(`https://wa.me/?text=${encodeURIComponent(getQuotationMessage())}`, '_blank', 'noopener,noreferrer'); }
  function shareTelegram() { window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(getQuotationMessage())}`, '_blank', 'noopener,noreferrer'); }
  function shareEmail() { window.open(`mailto:?subject=${encodeURIComponent('ASR Iron Quotation')}&body=${encodeURIComponent(getQuotationMessage())}`, '_blank'); }
  async function nativeShareQuotation() { if (navigator.share) { try { await navigator.share({ title: 'ASR Iron Quotation', text: getQuotationMessage() }); } catch {} } else await copyQuotation(); }

  const adminMenu = [
    { id: 'rate-update', label: 'Daily Rate', icon: <FolderPlus size={18} /> },
    { id: 'rate-calculator', label: 'Calculator', icon: <Calculator size={18} /> },
    { id: 'approvals', label: 'Claims', icon: <CheckCircle2 size={18} /> },
    { id: 'fabricators', label: 'Signups', icon: <UserPlus size={18} /> },
    { id: 'items', label: 'Items', icon: <PlusCircle size={18} /> },
    { id: 'history', label: 'History', icon: <History size={18} /> }
  ];
  const fabricatorMenu = [
    { id: 'incentives', label: 'Claims', icon: <PlusCircle size={18} /> },
    { id: 'live-calculator', label: 'Rates', icon: <Calculator size={18} /> }
  ];

  function sidebarMenu(type) {
    const isAdmin = type === 'admin';
    const list = isAdmin ? adminMenu : fabricatorMenu;
    const current = isAdmin ? adminTab : fabTab;
    const setTab = isAdmin ? setAdminTab : setFabTab;
    return <>
      <div className={`sidebar-backdrop ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`side-menu ${sidebarOpen ? 'open' : ''}`}>
        <div className="side-menu-head"><AsrIronLogo /><button className="side-close" onClick={() => setSidebarOpen(false)}><X size={20} /></button></div>
        <div className="side-menu-title">{isAdmin ? 'Admin Menu' : 'Fabricator Menu'}</div>
        <div className="side-menu-list">
          {list.map((item) => <button key={item.id} className={`side-menu-item ${current === item.id ? 'active' : ''}`} onClick={() => { setTab(item.id); setSidebarOpen(false); }}>
            {item.icon}<span>{item.label}</span>
            {item.id === 'approvals' && submissions.filter(s => s.status === 'Pending').length > 0 && <span className="side-count">{submissions.filter(s => s.status === 'Pending').length}</span>}
            {item.id === 'fabricators' && fabricators.filter(f => f.status === 'Pending').length > 0 && <span className="side-count gold">{fabricators.filter(f => f.status === 'Pending').length}</span>}
          </button>)}
        </div>
      </aside>
    </>;
  }

  function bottomNav(type) {
    const isAdmin = type === 'admin';
    const list = isAdmin ? adminMenu : [...fabricatorMenu, { id: 'logout', label: 'Logout', icon: <LogOut size={18} /> }];
    const current = isAdmin ? adminTab : fabTab;
    return <div className="bottom-nav-scroll">
      {list.map((item) => <button key={item.id} className={current === item.id ? 'active' : ''} onClick={() => item.id === 'logout' ? logout() : isAdmin ? setAdminTab(item.id) : setFabTab(item.id)}>
        {item.icon}<span>{item.label}</span>
      </button>)}
    </div>;
  }

  function calculatorEngine() {
    const activeSizes = rateItems.filter((x) => x.category_id === calcCategoryId);
    const total = calculatorCart.reduce((s, i) => s + i.total, 0);
    const previewItem = rateItems.find((i) => i.id === calcItemId);
    const previewCategory = getCategory(calcCategoryId);
    return <div className="grid grid-5">
      <div className="area">
        <h3 className="section-title"><Calculator size={20} /> Generate New Estimate</h3>
        <form onSubmit={handleAddToCalculator}>
          <div className="field"><label className="label">Step 1: Select Structural Category</label><select value={calcCategoryId} onChange={e => { setCalcCategoryId(e.target.value); setCalcItemId(''); setCalcQty(''); }} required><option value="">-- Choose Category --</option>{rateCategories.map(c => <option key={c.id} value={c.id}>{c.name} Segment</option>)}</select></div>
          {calcCategoryId ? <div className="field"><label className="label">Step 2: Choose Size</label><select value={calcItemId} onChange={e => setCalcItemId(e.target.value)} required><option value="">-- Select Size --</option>{activeSizes.map(item => <option key={item.id} value={item.id}>{item.name} (Diff: ₹{item.fixed_difference >= 0 ? `+${item.fixed_difference}` : item.fixed_difference}/kg)</option>)}</select></div> : <div className="empty">Awaiting category choice.</div>}
          {calcCategoryId && calcItemId && <div className="small-card"><div className="field"><label className="label">Step 3: Weight Quantity (kg)</label><input className="input" type="number" step="0.1" min="0.1" value={calcQty} onChange={e => setCalcQty(e.target.value)} placeholder="e.g. 150" required /></div>{calcQty && Number(calcQty) > 0 && <div className="small-card"><p>Base: <b>{inr(previewCategory?.daily_rate)}/kg</b></p><p>Diff: <b>{inr(previewItem?.fixed_difference)}/kg</b></p><p>Freight: <b>{inr(previewCategory?.freight)}/kg</b></p><p><b>Unit incl. GST: <span style={{ color: '#047857' }}>{inr(calculateUnitRate(calcCategoryId, previewItem?.fixed_difference))}/kg</span></b></p></div>}</div>}
          <button className="btn btn-primary full" disabled={!calcCategoryId || !calcItemId || !calcQty}><Plus size={16} /> Add Item</button>
        </form>
      </div>
      <div className="area">
        <h3 className="section-title">Calculated Quote Summary</h3>
        <div className="scroll">{calculatorCart.length === 0 ? <div className="empty"><Calculator size={42} /> <p>No items computed yet.</p></div> : <div className="table-wrap"><table className="table"><thead><tr><th>Item</th><th>Weight</th><th className="right">Rate</th><th className="right">Final</th><th></th></tr></thead><tbody>{calculatorCart.map(item => <tr key={item.id}><td data-label="Item"><b>{item.itemName}</b><br /><span className="muted">{item.category}</span></td><td data-label="Weight">{item.qty} kg</td><td data-label="Rate" className="right">{inr(item.unitRate)}/kg</td><td data-label="Final" className="right"><b>{inr(item.total)}</b></td><td data-label="Action"><button className="btn btn-soft" onClick={() => setCalculatorCart(calculatorCart.filter(x => x.id !== item.id))}><X size={14} /></button></td></tr>)}</tbody></table></div>}</div>
        {calculatorCart.length > 0 && <div className="share-panel"><button className="btn btn-primary full-mobile" onClick={copyQuotation}><Copy size={16} /> Copy</button><button className="btn btn-success full-mobile" onClick={shareWhatsApp}><MessageCircle size={16} /> WhatsApp</button><button className="btn btn-soft full-mobile" onClick={shareTelegram}><Send size={16} /> Telegram</button><button className="btn btn-soft full-mobile" onClick={shareEmail}><Mail size={16} /> Email</button><button className="btn btn-gold full-mobile" onClick={nativeShareQuotation}><Send size={16} /> Share</button></div>}
        {calculatorCart.length > 0 && <div className="quote-total"><div><div className="label">Total kg</div><b>{calculatorCart.reduce((s, i) => s + i.qty, 0).toFixed(1)} kg</b></div><div><div className="label">Estimated Invoice</div><div className="big-green">{inr(total)}</div></div></div>}
      </div>
    </div>;
  }

  if (loading) return <div className="screen center"><div className="card"><RefreshCw /> Loading database...</div></div>;

  return (
    <div>
      {toast && <div className="toast error" onClick={() => setToast('')}>{toast}</div>}
      {currentScreen === 'login' && loginScreen()}
      {currentScreen === 'signup' && signupScreen()}
      {currentScreen === 'fabricator' && currentUser && fabricatorScreen()}
      {currentScreen === 'admin' && currentUser && adminScreen()}
    </div>
  );

  function loginScreen() {
    return <div className="screen center"><div className="login-card card"><div className="login-head"><AsrIronLogo /><div className="bar" /><p className="subtitle">Incentive Reward Portal</p></div><div className="login-body">{loginError && <div className="error"><AlertCircle size={18} /> {loginError}</div>}<form onSubmit={handleLoginSubmit}><div className="field"><label className="label">Mobile / Username</label><input className="input" value={loginMobile} onChange={e => setLoginMobile(e.target.value)} placeholder="Enter mobile or admin" required /></div><div className="field"><label className="label">Password</label><input className="input" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required /></div><button className="btn btn-primary full">Sign In</button></form><div style={{ height: 22 }} /><button className="btn btn-outline full" onClick={() => { setCurrentScreen('signup'); setSignUpSuccessMsg(false); setSignUpError(''); }}><UserPlus size={18} /> Register as Partner</button><p className="muted" style={{ fontSize: 12 }}>Admin: admin/admin. Seed fabricators: password123.</p></div></div></div>;
  }

  function signupScreen() {
    return <div className="screen center"><div className="login-card card"><div className="login-head"><AsrIronLogo /><div className="bar" /><p className="subtitle">Fabricator Sign Up</p></div><div className="login-body">{signUpSuccessMsg ? <div className="center-text"><CheckCircle2 size={56} color="#059669" /><h3>Registration Complete</h3><p className="muted">Your profile is pending approval.</p><button className="btn btn-primary full" onClick={() => setCurrentScreen('login')}>Back to Login</button></div> : <form onSubmit={handleSignUpSubmit}>{signUpError && <div className="error">{signUpError}</div>}<div className="field"><label className="label">Shop Name</label><input className="input" value={signup.name} onChange={e => setSignup({ ...signup, name: e.target.value })} required /></div><div className="field"><label className="label">Mobile</label><input className="input" pattern="[0-9]{10}" value={signup.mobile} onChange={e => setSignup({ ...signup, mobile: e.target.value })} required /></div><div className="field"><label className="label">Address</label><textarea className="input" rows="2" value={signup.address} onChange={e => setSignup({ ...signup, address: e.target.value })} required /></div><div className="field"><label className="label">Password</label><input className="input" type="password" value={signup.password} onChange={e => setSignup({ ...signup, password: e.target.value })} required /></div><button className="btn btn-primary full">Submit for Approval</button><button type="button" className="btn btn-soft full" onClick={() => setCurrentScreen('login')}>Back</button></form>}</div></div></div>;
  }

  function fabricatorScreen() {
    return <div className="screen"><header className="header"><div className="head-inner"><div className="brand-row"><button className="hamburger-btn" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button><AsrIronLogo /></div><div className="inline-row"><div className="hide-mobile right"><span className="muted">Fabricator Partner</span><br /><b style={{ color: '#0A3E7A' }}>{currentUser.name}</b></div><button className="btn btn-soft" onClick={logout}><LogOut size={18} /></button></div></div></header>{sidebarMenu('fabricator')}<main className="main"><div className="tabs desktop-only"><button className={`tab ${fabTab === 'incentives' ? 'active-blue' : ''}`} onClick={() => setFabTab('incentives')}>Incentive Claims</button><button className={`tab ${fabTab === 'live-calculator' ? 'active-gold' : ''}`} onClick={() => setFabTab('live-calculator')}>Live Rates Calculator</button></div>{fabTab === 'incentives' && fabricatorClaims()}{fabTab === 'live-calculator' && calculatorEngine()}</main>{bottomNav('fabricator')}</div>;
  }

  function adminScreen() {
    return <div className="screen"><header className="header dark"><div className="head-inner"><div className="brand-row"><button className="hamburger-btn" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button><AsrIronLogo /><span className="admin-badge">ADMIN</span></div><button className="btn btn-soft" onClick={logout}><LogOut size={16} /> Sign Out</button></div></header>{sidebarMenu('admin')}<main className="main"><div className="tabs desktop-only">{adminMenu.map(item => <button key={item.id} className={`tab ${adminTab === item.id ? (item.id === 'rate-calculator' ? 'active-gold' : 'active-blue') : ''}`} onClick={() => setAdminTab(item.id)}>{item.icon}{item.label}{item.id === 'approvals' && submissions.filter(s => s.status === 'Pending').length > 0 && <span className="count">{submissions.filter(s => s.status === 'Pending').length}</span>}{item.id === 'fabricators' && fabricators.filter(f => f.status === 'Pending').length > 0 && <span className="count gold">{fabricators.filter(f => f.status === 'Pending').length}</span>}</button>)}</div>{adminTab === 'rate-update' && rateUpdate()}{adminTab === 'rate-calculator' && <div className="area">{calculatorEngine()}</div>}{adminTab === 'approvals' && approvals()}{adminTab === 'fabricators' && fabricatorsPage()}{adminTab === 'items' && itemsConfig()}{adminTab === 'history' && historyLogs()}</main>{bottomNav('admin')}</div>;
  }

  function fabricatorClaims() {
    return <div className="grid"><div className="grid grid-3"><div className="stat-card" style={{ gridColumn: 'span 2' }}><h2>ASR IRON Approved Points</h2><div className="value">{num(activeFabricator?.total_points).toLocaleString()} <span style={{ fontSize: 16, color: '#dbeafe' }}>pts</span></div><p>Registered Workshop: <b>{currentUser.address}</b></p></div><div className="small-card"><span className="pill pending"><Clock size={14} /> Awaiting Review</span><h3>Pending Claims Points</h3><div className="big-green" style={{ color: '#1e293b' }}>{submissions.filter(s => s.fabricator_id === currentUser.id && s.status === 'Pending').reduce((sum, s) => sum + num(s.points_earned), 0).toLocaleString()} pts</div></div></div><div className="grid grid-5"><div className="area"><h3 className="section-title"><PlusCircle size={18} /> Apply for Incentive</h3>{showClaimSuccess ? <div className="success">Incentive applied! Sent for admin approval.</div> : <form onSubmit={handleIncentiveSubmit}><div className="field"><label className="label">Select Fabrication Item</label><select value={selectedItemId} onChange={e => { setSelectedItemId(e.target.value); setQuantity(''); }} required><option value="">-- Select Item --</option>{items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.points_per_unit} Pts/{i.unit})</option>)}</select></div>{selectedItem && <div className="small-card"><div className="field"><label className="label">Quantity in {selectedItem.unit}</label><input className="input" type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} required /></div>{quantity && Number(quantity) > 0 && <p><b>+{Number(quantity) * selectedItem.points_per_unit} Pts</b></p>}</div>}<button className="btn btn-primary full" disabled={!selectedItemId}>Submit for Admin Approval</button></form>}</div><div className="area"><h3 className="section-title"><History size={18} /> My Claims</h3><div className="scroll">{submissions.filter(s => s.fabricator_id === currentUser.id).length === 0 ? <div className="empty"><ClipboardList size={44} /> No claims yet.</div> : submissions.filter(s => s.fabricator_id === currentUser.id).map(sub => <div className="small-card" key={sub.id}><b>{sub.item_name}</b><p className="muted">Date: {sub.submission_date} • Vol: {sub.quantity} {sub.unit}</p>{statusBadge(sub.status)}<b style={{ float: 'right', color: '#047857' }}>+{sub.points_earned} pts</b></div>)}</div></div></div></div>;
  }

  function rateUpdate() {
    return <div className="area"><h2 className="section-title">Admin Daily Updation Console</h2><p className="section-note">Configure segments, daily rates, freight and size differences.</p><div className="grid grid-3"><div className="field"><label className="label">Select Segment</label><select value={selectedRateCategoryId} onChange={e => setSelectedRateCategoryId(e.target.value)}>{rateCategories.map(c => <option key={c.id} value={c.id}>{c.name} Segment</option>)}</select></div><form className="small-card" style={{ gridColumn: 'span 2' }} onSubmit={addSegment}><h3><FolderPlus size={16} /> Add New Segment</h3><div className="grid grid-3"><input className="input" placeholder="Segment" value={newSegment.name} onChange={e => setNewSegment({ ...newSegment, name: e.target.value })} /><input className="input" type="number" step="0.01" placeholder="Base" value={newSegment.rate} onChange={e => setNewSegment({ ...newSegment, rate: e.target.value })} /><input className="input" type="number" step="0.01" placeholder="Freight" value={newSegment.freight} onChange={e => setNewSegment({ ...newSegment, freight: e.target.value })} /></div><button className="btn btn-primary full">Save Segment</button></form></div>{selectedRateCategory && <div className="grid grid-2 small-card"><div className="field"><label className="label">Daily Rate</label><input key={`daily-${selectedRateCategory.id}`} className="input" type="number" step="0.01" defaultValue={selectedRateCategory.daily_rate} onBlur={e => updateCategory('daily_rate', e.target.value)} /></div><div className="field"><label className="label">Freight</label><input key={`freight-${selectedRateCategory.id}`} className="input" type="number" step="0.01" defaultValue={selectedRateCategory.freight} onBlur={e => updateCategory('freight', e.target.value)} /></div></div>}<form className="small-card" onSubmit={addSize}><div className="grid grid-3"><input className="input" value={newSizeName} onChange={e => setNewSizeName(e.target.value)} placeholder="Size name" /><input className="input" type="number" step="0.01" value={newSizeDiff} onChange={e => setNewSizeDiff(e.target.value)} placeholder="Diff" /><button className="btn btn-primary">Add Size</button></div></form><div className="table-wrap"><table className="table"><thead><tr><th>Size</th><th>Diff</th><th>Preview</th><th></th></tr></thead><tbody>{rateItems.filter(i => i.category_id === selectedRateCategoryId).map(item => <tr key={item.id}><td data-label="Size"><b>{item.name}</b></td><td data-label="Diff"><input className="input" type="number" step="0.01" defaultValue={item.fixed_difference} onBlur={e => updateDiff(item.id, e.target.value)} /></td><td data-label="Preview">{selectedRateCategory && <b style={{ color: '#047857' }}>{inr(calculateUnitRate(item.category_id, item.fixed_difference))}/kg</b>}</td><td data-label="Action"><button className="btn btn-danger" onClick={() => deleteSize(item.id)}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div></div>;
  }

  function approvals() {
    const pending = submissions.filter(s => s.status === 'Pending');
    return <div className="area"><h2 className="section-title">Pending Claims</h2>{pending.length === 0 ? <div className="empty"><CheckCircle2 size={44} /> No pending claims.</div> : pending.map(sub => { const fab = fabricators.find(f => f.id === sub.fabricator_id); return <div className="small-card" key={sub.id}><b>{fab?.name || 'Unknown'}</b><p>{sub.item_name}</p><p className="muted">{sub.quantity} {sub.unit} • +{sub.points_earned} pts • {sub.submission_date}</p><button className="btn btn-success" onClick={() => approveSub(sub.id)}><Check size={16} /> Approve</button> <button className="btn btn-danger" onClick={() => rejectSub(sub.id)}><X size={16} /> Decline</button></div>; })}</div>;
  }

  function fabricatorsPage() {
    return <div className="grid"><div className="area"><h2 className="section-title">Pending Profile Registrations</h2>{fabricators.filter(f => f.status === 'Pending').length === 0 ? <div className="empty">No pending approvals.</div> : fabricators.filter(f => f.status === 'Pending').map(f => <div className="small-card" key={f.id}><b>{f.name}</b><p><Phone size={14} /> {f.mobile} • <MapPin size={14} /> {f.address}</p><button className="btn btn-success" onClick={() => approveFab(f.id)}>Approve</button> <button className="btn btn-danger" onClick={() => rejectFab(f.id)}>Reject</button></div>)}</div><div className="area"><h2 className="section-title">Approved Fabricators</h2><div className="table-wrap"><table className="table"><tbody>{fabricators.filter(f => f.status === 'Approved').map(f => <tr key={f.id}><td data-label="Name"><b>{f.name}</b></td><td data-label="Mobile">{f.mobile}</td><td data-label="Address">{f.address}</td><td data-label="Points" className="right"><b>{f.total_points} pts</b></td></tr>)}</tbody></table></div></div></div>;
  }

  function itemsConfig() {
    return <div className="grid grid-3"><div className="area"><h2 className="section-title">Add Item</h2><form onSubmit={addNewItem}><div className="field"><label className="label">Item</label><input className="input" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} /></div><div className="grid grid-2"><select value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })}><option value="kg">kg</option><option value="pcs">pcs</option><option value="ft">ft</option></select><input className="input" type="number" placeholder="Points" value={newItem.points} onChange={e => setNewItem({ ...newItem, points: e.target.value })} /></div><button className="btn btn-primary full">Save</button></form></div><div className="area" style={{ gridColumn: 'span 2' }}>{items.map(i => <div className="small-card" key={i.id}><b>{i.name}</b><p>{i.points_per_unit} points / {i.unit}</p><button className="btn btn-danger" onClick={() => deleteItem(i.id)}><Trash2 size={16} /></button></div>)}</div></div>;
  }

  function historyLogs() {
    return <div className="area"><h2 className="section-title">Processed Logs</h2><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Shop</th><th>Item</th><th>Points</th><th>Status</th></tr></thead><tbody>{submissions.filter(s => s.status !== 'Pending').map(s => { const fab = fabricators.find(f => f.id === s.fabricator_id); return <tr key={s.id}><td data-label="Date">{s.submission_date}</td><td data-label="Shop">{fab?.name || 'Unknown'}</td><td data-label="Item">{s.item_name}<br /><span className="muted">Qty: {s.quantity} {s.unit}</span></td><td data-label="Points">{s.points_earned}</td><td data-label="Status">{statusBadge(s.status)}</td></tr>; })}</tbody></table></div></div>;
  }
}
