'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '../../layout';
import { ArrowLeft, Loader2, Check, Smartphone, Monitor, ChevronDown, ChevronUp, RotateCcw, Camera, Plus, Trash2, Globe, Mail, Phone, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { deriveTheme } from '@/lib/color-utils';
import type { CustomLink, CustomLinkIcon } from '@/lib/auth';
import { migrateToCustomLinks } from '@/lib/auth';
import { InstagramIcon, FacebookIcon, TwitterIcon, YoutubeIcon, LinkedinIcon, TiktokIcon } from '@/components/SocialIcons';

const ACCENT_PRESETS = [
    { hex: '#171717', label: 'Ink' },
    { hex: '#E8553E', label: 'Coral' },
    { hex: '#F59E0B', label: 'Amber' },
    { hex: '#10B981', label: 'Emerald' },
    { hex: '#3B82F6', label: 'Blue' },
    { hex: '#8B5CF6', label: 'Violet' },
    { hex: '#EC4899', label: 'Pink' },
    { hex: '#0EA5E9', label: 'Sky' },
];

const HERO_BG_PRESETS = [
    { id: 'none',              label: 'None',       preview: 'bg-neutral-100' },
    { id: 'gradient-warm',     label: 'Warm',       preview: 'bg-gradient-to-br from-amber-200 via-red-200 to-pink-200' },
    { id: 'gradient-aurora',   label: 'Aurora',     preview: 'bg-gradient-to-br from-emerald-200 via-teal-200 to-violet-200' },
    { id: 'gradient-midnight', label: 'Midnight',   preview: 'bg-gradient-to-br from-indigo-900 via-slate-900 to-black' },
    { id: 'gradient-sunset',   label: 'Sunset',     preview: 'bg-gradient-to-br from-orange-300 via-pink-300 to-rose-300' },
    { id: 'mesh',              label: 'Mesh',       preview: 'bg-gradient-to-br from-violet-200 via-pink-100 to-emerald-200' },
    { id: 'particles',         label: 'Particles',  preview: 'bg-neutral-800' },
    { id: 'geometric',         label: 'Geometric',  preview: 'bg-neutral-200' },
    { id: 'noise',             label: 'Noise',      preview: 'bg-neutral-300' },
];

const ICON_OPTIONS: { id: CustomLinkIcon; label: string; el: React.ReactNode }[] = [
    { id: 'instagram', label: 'Instagram', el: <InstagramIcon size={13} /> },
    { id: 'facebook',  label: 'Facebook',  el: <FacebookIcon  size={13} /> },
    { id: 'twitter',   label: 'Twitter',   el: <TwitterIcon   size={13} /> },
    { id: 'tiktok',    label: 'TikTok',    el: <TiktokIcon    size={13} /> },
    { id: 'youtube',   label: 'YouTube',   el: <YoutubeIcon   size={13} /> },
    { id: 'linkedin',  label: 'LinkedIn',  el: <LinkedinIcon  size={13} /> },
    { id: 'email',     label: 'Email',     el: <Mail          size={13} /> },
    { id: 'phone',     label: 'Phone',     el: <Phone         size={13} /> },
    { id: 'website',   label: 'Website',   el: <Globe         size={13} /> },
    { id: 'link',      label: 'Link',      el: <LinkIcon      size={13} /> },
];

type CustomColors = { bg?: string; surface?: string; text?: string; muted?: string; border?: string; card?: string };
type SectionStyles = {
    navbar?: string; hero?: string; hero_bg?: string; portfolio?: string;
    services?: string; testimonials?: string; contact?: string;
    stats?: string; how_it_works?: string;
    hide_navbar?: string; hide_hero?: string; hide_stats?: string;
    hide_portfolio?: string; hide_testimonials?: string; hide_how_it_works?: string;
    hide_services?: string; hide_contact?: string;
};

const HIDEABLE_SECTIONS = new Set(['navbar', 'hero', 'stats', 'portfolio', 'testimonials', 'how_it_works', 'services', 'contact']);

const SECTION_VARIANTS: Record<string, { id: string; label: string; desc: string }[]> = {
    navbar: [
        { id: 'classic',   label: 'Classic',   desc: 'Logo left, nav center, CTA right' },
        { id: 'double',    label: 'Double Row', desc: 'Info row + accent nav bar below' },
        { id: 'magazine',  label: 'Magazine',   desc: 'Socials left, logo center, nav strip' },
        { id: 'corporate', label: 'Corporate',  desc: 'Contact details + social + nav bar' },
        { id: 'utility',   label: 'Utility',    desc: 'Thin accent strip + dark main bar' },
    ],
    hero: [
        { id: 'glassmorphism', label: 'Serenity',   desc: 'Editorial text over iridescent shape' },
        { id: 'split',         label: 'Split',     desc: 'Accent panel + info side by side' },
        { id: 'cinematic',     label: 'Cinematic', desc: 'Full-bleed, name bottom-left' },
        { id: 'editorial',     label: 'Editorial', desc: 'Giant typographic name stack' },
        { id: 'floating',      label: 'Floating',  desc: 'Tilted card composition' },
        { id: 'agency',        label: 'Studio',    desc: 'Minimal editorial with dot grid' },
    ],
    stats: [
        { id: 'bar',     label: 'Bar',     desc: 'Compact strip with dividers' },
        { id: 'cards',   label: 'Cards',   desc: 'Each stat in its own tile' },
        { id: 'minimal', label: 'Minimal', desc: 'Plain numbers, no background' },
    ],
    portfolio: [
        { id: 'carousel',  label: 'Marquee',   desc: 'Auto-scrolling infinite strip' },
        { id: 'grid',      label: 'Editorial', desc: 'Numbered N°0X gallery grid' },
        { id: 'bento',     label: 'Bento',     desc: 'Large hero + mosaic tiles' },
        { id: 'filmstrip', label: 'Gallery',   desc: 'Horizontal scroll-snap reel' },
        { id: 'feature',   label: 'Cinematic', desc: 'Hero banner + numbered strip' },
    ],
    services: [
        { id: 'cards',    label: 'Cards',    desc: 'Equal cards, featured middle' },
        { id: 'rows',     label: 'Rows',     desc: 'Horizontal list with prices' },
        { id: 'minimal',  label: 'Minimal',  desc: 'Numbered clean list' },
        { id: 'pillars',  label: 'Pillars',  desc: 'Skyline column heights' },
        { id: 'editorial',label: 'Editorial',desc: 'Featured left + stack right' },
    ],
    testimonials: [
        { id: 'grid',     label: 'Grid',     desc: 'Quote card grid' },
        { id: 'carousel', label: 'Carousel', desc: 'Horizontal scroll cards' },
        { id: 'marquee',  label: 'Marquee',  desc: 'Auto-scrolling two rows' },
        { id: 'featured', label: 'Featured', desc: 'One large quote + smaller' },
        { id: 'minimal',  label: 'Minimal',  desc: 'Left-bordered quote lines' },
    ],
    how_it_works: [
        { id: 'steps',    label: 'Steps',    desc: 'Icon circles with connector line' },
        { id: 'timeline', label: 'Timeline', desc: 'Vertical numbered timeline' },
        { id: 'numbered', label: 'Numbered', desc: 'Bold ghost numbers, 2-column grid' },
    ],
    contact: [
        { id: 'centered', label: 'Centered', desc: 'CTA with buttons' },
        { id: 'banner',   label: 'Banner',   desc: 'Full-width accent strip' },
        { id: 'split',    label: 'Split',    desc: 'Text left, links right' },
        { id: 'card',     label: 'Card',     desc: 'Contact info card' },
        { id: 'minimal',  label: 'Minimal',  desc: 'Horizontal links bar' },
    ],
};

export default function AppearanceEditorPage() {
    const { profile, refreshProfile } = useAdmin();

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
    const [colorsOpen, setColorsOpen] = useState(false);

    const [accent, setAccent] = useState('#171717');
    const [darkMode, setDarkMode] = useState(false);
    const [overrides, setOverrides] = useState<CustomColors>({});
    const [sectionStyles, setSectionStyles] = useState<SectionStyles>({});
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);

    const logoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!profile) return;
        setAccent(profile.accent_color ?? '#171717');
        setDarkMode(profile.dark_mode ?? false);
        setOverrides((profile.custom_colors as CustomColors) ?? {});
        setSectionStyles((profile.section_styles as SectionStyles) ?? {});
        setLogoUrl(profile.logo_url);
        setCustomLinks(migrateToCustomLinks(
            (profile as unknown as { social_links?: Record<string, string> }).social_links ?? {},
            (profile.custom_links as CustomLink[]) ?? []
        ));
    }, [profile]);

    const derived = deriveTheme(accent, darkMode, overrides);

    const iframeSrc = profile ? `/u/${profile.username}` : '';
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const sendToIframe = useCallback(() => {
        iframeRef.current?.contentWindow?.postMessage(
            { type: 'SNAPWRAP_PREVIEW', accent, darkMode, overrides, sectionStyles, logo_url: logoUrl, customLinks },
            window.location.origin
        );
    }, [accent, darkMode, overrides, sectionStyles, logoUrl, customLinks]);

    useEffect(() => {
        const t = setTimeout(sendToIframe, 80);
        return () => clearTimeout(t);
    }, [sendToIframe]);

    const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !profile) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be under 5 MB');
            return;
        }
        setUploadingLogo(true);
        try {
            const ext = file.name.split('.').pop() ?? 'jpg';
            const path = `logos/${profile.id}.${ext}`;
            const { error } = await supabase.storage.from('booth-photos').upload(path, file, { upsert: true, contentType: file.type });
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('booth-photos').getPublicUrl(path);
            setLogoUrl(`${publicUrl}?t=${Date.now()}`);
        } catch (err) {
            console.error('Logo upload failed:', err);
        } finally {
            setUploadingLogo(false);
        }
    };

    const addLink = () => {
        setCustomLinks(prev => [...prev, { id: Date.now().toString(), label: '', url: '', icon: 'link' }]);
    };

    const updateLink = (i: number, patch: Partial<CustomLink>) => {
        setCustomLinks(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
    };

    const removeLink = (i: number) => {
        setCustomLinks(prev => prev.filter((_, idx) => idx !== i));
    };

    const handleSave = async () => {
        if (!profile) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    accent_color: accent,
                    dark_mode: darkMode,
                    custom_colors: Object.keys(overrides).length ? overrides : null,
                    section_styles: sectionStyles,
                    logo_url: logoUrl,
                    custom_links: customLinks,
                })
                .eq('id', profile.id);
            if (error) throw error;
            await refreshProfile();
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            console.error('Save failed:', err);
        } finally {
            setSaving(false);
        }
    };

    if (!profile) {
        return (
            <div className="flex items-center justify-center h-[80vh]">
                <Loader2 className="w-8 h-8 animate-spin text-neutral-300" />
            </div>
        );
    }

    const heroBg = sectionStyles.hero_bg ?? 'none';

    const ColorOverrideField = ({ label, field }: { label: string; field: keyof CustomColors }) => {
        const derivedVal = derived[field as keyof typeof derived] as string;
        const overrideVal = overrides[field];
        return (
            <div className="flex items-center justify-between gap-3 py-2.5 border-b border-neutral-50 last:border-0">
                <div>
                    <p className="text-xs font-semibold text-neutral-700">{label}</p>
                    {!overrideVal && <p className="text-[10px] text-neutral-400">Auto-derived</p>}
                </div>
                <div className="flex items-center gap-2">
                    {overrideVal && (
                        <button onClick={() => setOverrides(p => { const n = { ...p }; delete n[field]; return n; })}
                            className="text-neutral-300 hover:text-red-400 transition-colors p-1">
                            <RotateCcw size={11} />
                        </button>
                    )}
                    <span className="text-[10px] font-mono text-neutral-400">{overrideVal ?? derivedVal}</span>
                    <label className="relative w-7 h-7 rounded-lg border-2 cursor-pointer hover:scale-110 transition-transform shadow-sm"
                        style={{ backgroundColor: overrideVal ?? derivedVal, borderColor: overrideVal ? accent : 'transparent' }}>
                        <input type="color" value={overrideVal ?? derivedVal}
                            onChange={e => setOverrides(p => ({ ...p, [field]: e.target.value }))}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    </label>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col md:flex-row bg-white overflow-hidden" style={{ height: '100dvh' }}>

            {/* ── Editor sidebar ── */}
            <div className="w-full md:w-[340px] flex-shrink-0 flex flex-col border-r border-neutral-100 overflow-hidden">

                {/* Header */}
                <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <Link href="/admin/profile"
                            className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-500 hover:bg-neutral-50 transition-colors">
                            <ArrowLeft size={14} />
                        </Link>
                        <h1 className="text-sm font-black tracking-tight text-neutral-900">Appearance</h1>
                    </div>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1.5 px-5 h-8 rounded-full bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 disabled:opacity-50 transition-all">
                        {saving ? <Loader2 size={11} className="animate-spin" /> : saved ? <Check size={11} /> : null}
                        {saving ? 'Saving...' : saved ? 'Saved!' : 'Publish'}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">

                    {/* Logo */}
                    <div className="p-5 border-b border-neutral-100">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400 mb-3">Logo</h2>
                        <div className="flex items-center gap-4">
                            <div
                                className="w-16 h-16 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-neutral-400 transition-colors relative group flex-shrink-0"
                                onClick={() => logoInputRef.current?.click()}>
                                {uploadingLogo
                                    ? <Loader2 size={16} className="animate-spin text-neutral-400" />
                                    : logoUrl
                                        ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                        : <Camera size={20} className="text-neutral-300" />}
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                                    <Camera size={14} className="text-white" />
                                </div>
                            </div>
                            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                            <div>
                                <p className="text-xs font-semibold text-neutral-700">Business Logo</p>
                                <p className="text-[10px] text-neutral-400 mt-0.5">Click to upload · max 5 MB</p>
                                {logoUrl && (
                                    <button onClick={() => setLogoUrl(null)}
                                        className="text-[10px] text-red-400 hover:text-red-600 mt-1 transition-colors font-medium">
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Links & Socials */}
                    <div className="p-5 border-b border-neutral-100">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">Links &amp; Socials</h2>
                            <button onClick={addLink}
                                className="flex items-center gap-1 text-[10px] font-bold text-neutral-500 hover:text-neutral-900 transition-colors">
                                <Plus size={11} /> Add
                            </button>
                        </div>
                        <div className="flex flex-col gap-2">
                            {customLinks.map((link, i) => (
                                <div key={link.id} className="rounded-xl border border-neutral-100 p-3 space-y-2">
                                    {/* Icon row */}
                                    <div className="flex items-start justify-between gap-1">
                                        <div className="flex flex-wrap gap-1 flex-1">
                                            {ICON_OPTIONS.map(opt => (
                                                <button key={opt.id}
                                                    onClick={() => updateLink(i, { icon: opt.id })}
                                                    title={opt.label}
                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${link.icon === opt.id ? 'bg-neutral-900 text-white' : 'text-neutral-400 hover:bg-neutral-100'}`}>
                                                    {opt.el}
                                                </button>
                                            ))}
                                        </div>
                                        <button onClick={() => removeLink(i)}
                                            className="text-neutral-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                    {/* Label */}
                                    <input
                                        type="text"
                                        value={link.label}
                                        onChange={e => updateLink(i, { label: e.target.value })}
                                        placeholder="Label"
                                        className="w-full text-xs font-semibold bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                                    />
                                    {/* URL / phone / email */}
                                    <input
                                        type={link.icon === 'phone' ? 'tel' : link.icon === 'email' ? 'email' : 'text'}
                                        value={link.url}
                                        onChange={e => updateLink(i, { url: e.target.value })}
                                        placeholder={
                                            link.icon === 'phone' ? '+1 (555) 000-0000'
                                            : link.icon === 'email' ? 'hello@yoursite.com'
                                            : 'https://'
                                        }
                                        className="w-full text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                                    />
                                </div>
                            ))}
                            {customLinks.length === 0 && (
                                <p className="text-[10px] text-neutral-400 text-center py-3">No links yet. Click Add above.</p>
                            )}
                        </div>
                    </div>

                    {/* Color Mode */}
                    <div className="p-5 border-b border-neutral-100">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400 mb-3">Color Mode</h2>
                        <div className="grid grid-cols-2 gap-2">
                            {[{ val: false, label: 'Light', sub: 'Bright & airy' }, { val: true, label: 'Dark', sub: 'Bold & moody' }].map(m => (
                                <button key={String(m.val)} onClick={() => setDarkMode(m.val)}
                                    className={`py-3 px-4 rounded-xl border text-left transition-all ${darkMode === m.val ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-neutral-50 text-neutral-600 border-neutral-100 hover:border-neutral-300'}`}>
                                    <p className="text-xs font-bold">{m.label}</p>
                                    <p className="text-[10px] mt-0.5 text-neutral-400">{m.sub}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Accent Color */}
                    <div className="p-5 border-b border-neutral-100">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400 mb-3">Accent Color</h2>
                        <p className="text-[10px] text-neutral-400 mb-3 leading-relaxed">
                            Your accent auto-derives the entire palette — buttons, tints, borders, and more.
                        </p>
                        <div className="grid grid-cols-4 gap-2 mb-3">
                            {ACCENT_PRESETS.map(c => (
                                <button key={c.hex} onClick={() => setAccent(c.hex)} title={c.label}
                                    className="aspect-square rounded-xl transition-all hover:scale-105 relative border-2"
                                    style={{ backgroundColor: c.hex, borderColor: accent === c.hex ? '#171717' : 'transparent' }}>
                                    {accent === c.hex && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Check size={14} className="text-white drop-shadow-sm" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="relative w-9 h-9 rounded-xl cursor-pointer border-2 border-white shadow-md hover:scale-110 transition-transform flex-shrink-0"
                                style={{ backgroundColor: accent }}>
                                <input type="color" value={accent} onChange={e => setAccent(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                            </label>
                            <input type="text" value={accent}
                                onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setAccent(e.target.value); }}
                                className="flex-1 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                                placeholder="#171717" />
                        </div>
                    </div>

                    {/* Hero Background */}
                    <div className="p-5 border-b border-neutral-100">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400 mb-3">Hero Background</h2>
                        <div className="grid grid-cols-3 gap-2">
                            {HERO_BG_PRESETS.map(bg => (
                                <button key={bg.id} onClick={() => setSectionStyles(p => ({ ...p, hero_bg: bg.id === 'none' ? undefined : bg.id }))}
                                    className={`relative rounded-xl overflow-hidden border-2 transition-all ${heroBg === bg.id || (bg.id === 'none' && !sectionStyles.hero_bg) ? 'border-neutral-900 scale-[0.97]' : 'border-transparent hover:border-neutral-300'}`}>
                                    <div className={`h-10 w-full ${bg.preview}`} />
                                    <p className="text-[9px] font-bold text-neutral-500 text-center py-1">{bg.label}</p>
                                    {(heroBg === bg.id || (bg.id === 'none' && !sectionStyles.hero_bg)) && (
                                        <div className="absolute top-1 right-1 w-4 h-4 bg-neutral-900 rounded-full flex items-center justify-center">
                                            <Check size={9} className="text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section Styles */}
                    {(Object.entries(SECTION_VARIANTS) as [keyof SectionStyles, typeof SECTION_VARIANTS[string]][]).map(([key, variants]) => {
                        const hideKey = `hide_${key as string}` as keyof SectionStyles;
                        const isHideable = HIDEABLE_SECTIONS.has(key as string);
                        const isHidden = isHideable ? sectionStyles[hideKey] === 'true' : false;
                        return (
                            <div key={key} className="p-5 border-b border-neutral-100">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400 capitalize">
                                        {(key as string).replace(/_/g, ' ')} Style
                                    </h2>
                                    {isHideable && (
                                        <button
                                            onClick={() => setSectionStyles(p => ({ ...p, [hideKey]: isHidden ? undefined : 'true' }))}
                                            className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${isHidden ? 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200' : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50'}`}
                                        >
                                            {isHidden ? 'Hidden' : 'Hide'}
                                        </button>
                                    )}
                                </div>
                                {!isHidden && (
                                    <div className="flex flex-col gap-1.5">
                                        {variants.map(v => {
                                            const active = (sectionStyles[key] ?? variants[0].id) === v.id;
                                            return (
                                                <button key={v.id} onClick={() => setSectionStyles(p => ({ ...p, [key]: v.id }))}
                                                    className={`px-3.5 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${active ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-100 hover:border-neutral-300 bg-white'}`}>
                                                    <div>
                                                        <p className="text-xs font-bold">{v.label}</p>
                                                        <p className="text-[10px] text-neutral-400">{v.desc}</p>
                                                    </div>
                                                    <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${active ? 'border-white' : 'border-neutral-300'}`}>
                                                        {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Color overrides */}
                    <div className="border-b border-neutral-100">
                        <button onClick={() => setColorsOpen(v => !v)}
                            className="w-full px-5 py-4 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <h2 className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">Color Overrides</h2>
                                <div className="flex gap-1">
                                    {[derived.bg, derived.surface, derived.text, derived.card].map((c, i) => (
                                        <div key={i} className="w-3 h-3 rounded-full border border-neutral-200" style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>
                            {colorsOpen ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
                        </button>
                        {colorsOpen && (
                            <div className="px-5 pb-4">
                                <p className="text-[10px] text-neutral-400 mb-3 leading-relaxed">
                                    Override specific colors. Click the reset icon to revert back to auto-derived.
                                </p>
                                <ColorOverrideField label="Background" field="bg" />
                                <ColorOverrideField label="Surface / Panels" field="surface" />
                                <ColorOverrideField label="Card Background" field="card" />
                                <ColorOverrideField label="Body Text" field="text" />
                                <ColorOverrideField label="Muted Text" field="muted" />
                                <ColorOverrideField label="Border" field="border" />
                                {Object.keys(overrides).length > 0 && (
                                    <button onClick={() => setOverrides({})}
                                        className="mt-3 text-[10px] font-bold text-neutral-400 hover:text-neutral-900 flex items-center gap-1 transition-colors">
                                        <RotateCcw size={10} /> Reset all to auto
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Live Preview ── */}
            <div className="flex-1 bg-[#F0F0F0] relative flex flex-col overflow-hidden">
                <div className="absolute top-4 right-4 z-20 flex bg-white rounded-xl shadow-sm border border-neutral-200 p-1 gap-0.5">
                    {(['desktop', 'mobile'] as const).map(d => (
                        <button key={d} onClick={() => setDevice(d)}
                            className={`p-2 rounded-lg transition-all ${device === d ? 'bg-neutral-900 text-white' : 'text-neutral-400 hover:text-neutral-900'}`}>
                            {d === 'desktop' ? <Monitor size={14} /> : <Smartphone size={14} />}
                        </button>
                    ))}
                </div>

                <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden">
                    <div className={`bg-white shadow-2xl overflow-hidden border border-neutral-200 transition-all duration-400 ease-in-out flex flex-col ${device === 'mobile' ? 'w-[375px] h-[780px] rounded-[2.5rem] border-[8px] border-neutral-800' : 'w-full h-full max-w-[1200px] rounded-2xl'}`}>
                        <div className="h-9 border-b border-neutral-200 bg-neutral-50 flex items-center px-3 gap-2 flex-shrink-0">
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                                <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                                <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                            </div>
                            <div className="ml-2 flex-1 flex justify-center">
                                <div className="bg-white border border-neutral-200 text-[10px] text-neutral-400 font-mono px-3 py-0.5 rounded-md max-w-xs truncate">
                                    snapwrap.com/u/{profile.username}
                                </div>
                            </div>
                        </div>
                        <iframe
                            ref={iframeRef}
                            src={iframeSrc}
                            onLoad={sendToIframe}
                            className="w-full flex-1 border-0"
                            title="Live Preview"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
