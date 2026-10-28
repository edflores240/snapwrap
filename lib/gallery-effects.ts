import type { CSSProperties } from 'react';

/** Background patterns and entrance animations for the public gallery. */

export const PATTERN_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'dots', label: 'Dots' },
    { value: 'grid', label: 'Grid' },
    { value: 'lines', label: 'Lines' },
    { value: 'diagonal', label: 'Diagonal' },
    { value: 'checker', label: 'Checker' },
    { value: 'waves', label: 'Waves' },
    { value: 'hearts', label: 'Hearts' },
    { value: 'stars', label: 'Stars' },
    { value: 'confetti', label: 'Confetti' },
    { value: 'noise', label: 'Paper' },
] as const;

export const MOTION_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'drift', label: 'Drift' },
    { value: 'glow', label: 'Glow' },
    { value: 'confetti', label: 'Confetti' },
    { value: 'hearts', label: 'Hearts' },
    { value: 'bubbles', label: 'Bubbles' },
    { value: 'sparkles', label: 'Sparkles' },
] as const;

const STRENGTH: Record<string, number> = { subtle: 0.07, medium: 0.14, bold: 0.26 };

const alphaHex = (a: number) => Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, '0');

const svgUri = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** CSS for a repeating background pattern tinted with `color` (a #rrggbb hex). */
export function patternStyle(kind: string | undefined, color: string, strength: string | undefined): CSSProperties | null {
    if (!kind || kind === 'none') return null;
    const a = STRENGTH[strength ?? 'subtle'] ?? STRENGTH.subtle;
    const c = /^#[0-9a-f]{6}$/i.test(color) ? color : '#000000';
    const tint = `${c}${alphaHex(a)}`;

    switch (kind) {
        case 'dots':
            return { backgroundImage: `radial-gradient(circle, ${tint} 2px, transparent 2.5px)`, backgroundSize: '26px 26px' };
        case 'grid':
            return {
                backgroundImage: `linear-gradient(${tint} 1px, transparent 1px), linear-gradient(90deg, ${tint} 1px, transparent 1px)`,
                backgroundSize: '36px 36px',
            };
        case 'lines':
            return { backgroundImage: `repeating-linear-gradient(0deg, ${tint} 0 1px, transparent 1px 16px)` };
        case 'diagonal':
            return { backgroundImage: `repeating-linear-gradient(45deg, ${tint} 0 2px, transparent 2px 18px)` };
        case 'checker':
            return {
                backgroundImage: `conic-gradient(${tint} 25%, transparent 0 50%, ${tint} 0 75%, transparent 0)`,
                backgroundSize: '48px 48px',
            };
        case 'waves':
            return {
                backgroundImage: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="24"><path d="M0 12 Q20 0 40 12 T80 12" fill="none" stroke="${c}" stroke-opacity="${a * 1.6}" stroke-width="2"/></svg>`),
                backgroundSize: '80px 24px',
            };
        case 'hearts':
            return {
                backgroundImage: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><path d="M32 44 C12 30 18 16 28 20 C30 21 32 23 32 25 C32 23 34 21 36 20 C46 16 52 30 32 44Z" fill="${c}" fill-opacity="${a}"/></svg>`),
                backgroundSize: '64px 64px',
            };
        case 'stars':
            return {
                backgroundImage: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><path d="M36 14 L40 28 L54 28 L43 36 L47 50 L36 41 L25 50 L29 36 L18 28 L32 28Z" fill="${c}" fill-opacity="${a}"/></svg>`),
                backgroundSize: '72px 72px',
            };
        case 'confetti':
            return {
                backgroundImage: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" fill="${c}" fill-opacity="${a}"><rect x="12" y="16" width="10" height="4" rx="2" transform="rotate(30 17 18)"/><circle cx="84" cy="28" r="4"/><rect x="60" y="62" width="10" height="4" rx="2" transform="rotate(-40 65 64)"/><circle cx="22" cy="86" r="3"/><rect x="96" y="92" width="10" height="4" rx="2" transform="rotate(70 101 94)"/><circle cx="52" cy="102" r="3.5"/></svg>`),
                backgroundSize: '120px 120px',
            };
        case 'noise':
            return {
                backgroundImage: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 ${parseInt(c.slice(1, 3), 16) / 255} 0 0 0 0 ${parseInt(c.slice(3, 5), 16) / 255} 0 0 0 0 ${parseInt(c.slice(5, 7), 16) / 255} 0 0 0 ${a * 3} 0"/></filter><rect width="160" height="160" filter="url(#n)"/></svg>`),
            };
        default:
            return null;
    }
}

// ── Entrance animation ─────────────────────────────────────────────────────

interface Entrance {
    initial: Record<string, number> | false;
    animate: Record<string, number>;
    spring?: boolean;
}

const ENTRANCES: Record<string, Entrance> = {
    fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
    rise: { initial: { opacity: 0, y: 60 }, animate: { opacity: 1, y: 0 } },
    pop: { initial: { opacity: 0, scale: 0.6 }, animate: { opacity: 1, scale: 1 }, spring: true },
    slide: { initial: { opacity: 0, x: -70 }, animate: { opacity: 1, x: 0 } },
    flip: { initial: { opacity: 0, rotateY: 90 }, animate: { opacity: 1, rotateY: 0 } },
    none: { initial: false, animate: { opacity: 1 } },
};

/** Framer Motion props for a photo card, or null to keep the layout's own entrance. */
export function entranceProps(kind: string | undefined, index: number, stagger: number) {
    const e = kind ? ENTRANCES[kind] : undefined;
    if (!e) return null;
    return {
        initial: e.initial,
        animate: e.animate,
        transition: e.spring
            ? { type: 'spring' as const, stiffness: 260, damping: 18, delay: (index % stagger) * 0.05 }
            : { duration: 0.6, delay: (index % stagger) * 0.05 },
    };
}

/** whileHover props for the hover effect, or null for the theme's own zoom. */
export function hoverProps(kind: string | undefined) {
    const t = { duration: 0.25, delay: 0 };
    if (kind === 'lift') return { whileHover: { y: -10, scale: 1.02, transition: t } };
    if (kind === 'tilt') return { whileHover: { rotate: -2, scale: 1.05, transition: t } };
    return null;
}
