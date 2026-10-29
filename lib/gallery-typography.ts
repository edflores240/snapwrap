// Fonts and per-theme typography shared by the public gallery and the guest album, so a title looks the same everywhere.

import {
    Inter, 
    Playfair_Display, 
    Caveat, 
    Anton, 
    Bodoni_Moda, 
    Space_Grotesk,
    Syne,
    Bebas_Neue,
    Montserrat,
    Outfit
} from 'next/font/google';

export const inter = Inter({ subsets: ['latin'] });
export const playfair = Playfair_Display({ subsets: ['latin'] });
export const caveat = Caveat({ subsets: ['latin'] });
export const anton = Anton({ weight: '400', subsets: ['latin'] });
export const bodoni = Bodoni_Moda({ subsets: ['latin'] });
export const space = Space_Grotesk({ subsets: ['latin'] });
export const syne = Syne({ subsets: ['latin'] });
export const bebas = Bebas_Neue({ weight: '400', subsets: ['latin'] });
export const montserrat = Montserrat({ subsets: ['latin'] });
export const outfit = Outfit({ subsets: ['latin'] });

export const HEADING_FONTS: Record<string, string> = {
    playfair: playfair.className,
    inter: inter.className,
    anton: anton.className,
    bodoni: bodoni.className,
    space: space.className,
    caveat: caveat.className,
};


export const THEMES = {
    modern: {
        fontTitle: playfair.className,
        fontBody: inter.className,
        layout: 'carousel',
        card: 'rounded-2xl shadow-xl border-white/40 border-t-4',
    },
    valentine: {
        fontTitle: playfair.className,
        fontBody: inter.className,
        layout: 'carousel',
        card: 'rounded-[3rem] shadow-2xl border-white/60 border-8',
    },
    minimal: {
        fontTitle: inter.className,
        fontBody: inter.className,
        layout: 'grid',
        card: 'rounded-none border border-black/5 shadow-sm hover:shadow-lg',
    },
    dark: {
        fontTitle: playfair.className,
        fontBody: inter.className,
        layout: 'carousel',
        card: 'rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-white/5',
    },
    retro: {
        titleMax: 96,
        titleEm: 0.66,
        fontTitle: anton.className,
        fontBody: space.className,
        layout: 'grid',
        card: 'rounded-sm bg-white p-4 shadow-xl border-b-8 border-r-8 border-black/10 hover:border-black/20',
        titleStyle: 'uppercase tracking-tighter italic',
    },
    editorial: {
        titleMax: 72,
        titleEm: 0.8,
        fontTitle: bodoni.className,
        fontBody: inter.className,
        layout: 'asymmetrical',
        card: 'rounded-none shadow-none grayscale hover:grayscale-0 transition-all duration-700',
        titleStyle: 'font-light tracking-[0.2em] uppercase',
    },
    neon: {
        titleMax: 96,
        titleEm: 0.82,
        fontTitle: syne.className,
        fontBody: space.className,
        layout: 'grid',
        card: 'rounded-2xl border border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:border-[var(--primary)] hover:shadow-[0_0_30px_var(--primary-glow)]',
        titleStyle: 'font-black tracking-widest uppercase',
    },
    organic: {
        fontTitle: playfair.className,
        fontBody: inter.className,
        layout: 'carousel',
        card: 'rounded-[2.5rem] border-0 shadow-lg hover:shadow-xl',
    },
    serenity: {
        titleMax: 48,
        titleEm: 1.0,
        fontTitle: outfit.className,
        fontBody: inter.className,
        layout: 'grid',
        card: 'rounded-none border-b border-neutral-100 shadow-none hover:bg-neutral-50',
        titleStyle: 'font-light tracking-[0.4em] uppercase',
    },
    industrial: {
        titleMax: 128,
        titleEm: 0.5,
        fontTitle: bebas.className,
        fontBody: space.className,
        layout: 'mosaic',
        card: 'rounded-none border-2 border-[#333] shadow-none hover:border-yellow-500',
        titleStyle: 'tracking-widest leading-none',
    },
    vibrant: {
        titleMax: 96,
        titleEm: 0.5,
        fontTitle: anton.className,
        fontBody: montserrat.className,
        layout: 'grid',
        card: 'rounded-xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none',
        titleStyle: 'uppercase -rotate-2 bg-black text-white px-8 py-2 inline-block',
    }
};

export type ThemeKey = keyof typeof THEMES;

/**
 * Headline size that keeps the longest word inside the available width. Fixed Tailwind sizes
 * overflowed on phones for long words like "Thanksgiving".
 */
export function headlineFontSize(title: string, theme: { titleMax?: number; titleEm?: number }, sidebar: boolean) {
    const longest = Math.max(1, ...title.split(/\s+/).map(w => w.length));
    const max = theme.titleMax ?? 96;
    const em = theme.titleEm ?? 0.62;
    const room = sidebar ? 'min(88vw, 340px)' : 'min(88vw, 976px)';
    return `clamp(24px, min(${max}px, calc(${room} / ${(longest * em).toFixed(2)})), ${max}px)`;
}



type Config = Record<string, any> | null | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Heading classes for an event, matching its public gallery (theme font, optional override, title style) */
export function eventTitleClass(config: Config): string {
    const pp = config?.publicPage ?? {};
    const theme = (THEMES as Record<string, { fontTitle: string; titleStyle?: string }>)[pp.themeStyle ?? 'modern'] ?? THEMES.modern;
    const font = HEADING_FONTS[pp.headingFont] ?? theme.fontTitle;
    return `${font} ${theme.titleStyle ?? ''}`.trim();
}

/** Body font class of the event's gallery theme */
export function eventBodyClass(config: Config): string {
    const pp = config?.publicPage ?? {};
    return ((THEMES as Record<string, { fontBody: string }>)[pp.themeStyle ?? 'modern'] ?? THEMES.modern).fontBody;
}

/** Title size for the event's gallery theme */
export function eventTitleSize(config: Config, title: string): string {
    const pp = config?.publicPage ?? {};
    const theme = ((THEMES as Record<string, { titleMax?: number; titleEm?: number }>)[pp.themeStyle ?? 'modern'] ?? THEMES.modern) as { titleMax?: number; titleEm?: number };
    return headlineFontSize(title, theme, false);
}
