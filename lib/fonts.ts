'use client';

import { useEffect, useState } from 'react';

/**
 * Curated Google Fonts (all SIL Open Font License, free for commercial use) for templates.
 * Only the weights/italics each family really ships are listed, since Google rejects requests for the rest.
 */
export type FontCategory = 'sans' | 'serif' | 'display' | 'script' | 'handwriting' | 'mono';

export interface FontEntry {
    family: string;
    category: FontCategory;
    weights: number[];
    italic?: boolean;
}

const F = (family: string, category: FontCategory, weights: number[], italic = false): FontEntry => ({ family, category, weights, italic });

export const FONT_LIBRARY: FontEntry[] = [
    // Sans
    F('Inter', 'sans', [400, 700, 900]), F('Montserrat', 'sans', [400, 700, 900], true), F('Poppins', 'sans', [400, 700, 900], true),
    F('Roboto', 'sans', [400, 700, 900], true), F('Open Sans', 'sans', [400, 700, 800], true), F('Lato', 'sans', [400, 700, 900], true),
    F('Raleway', 'sans', [400, 700, 900], true), F('Outfit', 'sans', [400, 700, 900]), F('Space Grotesk', 'sans', [400, 700]),
    F('Josefin Sans', 'sans', [400, 700], true), F('Quicksand', 'sans', [400, 700]), F('Nunito', 'sans', [400, 700, 900], true),
    F('Rubik', 'sans', [400, 700, 900], true), F('Work Sans', 'sans', [400, 700, 900], true), F('DM Sans', 'sans', [400, 700], true),
    F('Syne', 'sans', [400, 700, 800]), F('Oswald', 'sans', [400, 700]), F('Barlow Condensed', 'sans', [400, 700, 900], true),
    // Serif
    F('Playfair Display', 'serif', [400, 700, 900], true), F('Merriweather', 'serif', [400, 700, 900], true), F('Lora', 'serif', [400, 700], true),
    F('Cormorant Garamond', 'serif', [400, 700], true), F('EB Garamond', 'serif', [400, 700], true), F('Libre Baskerville', 'serif', [400, 700], true),
    F('Bodoni Moda', 'serif', [400, 700, 900], true), F('DM Serif Display', 'serif', [400], true), F('Cinzel', 'serif', [400, 700, 900]),
    F('Crimson Text', 'serif', [400, 700], true), F('Abril Fatface', 'serif', [400]), F('Yeseva One', 'serif', [400]),
    F('Alfa Slab One', 'serif', [400]), F('Old Standard TT', 'serif', [400, 700], true), F('Rozha One', 'serif', [400]),
    // Display
    F('Anton', 'display', [400]), F('Bebas Neue', 'display', [400]), F('Archivo Black', 'display', [400]), F('Staatliches', 'display', [400]),
    F('Righteous', 'display', [400]), F('Bungee', 'display', [400]), F('Lilita One', 'display', [400]), F('Luckiest Guy', 'display', [400]),
    F('Titan One', 'display', [400]), F('Bangers', 'display', [400]), F('Chewy', 'display', [400]), F('Black Ops One', 'display', [400]),
    F('Orbitron', 'display', [400, 700, 900]), F('Monoton', 'display', [400]), F('Fredoka', 'display', [400, 700]), F('Unbounded', 'display', [400, 700, 900]),
    F('Press Start 2P', 'display', [400]), F('Rubik Mono One', 'display', [400]),
    // Script
    F('Pacifico', 'script', [400]), F('Dancing Script', 'script', [400, 700]), F('Great Vibes', 'script', [400]), F('Lobster', 'script', [400]),
    F('Satisfy', 'script', [400]), F('Sacramento', 'script', [400]), F('Kaushan Script', 'script', [400]), F('Yellowtail', 'script', [400]),
    F('Allura', 'script', [400]), F('Parisienne', 'script', [400]), F('Courgette', 'script', [400]), F('Cookie', 'script', [400]),
    F('Playball', 'script', [400]), F('Tangerine', 'script', [400, 700]),
    // Handwriting
    F('Caveat', 'handwriting', [400, 700]), F('Shadows Into Light', 'handwriting', [400]), F('Amatic SC', 'handwriting', [400, 700]),
    F('Permanent Marker', 'handwriting', [400]), F('Gloria Hallelujah', 'handwriting', [400]), F('Indie Flower', 'handwriting', [400]),
    F('Patrick Hand', 'handwriting', [400]), F('Rock Salt', 'handwriting', [400]), F('Homemade Apple', 'handwriting', [400]),
    F('Reenie Beanie', 'handwriting', [400]),
    // Mono
    F('Space Mono', 'mono', [400, 700], true), F('IBM Plex Mono', 'mono', [400, 700], true), F('Courier Prime', 'mono', [400, 700], true),
    F('Special Elite', 'mono', [400]), F('VT323', 'mono', [400]),
];

export const FONT_CATEGORIES: { value: FontCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All' }, { value: 'sans', label: 'Sans' }, { value: 'serif', label: 'Serif' },
    { value: 'display', label: 'Display' }, { value: 'script', label: 'Script' }, { value: 'handwriting', label: 'Hand' }, { value: 'mono', label: 'Mono' },
];

const FALLBACK: Record<FontCategory, string> = {
    sans: 'sans-serif', serif: 'serif', display: 'sans-serif', script: 'cursive', handwriting: 'cursive', mono: 'monospace',
};

const byFamily = new Map(FONT_LIBRARY.map(f => [f.family.toLowerCase(), f]));

/** CSS font-family value for a library font, e.g. `'Pacifico', cursive`. */
export function fontStack(entry: FontEntry): string {
    return `'${entry.family}', ${FALLBACK[entry.category]}`;
}

/** The first family named in a CSS font-family value, unquoted. */
export function primaryFamily(fontFamily: string): string {
    const first = fontFamily.split(',')[0].trim();
    return first.replace(/^['"]|['"]$/g, '');
}

export function libraryFont(fontFamily: string): FontEntry | undefined {
    return byFamily.get(primaryFamily(fontFamily).toLowerCase());
}

function familyParam(f: FontEntry) {
    const name = f.family.replace(/ /g, '+');
    if (f.italic) {
        const tuples = [...f.weights.map(w => `0,${w}`), ...f.weights.map(w => `1,${w}`)].join(';');
        return `${name}:ital,wght@${tuples}`;
    }
    return `${name}:wght@${f.weights.join(';')}`;
}

export function googleFontsUrl(families: FontEntry[]): string {
    return `https://fonts.googleapis.com/css2?${families.map(f => `family=${familyParam(f)}`).join('&')}&display=swap`;
}

const injected = new Set<string>();

function injectStylesheet(id: string, href: string) {
    if (typeof document === 'undefined' || injected.has(id)) return;
    injected.add(id);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.fontId = id;
    document.head.appendChild(link);
}

/** Makes sure the stylesheet for each library font used in `fontFamilies` is on the page. */
export function ensureFonts(fontFamilies: string[]): void {
    for (const value of fontFamilies) {
        const entry = libraryFont(value);
        if (entry) injectStylesheet(entry.family, googleFontsUrl([entry]));
    }
}

/**
 * One small request that fetches only the letters of each font's own name, so the picker can show every
 * option in its own typeface without downloading all the font files.
 */
export function ensurePickerPreviews(): void {
    const text = encodeURIComponent([...new Set(FONT_LIBRARY.flatMap(f => [...f.family]))].join(''));
    const families = FONT_LIBRARY.map(f => `family=${f.family.replace(/ /g, '+')}`).join('&');
    injectStylesheet('__picker', `https://fonts.googleapis.com/css2?${families}&text=${text}&display=swap`);
}

/** Re-renders when a web font finishes loading, so measurements that depend on it can be redone. */
export function useFontsVersion(): number {
    const [version, setVersion] = useState(0);
    useEffect(() => {
        const fonts = document.fonts;
        if (!fonts) return;
        const bump = () => setVersion(v => v + 1);
        fonts.addEventListener('loadingdone', bump);
        return () => fonts.removeEventListener('loadingdone', bump);
    }, []);
    return version;
}

/** Loads the library fonts a template's text uses. */
export function useTemplateFonts(textElements: { fontFamily: string }[] | undefined) {
    const key = (textElements ?? []).map(t => t.fontFamily).join('|');
    useEffect(() => {
        ensureFonts(key ? key.split('|') : []);
    }, [key]);
}
