'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
    X, Save, Palette, Layout, Type, Star, Image as ImageIcon, 
    ChevronLeft, ChevronRight, Plus, Trash2, Maximize, 
    Move, RotateCw, Hash, Grid, Copy, Layers, AlignCenter,
    FlipHorizontal, ArrowUp, ArrowDown, RotateCcw, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import TemplateVisualizer, { TemplateVisualizerHandle } from './TemplateVisualizer';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Sticker {
    id: string;
    src: string;
    x: number;      // percent 0-100
    y: number;      // percent 0-100
    width: number;  // px (relative to base 420 width)
    height: number; // px (0 = auto aspect ratio)
    rotation: number;
    cropX: number;  // image pan offset X percent (-50 to 50)
    cropY: number;  // image pan offset Y percent (-50 to 50)
    flipX: boolean;
    flipY: boolean;
    opacity: number;
    zIndex?: number;
}

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
    zIndex?: number;
}

interface PhotoSlot {
    id: string;
    x: number;      // percentage 0-100
    y: number;      // percentage 0-100
    width: number;  // percentage
    height: number; // percentage
    rotation: number;
}

export interface TemplateConfig {
    id: string;
    name: string;
    width: number;  // px (base unit for scaling)
    height: number; // px
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
    stickers?: Sticker[];
    watermarkText: string;
    backgroundSnapshot?: string; // Data URL or URL for flattened background
    foregroundSnapshot?: string; // Data URL or URL for flattened foreground (stickers, text, borders)
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
        width: 420,
        height: 630,
        layout: { rows: 1, cols: 1 },
        slots: [{ id: 's1', x: 5, y: 15, width: 90, height: 70, rotation: 0 }],
        background: '#ffffff',
        borderColor: '#d4af37',
        borderWidth: 3,
        borderRadius: 16,
        gap: 0,
        padding: 36,
        textElements: [
            createDefaultTextElement({ text: 'Our Special Day', x: 50, y: 5, fontSize: 24, fontFamily: 'Georgia, serif', color: '#92400e', letterSpacing: 2 }),
            createDefaultTextElement({ id: 'date1', text: '14 February 2026', x: 50, y: 92, fontSize: 13, color: '#b45309', fontWeight: '400', fontStyle: 'italic', letterSpacing: 3 }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 2. Neon Glow ───────────────────────────────────────────────
    {
        name: 'Neon Glow',
        width: 420,
        height: 630,
        layout: { rows: 4, cols: 1 },
        slots: [
            { id: 's1', x: 5, y: 7, width: 90, height: 18, rotation: 0 },
            { id: 's2', x: 5, y: 28, width: 90, height: 18, rotation: 0 },
            { id: 's3', x: 5, y: 49, width: 90, height: 18, rotation: 0 },
            { id: 's4', x: 5, y: 70, width: 90, height: 18, rotation: 0 },
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
        width: 420,
        height: 630,
        layout: { rows: 1, cols: 1 },
        slots: [{ id: 's1', x: 10, y: 10, width: 80, height: 70, rotation: 0 }],
        background: '#fefce8',
        borderColor: '#e5e5e5',
        borderWidth: 0,
        borderRadius: 4,
        gap: 0,
        padding: 24,
        textElements: [
            createDefaultTextElement({ text: 'instant memories', x: 50, y: 90, fontSize: 18, fontFamily: 'cursive', color: '#44403c', fontWeight: '400', rotation: -2 }),
        ],
        watermarkText: '',
    },
    // ── 4. Sunset Vibes ────────────────────────────────────────────
    {
        name: 'Sunset Vibes',
        width: 420,
        height: 630,
        layout: { rows: 2, cols: 2 },
        slots: [
            { id: 's1', x: 4, y: 15, width: 44, height: 35, rotation: 0 },
            { id: 's2', x: 52, y: 15, width: 44, height: 35, rotation: 0 },
            { id: 's3', x: 4, y: 55, width: 44, height: 35, rotation: 0 },
            { id: 's4', x: 52, y: 55, width: 44, height: 35, rotation: 0 },
        ],
        background: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #8b5cf6 100%)',
        borderColor: 'rgba(255,255,255,0.4)',
        borderWidth: 2,
        borderRadius: 20,
        gap: 8,
        padding: 24,
        textElements: [
            createDefaultTextElement({ text: 'SUNSET VIBES', x: 50, y: 4, fontSize: 22, color: '#ffffff', fontWeight: '900', letterSpacing: 4, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }),
            createDefaultTextElement({ id: 'sub1', text: 'golden hour', x: 50, y: 94, fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '400', fontStyle: 'italic' }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 5. Emerald Luxe ────────────────────────────────────────────
    {
        name: 'Emerald Luxe',
        width: 420,
        height: 630,
        layout: { rows: 2, cols: 1 },
        slots: [
            { id: 's1', x: 10, y: 10, width: 80, height: 38, rotation: 0 },
            { id: 's2', x: 10, y: 52, width: 80, height: 38, rotation: 0 },
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
        width: 420,
        height: 630,
        layout: { rows: 3, cols: 1 },
        slots: [
            { id: 's1', x: 15, y: 5, width: 70, height: 28, rotation: 0 },
            { id: 's2', x: 15, y: 35, width: 70, height: 28, rotation: 0 },
            { id: 's3', x: 15, y: 65, width: 70, height: 28, rotation: 0 },
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
        width: 420,
        height: 630,
        layout: { rows: 3, cols: 3 },
        slots: [
            { id: 's1', x: 5, y: 15, width: 28, height: 25, rotation: 0 }, { id: 's2', x: 36, y: 15, width: 28, height: 25, rotation: 0 }, { id: 's3', x: 67, y: 15, width: 28, height: 25, rotation: 0 },
            { id: 's4', x: 5, y: 43, width: 28, height: 25, rotation: 0 }, { id: 's5', x: 36, y: 43, width: 28, height: 25, rotation: 0 }, { id: 's6', x: 67, y: 43, width: 28, height: 25, rotation: 0 },
            { id: 's7', x: 5, y: 71, width: 28, height: 25, rotation: 0 }, { id: 's8', x: 36, y: 71, width: 28, height: 25, rotation: 0 }, { id: 's9', x: 67, y: 71, width: 28, height: 25, rotation: 0 },
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
        name: 'Tropical Party',
        width: 420,
        height: 630,
        layout: { rows: 2, cols: 2 },
        slots: [
            { id: 's1', x: 5, y: 15, width: 42, height: 35, rotation: 0 },
            { id: 's2', x: 53, y: 15, width: 42, height: 35, rotation: 0 },
            { id: 's3', x: 5, y: 55, width: 42, height: 35, rotation: 0 },
            { id: 's4', x: 53, y: 55, width: 42, height: 35, rotation: 0 },
        ],
        background: 'linear-gradient(180deg, #0ea5e9 0%, #06b6d4 40%, #10b981 100%)',
        borderColor: 'rgba(255,255,255,0.5)',
        borderWidth: 3,
        borderRadius: 24,
        gap: 10,
        padding: 28,
        textElements: [
            createDefaultTextElement({ text: 'TROPICAL VIBES', x: 50, y: 4, fontSize: 18, color: '#ffffff', fontWeight: '800', textShadow: '0 2px 6px rgba(0,0,0,0.25)' }),
            createDefaultTextElement({ id: 'sub1', text: 'Summer Party 2026', x: 50, y: 94, fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '400' }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 9. Lavender Dreams ─────────────────────────────────────────
    {
        name: 'Lavender Dreams',
        width: 420,
        height: 630,
        layout: { rows: 1, cols: 2 },
        slots: [
            { id: 's1', x: 5, y: 20, width: 44, height: 60, rotation: 0 },
            { id: 's2', x: 51, y: 20, width: 44, height: 60, rotation: 0 },
        ],
        background: 'linear-gradient(135deg, #c4b5fd 0%, #f0abfc 50%, #fecdd3 100%)',
        borderColor: 'rgba(255,255,255,0.6)',
        borderWidth: 2,
        borderRadius: 20,
        gap: 10,
        padding: 28,
        textElements: [
            createDefaultTextElement({ text: 'Dreamy Duo', x: 50, y: 8, fontSize: 26, fontFamily: 'Georgia, serif', color: '#581c87', fontStyle: 'italic' }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 10. Midnight Blue ──────────────────────────────────────────
    {
        name: 'Midnight Blue',
        width: 420,
        height: 630,
        layout: { rows: 3, cols: 2 },
        slots: [
            { id: 's1', x: 5, y: 10, width: 44, height: 25, rotation: 0 }, { id: 's2', x: 51, y: 10, width: 44, height: 25, rotation: 0 },
            { id: 's3', x: 5, y: 38, width: 44, height: 25, rotation: 0 }, { id: 's4', x: 51, y: 38, width: 44, height: 25, rotation: 0 },
            { id: 's5', x: 5, y: 66, width: 44, height: 25, rotation: 0 }, { id: 's6', x: 51, y: 66, width: 44, height: 25, rotation: 0 },
        ],
        background: 'linear-gradient(180deg, #020617 0%, #0f172a 50%, #1e1b4b 100%)',
        borderColor: '#6366f1',
        borderWidth: 2,
        borderRadius: 16,
        gap: 6,
        padding: 20,
        textElements: [
            createDefaultTextElement({ text: 'MIDNIGHT GALA', x: 50, y: 2, fontSize: 18, color: '#c7d2fe', fontWeight: '800', letterSpacing: 3, textShadow: '0 0 12px rgba(99,102,241,0.5)' }),
            createDefaultTextElement({ id: 'sub1', text: 'Under the Stars', x: 50, y: 96, fontSize: 11, color: '#818cf8', fontWeight: '400', fontStyle: 'italic' }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 11. Modern Mono ────────────────────────────────────────────
    {
        name: 'Modern Mono',
        width: 420,
        height: 630,
        layout: { rows: 1, cols: 3 },
        slots: [
            { id: 's1', x: 5, y: 25, width: 28, height: 50, rotation: 0 },
            { id: 's2', x: 36, y: 25, width: 28, height: 50, rotation: 0 },
            { id: 's3', x: 67, y: 25, width: 28, height: 50, rotation: 0 },
        ],
        background: '#ffffff',
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
        width: 420,
        height: 630,
        layout: { rows: 2, cols: 1 },
        slots: [
            { id: 's1', x: 10, y: 15, width: 80, height: 35, rotation: 0 },
            { id: 's2', x: 10, y: 55, width: 80, height: 35, rotation: 0 },
        ],
        background: 'linear-gradient(180deg, #1c1917 0%, #292524 100%)',
        borderColor: '#d4a574',
        borderWidth: 3,
        borderRadius: 20,
        gap: 10,
        padding: 32,
        textElements: [
            createDefaultTextElement({ text: 'With Love', x: 50, y: 4, fontSize: 24, fontFamily: 'Georgia, serif', color: '#d4a574', fontStyle: 'italic', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }),
            createDefaultTextElement({ id: 'sub1', text: 'FOREVER & ALWAYS', x: 50, y: 95, fontSize: 10, color: '#a8a29e', fontWeight: '600', letterSpacing: 5 }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 13. Valentine's Day 💕 ────────────────────────────────────
    {
        name: "Valentine's Day",
        width: 420,
        height: 630,
        layout: { rows: 2, cols: 2 },
        slots: [
            { id: 's1', x: 4, y: 15, width: 44, height: 35, rotation: 0 },
            { id: 's2', x: 52, y: 15, width: 44, height: 35, rotation: 0 },
            { id: 's3', x: 4, y: 55, width: 44, height: 35, rotation: 0 },
            { id: 's4', x: 52, y: 55, width: 44, height: 35, rotation: 0 },
        ],
        background: 'linear-gradient(135deg, #4a0020 0%, #1a0010 40%, #2d0015 70%, #0d0008 100%)',
        borderColor: '#e11d48',
        borderWidth: 3,
        borderRadius: 24,
        gap: 10,
        padding: 32,
        textElements: [
            createDefaultTextElement({ text: 'Happy Valentine\'s', x: 50, y: 4, fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", color: '#fda4af', fontWeight: '700', letterSpacing: 1, textShadow: '0 0 20px rgba(225,29,72,0.5)' }),
            createDefaultTextElement({ id: 'date1', text: '14 February 2026', x: 50, y: 95, fontSize: 12, fontFamily: "'Playfair Display', Georgia, serif", color: '#fecdd3', fontWeight: '400', fontStyle: 'italic', letterSpacing: 3, textShadow: '0 0 10px rgba(225,29,72,0.4)' }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 14. Cerulean Romance 💙 ────────────────────────────────────
    {
        name: "Cerulean Romance",
        width: 420,
        height: 630,
        layout: { rows: 3, cols: 2 },
        slots: [
            { id: 's1', x: 38, y: 5, width: 57, height: 60, rotation: 0 },
            { id: 's2', x: 38, y: 68, width: 27, height: 25, rotation: 0 },
            { id: 's3', x: 68, y: 68, width: 27, height: 25, rotation: 0 },
        ],
        background: '#f0f9ff',
        backgroundImage: 'cerulean_romance_floral_bg_1778154139873.png',
        borderColor: '#94a3b8',
        borderWidth: 1,
        borderRadius: 4,
        gap: 12,
        padding: 24,
        textElements: [
            createDefaultTextElement({ text: 'Garvin & Christina', x: 18, y: 42, fontSize: 26, fontFamily: "'Playfair Display', serif", color: '#1e293b', fontWeight: '700' }),
            createDefaultTextElement({ id: 'date1', text: 'MAY 13, 2026', x: 18, y: 62, fontSize: 10, color: '#64748b', fontWeight: '900', letterSpacing: 4 }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 15. Cinematic Panorama (Landscape) 🎞️ ──────────────────────────
    {
        name: "Cinematic Panorama",
        width: 630,
        height: 420,
        layout: { rows: 1, cols: 3 },
        slots: [
            { id: 's1', x: 4, y: 15, width: 30, height: 70, rotation: 0 },
            { id: 's2', x: 35, y: 15, width: 30, height: 70, rotation: 0 },
            { id: 's3', x: 66, y: 15, width: 30, height: 70, rotation: 0 },
        ],
        background: '#09090b',
        borderColor: '#3f3f46',
        borderWidth: 1,
        borderRadius: 4,
        gap: 10,
        padding: 20,
        textElements: [
            createDefaultTextElement({ text: 'WIDESCREEN SERIES', x: 50, y: 5, fontSize: 14, color: '#ffffff', fontWeight: '900', letterSpacing: 10 }),
            createDefaultTextElement({ id: 'sub', text: 'SHOT ON LOCATION', x: 50, y: 92, fontSize: 8, color: '#71717a', fontWeight: '600', letterSpacing: 4 }),
        ],
        watermarkText: '',
    },
    // ── 16. Heritage Strip (2x6) 📽️ ──────────────────────────────────
    {
        name: "Heritage Strip",
        width: 210,
        height: 630,
        layout: { rows: 4, cols: 1 },
        slots: [
            { id: 's1', x: 10, y: 8, width: 80, height: 18, rotation: 0 },
            { id: 's2', x: 10, y: 28, width: 80, height: 18, rotation: 0 },
            { id: 's3', x: 10, y: 48, width: 80, height: 18, rotation: 0 },
            { id: 's4', x: 10, y: 68, width: 80, height: 18, rotation: 0 },
        ],
        background: '#fafafa',
        borderColor: '#e5e7eb',
        borderWidth: 0,
        borderRadius: 0,
        gap: 6,
        padding: 12,
        textElements: [
            createDefaultTextElement({ text: 'EST. 2026', x: 50, y: 3, fontSize: 8, color: '#9ca3af', fontWeight: '800' }),
            createDefaultTextElement({ id: 'sub', text: 'PHOTOSTRIP', x: 50, y: 92, fontSize: 12, fontFamily: 'serif', color: '#111827', fontWeight: '700', fontStyle: 'italic' }),
        ],
        watermarkText: 'SnapWrap',
    },
    // ── 17. Social Square (1:1) 📸 ──────────────────────────────────
    {
        name: "Social Square",
        width: 600,
        height: 600,
        layout: { rows: 2, cols: 2 },
        slots: [
            { id: 's1', x: 5, y: 5, width: 44, height: 44, rotation: 0 },
            { id: 's2', x: 51, y: 5, width: 44, height: 44, rotation: 0 },
            { id: 's3', x: 5, y: 51, width: 44, height: 44, rotation: 0 },
            { id: 's4', x: 51, y: 51, width: 44, height: 44, rotation: 0 },
        ],
        background: '#ffffff',
        borderColor: '#f1f5f9',
        borderWidth: 2,
        borderRadius: 32,
        gap: 10,
        padding: 30,
        textElements: [
            createDefaultTextElement({ text: 'SQUARE COLLECTION', x: 50, y: 50, fontSize: 14, color: '#0f172a', fontWeight: '900', letterSpacing: 2, textShadow: '0 0 10px white' }),
        ],
        watermarkText: '',
    },
];

function createBlankTemplate(rows: number, cols: number): Omit<TemplateConfig, 'id'> {
    const slots: PhotoSlot[] = [];
    const pad = 10;
    const gap = 4;
    const slotW = (100 - pad * 2 - gap * (cols - 1)) / cols;
    const slotH = (100 - pad * 2 - gap * (rows - 1)) / rows;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            slots.push({
                id: `s_${r}_${c}`,
                x: pad + c * (slotW + gap),
                y: pad + r * (slotH + gap),
                width: slotW,
                height: slotH,
                rotation: 0
            });
        }
    }
    return {
        name: `Custom ${rows}×${cols}`,
        width: 420,
        height: 630,
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

type DesignTab = 'presets' | 'layout' | 'style' | 'text' | 'stickers';

interface TemplateDesignerProps {
    initialTemplate?: TemplateConfig | null;
    onSave: (config: TemplateConfig) => void;
    onClose: () => void;
}

// ─── Draggable Text Hook ────────────────────────────────────────────────────

function useDraggable(
    previewRef: React.RefObject<HTMLDivElement | null>,
    onMove: (id: string, x: number, y: number) => void,
    onDragEnd?: () => void
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
            if (onDragEnd) onDragEnd();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [previewRef, onMove, onDragEnd]);

    return startDrag;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TemplateDesigner({ initialTemplate, onSave, onClose }: TemplateDesignerProps) {
    const [template, setTemplate] = useState<TemplateConfig>(() => {
        if (initialTemplate) return { ...initialTemplate } as TemplateConfig;
        return { id: generateId(), ...PRESET_TEMPLATES[0] } as TemplateConfig;
    });
    const [activeTab, setActiveTab] = useState<DesignTab>('presets');
    const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
    const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
    const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
    const [backgroundImage, setBackgroundImage] = useState<string | null>(initialTemplate?.backgroundImage || null);
    const [userStickers, setUserStickers] = useState<{ id: string; image_url: string }[]>([]);
    const [loadingStickers, setLoadingStickers] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const visualizerRef = useRef<TemplateVisualizerHandle>(null);

    // ── Context Menu State ──
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        elementId: string;
        elementType: 'slot' | 'text' | 'sticker';
    } | null>(null);

    // ── History Management ──
    const [history, setHistory] = useState<TemplateConfig[]>([(() => {
        if (initialTemplate) return { ...initialTemplate };
        return { id: generateId(), ...PRESET_TEMPLATES[0] };
    })()]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const pushToHistory = useCallback((newTemplate: TemplateConfig) => {
        setHistory(prev => {
            const next = prev.slice(0, historyIndex + 1);
            // Limit history to 50 steps
            if (next.length > 50) next.shift();
            return [...next, JSON.parse(JSON.stringify(newTemplate))];
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
    }, [historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex > 0) {
            const prev = history[historyIndex - 1];
            setTemplate(JSON.parse(JSON.stringify(prev)));
            setHistoryIndex(historyIndex - 1);
        }
    }, [history, historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const next = history[historyIndex + 1];
            setTemplate(JSON.parse(JSON.stringify(next)));
            setHistoryIndex(historyIndex + 1);
        }
    }, [history, historyIndex]);

    const previewRef = useRef<HTMLDivElement>(null);

    // ── Custom Presets Management ──
    const [userPresets, setUserPresets] = useState<{name: string, width: number, height: number}[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('snapwrap_user_presets');
        if (saved) {
            try {
                setUserPresets(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load user presets", e);
            }
        }
    }, []);

    const saveCustomPreset = () => {
        const name = prompt("Enter a name for this custom size:", `${template.width}x${template.height} Custom`);
        if (!name) return;
        
        const newPreset = { name, width: template.width, height: template.height };
        const updated = [...userPresets, newPreset];
        setUserPresets(updated);
        localStorage.setItem('snapwrap_user_presets', JSON.stringify(updated));
    };

    const deleteCustomPreset = (index: number) => {
        if (!confirm("Are you sure you want to delete this custom size?")) return;
        const updated = userPresets.filter((_, i) => i !== index);
        setUserPresets(updated);
        localStorage.setItem('snapwrap_user_presets', JSON.stringify(updated));
    };

    // ── Fetch User Stickers ──
    useEffect(() => {
        const fetchUserStickers = async () => {
            setLoadingStickers(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoadingStickers(false);
                return;
            }

            const { data, error } = await supabase
                .from('user_stickers')
                .select('id, image_url')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setUserStickers(data);
            }
            setLoadingStickers(false);
        };

        fetchUserStickers();
    }, []);
function useResizable(containerRef: React.RefObject<HTMLDivElement | null>, onResize: (id: string, w: number, h: number, x: number, y: number) => void, onEnd?: () => void) {
    const activeId = useRef<string | null>(null);
    const handleType = useRef<string | null>(null);
    const startData = useRef<{ x: number, y: number, w: number, h: number, mx: number, my: number } | null>(null);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!activeId.current || !startData.current || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const dx = ((e.clientX - startData.current.mx) / rect.width) * 100;
        const dy = ((e.clientY - startData.current.my) / rect.height) * 100;

        let { x, y, w, h } = startData.current;
        const type = handleType.current;

        if (type?.includes('e')) w += dx;
        if (type?.includes('w')) { w -= dx; x += dx; }
        if (type?.includes('s')) h += dy;
        if (type?.includes('n')) { h -= dy; y += dy; }

        // Uniform scaling for single-dimension elements (Text/Stickers)
        if (startData.current.h === 0) {
            if (type?.includes('n')) w -= dy;
            if (type?.includes('s')) w += dy;
        }

        onResize(activeId.current, Math.max(2, w), Math.max(2, h), x, y);
    }, [onResize, containerRef]);

    const handleMouseUp = useCallback(() => {
        if (activeId.current) onEnd?.();
        activeId.current = null;
        handleType.current = null;
        startData.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove, onEnd]);

    const startResize = useCallback((e: React.MouseEvent, id: string, type: string, x: number, y: number, w: number, h: number) => {
        e.stopPropagation();
        e.preventDefault();
        activeId.current = id;
        handleType.current = type;
        startData.current = { x, y, w, h, mx: e.clientX, my: e.clientY };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove, handleMouseUp]);

    return startResize;
}

    const update = useCallback((patch: Partial<TemplateConfig>) => {
        setTemplate((prev) => ({ ...prev, ...patch }));
    }, []);

    const applyPreset = useCallback((preset: Omit<TemplateConfig, 'id'>) => {
        const next = { id: generateId(), ...preset, stickers: [] } as TemplateConfig;
        setTemplate(next);
        setBackgroundImage(preset.backgroundImage || null);
        pushToHistory(next);
        setSelectedTextId(null);
        setSelectedStickerId(null);
        setSelectedSlotId(null);
    }, [pushToHistory]);

    const setLayout = useCallback((rows: number, cols: number) => {
        const blank = createBlankTemplate(rows, cols);
        const next = { ...template, layout: blank.layout, slots: blank.slots };
        setTemplate(next);
        pushToHistory(next);
    }, [template, pushToHistory]);

    const updateSlot = useCallback((id: string, patch: Partial<PhotoSlot>) => {
        setTemplate(prev => ({
            ...prev,
            slots: prev.slots.map(s => s.id === id ? { ...s, ...patch } : s),
        }));
    }, []);

    const deleteSlot = useCallback((id: string) => {
        setTemplate(prev => {
            const next = {
                ...prev,
                slots: prev.slots.filter(s => s.id !== id),
            };
            pushToHistory(next);
            return next;
        });
        setSelectedSlotId(null);
    }, [pushToHistory]);

    // Text operations
    const updateText = useCallback((id: string, patch: Partial<TextElement>) => {
        setTemplate(prev => ({
            ...prev,
            textElements: prev.textElements.map(t => t.id === id ? { ...t, ...patch } : t),
        }));
    }, []);

    const addTextElement = useCallback(() => {
        const el = createDefaultTextElement();
        setTemplate(prev => {
            const next = { ...prev, textElements: [...prev.textElements, el] };
            pushToHistory(next);
            return next;
        });
        setSelectedTextId(el.id);
    }, [pushToHistory]);

    const deleteTextElement = useCallback((id: string) => {
        setTemplate(prev => {
            const next = {
                ...prev,
                textElements: prev.textElements.filter(t => t.id !== id),
            };
            pushToHistory(next);
            return next;
        });
        setSelectedTextId(null);
    }, [pushToHistory]);

    const moveText = useCallback((id: string, x: number, y: number) => {
        updateText(id, { x, y });
    }, [updateText]);

    // Sticker operations
    const createDefaultSticker = (src: string): Sticker => ({
        id: `stk_${Date.now()}`,
        src,
        x: 50,
        y: 50,
        width: 100,
        height: 0,
        rotation: 0,
        cropX: 0,
        cropY: 0,
        flipX: false,
        flipY: false,
        opacity: 1,
    });

    const addSticker = useCallback((src: string) => {
        const stk = createDefaultSticker(src);
        setTemplate(prev => {
            const next = { ...prev, stickers: [...(prev.stickers || []), stk] };
            pushToHistory(next);
            return next;
        });
        setSelectedStickerId(stk.id);
    }, [pushToHistory]);

    const updateSticker = useCallback((id: string, patch: Partial<Sticker>) => {
        setTemplate(prev => ({
            ...prev,
            stickers: (prev.stickers || []).map(s => s.id === id ? { ...s, ...patch } : s),
        }));
    }, []);

    const deleteSticker = useCallback((id: string) => {
        setTemplate(prev => {
            const next = {
                ...prev,
                stickers: (prev.stickers || []).filter(s => s.id !== id),
            };
            pushToHistory(next);
            return next;
        });
        setSelectedStickerId(null);
    }, [pushToHistory]);

    const moveSticker = useCallback((id: string, x: number, y: number) => {
        updateSticker(id, { x, y });
    }, [updateSticker]);

    // Unified drag handler
    const moveElement = useCallback((id: string, x: number, y: number) => {
        if (id.startsWith('stk_')) {
            moveSticker(id, x, y);
        } else if (id.startsWith('txt_')) {
            moveText(id, x, y);
        } else {
            updateSlot(id, { x, y });
        }
    }, [moveSticker, moveText, updateSlot]);

    const resizeElement = useCallback((id: string, w: number, h: number, x: number, y: number) => {
        if (id.startsWith('stk_')) {
            updateSticker(id, { width: w * (template.width / 100), x, y });
        } else if (id.startsWith('txt_')) {
            updateText(id, { fontSize: Math.max(8, w * (template.width / 100) / 4), x, y });
        } else {
            updateSlot(id, { width: w, height: h, x, y });
        }
    }, [updateSticker, updateText, updateSlot, template.width]);

    const startDrag = useDraggable(previewRef, moveElement, () => pushToHistory(template));
    const startResize = useResizable(previewRef, resizeElement, () => pushToHistory(template));

    // ── Context Menu Handlers ──
    const openContextMenu = useCallback((e: React.MouseEvent, elementId: string, elementType: 'slot' | 'text' | 'sticker') => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, elementId, elementType });
        // Auto-select the element
        if (elementType === 'slot') { setSelectedSlotId(elementId); setSelectedTextId(null); setSelectedStickerId(null); }
        else if (elementType === 'text') { setSelectedTextId(elementId); setSelectedSlotId(null); setSelectedStickerId(null); }
        else if (elementType === 'sticker') { setSelectedStickerId(elementId); setSelectedSlotId(null); setSelectedTextId(null); }
    }, []);

    const duplicateElement = useCallback((id: string, type: 'slot' | 'text' | 'sticker') => {
        if (type === 'slot') {
            const src = template.slots.find(s => s.id === id);
            if (!src) return;
            const newId = `s${template.slots.length + 1}`;
            const dup = { ...src, id: newId, x: Math.min(src.x + 5, 90), y: Math.min(src.y + 5, 90) };
            setTemplate(prev => { const next = { ...prev, slots: [...prev.slots, dup] }; pushToHistory(next); return next; });
            setSelectedSlotId(newId);
        } else if (type === 'text') {
            const src = template.textElements.find(t => t.id === id);
            if (!src) return;
            const dup = { ...src, id: `txt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, x: Math.min(src.x + 5, 95), y: Math.min(src.y + 5, 95) };
            setTemplate(prev => { const next = { ...prev, textElements: [...prev.textElements, dup] }; pushToHistory(next); return next; });
            setSelectedTextId(dup.id);
        } else if (type === 'sticker') {
            const src = (template.stickers || []).find(s => s.id === id);
            if (!src) return;
            const dup = { ...src, id: `stk_${Date.now()}`, x: Math.min(src.x + 5, 95), y: Math.min(src.y + 5, 95) };
            setTemplate(prev => { const next = { ...prev, stickers: [...(prev.stickers || []), dup] }; pushToHistory(next); return next; });
            setSelectedStickerId(dup.id);
        }
        setContextMenu(null);
    }, [template, pushToHistory]);

    const resetElementPosition = useCallback((id: string, type: 'slot' | 'text' | 'sticker') => {
        if (type === 'slot') updateSlot(id, { x: 10, y: 10, rotation: 0 });
        else if (type === 'text') updateText(id, { x: 50, y: 50, rotation: 0 });
        else if (type === 'sticker') updateSticker(id, { x: 50, y: 50, rotation: 0 });
        pushToHistory(template);
        setContextMenu(null);
    }, [updateSlot, updateText, updateSticker, pushToHistory, template]);

    const resetElementRotation = useCallback((id: string, type: 'slot' | 'text' | 'sticker') => {
        if (type === 'slot') updateSlot(id, { rotation: 0 });
        else if (type === 'text') updateText(id, { rotation: 0 });
        else if (type === 'sticker') updateSticker(id, { rotation: 0 });
        pushToHistory(template);
        setContextMenu(null);
    }, [updateSlot, updateText, updateSticker, pushToHistory, template]);

    const bringToFront = useCallback((id: string, type: 'slot' | 'text' | 'sticker') => {
        if (type === 'slot') {
            setTemplate(prev => {
                const idx = prev.slots.findIndex(s => s.id === id);
                if (idx < 0) return prev;
                const slots = [...prev.slots];
                const [item] = slots.splice(idx, 1);
                slots.push(item);
                const next = { ...prev, slots };
                pushToHistory(next);
                return next;
            });
        } else if (type === 'text') {
            setTemplate(prev => {
                const idx = prev.textElements.findIndex(t => t.id === id);
                if (idx < 0) return prev;
                const textElements = [...prev.textElements];
                const [item] = textElements.splice(idx, 1);
                textElements.push(item);
                const next = { ...prev, textElements };
                pushToHistory(next);
                return next;
            });
        } else if (type === 'sticker') {
            setTemplate(prev => {
                const stickers = [...(prev.stickers || [])];
                const idx = stickers.findIndex(s => s.id === id);
                if (idx < 0) return prev;
                const [item] = stickers.splice(idx, 1);
                stickers.push(item);
                const next = { ...prev, stickers };
                pushToHistory(next);
                return next;
            });
        }
        setContextMenu(null);
    }, [pushToHistory]);

    const sendToBack = useCallback((id: string, type: 'slot' | 'text' | 'sticker') => {
        if (type === 'slot') {
            setTemplate(prev => {
                const idx = prev.slots.findIndex(s => s.id === id);
                if (idx < 0) return prev;
                const slots = [...prev.slots];
                const [item] = slots.splice(idx, 1);
                slots.unshift(item);
                const next = { ...prev, slots };
                pushToHistory(next);
                return next;
            });
        } else if (type === 'text') {
            setTemplate(prev => {
                const idx = prev.textElements.findIndex(t => t.id === id);
                if (idx < 0) return prev;
                const textElements = [...prev.textElements];
                const [item] = textElements.splice(idx, 1);
                textElements.unshift(item);
                const next = { ...prev, textElements };
                pushToHistory(next);
                return next;
            });
        } else if (type === 'sticker') {
            setTemplate(prev => {
                const stickers = [...(prev.stickers || [])];
                const idx = stickers.findIndex(s => s.id === id);
                if (idx < 0) return prev;
                const [item] = stickers.splice(idx, 1);
                stickers.unshift(item);
                const next = { ...prev, stickers };
                pushToHistory(next);
                return next;
            });
        }
        setContextMenu(null);
    }, [pushToHistory]);

    const deleteFromContextMenu = useCallback((id: string, type: 'slot' | 'text' | 'sticker') => {
        if (type === 'slot') deleteSlot(id);
        else if (type === 'text') deleteTextElement(id);
        else if (type === 'sticker') deleteSticker(id);
        setContextMenu(null);
    }, [deleteSlot, deleteTextElement, deleteSticker]);

    // Close context menu on any click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (contextMenu) window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [contextMenu]);

    // ── Keyboard Shortcuts ──
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Undo/Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }

            // Delete
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Only if not typing in an input
                if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
                
                if (selectedSlotId) deleteSlot(selectedSlotId);
                else if (selectedTextId) deleteTextElement(selectedTextId);
                else if (selectedStickerId) deleteSticker(selectedStickerId);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, selectedSlotId, selectedTextId, selectedStickerId, deleteSlot, deleteTextElement, deleteSticker]);

    const handleStickerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Read and add to current template immediately
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const dataUrl = ev.target?.result as string;
            if (!dataUrl) return;

            // Add to template
            addSticker(dataUrl);

            // Save to database for reuse
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return; // Not logged in, skip DB save

                // Upload to storage
                const fileName = `stickers/${user.id}/${Date.now()}_${file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('booth-photos')
                    .upload(fileName, file, { contentType: file.type, upsert: false });

                if (uploadError) {
                    console.error('Sticker upload error:', uploadError);
                    return;
                }

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('booth-photos')
                    .getPublicUrl(fileName);

                const publicUrl = urlData.publicUrl;

                // Insert into user_stickers table
                const { data: newSticker, error: insertError } = await supabase
                    .from('user_stickers')
                    .insert({
                        user_id: user.id,
                        storage_path: fileName,
                        image_url: publicUrl,
                    })
                    .select('id, image_url')
                    .single();

                if (!insertError && newSticker) {
                    // Add to local state
                    setUserStickers(prev => [newSticker, ...prev]);
                }
            } catch (err) {
                console.error('Error saving sticker:', err);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setBackgroundImage(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const handleSaveClick = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            let finalTemplate = { ...template };
            
            // Generate snapshots if visualizer is ready
            if (visualizerRef.current) {
                const snapshots = await visualizerRef.current.getSnapshot();
                finalTemplate.backgroundSnapshot = snapshots.background;
                finalTemplate.foregroundSnapshot = snapshots.foreground;
            }

            onSave(finalTemplate);
        } catch (error) {
            console.error('Error generating snapshots:', error);
            onSave(template); // Fallback to basic save
        } finally {
            setIsSaving(false);
        }
    };

    const selectedText = template.textElements.find(t => t.id === selectedTextId);
    const selectedSticker = (template.stickers || []).find(s => s.id === selectedStickerId);

    // ── Tabs ─────────────────────────────────────────────────────────────
    const tabs: { key: DesignTab; label: string; icon: any }[] = [
        { key: 'presets', label: 'Presets', icon: Palette },
        { key: 'layout', label: 'Layout', icon: Layout },
        { key: 'style', label: 'Style', icon: Palette },
        { key: 'text', label: 'Text', icon: Type },
        { key: 'stickers', label: 'Stickers', icon: Star },
    ];

    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[500] bg-neutral-900/95 backdrop-blur-xl flex flex-col font-sans"
            >
                {/* Hidden Visualizer for Snapshotting */}
                <div className="fixed -top-[5000px] -left-[5000px] pointer-events-none opacity-0">
                    <TemplateVisualizer 
                        ref={visualizerRef}
                        template={template}
                    />
                </div>
                <style dangerouslySetInnerHTML={{ __html: `
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 4px;
                        height: 4px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(255,255,255,0.1);
                        border-radius: 10px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: rgba(255,255,255,0.2);
                    }
                `}} />

                {/* Header */}
                <header className="h-20 shrink-0 bg-neutral-950 border-b border-white/5 flex items-center justify-between px-10">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <h1 className="text-xl font-black text-white uppercase tracking-tight">Template Protocol</h1>
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Visual Matrix Architecture</p>
                        </div>
                        <div className="h-8 w-px bg-white/10" />
                        <div className="flex items-center gap-4">
                            <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Matrix Identity</label>
                            <input
                                type="text"
                                value={template.name}
                                onChange={(e) => update({ name: e.target.value })}
                                className="bg-neutral-900 border border-white/5 rounded-full px-5 py-2 text-xs font-black text-white focus:outline-none focus:border-blue-500/50 transition-all w-64"
                                placeholder="IDENT_STRING"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-neutral-900 border border-white/5 rounded-full p-1 mr-4">
                            <button 
                                onClick={undo} 
                                disabled={historyIndex === 0}
                                className="w-9 h-9 flex items-center justify-center hover:bg-white/5 disabled:opacity-20 transition-all rounded-full text-neutral-400"
                                title="Undo (Ctrl+Z)"
                            >
                                <RotateCw size={16} className="scale-x-[-1]" />
                            </button>
                            <button 
                                onClick={redo} 
                                disabled={historyIndex === history.length - 1}
                                className="w-9 h-9 flex items-center justify-center hover:bg-white/5 disabled:opacity-20 transition-all rounded-full text-neutral-400"
                                title="Redo (Ctrl+Shift+Z)"
                            >
                                <RotateCw size={16} />
                            </button>
                        </div>

                        <button onClick={onClose} className="px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-white transition-all">Cancel</button>
                        <button 
                            onClick={handleSaveClick}
                            disabled={isSaving}
                            className="px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 text-white bg-blue-600 hover:scale-105 active:scale-95 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Snapshotting...
                                </span>
                            ) : (
                                <>
                                    <Save size={14} /> 
                                    Commit Design
                                </>
                            )}
                        </button>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <aside className="w-80 bg-neutral-950 border-r border-white/5 flex flex-col overflow-hidden">
                        {/* Tab Bar */}
                        <div className="grid grid-cols-5 gap-1 p-3 bg-white/5 border-b border-white/5">
                            {tabs.map((t) => (
                                <button
                                    key={t.key}
                                    onClick={() => setActiveTab(t.key)}
                                    className={`flex flex-col items-center gap-1.5 py-3 rounded-lg transition-all ${
                                        activeTab === t.key 
                                        ? 'bg-white text-neutral-900 shadow-xl' 
                                        : 'text-neutral-500 hover:text-white'
                                    }`}
                                >
                                    <t.icon size={14} />
                                    <span className="text-[7px] font-black uppercase tracking-tighter">{t.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                            {/* ── Presets ── */}
                            {activeTab === 'presets' && (
                                <section className="space-y-4">
                                    <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Architecture Presets</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {PRESET_TEMPLATES.map((preset, i) => (
                                            <button
                                                key={i}
                                                onClick={() => applyPreset(preset)}
                                                className={`group relative rounded-xl overflow-hidden border transition-all ${
                                                    template.name === preset.name 
                                                    ? 'border-blue-500 shadow-2xl shadow-blue-500/20' 
                                                    : 'border-white/5 hover:border-white/20 bg-white/5'
                                                }`}
                                                style={{ aspectRatio: `${preset.width} / ${preset.height}` }}
                                            >
                                                <div className="absolute inset-0 p-1">
                                                    <div className="w-full h-full rounded-lg overflow-hidden relative" style={{ background: preset.background }}>
                                                        <div className="absolute inset-0 grid" style={{
                                                            gridTemplateRows: `repeat(${preset.layout.rows}, 1fr)`,
                                                            gridTemplateColumns: `repeat(${preset.layout.cols}, 1fr)`,
                                                            gap: 1, padding: 2
                                                        }}>
                                                            {preset.slots.map(s => (
                                                                <div key={s.id} className="bg-black/10 rounded-sm border border-white/10" />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="absolute inset-x-0 bottom-0 bg-neutral-900/90 backdrop-blur-md p-2 border-t border-white/5">
                                                    <p className="text-[8px] font-black text-white uppercase truncate">{preset.name}</p>
                                                    <p className="text-[6px] font-black text-neutral-500 uppercase tracking-widest">{preset.layout.rows}x{preset.layout.cols} Matrix</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    {userPresets.length > 0 && (
                                        <div className="pt-6 border-t border-white/5 space-y-4">
                                            <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Your Saved Matrixes</h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                {userPresets.map((preset: {name: string, width: number, height: number}, i: number) => (
                                                    <div key={i} className="group relative">
                                                        <button
                                                            onClick={() => {
                                                                const next = { ...template, width: preset.width, height: preset.height };
                                                                setTemplate(next);
                                                                pushToHistory(next);
                                                            }}
                                                            className={`w-full relative rounded-xl overflow-hidden border transition-all ${
                                                                template.width === preset.width && template.height === preset.height
                                                                ? 'border-blue-500 shadow-2xl shadow-blue-500/20' 
                                                                : 'border-white/5 hover:border-white/20 bg-white/5'
                                                            }`}
                                                            style={{ aspectRatio: `${preset.width} / ${preset.height}` }}
                                                        >
                                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/40 group-hover:bg-neutral-900/20 transition-all p-3">
                                                                <p className="text-[8px] font-black text-white uppercase truncate text-center">{preset.name}</p>
                                                                <p className="text-[6px] font-black text-neutral-500 uppercase tracking-widest mt-1">{preset.width}x{preset.height}</p>
                                                            </div>
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); deleteCustomPreset(i); }}
                                                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110 z-10"
                                                        >
                                                            <Trash2 size={10} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* ── Layout ── */}
                            {activeTab === 'layout' && (
                                <section className="space-y-6">
                                    <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Matrix Topology</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            [1, 1], [1, 2], [1, 3],
                                            [2, 1], [2, 2], [2, 3],
                                            [3, 1], [3, 2], [4, 1],
                                        ].map(([r, c]) => (
                                            <button
                                                key={`${r}x${c}`}
                                                onClick={() => setLayout(r, c)}
                                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all group ${
                                                    template.layout.rows === r && template.layout.cols === c
                                                    ? 'bg-blue-600 border-blue-400 shadow-xl'
                                                    : 'bg-neutral-900 border-white/5 hover:border-white/20'
                                                }`}
                                            >
                                                <div className="w-full aspect-[3/4] grid gap-1 p-1 bg-black/20 rounded"
                                                    style={{ gridTemplateRows: `repeat(${r}, 1fr)`, gridTemplateColumns: `repeat(${c}, 1fr)` }}
                                                >
                                                    {Array.from({ length: r * c }).map((_, i) => (
                                                        <div key={i} className={`rounded-sm ${template.layout.rows === r && template.layout.cols === c ? 'bg-white/40' : 'bg-white/10'}`} />
                                                    ))}
                                                </div>
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${template.layout.rows === r && template.layout.cols === c ? 'text-white' : 'text-neutral-500'}`}>{r}×{c}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="pt-6 border-t border-white/5 space-y-4">
                                        <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Canvas Orientation</h3>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { label: 'Portrait (102mm X 152mm)', w: 420, h: 630 },
                                                { label: 'Landscape (152mm X 102mm)', w: 630, h: 420 },
                                                { label: 'Square (1:1)', w: 600, h: 600 },
                                                { label: 'Strip (2x6)', w: 210, h: 630 },
                                            ].map((opt) => (
                                                <button
                                                    key={opt.label}
                                                    onClick={() => {
                                                        const next = { ...template, width: opt.w, height: opt.h };
                                                        setTemplate(next);
                                                        pushToHistory(next);
                                                    }}
                                                    className={`px-4 py-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                                                        template.width === opt.w && template.height === opt.h
                                                        ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                                                        : 'bg-neutral-900 border-white/5 text-neutral-400 hover:border-white/20'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                                            <div className="space-y-2">
                                                <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Custom Width (px)</label>
                                                <div className="relative group">
                                                    <input 
                                                        type="number" 
                                                        value={template.width}
                                                        onChange={(e) => update({ width: Math.max(100, +e.target.value) })}
                                                        onBlur={() => pushToHistory(template)}
                                                        className="w-full bg-neutral-900 border border-white/5 rounded-xl px-4 py-3 text-[11px] font-black text-white outline-none focus:border-blue-500 transition-all"
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-600 text-[8px] font-black">PX</div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Custom Height (px)</label>
                                                <div className="relative group">
                                                    <input 
                                                        type="number" 
                                                        value={template.height}
                                                        onChange={(e) => update({ height: Math.max(100, +e.target.value) })}
                                                        onBlur={() => pushToHistory(template)}
                                                        className="w-full bg-neutral-900 border border-white/5 rounded-xl px-4 py-3 text-[11px] font-black text-white outline-none focus:border-blue-500 transition-all"
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-600 text-[8px] font-black">PX</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="pt-4">
                                            <button 
                                                onClick={saveCustomPreset}
                                                className="w-full py-3 rounded-xl bg-blue-600/10 border border-blue-500/30 text-blue-400 text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
                                            >
                                                <Save size={14} /> Bookmark Current Dimensions
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-white/5 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Layer Controller</h3>
                                            <button 
                                                onClick={() => {
                                                    const id = `s${template.slots.length + 1}`;
                                                    updateSlot(id, { id, x: 25, y: 25, width: 50, height: 40, rotation: 0 });
                                                    setTemplate(prev => ({ ...prev, slots: [...prev.slots, { id, x: 25, y: 25, width: 50, height: 40, rotation: 0 }] }));
                                                    setSelectedSlotId(id);
                                                }}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-all"
                                            >
                                                <Plus size={12} />
                                                <span className="text-[8px] font-black uppercase tracking-widest">Add Slot</span>
                                            </button>
                                        </div>

                                        {selectedSlotId && (
                                            <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-4 space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Active Slot: {selectedSlotId}</span>
                                                    <button onClick={() => deleteSlot(selectedSlotId)} className="text-red-500 hover:text-red-400">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Width (%)</label>
                                                            <span className="text-[9px] font-black text-white">{Math.round(template.slots.find(s => s.id === selectedSlotId)?.width || 0)}%</span>
                                                        </div>
                                                        <input type="range" min={5} max={100} value={template.slots.find(s => s.id === selectedSlotId)?.width || 0} onChange={(e) => updateSlot(selectedSlotId, { width: +e.target.value })} onMouseUp={() => pushToHistory(template)} className="w-full accent-blue-500" />
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Height (%)</label>
                                                            <span className="text-[9px] font-black text-white">{Math.round(template.slots.find(s => s.id === selectedSlotId)?.height || 0)}%</span>
                                                        </div>
                                                        <input type="range" min={5} max={100} value={template.slots.find(s => s.id === selectedSlotId)?.height || 0} onChange={(e) => updateSlot(selectedSlotId, { height: +e.target.value })} onMouseUp={() => pushToHistory(template)} className="w-full accent-blue-500" />
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Rotation</label>
                                                            <span className="text-[9px] font-black text-white">{template.slots.find(s => s.id === selectedSlotId)?.rotation || 0}°</span>
                                                        </div>
                                                        <input type="range" min={-180} max={180} value={template.slots.find(s => s.id === selectedSlotId)?.rotation || 0} onChange={(e) => updateSlot(selectedSlotId, { rotation: +e.target.value })} onMouseUp={() => pushToHistory(template)} className="w-full accent-blue-500" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}

                            {/* ── Style ── */}
                            {activeTab === 'style' && (
                                <section className="space-y-8">
                                    <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Visual Configuration</h3>
                                    
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Base Color</label>
                                            <div className="flex items-center gap-3 bg-neutral-900 border border-white/5 rounded-xl p-2">
                                                <input type="color" value={template.background.startsWith('#') ? template.background : '#ffffff'} onChange={(e) => update({ background: e.target.value })} className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent" />
                                                <input type="text" value={template.background} onChange={(e) => update({ background: e.target.value })} className="flex-1 bg-transparent text-[10px] font-black text-white uppercase outline-none" placeholder="#HEX OR GRADIENT" />
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Background Layer</label>
                                            <div className="relative group">
                                                <input type="file" accept="image/*" onChange={handleBgUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                                <div className="w-full py-6 rounded-xl border border-dashed border-white/10 group-hover:border-blue-500/50 group-hover:bg-blue-500/5 transition-all flex flex-col items-center justify-center gap-2">
                                                    <ImageIcon size={18} className="text-neutral-500 group-hover:text-blue-400" />
                                                    <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest group-hover:text-white">Upload Pattern</span>
                                                </div>
                                            </div>
                                            {backgroundImage && (
                                                <button onClick={() => setBackgroundImage(null)} className="text-[7px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-all">Discard Layer</button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-6 pt-6 border-t border-white/5">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Padding</label>
                                                <span className="text-[9px] font-black text-white">{template.padding}px</span>
                                            </div>
                                            <input type="range" min={0} max={100} value={template.padding} onChange={(e) => update({ padding: +e.target.value })} onMouseUp={() => pushToHistory(template)} className="w-full accent-blue-500" />
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Internal Gap</label>
                                                <span className="text-[9px] font-black text-white">{template.gap}px</span>
                                            </div>
                                            <input type="range" min={0} max={50} value={template.gap} onChange={(e) => update({ gap: +e.target.value })} onMouseUp={() => pushToHistory(template)} className="w-full accent-blue-500" />
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Corner Radius</label>
                                                <span className="text-[9px] font-black text-white">{template.borderRadius}px</span>
                                            </div>
                                            <input type="range" min={0} max={60} value={template.borderRadius} onChange={(e) => update({ borderRadius: +e.target.value })} onMouseUp={() => pushToHistory(template)} className="w-full accent-blue-500" />
                                        </div>

                                        <div className="pt-4 space-y-4">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Boundary Logic</label>
                                                <div className="flex items-center gap-3 bg-neutral-900 border border-white/5 rounded-xl p-2">
                                                    <input type="color" value={template.borderColor} onChange={(e) => update({ borderColor: e.target.value })} className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent" />
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[7px] font-black text-neutral-500 uppercase">Weight</span>
                                                            <span className="text-[8px] font-black text-white">{template.borderWidth}px</span>
                                                        </div>
                                                        <input type="range" min={0} max={20} value={template.borderWidth} onChange={(e) => update({ borderWidth: +e.target.value })} onMouseUp={() => pushToHistory(template)} className="w-full accent-blue-500" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Brand Identity</label>
                                                <div className="bg-neutral-900 border border-white/5 rounded-xl p-2 flex items-center gap-2">
                                                    <Hash size={12} className="text-neutral-500 ml-2" />
                                                    <input 
                                                        type="text" 
                                                        value={template.watermarkText} 
                                                        onChange={(e) => update({ watermarkText: e.target.value })} 
                                                        onBlur={() => pushToHistory(template)}
                                                        className="flex-1 bg-transparent text-[10px] font-black text-white uppercase outline-none px-2" 
                                                        placeholder="WATERMARK" 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* ── Text ── */}
                            {activeTab === 'text' && (
                                <section className="space-y-8">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Text Layers</h3>
                                        <button onClick={addTextElement} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600 text-white text-[8px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                                            <Plus size={12} /> Add
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {template.textElements.map(txt => (
                                            <div 
                                                role="button" tabIndex={0} 
                                                key={txt.id} 
                                                onClick={() => setSelectedTextId(txt.id)}
                                                className={`w-full p-4 rounded-xl border transition-all text-left group ${
                                                    selectedTextId === txt.id 
                                                    ? 'bg-blue-600 border-blue-400' 
                                                    : 'bg-neutral-900 border-white/5 hover:border-white/20'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex flex-col gap-1 overflow-hidden">
                                                        <span className={`text-[10px] font-black truncate uppercase tracking-tight ${selectedTextId === txt.id ? 'text-white' : 'text-neutral-300'}`}>
                                                            {txt.text}
                                                        </span>
                                                        <span className={`text-[7px] font-black uppercase tracking-widest ${selectedTextId === txt.id ? 'text-blue-100' : 'text-neutral-500'}`}>
                                                            {txt.fontSize}px · {txt.fontFamily}
                                                        </span>
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); deleteTextElement(txt.id); }} className="text-neutral-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-all">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {selectedText && (
                                        <div className="pt-8 border-t border-white/5 space-y-6">
                                            <div className="space-y-3">
                                                <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Content</label>
                                                <textarea 
                                                    value={selectedText.text}
                                                    onChange={(e) => updateText(selectedText.id, { text: e.target.value })}
                                                    className="w-full bg-neutral-900 border border-white/5 rounded-xl p-4 text-xs font-black text-white focus:outline-none focus:border-blue-500/50 h-20 resize-none"
                                                />
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-3">
                                                    <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Size</label>
                                                    <input type="number" value={selectedText.fontSize} onChange={(e) => updateText(selectedText.id, { fontSize: +e.target.value })} className="w-full bg-neutral-900 border border-white/5 rounded-xl px-4 py-3 text-xs font-black text-white" />
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Color</label>
                                                    <div className="flex bg-neutral-900 border border-white/5 rounded-xl p-2 h-[42px]">
                                                        <input type="color" value={selectedText.color} onChange={(e) => updateText(selectedText.id, { color: e.target.value })} className="w-full h-full cursor-pointer bg-transparent border-0" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Family</label>
                                                <select value={selectedText.fontFamily} onChange={(e) => updateText(selectedText.id, { fontFamily: e.target.value })} className="w-full bg-neutral-900 border border-white/5 rounded-xl px-4 py-3 text-xs font-black text-white appearance-none">
                                                    <option value="sans-serif">System Sans</option>
                                                    <option value="serif">System Serif</option>
                                                    <option value="monospace">Monospace</option>
                                                    <option value="cursive">Script</option>
                                                    <option value="Georgia, serif">Georgia</option>
                                                    <option value="'Playfair Display', serif">Playfair</option>
                                                </select>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Kerning</label>
                                                    <span className="text-[9px] font-black text-white">{selectedText.letterSpacing || 0}px</span>
                                                </div>
                                                <input type="range" min={0} max={20} value={selectedText.letterSpacing || 0} onChange={(e) => updateText(selectedText.id, { letterSpacing: +e.target.value })} className="w-full accent-blue-500" />
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Alignment</label>
                                                <div className="flex bg-neutral-900 border border-white/5 rounded-xl p-1">
                                                    {(['left', 'center', 'right'] as const).map(align => (
                                                        <button 
                                                            key={align} 
                                                            onClick={() => updateText(selectedText.id, { textAlign: align })}
                                                            className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${selectedText.textAlign === align ? 'bg-white text-neutral-900' : 'text-neutral-500 hover:text-white'}`}
                                                        >
                                                            {align}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-white/5 space-y-4">
                                                <h4 className="text-[7px] font-black text-neutral-600 uppercase tracking-[0.2em]">Layering</h4>
                                                <div className="grid grid-cols-4 gap-1.5">
                                                    <button 
                                                        onClick={() => {
                                                            const minZ = Math.min(0, ...(template.stickers || []).map(s => s.zIndex || 0), ...template.textElements.map(t => t.zIndex || 0));
                                                            updateText(selectedText.id, { zIndex: minZ - 100 });
                                                            pushToHistory(template);
                                                        }}
                                                        className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all"
                                                        title="Send to Back"
                                                    >
                                                        <ArrowDown size={14} className="translate-y-0.5" /><ArrowDown size={14} className="-translate-y-0.5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            updateText(selectedText.id, { zIndex: (selectedText.zIndex || 0) - 1 });
                                                            pushToHistory(template);
                                                        }}
                                                        className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all"
                                                        title="Move Backward"
                                                    >
                                                        <ArrowDown size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            updateText(selectedText.id, { zIndex: (selectedText.zIndex || 0) + 1 });
                                                            pushToHistory(template);
                                                        }}
                                                        className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all"
                                                        title="Move Forward"
                                                    >
                                                        <ArrowUp size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            const maxZ = Math.max(0, ...(template.stickers || []).map(s => s.zIndex || 0), ...template.textElements.map(t => t.zIndex || 0));
                                                            updateText(selectedText.id, { zIndex: maxZ + 100 });
                                                            pushToHistory(template);
                                                        }}
                                                        className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all"
                                                        title="Bring to Front"
                                                    >
                                                        <ArrowUp size={14} className="-translate-y-0.5" /><ArrowUp size={14} className="translate-y-0.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* ── Stickers ── */}
                            {activeTab === 'stickers' && (
                                <section className="space-y-8">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Graphical Assets</h3>
                                        <div className="relative overflow-hidden">
                                            <input type="file" accept="image/*" onChange={handleStickerUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                            <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600 text-white text-[8px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                                                <Plus size={12} /> Import
                                            </button>
                                        </div>
                                    </div>

                                    {loadingStickers ? (
                                        <div className="grid grid-cols-3 gap-2">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="aspect-square bg-neutral-900 rounded-xl animate-pulse border border-white/5" />
                                            ))}
                                        </div>
                                    ) : userStickers.length > 0 ? (
                                        <div className="grid grid-cols-3 gap-2">
                                            {userStickers.map(stk => (
                                                <button key={stk.id} onClick={() => addSticker(stk.image_url)} className="aspect-square bg-neutral-900 border border-white/5 rounded-xl p-2 hover:border-blue-500/50 transition-all flex items-center justify-center group overflow-hidden">
                                                    <Image src={stk.image_url} alt="" width={60} height={60} className="object-contain transition-transform group-hover:scale-110" />
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-10 text-center space-y-2 opacity-20">
                                            <ImageIcon size={32} className="mx-auto" />
                                            <p className="text-[8px] font-black uppercase tracking-widest">No Assets Found</p>
                                        </div>
                                    )}

                                    {selectedSticker && (
                                        <div className="pt-8 border-t border-white/5 space-y-6">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[8px] font-black text-white uppercase tracking-widest">Active Asset</span>
                                                <button onClick={() => deleteSticker(selectedSticker.id)} className="text-red-500 hover:text-red-400 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            {/* Dimensions */}
                                            <div className="space-y-4">
                                                <h4 className="text-[7px] font-black text-neutral-600 uppercase tracking-[0.2em]">Dimensions</h4>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Width</label>
                                                        <span className="text-[9px] font-black text-white">{selectedSticker.width}px</span>
                                                    </div>
                                                    <input type="range" min={20} max={400} value={selectedSticker.width} onChange={(e) => updateSticker(selectedSticker.id, { width: +e.target.value })} onMouseUp={() => pushToHistory(template)} className="w-full accent-blue-500" />
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Height</label>
                                                        <span className="text-[9px] font-black text-white">{(selectedSticker.height || 0) === 0 ? 'Auto' : `${selectedSticker.height}px`}</span>
                                                    </div>
                                                    <input type="range" min={0} max={400} value={selectedSticker.height || 0} onChange={(e) => updateSticker(selectedSticker.id, { height: +e.target.value })} onMouseUp={() => pushToHistory(template)} className="w-full accent-blue-500" />
                                                    <p className="text-[7px] text-neutral-600">Set to 0 for auto aspect ratio. Set a value to crop.</p>
                                                </div>
                                            </div>

                                            {/* Crop Pan (only when height is set) */}
                                            {(selectedSticker.height || 0) > 0 && (
                                                <div className="space-y-4">
                                                    <h4 className="text-[7px] font-black text-neutral-600 uppercase tracking-[0.2em]">Crop Position</h4>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Pan X</label>
                                                            <span className="text-[9px] font-black text-white">{selectedSticker.cropX || 0}%</span>
                                                        </div>
                                                        <input type="range" min={-50} max={50} value={selectedSticker.cropX || 0} onChange={(e) => updateSticker(selectedSticker.id, { cropX: +e.target.value })} onMouseUp={() => pushToHistory(template)} className="w-full accent-blue-500" />
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Pan Y</label>
                                                            <span className="text-[9px] font-black text-white">{selectedSticker.cropY || 0}%</span>
                                                        </div>
                                                        <input type="range" min={-50} max={50} value={selectedSticker.cropY || 0} onChange={(e) => updateSticker(selectedSticker.id, { cropY: +e.target.value })} onMouseUp={() => pushToHistory(template)} className="w-full accent-blue-500" />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Transform & Layering */}
                                            <div className="space-y-4">
                                                <h4 className="text-[7px] font-black text-neutral-600 uppercase tracking-[0.2em]">Layering</h4>
                                                <div className="grid grid-cols-4 gap-1.5">
                                                    <button 
                                                        onClick={() => {
                                                            const minZ = Math.min(0, ...(template.stickers || []).map(s => s.zIndex || 0), ...template.textElements.map(t => t.zIndex || 0));
                                                            updateSticker(selectedSticker.id, { zIndex: minZ - 100 });
                                                            pushToHistory(template);
                                                        }}
                                                        className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all"
                                                        title="Send to Back"
                                                    >
                                                        <ArrowDown size={14} className="translate-y-0.5" /><ArrowDown size={14} className="-translate-y-0.5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            updateSticker(selectedSticker.id, { zIndex: (selectedSticker.zIndex || 0) - 1 });
                                                            pushToHistory(template);
                                                        }}
                                                        className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all"
                                                        title="Move Backward"
                                                    >
                                                        <ArrowDown size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            updateSticker(selectedSticker.id, { zIndex: (selectedSticker.zIndex || 0) + 1 });
                                                            pushToHistory(template);
                                                        }}
                                                        className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all"
                                                        title="Move Forward"
                                                    >
                                                        <ArrowUp size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            const maxZ = Math.max(0, ...(template.stickers || []).map(s => s.zIndex || 0), ...template.textElements.map(t => t.zIndex || 0));
                                                            updateSticker(selectedSticker.id, { zIndex: maxZ + 100 });
                                                            pushToHistory(template);
                                                        }}
                                                        className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all"
                                                        title="Bring to Front"
                                                    >
                                                        <ArrowUp size={14} className="-translate-y-0.5" /><ArrowUp size={14} className="translate-y-0.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="text-[7px] font-black text-neutral-600 uppercase tracking-[0.2em]">Transform</h4>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Rotation</label>
                                                        <span className="text-[9px] font-black text-white">{selectedSticker.rotation}deg</span>
                                                    </div>
                                                    <input type="range" min={-180} max={180} value={selectedSticker.rotation} onChange={(e) => updateSticker(selectedSticker.id, { rotation: +e.target.value })} onMouseUp={() => pushToHistory(template)} className="w-full accent-blue-500" />
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Opacity</label>
                                                        <span className="text-[9px] font-black text-white">{Math.round((selectedSticker.opacity ?? 1) * 100)}%</span>
                                                    </div>
                                                    <input type="range" min={10} max={100} value={Math.round((selectedSticker.opacity ?? 1) * 100)} onChange={(e) => updateSticker(selectedSticker.id, { opacity: +e.target.value / 100 })} onMouseUp={() => pushToHistory(template)} className="w-full accent-blue-500" />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => { updateSticker(selectedSticker.id, { flipX: !(selectedSticker.flipX ?? false) }); pushToHistory(template); }}
                                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all ${
                                                            selectedSticker.flipX ? 'bg-blue-600 border-blue-400 text-white' : 'bg-neutral-900 border-white/5 text-neutral-400 hover:border-white/20'
                                                        }`}
                                                    >
                                                        <FlipHorizontal size={12} /> Flip X
                                                    </button>
                                                    <button
                                                        onClick={() => { updateSticker(selectedSticker.id, { flipY: !(selectedSticker.flipY ?? false) }); pushToHistory(template); }}
                                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all ${
                                                            selectedSticker.flipY ? 'bg-blue-600 border-blue-400 text-white' : 'bg-neutral-900 border-white/5 text-neutral-400 hover:border-white/20'
                                                        }`}
                                                    >
                                                        <FlipHorizontal size={12} className="rotate-90" /> Flip Y
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>
                    </aside>

                    {/* MAIN: Preview Canvas */}
                    <main className="flex-1 bg-[#fafafa] p-10 flex flex-col items-center justify-center relative overflow-hidden"
                        style={{ 
                            backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)', 
                            backgroundSize: '30px 30px' 
                        }}
                    >
                        {/* Zoom/Pan info */}
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-neutral-900 border border-white/5 px-6 py-2 rounded-full">
                            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Matrix Preview</span>
                            <div className="h-3 w-px bg-white/10" />
                            <span className="text-[9px] font-black text-white uppercase tracking-widest">{template.layout.rows}x{template.layout.cols} Active Grid</span>
                        </div>

                        {/* Template Container */}
                        <div 
                            ref={previewRef}
                            className="relative shadow-2xl transition-all duration-300"
                            style={{ 
                                width: template.width, 
                                height: template.height, 
                                maxWidth: '100%',
                                maxHeight: '80vh',
                                backgroundColor: template.background.includes('gradient') ? undefined : template.background,
                                backgroundImage: (backgroundImage ? `url(${backgroundImage})` : template.backgroundImage ? `url(${template.backgroundImage})` : 'none') + (template.background.includes('gradient') ? `, ${template.background}` : ''),
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                padding: template.padding,
                                border: `${template.borderWidth}px solid ${template.borderColor}`,
                                borderRadius: template.borderRadius,
                                overflow: 'hidden'
                            }}
                            onClick={() => { setSelectedTextId(null); setSelectedStickerId(null); setSelectedSlotId(null); }}
                        >
                            {/* Photo Slots (Freeform Layers) */}
                            {template.slots.map((slot) => (
                                <div key={slot.id} 
                                    className={`absolute cursor-grab active:cursor-grabbing flex items-center justify-center group border-2 transition-shadow ${selectedSlotId === slot.id ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-white/10 hover:border-white/30'}`}
                                    style={{ 
                                        left: `${slot.x}%`,
                                        top: `${slot.y}%`,
                                        width: `${slot.width}%`,
                                        height: `${slot.height}%`,
                                        transform: `rotate(${slot.rotation || 0}deg)`,
                                        backgroundColor: 'rgba(0,0,0,0.4)',
                                        borderRadius: Math.min(template.borderRadius / 2, 12),
                                        zIndex: selectedSlotId === slot.id ? 600 : 500,
                                    }}
                                    onMouseDown={(e) => {
                                        setSelectedSlotId(slot.id);
                                        setSelectedTextId(null);
                                        setSelectedStickerId(null);
                                        setActiveTab('layout'); // Auto-switch tab
                                        startDrag(e, slot.id, slot.x, slot.y);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    onContextMenu={(e) => openContextMenu(e, slot.id, 'slot')}
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        <ImageIcon size={24} className="text-white/20 group-hover:text-white/40 transition-colors" />
                                        <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">{slot.id}</span>
                                    </div>
                                    
                                    {selectedSlotId === slot.id && (
                                        <>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); deleteSlot(slot.id); }}
                                                className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg z-[100]"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                            
                                            {/* Resize Handles */}
                                            {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map(type => (
                                                <div 
                                                    key={type}
                                                    className={`absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full z-[110] cursor-${type}-resize hover:scale-125 transition-transform`}
                                                    style={{
                                                        top: type.includes('n') ? -6 : type.includes('s') ? 'calc(100% - 6px)' : '50%',
                                                        left: type.includes('w') ? -6 : type.includes('e') ? 'calc(100% - 6px)' : '50%',
                                                        transform: 'translate(-0%, -0%)',
                                                        marginTop: type === 'e' || type === 'w' ? -6 : 0,
                                                        marginLeft: type === 'n' || type === 's' ? -6 : 0,
                                                    }}
                                                    onMouseDown={(e) => startResize(e, slot.id, type, slot.x, slot.y, slot.width, slot.height)}
                                                />
                                            ))}
                                        </>
                                    )}
                                </div>
                            ))}

                            {/* Floating Layers Container (Overlay) */}
                            <div className="absolute inset-0 pointer-events-none">
                                {/* Stickers */}
                                {[...(template.stickers || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map((stk) => (
                                    <div
                                        key={stk.id}
                                        className={`absolute pointer-events-auto cursor-grab active:cursor-grabbing group ${selectedStickerId === stk.id ? 'ring-2 ring-blue-500 ring-offset-4 ring-offset-transparent' : ''}`}
                                        style={{
                                            left: `${stk.x}%`,
                                            top: `${stk.y}%`,
                                            width: stk.width,
                                            height: (stk.height || 0) > 0 ? stk.height : 'auto',
                                            transform: `translate(-50%, -50%) rotate(${stk.rotation}deg) scaleX(${stk.flipX ? -1 : 1}) scaleY(${stk.flipY ? -1 : 1})`,
                                            zIndex: selectedStickerId === stk.id ? 1000 : (550 + (stk.zIndex || 0)),
                                            opacity: stk.opacity ?? 1,
                                            overflow: (stk.height || 0) > 0 ? 'hidden' : 'visible',
                                        }}
                                        onMouseDown={(e) => { 
                                            e.stopPropagation(); 
                                            setSelectedStickerId(stk.id); 
                                            setSelectedTextId(null); 
                                            setSelectedSlotId(null);
                                            setActiveTab('stickers');
                                            startDrag(e, stk.id, stk.x, stk.y); 
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        onContextMenu={(e) => openContextMenu(e, stk.id, 'sticker')}
                                    >
                                        <Image 
                                            src={stk.src} alt="" width={stk.width} height={(stk.height || 0) > 0 ? stk.height : stk.width} 
                                            className={`w-full ${(stk.height || 0) > 0 ? 'h-full object-cover' : 'h-full object-contain'}`}
                                            style={(stk.height || 0) > 0 ? { objectPosition: `${50 + (stk.cropX || 0)}% ${50 + (stk.cropY || 0)}%` } : undefined}
                                            unoptimized 
                                            draggable={false}
                                        />
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900 px-2 py-1 rounded text-[7px] font-black text-white uppercase tracking-tighter">Layer: Asset</div>
                                        
                                        {selectedStickerId === stk.id && (
                                            <>
                                                {/* Resize Handles */}
                                                {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map(type => (
                                                    <div 
                                                        key={type}
                                                        className={`absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full z-[120] cursor-${type}-resize shadow-lg hover:scale-125 transition-transform`}
                                                        style={{
                                                            top: type.includes('n') ? -6 : type.includes('s') ? 'calc(100% - 6px)' : '50%',
                                                            left: type.includes('w') ? -6 : type.includes('e') ? 'calc(100% - 6px)' : '50%',
                                                            transform: 'translate(-0%, -0%)',
                                                            marginTop: type === 'e' || type === 'w' ? -6 : 0,
                                                            marginLeft: type === 'n' || type === 's' ? -6 : 0,
                                                        }}
                                                        onMouseDown={(e) => startResize(e, stk.id, type, stk.x, stk.y, stk.width / (template.width / 100), 0)}
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </div>
                                ))}

                                {/* Text Elements */}
                                {[...(template.textElements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map((txt) => (
                                    <div
                                        key={txt.id}
                                        className={`absolute pointer-events-auto cursor-grab active:cursor-grabbing px-2 py-1 group ${selectedTextId === txt.id ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-transparent' : ''}`}
                                        style={{
                                            left: `${txt.x}%`,
                                            top: `${txt.y}%`,
                                            transform: `translate(-50%, -50%) rotate(${txt.rotation || 0}deg)`,
                                            fontSize: txt.fontSize,
                                            fontFamily: txt.fontFamily,
                                            color: txt.color,
                                            fontWeight: txt.fontWeight,
                                            fontStyle: txt.fontStyle,
                                            textAlign: txt.textAlign as any,
                                            letterSpacing: `${txt.letterSpacing}px`,
                                            textShadow: txt.textShadow,
                                            opacity: txt.opacity,
                                            zIndex: selectedTextId === txt.id ? 1000 : (550 + (txt.zIndex || 0)),
                                        }}
                                        onMouseDown={(e) => { 
                                            e.stopPropagation(); 
                                            setSelectedTextId(txt.id); 
                                            setSelectedStickerId(null); 
                                            setSelectedSlotId(null);
                                            setActiveTab('text');
                                            startDrag(e, txt.id, txt.x, txt.y); 
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        onContextMenu={(e) => openContextMenu(e, txt.id, 'text')}
                                    >
                                        {txt.text}
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900 px-2 py-1 rounded text-[7px] font-black text-white uppercase tracking-tighter">Layer: Type</div>

                                        {selectedTextId === txt.id && (
                                            <>
                                                {/* Resize Handles */}
                                                {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map(type => (
                                                    <div 
                                                        key={type}
                                                        className={`absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full z-[120] cursor-${type}-resize shadow-lg hover:scale-125 transition-transform`}
                                                        style={{
                                                            top: type.includes('n') ? -6 : type.includes('s') ? 'calc(100% - 6px)' : '50%',
                                                            left: type.includes('w') ? -6 : type.includes('e') ? 'calc(100% - 6px)' : '50%',
                                                            transform: 'translate(-0%, -0%)',
                                                            marginTop: type === 'e' || type === 'w' ? -6 : 0,
                                                            marginLeft: type === 'n' || type === 's' ? -6 : 0,
                                                        }}
                                                        onMouseDown={(e) => startResize(e, txt.id, type, txt.x, txt.y, txt.fontSize * 4 / (template.width / 100), 0)}
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Shortcuts */}
                        <div className="absolute bottom-10 right-10 flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2 text-[8px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                                <Move size={10} /> Drag layers to position
                            </div>
                            <div className="flex items-center gap-2 text-[8px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                                <RotateCw size={10} /> Rotate in properties
                            </div>
                            <div className="flex items-center gap-2 text-[8px] font-black text-neutral-500 uppercase tracking-[0.2em]">
                                <Layers size={10} /> Right-click for options
                            </div>
                        </div>

                        {/* Context Menu Overlay */}
                        {contextMenu && (
                            <div
                                className="fixed z-[9999] min-w-[200px] py-2 bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50"
                                style={{ left: contextMenu.x, top: contextMenu.y }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="px-4 py-2 border-b border-white/5">
                                    <span className="text-[8px] font-black text-neutral-400 uppercase tracking-[0.25em]">
                                        {contextMenu.elementType === 'slot' ? 'Photo Slot' : contextMenu.elementType === 'text' ? 'Text Layer' : 'Sticker Asset'}
                                        {' '} -- {contextMenu.elementId}
                                    </span>
                                </div>

                                {/* Actions Group 1: Transform */}
                                <div className="py-1">
                                    <button
                                        onClick={() => duplicateElement(contextMenu.elementId, contextMenu.elementType)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors group"
                                    >
                                        <Copy size={14} className="text-neutral-400 group-hover:text-blue-400" />
                                        <span className="text-[10px] font-bold text-neutral-300 group-hover:text-white">Duplicate</span>
                                        <span className="ml-auto text-[8px] font-bold text-neutral-600">Ctrl+D</span>
                                    </button>
                                    <button
                                        onClick={() => resetElementPosition(contextMenu.elementId, contextMenu.elementType)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors group"
                                    >
                                        <AlignCenter size={14} className="text-neutral-400 group-hover:text-blue-400" />
                                        <span className="text-[10px] font-bold text-neutral-300 group-hover:text-white">Reset Position</span>
                                    </button>
                                    <button
                                        onClick={() => resetElementRotation(contextMenu.elementId, contextMenu.elementType)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors group"
                                    >
                                        <RotateCcw size={14} className="text-neutral-400 group-hover:text-blue-400" />
                                        <span className="text-[10px] font-bold text-neutral-300 group-hover:text-white">Reset Rotation</span>
                                    </button>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-white/5 mx-3" />

                                {/* Actions Group 2: Layer Order */}
                                <div className="py-1">
                                    <button
                                        onClick={() => bringToFront(contextMenu.elementId, contextMenu.elementType)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors group"
                                    >
                                        <ArrowUp size={14} className="text-neutral-400 group-hover:text-emerald-400" />
                                        <span className="text-[10px] font-bold text-neutral-300 group-hover:text-white">Bring to Front</span>
                                    </button>
                                    <button
                                        onClick={() => sendToBack(contextMenu.elementId, contextMenu.elementType)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors group"
                                    >
                                        <ArrowDown size={14} className="text-neutral-400 group-hover:text-emerald-400" />
                                        <span className="text-[10px] font-bold text-neutral-300 group-hover:text-white">Send to Back</span>
                                    </button>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-white/5 mx-3" />

                                {/* Actions Group 3: Destructive */}
                                <div className="py-1">
                                    <button
                                        onClick={() => deleteFromContextMenu(contextMenu.elementId, contextMenu.elementType)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-500/10 transition-colors group"
                                    >
                                        <Trash2 size={14} className="text-red-400 group-hover:text-red-300" />
                                        <span className="text-[10px] font-bold text-red-400 group-hover:text-red-300">Delete</span>
                                        <span className="ml-auto text-[8px] font-bold text-neutral-600">Del</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
