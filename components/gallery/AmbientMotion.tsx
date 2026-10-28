'use client';

import React from 'react';

interface Props {
    kind: string;
    primary: string;
    secondary: string;
}

// Deterministic pseudo-random so server and client render the same markup
function rng(seed: number) {
    let t = seed + 0x6d2b79f5;
    return () => {
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const COUNT: Record<string, number> = { confetti: 28, hearts: 16, bubbles: 18, sparkles: 22 };

/** Decorative moving layer behind the gallery. Pointer-events are off and reduced-motion hides it. */
export default function AmbientMotion({ kind, primary, secondary }: Props) {
    if (kind === 'glow') {
        const blob = (style: React.CSSProperties) => (
            <div className="gal-motion absolute rounded-full" style={{ filter: 'blur(90px)', animation: 'gal-blob 22s ease-in-out infinite', ...style }} />
        );
        return (
            <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden style={{ zIndex: 0 }}>
                {blob({ width: '45vw', height: '45vw', left: '-10vw', top: '-10vw', background: `${primary}38` })}
                {blob({ width: '38vw', height: '38vw', right: '-8vw', bottom: '-8vw', background: `${primary}2e`, animationDelay: '-9s' })}
                {blob({ width: '28vw', height: '28vw', left: '40vw', top: '30vh', background: `${primary}22`, animationDelay: '-15s' })}
            </div>
        );
    }

    const count = COUNT[kind];
    if (!count) return null; // 'drift' is applied to the pattern layer itself

    const rand = rng(kind.length * 7919);
    const palette = [primary, `${primary}b0`, secondary === primary ? '#ffffff' : secondary, '#ffffff'];

    const items = Array.from({ length: count }, (_, i) => {
        const size = 8 + rand() * 22;
        return {
            key: i,
            left: rand() * 100,
            top: rand() * 100,
            size,
            duration: 9 + rand() * 12,
            delay: -rand() * 20,
            sway: (rand() - 0.5) * 120,
            spin: (rand() - 0.5) * 540,
            opacity: 0.25 + rand() * 0.45,
            color: palette[Math.floor(rand() * palette.length)],
        };
    });

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden style={{ zIndex: 0 }}>
            {items.map(p => {
                const base: React.CSSProperties = {
                    position: 'absolute',
                    left: `${p.left}%`,
                    width: p.size,
                    height: p.size,
                    ['--o' as string]: p.opacity,
                    ['--sway' as string]: `${p.sway}px`,
                    ['--spin' as string]: `${p.spin}deg`,
                    animationDuration: `${p.duration}s`,
                    animationDelay: `${p.delay}s`,
                    animationIterationCount: 'infinite',
                    animationTimingFunction: 'linear',
                    willChange: 'transform, opacity',
                };

                if (kind === 'confetti') {
                    return (
                        <span
                            key={p.key}
                            className="gal-motion"
                            style={{ ...base, top: '-6vh', height: p.size * 0.45, borderRadius: 2, background: p.color, animationName: 'gal-fall' }}
                        />
                    );
                }
                if (kind === 'hearts') {
                    return (
                        <svg
                            key={p.key}
                            className="gal-motion"
                            viewBox="0 0 32 32"
                            style={{ ...base, bottom: '-8vh', width: p.size * 1.3, height: p.size * 1.3, animationName: 'gal-rise' }}
                        >
                            <path d="M16 28 C3 18 6 8 13 10 C15 10.6 16 12 16 13 C16 12 17 10.6 19 10 C26 8 29 18 16 28Z" fill={p.color} />
                        </svg>
                    );
                }
                if (kind === 'bubbles') {
                    return (
                        <span
                            key={p.key}
                            className="gal-motion"
                            style={{ ...base, bottom: '-8vh', borderRadius: '50%', border: `2px solid ${p.color}`, background: `${p.color}18`, animationName: 'gal-rise' }}
                        />
                    );
                }
                // sparkles: four-point stars that twinkle in place
                return (
                    <svg
                        key={p.key}
                        className="gal-motion"
                        viewBox="0 0 24 24"
                        style={{
                            ...base,
                            top: `${p.top}%`,
                            animationName: 'gal-twinkle',
                            animationDuration: `${3 + (p.duration % 4)}s`,
                            animationTimingFunction: 'ease-in-out',
                        }}
                    >
                        <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z" fill={p.color} />
                    </svg>
                );
            })}
        </div>
    );
}
