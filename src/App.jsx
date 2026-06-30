import React, { useEffect, useMemo, useState } from 'react';
import {
  Menu, X, Trash2, Calculator, BarChart3, FolderPlus, PlusCircle, History,
  CheckCircle2, AlertCircle, Clock, LogOut, UserPlus, Copy, MessageCircle,
  Send, Mail, TrendingUp, TrendingDown, MinusCircle, RefreshCw
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';

function AsrIronLogo() {
  return (
    <svg viewBox="0 0 420 150" className="app-logo" xmlns="http://www.w3.org/2000/svg">
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
const round05 = (v) => Math.round(num(v) * 20) / 20;
const inr = (v) => `₹${round05(v).toLocaleString('en-IN', { minimumFractionDigits: round05(v) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const todayText = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};
function timeAgo(value) {
  if (!value) return 'not updated';
  const ms = Date.now() - new Date(value).getTime();
  if (ms < 60000) return 'just now';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}
function changeInfo(row) {
  const diff = Number((num(row.daily_rate) - num(row.previous_daily_rate)).toFixed(2));
  if (diff > 0) return { cls: 'up', icon: <TrendingUp size={13} />, text: `+${inr(diff)}` };
  if (diff < 0) return { cls: 'down', icon: <TrendingDown size={13} />, text: `-${inr(Math.abs(diff))}` };
  return { cls: 'flat', icon: <MinusCircle size={13} />, text: 'No change' };
}

export default function App() {
  const [screen, setScreen] = useState('login');
  const [user, setUser] = useState(null);
  const [fabricators, setFabricators] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [incentiveItems, setIncentiveItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rateItems, setRateItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [confirmBox, setConfirmBox] = useState(null);
  const [sideOpen, setSideOpen] = useState(false);

  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [signup, setSignup] = useState({ name: '', mobile: '', address: '', password: '' });
  const [signupOk, setSignupOk] = useState(false);
  const [signupError, setSignupError] = useState('');

  const [adminTab, setAdminTab] = useState('calculator');
  const [fabTab, setFabTab] = useState('calculator');
  const [categoryId, setCategoryId] = useState('');
  const [sizeId, setSizeId] = useState('');
  const [qty, setQty] = useState('0');
  const [cart, setCart] = useState([]);
  const [quoteText, setQuoteText] = useState('');
  const [quoteEdited, setQuoteEdited] = useState(false);

  const [newSegment, setNewSegment] = useState({ name: '', rate: '', freight: '' });
  const [newSizeName, setNewSizeName] = useState('');
  const [newSizeDiff, setNewSizeDiff] = useState('');
  const [marketSearch, setMarketSearch] = useState('');
  const [sizeSearch, setSizeSearch] = useState('');
  const [newIncentive, setNewIncentive] = useState({ name: '', unit: 'kg', points: '' });

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' })), [categories]);
  const marketCategories = useMemo(() => sortedCategories.filter(c => String(c.name).toLowerCase().includes(marketSearch.toLowerCase())), [sortedCategories, marketSearch]);
  const visibleSizes = useMemo(() => {
    let rows = rateItems.filter(x => x.category_id === categoryId);
    const c = categories.find(x => x.id === categoryId);
    if (c?.name?.toLowerCase() === 'pipe') rows = [...rows].reverse();
    else rows = [...rows].sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' }));
    if (sizeSearch) rows = rows.filter(x => String(x.name).toLowerCase().includes(sizeSearch.toLowerCase()));
    return rows;
  }, [rateItems, categoryId, categories, sizeSearch]);

  async function loadAll() {
    setLoading(true);
    const [f, s, i, c, r] = await Promise.all([
      supabase.from('fabricators').select('*').order('created_at'),
      supabase.from('submissions').select('*').order('created_at', { ascending: false }),
      supabase.from('incentive_items').select('*').order('created_at'),
      supabase.from('rate_categories').select('*').order('name'),
      supabase.from('rate_items').select('*').order('created_at')
    ]);
    if (f.error || s.error || i.error || c.error || r.error) {
      setToast('Database load failed. Check Supabase keys, RLS policies, and migration.');
    } else {
      setFabricators(f.data || []);
      setSubmissions(s.data || []);
      setIncentiveItems(i.data || []);
      setCategories(c.data || []);
      setRateItems(r.data || []);
      if (!categoryId && c.data?.length) setCategoryId(c.data[0].id);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    const saved = JSON.parse(localStorage.getItem('asrLogin') || 'null');
    if (saved?.auto) {
      setLoginId(saved.loginId || '');
      setLoginPassword(saved.loginPassword || '');
      setUser(saved.user);
      setScreen(saved.role === 'admin' ? 'admin' : saved.role === 'salesman' ? 'salesman' : 'fabricator');
      setAdminTab('calculator');
      setFabTab('calculator');
    }
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 1000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!quoteEdited) setQuoteText(buildQuote()); }, [cart, quoteEdited]);

  const getCategory = (id) => categories.find(c => c.id === id);
  function unitRate(catId, diff) {
    const c = getCategory(catId) || {};
    return round05((num(c.daily_rate) + num(diff) + num(c.freight)) * 1.18);
  }
  function ask(title, onYes) { setConfirmBox({ title, onYes }); }
  function saveLogin(role, u) { localStorage.setItem('asrLogin', JSON.stringify({ role, user: u, loginId, loginPassword, auto: true })); }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    if (loginId.trim().toLowerCase() === 'admin' && loginPassword === 'admin') {
      const u = { id: 'admin', name: 'Admin', role: 'admin' };
      setUser(u); setScreen('admin'); setAdminTab('calculator'); saveLogin('admin', u); return;
    }
    if (['sales', 'salesman'].includes(loginId.trim().toLowerCase()) && ['sales123', 'salesman'].includes(loginPassword)) {
      const u = { id: 'salesman', name: 'Salesman', role: 'salesman' };
      setUser(u); setScreen('salesman'); saveLogin('salesman', u); return;
    }
    const { data, error } = await supabase.from('fabricators').select('*').eq('mobile', loginId.trim()).maybeSingle();
    if (error || !data) return setLoginError('No profile registered under this mobile number.');
    if (data.password !== loginPassword) return setLoginError('Incorrect password.');
    if (data.status !== 'Approved') return setLoginError(`Your profile is ${data.status}.`);
    const u = { ...data, role: 'fabricator' };
    setUser(u); setScreen('fabricator'); setFabTab('calculator'); saveLogin('fabricator', u);
  }
  async function handleSignup(e) {
    e.preventDefault();
    setSignupError('');
    const { error } = await supabase.from('fabricators').insert({ ...signup, total_points: 0, status: 'Pending' });
    if (error) return setSignupError(error.message);
    setSignupOk(true);
    setSignup({ name: '', mobile: '', address: '', password: '' });
    await loadAll();
  }
  function logout() { localStorage.removeItem('asrLogin'); setUser(null); setScreen('login'); setLoginId(''); setLoginPassword(''); }

  async function updateRate(row, newRate, newFreight = row.freight) {
    const patch = { previous_daily_rate: num(row.daily_rate), daily_rate: num(newRate), freight: num(newFreight), updated_at: new Date().toISOString() };
    setCategories(prev => prev.map(x => x.id === row.id ? { ...x, ...patch } : x));
    const { error } = await supabase.from('rate_categories').update(patch).eq('id', row.id);
    if (error) { setToast(error.message); await loadAll(); }
  }
  async function addMarket(e) {
    e.preventDefault();
    if (!newSegment.name.trim()) return;
    const initial = num(newSegment.rate);
    const { data, error } = await supabase.from('rate_categories').insert({ name: newSegment.name.trim(), daily_rate: initial, previous_daily_rate: initial, freight: num(newSegment.freight), updated_at: new Date().toISOString() }).select().single();
    if (error) return setToast(error.message);
    setCategories(prev => [...prev, data]);
    setNewSegment({ name: '', rate: '', freight: '' });
  }
  function deleteSegment(row) {
    ask(`Delete ${row.name}?`, async () => {
      await supabase.from('rate_items').delete().eq('category_id', row.id);
      const { error } = await supabase.from('rate_categories').delete().eq('id', row.id);
      if (error) return setToast(error.message);
      setCategories(prev => prev.filter(x => x.id !== row.id));
      setRateItems(prev => prev.filter(x => x.category_id !== row.id));
      setCart(prev => prev.filter(x => x.category !== row.name));
      setToast(`${row.name} deleted.`);
    });
  }

  async function addSize(e) {
    e.preventDefault();
    if (!newSizeName.trim() || !categoryId) return;
    const { data, error } = await supabase.from('rate_items').insert({ category_id: categoryId, name: newSizeName, fixed_difference: num(newSizeDiff) }).select().single();
    if (error) return setToast(error.message);
    setRateItems(prev => [...prev, data]);
    setNewSizeName(''); setNewSizeDiff('');
  }
  function deleteSize(item) { ask(`Delete ${item.name}?`, async () => { const { error } = await supabase.from('rate_items').delete().eq('id', item.id); if (error) return setToast(error.message); setRateItems(prev => prev.filter(x => x.id !== item.id)); setCart([]); setToast(`${item.name} deleted.`); }); }
  async function updateSizeName(item, value) { if (!value.trim()) return; setRateItems(prev => prev.map(x => x.id === item.id ? { ...x, name: value } : x)); const { error } = await supabase.from('rate_items').update({ name: value }).eq('id', item.id); if (error) { setToast(error.message); await loadAll(); } }
  async function updateDiff(item, value) { setRateItems(prev => prev.map(x => x.id === item.id ? { ...x, fixed_difference: num(value) } : x)); const { error } = await supabase.from('rate_items').update({ fixed_difference: num(value) }).eq('id', item.id); if (error) { setToast(error.message); await loadAll(); } }

  function addCalc(e) {
    e.preventDefault();
    if (!categoryId || !sizeId || qty === '' || Number(qty) < 0) return;
    const s = rateItems.find(x => x.id === sizeId), c = getCategory(categoryId);
    if (!s || !c) return;
    const u = unitRate(categoryId, s.fixed_difference), q = Number(qty), total = q === 0 ? u : round05(u * q);
    setCart([...cart, { id: `cart-${Date.now()}`, category: c.name, itemName: s.name, qty: q, unitRate: u, total }]);
    setQuoteEdited(false); setSizeId(''); setQty('0');
  }
  function deleteQuoteRow(item) { ask(`Delete ${item.itemName}?`, () => { setCart(cart.filter(x => x.id !== item.id)); setQuoteEdited(false); setToast(`${item.itemName} deleted.`); }); }

  async function addIncentive(e) {
    e.preventDefault();
    if (!newIncentive.name || !newIncentive.points) return;
    const { data, error } = await supabase.from('incentive_items').insert({ name: newIncentive.name, unit: newIncentive.unit, points_per_unit: num(newIncentive.points) }).select().single();
    if (error) return setToast(error.message);
    setIncentiveItems(prev => [...prev, data]);
    setNewIncentive({ name: '', unit: 'kg', points: '' });
  }
  function deleteIncentive(item) { ask(`Delete ${item.name}?`, async () => { await supabase.from('incentive_items').delete().eq('id', item.id); setIncentiveItems(prev => prev.filter(x => x.id !== item.id)); setToast(`${item.name} deleted.`); }); }

  async function approveFab(f) { await supabase.from('fabricators').update({ status: 'Approved' }).eq('id', f.id); setFabricators(prev => prev.map(x => x.id === f.id ? { ...x, status: 'Approved' } : x)); setToast(`${f.name} approved.`); }
  async function rejectFab(f) { await supabase.from('fabricators').update({ status: 'Rejected' }).eq('id', f.id); setFabricators(prev => prev.map(x => x.id === f.id ? { ...x, status: 'Rejected' } : x)); setToast(`${f.name} rejected.`); }
  async function approveSub(s) { const { error } = await supabase.rpc('approve_submission', { p_submission_id: s.id }); if (error) return setToast(error.message); setSubmissions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'Approved' } : x)); }
  async function rejectSub(s) { const { error } = await supabase.rpc('reject_submission', { p_submission_id: s.id }); if (error) return setToast(error.message); setSubmissions(prev => prev.map(x => x.id === s.id ? { ...x, status: 'Rejected' } : x)); }

  function buildQuote() {
    const d = todayText();
    if (!cart.length) return `          📝 *ASR Iron* \n             *${d}*\n-------------------------------------\n\n-------------------------------------\nThankyou!`;
    const lines = ['          📝 *ASR Iron* ', `             *${d}*`, '-------------------------------------'];
    cart.forEach((i, idx) => lines.push(`${idx + 1}. *${i.category.toUpperCase()} - ${i.itemName}* : *${inr(i.total)}*`, ''));
    lines.push('-------------------------------------', '', 'Thankyou!');
    return lines.join('\n');
  }
  const finalQuote = () => quoteText || buildQuote();
  async function copyQuote() { await navigator.clipboard.writeText(finalQuote()); setToast('Quotation copied.'); }
  function whatsapp() { window.open(`https://wa.me/?text=${encodeURIComponent(finalQuote())}`, '_blank'); }
  function telegram() { window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(finalQuote())}`, '_blank'); }
  function emailQuote() { window.open(`mailto:?subject=${encodeURIComponent('ASR Iron Quotation')}&body=${encodeURIComponent(finalQuote())}`, '_blank'); }
  async function nativeShare() { if (navigator.share) { try { await navigator.share({ title: 'ASR Iron Quotation', text: finalQuote() }); } catch {} } else await copyQuote(); }
  function resetQuote() { setQuoteText(buildQuote()); setQuoteEdited(false); }

  const adminMenu = [
    { id: 'calculator', label: 'Calculator', icon: <Calculator size={18} /> },
    { id: 'market', label: 'Market', icon: <BarChart3 size={18} /> },
    { id: 'daily', label: 'Daily Rate', icon: <FolderPlus size={18} /> },
    { id: 'claims', label: 'Claims', icon: <CheckCircle2 size={18} /> },
    { id: 'signups', label: 'Signups', icon: <UserPlus size={18} /> },
    { id: 'items', label: 'Items', icon: <PlusCircle size={18} /> },
    { id: 'history', label: 'History', icon: <History size={18} /> }
  ];
  const fabMenu = [
    { id: 'calculator', label: 'Calculator', icon: <Calculator size={18} /> },
    { id: 'market', label: 'Market', icon: <BarChart3 size={18} /> },
    { id: 'claims', label: 'Claims', icon: <CheckCircle2 size={18} /> }
  ];
  const salesMenu = [{ id: 'calculator', label: 'Calculator', icon: <Calculator size={18} /> }];

  function ticker() {
    return <div className="market-ticker"><div className="market-strip">{sortedCategories.map((row, i) => { const d = changeInfo(row); return <div className={`rate-chip ${i < 4 ? 'fixed' : ''}`} key={row.id}><div className="rate-name">{row.name}</div><div className="rate-value">{inr(row.daily_rate)}</div><div className={`rate-change ${d.cls}`}>{d.icon}{d.text}</div><div className="rate-time">Updated {timeAgo(row.updated_at || row.created_at)}</div></div>; })}</div></div>;
  }
  function marketPage() {
    return <div className="grid"><div className="area"><h2 className="section-title"><BarChart3 size={20} /> Daily Market Rates</h2><p className="section-note">Increment/decrement compares current value with previous saved update and remains after refresh.</p><input className="input search-box" placeholder="Search market category..." value={marketSearch} onChange={e => setMarketSearch(e.target.value)} /><form className="small-card" onSubmit={addMarket}><h3>Add New Market Item</h3><div className="grid grid-3"><input className="input" placeholder="Name" value={newSegment.name} onChange={e => setNewSegment({ ...newSegment, name: e.target.value })} /><input className="input" type="number" placeholder="Daily Rate" value={newSegment.rate} onChange={e => setNewSegment({ ...newSegment, rate: e.target.value })} /><input className="input" type="number" placeholder="Freight" value={newSegment.freight} onChange={e => setNewSegment({ ...newSegment, freight: e.target.value })} /></div><button className="btn btn-primary full">Add to Market</button></form></div><div className="market-grid">{marketCategories.map(row => { const d = changeInfo(row); return <div className="market-card" key={row.id}><div className="market-card-head"><div><div className="rate-name">{row.name}</div><div className="rate-value">{inr(row.daily_rate)}</div><div className={`rate-change ${d.cls}`}>{d.icon}{d.text}</div><div className="rate-time">Last updated {timeAgo(row.updated_at || row.created_at)}</div></div><button className="market-delete-btn" onClick={() => deleteSegment(row)}><Trash2 size={16} /></button></div><div className="market-update-grid"><div className="field"><label className="label">New Daily Rate</label><input className="input" type="number" defaultValue={row.daily_rate} onBlur={e => updateRate(row, e.target.value, row.freight)} /></div><div className="field"><label className="label">Freight</label><input className="input" type="number" defaultValue={row.freight} onBlur={e => updateRate(row, row.daily_rate, e.target.value)} /></div></div></div>; })}</div></div>;
  }
  function dailyPage() {
    return <div className="area"><h2 className="section-title">Daily Rate Configuration</h2><div className="field"><label className="label">Select Segment</label><select value={categoryId} onChange={e => { setCategoryId(e.target.value); setSizeSearch(''); }}>{sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><input className="input search-box" placeholder="Search size/name..." value={sizeSearch} onChange={e => setSizeSearch(e.target.value)} /><form className="small-card" onSubmit={addSize}><div className="grid grid-3"><input className="input" value={newSizeName} onChange={e => setNewSizeName(e.target.value)} placeholder="Size name" /><input className="input" type="number" value={newSizeDiff} onChange={e => setNewSizeDiff(e.target.value)} placeholder="Diff" /><button className="btn btn-primary">Add Size</button></div></form><div className="table-wrap"><table className="table"><thead><tr><th>Size</th><th>Diff</th><th>Preview</th><th></th></tr></thead><tbody>{visibleSizes.map(s => <tr key={s.id}><td data-label="Size"><input className="input" defaultValue={s.name} onBlur={e => updateSizeName(s, e.target.value)} /></td><td data-label="Diff"><input className="input" type="number" defaultValue={s.fixed_difference} onBlur={e => updateDiff(s, e.target.value)} /></td><td data-label="Preview">{inr(unitRate(s.category_id, s.fixed_difference))}/kg</td><td data-label="Action"><button className="btn btn-danger" onClick={() => deleteSize(s)}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div></div>;
  }
  function calculatorPage() {
    const activeSizes = rateItems.filter(x => x.category_id === categoryId);
    const total = cart.reduce((s, i) => s + i.total, 0);
    return <div className="grid grid-5"><div className="area"><h3 className="section-title"><Calculator size={20} /> Generate New Estimate</h3><form onSubmit={addCalc}><div className="field"><label className="label">Step 1: Select Category</label><select value={categoryId} onChange={e => { setCategoryId(e.target.value); setSizeId(''); setQty('0'); }} required><option value="">-- Choose Category --</option>{sortedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>{categoryId && <div className="field"><label className="label">Step 2: Choose Size</label><select value={sizeId} onChange={e => { setSizeId(e.target.value); setQty('0'); }} required><option value="">-- Select Size --</option>{activeSizes.map(s => <option key={s.id} value={s.id}>{s.name} (Diff: ₹{s.fixed_difference})</option>)}</select></div>}{categoryId && sizeId && <div className="small-card"><div className="field"><label className="label">Quantity kg</label><input className="input" type="number" min="0" step="0.1" value={qty} onChange={e => setQty(e.target.value)} required /></div></div>}<button className="btn btn-primary full" disabled={!categoryId || !sizeId || qty === '' || Number(qty) < 0}>Add Item</button></form></div><div className="area quote-summary-area"><h3 className="section-title compact-title">Calculated Quote Summary</h3>{cart.length === 0 ? <div className="empty compact-empty"><Calculator size={32} /><p>No items added.</p></div> : <><div className="quote-mini-list">{cart.map(i => <div className="quote-mini-row" key={i.id}><div><div className="quote-mini-item">{i.itemName}</div><div className="quote-mini-cat">{i.category} . {inr(i.unitRate)}{i.qty === 0 ? '' : ` * ${i.qty}`}</div></div><div className="quote-mini-price">{inr(i.total)}</div><button className="quote-mini-delete" onClick={() => deleteQuoteRow(i)}><X size={14} /></button></div>)}</div><div className="editable-quote"><label className="label">Editable quotation text</label><textarea className="input" value={quoteText} onChange={e => { setQuoteText(e.target.value); setQuoteEdited(true); }} /></div><div className="share-panel"><button className="btn btn-primary" onClick={copyQuote}><Copy size={16} />Copy</button><button className="btn btn-success" onClick={whatsapp}><MessageCircle size={16} />WhatsApp</button><button className="btn btn-soft" onClick={telegram}><Send size={16} />Telegram</button><button className="btn btn-soft" onClick={emailQuote}><Mail size={16} />Email</button><button className="btn btn-gold" onClick={nativeShare}><Send size={16} />Share</button><button className="btn btn-soft" onClick={resetQuote}>Reset Text</button></div><div className="quote-total compact-total"><div><div className="label">Total kg</div><b>{cart.reduce((s, i) => s + i.qty, 0).toFixed(1)} kg</b></div><div><div className="label">Estimated Invoice</div><div className="big-green">{inr(total)}</div></div></div></>}</div></div>;
  }
  function itemsPage() {
    return <div className="items-page-wrap"><div className="area"><h2 className="section-title">Add Item</h2><form onSubmit={addIncentive}><div className="field"><input className="input" placeholder="Item" value={newIncentive.name} onChange={e => setNewIncentive({ ...newIncentive, name: e.target.value })} required /></div><div className="field"><select className="input" value={newIncentive.unit} onChange={e => setNewIncentive({ ...newIncentive, unit: e.target.value })}><option value="kg">kg</option><option value="pcs">pcs</option><option value="ft">ft</option></select></div><div className="field"><input className="input" type="number" placeholder="Points" value={newIncentive.points} onChange={e => setNewIncentive({ ...newIncentive, points: e.target.value })} required /></div><button className="btn btn-primary full">Save</button></form></div><div className="items-list-wrap">{incentiveItems.map(i => <div className="incentive-item-card" key={i.id}><div className="incentive-item-info"><h3>{i.name}</h3><p>{i.points_per_unit} points / {i.unit}</p></div><button className="item-delete-strip" onClick={() => deleteIncentive(i)}><Trash2 size={18} /></button></div>)}</div></div>;
  }
  function signupsPage() {
    const pending = fabricators.filter(f => f.status === 'Pending');
    const approved = fabricators.filter(f => f.status === 'Approved');
    return <div className="grid"><div className="area"><h2 className="section-title">Pending Signups</h2>{pending.length === 0 ? <div className="empty">No pending signups.</div> : pending.map(f => <div className="small-card" key={f.id}><b>{f.name}</b><p>{f.mobile} • {f.address}</p><button className="btn btn-success" onClick={() => approveFab(f)}>Approve</button> <button className="btn btn-danger" onClick={() => rejectFab(f)}>Reject</button></div>)}</div><div className="area"><h2 className="section-title">Approved Fabricators</h2>{approved.map(f => <div className="small-card" key={f.id}><b>{f.name}</b><p>{f.mobile} • {f.total_points} pts</p></div>)}</div></div>;
  }
  function claimsPage() {
    const pending = submissions.filter(s => s.status === 'Pending');
    return <div className="area"><h2 className="section-title">Pending Claims</h2>{pending.length === 0 ? <div className="empty">No pending claims.</div> : pending.map(s => <div className="small-card" key={s.id}><b>{s.item_name}</b><p>{s.quantity} {s.unit} • {s.points_earned} pts</p><button className="btn btn-success" onClick={() => approveSub(s)}>Approve</button> <button className="btn btn-danger" onClick={() => rejectSub(s)}>Decline</button></div>)}</div>;
  }
  function historyPage() { return <div className="area"><h2 className="section-title">Processed Logs</h2>{submissions.filter(s => s.status !== 'Pending').map(s => <div className="small-card" key={s.id}><b>{s.item_name}</b><p>{s.points_earned} pts • {s.status}</p></div>)}</div>; }
  function fabricatorClaimsPage() { return <div className="area"><h2 className="section-title">My Claims</h2>{submissions.filter(s => s.fabricator_id === user?.id).map(s => <div className="small-card" key={s.id}><b>{s.item_name}</b><p>{s.quantity} {s.unit} • {s.status}</p></div>)}</div>; }

  function sideMenu(type) {
    const isAdmin = type === 'admin', isSales = type === 'salesman';
    const list = isSales ? salesMenu : isAdmin ? adminMenu : fabMenu;
    const current = isAdmin ? adminTab : fabTab;
    const setTab = isAdmin ? setAdminTab : setFabTab;
    return <><div className={`sidebar-backdrop ${sideOpen ? 'show' : ''}`} onClick={() => setSideOpen(false)} /><aside className={`side-menu ${sideOpen ? 'open' : ''}`}><div className="side-menu-head"><AsrIronLogo /><button className="side-close" onClick={() => setSideOpen(false)}><X size={20} /></button></div><div className="side-menu-title">{isSales ? 'Salesman Menu' : isAdmin ? 'Admin Menu' : 'Fabricator Menu'}</div><div className="side-menu-list">{list.map(item => <button key={item.id} className={`side-menu-item ${current === item.id ? 'active' : ''}`} onClick={() => { setTab(item.id); setSideOpen(false); }}>{item.icon}<span>{item.label}</span></button>)}</div></aside></>;
  }
  function bottomNav(type) {
    const isAdmin = type === 'admin', isSales = type === 'salesman';
    const base = isSales ? salesMenu : isAdmin ? adminMenu : fabMenu;
    const list = isAdmin ? base : [...base, { id: 'logout', label: 'Logout', icon: <LogOut size={18} /> }];
    const current = isAdmin ? adminTab : fabTab;
    return <div className="bottom-nav-scroll">{list.map(item => <button key={item.id} className={current === item.id ? 'active' : ''} onClick={() => item.id === 'logout' ? logout() : isAdmin ? setAdminTab(item.id) : setFabTab(item.id)}>{item.icon}<span>{item.label}</span></button>)}</div>;
  }
  function confirmDialog() {
    if (!confirmBox) return null;
    return <div className="confirm-backdrop"><div className="confirm-box"><button className="confirm-x" onClick={() => setConfirmBox(null)}><X size={16} /></button><div className="confirm-icon"><Trash2 size={20} /></div><h3>{confirmBox.title}</h3><p>This action cannot be undone.</p><div className="confirm-actions"><button className="btn btn-soft" onClick={() => setConfirmBox(null)}>No</button><button className="btn btn-danger" onClick={async () => { const fn = confirmBox.onYes; setConfirmBox(null); await fn(); }}>Yes, delete</button></div></div></div>;
  }
  function Header({ type }) {
    return <><header className={`header ${type === 'admin' ? 'dark' : ''}`}><div className="head-inner"><div className="brand-row"><button className="hamburger-btn" onClick={() => setSideOpen(true)}><Menu size={22} /></button><AsrIronLogo />{type === 'admin' && <span className="admin-badge">ADMIN</span>}</div><button className="btn btn-soft" onClick={logout}><LogOut size={16} />{type === 'admin' ? ' Sign Out' : ''}</button></div></header>{sideMenu(type)}</>;
  }
  function dashboard(type) {
    const isAdmin = type === 'admin', isSales = type === 'salesman';
    const tab = isAdmin ? adminTab : fabTab;
    return <div className="screen"><Header type={type} /><main className="main">{(isSales || ['calculator', 'market', 'daily'].includes(tab)) && ticker()}{isSales && calculatorPage()}{!isSales && tab === 'calculator' && <div className="area">{calculatorPage()}</div>}{!isSales && tab === 'market' && marketPage()}{isAdmin && tab === 'daily' && dailyPage()}{isAdmin && tab === 'claims' && claimsPage()}{isAdmin && tab === 'signups' && signupsPage()}{isAdmin && tab === 'items' && itemsPage()}{isAdmin && tab === 'history' && historyPage()}{!isAdmin && tab === 'claims' && fabricatorClaimsPage()}</main>{bottomNav(type)}</div>;
  }

  function loginPage() {
    return <div className="screen center"><div className="login-card card"><div className="login-head"><AsrIronLogo /><div className="bar" /><p className="subtitle">Incentive Reward Portal</p></div><div className="login-body">{loginError && <div className="error">{loginError}</div>}<form onSubmit={handleLogin}><div className="field"><label className="label">Mobile / Username</label><input className="input" value={loginId} onChange={e => setLoginId(e.target.value)} required /></div><div className="field"><label className="label">Password</label><input className="input" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required /></div><button className="btn btn-primary full">Sign In</button></form><p className="muted" style={{ fontSize: 12 }}>Salesman: sales / sales123</p><div style={{ height: 20 }} /><button className="btn btn-outline full" onClick={() => { setScreen('signup'); setSignupOk(false); }}><UserPlus size={18} />Register as Partner</button></div></div></div>;
  }
  function signupPage() {
    return <div className="screen center"><div className="login-card card"><div className="login-head"><AsrIronLogo /><div className="bar" /><p className="subtitle">Fabricator Sign Up</p></div><div className="login-body">{signupOk ? <div><CheckCircle2 size={56} color="#059669" /><h3>Registration Complete</h3><button className="btn btn-primary full" onClick={() => setScreen('login')}>Back</button></div> : <form onSubmit={handleSignup}>{signupError && <div className="error">{signupError}</div>}<input className="input" placeholder="Shop Name" value={signup.name} onChange={e => setSignup({ ...signup, name: e.target.value })} required /><br /><br /><input className="input" placeholder="Mobile" pattern="[0-9]{10}" value={signup.mobile} onChange={e => setSignup({ ...signup, mobile: e.target.value })} required /><br /><br /><textarea className="input" placeholder="Address" value={signup.address} onChange={e => setSignup({ ...signup, address: e.target.value })} required /><br /><br /><input className="input" type="password" placeholder="Password" value={signup.password} onChange={e => setSignup({ ...signup, password: e.target.value })} required /><br /><br /><button className="btn btn-primary full">Submit for Approval</button><button type="button" className="btn btn-soft full" onClick={() => setScreen('login')}>Back</button></form>}</div></div></div>;
  }

  if (loading) return <div className="screen center"><div className="card"><RefreshCw /> Loading database...</div></div>;
  return <div>{toast && <div className="toast toast-message"><span>{toast}</span><button className="toast-close" onClick={() => setToast('')}><X size={16} /></button></div>}{confirmDialog()}{screen === 'login' && loginPage()}{screen === 'signup' && signupPage()}{screen === 'admin' && user && dashboard('admin')}{screen === 'fabricator' && user && dashboard('fabricator')}{screen === 'salesman' && user && dashboard('salesman')}</div>;
}
