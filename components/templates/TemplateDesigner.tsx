'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TextElement {
    id: string;
    text: string;
    x: number; // percent 0-100
    y: number; // percent 0-100
    fontSize: number;
    fontFamily: string;
    color: string;
    fontWeight: string;
    fontStyle: string;
    textAlign: string;
    letterSpacing: number;
    textShadow: string;
    opacity: number;
    rotation: number;
}

interface PhotoSlot {
    id: string;
    row: number;
    col: number;
}

export interface TemplateConfig {
    id: string;
    name: string;
    layout: { rows: number; cols: number };
    slots: PhotoSlot[];
    background: string;
    backgroundImage?: string | null;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    gap: number;
    padding: number;
    textElements: TextElement[];
    watermarkText: string;
}

// ─── Pre-made Templates ─────────────────────────────────────────────────────

function generateId() {
    return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultTextElement(overrides?: Partial<TextElement>): TextElement {
    return {
        id: `txt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: 'New Text',
        x: 50,
        y: 10,
        fontSize: 24,
        fontFamily: 'sans-serif',
        color: '#1e293b',
        fontWeight: '700',
        fontStyle: 'normal',
        textAlign: 'center',
        letterSpacing: 0,
        textShadow: 'none',
        opacity: 1,
        rotation: 0,
        ...overrides,
    };
}

export const PRESET_TEMPLATES: Omit<TemplateConfig, 'id'>[] = [
    // ── 1. Classic Elegant ─────────────────────────────────────────
    {
        name: 'Classic Elegant',
        layout: { rows: 1, cols: 1 },
        slots: [{ id: 's1', row: 0, col: 0 }],
        background: '#ffffff',
        borderColor: '#d4af37',
        borderWidth: 3,
        borderRadius: 16,
        gap: 0,
        padding: 36,
        textElements: [
            createDefaultTextElement({ text: '✦ Our Special Day ✦', x: 50, y: 5, fontSize: 24, fontFamily: 'Georgia, serif', color: '#92400e', letterSpacing: 2 }),
            createDefaultTextElement({ id: 'date1', text: '14 • February • 2026', x: 50, y: 92, fontSize: 13, color: '#b45309', fontWeight: '400', fontStyle: 'italic', letterSpacing: 3 }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 2. Neon Glow ───────────────────────────────────────────────
    {
        name: 'Neon Glow',
        layout: { rows: 4, cols: 1 },
        slots: [
            { id: 's1', row: 0, col: 0 },
            { id: 's2', row: 1, col: 0 },
            { id: 's3', row: 2, col: 0 },
            { id: 's4', row: 3, col: 0 },
        ],
        background: '#0a0a0a',
        borderColor: '#ff2d95',
        borderWidth: 2,
        borderRadius: 12,
        gap: 6,
        padding: 16,
        textElements: [
            createDefaultTextElement({ text: 'PHOTO BOOTH', x: 50, y: 2, fontSize: 18, fontFamily: 'Arial, sans-serif', color: '#ff2d95', fontWeight: '900', letterSpacing: 6, textShadow: '0 0 10px #ff2d95, 0 0 20px #ff2d95' }),
            createDefaultTextElement({ id: 'sub1', text: '#GOODVIBES', x: 50, y: 97, fontSize: 10, color: '#00f0ff', fontWeight: '700', letterSpacing: 4, textShadow: '0 0 8px #00f0ff' }),
        ],
        watermarkText: '',
    },
    // ── 3. Retro Polaroid ──────────────────────────────────────────
    {
        name: 'Retro Polaroid',
        layout: { rows: 1, cols: 1 },
        slots: [{ id: 's1', row: 0, col: 0 }],
        background: '#fefce8',
        borderColor: '#e5e5e5',
        borderWidth: 0,
        borderRadius: 4,
        gap: 0,
        padding: 24,
        textElements: [
            createDefaultTextElement({ text: 'instant memories 📷', x: 50, y: 90, fontSize: 18, fontFamily: 'cursive', color: '#44403c', fontWeight: '400', rotation: -2 }),
        ],
        watermarkText: '',
    },
    // ── 4. Sunset Vibes ────────────────────────────────────────────
    {
        name: 'Sunset Vibes',
        layout: { rows: 2, cols: 2 },
        slots: [
            { id: 's1', row: 0, col: 0 },
            { id: 's2', row: 0, col: 1 },
            { id: 's3', row: 1, col: 0 },
            { id: 's4', row: 1, col: 1 },
        ],
        background: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #8b5cf6 100%)',
        borderColor: 'rgba(255,255,255,0.4)',
        borderWidth: 2,
        borderRadius: 20,
        gap: 8,
        padding: 24,
        textElements: [
            createDefaultTextElement({ text: 'SUNSET VIBES', x: 50, y: 4, fontSize: 22, color: '#ffffff', fontWeight: '900', letterSpacing: 4, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }),
            createDefaultTextElement({ id: 'sub1', text: 'golden hour ☀️', x: 50, y: 94, fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '400', fontStyle: 'italic' }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 5. Emerald Luxe ────────────────────────────────────────────
    {
        name: 'Emerald Luxe',
        layout: { rows: 2, cols: 1 },
        slots: [
            { id: 's1', row: 0, col: 0 },
            { id: 's2', row: 1, col: 0 },
        ],
        background: '#064e3b',
        borderColor: '#d4af37',
        borderWidth: 3,
        borderRadius: 24,
        gap: 12,
        padding: 32,
        textElements: [
            createDefaultTextElement({ text: 'EMERALD GALA', x: 50, y: 4, fontSize: 22, fontFamily: 'Georgia, serif', color: '#d4af37', letterSpacing: 5 }),
            createDefaultTextElement({ id: 'sub1', text: '— an evening to remember —', x: 50, y: 94, fontSize: 11, color: '#86efac', fontWeight: '400', fontStyle: 'italic', letterSpacing: 2 }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 6. Film Strip ──────────────────────────────────────────────
    {
        name: 'Film Strip',
        layout: { rows: 3, cols: 1 },
        slots: [
            { id: 's1', row: 0, col: 0 },
            { id: 's2', row: 1, col: 0 },
            { id: 's3', row: 2, col: 0 },
        ],
        background: '#18181b',
        borderColor: '#3f3f46',
        borderWidth: 1,
        borderRadius: 8,
        gap: 4,
        padding: 14,
        textElements: [
            createDefaultTextElement({ text: '35mm', x: 10, y: 2, fontSize: 10, color: '#71717a', fontWeight: '400', fontFamily: 'monospace' }),
            createDefaultTextElement({ id: 'strip', text: '▷ FILM STRIP ◁', x: 50, y: 97, fontSize: 12, color: '#a1a1aa', fontWeight: '600', letterSpacing: 3 }),
        ],
        watermarkText: '',
    },
    // ── 7. Insta Grid ──────────────────────────────────────────────
    {
        name: 'Insta Grid',
        layout: { rows: 3, cols: 3 },
        slots: [
            { id: 's1', row: 0, col: 0 }, { id: 's2', row: 0, col: 1 }, { id: 's3', row: 0, col: 2 },
            { id: 's4', row: 1, col: 0 }, { id: 's5', row: 1, col: 1 }, { id: 's6', row: 1, col: 2 },
            { id: 's7', row: 2, col: 0 }, { id: 's8', row: 2, col: 1 }, { id: 's9', row: 2, col: 2 },
        ],
        background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
        borderColor: 'rgba(255,255,255,0.2)',
        borderWidth: 0,
        borderRadius: 16,
        gap: 3,
        padding: 16,
        textElements: [
            createDefaultTextElement({ text: '@yourhandle', x: 50, y: 3, fontSize: 16, color: '#ffffff', fontWeight: '700', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }),
        ],
        watermarkText: '',
    },
    // ── 8. Tropical Party ──────────────────────────────────────────
    {
        name: 'Tropical Party 🌴',
        layout: { rows: 2, cols: 2 },
        slots: [
            { id: 's1', row: 0, col: 0 },
            { id: 's2', row: 0, col: 1 },
            { id: 's3', row: 1, col: 0 },
            { id: 's4', row: 1, col: 1 },
        ],
        background: 'linear-gradient(180deg, #0ea5e9 0%, #06b6d4 40%, #10b981 100%)',
        borderColor: 'rgba(255,255,255,0.5)',
        borderWidth: 3,
        borderRadius: 24,
        gap: 10,
        padding: 28,
        textElements: [
            createDefaultTextElement({ text: '🌺 TROPICAL VIBES 🌴', x: 50, y: 4, fontSize: 18, color: '#ffffff', fontWeight: '800', textShadow: '0 2px 6px rgba(0,0,0,0.25)' }),
            createDefaultTextElement({ id: 'sub1', text: 'Summer Party 2026', x: 50, y: 94, fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '400' }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 9. Lavender Dreams ─────────────────────────────────────────
    {
        name: 'Lavender Dreams',
        layout: { rows: 1, cols: 2 },
        slots: [
            { id: 's1', row: 0, col: 0 },
            { id: 's2', row: 0, col: 1 },
        ],
        background: 'linear-gradient(135deg, #c4b5fd 0%, #f0abfc 50%, #fecdd3 100%)',
        borderColor: 'rgba(255,255,255,0.6)',
        borderWidth: 2,
        borderRadius: 20,
        gap: 10,
        padding: 28,
        textElements: [
            createDefaultTextElement({ text: 'Dreamy Duo', x: 50, y: 8, fontSize: 26, fontFamily: 'Georgia, serif', color: '#581c87', fontStyle: 'italic' }),
            createDefaultTextElement({ id: 'sub1', text: '♡', x: 50, y: 90, fontSize: 20, color: '#9333ea' }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 10. Midnight Blue ──────────────────────────────────────────
    {
        name: 'Midnight Blue',
        layout: { rows: 3, cols: 2 },
        slots: [
            { id: 's1', row: 0, col: 0 }, { id: 's2', row: 0, col: 1 },
            { id: 's3', row: 1, col: 0 }, { id: 's4', row: 1, col: 1 },
            { id: 's5', row: 2, col: 0 }, { id: 's6', row: 2, col: 1 },
        ],
        background: 'linear-gradient(180deg, #020617 0%, #0f172a 50%, #1e1b4b 100%)',
        borderColor: '#6366f1',
        borderWidth: 2,
        borderRadius: 16,
        gap: 6,
        padding: 20,
        textElements: [
            createDefaultTextElement({ text: '✨ MIDNIGHT GALA ✨', x: 50, y: 2, fontSize: 18, color: '#c7d2fe', fontWeight: '800', letterSpacing: 3, textShadow: '0 0 12px rgba(99,102,241,0.5)' }),
            createDefaultTextElement({ id: 'sub1', text: 'Under the Stars', x: 50, y: 96, fontSize: 11, color: '#818cf8', fontWeight: '400', fontStyle: 'italic' }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 11. Modern Mono ────────────────────────────────────────────
    {
        name: 'Modern Mono',
        layout: { rows: 1, cols: 3 },
        slots: [
            { id: 's1', row: 0, col: 0 },
            { id: 's2', row: 0, col: 1 },
            { id: 's3', row: 0, col: 2 },
        ],
        background: '#fafafa',
        borderColor: '#171717',
        borderWidth: 2,
        borderRadius: 0,
        gap: 8,
        padding: 24,
        textElements: [
            createDefaultTextElement({ text: 'SNAPSHOT', x: 50, y: 6, fontSize: 22, fontFamily: 'Arial, sans-serif', color: '#171717', fontWeight: '900', letterSpacing: 8 }),
            createDefaultTextElement({ id: 'sub1', text: '2026', x: 50, y: 92, fontSize: 14, color: '#525252', fontWeight: '300', letterSpacing: 6 }),
        ],
        watermarkText: '',
    },
    // ── 12. Rose Gold ──────────────────────────────────────────────
    {
        name: 'Rose Gold',
        layout: { rows: 2, cols: 1 },
        slots: [
            { id: 's1', row: 0, col: 0 },
            { id: 's2', row: 1, col: 0 },
        ],
        background: 'linear-gradient(180deg, #1c1917 0%, #292524 100%)',
        borderColor: '#d4a574',
        borderWidth: 3,
        borderRadius: 20,
        gap: 10,
        padding: 32,
        textElements: [
            createDefaultTextElement({ text: '❤ With Love', x: 50, y: 4, fontSize: 24, fontFamily: 'Georgia, serif', color: '#d4a574', fontStyle: 'italic', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }),
            createDefaultTextElement({ id: 'sub1', text: 'FOREVER & ALWAYS', x: 50, y: 95, fontSize: 10, color: '#a8a29e', fontWeight: '600', letterSpacing: 5 }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 13. Valentine's Day 💕 ────────────────────────────────────
    {
        name: "Valentine's Day 💕",
        layout: { rows: 2, cols: 2 },
        slots: [
            { id: 's1', row: 0, col: 0 },
            { id: 's2', row: 0, col: 1 },
            { id: 's3', row: 1, col: 0 },
            { id: 's4', row: 1, col: 1 },
        ],
        background: 'linear-gradient(135deg, #4a0020 0%, #1a0010 40%, #2d0015 70%, #0d0008 100%)',
        borderColor: '#e11d48',
        borderWidth: 3,
        borderRadius: 24,
        gap: 10,
        padding: 32,
        textElements: [
            createDefaultTextElement({ text: '💕 Happy Valentine\'s 💕', x: 50, y: 4, fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", color: '#fda4af', fontWeight: '700', letterSpacing: 1, textShadow: '0 0 20px rgba(225,29,72,0.5)' }),
            createDefaultTextElement({ id: 'hearts1', text: '♥', x: 8, y: 50, fontSize: 28, color: '#e11d48', opacity: 0.25, rotation: -15 }),
            createDefaultTextElement({ id: 'hearts2', text: '♥', x: 92, y: 45, fontSize: 22, color: '#fb7185', opacity: 0.2, rotation: 12 }),
            createDefaultTextElement({ id: 'hearts3', text: '♥', x: 5, y: 15, fontSize: 16, color: '#fb7185', opacity: 0.15, rotation: -25 }),
            createDefaultTextElement({ id: 'hearts4', text: '♥', x: 95, y: 85, fontSize: 18, color: '#e11d48', opacity: 0.2, rotation: 20 }),
            createDefaultTextElement({ id: 'date1', text: '14 February 2026 💌', x: 50, y: 95, fontSize: 12, fontFamily: "'Playfair Display', Georgia, serif", color: '#fecdd3', fontWeight: '400', fontStyle: 'italic', letterSpacing: 3, textShadow: '0 0 10px rgba(225,29,72,0.4)' }),
        ],
        watermarkText: 'SnapWrap',
    },
];

function createBlankTemplate(rows: number, cols: number): Omit<TemplateConfig, 'id'> {
    const slots: PhotoSlot[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            slots.push({ id: `s${r}_${c}`, row: r, col: c });
        }
    }
    return {
        name: `Custom ${rows}×${cols}`,
        layout: { rows, cols },
        slots,
        background: '#ffffff',
        borderColor: '#e2e8f0',
        borderWidth: 2,
        borderRadius: 16,
        gap: 8,
        padding: 24,
        textElements: [
            createDefaultTextElement({ text: 'Your Event', x: 50, y: 5 }),
        ],
        watermarkText: 'SnapWrap',
    };
}

// ─── Design Tab Panels ──────────────────────────────────────────────────────

type DesignTab = 'presets' | 'layout' | 'style' | 'text';

interface TemplateDesignerProps {
    initialTemplate?: TemplateConfig | null;
    onSave: (config: TemplateConfig) => void;
    onClose: () => void;
}

// ─── Draggable Text Hook ────────────────────────────────────────────────────

function useDraggable(
    previewRef: React.RefObject<HTMLDivElement | null>,
    onMove: (id: string, x: number, y: number) => void
) {
    const dragState = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

    const startDrag = useCallback((e: React.MouseEvent, id: string, origX: number, origY: number) => {
        e.preventDefault();
        e.stopPropagation();
        dragState.current = { id, startX: e.clientX, startY: e.clientY, origX, origY };

        const onMouseMove = (ev: MouseEvent) => {
            if (!dragState.current || !previewRef.current) return;
            const rect = previewRef.current.getBoundingClientRect();
            const dx = ((ev.clientX - dragState.current.startX) / rect.width) * 100;
            const dy = ((ev.clientY - dragState.current.startY) / rect.height) * 100;
            const newX = Math.max(0, Math.min(100, dragState.current.origX + dx));
            const newY = Math.max(0, Math.min(100, dragState.current.origY + dy));
            onMove(dragState.current.id, newX, newY);
        };

        const onMouseUp = () => {
            dragState.current = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [previewRef, onMove]);

    return startDrag;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TemplateDesigner({ initialTemplate, onSave, onClose }: TemplateDesignerProps) {
    const [template, setTemplate] = useState<TemplateConfig>(() => {
        if (initialTemplate) return { ...initialTemplate };
        return { id: generateId(), ...PRESET_TEMPLATES[0] };
    });
    const [activeTab, setActiveTab] = useState<DesignTab>('presets');
    const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    const update = useCallback((patch: Partial<TemplateConfig>) => {
        setTemplate((prev) => ({ ...prev, ...patch }));
    }, []);

    // backgroundImage is now part of template.backgroundImage
    const backgroundImage = template.backgroundImage || null;
    const setBackgroundImage = useCallback((img: string | null) => {
        setTemplate(prev => ({ ...prev, backgroundImage: img }));
    }, []);

    const applyPreset = useCallback((preset: Omit<TemplateConfig, 'id'>) => {
        setTemplate({ id: generateId(), ...preset, backgroundImage: null });
        setSelectedTextId(null);
    }, []);

    const setLayout = useCallback((rows: number, cols: number) => {
        const blank = createBlankTemplate(rows, cols);
        update({ layout: blank.layout, slots: blank.slots });
    }, [update]);

    // Text operations
    const updateText = useCallback((id: string, patch: Partial<TextElement>) => {
        setTemplate(prev => ({
            ...prev,
            textElements: prev.textElements.map(t => t.id === id ? { ...t, ...patch } : t),
        }));
    }, []);

    const addTextElement = useCallback(() => {
        const el = createDefaultTextElement();
        setTemplate(prev => ({ ...prev, textElements: [...prev.textElements, el] }));
        setSelectedTextId(el.id);
    }, []);

    const deleteTextElement = useCallback((id: string) => {
        setTemplate(prev => ({
            ...prev,
            textElements: prev.textElements.filter(t => t.id !== id),
        }));
        setSelectedTextId(null);
    }, []);

    const moveText = useCallback((id: string, x: number, y: number) => {
        updateText(id, { x, y });
    }, [updateText]);

    const startDrag = useDraggable(previewRef, moveText);

    const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setBackgroundImage(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleSave = () => {
        onSave(template);
    };

    const selectedText = template.textElements.find(t => t.id === selectedTextId);

    // ── Tabs ─────────────────────────────────────────────────────────────

    const tabs: { key: DesignTab; label: string; icon: string }[] = [
        { key: 'presets', label: 'Presets', icon: '🎨' },
        { key: 'layout', label: 'Layout', icon: '⊞' },
        { key: 'style', label: 'Style', icon: '🖌️' },
        { key: 'text', label: 'Text', icon: 'Aa' },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-[95vw] max-w-[1400px] h-[90vh] flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {initialTemplate ? 'Edit Template' : 'Create Template'}
                        </h2>
                        <p className="text-sm text-gray-500">Design your photo booth layout</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            value={template.name}
                            onChange={(e) => update({ name: e.target.value })}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 w-48"
                            placeholder="Template name"
                        />
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button variant="primary" onClick={handleSave}>💾 Save</Button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 flex overflow-hidden">
                    {/* LEFT: Controls */}
                    <div className="w-80 border-r border-gray-200 flex flex-col overflow-hidden">
                        {/* Tab bar */}
                        <div className="grid grid-cols-4 gap-1 bg-gray-100 m-3 rounded-xl p-1 shrink-0">
                            {tabs.map((t) => (
                                <button
                                    key={t.key}
                                    onClick={() => setActiveTab(t.key)}
                                    className={`py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === t.key
                                        ? 'bg-white shadow text-gray-900'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <span className="block text-sm">{t.icon}</span>
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Panel content */}
                        <div className="flex-1 overflow-y-auto px-4 pb-4">
                            {/* ── Presets ── */}
                            {activeTab === 'presets' && (
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-600 font-medium">Start from a preset</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {PRESET_TEMPLATES.map((preset, i) => (
                                            <button
                                                key={i}
                                                onClick={() => applyPreset(preset)}
                                                className={`text-left p-3 rounded-xl border-2 transition-all hover:shadow-md ${template.name === preset.name
                                                    ? 'border-indigo-500 bg-indigo-50'
                                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                                    }`}
                                            >
                                                <div
                                                    className="w-full aspect-[3/4] rounded-lg mb-2 overflow-hidden"
                                                    style={{ background: preset.background, padding: 4 }}
                                                >
                                                    <div
                                                        className="w-full h-full grid"
                                                        style={{
                                                            gridTemplateRows: `repeat(${preset.layout.rows}, 1fr)`,
                                                            gridTemplateColumns: `repeat(${preset.layout.cols}, 1fr)`,
                                                            gap: 2,
                                                        }}
                                                    >
                                                        {preset.slots.map(s => (
                                                            <div
                                                                key={s.id}
                                                                className="rounded"
                                                                style={{
                                                                    border: `1px solid ${preset.borderColor}`,
                                                                    background: 'rgba(0,0,0,0.08)',
                                                                    borderRadius: Math.min(preset.borderRadius / 4, 6),
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                                <p className="text-xs font-semibold text-gray-900 truncate">{preset.name}</p>
                                                <p className="text-[10px] text-gray-500">
                                                    {preset.layout.rows}×{preset.layout.cols} · {preset.slots.length} photos
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── Layout ── */}
                            {activeTab === 'layout' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-gray-600 font-medium">Choose a grid layout</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            [1, 1], [1, 2], [1, 3],
                                            [2, 1], [2, 2], [2, 3],
                                            [3, 1], [3, 2], [4, 1],
                                        ].map(([r, c]) => (
                                            <button
                                                key={`${r}x${c}`}
                                                onClick={() => setLayout(r, c)}
                                                className={`p-3 rounded-xl border-2 transition-all ${template.layout.rows === r && template.layout.cols === c
                                                    ? 'border-indigo-500 bg-indigo-50'
                                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                                    }`}
                                            >
                                                <div
                                                    className="w-full aspect-square grid gap-1"
                                                    style={{
                                                        gridTemplateRows: `repeat(${r}, 1fr)`,
                                                        gridTemplateColumns: `repeat(${c}, 1fr)`,
                                                    }}
                                                >
                                                    {Array.from({ length: r * c }).map((_, i) => (
                                                        <div key={i} className="bg-gray-200 rounded" />
                                                    ))}
                                                </div>
                                                <p className="text-xs font-semibold text-gray-700 text-center mt-2">{r}×{c}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── Style ── */}
                            {activeTab === 'style' && (
                                <div className="space-y-5">
                                    <p className="text-sm text-gray-600 font-medium">Customize appearance</p>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Background Color</label>
                                        <div className="flex items-center gap-2">
                                            <input type="color" value={template.background.startsWith('#') ? template.background : '#ffffff'} onChange={(e) => update({ background: e.target.value })} className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer" />
                                            <input type="text" value={template.background} onChange={(e) => update({ background: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" placeholder="#fff or gradient..." />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Background Image</label>
                                        <input type="file" accept="image/*" onChange={handleBgUpload} className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer" />
                                        {backgroundImage && (
                                            <button onClick={() => setBackgroundImage(null)} className="mt-1 text-xs text-red-600 hover:underline">Remove image</button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Border Color</label>
                                            <input type="color" value={template.borderColor.startsWith('#') ? template.borderColor : '#e2e8f0'} onChange={(e) => update({ borderColor: e.target.value })} className="w-full h-9 rounded-lg border border-gray-300 cursor-pointer" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Border Width</label>
                                            <input type="range" min={0} max={10} value={template.borderWidth} onChange={(e) => update({ borderWidth: parseInt(e.target.value) })} className="w-full accent-indigo-600" />
                                            <span className="text-xs text-gray-500">{template.borderWidth}px</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Radius</label>
                                            <input type="range" min={0} max={40} value={template.borderRadius} onChange={(e) => update({ borderRadius: parseInt(e.target.value) })} className="w-full accent-indigo-600" />
                                            <span className="text-xs text-gray-500">{template.borderRadius}px</span>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Gap</label>
                                            <input type="range" min={0} max={24} value={template.gap} onChange={(e) => update({ gap: parseInt(e.target.value) })} className="w-full accent-indigo-600" />
                                            <span className="text-xs text-gray-500">{template.gap}px</span>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">Padding</label>
                                            <input type="range" min={0} max={48} value={template.padding} onChange={(e) => update({ padding: parseInt(e.target.value) })} className="w-full accent-indigo-600" />
                                            <span className="text-xs text-gray-500">{template.padding}px</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">Watermark</label>
                                        <input type="text" value={template.watermarkText} onChange={(e) => update({ watermarkText: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" placeholder="Brand name..." />
                                    </div>
                                </div>
                            )}

                            {/* ── Text ── */}
                            {activeTab === 'text' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-gray-600 font-medium">Text Elements</p>
                                        <Button variant="secondary" size="sm" onClick={addTextElement}>+ Add</Button>
                                    </div>

                                    {/* Text element list */}
                                    <div className="space-y-2">
                                        {template.textElements.map((el) => (
                                            <button
                                                key={el.id}
                                                onClick={() => setSelectedTextId(el.id)}
                                                className={`w-full text-left flex items-center justify-between p-3 rounded-xl border-2 transition-all ${selectedTextId === el.id
                                                    ? 'border-indigo-500 bg-indigo-50'
                                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                                    }`}
                                            >
                                                <div className="truncate">
                                                    <p className="text-sm font-medium text-gray-900 truncate">{el.text || '(empty)'}</p>
                                                    <p className="text-[10px] text-gray-500">{el.fontSize}px · {el.fontFamily}</p>
                                                </div>
                                                <span
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteTextElement(el.id);
                                                    }}
                                                    className="text-red-400 hover:text-red-600 text-xs cursor-pointer ml-2 shrink-0"
                                                >
                                                    ✕
                                                </span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Selected text properties */}
                                    {selectedText && (
                                        <div className="space-y-3 pt-4 border-t border-gray-200">
                                            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Properties</h4>

                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Content</label>
                                                <input type="text" value={selectedText.text} onChange={(e) => updateText(selectedText.id, { text: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Size</label>
                                                    <input type="number" min={8} max={120} value={selectedText.fontSize} onChange={(e) => updateText(selectedText.id, { fontSize: parseInt(e.target.value) || 16 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Color</label>
                                                    <input type="color" value={selectedText.color} onChange={(e) => updateText(selectedText.id, { color: e.target.value })} className="w-full h-9 rounded-lg border border-gray-300 cursor-pointer" />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Font</label>
                                                <select value={selectedText.fontFamily} onChange={(e) => updateText(selectedText.id, { fontFamily: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white">
                                                    <option value="sans-serif">Sans-Serif</option>
                                                    <option value="serif">Serif</option>
                                                    <option value="monospace">Monospace</option>
                                                    <option value="cursive">Cursive</option>
                                                    <option value="'Outfit', sans-serif">Outfit</option>
                                                </select>
                                            </div>

                                            {/* Style toggles */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => updateText(selectedText.id, { fontWeight: selectedText.fontWeight === '700' ? '400' : '700' })}
                                                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-bold transition-all ${selectedText.fontWeight === '700' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'
                                                        }`}
                                                >
                                                    B
                                                </button>
                                                <button
                                                    onClick={() => updateText(selectedText.id, { fontStyle: selectedText.fontStyle === 'italic' ? 'normal' : 'italic' })}
                                                    className={`flex-1 py-2 rounded-lg border-2 text-sm italic transition-all ${selectedText.fontStyle === 'italic' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'
                                                        }`}
                                                >
                                                    I
                                                </button>
                                                <button
                                                    onClick={() => updateText(selectedText.id, {
                                                        textShadow: selectedText.textShadow === 'none'
                                                            ? '2px 2px 4px rgba(0,0,0,0.3)'
                                                            : 'none'
                                                    })}
                                                    className={`flex-1 py-2 rounded-lg border-2 text-sm transition-all ${selectedText.textShadow !== 'none' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'
                                                        }`}
                                                >
                                                    S
                                                </button>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Letter Spacing</label>
                                                <input type="range" min={-2} max={20} value={selectedText.letterSpacing} onChange={(e) => updateText(selectedText.id, { letterSpacing: parseInt(e.target.value) })} className="w-full accent-indigo-600" />
                                                <span className="text-xs text-gray-500">{selectedText.letterSpacing}px</span>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Opacity</label>
                                                <input type="range" min={10} max={100} value={selectedText.opacity * 100} onChange={(e) => updateText(selectedText.id, { opacity: parseInt(e.target.value) / 100 })} className="w-full accent-indigo-600" />
                                                <span className="text-xs text-gray-500">{Math.round(selectedText.opacity * 100)}%</span>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Rotation</label>
                                                <input type="range" min={-45} max={45} value={selectedText.rotation} onChange={(e) => updateText(selectedText.id, { rotation: parseInt(e.target.value) })} className="w-full accent-indigo-600" />
                                                <span className="text-xs text-gray-500">{selectedText.rotation}°</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Live Preview */}
                    <div className="flex-1 bg-gray-100 p-8 flex items-center justify-center overflow-auto">
                        <div className="text-center">
                            <div
                                ref={previewRef}
                                className="relative shadow-2xl transition-all duration-300 inline-block select-none"
                                style={{
                                    width: 420,
                                    background: backgroundImage
                                        ? `url(${backgroundImage}) center/cover no-repeat`
                                        : template.background,
                                    borderRadius: template.borderRadius,
                                    padding: template.padding,
                                    border: template.borderWidth
                                        ? `${template.borderWidth}px solid ${template.borderColor}`
                                        : 'none',
                                }}
                            >
                                {/* Photo grid */}
                                <div
                                    className="grid"
                                    style={{
                                        gridTemplateRows: `repeat(${template.layout.rows}, 1fr)`,
                                        gridTemplateColumns: `repeat(${template.layout.cols}, 1fr)`,
                                        gap: template.gap,
                                    }}
                                >
                                    {template.slots.map((slot, i) => (
                                        <div
                                            key={slot.id}
                                            className="relative overflow-hidden flex items-center justify-center"
                                            style={{
                                                aspectRatio: template.layout.rows > template.layout.cols ? '4/3' : '3/4',
                                                background: backgroundImage ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)',
                                                borderRadius: Math.max(template.borderRadius - template.padding / 2, 4),
                                                border: `1px dashed ${template.borderColor}`,
                                            }}
                                        >
                                            <div className="text-center pointer-events-none">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mx-auto" style={{ color: template.borderColor }}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                                                </svg>
                                                <span className="text-[10px] font-medium block mt-1" style={{ color: template.borderColor }}>
                                                    Photo {i + 1}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Draggable text elements (absolute positioned) */}
                                {template.textElements.map((el) => (
                                    <div
                                        key={el.id}
                                        onMouseDown={(e) => startDrag(e, el.id, el.x, el.y)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedTextId(el.id);
                                            setActiveTab('text');
                                        }}
                                        className={`absolute cursor-move whitespace-nowrap ${selectedTextId === el.id ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
                                            }`}
                                        style={{
                                            left: `${el.x}%`,
                                            top: `${el.y}%`,
                                            transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
                                            fontSize: el.fontSize,
                                            fontFamily: el.fontFamily,
                                            color: el.color,
                                            fontWeight: el.fontWeight,
                                            fontStyle: el.fontStyle,
                                            textAlign: el.textAlign as any,
                                            letterSpacing: el.letterSpacing,
                                            textShadow: el.textShadow,
                                            opacity: el.opacity,
                                            lineHeight: 1.2,
                                            padding: '2px 6px',
                                            borderRadius: 4,
                                            userSelect: 'none',
                                        }}
                                    >
                                        {el.text}
                                    </div>
                                ))}

                                {/* Watermark */}
                                {template.watermarkText && (
                                    <div
                                        className="absolute bottom-2 left-0 right-0 text-center pointer-events-none"
                                        style={{
                                            fontSize: 10,
                                            opacity: 0.3,
                                            letterSpacing: 2,
                                            textTransform: 'uppercase',
                                            color: template.background.includes('linear') || template.background.startsWith('#1') || template.background.startsWith('#0')
                                                ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)',
                                        }}
                                    >
                                        {template.watermarkText}
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <p className="text-sm text-gray-500 mt-4">
                                <span className="font-semibold text-gray-900">{template.name}</span>
                                {' · '}{template.layout.rows}×{template.layout.cols} grid · {template.slots.length} photo{template.slots.length !== 1 ? 's' : ''}
                                {' · '}{template.textElements.length} text element{template.textElements.length !== 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">Click text to select · Drag to reposition</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
