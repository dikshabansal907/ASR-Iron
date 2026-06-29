import { useEffect, useMemo, useState } from 'react';
import {
  Award, Boxes, Calculator, Check, CheckCircle2, ClipboardList, Clock, History, Layers,
  Lock, LogOut, MapPin, Phone, PlusCircle, RefreshCw, Ruler, Scale, Trash2,
  Trophy, UserCheck, UserPlus, Users, X, WalletCards
} from 'lucide-react';
import { supabase } from './lib/supabase';

const units = ['kg', 'pcs', 'ft'];
const money = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const n = (value) => Number(value || 0);

function StatusBadge({ status }) {
  const normalized = String(status || 'pending').toLowerCase();
  const map = {
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    pending: 'bg-amber-100 text-amber-800 animate-pulse'
  };
  const Icon = normalized === 'approved' ? CheckCircle2 : Clock;
  return <span className={`inline-flex items-center gap-1 ${map[normalized] || map.pending} text-xs font-semibold px-2.5 py-1 rounded-full`}><Icon className="w-3.5 h-3.5" /> {normalized}</span>;
}

function UnitBadge({ unit }) {
  const Icon = unit === 'kg' ? Scale : unit === 'ft' ? Ruler : Boxes;
  return <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded"><Icon className="w-3 h-3" /> {unit}</span>;
}

function Shell({ children, title, subtitle, icon: Icon = Award, onLogout }) {
  return <div className="min-h-screen bg-slate-50"><header className="bg-white border-b border-slate-200 sticky top-0 z-20"><div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between"><div className="flex items-center gap-2"><Icon className="w-7 h-7 text-indigo-600"/><div><h1 className="font-black text-slate-900 leading-tight">{title}</h1><p className="text-[11px] text-slate-500 font-semibold">{subtitle}</p></div></div>{onLogout && <button onClick={onLogout} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-red-600"><LogOut className="w-4 h-4"/> Logout</button>}</div></header>{children}</div>;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [segments, setSegments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rateItems, setRateItems] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [view, setView] = useState('login');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [authForm, setAuthForm] = useState({ email: '', password: '', company_name: '', mobile: '', workshop_address: '' });
  const [claim, setClaim] = useState({ item_id: '', quantity: '' });
  const [redeemPoints, setRedeemPoints] = useState('');
  const [newItem, setNewItem] = useState({ name: '', unit: 'kg', points_per_unit: '' });
  const [adminTab, setAdminTab] = useState('claims');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session?.user) loadAll(); else { setLoading(false); setProfile(null); } }, [session?.user?.id]);

  async function loadAll() {
    setLoading(true); setMessage('');
    const { data: me, error: meErr } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (meErr) setMessage(meErr.message);
    setProfile(me);
    const [itemRes, subRes, profRes, segRes, catRes, rateItemRes, sizeRes, redRes] = await Promise.all([
      supabase.from('incentive_items').select('*').order('created_at', { ascending: false }),
      supabase.from('submissions').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('segments').select('*').order('name'),
      supabase.from('rate_categories').select('*').order('name'),
      supabase.from('rate_items').select('*').order('name'),
      supabase.from('rate_item_sizes').select('*').order('size_label'),
      supabase.from('redemption_requests').select('*').order('created_at', { ascending: false })
    ]);
    setItems(itemRes.data || []); setSubmissions(subRes.data || []); setProfiles(profRes.data || []);
    setSegments(segRes.data || []); setCategories(catRes.data || []); setRateItems(rateItemRes.data || []); setSizes(sizeRes.data || []); setRedemptions(redRes.data || []);
    setLoading(false);
  }

  async function signIn(e) { e.preventDefault(); setMessage(''); const { error } = await supabase.auth.signInWithPassword({ email: authForm.email.trim(), password: authForm.password }); if (error) setMessage(error.message); }
  async function signUp(e) { e.preventDefault(); setMessage(''); const { error } = await supabase.auth.signUp({ email: authForm.email.trim(), password: authForm.password, options: { data: { company_name: authForm.company_name, mobile: authForm.mobile, workshop_address: authForm.workshop_address } } }); if (error) setMessage(error.message); else { setMessage('Registration submitted. An admin must approve your profile.'); setView('login'); } }
  async function logout() { await supabase.auth.signOut(); setSession(null); }

  async function submitClaim(e) {
    e.preventDefault(); setMessage('');
    const item = items.find(i => i.id === claim.item_id); const qty = Number(claim.quantity);
    if (!item || qty <= 0) return setMessage('Please select an item and enter quantity.');
    const { error } = await supabase.from('submissions').insert({ fabricator_id: profile.id, item_id: item.id, item_name: item.name, quantity: qty, unit: item.unit, points_earned: qty * item.points_per_unit });
    if (error) setMessage(error.message); else { setClaim({ item_id: '', quantity: '' }); await loadAll(); }
  }
  async function submitRedemption(e) {
    e.preventDefault(); setMessage('');
    const pts = Number(redeemPoints);
    if (!pts || pts <= 0) return setMessage('Enter valid points to redeem.');
    if (pts > Number(profile.total_points || 0)) return setMessage('You cannot redeem more than your approved balance.');
    const { error } = await supabase.from('redemption_requests').insert({ fabricator_id: profile.id, points_requested: pts, note: 'Redeem request from fabricator dashboard' });
    if (error) setMessage(error.message); else { setRedeemPoints(''); await loadAll(); setMessage('Redeem request submitted for admin approval.'); }
  }
  async function reviewClaim(id, status) {
    const submission = submissions.find(s => s.id === id); if (!submission) return;
    const { error } = await supabase.from('submissions').update({ status, reviewed_by: profile.id, reviewed_at: new Date().toISOString() }).eq('id', id);
    if (!error && status === 'approved') {
      const fab = profiles.find(p => p.id === submission.fabricator_id);
      await supabase.from('profiles').update({ total_points: (fab?.total_points || 0) + submission.points_earned }).eq('id', submission.fabricator_id);
    }
    await loadAll();
  }
  async function reviewRedemption(id, status) {
    const red = redemptions.find(r => r.id === id); if (!red) return;
    const fab = profiles.find(p => p.id === red.fabricator_id);
    if (status === 'approved' && Number(fab?.total_points || 0) < Number(red.points_requested)) return setMessage('Fabricator does not have enough points.');
    await supabase.from('redemption_requests').update({ status, reviewed_by: profile.id, reviewed_at: new Date().toISOString() }).eq('id', id);
    if (status === 'approved') await supabase.from('profiles').update({ total_points: Number(fab?.total_points || 0) - Number(red.points_requested) }).eq('id', red.fabricator_id);
    await loadAll();
  }
  async function updateProfileStatus(id, status) { await supabase.from('profiles').update({ status }).eq('id', id); await loadAll(); }
  async function addItem(e) { e.preventDefault(); await supabase.from('incentive_items').insert({ name: newItem.name, unit: newItem.unit, points_per_unit: Number(newItem.points_per_unit) }); setNewItem({ name: '', unit: 'kg', points_per_unit: '' }); await loadAll(); }
  async function deleteItem(id) { await supabase.from('incentive_items').update({ active: false }).eq('id', id); await loadAll(); }

  const mySubmissions = submissions.filter(s => s.fabricator_id === profile?.id);
  const myRedemptions = redemptions.filter(r => r.fabricator_id === profile?.id);
  const pendingClaims = submissions.filter(s => s.status === 'pending');
  const pendingProfiles = profiles.filter(p => p.status === 'pending');
  const pendingRedemptions = redemptions.filter(r => r.status === 'pending');
  const leaderboard = [...profiles].filter(p => p.status === 'approved').sort((a,b)=>(b.total_points||0)-(a.total_points||0)).slice(0,3);

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-600 font-bold">Loading FabriRewards…</div>;
  if (!session) return <AuthScreen view={view} setView={setView} form={authForm} setForm={setAuthForm} signIn={signIn} signUp={signUp} message={message} />;
  if (profile?.status !== 'approved') return <Shell title="FabriRewards" subtitle="Registration status" onLogout={logout}><main className="max-w-xl mx-auto p-6"><div className="bg-white rounded-2xl border p-8 text-center shadow-sm"><Clock className="w-14 h-14 mx-auto text-amber-500 mb-3"/><h2 className="text-xl font-black text-slate-900">Profile {profile?.status || 'pending'}</h2><p className="text-sm text-slate-500 mt-2">Your account must be approved by an admin before using the rewards dashboard.</p></div></main></Shell>;
  if (profile.role === 'admin') return <Admin {...{ logout, adminTab, setAdminTab, pendingClaims, pendingProfiles, pendingRedemptions, profiles, items, submissions, leaderboard, reviewClaim, reviewRedemption, updateProfileStatus, newItem, setNewItem, addItem, deleteItem, segments, categories, rateItems, sizes, loadAll, message }} />;
  return <Fabricator {...{ logout, profile, items, claim, setClaim, submitClaim, mySubmissions, redeemPoints, setRedeemPoints, submitRedemption, myRedemptions, message }} />;
}

function AuthScreen({ view, setView, form, setForm, signIn, signUp, message }) {
  const update = e => setForm({ ...form, [e.target.name]: e.target.value });
  return <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4"><div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border"><div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center text-white"><Award className="w-16 h-16 mx-auto mb-3 text-amber-300"/><h1 className="text-3xl font-black">FabriRewards</h1><p className="text-blue-100 text-sm">Industrial Fabrication Incentive Portal</p></div><div className="p-8">{message && <div className="mb-4 p-3 bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-xs font-semibold rounded">{message}</div>}{view === 'login' ? <form onSubmit={signIn} className="space-y-4"><h2 className="text-xl font-bold flex items-center gap-2"><Lock className="w-5 h-5 text-indigo-600"/> Log in</h2><Input name="email" type="email" value={form.email} onChange={update} label="Email"/><Input name="password" type="password" value={form.password} onChange={update} label="Password"/><button className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">Access Dashboard</button><button type="button" onClick={()=>setView('signup')} className="w-full py-3 bg-slate-100 rounded-xl font-bold text-slate-700">Apply for Registration</button></form> : <form onSubmit={signUp} className="space-y-4"><h2 className="text-xl font-bold flex items-center gap-2"><UserPlus className="w-5 h-5 text-indigo-600"/> Register</h2><Input name="company_name" value={form.company_name} onChange={update} label="Company / Fabricator Name"/><Input name="mobile" value={form.mobile} onChange={update} label="Mobile Number"/><Input name="workshop_address" value={form.workshop_address} onChange={update} label="Workshop Address"/><Input name="email" type="email" value={form.email} onChange={update} label="Email"/><Input name="password" type="password" value={form.password} onChange={update} label="Password"/><button className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">Submit Registration</button><button type="button" onClick={()=>setView('login')} className="w-full py-2 text-sm font-bold text-slate-500">Back to login</button></form>}</div></div></div>;
}
function Input({ label, ...props }) { return <label className="block"><span className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</span><input required {...props} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-slate-50"/></label>; }

function Fabricator({ logout, profile, items, claim, setClaim, submitClaim, mySubmissions, redeemPoints, setRedeemPoints, submitRedemption, myRedemptions, message }) {
  const item = items.find(i => i.id === claim.item_id);
  const pendingPoints = mySubmissions.filter(s=>s.status==='pending').reduce((a,s)=>a+s.points_earned,0);
  return <Shell title="FabriRewards" subtitle={profile.company_name} onLogout={logout}><main className="max-w-5xl mx-auto p-6 space-y-8">{message && <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-900 text-sm font-bold p-3 rounded">{message}</div>}<div className="grid md:grid-cols-3 gap-6"><div className="md:col-span-2 bg-gradient-to-br from-blue-700 to-indigo-900 rounded-2xl p-6 text-white"><Trophy className="w-12 h-12 text-amber-300 mb-3"/><p className="text-blue-100 text-xs font-bold uppercase">Approved incentive balance</p><h2 className="text-5xl font-black text-amber-300">{profile.total_points?.toLocaleString()} <span className="text-lg">pts</span></h2></div><div className="bg-white rounded-2xl border p-6"><Clock className="w-7 h-7 text-amber-500 mb-3"/><p className="text-xs font-bold text-slate-400 uppercase">Awaiting verification</p><h3 className="text-3xl font-black">{pendingPoints.toLocaleString()} pts</h3></div></div><div className="grid lg:grid-cols-5 gap-8"><section className="lg:col-span-2 bg-white rounded-2xl border p-6"><h3 className="font-black text-lg flex gap-2 mb-5"><PlusCircle className="text-blue-600"/> Submit Claim</h3><form onSubmit={submitClaim} className="space-y-5"><label className="block"><span className="text-xs font-bold text-slate-500 uppercase">Item</span><select value={claim.item_id} onChange={e=>setClaim({...claim,item_id:e.target.value, quantity:''})} className="w-full mt-1 px-4 py-3 border rounded-xl bg-slate-50"><option value="">Select item</option>{items.filter(i=>i.active!==false).map(i=><option key={i.id} value={i.id}>{i.name} ({i.points_per_unit} pts/{i.unit})</option>)}</select></label>{item && <Input label={`Quantity (${item.unit})`} name="quantity" type="number" min="1" value={claim.quantity} onChange={e=>setClaim({...claim,quantity:e.target.value})}/>} {item && claim.quantity>0 && <div className="bg-blue-50 p-4 rounded-xl text-sm font-bold text-blue-800">Calculated: {claim.quantity} × {item.points_per_unit} = {Number(claim.quantity)*item.points_per_unit} pts</div>}<button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold">Submit for Approval</button></form><div className="mt-6 border-t pt-6"><h3 className="font-black text-lg flex gap-2 mb-4"><WalletCards className="text-green-600"/> Redeem Points</h3><form onSubmit={submitRedemption} className="space-y-3"><Input label="Points to Redeem" name="redeem" type="number" min="1" max={profile.total_points || 0} value={redeemPoints} onChange={e=>setRedeemPoints(e.target.value)}/><button className="w-full py-3 bg-green-600 text-white rounded-xl font-bold">Redeem</button></form></div></section><section className="lg:col-span-3 bg-white rounded-2xl border p-6"><h3 className="font-black text-lg flex gap-2 mb-5"><History/> My Ledger</h3><Ledger submissions={mySubmissions}/><h3 className="font-black text-lg flex gap-2 mt-8 mb-5"><WalletCards/> My Redemption Requests</h3><RedemptionList redemptions={myRedemptions}/></section></div></main></Shell>;
}
function Ledger({ submissions }) { return <div className="space-y-3">{submissions.length===0 ? <p className="text-slate-400 text-sm p-8 text-center">No submissions yet.</p> : submissions.map(s=><div key={s.id} className="p-4 bg-slate-50 rounded-xl border flex justify-between gap-3"><div><p className="font-bold text-sm">{s.item_name}</p><p className="text-xs text-slate-500">{new Date(s.created_at).toLocaleDateString()} • {s.quantity} {s.unit}</p><div className="pt-2"><StatusBadge status={s.status}/></div></div><p className="font-black text-indigo-700">+{s.points_earned} pts</p></div>)}</div>; }
function RedemptionList({ redemptions }) { return <div className="space-y-3">{redemptions.length===0 ? <p className="text-slate-400 text-sm p-8 text-center">No redemption requests yet.</p> : redemptions.map(r=><div key={r.id} className="p-4 bg-slate-50 rounded-xl border flex justify-between"><div><p className="font-bold text-sm">{r.points_requested} points</p><p className="text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString()}</p></div><StatusBadge status={r.status}/></div>)}</div>; }

function Admin(props) {
  const { logout, adminTab, setAdminTab, pendingClaims, pendingProfiles, pendingRedemptions, profiles, items, submissions, leaderboard, reviewClaim, reviewRedemption, updateProfileStatus, newItem, setNewItem, addItem, deleteItem, segments, categories, rateItems, sizes, loadAll, message } = props;
  return <Shell title="Admin Management Panel" subtitle="FabriRewards operations" icon={Users} onLogout={logout}><main className="max-w-6xl mx-auto p-6 space-y-6">{message && <div className="bg-red-50 border-l-4 border-red-400 text-red-800 text-sm font-bold p-3 rounded">{message}</div>}<div className="flex flex-wrap gap-2">{[['claims','Claims '+pendingClaims.length],['redeem','Redeem '+pendingRedemptions.length],['users','Profiles '+pendingProfiles.length],['items','Reward Items'],['rates','Daily Rate Update'],['final','Final Rate'],['history','History']].map(([id,label])=><button key={id} onClick={()=>setAdminTab(id)} className={`px-4 py-2 rounded-xl text-sm font-bold ${adminTab===id?'bg-indigo-600 text-white':'bg-white border text-slate-600'}`}>{label}</button>)}</div>{adminTab==='claims' && <Panel title="Incentive Claims Pipeline" icon={Clock}>{pendingClaims.map(s=><AdminClaim key={s.id} s={s} fab={profiles.find(p=>p.id===s.fabricator_id)} onReview={reviewClaim}/>)}</Panel>}{adminTab==='redeem' && <Panel title="Redemption Requests" icon={WalletCards}>{pendingRedemptions.map(r=><div key={r.id} className="p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h4 className="font-black">{profiles.find(p=>p.id===r.fabricator_id)?.company_name || 'Unknown'}</h4><p className="text-xs text-slate-500">Requested: {r.points_requested} points</p></div><div className="flex gap-2"><button onClick={()=>reviewRedemption(r.id,'approved')} className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold"><Check className="inline w-4 h-4"/> Approve</button><button onClick={()=>reviewRedemption(r.id,'rejected')} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold"><X className="inline w-4 h-4"/> Reject</button></div></div>)}</Panel>}{adminTab==='users' && <Panel title="Pending Fabricator Profiles" icon={UserCheck}>{pendingProfiles.map(p=><div key={p.id} className="p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h4 className="font-black">{p.company_name}</h4><p className="text-xs text-slate-500 flex gap-1"><Phone className="w-3 h-3"/> {p.mobile}</p><p className="text-xs text-slate-500 flex gap-1"><MapPin className="w-3 h-3"/> {p.workshop_address}</p></div><div className="flex gap-2"><button onClick={()=>updateProfileStatus(p.id,'approved')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold"><Check className="inline w-4 h-4"/> Approve</button><button onClick={()=>updateProfileStatus(p.id,'rejected')} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold"><X className="inline w-4 h-4"/> Reject</button></div></div>)}</Panel>}{adminTab==='items' && <ItemsPanel items={items} newItem={newItem} setNewItem={setNewItem} addItem={addItem} deleteItem={deleteItem}/>} {adminTab==='rates' && <RateMaster {...{segments,categories,rateItems,sizes,loadAll}}/>}{adminTab==='final' && <FinalRateCalculator {...{segments,categories,rateItems,sizes}}/>}{adminTab==='history' && <Panel title="Processed Claims History" icon={ClipboardList}><Ledger submissions={submissions.filter(s=>s.status!=='pending')}/></Panel>}<Panel title="Leaderboard" icon={Trophy}><div className="grid md:grid-cols-3 gap-3 p-4">{leaderboard.map((p,i)=><div key={p.id} className="bg-slate-50 rounded-xl p-4 flex justify-between"><b>#{i+1} {p.company_name}</b><span className="text-indigo-700 font-black">{p.total_points} pts</span></div>)}</div></Panel></main></Shell>;
}
function AdminClaim({ s, fab, onReview }) { return <div className="p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-4"><div><p className="text-xs font-bold text-blue-800 bg-blue-100 inline-block px-2 py-1 rounded">{fab?.company_name || 'Unknown Fabricator'}</p><h4 className="font-black mt-2">{s.item_name}</h4><p className="text-xs text-slate-500">Quantity: {s.quantity} {s.unit} • Worth +{s.points_earned} pts</p></div><div className="flex gap-2"><button onClick={()=>onReview(s.id,'approved')} className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold"><Check className="inline w-4 h-4"/> Approve</button><button onClick={()=>onReview(s.id,'rejected')} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold"><X className="inline w-4 h-4"/> Decline</button></div></div>; }
function Panel({ title, icon: Icon, children }) { return <section className="bg-white rounded-2xl border overflow-hidden"><div className="p-4 bg-slate-50 border-b flex gap-2 items-center"><Icon className="w-5 h-5 text-indigo-600"/><h3 className="font-black">{title}</h3></div>{children}</section>; }
function ItemsPanel({ items, newItem, setNewItem, addItem, deleteItem }) { return <div className="grid lg:grid-cols-5 gap-6"><section className="lg:col-span-2 bg-white rounded-2xl border p-6"><h3 className="font-black mb-4 flex gap-2"><PlusCircle/> Add Reward Item</h3><form onSubmit={addItem} className="space-y-4"><Input label="Item Name" name="name" value={newItem.name} onChange={e=>setNewItem({...newItem,name:e.target.value})}/><label className="block"><span className="text-xs font-bold text-slate-500 uppercase">Unit</span><select value={newItem.unit} onChange={e=>setNewItem({...newItem,unit:e.target.value})} className="w-full px-4 py-3 border rounded-xl bg-slate-50">{units.map(u=><option key={u}>{u}</option>)}</select></label><Input label="Points per Unit" name="points_per_unit" type="number" min="1" value={newItem.points_per_unit} onChange={e=>setNewItem({...newItem,points_per_unit:e.target.value})}/><button className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold">Add to Fabricator Dropdown</button></form></section><section className="lg:col-span-3 bg-white rounded-2xl border p-6"><h3 className="font-black mb-4 flex gap-2"><Layers/> Configured Reward Items</h3><div className="space-y-3">{items.map(i=><div key={i.id} className="p-4 bg-slate-50 border rounded-xl flex justify-between items-center"><div><b>{i.name}</b><div className="flex gap-2 pt-2"><UnitBadge unit={i.unit}/><span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">{i.points_per_unit} pts/{i.unit}</span></div></div><button onClick={()=>deleteItem(i.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-full"><Trash2 className="w-4 h-4"/></button></div>)}</div></section></div>; }

function RateMaster({ segments, categories, rateItems, sizes, loadAll }) {
  const [form, setForm] = useState({ segment:'', category:'', daily_rate_per_kg:'', freight_per_kg:'', gst_percent:'18', item:'', size:'', fixed_difference_per_kg:'' });
  const selectedCategory = categories.find(c=>c.id===form.category);
  async function addSegment(e){ e.preventDefault(); if(!form.segment) return; await supabase.from('segments').insert({name:form.segment.trim().toUpperCase()}); setForm({...form, segment:''}); await loadAll(); }
  async function addCategory(e){ e.preventDefault(); await supabase.from('rate_categories').insert({segment_id:form.segment, name:form.category.trim(), daily_rate_per_kg:n(form.daily_rate_per_kg), freight_per_kg:n(form.freight_per_kg), gst_percent:n(form.gst_percent||18)}); setForm({...form, category:'', daily_rate_per_kg:'', freight_per_kg:'', gst_percent:'18'}); await loadAll(); }
  async function updateCategory(e){ e.preventDefault(); if(!selectedCategory) return; await supabase.from('rate_categories').update({daily_rate_per_kg:n(form.daily_rate_per_kg || selectedCategory.daily_rate_per_kg), freight_per_kg:n(form.freight_per_kg || selectedCategory.freight_per_kg), gst_percent:n(form.gst_percent || selectedCategory.gst_percent)}).eq('id', selectedCategory.id); await loadAll(); }
  async function addRateItem(e){ e.preventDefault(); if(!form.category || !form.item) return; await supabase.from('rate_items').insert({category_id:form.category, name:form.item.trim()}); setForm({...form,item:''}); await loadAll(); }
  async function addSize(e){ e.preventDefault(); if(!form.item || !form.size) return; await supabase.from('rate_item_sizes').insert({item_id:form.item, size_label:form.size.trim(), fixed_difference_per_kg:n(form.fixed_difference_per_kg)}); setForm({...form,size:'', fixed_difference_per_kg:''}); await loadAll(); }
  const categoryItems = rateItems.filter(i=>i.category_id===form.category);
  return <div className="grid lg:grid-cols-2 gap-6"><section className="bg-white border rounded-2xl p-6"><h3 className="font-black flex gap-2 mb-4"><RefreshCw/> Daily Rate Update - Per KG</h3><form onSubmit={addSegment} className="flex gap-2 mb-6"><input value={form.segment} onChange={e=>setForm({...form,segment:e.target.value})} placeholder="Add segment e.g. STRUCTURAL" className="flex-1 px-4 py-3 border rounded-xl bg-slate-50"/><button className="px-4 py-3 bg-slate-900 text-white rounded-xl font-bold">Add Segment</button></form><form onSubmit={addCategory} className="space-y-3 mb-6"><h4 className="font-bold">Add Category</h4><select value={form.segment} onChange={e=>setForm({...form,segment:e.target.value})} className="w-full px-4 py-3 border rounded-xl bg-slate-50"><option value="">Select segment</option>{segments.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><Input label="Category Name e.g. Pipe / Angle / Flat / TMT" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/><div className="grid grid-cols-3 gap-2"><Input label="Daily Rate / KG" type="number" step="0.01" value={form.daily_rate_per_kg} onChange={e=>setForm({...form,daily_rate_per_kg:e.target.value})}/><Input label="Freight / KG" type="number" step="0.01" value={form.freight_per_kg} onChange={e=>setForm({...form,freight_per_kg:e.target.value})}/><Input label="GST %" type="number" step="0.01" value={form.gst_percent} onChange={e=>setForm({...form,gst_percent:e.target.value})}/></div><button className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">Add Category</button></form><form onSubmit={addRateItem} className="space-y-3 mb-6"><h4 className="font-bold">Add Item under Category</h4><select value={form.category} onChange={e=>setForm({...form,category:e.target.value,item:''})} className="w-full px-4 py-3 border rounded-xl bg-slate-50"><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><Input label="Item Name e.g. MS Round Pipe" value={form.item} onChange={e=>setForm({...form,item:e.target.value})}/><button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold">Add Item</button></form><form onSubmit={addSize} className="space-y-3"><h4 className="font-bold">Add Size / Fixed Difference</h4><select value={form.item} onChange={e=>setForm({...form,item:e.target.value})} className="w-full px-4 py-3 border rounded-xl bg-slate-50"><option value="">Select item</option>{categoryItems.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select><div className="grid grid-cols-2 gap-2"><Input label="Size" value={form.size} onChange={e=>setForm({...form,size:e.target.value})}/><Input label="Fixed Difference / KG" type="number" step="0.01" value={form.fixed_difference_per_kg} onChange={e=>setForm({...form,fixed_difference_per_kg:e.target.value})}/></div><button className="w-full py-3 bg-green-600 text-white rounded-xl font-bold">Add Size</button></form></section><section className="bg-white border rounded-2xl p-6"><h3 className="font-black mb-4">Current Daily Rate Master</h3><div className="space-y-3 max-h-[720px] overflow-auto">{categories.map(c=><div key={c.id} className="border rounded-xl p-4 bg-slate-50"><div className="flex justify-between gap-3"><div><b>{segments.find(s=>s.id===c.segment_id)?.name || 'No Segment'} / {c.name}</b><p className="text-xs text-slate-500">Daily ₹{money(c.daily_rate_per_kg)}/kg + Freight ₹{money(c.freight_per_kg)}/kg + GST {c.gst_percent}%</p></div></div><ul className="mt-3 text-xs space-y-1">{rateItems.filter(i=>i.category_id===c.id).map(i=><li key={i.id}><b>{i.name}</b>: {sizes.filter(s=>s.item_id===i.id).map(s=>`${s.size_label} (+₹${money(s.fixed_difference_per_kg)}/kg)`).join(', ') || 'No sizes yet'}</li>)}</ul></div>)}</div></section></div>;
}

function FinalRateCalculator({ segments, categories, rateItems, sizes }) {
  const [selection, setSelection] = useState({ category:'', item:'', size:'', quantity:'' });
  const [lines, setLines] = useState([]);
  const selectedCategory = categories.find(c=>c.id===selection.category);
  const selectedItem = rateItems.find(i=>i.id===selection.item);
  const selectedSize = sizes.find(s=>s.id===selection.size);
  const itemOptions = rateItems.filter(i=>i.category_id===selection.category);
  const sizeOptions = sizes.filter(s=>s.item_id===selection.item);
  function calcLine(){
    if(!selectedCategory || !selectedItem || !selectedSize || !Number(selection.quantity)) return;
    const base = n(selectedCategory.daily_rate_per_kg) + n(selectedSize.fixed_difference_per_kg) + n(selectedCategory.freight_per_kg);
    const gst = base * (n(selectedCategory.gst_percent) / 100);
    const finalPerKg = base + gst;
    const total = finalPerKg * n(selection.quantity);
    setLines([{ id: Date.now(), category:selectedCategory.name, item:selectedItem.name, size:selectedSize.size_label, qty:n(selection.quantity), base, gst, finalPerKg, total }, ...lines]);
    setSelection({...selection, quantity:''});
  }
  return <section className="bg-white border rounded-2xl p-6"><h3 className="font-black flex gap-2 mb-5"><Calculator/> Final Rate Calculator</h3><div className="grid md:grid-cols-4 gap-3"><select value={selection.category} onChange={e=>setSelection({category:e.target.value,item:'',size:'',quantity:''})} className="px-4 py-3 border rounded-xl bg-slate-50"><option value="">Select item/category</option>{categories.map(c=><option key={c.id} value={c.id}>{segments.find(s=>s.id===c.segment_id)?.name} / {c.name}</option>)}</select><select value={selection.item} onChange={e=>setSelection({...selection,item:e.target.value,size:''})} className="px-4 py-3 border rounded-xl bg-slate-50"><option value="">Select listed item</option>{itemOptions.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select><select value={selection.size} onChange={e=>setSelection({...selection,size:e.target.value})} className="px-4 py-3 border rounded-xl bg-slate-50"><option value="">Select size</option>{sizeOptions.map(s=><option key={s.id} value={s.id}>{s.size_label}</option>)}</select><input value={selection.quantity} onChange={e=>setSelection({...selection,quantity:e.target.value})} type="number" step="0.01" placeholder="Quantity in kg" className="px-4 py-3 border rounded-xl bg-slate-50"/></div><button onClick={calcLine} className="mt-4 px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold">Add</button>{selectedCategory && selectedSize && <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900"><b>Formula:</b> Daily Rate ₹{money(selectedCategory.daily_rate_per_kg)}/kg + Fixed Difference ₹{money(selectedSize.fixed_difference_per_kg)}/kg + Freight ₹{money(selectedCategory.freight_per_kg)}/kg + GST {selectedCategory.gst_percent}%</div>}<div className="mt-6 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left bg-slate-50"><th className="p-3">Item</th><th className="p-3">Size</th><th className="p-3 text-right">Qty kg</th><th className="p-3 text-right">Rate/kg</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{lines.map(l=><tr key={l.id} className="border-b"><td className="p-3 font-bold">{l.category} - {l.item}</td><td className="p-3">{l.size}</td><td className="p-3 text-right">{money(l.qty)}</td><td className="p-3 text-right">₹{money(l.finalPerKg)}</td><td className="p-3 text-right font-black text-indigo-700">₹{money(l.total)}</td></tr>)}{lines.length===0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400">No final rate lines added yet.</td></tr>}</tbody></table></div></section>;
}
