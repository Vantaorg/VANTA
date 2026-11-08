'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, ChevronLeft, ChevronRight, Plus, Radio, Music, Gamepad2, Palette, BookOpen, Trophy, Monitor, Heart, MessageCircle, Trash2, Edit3, X, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_BASE_URL, authHeaders } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CATEGORIES: Record<string, any> = {
  gaming: Gamepad2, music: Music, creative: Palette, education: BookOpen,
  sports: Trophy, tech: Monitor, lifestyle: Heart, chatting: MessageCircle,
};
const COLORS: Record<string, string> = {
  gaming: 'text-violet-300 bg-violet-500/10', music: 'text-pink-300 bg-pink-500/10',
  creative: 'text-[#d6a83f] bg-[#d6a83f]/10', education: 'text-emerald-300 bg-emerald-500/10',
  sports: 'text-amber-300 bg-amber-500/10', tech: 'text-blue-300 bg-blue-500/10',
  lifestyle: 'text-[#d6a83f] bg-[#d6a83f]/10', chatting: 'text-white/60 bg-white/5',
};
type ScheduledStream = {
  id: string; title: string; description?: string | null; categoryName: string | null;
  scheduledAt: string; duration: number;
};
const durationOptions = [
  { label: '30 min', value: 1800 }, { label: '1 hour', value: 3600 },
  { label: '1.5 hours', value: 5400 }, { label: '2 hours', value: 7200 },
  { label: '3 hours', value: 10800 }, { label: '4 hours', value: 14400 },
];
const localDateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const timeLabel = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dateLabel = (value: string) => new Date(value).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

export default function SchedulePage() {
  const [streams, setStreams] = useState<ScheduledStream[]>([]);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ScheduledStream | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => localDateKey(new Date(Date.now() + 86400000)));
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(3600);
  const [category, setCategory] = useState('chatting');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadStreams = useCallback(async () => {
    const token = localStorage.getItem('vanta_token') || localStorage.getItem('token');
    if (!token) { setError('Please sign in again to manage your scheduled streams.'); setLoading(false); return; }
    try {
      setError('');
      const response = await fetch(`${API_BASE_URL}/api/live/scheduled`, { headers: authHeaders(token), cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not load scheduled streams');
      setStreams(Array.isArray(payload.streams) ? payload.streams : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load scheduled streams');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadStreams(); }, [loadStreams]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selectedStreams = useMemo(() => streams.filter(s => localDateKey(new Date(s.scheduledAt)) === selectedDate), [streams, selectedDate]);
  const upcoming = useMemo(() => streams.filter(s => new Date(s.scheduledAt).getTime() > Date.now()).sort((a,b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)), [streams]);
  const totalHours = streams.reduce((sum, stream) => sum + stream.duration, 0) / 3600;

  const openCreate = () => {
    setEditing(null); setTitle(''); setDescription(''); setDate(selectedDate > localDateKey(new Date()) ? selectedDate : localDateKey(new Date(Date.now() + 86400000)));
    setTime('18:00'); setDuration(3600); setCategory('chatting'); setError(''); setShowModal(true);
  };
  const openEdit = (stream: ScheduledStream) => {
    const when = new Date(stream.scheduledAt);
    setEditing(stream); setTitle(stream.title); setDescription(stream.description || '');
    setDate(localDateKey(when)); setTime(`${String(when.getHours()).padStart(2,'0')}:${String(when.getMinutes()).padStart(2,'0')}`);
    setDuration(stream.duration); setCategory(stream.categoryName || 'chatting'); setError(''); setShowModal(true);
  };
  const saveStream = async () => {
    const token = localStorage.getItem('vanta_token') || localStorage.getItem('token');
    if (!token) { setError('Please sign in again.'); return; }
    if (!title.trim()) { setError('Enter a stream title.'); return; }
    const scheduledAt = new Date(`${date}T${time}`);
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) { setError('Choose a future date and time.'); return; }
    setSaving(true); setError('');
    try {
      const response = await fetch(editing ? `${API_BASE_URL}/api/live/${editing.id}/schedule` : `${API_BASE_URL}/api/live/scheduled`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description, category, scheduledAt: scheduledAt.toISOString(), duration }),
      });
      const payload = response.status === 204 ? {} : await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not save scheduled stream');
      setShowModal(false); await loadStreams(); setSelectedDate(localDateKey(scheduledAt));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save scheduled stream'); }
    finally { setSaving(false); }
  };
  const deleteStream = async (stream: ScheduledStream) => {
    const token = localStorage.getItem('vanta_token') || localStorage.getItem('token');
    if (!token || !window.confirm(`Delete "${stream.title}" from your schedule?`)) return;
    setBusyId(stream.id);
    try {
      const response = await fetch(`${API_BASE_URL}/api/live/${stream.id}/schedule`, { method: 'DELETE', headers: authHeaders(token) });
      if (!response.ok) { const payload = await response.json(); throw new Error(payload.error || 'Could not delete stream'); }
      setStreams(prev => prev.filter(item => item.id !== stream.id));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete stream'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="w-full pb-24">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <PageHeader title="Schedule" back="/profile" actions={
          <button onClick={openCreate} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#F2C75C] px-3 text-xs font-semibold text-black hover:bg-[#d6a83f]"><Plus size={15}/> Schedule Stream</button>
        }/>
      </motion.div>
      {error && !showModal && <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-300"><AlertCircle size={15}/>{error}<button className="ml-auto" onClick={()=>setError('')}><X size={14}/></button></div>}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-lg bg-[#27303b] border border-white/[0.06] p-3"><p className="text-xl font-bold text-white">{upcoming.length}</p><p className="text-[10px] text-white/40 mt-0.5">Upcoming</p></div>
        <div className="rounded-lg bg-[#27303b] border border-white/[0.06] p-3"><p className="text-xl font-bold text-white">{streams.length}</p><p className="text-[10px] text-white/40 mt-0.5">Scheduled</p></div>
        <div className="rounded-lg bg-[#27303b] border border-white/[0.06] p-3"><p className="text-xl font-bold text-white">{totalHours.toFixed(1)}h</p><p className="text-[10px] text-white/40 mt-0.5">Planned Hours</p></div>
        <div className="rounded-lg bg-[#27303b] border border-white/[0.06] p-3"><p className="text-xl font-bold text-white">{streams.filter(s => localDateKey(new Date(s.scheduledAt)) === localDateKey(new Date())).length}</p><p className="text-[10px] text-white/40 mt-0.5">Today</p></div>
      </div>
      <div className="rounded-lg bg-[#27303b] border border-white/[0.06] p-3.5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <button aria-label="Previous month" onClick={()=>setCurrentDate(new Date(year,month-1,1))} className="p-1.5 rounded-lg text-white/50 hover:text-white"><ChevronLeft size={17}/></button>
          <h3 className="text-sm font-semibold text-white">{MONTHS[month]} {year}</h3>
          <button aria-label="Next month" onClick={()=>setCurrentDate(new Date(year,month+1,1))} className="p-1.5 rounded-lg text-white/50 hover:text-white"><ChevronRight size={17}/></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">{DAYS.map(day=><div key={day} className="text-center text-[9px] text-white/30 py-1">{day}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({length:firstDay},(_,i)=><div key={`blank-${i}`}/>)}
          {Array.from({length:daysInMonth},(_,i)=>{
            const day=i+1, key=localDateKey(new Date(year,month,day)), today=key===localDateKey(new Date()), selected=key===selectedDate;
            const hasStream=streams.some(s=>localDateKey(new Date(s.scheduledAt))===key);
            return <button key={key} onClick={()=>setSelectedDate(key)} aria-pressed={selected} className={cn('relative aspect-square rounded-lg text-xs font-medium',selected?'bg-[#c9a227] text-[#17130a]':today?'border border-white/20 text-white':'text-white/55 hover:bg-white/5')}>{day}{hasStream&&!selected&&<span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[#d6a83f]"/>}</button>;
          })}
        </div>
      </div>
      <div className="rounded-lg bg-[#27303b] border border-white/[0.06] p-3.5">
        <h3 className="text-sm font-semibold text-white mb-3">{selectedDate===localDateKey(new Date())?"Today's Streams":`Streams on ${selectedDate}`}</h3>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-white/40"/></div> :
          selectedStreams.length ? <div className="space-y-2">{selectedStreams.map(stream=>{
            const categoryKey=stream.categoryName || 'chatting', Icon=CATEGORIES[categoryKey] || Radio;
            return <div key={stream.id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-2.5">
              <div className={cn('h-9 w-9 shrink-0 rounded-lg flex items-center justify-center',COLORS[categoryKey] || 'bg-white/5 text-white/60')}><Icon size={16}/></div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{stream.title}</p><p className="mt-0.5 text-[10px] text-white/40"><Clock size={10} className="inline mr-1"/>{timeLabel(stream.scheduledAt)} · {Math.round(stream.duration/60)} min · {categoryKey}</p></div>
              <button aria-label="Edit scheduled stream" onClick={()=>openEdit(stream)} className="p-2 text-white/40 hover:text-white"><Edit3 size={14}/></button>
              <button aria-label="Delete scheduled stream" disabled={busyId===stream.id} onClick={()=>void deleteStream(stream)} className="p-2 text-white/40 hover:text-red-400 disabled:opacity-40">{busyId===stream.id?<Loader2 size={14} className="animate-spin"/>:<Trash2 size={14}/>}</button>
            </div>;
          })}</div> : <div className="py-9 text-center"><Calendar size={28} className="mx-auto mb-2 text-white/15"/><p className="text-sm text-white/40">No streams scheduled for this day</p><button onClick={openCreate} className="mt-3 text-xs text-[#d6a83f] hover:underline">Schedule a stream</button></div>}
      </div>
      <div className="rounded-lg bg-[#27303b] border border-white/[0.06] p-3.5 mt-4">
        <h3 className="text-sm font-semibold text-white mb-3">Upcoming Streams</h3>
        {upcoming.length ? <div className="space-y-1">{upcoming.slice(0,5).map(stream=><button key={stream.id} onClick={()=>setSelectedDate(localDateKey(new Date(stream.scheduledAt)))} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-white/[0.03]"><div className="w-10 shrink-0 text-center"><span className="block text-[9px] text-white/40">{dateLabel(stream.scheduledAt).split(' ')[0]}</span><span className="text-sm font-semibold text-white">{new Date(stream.scheduledAt).getDate()}</span></div><div className="min-w-0 flex-1"><p className="truncate text-xs text-white">{stream.title}</p><p className="text-[10px] text-white/40">{dateLabel(stream.scheduledAt)} · {timeLabel(stream.scheduledAt)}</p></div></button>)}</div> : <p className="py-4 text-center text-xs text-white/35">No upcoming streams yet</p>}
      </div>
      <AnimatePresence>
        {showModal && <>
          <motion.button aria-label="Close schedule dialog" className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setShowModal(false)}/>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="schedule-dialog-title" initial={{opacity:0,y:20,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20,scale:.98}} className="fixed inset-x-3 top-[max(12px,env(safe-area-inset-top))] bottom-[max(12px,env(safe-area-inset-bottom))] z-[101] overflow-y-auto rounded-xl border border-white/10 bg-[#1F2630] p-4 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2">
            <div className="mb-5 flex items-center justify-between"><h2 id="schedule-dialog-title" className="text-lg font-semibold text-white">{editing?'Edit Scheduled Stream':'Schedule Stream'}</h2><button onClick={()=>setShowModal(false)} className="p-2 text-white/50 hover:text-white"><X size={18}/></button></div>
            {error && <p role="alert" className="mb-3 text-xs text-red-300">{error}</p>}
            <div className="space-y-4">
              <label className="block text-xs text-white/60">Stream title<input maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Enter stream title" className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none focus:border-[#d6a83f]/50"/></label>
              <label className="block text-xs text-white/60">Description (optional)<textarea maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)} rows={3} placeholder="What will this stream be about?" className="mt-1.5 w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none focus:border-[#d6a83f]/50"/></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-white/60">Date<input type="date" min={localDateKey(new Date())} value={date} onChange={e=>setDate(e.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white [color-scheme:dark]"/></label>
                <label className="block text-xs text-white/60">Time<input type="time" value={time} onChange={e=>setTime(e.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white [color-scheme:dark]"/></label>
              </div>
              <label className="block text-xs text-white/60">Duration<select value={duration} onChange={e=>setDuration(Number(e.target.value))} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#27303b] px-3 py-3 text-sm text-white">{durationOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <div><p className="mb-2 text-xs text-white/60">Category</p><div className="grid grid-cols-4 gap-2">{Object.entries(CATEGORIES).map(([key,Icon])=><button type="button" key={key} aria-pressed={category===key} onClick={()=>setCategory(key)} className={cn('flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] capitalize',category===key?'border-[#d6a83f]/50 bg-[#d6a83f]/10 text-[#e7c56c]':'border-white/[0.06] bg-white/[0.02] text-white/45')}><Icon size={15}/>{key}</button>)}</div></div>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-white/[0.06] pt-4"><button onClick={()=>setShowModal(false)} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/65">Cancel</button><button disabled={saving} onClick={()=>void saveStream()} className="inline-flex items-center gap-2 rounded-lg bg-[#c9a227] px-4 py-2.5 text-sm font-semibold text-[#17130a] disabled:opacity-50">{saving&&<Loader2 size={14} className="animate-spin"/>}{editing?'Save Changes':'Schedule'}</button></div>
          </motion.div>
        </>}
      </AnimatePresence>
    </div>
  );
}
