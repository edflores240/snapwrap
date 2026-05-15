'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    Save, Palette, Layout, Type, Star, Image as ImageIcon,
    ChevronRight, Plus, Trash2,
    Move, RotateCw, Hash, Copy, Layers, AlignCenter,
    FlipHorizontal, ArrowUp, ArrowDown, RotateCcw, RefreshCcw,
    ZoomIn, ZoomOut, Lock, Unlock,
    AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
    AlignStartVertical, AlignCenterVertical, AlignEndVertical,
    Square, Circle, Triangle, Star as StarIcon, Minus,
} from 'lucide-react';
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
    locked?: boolean;
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
    locked?: boolean;
    textStroke?: string;
    textStrokeWidth?: number;
}

interface PhotoSlot {
    id: string;
    x: number;      // percentage 0-100
    y: number;      // percentage 0-100
    width: number;  // percentage
    height: number; // percentage
    rotation: number;
    zIndex?: number;
    locked?: boolean;
    opacity?: number;
    borderRadius?: number; // px override; falls back to global template.borderRadius
}

export interface ShapeElement {
    id: string;
    shapeType: 'rect' | 'circle' | 'triangle' | 'star' | 'line';
    x: number;   // percent 0-100 (top-left corner, same as slots)
    y: number;   // percent 0-100
    width: number;  // percent
    height: number; // percent
    rotation: number;
    fillColor: string;
    strokeColor: string;
    strokeWidth: number;  // px
    borderRadius: number; // px (rect only)
    opacity: number;
    zIndex?: number;
    locked?: boolean;
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
    backgroundOverlay?: string | null;       // tint color over background image
    backgroundOverlayOpacity?: number;       // 0-1
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    gap: number;
    padding: number;
    textElements: TextElement[];
    stickers?: Sticker[];
    shapes?: ShapeElement[];
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

type DesignTab = 'presets' | 'layout' | 'style' | 'text' | 'stickers' | 'shapes' | 'layers';

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
    const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
    const [backgroundImage, setBackgroundImage] = useState<string | null>(initialTemplate?.backgroundImage || null);
    const [userStickers, setUserStickers] = useState<{ id: string; image_url: string }[]>([]);
    const [loadingStickers, setLoadingStickers] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [dragLayerId, setDragLayerId] = useState<string | null>(null);
    const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
    const visualizerRef = useRef<TemplateVisualizerHandle>(null);
    // Always tracks the latest template value — used by drag/resize end callbacks
    const templateRef = useRef(template);
    templateRef.current = template;

    // ── Context Menu State ──
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        elementId: string;
        elementType: 'slot' | 'text' | 'sticker' | 'shape';
    } | null>(null);

    // ── History Management ──
    // Stored in a ref to avoid stale-closure bugs: pushToHistory/undo/redo never
    // read stale state because they always go through the ref directly.
    const historyRef = useRef<{ list: TemplateConfig[]; index: number }>({
        list: [JSON.parse(JSON.stringify(
            initialTemplate ?? { id: generateId(), ...PRESET_TEMPLATES[0] }
        ))],
        index: 0,
    });
    // Bumped on every history change to trigger re-renders for canUndo/canRedo.
    const [, setHistoryVersion] = useState(0);
    const canUndo = historyRef.current.index > 0;
    const canRedo = historyRef.current.index < historyRef.current.list.length - 1;

    const pushToHistory = useCallback((newTemplate: TemplateConfig) => {
        const h = historyRef.current;
        const next = h.list.slice(0, h.index + 1);
        if (next.length >= 50) next.shift();
        next.push(JSON.parse(JSON.stringify(newTemplate)));
        historyRef.current = { list: next, index: next.length - 1 };
        setHistoryVersion(v => v + 1);
    }, []);

    const undo = useCallback(() => {
        const h = historyRef.current;
        if (h.index > 0) {
            const newIndex = h.index - 1;
            historyRef.current = { ...h, index: newIndex };
            setTemplate(JSON.parse(JSON.stringify(h.list[newIndex])));
            setHistoryVersion(v => v + 1);
        }
    }, []);

    const redo = useCallback(() => {
        const h = historyRef.current;
        if (h.index < h.list.length - 1) {
            const newIndex = h.index + 1;
            historyRef.current = { ...h, index: newIndex };
            setTemplate(JSON.parse(JSON.stringify(h.list[newIndex])));
            setHistoryVersion(v => v + 1);
        }
    }, []);

    const previewRef = useRef<HTMLDivElement>(null);
    const [workspaceZoom, setWorkspaceZoom] = useState(1);

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

    const rotateCanvas = () => {
        const next = { ...template, width: template.height, height: template.width };
        setTemplate(next);
        pushToHistory(next);
    };

    // ── Keyboard Shortcuts (Undo/Redo/Zoom) ──
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isCtrl = e.ctrlKey || e.metaKey;
            
            // Zoom: Ctrl + / Ctrl -
            if (isCtrl && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                setWorkspaceZoom(prev => Math.min(3, prev + 0.1));
            }
            if (isCtrl && e.key === '-') {
                e.preventDefault();
                setWorkspaceZoom(prev => Math.max(0.2, prev - 0.1));
            }
            if (isCtrl && e.key === '0') {
                e.preventDefault();
                setWorkspaceZoom(1);
            }

            // Undo: Ctrl + Z
            if (isCtrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            // Redo: Ctrl + Y or Ctrl + Shift + Z
            if ((isCtrl && e.key.toLowerCase() === 'y') || (isCtrl && e.shiftKey && e.key.toLowerCase() === 'z')) {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

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

    const getNextZIndex = useCallback(() => {
        const all = [
            ...template.slots.map(s => s.zIndex ?? 0),
            ...(template.stickers || []).map(s => s.zIndex ?? 0),
            ...template.textElements.map(t => t.zIndex ?? 0),
            ...(template.shapes || []).map(s => s.zIndex ?? 0),
        ];
        return all.length > 0 ? Math.max(...all) + 1 : 1;
    }, [template]);

    const applyPreset = useCallback((preset: Omit<TemplateConfig, 'id'>) => {
        const next = { id: generateId(), ...preset, stickers: [], shapes: [] } as TemplateConfig;
        setTemplate(next);
        setBackgroundImage(preset.backgroundImage || null);
        pushToHistory(next);
        setSelectedTextId(null);
        setSelectedStickerId(null);
        setSelectedSlotId(null);
        setSelectedShapeId(null);
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
        el.zIndex = getNextZIndex();
        setTemplate(prev => {
            const next = { ...prev, textElements: [...prev.textElements, el] };
            pushToHistory(next);
            return next;
        });
        setSelectedTextId(el.id);
    }, [pushToHistory, getNextZIndex]);

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
        stk.zIndex = getNextZIndex();
        setTemplate(prev => {
            const next = { ...prev, stickers: [...(prev.stickers || []), stk] };
            pushToHistory(next);
            return next;
        });
        setSelectedStickerId(stk.id);
    }, [pushToHistory, getNextZIndex]);

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

    // Shape operations
    const addShape = useCallback((shapeType: ShapeElement['shapeType']) => {
        const sh: ShapeElement = {
            id: `shp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            shapeType,
            x: 30,
            y: 30,
            width: 40,
            height: 25,
            rotation: 0,
            fillColor: '#6366f1',
            strokeColor: '#ffffff',
            strokeWidth: 0,
            borderRadius: 0,
            opacity: 1,
            zIndex: getNextZIndex(),
        };
        setTemplate(prev => {
            const next = { ...prev, shapes: [...(prev.shapes || []), sh] };
            pushToHistory(next);
            return next;
        });
        setSelectedShapeId(sh.id);
        setSelectedTextId(null);
        setSelectedStickerId(null);
        setSelectedSlotId(null);
        setActiveTab('shapes');
    }, [pushToHistory, getNextZIndex]);

    const updateShape = useCallback((id: string, patch: Partial<ShapeElement>) => {
        setTemplate(prev => ({
            ...prev,
            shapes: (prev.shapes || []).map(s => s.id === id ? { ...s, ...patch } : s),
        }));
    }, []);

    const deleteShape = useCallback((id: string) => {
        setTemplate(prev => {
            const next = { ...prev, shapes: (prev.shapes || []).filter(s => s.id !== id) };
            pushToHistory(next);
            return next;
        });
        setSelectedShapeId(null);
    }, [pushToHistory]);

    const moveShape = useCallback((id: string, x: number, y: number) => {
        updateShape(id, { x, y });
    }, [updateShape]);

    // Unified drag handler
    const moveElement = useCallback((id: string, x: number, y: number) => {
        if (id.startsWith('stk_')) {
            moveSticker(id, x, y);
        } else if (id.startsWith('txt_')) {
            moveText(id, x, y);
        } else if (id.startsWith('shp_')) {
            moveShape(id, x, y);
        } else {
            updateSlot(id, { x, y });
        }
    }, [moveSticker, moveText, moveShape, updateSlot]);

    const resizeElement = useCallback((id: string, w: number, h: number, x: number, y: number) => {
        if (id.startsWith('stk_')) {
            updateSticker(id, { width: w * (template.width / 100), x, y });
        } else if (id.startsWith('txt_')) {
            updateText(id, { fontSize: Math.max(8, w * (template.width / 100) / 4), x, y });
        } else if (id.startsWith('shp_')) {
            updateShape(id, { width: Math.max(2, w), height: Math.max(2, h), x, y });
        } else {
            updateSlot(id, { width: w, height: h, x, y });
        }
    }, [updateSticker, updateText, updateShape, updateSlot, template.width]);

    const startDrag = useDraggable(previewRef, moveElement, () => pushToHistory(templateRef.current));
    const startResize = useResizable(previewRef, resizeElement, () => pushToHistory(templateRef.current));

    // ── Context Menu Handlers ──
    const openContextMenu = useCallback((e: React.MouseEvent, elementId: string, elementType: 'slot' | 'text' | 'sticker' | 'shape') => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, elementId, elementType });
        // Auto-select the element
        if (elementType === 'slot') { setSelectedSlotId(elementId); setSelectedTextId(null); setSelectedStickerId(null); setSelectedShapeId(null); }
        else if (elementType === 'text') { setSelectedTextId(elementId); setSelectedSlotId(null); setSelectedStickerId(null); setSelectedShapeId(null); }
        else if (elementType === 'sticker') { setSelectedStickerId(elementId); setSelectedSlotId(null); setSelectedTextId(null); setSelectedShapeId(null); }
        else if (elementType === 'shape') { setSelectedShapeId(elementId); setSelectedSlotId(null); setSelectedTextId(null); setSelectedStickerId(null); }
    }, []);

    const duplicateElement = useCallback((id: string, type: 'slot' | 'text' | 'sticker' | 'shape') => {
        if (type === 'slot') {
            const src = template.slots.find(s => s.id === id);
            if (!src) return;
            const newId = `s${template.slots.length + 1}`;
            const dup = { ...src, id: newId, x: Math.min(src.x + 5, 90), y: Math.min(src.y + 5, 90), zIndex: getNextZIndex() };
            setTemplate(prev => { const next = { ...prev, slots: [...prev.slots, dup] }; pushToHistory(next); return next; });
            setSelectedSlotId(newId);
        } else if (type === 'text') {
            const src = template.textElements.find(t => t.id === id);
            if (!src) return;
            const dup = { ...src, id: `txt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, x: Math.min(src.x + 5, 95), y: Math.min(src.y + 5, 95), zIndex: getNextZIndex() };
            setTemplate(prev => { const next = { ...prev, textElements: [...prev.textElements, dup] }; pushToHistory(next); return next; });
            setSelectedTextId(dup.id);
        } else if (type === 'sticker') {
            const src = (template.stickers || []).find(s => s.id === id);
            if (!src) return;
            const dup = { ...src, id: `stk_${Date.now()}`, x: Math.min(src.x + 5, 95), y: Math.min(src.y + 5, 95), zIndex: getNextZIndex() };
            setTemplate(prev => { const next = { ...prev, stickers: [...(prev.stickers || []), dup] }; pushToHistory(next); return next; });
            setSelectedStickerId(dup.id);
        } else if (type === 'shape') {
            const src = (template.shapes || []).find(s => s.id === id);
            if (!src) return;
            const dup = { ...src, id: `shp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, x: Math.min(src.x + 5, 95), y: Math.min(src.y + 5, 95), zIndex: getNextZIndex() };
            setTemplate(prev => { const next = { ...prev, shapes: [...(prev.shapes || []), dup] }; pushToHistory(next); return next; });
            setSelectedShapeId(dup.id);
        }
        setContextMenu(null);
    }, [template, pushToHistory, getNextZIndex]);

    const resetElementPosition = useCallback((id: string, type: 'slot' | 'text' | 'sticker' | 'shape') => {
        setTemplate(prev => {
            let next = { ...prev };
            if (type === 'slot') next = { ...next, slots: next.slots.map(s => s.id === id ? { ...s, x: 10, y: 10, rotation: 0 } : s) };
            else if (type === 'text') next = { ...next, textElements: next.textElements.map(t => t.id === id ? { ...t, x: 50, y: 50, rotation: 0 } : t) };
            else if (type === 'sticker') next = { ...next, stickers: (next.stickers || []).map(s => s.id === id ? { ...s, x: 50, y: 50, rotation: 0 } : s) };
            else next = { ...next, shapes: (next.shapes || []).map(s => s.id === id ? { ...s, x: 30, y: 30, rotation: 0 } : s) };
            pushToHistory(next);
            return next;
        });
        setContextMenu(null);
    }, [pushToHistory]);

    const resetElementRotation = useCallback((id: string, type: 'slot' | 'text' | 'sticker' | 'shape') => {
        setTemplate(prev => {
            let next = { ...prev };
            if (type === 'slot') next = { ...next, slots: next.slots.map(s => s.id === id ? { ...s, rotation: 0 } : s) };
            else if (type === 'text') next = { ...next, textElements: next.textElements.map(t => t.id === id ? { ...t, rotation: 0 } : t) };
            else if (type === 'sticker') next = { ...next, stickers: (next.stickers || []).map(s => s.id === id ? { ...s, rotation: 0 } : s) };
            else next = { ...next, shapes: (next.shapes || []).map(s => s.id === id ? { ...s, rotation: 0 } : s) };
            pushToHistory(next);
            return next;
        });
        setContextMenu(null);
    }, [pushToHistory]);

    const bringToFront = useCallback((id: string, type: 'slot' | 'text' | 'sticker' | 'shape') => {
        const maxZ = Math.max(
            ...template.slots.map(s => s.zIndex ?? 0),
            ...(template.stickers || []).map(s => s.zIndex ?? 0),
            ...template.textElements.map(t => t.zIndex ?? 0),
            ...(template.shapes || []).map(s => s.zIndex ?? 0),
        );
        setTemplate(prev => {
            let next = { ...prev };
            if (type === 'slot') next = { ...next, slots: next.slots.map(s => s.id === id ? { ...s, zIndex: maxZ + 1 } : s) };
            else if (type === 'sticker') next = { ...next, stickers: (next.stickers || []).map(s => s.id === id ? { ...s, zIndex: maxZ + 1 } : s) };
            else if (type === 'shape') next = { ...next, shapes: (next.shapes || []).map(s => s.id === id ? { ...s, zIndex: maxZ + 1 } : s) };
            else next = { ...next, textElements: next.textElements.map(t => t.id === id ? { ...t, zIndex: maxZ + 1 } : t) };
            pushToHistory(next);
            return next;
        });
        setContextMenu(null);
    }, [template, pushToHistory]);

    const sendToBack = useCallback((id: string, type: 'slot' | 'text' | 'sticker' | 'shape') => {
        const minZ = Math.min(
            ...template.slots.map(s => s.zIndex ?? 0),
            ...(template.stickers || []).map(s => s.zIndex ?? 0),
            ...template.textElements.map(t => t.zIndex ?? 0),
            ...(template.shapes || []).map(s => s.zIndex ?? 0),
        );
        setTemplate(prev => {
            let next = { ...prev };
            if (type === 'slot') next = { ...next, slots: next.slots.map(s => s.id === id ? { ...s, zIndex: minZ - 1 } : s) };
            else if (type === 'sticker') next = { ...next, stickers: (next.stickers || []).map(s => s.id === id ? { ...s, zIndex: minZ - 1 } : s) };
            else if (type === 'shape') next = { ...next, shapes: (next.shapes || []).map(s => s.id === id ? { ...s, zIndex: minZ - 1 } : s) };
            else next = { ...next, textElements: next.textElements.map(t => t.id === id ? { ...t, zIndex: minZ - 1 } : t) };
            pushToHistory(next);
            return next;
        });
        setContextMenu(null);
    }, [template, pushToHistory]);

    const moveLayerUp = useCallback((id: string, _type: 'slot' | 'text' | 'sticker' | 'shape') => {
        setTemplate(prev => {
            const els = [
                ...prev.slots.map(s => ({ id: s.id, type: 'slot' as const, zIndex: s.zIndex ?? 0 })),
                ...(prev.stickers || []).map(s => ({ id: s.id, type: 'sticker' as const, zIndex: s.zIndex ?? 0 })),
                ...prev.textElements.map(t => ({ id: t.id, type: 'text' as const, zIndex: t.zIndex ?? 0 })),
                ...(prev.shapes || []).map(s => ({ id: s.id, type: 'shape' as const, zIndex: s.zIndex ?? 0 })),
            ].sort((a, b) => a.zIndex - b.zIndex).map((el, i) => ({ ...el, zIndex: i }));
            const idx = els.findIndex(e => e.id === id);
            if (idx < 0 || idx >= els.length - 1) return prev;
            [els[idx].zIndex, els[idx + 1].zIndex] = [els[idx + 1].zIndex, els[idx].zIndex];
            let next = { ...prev };
            els.forEach(el => {
                if (el.type === 'slot') next = { ...next, slots: next.slots.map(s => s.id === el.id ? { ...s, zIndex: el.zIndex } : s) };
                else if (el.type === 'sticker') next = { ...next, stickers: (next.stickers || []).map(s => s.id === el.id ? { ...s, zIndex: el.zIndex } : s) };
                else if (el.type === 'shape') next = { ...next, shapes: (next.shapes || []).map(s => s.id === el.id ? { ...s, zIndex: el.zIndex } : s) };
                else next = { ...next, textElements: next.textElements.map(t => t.id === el.id ? { ...t, zIndex: el.zIndex } : t) };
            });
            pushToHistory(next);
            return next;
        });
    }, [pushToHistory]);

    const moveLayerDown = useCallback((id: string, _type: 'slot' | 'text' | 'sticker' | 'shape') => {
        setTemplate(prev => {
            const els = [
                ...prev.slots.map(s => ({ id: s.id, type: 'slot' as const, zIndex: s.zIndex ?? 0 })),
                ...(prev.stickers || []).map(s => ({ id: s.id, type: 'sticker' as const, zIndex: s.zIndex ?? 0 })),
                ...prev.textElements.map(t => ({ id: t.id, type: 'text' as const, zIndex: t.zIndex ?? 0 })),
                ...(prev.shapes || []).map(s => ({ id: s.id, type: 'shape' as const, zIndex: s.zIndex ?? 0 })),
            ].sort((a, b) => a.zIndex - b.zIndex).map((el, i) => ({ ...el, zIndex: i }));
            const idx = els.findIndex(e => e.id === id);
            if (idx <= 0) return prev;
            [els[idx].zIndex, els[idx - 1].zIndex] = [els[idx - 1].zIndex, els[idx].zIndex];
            let next = { ...prev };
            els.forEach(el => {
                if (el.type === 'slot') next = { ...next, slots: next.slots.map(s => s.id === el.id ? { ...s, zIndex: el.zIndex } : s) };
                else if (el.type === 'sticker') next = { ...next, stickers: (next.stickers || []).map(s => s.id === el.id ? { ...s, zIndex: el.zIndex } : s) };
                else if (el.type === 'shape') next = { ...next, shapes: (next.shapes || []).map(s => s.id === el.id ? { ...s, zIndex: el.zIndex } : s) };
                else next = { ...next, textElements: next.textElements.map(t => t.id === el.id ? { ...t, zIndex: el.zIndex } : t) };
            });
            pushToHistory(next);
            return next;
        });
    }, [pushToHistory]);

    const reorderLayers = useCallback((sourceId: string, targetId: string) => {
        if (sourceId === targetId) return;
        const sorted = [
            ...template.slots.map(s => ({ id: s.id, type: 'slot' as const, zIndex: s.zIndex ?? 0 })),
            ...(template.stickers || []).map(s => ({ id: s.id, type: 'sticker' as const, zIndex: s.zIndex ?? 0 })),
            ...template.textElements.map(t => ({ id: t.id, type: 'text' as const, zIndex: t.zIndex ?? 0 })),
            ...(template.shapes || []).map(s => ({ id: s.id, type: 'shape' as const, zIndex: s.zIndex ?? 0 })),
        ].sort((a, b) => b.zIndex - a.zIndex); // desc = front-first panel order

        const sourceIdx = sorted.findIndex(e => e.id === sourceId);
        const targetIdx = sorted.findIndex(e => e.id === targetId);
        if (sourceIdx === -1 || targetIdx === -1) return;

        const newOrder = [...sorted];
        const [moved] = newOrder.splice(sourceIdx, 1);
        newOrder.splice(targetIdx, 0, moved);

        const n = newOrder.length;
        setTemplate(prev => {
            let next = { ...prev };
            newOrder.forEach((el, i) => {
                const z = n - 1 - i; // first in panel (front) = highest z
                if (el.type === 'slot') next = { ...next, slots: next.slots.map(s => s.id === el.id ? { ...s, zIndex: z } : s) };
                else if (el.type === 'sticker') next = { ...next, stickers: (next.stickers || []).map(s => s.id === el.id ? { ...s, zIndex: z } : s) };
                else if (el.type === 'shape') next = { ...next, shapes: (next.shapes || []).map(s => s.id === el.id ? { ...s, zIndex: z } : s) };
                else next = { ...next, textElements: next.textElements.map(t => t.id === el.id ? { ...t, zIndex: z } : t) };
            });
            pushToHistory(next);
            return next;
        });
    }, [template, pushToHistory]);

    type AlignOp = 'centerH' | 'centerV' | 'left' | 'right' | 'top' | 'bottom';
    const alignElement = useCallback((id: string, type: 'slot' | 'text' | 'sticker' | 'shape', op: AlignOp) => {
        setTemplate(prev => {
            let next = { ...prev };
            if (type === 'slot') {
                next = { ...next, slots: next.slots.map(s => {
                    if (s.id !== id) return s;
                    const updates: Partial<PhotoSlot> = {};
                    if (op === 'centerH') updates.x = 50 - s.width / 2;
                    else if (op === 'centerV') updates.y = 50 - s.height / 2;
                    else if (op === 'left') updates.x = 0;
                    else if (op === 'right') updates.x = 100 - s.width;
                    else if (op === 'top') updates.y = 0;
                    else if (op === 'bottom') updates.y = 100 - s.height;
                    return { ...s, ...updates };
                })};
            } else if (type === 'text') {
                next = { ...next, textElements: next.textElements.map(t => {
                    if (t.id !== id) return t;
                    if (op === 'centerH') return { ...t, x: 50 };
                    if (op === 'centerV') return { ...t, y: 50 };
                    return t;
                })};
            } else if (type === 'sticker') {
                next = { ...next, stickers: (next.stickers || []).map(s => {
                    if (s.id !== id) return s;
                    if (op === 'centerH') return { ...s, x: 50 };
                    if (op === 'centerV') return { ...s, y: 50 };
                    return s;
                })};
            } else {
                next = { ...next, shapes: (next.shapes || []).map(s => {
                    if (s.id !== id) return s;
                    const updates: Partial<ShapeElement> = {};
                    if (op === 'centerH') updates.x = 50 - s.width / 2;
                    else if (op === 'centerV') updates.y = 50 - s.height / 2;
                    else if (op === 'left') updates.x = 0;
                    else if (op === 'right') updates.x = 100 - s.width;
                    else if (op === 'top') updates.y = 0;
                    else if (op === 'bottom') updates.y = 100 - s.height;
                    return { ...s, ...updates };
                })};
            }
            pushToHistory(next);
            return next;
        });
    }, [pushToHistory]);

    const toggleLock = useCallback((id: string, type: 'slot' | 'text' | 'sticker' | 'shape') => {
        setTemplate(prev => {
            let next = { ...prev };
            if (type === 'slot') next = { ...next, slots: next.slots.map(s => s.id === id ? { ...s, locked: !s.locked } : s) };
            else if (type === 'text') next = { ...next, textElements: next.textElements.map(t => t.id === id ? { ...t, locked: !t.locked } : t) };
            else if (type === 'sticker') next = { ...next, stickers: (next.stickers || []).map(s => s.id === id ? { ...s, locked: !s.locked } : s) };
            else next = { ...next, shapes: (next.shapes || []).map(s => s.id === id ? { ...s, locked: !s.locked } : s) };
            pushToHistory(next);
            return next;
        });
    }, [pushToHistory]);

    const deleteFromContextMenu = useCallback((id: string, type: 'slot' | 'text' | 'sticker' | 'shape') => {
        if (type === 'slot') deleteSlot(id);
        else if (type === 'text') deleteTextElement(id);
        else if (type === 'sticker') deleteSticker(id);
        else if (type === 'shape') deleteShape(id);
        setContextMenu(null);
    }, [deleteSlot, deleteTextElement, deleteSticker, deleteShape]);

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

            // Delete (skip locked elements)
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
                if (selectedSlotId && !templateRef.current.slots.find(s => s.id === selectedSlotId)?.locked) deleteSlot(selectedSlotId);
                else if (selectedTextId && !templateRef.current.textElements.find(t => t.id === selectedTextId)?.locked) deleteTextElement(selectedTextId);
                else if (selectedStickerId && !(templateRef.current.stickers || []).find(s => s.id === selectedStickerId)?.locked) deleteSticker(selectedStickerId);
                else if (selectedShapeId && !(templateRef.current.shapes || []).find(s => s.id === selectedShapeId)?.locked) deleteShape(selectedShapeId);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, selectedSlotId, selectedTextId, selectedStickerId, selectedShapeId, deleteSlot, deleteTextElement, deleteSticker, deleteShape]);

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
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            setBackgroundImage(dataUrl);
            setTemplate(prev => {
                const next = { ...prev, backgroundImage: dataUrl };
                pushToHistory(next);
                return next;
            });
        };
        reader.readAsDataURL(file);
    };

    const handleSaveClick = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            let finalTemplate = { ...template, backgroundImage: backgroundImage ?? undefined };

            // Generate snapshots if visualizer is ready
            if (visualizerRef.current) {
                const snapshots = await visualizerRef.current.getSnapshot();
                finalTemplate.backgroundSnapshot = snapshots.background;
                finalTemplate.foregroundSnapshot = snapshots.foreground;
            }

            onSave(finalTemplate);
        } catch (error) {
            console.error('Error generating snapshots:', error);
            onSave({ ...template, backgroundImage: backgroundImage ?? undefined });
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
        { key: 'shapes', label: 'Shapes', icon: Square },
        { key: 'layers', label: 'Layers', icon: Layers },
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
                        <div className="flex items-center gap-4 bg-neutral-900 border border-white/5 rounded-full px-4 py-1.5 mr-4">
                            <button onClick={() => setWorkspaceZoom(prev => Math.max(0.2, prev - 0.1))} className="text-neutral-500 hover:text-white transition-colors">
                                <ZoomOut size={16} />
                            </button>
                            <div className="w-16 text-center">
                                <span className="text-[10px] font-black text-white">{Math.round(workspaceZoom * 100)}%</span>
                            </div>
                            <button onClick={() => setWorkspaceZoom(prev => Math.min(3, prev + 0.1))} className="text-neutral-500 hover:text-white transition-colors">
                                <ZoomIn size={16} />
                            </button>
                            <div className="w-px h-3 bg-white/10 mx-1" />
                            <button onClick={() => setWorkspaceZoom(1)} className="text-[8px] font-black text-neutral-500 hover:text-white uppercase tracking-widest">Reset</button>
                        </div>

                        <div className="flex items-center gap-1 bg-neutral-900 border border-white/5 rounded-full p-1 mr-4">
                            <button 
                                onClick={undo} 
                                disabled={!canUndo}
                                className="w-9 h-9 flex items-center justify-center hover:bg-white/5 disabled:opacity-20 transition-all rounded-full text-neutral-400"
                                title="Undo (Ctrl+Z)"
                            >
                                <RotateCw size={16} className="scale-x-[-1]" />
                            </button>
                            <button
                                onClick={redo}
                                disabled={!canRedo}
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
                        <div className="grid grid-cols-7 gap-1 p-3 bg-white/5 border-b border-white/5">
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
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Canvas Orientation</h3>
                                            <button 
                                                onClick={rotateCanvas}
                                                className="p-2 rounded-lg bg-white/5 border border-white/5 text-neutral-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all flex items-center gap-2 text-[7px] font-black uppercase tracking-widest"
                                                title="Swap Width & Height"
                                            >
                                                <RefreshCcw size={12} /> Rotate 90°
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {[
                                                { label: 'Portrait', icon: <div className="w-2.5 h-3.5 border-2 border-current rounded-[1px]" />, w: 420, h: 630 },
                                                { label: 'Landscape', icon: <div className="w-3.5 h-2.5 border-2 border-current rounded-[1px]" />, w: 630, h: 420 },
                                            ].map((opt) => (
                                                <button
                                                    key={opt.label}
                                                    onClick={() => {
                                                        const next = { ...template, width: opt.w, height: opt.h };
                                                        setTemplate(next);
                                                        pushToHistory(next);
                                                    }}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all ${
                                                        (template.width === opt.w && template.height === opt.h)
                                                        ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20'
                                                        : 'bg-neutral-900 border-white/5 text-neutral-500 hover:border-white/20'
                                                    }`}
                                                >
                                                    {opt.icon}
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Base Preset</label>
                                            <div className="relative group">
                                                <select 
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === 'Square') setTemplate({ ...template, width: 600, height: 600 });
                                                        else if (val === 'Strip') setTemplate({ ...template, width: 210, height: 630 });
                                                        else if (val === '4x6') setTemplate({ ...template, width: 420, height: 630 });
                                                    }}
                                                    value={template.width === 600 ? 'Square' : template.width === 210 ? 'Strip' : '4x6'}
                                                    className="w-full bg-neutral-900 border border-white/5 rounded-xl px-4 py-3 text-[10px] font-black text-white uppercase tracking-widest outline-none appearance-none focus:border-blue-500 transition-all cursor-pointer"
                                                >
                                                    <option value="4x6">102mm x 152mm (4x6)</option>
                                                    <option value="Square">Square (1:1)</option>
                                                    <option value="Strip">Photo Strip (2x6)</option>
                                                </select>
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                                                    <ChevronRight size={14} className="rotate-90" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                                            <div className="space-y-2">
                                                <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Custom Width (px)</label>
                                                <div className="relative group">
                                                    <input 
                                                        type="number" 
                                                        value={template.width}
                                                        onChange={(e) => {
                                                            const w = Math.max(100, +e.target.value);
                                                            update({ width: w });
                                                            localStorage.setItem('snapwrap_last_custom_w', w.toString());
                                                        }}
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
                                                        onChange={(e) => {
                                                            const h = Math.max(100, +e.target.value);
                                                            update({ height: h });
                                                            localStorage.setItem('snapwrap_last_custom_h', h.toString());
                                                        }}
                                                        onBlur={() => pushToHistory(template)}
                                                        className="w-full bg-neutral-900 border border-white/5 rounded-xl px-4 py-3 text-[11px] font-black text-white outline-none focus:border-blue-500 transition-all"
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-600 text-[8px] font-black">PX</div>
                                                </div>
                                            </div>
                                        </div>
                                        {localStorage.getItem('snapwrap_last_custom_w') && (
                                            <div className="pt-2">
                                                <button 
                                                    onClick={() => {
                                                        const w = parseInt(localStorage.getItem('snapwrap_last_custom_w') || '420');
                                                        const h = parseInt(localStorage.getItem('snapwrap_last_custom_h') || '630');
                                                        update({ width: w, height: h });
                                                        pushToHistory({ ...template, width: w, height: h });
                                                    }}
                                                    className="w-full py-2 rounded-lg bg-white/5 border border-white/10 text-[7px] font-black text-neutral-400 uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all"
                                                >
                                                    Recall Last Custom: {localStorage.getItem('snapwrap_last_custom_w')}x{localStorage.getItem('snapwrap_last_custom_h')}
                                                </button>
                                            </div>
                                        )}
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
                                                        <input type="range" min={-180} max={180} value={template.slots.find(s => s.id === selectedSlotId)?.rotation || 0} onChange={(e) => updateSlot(selectedSlotId, { rotation: +e.target.value })} onMouseUp={() => pushToHistory(templateRef.current)} className="w-full accent-blue-500" />
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Opacity</label>
                                                            <span className="text-[9px] font-black text-white">{Math.round((template.slots.find(s => s.id === selectedSlotId)?.opacity ?? 1) * 100)}%</span>
                                                        </div>
                                                        <input type="range" min={10} max={100} value={Math.round((template.slots.find(s => s.id === selectedSlotId)?.opacity ?? 1) * 100)} onChange={(e) => updateSlot(selectedSlotId, { opacity: +e.target.value / 100 })} onMouseUp={() => pushToHistory(templateRef.current)} className="w-full accent-blue-500" />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between">
                                                            <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Corner Radius</label>
                                                            <span className="text-[9px] font-black text-white">{template.slots.find(s => s.id === selectedSlotId)?.borderRadius ?? template.borderRadius}px</span>
                                                        </div>
                                                        <input type="range" min={0} max={120} value={template.slots.find(s => s.id === selectedSlotId)?.borderRadius ?? template.borderRadius} onChange={(e) => updateSlot(selectedSlotId, { borderRadius: +e.target.value })} onMouseUp={() => pushToHistory(templateRef.current)} className="w-full accent-blue-500" />
                                                    </div>
                                                </div>

                                                <div className="space-y-3 pt-4 border-t border-white/5">
                                                    <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Alignment</label>
                                                    <div className="grid grid-cols-3 gap-1.5">
                                                        {([
                                                            { op: 'left' as const, icon: AlignStartVertical, label: 'Left' },
                                                            { op: 'centerH' as const, icon: AlignCenterVertical, label: 'H Mid' },
                                                            { op: 'right' as const, icon: AlignEndVertical, label: 'Right' },
                                                            { op: 'top' as const, icon: AlignStartHorizontal, label: 'Top' },
                                                            { op: 'centerV' as const, icon: AlignCenterHorizontal, label: 'V Mid' },
                                                            { op: 'bottom' as const, icon: AlignEndHorizontal, label: 'Bottom' },
                                                        ]).map(({ op, icon: Icon, label }) => (
                                                            <button key={op} onClick={() => alignElement(selectedSlotId, 'slot', op)}
                                                                className="flex flex-col items-center justify-center gap-1 h-10 rounded-xl bg-neutral-900 border border-white/5 text-neutral-400 hover:border-blue-500/50 hover:text-white transition-all"
                                                                title={label}
                                                            >
                                                                <Icon size={12} />
                                                                <span className="text-[6px] font-black uppercase tracking-widest">{label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="space-y-3 pt-4 border-t border-white/5">
                                                    <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Layer Order</label>
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        <button onClick={() => moveLayerDown(selectedSlotId, 'slot')} className="flex items-center justify-center gap-1 h-9 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all text-[7px] font-black uppercase tracking-widest">
                                                            <ArrowDown size={12} /> Back
                                                        </button>
                                                        <button onClick={() => moveLayerUp(selectedSlotId, 'slot')} className="flex items-center justify-center gap-1 h-9 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all text-[7px] font-black uppercase tracking-widest">
                                                            <ArrowUp size={12} /> Front
                                                        </button>
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

                                        <div className="flex flex-col gap-3">
                                            <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Color Overlay</label>
                                            <div className="flex items-center gap-3 bg-neutral-900 border border-white/5 rounded-xl p-2">
                                                <input type="color"
                                                    value={template.backgroundOverlay || '#000000'}
                                                    onChange={(e) => update({ backgroundOverlay: e.target.value })}
                                                    className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                                                />
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[7px] font-black text-neutral-500 uppercase">Opacity</span>
                                                        <span className="text-[8px] font-black text-white">{Math.round((template.backgroundOverlayOpacity ?? 0) * 100)}%</span>
                                                    </div>
                                                    <input type="range" min={0} max={100}
                                                        value={Math.round((template.backgroundOverlayOpacity ?? 0) * 100)}
                                                        onChange={(e) => update({ backgroundOverlayOpacity: +e.target.value / 100 })}
                                                        onMouseUp={() => pushToHistory(templateRef.current)}
                                                        className="w-full accent-blue-500"
                                                    />
                                                </div>
                                                {template.backgroundOverlay && (template.backgroundOverlayOpacity ?? 0) > 0 && (
                                                    <button onClick={() => update({ backgroundOverlayOpacity: 0 })} className="text-[7px] font-black text-red-500 hover:text-red-400 transition-all shrink-0">Clear</button>
                                                )}
                                            </div>
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

                                            <div className="space-y-4 pt-4 border-t border-white/5">
                                                <h4 className="text-[7px] font-black text-neutral-600 uppercase tracking-[0.2em]">Stroke / Outline</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-2">
                                                        <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Color</label>
                                                        <div className="flex bg-neutral-900 border border-white/5 rounded-xl p-2 h-[42px]">
                                                            <input type="color" value={selectedText.textStroke || '#000000'} onChange={(e) => updateText(selectedText.id, { textStroke: e.target.value })} className="w-full h-full cursor-pointer bg-transparent border-0" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Width</label>
                                                            <span className="text-[9px] font-black text-white">{selectedText.textStrokeWidth ?? 0}px</span>
                                                        </div>
                                                        <input type="range" min={0} max={8} step={0.5} value={selectedText.textStrokeWidth ?? 0} onChange={(e) => updateText(selectedText.id, { textStrokeWidth: +e.target.value })} onMouseUp={() => pushToHistory(templateRef.current)} className="w-full accent-blue-500 mt-3" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3 pt-4 border-t border-white/5">
                                                <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Alignment</label>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <button onClick={() => alignElement(selectedText.id, 'text', 'centerH')} className="flex items-center justify-center gap-1.5 h-9 rounded-xl bg-neutral-900 border border-white/5 text-neutral-400 hover:border-blue-500/50 hover:text-white transition-all text-[7px] font-black uppercase tracking-widest">
                                                        <AlignCenterVertical size={12} /> H Center
                                                    </button>
                                                    <button onClick={() => alignElement(selectedText.id, 'text', 'centerV')} className="flex items-center justify-center gap-1.5 h-9 rounded-xl bg-neutral-900 border border-white/5 text-neutral-400 hover:border-blue-500/50 hover:text-white transition-all text-[7px] font-black uppercase tracking-widest">
                                                        <AlignCenterHorizontal size={12} /> V Center
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-white/5 space-y-4">
                                                <h4 className="text-[7px] font-black text-neutral-600 uppercase tracking-[0.2em]">Layering</h4>
                                                <div className="grid grid-cols-4 gap-1.5">
                                                    <button onClick={() => sendToBack(selectedText.id, 'text')} className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all" title="Send to Back">
                                                        <ArrowDown size={14} className="translate-y-0.5" /><ArrowDown size={14} className="-translate-y-0.5" />
                                                    </button>
                                                    <button onClick={() => moveLayerDown(selectedText.id, 'text')} className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all" title="Move Backward">
                                                        <ArrowDown size={14} />
                                                    </button>
                                                    <button onClick={() => moveLayerUp(selectedText.id, 'text')} className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all" title="Move Forward">
                                                        <ArrowUp size={14} />
                                                    </button>
                                                    <button onClick={() => bringToFront(selectedText.id, 'text')} className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all" title="Bring to Front">
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

                                            {/* Alignment */}
                                            <div className="space-y-3">
                                                <h4 className="text-[7px] font-black text-neutral-600 uppercase tracking-[0.2em]">Alignment</h4>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <button onClick={() => alignElement(selectedSticker.id, 'sticker', 'centerH')} className="flex items-center justify-center gap-1.5 h-9 rounded-xl bg-neutral-900 border border-white/5 text-neutral-400 hover:border-blue-500/50 hover:text-white transition-all text-[7px] font-black uppercase tracking-widest">
                                                        <AlignCenterVertical size={12} /> H Center
                                                    </button>
                                                    <button onClick={() => alignElement(selectedSticker.id, 'sticker', 'centerV')} className="flex items-center justify-center gap-1.5 h-9 rounded-xl bg-neutral-900 border border-white/5 text-neutral-400 hover:border-blue-500/50 hover:text-white transition-all text-[7px] font-black uppercase tracking-widest">
                                                        <AlignCenterHorizontal size={12} /> V Center
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Transform & Layering */}
                                            <div className="space-y-4">
                                                <h4 className="text-[7px] font-black text-neutral-600 uppercase tracking-[0.2em]">Layering</h4>
                                                <div className="grid grid-cols-4 gap-1.5">
                                                    <button onClick={() => sendToBack(selectedSticker.id, 'sticker')} className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all" title="Send to Back">
                                                        <ArrowDown size={14} className="translate-y-0.5" /><ArrowDown size={14} className="-translate-y-0.5" />
                                                    </button>
                                                    <button onClick={() => moveLayerDown(selectedSticker.id, 'sticker')} className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all" title="Move Backward">
                                                        <ArrowDown size={14} />
                                                    </button>
                                                    <button onClick={() => moveLayerUp(selectedSticker.id, 'sticker')} className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all" title="Move Forward">
                                                        <ArrowUp size={14} />
                                                    </button>
                                                    <button onClick={() => bringToFront(selectedSticker.id, 'sticker')} className="flex items-center justify-center h-10 rounded-xl bg-neutral-900 border border-white/5 text-white hover:border-blue-500/50 transition-all" title="Bring to Front">
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

                            {/* ── Shapes ── */}
                            {activeTab === 'shapes' && (
                                <section className="space-y-6">
                                    <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Add Shape</h3>
                                    <div className="grid grid-cols-5 gap-2">
                                        {([
                                            { type: 'rect' as const,     icon: Square,    label: 'Rect'     },
                                            { type: 'circle' as const,   icon: Circle,    label: 'Circle'   },
                                            { type: 'triangle' as const, icon: Triangle,  label: 'Triangle' },
                                            { type: 'star' as const,     icon: StarIcon,  label: 'Star'     },
                                            { type: 'line' as const,     icon: Minus,     label: 'Line'     },
                                        ]).map(({ type, icon: Icon, label }) => (
                                            <button
                                                key={type}
                                                onClick={() => addShape(type)}
                                                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-white/5 bg-neutral-900 hover:border-white/20 hover:bg-white/5 transition-all text-neutral-400 hover:text-white"
                                            >
                                                <Icon size={18} />
                                                <span className="text-[7px] font-black uppercase tracking-widest">{label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Shape properties */}
                                    {selectedShapeId && (() => {
                                        const shp = (template.shapes || []).find(s => s.id === selectedShapeId);
                                        if (!shp) return null;
                                        return (
                                            <div className="space-y-5 pt-4 border-t border-white/5">
                                                <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">{shp.shapeType.toUpperCase()} Properties</h3>

                                                {/* Fill color */}
                                                {shp.shapeType !== 'line' && (
                                                    <div className="space-y-2">
                                                        <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Fill Color</label>
                                                        <div className="flex items-center gap-2">
                                                            <input type="color" value={shp.fillColor} onChange={e => updateShape(shp.id, { fillColor: e.target.value })}
                                                                className="w-10 h-8 rounded cursor-pointer bg-transparent border-0 outline-none" />
                                                            <input type="text" value={shp.fillColor} onChange={e => updateShape(shp.id, { fillColor: e.target.value })}
                                                                className="flex-1 bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white font-mono" />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Stroke / Line color */}
                                                <div className="space-y-2">
                                                    <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">
                                                        {shp.shapeType === 'line' ? 'Line Color' : 'Stroke'}
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="color" value={shp.strokeColor} onChange={e => updateShape(shp.id, { strokeColor: e.target.value })}
                                                            className="w-10 h-8 rounded cursor-pointer bg-transparent border-0 outline-none" />
                                                        <input type="range" min={shp.shapeType === 'line' ? 1 : 0} max={shp.shapeType === 'line' ? 40 : 20} value={shp.strokeWidth}
                                                            onChange={e => updateShape(shp.id, { strokeWidth: +e.target.value })}
                                                            className="flex-1" />
                                                        <span className="text-[9px] text-white w-6 text-right">{shp.strokeWidth}</span>
                                                    </div>
                                                </div>

                                                {/* Corner radius (rect only) */}
                                                {shp.shapeType === 'rect' && (
                                                    <div className="space-y-2">
                                                        <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Corner Radius</label>
                                                        <div className="flex items-center gap-3">
                                                            <input type="range" min={0} max={200} value={shp.borderRadius} onChange={e => updateShape(shp.id, { borderRadius: +e.target.value })}
                                                                className="flex-1" />
                                                            <span className="text-[9px] text-white w-8 text-right">{shp.borderRadius}px</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Opacity */}
                                                <div className="space-y-2">
                                                    <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Opacity</label>
                                                    <div className="flex items-center gap-3">
                                                        <input type="range" min={0} max={1} step={0.01} value={shp.opacity} onChange={e => updateShape(shp.id, { opacity: +e.target.value })}
                                                            className="flex-1" />
                                                        <span className="text-[9px] text-white w-8 text-right">{Math.round(shp.opacity * 100)}%</span>
                                                    </div>
                                                </div>

                                                {/* Rotation */}
                                                <div className="space-y-2">
                                                    <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Rotation</label>
                                                    <div className="flex items-center gap-3">
                                                        <input type="range" min={-180} max={180} value={shp.rotation} onChange={e => updateShape(shp.id, { rotation: +e.target.value })}
                                                            className="flex-1" />
                                                        <span className="text-[9px] text-white w-10 text-right">{shp.rotation}°</span>
                                                    </div>
                                                </div>

                                                {/* Size */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Width %</label>
                                                        <input type="number" min={2} max={100} value={Math.round(shp.width)}
                                                            onChange={e => updateShape(shp.id, { width: +e.target.value })}
                                                            className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Height %</label>
                                                        <input type="number" min={2} max={100} value={Math.round(shp.height)}
                                                            onChange={e => updateShape(shp.id, { height: +e.target.value })}
                                                            className="w-full bg-neutral-900 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white" />
                                                    </div>
                                                </div>

                                                {/* Alignment */}
                                                <div className="space-y-2">
                                                    <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Align</label>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        <button onClick={() => alignElement(shp.id, 'shape', 'left')}   className="py-1.5 rounded bg-neutral-900 border border-white/5 hover:border-white/20 text-neutral-400 hover:text-white transition-all flex items-center justify-center"><AlignStartVertical size={12} /></button>
                                                        <button onClick={() => alignElement(shp.id, 'shape', 'centerH')} className="py-1.5 rounded bg-neutral-900 border border-white/5 hover:border-white/20 text-neutral-400 hover:text-white transition-all flex items-center justify-center"><AlignCenterVertical size={12} /></button>
                                                        <button onClick={() => alignElement(shp.id, 'shape', 'right')}  className="py-1.5 rounded bg-neutral-900 border border-white/5 hover:border-white/20 text-neutral-400 hover:text-white transition-all flex items-center justify-center"><AlignEndVertical size={12} /></button>
                                                        <button onClick={() => alignElement(shp.id, 'shape', 'top')}    className="py-1.5 rounded bg-neutral-900 border border-white/5 hover:border-white/20 text-neutral-400 hover:text-white transition-all flex items-center justify-center"><AlignStartHorizontal size={12} /></button>
                                                        <button onClick={() => alignElement(shp.id, 'shape', 'centerV')} className="py-1.5 rounded bg-neutral-900 border border-white/5 hover:border-white/20 text-neutral-400 hover:text-white transition-all flex items-center justify-center"><AlignCenterHorizontal size={12} /></button>
                                                        <button onClick={() => alignElement(shp.id, 'shape', 'bottom')} className="py-1.5 rounded bg-neutral-900 border border-white/5 hover:border-white/20 text-neutral-400 hover:text-white transition-all flex items-center justify-center"><AlignEndHorizontal size={12} /></button>
                                                    </div>
                                                </div>

                                                {/* Delete */}
                                                <button onClick={() => deleteShape(shp.id)}
                                                    className="w-full py-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                                    <Trash2 size={12} /> Delete Shape
                                                </button>
                                            </div>
                                        );
                                    })()}
                                </section>
                            )}

                            {/* ── Layers ── */}
                            {activeTab === 'layers' && (() => {
                                const allElements = [
                                    ...template.slots.map(s => ({ id: s.id, type: 'slot' as const, zIndex: s.zIndex ?? 0, label: s.id })),
                                    ...(template.stickers || []).map(s => ({ id: s.id, type: 'sticker' as const, zIndex: s.zIndex ?? 0, label: 'Sticker' })),
                                    ...template.textElements.map(t => ({ id: t.id, type: 'text' as const, zIndex: t.zIndex ?? 0, label: t.text.slice(0, 20) })),
                                ].sort((a, b) => b.zIndex - a.zIndex); // front-first

                                const selectedId = selectedSlotId || selectedTextId || selectedStickerId;

                                const typeColors = {
                                    slot:    { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400',   badge: 'bg-blue-500'   },
                                    sticker: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', badge: 'bg-orange-500' },
                                    text:    { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', badge: 'bg-purple-500'  },
                                };

                                return (
                                    <section className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Layer Stack</h3>
                                            <span className="text-[7px] text-neutral-600 uppercase tracking-widest">drag to reorder</span>
                                        </div>
                                        <div className="space-y-1">
                                            {allElements.length === 0 && (
                                                <div className="py-8 text-center text-[8px] text-neutral-600 uppercase tracking-widest">No layers yet</div>
                                            )}
                                            {allElements.map((el) => {
                                                const isSelected = el.id === selectedId;
                                                const isDragOver = dragOverLayerId === el.id && dragLayerId !== el.id;
                                                const colors = typeColors[el.type];
                                                return (
                                                    <div
                                                        key={el.id}
                                                        draggable
                                                        onDragStart={(e) => {
                                                            setDragLayerId(el.id);
                                                            e.dataTransfer.effectAllowed = 'move';
                                                        }}
                                                        onDragOver={(e) => {
                                                            e.preventDefault();
                                                            e.dataTransfer.dropEffect = 'move';
                                                            setDragOverLayerId(el.id);
                                                        }}
                                                        onDragLeave={() => setDragOverLayerId(null)}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            if (dragLayerId) reorderLayers(dragLayerId, el.id);
                                                            setDragLayerId(null);
                                                            setDragOverLayerId(null);
                                                        }}
                                                        onDragEnd={() => { setDragLayerId(null); setDragOverLayerId(null); }}
                                                        onClick={() => {
                                                            if (el.type === 'slot') { setSelectedSlotId(el.id); setSelectedTextId(null); setSelectedStickerId(null); setActiveTab('layout'); }
                                                            else if (el.type === 'text') { setSelectedTextId(el.id); setSelectedSlotId(null); setSelectedStickerId(null); setActiveTab('text'); }
                                                            else { setSelectedStickerId(el.id); setSelectedSlotId(null); setSelectedTextId(null); setActiveTab('stickers'); }
                                                        }}
                                                        className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-grab active:cursor-grabbing transition-all ${
                                                            dragLayerId === el.id
                                                                ? 'opacity-40 scale-95'
                                                                : isDragOver
                                                                ? 'border-blue-500/60 bg-blue-500/10 scale-[1.02]'
                                                                : isSelected
                                                                ? `${colors.bg} ${colors.border}`
                                                                : 'bg-neutral-900 border-white/5 hover:border-white/20'
                                                        }`}
                                                    >
                                                        {/* drag grip */}
                                                        <div className="flex flex-col gap-[3px] flex-shrink-0 opacity-30 group-hover:opacity-60 transition-opacity">
                                                            {[0,1,2].map(i => <div key={i} className="w-3 h-px bg-neutral-400 rounded-full" />)}
                                                        </div>
                                                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.badge}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <span className={`text-[9px] font-black truncate block ${isSelected ? colors.text : 'text-neutral-300'}`}>
                                                                {el.label}
                                                            </span>
                                                            <span className="text-[7px] text-neutral-600 uppercase tracking-widest">
                                                                {el.type}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); toggleLock(el.id, el.type); }}
                                                                className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${
                                                                    (el.type === 'slot' ? template.slots.find(s => s.id === el.id)?.locked :
                                                                     el.type === 'text' ? template.textElements.find(t => t.id === el.id)?.locked :
                                                                     (template.stickers || []).find(s => s.id === el.id)?.locked)
                                                                    ? 'text-amber-400 bg-amber-500/10 opacity-100'
                                                                    : 'hover:bg-white/10 text-neutral-400 hover:text-amber-400'
                                                                }`}
                                                                title="Toggle lock"
                                                            >
                                                                {(el.type === 'slot' ? template.slots.find(s => s.id === el.id)?.locked :
                                                                  el.type === 'text' ? template.textElements.find(t => t.id === el.id)?.locked :
                                                                  (template.stickers || []).find(s => s.id === el.id)?.locked)
                                                                    ? <Lock size={10} /> : <Unlock size={10} />}
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); moveLayerUp(el.id, el.type); }}
                                                                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-all"
                                                                title="Bring forward"
                                                            >
                                                                <ArrowUp size={10} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); moveLayerDown(el.id, el.type); }}
                                                                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-all"
                                                                title="Send backward"
                                                            >
                                                                <ArrowDown size={10} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (el.type === 'slot') deleteSlot(el.id);
                                                                    else if (el.type === 'text') deleteTextElement(el.id);
                                                                    else deleteSticker(el.id);
                                                                }}
                                                                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-neutral-400 hover:text-red-400 transition-all"
                                                            >
                                                                <Trash2 size={10} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                );
                            })()}
                        </div>
                    </aside>

                    {/* MAIN: Preview Canvas */}
                    <main className="flex-1 bg-[#fafafa] p-10 flex flex-col items-center justify-center relative overflow-hidden"
                        style={{ 
                            backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)', 
                            backgroundSize: '30px 30px' 
                        }}
                    >
                        {/* Floating Selection Toolbar */}
                        {(selectedSlotId || selectedTextId || selectedStickerId || selectedShapeId) && (() => {
                            const id = selectedSlotId || selectedTextId || selectedStickerId || selectedShapeId;
                            const type = selectedSlotId ? 'slot' : selectedTextId ? 'text' : selectedStickerId ? 'sticker' : 'shape';
                            const typeLabels = { slot: 'Photo Slot', text: 'Text Layer', sticker: 'Sticker', shape: 'Shape' };
                            const typeColors = { slot: '#3b82f6', text: '#a855f7', sticker: '#f97316', shape: '#10b981' };
                            const allElements = [
                                ...template.slots.map(s => ({ id: s.id, zIndex: s.zIndex ?? 0 })),
                                ...(template.stickers || []).map(s => ({ id: s.id, zIndex: s.zIndex ?? 0 })),
                                ...template.textElements.map(t => ({ id: t.id, zIndex: t.zIndex ?? 0 })),
                                ...(template.shapes || []).map(s => ({ id: s.id, zIndex: s.zIndex ?? 0 })),
                            ].sort((a, b) => a.zIndex - b.zIndex);
                            const pos = allElements.findIndex(e => e.id === id) + 1;
                            const total = allElements.length;
                            const isLocked =
                                type === 'slot' ? template.slots.find(s => s.id === id)?.locked :
                                type === 'text' ? template.textElements.find(t => t.id === id)?.locked :
                                type === 'sticker' ? (template.stickers || []).find(s => s.id === id)?.locked :
                                (template.shapes || []).find(s => s.id === id)?.locked;
                            return (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-neutral-950/90 backdrop-blur border border-white/10 rounded-full px-3 py-1.5 shadow-xl z-[200]">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: typeColors[type] }} />
                                    <span className="text-[8px] font-black text-white uppercase tracking-widest">{typeLabels[type]}</span>
                                    <div className="h-3 w-px bg-white/10 mx-1" />
                                    <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Layer {pos}/{total}</span>
                                    <div className="h-3 w-px bg-white/10 mx-1" />

                                    {/* Alignment */}
                                    <button onClick={() => alignElement(id!, type, 'centerH')} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-all" title="Center Horizontally">
                                        <AlignCenterVertical size={10} />
                                    </button>
                                    <button onClick={() => alignElement(id!, type, 'centerV')} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-all" title="Center Vertically">
                                        <AlignCenterHorizontal size={10} />
                                    </button>
                                    {(type === 'slot' || type === 'shape') && (<>
                                        <button onClick={() => alignElement(id!, type, 'left')} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-all" title="Align Left"><AlignStartVertical size={10} /></button>
                                        <button onClick={() => alignElement(id!, type, 'right')} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-all" title="Align Right"><AlignEndVertical size={10} /></button>
                                        <button onClick={() => alignElement(id!, type, 'top')} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-all" title="Align Top"><AlignStartHorizontal size={10} /></button>
                                        <button onClick={() => alignElement(id!, type, 'bottom')} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-all" title="Align Bottom"><AlignEndHorizontal size={10} /></button>
                                    </>)}

                                    <div className="h-3 w-px bg-white/10 mx-1" />
                                    <button onClick={() => moveLayerDown(id!, type)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-all" title="Send backward"><ArrowDown size={10} /></button>
                                    <button onClick={() => moveLayerUp(id!, type)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-all" title="Bring forward"><ArrowUp size={10} /></button>

                                    <div className="h-3 w-px bg-white/10 mx-1" />
                                    {/* Lock */}
                                    <button
                                        onClick={() => toggleLock(id!, type)}
                                        className={`w-6 h-6 flex items-center justify-center rounded-full transition-all ${isLocked ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'hover:bg-white/10 text-neutral-400 hover:text-white'}`}
                                        title={isLocked ? 'Unlock' : 'Lock'}
                                    >
                                        {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                                    </button>

                                    <div className="h-3 w-px bg-white/10 mx-1" />
                                    <button
                                        onClick={() => {
                                            if (isLocked) return;
                                            if (selectedSlotId) deleteSlot(selectedSlotId);
                                            else if (selectedTextId) deleteTextElement(selectedTextId);
                                            else if (selectedStickerId) deleteSticker(selectedStickerId);
                                            else if (selectedShapeId) deleteShape(selectedShapeId);
                                        }}
                                        className={`w-6 h-6 flex items-center justify-center rounded-full transition-all ${isLocked ? 'opacity-20 cursor-not-allowed' : 'hover:bg-red-500/10 text-neutral-400 hover:text-red-400'}`}
                                        title="Delete"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                            );
                        })()}

                        {/* Zoom/Pan info */}
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-neutral-900 border border-white/5 px-6 py-2 rounded-full">
                            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Matrix Preview</span>
                            <div className="h-3 w-px bg-white/10" />
                            <span className="text-[9px] font-black text-white uppercase tracking-widest">{template.layout.rows}x{template.layout.cols} Active Grid</span>
                        </div>

                        {/* Template Container */}
                        <div 
                            ref={previewRef}
                            className="relative shadow-2xl transition-all duration-300 ease-out"
                            style={{ 
                                width: template.width, 
                                height: template.height, 
                                transform: `scale(${workspaceZoom})`,
                                transformOrigin: 'center center',
                                backgroundColor: template.background.includes('gradient') ? undefined : template.background,
                                backgroundImage: (backgroundImage ? `url(${backgroundImage})` : template.backgroundImage ? `url(${template.backgroundImage})` : 'none') + (template.background.includes('gradient') ? `, ${template.background}` : ''),
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                padding: template.padding,
                                border: `${template.borderWidth}px solid ${template.borderColor}`,
                                borderRadius: template.borderRadius,
                                overflow: 'hidden'
                            }}
                            onClick={() => { setSelectedTextId(null); setSelectedStickerId(null); setSelectedSlotId(null); setSelectedShapeId(null); }}
                        >
                            {/* Background overlay tint */}
                            {template.backgroundOverlay && (
                                <div className="absolute inset-0 pointer-events-none" style={{
                                    backgroundColor: template.backgroundOverlay,
                                    opacity: template.backgroundOverlayOpacity ?? 0.3,
                                    zIndex: 0,
                                }} />
                            )}

                            {/* Unified layer render — sorted by zIndex so DOM order matches stacking order */}
                            {[
                                ...template.slots.map(s => ({ type: 'slot' as const, data: s, zIndex: s.zIndex ?? 0 })),
                                ...(template.stickers || []).map(s => ({ type: 'sticker' as const, data: s, zIndex: s.zIndex ?? 0 })),
                                ...template.textElements.map(t => ({ type: 'text' as const, data: t, zIndex: t.zIndex ?? 0 })),
                                ...(template.shapes || []).map(s => ({ type: 'shape' as const, data: s, zIndex: s.zIndex ?? 0 })),
                            ].sort((a, b) => a.zIndex - b.zIndex).map((item) => {
                                if (item.type === 'slot') {
                                    const slot = item.data;
                                    return (
                                        <div key={slot.id}
                                            className={`absolute flex items-center justify-center group border-2 transition-shadow ${slot.locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${selectedSlotId === slot.id ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-white/10 hover:border-white/30'}`}
                                            style={{
                                                left: `${slot.x}%`,
                                                top: `${slot.y}%`,
                                                width: `${slot.width}%`,
                                                height: `${slot.height}%`,
                                                transform: `rotate(${slot.rotation || 0}deg)`,
                                                backgroundColor: 'rgba(0,0,0,0.4)',
                                                borderRadius: slot.borderRadius ?? template.borderRadius,
                                                zIndex: item.zIndex,
                                                opacity: slot.opacity ?? 1,
                                            }}
                                            onMouseDown={slot.locked ? undefined : (e) => {
                                                setSelectedSlotId(slot.id);
                                                setSelectedTextId(null);
                                                setSelectedStickerId(null);
                                                setActiveTab('layout');
                                                startDrag(e, slot.id, slot.x, slot.y);
                                            }}
                                            onClick={(e) => { e.stopPropagation(); setSelectedSlotId(slot.id); setSelectedTextId(null); setSelectedStickerId(null); setActiveTab('layout'); }}
                                            onContextMenu={(e) => openContextMenu(e, slot.id, 'slot')}
                                        >
                                            <div className="flex flex-col items-center gap-2">
                                                <ImageIcon size={24} className="text-white/20 group-hover:text-white/40 transition-colors" />
                                                <span className="text-[7px] font-black text-white/20 uppercase tracking-[0.2em]">{slot.id}</span>
                                            </div>
                                            {slot.locked && (
                                                <div className="absolute top-1 right-1 text-white/30"><Lock size={10} /></div>
                                            )}
                                            {selectedSlotId === slot.id && (
                                                <>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); deleteSlot(slot.id); }}
                                                        className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg z-[100]"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                    {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map(type => (
                                                        <div
                                                            key={type}
                                                            className={`absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full z-[110] cursor-${type}-resize hover:scale-125 transition-transform`}
                                                            style={{
                                                                top: type.includes('n') ? -6 : type.includes('s') ? 'calc(100% - 6px)' : '50%',
                                                                left: type.includes('w') ? -6 : type.includes('e') ? 'calc(100% - 6px)' : '50%',
                                                                marginTop: type === 'e' || type === 'w' ? -6 : 0,
                                                                marginLeft: type === 'n' || type === 's' ? -6 : 0,
                                                            }}
                                                            onMouseDown={(e) => startResize(e, slot.id, type, slot.x, slot.y, slot.width, slot.height)}
                                                        />
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    );
                                }

                                if (item.type === 'sticker') {
                                    const stk = item.data;
                                    return (
                                        <div
                                            key={stk.id}
                                            className={`absolute pointer-events-auto group ${stk.locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${selectedStickerId === stk.id ? 'ring-2 ring-blue-500 ring-offset-4 ring-offset-transparent' : ''}`}
                                            style={{
                                                left: `${stk.x}%`,
                                                top: `${stk.y}%`,
                                                width: stk.width,
                                                height: (stk.height || 0) > 0 ? stk.height : 'auto',
                                                transform: `translate(-50%, -50%) rotate(${stk.rotation}deg) scaleX(${stk.flipX ? -1 : 1}) scaleY(${stk.flipY ? -1 : 1})`,
                                                zIndex: item.zIndex,
                                                opacity: stk.opacity ?? 1,
                                                overflow: (stk.height || 0) > 0 ? 'hidden' : 'visible',
                                            }}
                                            onMouseDown={stk.locked ? undefined : (e) => {
                                                e.stopPropagation();
                                                setSelectedStickerId(stk.id);
                                                setSelectedTextId(null);
                                                setSelectedSlotId(null);
                                                setActiveTab('stickers');
                                                startDrag(e, stk.id, stk.x, stk.y);
                                            }}
                                            onClick={(e) => { e.stopPropagation(); setSelectedStickerId(stk.id); setSelectedTextId(null); setSelectedSlotId(null); setActiveTab('stickers'); }}
                                            onContextMenu={(e) => openContextMenu(e, stk.id, 'sticker')}
                                        >
                                            {stk.locked && (
                                                <div className="absolute top-0 right-0 text-white/40 z-10"><Lock size={10} /></div>
                                            )}
                                            <Image
                                                src={stk.src} alt="" width={stk.width} height={(stk.height || 0) > 0 ? stk.height : stk.width}
                                                className={`w-full ${(stk.height || 0) > 0 ? 'h-full object-cover' : 'h-full object-contain'}`}
                                                style={(stk.height || 0) > 0 ? { objectPosition: `${50 + (stk.cropX || 0)}% ${50 + (stk.cropY || 0)}%` } : undefined}
                                                unoptimized
                                                draggable={false}
                                            />
                                            {selectedStickerId === stk.id && (
                                                <>
                                                    {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map(type => (
                                                        <div
                                                            key={type}
                                                            className={`absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full z-[120] cursor-${type}-resize shadow-lg hover:scale-125 transition-transform`}
                                                            style={{
                                                                top: type.includes('n') ? -6 : type.includes('s') ? 'calc(100% - 6px)' : '50%',
                                                                left: type.includes('w') ? -6 : type.includes('e') ? 'calc(100% - 6px)' : '50%',
                                                                marginTop: type === 'e' || type === 'w' ? -6 : 0,
                                                                marginLeft: type === 'n' || type === 's' ? -6 : 0,
                                                            }}
                                                            onMouseDown={(e) => startResize(e, stk.id, type, stk.x, stk.y, stk.width / (template.width / 100), 0)}
                                                        />
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    );
                                }

                                // shape
                                if (item.type === 'shape') {
                                    const shp = item.data as ShapeElement;
                                    const isCircle = shp.shapeType === 'circle';
                                    const isLine = shp.shapeType === 'line';
                                    const svgShape = (() => {
                                        if (shp.shapeType === 'triangle') return (
                                            <svg viewBox="0 0 100 87" preserveAspectRatio="none" width="100%" height="100%" style={{ display: 'block' }}>
                                                <polygon points="50,0 100,87 0,87" fill={shp.fillColor} stroke={shp.strokeColor} strokeWidth={shp.strokeWidth || 0} />
                                            </svg>
                                        );
                                        if (shp.shapeType === 'star') return (
                                            <svg viewBox="0 0 100 95" preserveAspectRatio="none" width="100%" height="100%" style={{ display: 'block' }}>
                                                <polygon points="50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35" fill={shp.fillColor} stroke={shp.strokeColor} strokeWidth={shp.strokeWidth || 0} />
                                            </svg>
                                        );
                                        if (isLine) return (
                                            <div style={{ width: '100%', height: Math.max(2, shp.strokeWidth || 2), background: shp.strokeColor || shp.fillColor, borderRadius: 9999 }} />
                                        );
                                        return null;
                                    })();
                                    return (
                                        <div
                                            key={shp.id}
                                            className={`absolute group ${shp.locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${selectedShapeId === shp.id ? 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-transparent' : ''}`}
                                            style={{
                                                left: `${shp.x}%`,
                                                top: `${shp.y}%`,
                                                width: `${shp.width}%`,
                                                height: isLine ? 'auto' : `${shp.height}%`,
                                                transform: `rotate(${shp.rotation || 0}deg)`,
                                                zIndex: item.zIndex,
                                                opacity: shp.opacity ?? 1,
                                                ...(svgShape === null ? {
                                                    background: shp.fillColor,
                                                    borderRadius: isCircle ? '50%' : shp.borderRadius,
                                                    border: shp.strokeWidth ? `${shp.strokeWidth}px solid ${shp.strokeColor}` : 'none',
                                                } : {}),
                                            }}
                                            onMouseDown={shp.locked ? undefined : (e) => {
                                                e.stopPropagation();
                                                setSelectedShapeId(shp.id);
                                                setSelectedTextId(null);
                                                setSelectedSlotId(null);
                                                setSelectedStickerId(null);
                                                setActiveTab('shapes');
                                                startDrag(e, shp.id, shp.x, shp.y);
                                            }}
                                            onClick={(e) => { e.stopPropagation(); setSelectedShapeId(shp.id); setSelectedTextId(null); setSelectedSlotId(null); setSelectedStickerId(null); setActiveTab('shapes'); }}
                                            onContextMenu={(e) => openContextMenu(e, shp.id, 'shape')}
                                        >
                                            {svgShape}
                                            {shp.locked && <div className="absolute top-0 right-0 text-white/40"><Lock size={10} /></div>}
                                            {selectedShapeId === shp.id && (
                                                <>
                                                    <button onClick={(e) => { e.stopPropagation(); deleteShape(shp.id); }}
                                                        className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg z-[100]">
                                                        <Trash2 size={12} />
                                                    </button>
                                                    {['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].map(type => (
                                                        <div key={type}
                                                            className={`absolute w-3 h-3 bg-white border-2 border-emerald-500 rounded-full z-[110] cursor-${type}-resize hover:scale-125 transition-transform`}
                                                            style={{
                                                                top: type.includes('n') ? -6 : type.includes('s') ? 'calc(100% - 6px)' : '50%',
                                                                left: type.includes('w') ? -6 : type.includes('e') ? 'calc(100% - 6px)' : '50%',
                                                                marginTop: type === 'e' || type === 'w' ? -6 : 0,
                                                                marginLeft: type === 'n' || type === 's' ? -6 : 0,
                                                            }}
                                                            onMouseDown={(e) => startResize(e, shp.id, type, shp.x, shp.y, shp.width, shp.height)}
                                                        />
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    );
                                }

                                // text
                                if (item.type !== 'text') return null;
                                const txt = item.data as TextElement;
                                return (
                                    <div
                                        key={txt.id}
                                        className={`absolute pointer-events-auto px-2 py-1 group ${txt.locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${selectedTextId === txt.id ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-transparent' : ''}`}
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
                                            zIndex: item.zIndex,
                                            WebkitTextStroke: txt.textStrokeWidth ? `${txt.textStrokeWidth}px ${txt.textStroke || '#000000'}` : undefined,
                                        }}
                                        onMouseDown={txt.locked ? undefined : (e) => {
                                            e.stopPropagation();
                                            setSelectedTextId(txt.id);
                                            setSelectedStickerId(null);
                                            setSelectedSlotId(null);
                                            setActiveTab('text');
                                            startDrag(e, txt.id, txt.x, txt.y);
                                        }}
                                        onClick={(e) => { e.stopPropagation(); setSelectedTextId(txt.id); setSelectedStickerId(null); setSelectedSlotId(null); setActiveTab('text'); }}
                                        onContextMenu={(e) => openContextMenu(e, txt.id, 'text')}
                                    >
                                        <span style={{ whiteSpace: 'pre-wrap' }}>{txt.text}</span>
                                        {txt.locked && (
                                            <div className="absolute top-0 right-0 text-white/40"><Lock size={10} /></div>
                                        )}
                                        {selectedTextId === txt.id && (
                                            <>
                                                {['e', 'w'].map(type => (
                                                    <div
                                                        key={type}
                                                        className={`absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full z-[120] cursor-${type}-resize shadow-lg hover:scale-125 transition-transform`}
                                                        style={{
                                                            top: '50%',
                                                            left: type === 'w' ? -6 : 'calc(100% - 6px)',
                                                            transform: 'translateY(-50%)',
                                                        }}
                                                        onMouseDown={(e) => startResize(e, txt.id, type, txt.x, txt.y, txt.fontSize, 0)}
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
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
