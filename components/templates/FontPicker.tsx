'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import {
    FONT_CATEGORIES, FONT_LIBRARY, ensureFonts, ensurePickerPreviews, fontStack, libraryFont, primaryFamily,
    type FontCategory, type FontEntry,
} from '@/lib/fonts';

const SYSTEM_FONTS = [
    { label: 'System Sans', value: 'sans-serif' },
    { label: 'System Serif', value: 'serif' },
    { label: 'Monospace', value: 'monospace' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
];

interface Props {
    value: string;
    currentWeight: string;
    /** Called with the CSS font-family and the weight to use (closest one the font ships) */
    onChange: (fontFamily: string, fontWeight: string) => void;
}

function closestWeight(entry: FontEntry, current: string) {
    const want = parseInt(current, 10) || 400;
    return String(entry.weights.reduce((best, w) => (Math.abs(w - want) < Math.abs(best - want) ? w : best), entry.weights[0]));
}

/** Searchable list of the font library; every name is drawn in its own typeface. */
export default function FontPicker({ value, currentWeight, onChange }: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<FontCategory | 'all'>('all');
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        ensurePickerPreviews();
        const close = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const fonts = useMemo(() => {
        const q = query.trim().toLowerCase();
        return FONT_LIBRARY.filter(f => (category === 'all' || f.category === category) && (!q || f.family.toLowerCase().includes(q)));
    }, [query, category]);

    const current = libraryFont(value);
    const currentLabel = current?.family ?? SYSTEM_FONTS.find(f => f.value === value)?.label ?? primaryFamily(value);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between bg-neutral-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white hover:border-blue-500/50 transition-colors"
            >
                <span style={{ fontFamily: value }} className="truncate">{currentLabel}</span>
                <ChevronDown size={14} className="text-neutral-500 shrink-0" />
            </button>

            {open && (
                <div className="absolute z-50 mt-2 w-full bg-neutral-950 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    <div className="p-3 space-y-3 border-b border-white/5">
                        <div className="relative">
                            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                            <input
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={`Search ${FONT_LIBRARY.length} fonts`}
                                className="w-full bg-neutral-900 border border-white/5 rounded-lg pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                            />
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {FONT_CATEGORIES.map(c => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => setCategory(c.value)}
                                    className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-colors ${
                                        category === c.value ? 'bg-white text-neutral-900' : 'text-neutral-500 hover:text-white'
                                    }`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto py-1">
                        {category === 'all' && !query && SYSTEM_FONTS.map(f => (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => { onChange(f.value, currentWeight); setOpen(false); }}
                                className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-white/5"
                                style={{ fontFamily: f.value }}
                            >
                                {f.label}
                            </button>
                        ))}
                        {fonts.map(f => (
                            <button
                                key={f.family}
                                type="button"
                                onClick={() => {
                                    ensureFonts([fontStack(f)]);
                                    onChange(fontStack(f), closestWeight(f, currentWeight));
                                    setOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-4 py-2 text-left hover:bg-white/5 ${current?.family === f.family ? 'bg-white/10' : ''}`}
                            >
                                <span className="text-lg text-white truncate" style={{ fontFamily: fontStack(f) }}>{f.family}</span>
                                <span className="text-[8px] font-black uppercase tracking-widest text-neutral-600 ml-3 shrink-0">{f.category}</span>
                            </button>
                        ))}
                        {fonts.length === 0 && <p className="px-4 py-6 text-center text-[10px] text-neutral-500">No fonts match</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
