'use client';

import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, Loader2, Palette, RotateCcw } from 'lucide-react';
import { GALLERY_THEME_KEYS, THEME_PALETTES } from '@/lib/gallery-themes';
import { contrastOn, type ColorScheme } from '@/lib/event-theme';

interface Props {
    scheme: ColorScheme;
    onApply: (scheme: ColorScheme) => Promise<void>;
}

const same = (a: ColorScheme, b: ColorScheme) =>
    a.primary.toLowerCase() === b.primary.toLowerCase() && a.secondary.toLowerCase() === b.secondary.toLowerCase();

/** The event's one colour scheme: pick a preset or your own pair, and every page follows */
export default function ColorSchemeBar({ scheme, onApply }: Props) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<ColorScheme>(scheme);
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => { setDraft(scheme); }, [scheme]);

    const dirty = !same(draft, scheme);
    const preset = THEME_PALETTES[draft.preset];

    const apply = async () => {
        setSaving(true);
        try {
            await onApply(draft);
            setDone(true);
            setTimeout(() => setDone(false), 2200);
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="rounded-3xl border border-[#ECE8DF] bg-white shadow-sm overflow-hidden">
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-4 px-6 py-4 text-left" aria-expanded={open}>
                <span className="w-9 h-9 rounded-xl bg-[#FAF8F5] border border-[#ECE8DF] flex items-center justify-center text-[#2A2724]"><Palette size={16} /></span>
                <span className="flex-1 min-w-0">
                    <span className="block text-[10px] font-black text-[#2A2724] uppercase tracking-[0.2em]">Color scheme</span>
                    <span className="block text-xs text-neutral-400 mt-0.5 truncate">One palette for the booth, gallery, guest camera and album</span>
                </span>
                {/* Live swatch */}
                <span className="hidden sm:flex items-center gap-2">
                    <span className="flex rounded-full overflow-hidden border border-black/10 h-7 w-16">
                        <span className="flex-1" style={{ background: draft.secondary }} />
                        <span className="flex-1" style={{ background: draft.primary }} />
                    </span>
                    {dirty && <span className="text-[9px] font-black uppercase tracking-widest text-amber-600">Unsaved</span>}
                </span>
                <ChevronDown size={18} className={`text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="px-6 pb-6 pt-2 border-t border-[#F3EFE7] grid lg:grid-cols-[1fr_auto] gap-8 items-start">
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.2em]">Start from a palette</p>
                            <div className="flex flex-wrap gap-2.5">
                                {GALLERY_THEME_KEYS.map(key => {
                                    const p = THEME_PALETTES[key];
                                    const active = draft.preset === key && same(draft, { preset: key, ...p });
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setDraft({ preset: key, primary: p.primary, secondary: p.secondary })}
                                            className={`group flex items-center gap-2.5 pl-1.5 pr-3.5 py-1.5 rounded-full border-2 transition-all ${active ? 'border-[#2A2724]' : 'border-[#ECE8DF] hover:border-neutral-300'}`}
                                        >
                                            <span className="w-7 h-7 rounded-full border border-black/10 overflow-hidden relative" style={{ background: p.secondary }}>
                                                <span className="absolute inset-0" style={{ background: p.primary, clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
                                            </span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-[#2A2724]">{key}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
                            {([
                                { k: 'primary' as const, title: 'Primary', hint: 'Titles, buttons and accents' },
                                { k: 'secondary' as const, title: 'Secondary', hint: 'Page background' },
                            ]).map(f => (
                                <label key={f.k} className="flex items-center gap-3 p-3 rounded-2xl bg-[#FAF8F5] border border-[#ECE8DF] cursor-pointer">
                                    <input
                                        type="color"
                                        value={draft[f.k]}
                                        onChange={e => setDraft({ ...draft, [f.k]: e.target.value })}
                                        className="w-11 h-11 rounded-xl cursor-pointer border-0 bg-transparent p-0"
                                    />
                                    <span>
                                        <span className="block text-[10px] font-black text-[#2A2724] uppercase tracking-widest">{f.title}</span>
                                        <span className="block text-[10px] font-mono text-neutral-400 uppercase">{draft[f.k]}</span>
                                        <span className="block text-[10px] text-neutral-400">{f.hint}</span>
                                    </span>
                                </label>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={apply}
                                disabled={!dirty || saving}
                                className="px-8 py-3 rounded-full bg-[#2A2724] text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-40"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Apply to every page
                            </button>
                            {preset && (
                                <button onClick={() => setDraft({ preset: draft.preset, primary: preset.primary, secondary: preset.secondary })} className="px-4 py-3 rounded-full border border-[#ECE8DF] text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:border-[#2A2724] flex items-center gap-2">
                                    <RotateCcw size={13} /> Reset to palette
                                </button>
                            )}
                            {done && <span className="text-sm font-bold text-emerald-600 flex items-center gap-1.5"><Check size={15} /> Applied</span>}
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="w-full lg:w-64 rounded-2xl p-5 border border-black/10 shadow-inner" style={{ background: draft.secondary, color: draft.primary }}>
                        <p className="text-[9px] font-bold uppercase tracking-[0.3em] opacity-60">Preview</p>
                        <p className="text-2xl mt-2 leading-tight" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>Your event</p>
                        <p className="text-xs opacity-70 mt-1">Captured moments, all in one place.</p>
                        <div className="flex gap-2 mt-4">
                            <span className="px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: draft.primary, color: contrastOn(draft.primary) }}>Download</span>
                            <span className="px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border" style={{ borderColor: `${draft.primary}55` }}>Share</span>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
