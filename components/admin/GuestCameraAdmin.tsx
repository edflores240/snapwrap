'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import QRCodeSVG from 'react-qr-code';
import QRCode from 'qrcode';
import {
    Camera, Check, Copy, EyeOff, ExternalLink, Heart, Loader2, Lock, Printer, QrCode, RefreshCw,
    Save, Trash2, Users, X, Sparkles, MonitorPlay, Images, Settings2, ShieldCheck, Unlock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import PrintDesigner from '@/components/PrintDesigner';
import {
    WEDDING_PROMPTS, fromLocalInput, guestUrl, readGuestConfig, toLocalInput,
    type GuestConfig, type GuestPhotoStatus,
} from '@/lib/guest-camera';

interface AdminEvent {
    id: string;
    name: string;
    slug: string;
    config: Record<string, unknown> | null;
}

interface Props {
    event: AdminEvent;
    accent: string;
    printTemplates: React.ComponentProps<typeof PrintDesigner>['templates'];
    onConfigSaved: (config: Record<string, unknown>) => void;
}

interface GuestRow {
    id: string;
    name: string | null;
    table_label: string | null;
    quota_override: number | null;
    blocked: boolean;
    created_at: string;
    last_seen_at: string;
}

interface PhotoRow {
    id: string;
    image_url: string;
    thumb_url: string | null;
    storage_path: string;
    caption: string | null;
    prompt: string | null;
    guest_status: GuestPhotoStatus;
    guest_session_id: string | null;
    like_count: number;
    created_at: string;
}

type SubTab = 'setup' | 'photos' | 'guests' | 'share';
type StatusFilter = 'all' | GuestPhotoStatus;

const ESTIMATED_MB_PER_PHOTO = 0.45;

const label = 'text-[9px] font-black text-neutral-400 uppercase tracking-[0.2em]';
const input = 'w-full bg-white border border-[#ECE8DF] rounded-xl px-4 py-3 text-sm font-medium text-[#2A2724] outline-none focus:border-[#2A2724] transition-colors';

function Toggle({ on, onChange, accent, title, hint }: { on: boolean; onChange: (v: boolean) => void; accent: string; title: string; hint?: string }) {
    return (
        <button type="button" onClick={() => onChange(!on)} className="w-full flex items-center justify-between gap-4 text-left py-3">
            <span>
                <span className="block text-sm font-bold text-[#2A2724]">{title}</span>
                {hint && <span className="block text-xs text-neutral-400 mt-0.5">{hint}</span>}
            </span>
            <span className="shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors" style={{ background: on ? accent : '#D9D4CA' }}>
                <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
            </span>
        </button>
    );
}

export default function GuestCameraAdmin({ event, accent, printTemplates, onConfigSaved }: Props) {
    const [tab, setTab] = useState<SubTab>('setup');
    const [cfg, setCfg] = useState<GuestConfig>(() => readGuestConfig((event.config as { guestCamera?: unknown } | null)?.guestCamera));
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [photos, setPhotos] = useState<PhotoRow[]>([]);
    const [guests, setGuests] = useState<GuestRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [needsMigration, setNeedsMigration] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
    const [selected, setSelected] = useState<string[]>([]);
    const [printing, setPrinting] = useState(false);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [origin, setOrigin] = useState('');
    const [cardCount, setCardCount] = useState(4);

    useEffect(() => { setOrigin(window.location.origin); }, []);

    const patch = (p: Partial<GuestConfig>) => { setCfg(prev => ({ ...prev, ...p })); setSaved(false); };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [photoRes, guestRes] = await Promise.all([
                supabase
                    .from('photos')
                    .select('id, image_url, thumb_url, storage_path, caption, prompt, guest_status, guest_session_id, like_count, created_at')
                    .eq('event_id', event.id)
                    .not('guest_session_id', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(1000),
                supabase.from('guest_sessions').select('*').eq('event_id', event.id).order('created_at', { ascending: false }),
            ]);
            // 42703 / 42P01 / PGRST205: the guest camera migration hasn't been applied yet
            const missing = [photoRes.error, guestRes.error].find(e => e && ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(e.code));
            setNeedsMigration(!!missing);
            if (photoRes.error && !missing) throw photoRes.error;
            if (guestRes.error && !missing) throw guestRes.error;
            setPhotos((photoRes.data as PhotoRow[]) ?? []);
            setGuests((guestRes.data as GuestRow[]) ?? []);
        } catch (err) {
            console.error('Guest camera admin load failed:', (err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [event.id]);

    useEffect(() => { void load(); }, [load]);

    // Keep the moderation queue fresh while the party is running
    useEffect(() => {
        if (!cfg.enabled || (tab !== 'photos' && tab !== 'guests')) return;
        const t = setInterval(() => void load(), 20000);
        return () => clearInterval(t);
    }, [cfg.enabled, tab, load]);

    const save = async (next: GuestConfig = cfg) => {
        setSaving(true);
        setError(null);
        const config = { ...(event.config || {}), guestCamera: next };
        const { error: err } = await supabase.from('events').update({ config }).eq('id', event.id);
        setSaving(false);
        if (err) { setError(err.message); return false; }
        onConfigSaved(config);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        return true;
    };

    const releaseNow = async () => {
        const next = { ...cfg, revealAt: new Date().toISOString() };
        setCfg(next);
        await save(next);
    };

    // ── Moderation ──
    const stats = useMemo(() => {
        const by = (s: GuestPhotoStatus) => photos.filter(p => p.guest_status === s).length;
        return {
            guests: guests.length,
            photos: photos.length,
            pending: by('pending'),
            approved: by('approved'),
            hidden: by('hidden'),
            hearts: photos.reduce((n, p) => n + (p.like_count || 0), 0),
            mb: Math.round(photos.length * ESTIMATED_MB_PER_PHOTO),
        };
    }, [photos, guests]);

    const guestName = useCallback((id: string | null) => guests.find(g => g.id === id)?.name || 'Guest', [guests]);

    const visible = useMemo(() => photos.filter(p => statusFilter === 'all' || p.guest_status === statusFilter), [photos, statusFilter]);

    const toggleSelect = (id: string) => setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

    const setStatus = async (ids: string[], status: GuestPhotoStatus) => {
        if (ids.length === 0) return;
        setBusy(true);
        const { error: err } = await supabase.from('photos').update({ guest_status: status }).in('id', ids);
        if (err) setError(err.message);
        else setPhotos(prev => prev.map(p => (ids.includes(p.id) ? { ...p, guest_status: status } : p)));
        setSelected([]);
        setBusy(false);
    };

    const removePhotos = async (rows: PhotoRow[]) => {
        if (rows.length === 0) return;
        if (!window.confirm(`Permanently delete ${rows.length} photo${rows.length === 1 ? '' : 's'}? This can't be undone.`)) return;
        setBusy(true);
        const files = rows.flatMap(p => [p.storage_path, p.storage_path.replace(/\/guest\/([^/]+)$/, '/guest/thumbs/$1')]);
        await supabase.storage.from('booth-photos').remove(files).catch(() => undefined);
        const ids = rows.map(r => r.id);
        const { error: err } = await supabase.from('photos').delete().in('id', ids);
        if (err) setError(err.message);
        else setPhotos(prev => prev.filter(p => !ids.includes(p.id)));
        setSelected([]);
        setBusy(false);
    };

    // ── Guests ──
    const updateGuest = async (id: string, patchRow: Partial<GuestRow>) => {
        const { error: err } = await supabase.from('guest_sessions').update(patchRow).eq('id', id);
        if (err) { setError(err.message); return; }
        setGuests(prev => prev.map(g => (g.id === id ? { ...g, ...patchRow } : g)));
    };

    // ── Share ──
    const links = {
        camera: origin ? guestUrl(origin, event.slug) : '',
        album: origin ? guestUrl(origin, event.slug, 'album') : '',
        live: origin ? guestUrl(origin, event.slug, 'live') : '',
    };
    const copy = async (key: string, text: string) => {
        try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1800); } catch { /* clipboard blocked */ }
    };

    const printCards = async () => {
        const svg = await QRCode.toString(links.camera, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
        const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
        const title = esc(cfg.welcomeTitle || event.name);
        const card = `
            <div class="card">
                <div class="eyebrow">Capture the night</div>
                <h1>${title}</h1>
                <div class="qr">${svg}</div>
                <p class="step">Scan to open your camera</p>
                <p class="sub">${cfg.shotsPerGuest} shots each · photos are revealed later</p>
            </div>`;
        const w = window.open('', '_blank');
        if (!w) { setError('Allow pop-ups to print the cards.'); return; }
        w.document.write(`<!doctype html><html><head><title>Table cards</title><style>
            @page { size: A4; margin: 0 }
            * { box-sizing: border-box }
            body { margin: 0; font-family: Georgia, serif; color: #2A2724; }
            .sheet { width: 210mm; height: 297mm; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; page-break-after: always }
            .card { border: 0.2mm dashed #cfc8ba; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 10mm; gap: 4mm }
            .eyebrow { font: 700 2.6mm/1 Helvetica, Arial, sans-serif; letter-spacing: 1.2mm; text-transform: uppercase; color: ${accent} }
            h1 { margin: 0; font-size: 8mm; font-weight: 400; line-height: 1.15 }
            .qr { width: 44mm; height: 44mm; padding: 3mm; border: 0.4mm solid ${accent}; border-radius: 4mm } .qr svg { width: 100%; height: 100% }
            .step { margin: 0; font: 700 3.6mm Helvetica, Arial, sans-serif }
            .sub { margin: 0; font: 3mm Helvetica, Arial, sans-serif; opacity: .6 }
            </style></head><body>${Array.from({ length: Math.ceil(cardCount / 4) }).map(() =>
                `<div class="sheet">${Array.from({ length: 4 }).map(() => card).join('')}</div>`).join('')}
            <script>window.onload = () => setTimeout(() => window.print(), 200)</script></body></html>`);
        w.document.close();
    };

    const selectedRows = photos.filter(p => selected.includes(p.id));
    const printable = (selectedRows.length ? selectedRows : photos.filter(p => p.guest_status === 'approved')).map(p => ({ id: p.id, url: p.image_url }));

    const phaseNow = useMemo(() => {
        const now = Date.now();
        const opens = cfg.opensAt ? new Date(cfg.opensAt).getTime() : null;
        const closes = cfg.closesAt ? new Date(cfg.closesAt).getTime() : null;
        const reveal = cfg.revealAt ? new Date(cfg.revealAt).getTime() : null;
        const camera = !cfg.enabled ? 'Off' : opens && now < opens ? 'Opens later' : closes && now >= closes ? 'Closed' : 'Open';
        const album = !cfg.enabled ? 'Off' : reveal ? (now >= reveal ? 'Revealed' : 'Scheduled') : 'Not released';
        return { camera, album };
    }, [cfg]);

    const subTabs: { id: SubTab; label: string; icon: React.ReactNode; badge?: number }[] = [
        { id: 'setup', label: 'Setup', icon: <Settings2 size={14} /> },
        { id: 'photos', label: 'Photos', icon: <Images size={14} />, badge: stats.pending },
        { id: 'guests', label: 'Guests', icon: <Users size={14} /> },
        { id: 'share', label: 'Share & print', icon: <QrCode size={14} /> },
    ];

    return (
        <div className="space-y-8">
            {needsMigration && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
                    <b>One setup step is missing.</b> Run <code className="px-1.5 py-0.5 bg-amber-100 rounded">supabase/migrations/20260529000000_guest_camera.sql</code> in the Supabase SQL editor, then reload this page. Guests can&apos;t take photos until it&apos;s applied.
                </div>
            )}

            {/* Status strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { l: 'Camera', v: phaseNow.camera },
                    { l: 'Album', v: phaseNow.album },
                    { l: 'Guests', v: String(stats.guests) },
                    { l: 'Photos', v: `${stats.photos}${stats.pending ? ` · ${stats.pending} to review` : ''}` },
                ].map(s => (
                    <div key={s.l} className="rounded-2xl border border-[#ECE8DF] bg-white p-5">
                        <p className={label}>{s.l}</p>
                        <p className="text-xl font-black text-[#2A2724] mt-2">{s.v}</p>
                    </div>
                ))}
            </div>

            {/* Sub tabs */}
            <div className="flex gap-2 flex-wrap">
                {subTabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border transition-colors ${tab === t.id ? 'text-white border-transparent' : 'bg-white border-[#ECE8DF] text-neutral-500 hover:border-[#2A2724]'}`}
                        style={tab === t.id ? { background: accent } : undefined}
                    >
                        {t.icon} {t.label}
                        {!!t.badge && <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px]">{t.badge}</span>}
                    </button>
                ))}
                <button onClick={() => void load()} className="ml-auto p-2.5 rounded-full border border-[#ECE8DF] bg-white text-neutral-500 hover:border-[#2A2724]" title="Refresh">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 flex items-center justify-between">
                    {error}
                    <button onClick={() => setError(null)}><X size={14} /></button>
                </div>
            )}

            {/* ── SETUP ── */}
            {tab === 'setup' && (
                <div className="grid lg:grid-cols-2 gap-8">
                    <div className="rounded-3xl border border-[#ECE8DF] bg-white p-8 space-y-2">
                        <h3 className="text-lg font-black text-[#2A2724] flex items-center gap-2 mb-2"><Camera size={18} /> Guest camera</h3>
                        <div className="divide-y divide-[#F3EFE7]">
                            <Toggle on={cfg.enabled} onChange={v => patch({ enabled: v })} accent={accent} title="Turn on the guest camera" hint="Guests who scan the QR code can take photos from their own phone." />
                            <div className="py-4 space-y-3">
                                <div className="flex items-center justify-between"><span className="text-sm font-bold text-[#2A2724]">Shots per guest</span><span className="text-sm font-black tabular-nums">{cfg.shotsPerGuest}</span></div>
                                <input type="range" min={1} max={50} value={cfg.shotsPerGuest} onChange={e => patch({ shotsPerGuest: +e.target.value })} className="w-full" style={{ accentColor: accent }} />
                                <p className="text-xs text-neutral-400">Deleting a shot gives it back, so guests can retake.</p>
                            </div>
                            <Toggle on={cfg.requireApproval} onChange={v => patch({ requireApproval: v })} accent={accent} title="Approve photos before the album" hint="Photos wait in your review queue. Turn off to show everything at the reveal." />
                            <Toggle on={cfg.askName} onChange={v => patch({ askName: v })} accent={accent} title="Ask for a name" hint="Shown on photos in the album, and lets guests be filtered." />
                            <Toggle on={cfg.askTable} onChange={v => patch({ askTable: v })} accent={accent} title="Ask for a table" />
                            <Toggle on={cfg.captionsEnabled} onChange={v => patch({ captionsEnabled: v })} accent={accent} title="Allow captions" />
                            <Toggle on={cfg.filtersEnabled} onChange={v => patch({ filtersEnabled: v })} accent={accent} title="Film filters" hint="Disposable, vintage, B&W and vivid looks." />
                            <Toggle on={cfg.allowLibrary} onChange={v => patch({ allowLibrary: v })} accent={accent} title="Allow photos from the library" hint="Off keeps the disposable-camera feel: only live shots." />
                            <Toggle on={cfg.slideshowLive} onChange={v => patch({ slideshowLive: v })} accent={accent} title="Live slideshow" hint="Approved photos can appear on a projector before the reveal." />
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="rounded-3xl border border-[#ECE8DF] bg-white p-8 space-y-5">
                            <h3 className="text-lg font-black text-[#2A2724] flex items-center gap-2"><Lock size={18} /> Schedule</h3>
                            {[
                                { k: 'opensAt' as const, t: 'Camera opens', h: 'Leave empty to open as soon as it’s on.' },
                                { k: 'closesAt' as const, t: 'Camera closes', h: 'Leave empty to stay open.' },
                                { k: 'revealAt' as const, t: 'Album reveal', h: 'Until then guests only see their own shots and a countdown.' },
                            ].map(f => (
                                <div key={f.k} className="space-y-2">
                                    <p className={label}>{f.t}</p>
                                    <div className="flex gap-2">
                                        <input type="datetime-local" className={input} value={toLocalInput(cfg[f.k])} onChange={e => patch({ [f.k]: fromLocalInput(e.target.value) })} />
                                        {cfg[f.k] && <button onClick={() => patch({ [f.k]: '' })} className="px-3 rounded-xl border border-[#ECE8DF] text-neutral-400 hover:text-[#2A2724]" title="Clear"><X size={14} /></button>}
                                    </div>
                                    <p className="text-xs text-neutral-400">{f.h}</p>
                                </div>
                            ))}
                            <div className="flex gap-3 pt-2">
                                <button onClick={releaseNow} disabled={saving} className="flex-1 py-3 rounded-xl text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2" style={{ background: accent }}>
                                    <Unlock size={14} /> Release album now
                                </button>
                                <button onClick={() => { const next = { ...cfg, revealAt: '' }; setCfg(next); void save(next); }} disabled={saving} className="flex-1 py-3 rounded-xl border border-[#ECE8DF] text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:border-[#2A2724] flex items-center justify-center gap-2">
                                    <EyeOff size={14} /> Hide album again
                                </button>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-[#ECE8DF] bg-white p-8 space-y-4">
                            <h3 className="text-lg font-black text-[#2A2724] flex items-center gap-2"><Sparkles size={18} /> Photo ideas</h3>
                            <p className="text-xs text-neutral-400">One per line. Guests see a prompt in the camera and can shuffle or skip it. The album can be filtered by idea.</p>
                            <textarea
                                className={`${input} min-h-[140px] resize-y`}
                                value={cfg.prompts.join('\n')}
                                onChange={e => patch({ prompts: e.target.value.split('\n') })}
                                placeholder={'The cake\nDance floor moves\nYour table'}
                            />
                            <button onClick={() => patch({ prompts: WEDDING_PROMPTS })} className="text-[10px] font-black uppercase tracking-widest" style={{ color: accent }}>
                                Use wedding ideas
                            </button>
                        </div>

                        <div className="rounded-3xl border border-[#ECE8DF] bg-white p-8 space-y-4">
                            <h3 className="text-lg font-black text-[#2A2724]">Messages</h3>
                            <div className="space-y-2"><p className={label}>Title (defaults to the event name)</p><input className={input} value={cfg.welcomeTitle} onChange={e => patch({ welcomeTitle: e.target.value })} placeholder={event.name} /></div>
                            <div className="space-y-2"><p className={label}>Welcome message</p><textarea className={`${input} min-h-[80px]`} value={cfg.welcomeMessage} onChange={e => patch({ welcomeMessage: e.target.value })} /></div>
                            <div className="space-y-2"><p className={label}>When the camera closes</p><textarea className={`${input} min-h-[80px]`} value={cfg.thankYouMessage} onChange={e => patch({ thankYouMessage: e.target.value })} /></div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 flex items-center justify-end gap-4">
                        {saved && <span className="text-sm font-bold text-emerald-600 flex items-center gap-1.5"><Check size={16} /> Saved</span>}
                        <button
                            onClick={() => save({ ...cfg, prompts: cfg.prompts.map(p => p.trim()).filter(Boolean) })}
                            disabled={saving}
                            className="px-10 py-4 rounded-full text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-60"
                            style={{ background: accent }}
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save settings
                        </button>
                    </div>
                </div>
            )}

            {/* ── PHOTOS ── */}
            {tab === 'photos' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            { l: 'Pending', v: stats.pending }, { l: 'Approved', v: stats.approved }, { l: 'Hidden', v: stats.hidden },
                            { l: 'Hearts', v: stats.hearts }, { l: 'Storage (est.)', v: `${stats.mb} MB` },
                        ].map(s => (
                            <div key={s.l} className="rounded-2xl border border-[#ECE8DF] bg-white px-5 py-4">
                                <p className={label}>{s.l}</p>
                                <p className="text-lg font-black text-[#2A2724] mt-1 flex items-center gap-1.5">{s.l === 'Hearts' && <Heart size={14} />}{s.v}</p>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {(['pending', 'approved', 'hidden', 'all'] as StatusFilter[]).map(f => (
                            <button key={f} onClick={() => { setStatusFilter(f); setSelected([]); }} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusFilter === f ? 'text-white border-transparent' : 'bg-white border-[#ECE8DF] text-neutral-500'}`} style={statusFilter === f ? { background: accent } : undefined}>
                                {f}
                            </button>
                        ))}
                        <div className="ml-auto flex flex-wrap gap-2">
                            <button onClick={() => setSelected(visible.map(p => p.id))} className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-[#ECE8DF] bg-white text-neutral-500">Select all</button>
                            {statusFilter === 'pending' && stats.pending > 0 && (
                                <button onClick={() => setStatus(photos.filter(p => p.guest_status === 'pending').map(p => p.id), 'approved')} disabled={busy} className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-white" style={{ background: accent }}>
                                    Approve all pending
                                </button>
                            )}
                        </div>
                    </div>

                    {selected.length > 0 && (
                        <div className="sticky top-4 z-10 rounded-2xl bg-[#2A2724] text-white px-5 py-3 flex flex-wrap items-center gap-2 shadow-xl">
                            <span className="text-sm font-bold mr-auto">{selected.length} selected</span>
                            <button onClick={() => setStatus(selected, 'approved')} disabled={busy} className="px-4 py-2 rounded-full bg-white text-[#2A2724] text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><ShieldCheck size={13} /> Approve</button>
                            <button onClick={() => setStatus(selected, 'hidden')} disabled={busy} className="px-4 py-2 rounded-full bg-white/15 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><EyeOff size={13} /> Hide</button>
                            <button onClick={() => setPrinting(true)} className="px-4 py-2 rounded-full bg-white/15 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Printer size={13} /> Print</button>
                            <button onClick={() => removePhotos(selectedRows)} disabled={busy} className="px-4 py-2 rounded-full bg-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"><Trash2 size={13} /> Delete</button>
                            <button onClick={() => setSelected([])} className="p-2 rounded-full bg-white/10"><X size={14} /></button>
                        </div>
                    )}

                    {visible.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-[#ECE8DF] py-20 text-center text-sm text-neutral-400">
                            {loading ? 'Loading…' : statusFilter === 'pending' ? 'Nothing waiting for review.' : 'No photos here yet.'}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {visible.map(p => {
                                const on = selected.includes(p.id);
                                return (
                                    <div key={p.id} className={`group relative aspect-[3/4] rounded-2xl overflow-hidden bg-neutral-100 border-2 transition-all ${on ? 'scale-[0.96]' : ''}`} style={{ borderColor: on ? accent : 'transparent' }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={p.thumb_url || p.image_url} alt="" loading="lazy" className={`w-full h-full object-cover ${p.guest_status === 'hidden' ? 'opacity-40 grayscale' : ''}`} onClick={() => toggleSelect(p.id)} />
                                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] pointer-events-none">
                                            <div className="font-bold truncate">{guestName(p.guest_session_id)}</div>
                                            {p.prompt && <div className="opacity-70 truncate">{p.prompt}</div>}
                                        </div>
                                        <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${p.guest_status === 'approved' ? 'bg-emerald-500 text-white' : p.guest_status === 'hidden' ? 'bg-neutral-700 text-white' : 'bg-amber-400 text-black'}`}>{p.guest_status}</span>
                                        {p.like_count > 0 && <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center gap-1"><Heart size={9} fill="#fff" stroke="none" />{p.like_count}</span>}
                                        <div className="absolute inset-x-0 top-8 flex justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {p.guest_status !== 'approved' && <button onClick={() => setStatus([p.id], 'approved')} className="w-8 h-8 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow" title="Approve"><Check size={15} /></button>}
                                            {p.guest_status !== 'hidden' && <button onClick={() => setStatus([p.id], 'hidden')} className="w-8 h-8 rounded-full bg-white text-neutral-600 flex items-center justify-center shadow" title="Hide"><EyeOff size={15} /></button>}
                                            <button onClick={() => removePhotos([p])} className="w-8 h-8 rounded-full bg-white text-red-500 flex items-center justify-center shadow" title="Delete"><Trash2 size={15} /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── GUESTS ── */}
            {tab === 'guests' && (
                <div className="rounded-3xl border border-[#ECE8DF] bg-white overflow-hidden">
                    {guests.length === 0 ? (
                        <p className="py-20 text-center text-sm text-neutral-400">{loading ? 'Loading…' : 'No guests have joined yet.'}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b border-[#F3EFE7]">
                                        {['Guest', 'Table', 'Shots', 'Shot limit', 'Last seen', ''].map(h => <th key={h} className={`${label} px-5 py-4`}>{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {guests.map(g => {
                                        const mine = photos.filter(p => p.guest_session_id === g.id);
                                        return (
                                            <tr key={g.id} className="border-b border-[#F3EFE7] last:border-0">
                                                <td className="px-5 py-3 font-bold text-[#2A2724]">{g.name || <span className="text-neutral-400 font-medium">Anonymous</span>}{g.blocked && <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-black uppercase">Blocked</span>}</td>
                                                <td className="px-5 py-3 text-neutral-500">{g.table_label || '—'}</td>
                                                <td className="px-5 py-3 tabular-nums">{mine.filter(p => p.guest_status !== 'hidden').length}</td>
                                                <td className="px-5 py-3">
                                                    <input
                                                        type="number" min={1} max={200} placeholder={String(cfg.shotsPerGuest)}
                                                        defaultValue={g.quota_override ?? ''}
                                                        onBlur={e => { const v = e.target.value ? Math.max(1, +e.target.value) : null; if (v !== g.quota_override) void updateGuest(g.id, { quota_override: v }); }}
                                                        className="w-20 bg-white border border-[#ECE8DF] rounded-lg px-3 py-1.5 text-sm tabular-nums"
                                                    />
                                                </td>
                                                <td className="px-5 py-3 text-neutral-400 text-xs whitespace-nowrap">{new Date(g.last_seen_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</td>
                                                <td className="px-5 py-3 text-right whitespace-nowrap">
                                                    <button onClick={() => updateGuest(g.id, { blocked: !g.blocked })} className="px-3 py-1.5 rounded-full border border-[#ECE8DF] text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:border-[#2A2724] mr-2">{g.blocked ? 'Unblock' : 'Block'}</button>
                                                    {mine.length > 0 && <button onClick={() => removePhotos(mine)} className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50">Delete photos</button>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── SHARE ── */}
            {tab === 'share' && (
                <div className="grid lg:grid-cols-2 gap-8">
                    <div className="rounded-3xl border border-[#ECE8DF] bg-white p-8 space-y-6">
                        <h3 className="text-lg font-black text-[#2A2724] flex items-center gap-2"><QrCode size={18} /> Guest QR code</h3>
                        <div className="flex justify-center">
                            <div className="p-5 bg-white rounded-3xl border-2" style={{ borderColor: accent }}>
                                {links.camera ? <QRCodeSVG value={links.camera} size={200} level="M" /> : <div className="w-[200px] h-[200px]" />}
                            </div>
                        </div>
                        {[
                            { k: 'camera', t: 'Guest camera', u: links.camera },
                            { k: 'album', t: 'Album (after the reveal)', u: links.album },
                            { k: 'live', t: 'Live slideshow for a projector', u: links.live },
                        ].map(l => (
                            <div key={l.k} className="space-y-1.5">
                                <p className={label}>{l.t}</p>
                                <div className="flex gap-2">
                                    <input readOnly value={l.u} className={`${input} text-xs`} onFocus={e => e.currentTarget.select()} />
                                    <button onClick={() => copy(l.k, l.u)} className="px-3 rounded-xl border border-[#ECE8DF] text-neutral-500 hover:border-[#2A2724]" title="Copy">{copied === l.k ? <Check size={15} /> : <Copy size={15} />}</button>
                                    <a href={l.u} target="_blank" rel="noreferrer" className="px-3 rounded-xl border border-[#ECE8DF] text-neutral-500 hover:border-[#2A2724] flex items-center" title="Open"><ExternalLink size={15} /></a>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-8">
                        <div className="rounded-3xl border border-[#ECE8DF] bg-white p-8 space-y-5">
                            <h3 className="text-lg font-black text-[#2A2724] flex items-center gap-2"><Printer size={18} /> Table cards</h3>
                            <p className="text-sm text-neutral-500">Four cards to an A4 page, each with the QR code, the event title and how many shots guests get. Cut along the dashed lines.</p>
                            <div className="flex items-center gap-3">
                                <p className={label}>Cards</p>
                                <input type="number" min={4} step={4} value={cardCount} onChange={e => setCardCount(Math.max(4, +e.target.value || 4))} className="w-24 bg-white border border-[#ECE8DF] rounded-lg px-3 py-2 text-sm tabular-nums" />
                            </div>
                            <button onClick={printCards} disabled={!links.camera} className="w-full py-3.5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2" style={{ background: accent }}>
                                <Printer size={14} /> Print cards
                            </button>
                        </div>

                        <div className="rounded-3xl border border-[#ECE8DF] bg-white p-8 space-y-5">
                            <h3 className="text-lg font-black text-[#2A2724] flex items-center gap-2"><Images size={18} /> Print guest photos</h3>
                            <p className="text-sm text-neutral-500">Opens the print studio with {selectedRows.length ? 'your selected photos' : 'all approved guest photos'}. Pick photos in the Photos tab to print only those.</p>
                            <button onClick={() => setPrinting(true)} disabled={printable.length === 0} className="w-full py-3.5 rounded-xl border border-[#2A2724] text-[#2A2724] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40">
                                <Printer size={14} /> Open print studio ({printable.length})
                            </button>
                        </div>

                        <a href={links.live} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-3xl border border-[#ECE8DF] bg-white p-8 hover:border-[#2A2724] transition-colors">
                            <span>
                                <span className="block text-lg font-black text-[#2A2724]">Open the live slideshow</span>
                                <span className="block text-sm text-neutral-500 mt-1">Full screen on a projector, with a QR code in the corner.</span>
                            </span>
                            <MonitorPlay size={28} className="text-neutral-400" />
                        </a>
                    </div>
                </div>
            )}

            {printing && (
                <PrintDesigner
                    selectedPhotos={selectedRows.map(p => ({ id: p.id, url: p.image_url }))}
                    allPhotos={photos.filter(p => p.guest_status === 'approved' || selected.includes(p.id)).map(p => ({ id: p.id, url: p.image_url }))}
                    templates={printTemplates}
                    onClose={() => setPrinting(false)}
                    themeColor={accent}
                />
            )}
        </div>
    );
}
