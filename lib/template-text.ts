import type { CSSProperties } from 'react';
import { ensureFonts } from './fonts';

/**
 * Single definition of how a template text element looks, shared by every place that draws one:
 * the editor and the booth screens (DOM), the final photo (canvas) and the template thumbnails (Konva).
 * All sizes on a TextElement are in "template px" — pixels of a template.width wide design — and
 * each renderer converts them to its own scale.
 */

export interface TextLike {
    text: string;
    x: number;
    y: number;
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
    textStroke?: string;
    textStrokeWidth?: number;
    /** Bend, -100..100: positive arches the text up (like a rainbow), negative dips it down (like a smile) */
    curve?: number;
}

export const TEXT_LINE_HEIGHT = 1.2;

// letterSpacing is missing from older TypeScript DOM typings and older browsers
type SpacedContext = CanvasRenderingContext2D & { letterSpacing: string };

export interface ShadowLayer { x: number; y: number; blur: number; color: string }

const COLOR_TOKEN = /rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}\b|\b(?!\d)[a-z]+\b/i;

/** Parses a CSS text-shadow list ("0 0 10px #f0f, 1px 1px red") into numeric layers. */
export function parseTextShadows(value: string | undefined): ShadowLayer[] {
    if (!value || value === 'none') return [];
    const layers: string[] = [];
    let depth = 0, start = 0;
    for (let i = 0; i < value.length; i++) {
        const ch = value[i];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ',' && depth === 0) { layers.push(value.slice(start, i)); start = i + 1; }
    }
    layers.push(value.slice(start));

    return layers.flatMap(raw => {
        const colorMatch = raw.match(COLOR_TOKEN);
        const color = colorMatch ? colorMatch[0] : 'rgba(0,0,0,0.5)';
        const nums = (colorMatch ? raw.replace(colorMatch[0], ' ') : raw).match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
        if (nums.length < 2) return [];
        return [{ x: nums[0], y: nums[1], blur: nums[2] ?? 0, color }];
    });
}

/**
 * Style for a DOM text element. `len` converts template px into a CSS length for the host's scale,
 * e.g. n => `${n}px` in the editor or n => `calc(${n} / ${template.width} * 100cqw)` on the booth.
 */
export function textElementStyle(el: TextLike, len: (n: number) => string, zIndex?: number): CSSProperties {
    const shadows = parseTextShadows(el.textShadow)
        .map(s => `${len(s.x)} ${len(s.y)} ${len(s.blur)} ${s.color}`)
        .join(', ');

    return {
        position: 'absolute',
        left: `${el.x}%`,
        top: `${el.y}%`,
        transform: `translate(-50%, -50%) rotate(${el.rotation || 0}deg)`,
        width: 'max-content',
        whiteSpace: 'pre-wrap',
        lineHeight: TEXT_LINE_HEIGHT,
        fontSize: len(el.fontSize),
        fontFamily: el.fontFamily,
        fontWeight: el.fontWeight,
        fontStyle: el.fontStyle,
        color: el.color,
        textAlign: el.textAlign as CSSProperties['textAlign'],
        letterSpacing: len(el.letterSpacing || 0),
        textShadow: shadows || undefined,
        WebkitTextStroke: el.textStrokeWidth ? `${len(el.textStrokeWidth)} ${el.textStroke || '#000000'}` : undefined,
        opacity: el.opacity ?? 1,
        zIndex,
    };
}

// ── Canvas ─────────────────────────────────────────────────────────────────

function fontString(el: TextLike, px: number) {
    return `${el.fontStyle || 'normal'} ${el.fontWeight || '400'} ${px}px ${el.fontFamily || 'sans-serif'}`;
}

/** Canvas can only draw a web font that has already been loaded, so make sure of that before drawing. */
export async function loadTextFonts(elements: TextLike[]) {
    if (typeof document === 'undefined' || !document.fonts) return;
    ensureFonts(elements.map(el => el.fontFamily));
    await Promise.all(
        elements.map(el => document.fonts.load(fontString(el, 16), el.text).catch(() => undefined)),
    );
}

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx() {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    return measureCtx!;
}

interface Layout {
    lines: { text: string; width: number }[];
    width: number;
    lineHeight: number;
    ascent: number;
    height: number;
}

/** CSS adds letter-spacing after every character, including the last one, and the DOM box includes it. */
function layoutText(ctx: CanvasRenderingContext2D, el: TextLike, s: number): Layout {
    const px = el.fontSize * s;
    const spacing = (el.letterSpacing || 0) * s;
    ctx.font = fontString(el, px);
    const nativeSpacing: boolean = 'letterSpacing' in ctx;
    if (nativeSpacing) (ctx as SpacedContext).letterSpacing = `${spacing}px`;

    const lines = el.text.split('\n').map(text => {
        let width = ctx.measureText(text).width;
        if (!nativeSpacing && spacing) width += spacing * [...text].length;
        return { text, width };
    });

    const m = ctx.measureText('Mg');
    const lineHeight = px * TEXT_LINE_HEIGHT;
    const ascent = m.fontBoundingBoxAscent ?? px * 0.8;
    const descent = m.fontBoundingBoxDescent ?? px * 0.2;
    // Half-leading puts the font's content area in the middle of the line box, as CSS does
    const baseline = (lineHeight - (ascent + descent)) / 2 + ascent;

    return {
        lines,
        width: Math.max(...lines.map(l => l.width), 0),
        lineHeight,
        ascent: baseline,
        height: lineHeight * lines.length,
    };
}

/** Size of the text block in canvas px at scale `s` (canvas px per template px). */
export function measureTextBlock(el: TextLike, s: number) {
    const l = layoutText(getMeasureCtx(), el, s);
    return { width: l.width, height: l.height };
}

// ── Curved text ────────────────────────────────────────────────────────────

/** Where the middle glyph's baseline sits relative to the element's (x, y), as a fraction of font size. */
const BASELINE_OFFSET = 0.3;

export interface CurveGeometry {
    /** Circle radius (px at the scale used) */
    radius: number;
    /** Angle the text spans, radians */
    sweep: number;
    up: boolean;
    /** Half the width / height of a box centred on the element's (x, y) that holds the whole curved text */
    halfWidth: number;
    halfHeight: number;
    /** SVG path of the baseline, in the same px and origin as the box (origin = element centre) */
    path: string;
    /** Origin of the circle and the baseline y of the middle glyph, same coordinates */
    centerY: number;
    baselineY: number;
}

/** Geometry for text of `width` px bent by `curve` (-100..100); null when the bend is negligible. */
export function curveGeometry(width: number, fontPx: number, curve: number, margin = 0): CurveGeometry | null {
    if (!curve || Math.abs(curve) < 1 || width <= 0) return null;

    const sweep = (Math.abs(curve) / 100) * Math.PI;
    const radius = width / sweep;
    const half = sweep / 2;
    const chord = 2 * radius * Math.sin(half);
    const sagitta = radius * (1 - Math.cos(half));
    const up = curve > 0;
    const asc = fontPx * 0.95;
    const desc = fontPx * 0.3;
    const base = fontPx * BASELINE_OFFSET; // middle glyph baseline, below the element centre

    // Origin is the element centre; the middle glyph sits on the baseline at y = base
    const endY = up ? base + sagitta : base - sagitta;
    const path = `M ${-chord / 2} ${endY} A ${radius} ${radius} 0 ${sweep > Math.PI ? 1 : 0} ${up ? 1 : 0} ${chord / 2} ${endY}`;
    const centerY = up ? base + radius : base - radius;

    const top = up ? base - asc : base - sagitta - asc;
    const bottom = up ? base + sagitta + desc : base + desc;
    const reach = (radius + Math.max(asc, desc)) * Math.sin(Math.min(half, Math.PI / 2));

    return {
        radius, sweep, up, path, centerY, baselineY: base,
        halfWidth: reach + fontPx * 0.2 + margin,
        halfHeight: Math.max(Math.abs(top), Math.abs(bottom)) + margin,
    };
}

export interface Glyph { text: string; x: number; y: number; rotation: number; width: number }

/** Each character's position and tilt on the arc, relative to the element centre (px at scale `s`). */
export function curveGlyphs(el: TextLike, s: number): { glyphs: Glyph[]; geometry: CurveGeometry } | null {
    const ctx = getMeasureCtx();
    const px = el.fontSize * s;
    const spacing = (el.letterSpacing || 0) * s;
    ctx.font = fontString(el, px);
    if ('letterSpacing' in ctx) (ctx as SpacedContext).letterSpacing = '0px';

    const chars = [...el.text.replace(/\n/g, ' ')];
    const widths = chars.map(ch => ctx.measureText(ch).width + spacing);
    const total = widths.reduce((a, b) => a + b, 0);
    const geometry = curveGeometry(total, px, el.curve ?? 0);
    if (!geometry) return null;

    const { radius, up, centerY } = geometry;
    let cursor = 0;
    const glyphs = chars.map((ch, i) => {
        const mid = cursor + (widths[i] - spacing) / 2;
        cursor += widths[i];
        const angle = (mid - total / 2) / radius; // 0 at the middle of the text
        return up
            ? { text: ch, x: radius * Math.sin(angle), y: centerY - radius * Math.cos(angle), rotation: angle, width: widths[i] - spacing }
            : { text: ch, x: radius * Math.sin(angle), y: centerY + radius * Math.cos(angle), rotation: -angle, width: widths[i] - spacing };
    });
    return { glyphs, geometry };
}

// ── Drawing ────────────────────────────────────────────────────────────────

interface Op { text: string; x: number; y: number; rotation: number; anchorX: number }

/**
 * Draws a text element centred on (cx, cy) in canvas px, matching the DOM rendering.
 * `s` is canvas px per template px. Effects are drawn on a scratch canvas first so that shadows
 * rotate with the text and opacity is applied once, as in CSS.
 */
export function drawTextElement(ctx: CanvasRenderingContext2D, el: TextLike, cx: number, cy: number, s: number) {
    if (!el.text) return;
    const shadows = parseTextShadows(el.textShadow);
    const strokeW = (el.textStrokeWidth || 0) * s;
    const px = el.fontSize * s;
    const spacing = (el.letterSpacing || 0) * s;
    const reach = Math.max(0, ...shadows.map(sh => Math.max(Math.abs(sh.x), Math.abs(sh.y)) * s + sh.blur * s * 2));
    const margin = Math.ceil(reach + strokeW + px * 0.3);

    const curved = curveGlyphs(el, s);
    let w: number, h: number;
    const ops: Op[] = [];

    if (curved) {
        // Origin of the scratch canvas is the element centre
        w = Math.ceil(curved.geometry.halfWidth * 2 + margin * 2);
        h = Math.ceil(curved.geometry.halfHeight * 2 + margin * 2);
        for (const g of curved.glyphs) ops.push({ text: g.text, x: w / 2 + g.x, y: h / 2 + g.y, rotation: g.rotation, anchorX: -g.width / 2 });
    } else {
        const layout = layoutText(getMeasureCtx(), el, s);
        w = Math.ceil(layout.width + margin * 2);
        h = Math.ceil(layout.height + margin * 2);
        const align = el.textAlign === 'right' ? 1 : el.textAlign === 'left' || el.textAlign === 'start' ? 0 : 0.5;
        layout.lines.forEach((line, i) => {
            const x = margin + (layout.width - line.width) * align;
            const y = margin + i * layout.lineHeight + layout.ascent;
            if (spacing && !('letterSpacing' in getMeasureCtx())) {
                // Browsers without canvas letter-spacing: place each character by hand
                let cursor = x;
                const m = getMeasureCtx();
                m.font = fontString(el, px);
                for (const ch of line.text) {
                    ops.push({ text: ch, x: cursor, y, rotation: 0, anchorX: 0 });
                    cursor += m.measureText(ch).width + spacing;
                }
            } else {
                ops.push({ text: line.text, x, y, rotation: 0, anchorX: 0 });
            }
        });
    }

    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const o = off.getContext('2d');
    if (!o) return;

    o.font = fontString(el, px);
    o.textAlign = 'left';
    o.textBaseline = 'alphabetic';
    o.lineJoin = 'round';
    // Curved text positions glyphs one by one, so its spacing is already baked into the positions
    const nativeSpacing: boolean = 'letterSpacing' in o;
    if (nativeSpacing) (o as SpacedContext).letterSpacing = curved ? '0px' : `${spacing}px`;

    const paint = (draw: (text: string, x: number, y: number) => void) => {
        for (const op of ops) {
            o.save();
            o.translate(op.x, op.y);
            o.rotate(op.rotation);
            draw(op.text, op.anchorX, 0);
            o.restore();
        }
    };

    // CSS paints the first shadow on top, so draw them back to front
    for (const sh of [...shadows].reverse()) {
        o.save();
        o.shadowColor = sh.color;
        o.shadowOffsetX = sh.x * s;
        o.shadowOffsetY = sh.y * s;
        o.shadowBlur = sh.blur * s;
        o.fillStyle = el.color;
        paint((t, x, y) => o.fillText(t, x, y));
        o.restore();
    }
    o.fillStyle = el.color;
    paint((t, x, y) => o.fillText(t, x, y));
    if (strokeW > 0) {
        o.strokeStyle = el.textStroke || '#000000';
        o.lineWidth = strokeW;
        paint((t, x, y) => o.strokeText(t, x, y));
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(((el.rotation || 0) * Math.PI) / 180);
    ctx.globalAlpha = el.opacity ?? 1;
    ctx.drawImage(off, -w / 2, -h / 2);
    ctx.restore();
}
