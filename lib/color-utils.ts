export interface ThemeColors {
    bg: string;
    surface: string;
    text: string;
    muted: string;
    border: string;
    card: string;
}

export function deriveTheme(accent: string, darkMode: boolean, overrides?: Partial<ThemeColors>): ThemeColors {
    const r = parseInt(accent.slice(1, 3), 16) || 0;
    const g = parseInt(accent.slice(3, 5), 16) || 0;
    const b = parseInt(accent.slice(5, 7), 16) || 0;

    let base: ThemeColors;

    if (darkMode) {
        base = {
            bg: '#0A0A0A',
            surface: '#131313',
            text: '#F5F5F5',
            muted: '#888888',
            border: '#222222',
            card: '#1C1C1C',
        };
    } else {
        const mix = (base: number, tint: number, ratio = 0.05) =>
            Math.min(255, Math.round(base * (1 - ratio) + tint * ratio));
        base = {
            bg: `rgb(${mix(252, r)},${mix(250, g)},${mix(248, b)})`,
            surface: '#FFFFFF',
            text: '#171717',
            muted: '#6B7280',
            border: `rgb(${mix(232, r, 0.09)},${mix(230, g, 0.09)},${mix(228, b, 0.09)})`,
            card: `rgb(${mix(248, r)},${mix(248, g)},${mix(247, b)})`,
        };
    }

    return { ...base, ...overrides };
}

export function getContrastColor(hex: string): '#ffffff' | '#171717' {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#171717' : '#ffffff';
}
