import type { CSSProperties } from 'react';

/**
 * Backgrounds and stickers, drawn the same way in the editor (DOM) and in the final photo (canvas).
 * Text lives in template-text.ts.
 */

export interface BackgroundLike {
    background: string;
    backgroundImage?: string | null;
    backgroundOverlay?: string | null;
    backgroundOverlayOpacity?: number;
}

export interface StickerLike {
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    cropX: number;
    cropY: number;
    flipX: boolean;
    flipY: boolean;
    opacity: number;
}

// ── Background ─────────────────────────────────────────────────────────────

/** Tint the editor lays over the background image; null when there is none. */
export function overlayStyle(t: BackgroundLike): CSSProperties | null {
    if (!t.backgroundOverlay) return null;
    return {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundColor: t.backgroundOverlay,
        opacity: t.backgroundOverlayOpacity ?? 0.3,
        zIndex: 0,
    };
}

const DIRECTIONS: Record<string, number> = {
    'to top': 0, 'to top right': 45, 'to right': 90, 'to bottom right': 135,
    'to bottom': 180, 'to bottom left': 225, 'to left': 270, 'to top left': 315,
};

function splitTopLevel(value: string): string[] {
    const parts: string[] = [];
    let depth = 0, start = 0;
    for (let i = 0; i < value.length; i++) {
        if (value[i] === '(') depth++;
        else if (value[i] === ')') depth--;
        else if (value[i] === ',' && depth === 0) { parts.push(value.slice(start, i).trim()); start = i + 1; }
    }
    parts.push(value.slice(start).trim());
    return parts;
}

/** Turns "linear-gradient(135deg, #f00 0%, #00f 100%)" into a canvas gradient. Other values return null. */
function toCanvasGradient(ctx: CanvasRenderingContext2D, css: string, W: number, H: number): CanvasGradient | null {
    const m = css.trim().match(/^linear-gradient\(([\s\S]*)\)$/i);
    if (!m) return null;
    const parts = splitTopLevel(m[1]);

    let angle = 180;
    const first = parts[0].toLowerCase();
    if (/^-?\d*\.?\d+deg$/.test(first)) { angle = parseFloat(first); parts.shift(); }
    else if (first in DIRECTIONS) { angle = DIRECTIONS[first]; parts.shift(); }

    const rad = (angle * Math.PI) / 180;
    const dx = Math.sin(rad), dy = -Math.cos(rad);
    const half = (Math.abs(W * dx) + Math.abs(H * dy)) / 2;
    const g = ctx.createLinearGradient(W / 2 - dx * half, H / 2 - dy * half, W / 2 + dx * half, H / 2 + dy * half);

    const stops = parts.map(p => {
        const pos = p.match(/\s(-?\d*\.?\d+)%$/);
        return { color: pos ? p.slice(0, pos.index).trim() : p, at: pos ? parseFloat(pos[1]) / 100 : null };
    });
    stops.forEach((s, i) => {
        s.at ??= stops.length === 1 ? 0 : i / (stops.length - 1);
        try { g.addColorStop(Math.min(1, Math.max(0, s.at)), s.color); } catch { /* ignore a colour the canvas can't parse */ }
    });
    return g;
}

/** Fills `background`, then the background image (cover, like CSS), then the tint. */
export function drawTemplateBackground(
    ctx: CanvasRenderingContext2D,
    t: BackgroundLike,
    W: number,
    H: number,
    image: HTMLImageElement | null,
) {
    const bg = t.background || '#ffffff';
    ctx.fillStyle = toCanvasGradient(ctx, bg, W, H) ?? (bg.includes('gradient') ? '#ffffff' : bg);
    ctx.fillRect(0, 0, W, H);

    if (image) {
        const k = Math.max(W / image.width, H / image.height);
        const dw = image.width * k, dh = image.height * k;
        ctx.drawImage(image, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }

    if (t.backgroundOverlay) {
        ctx.save();
        ctx.globalAlpha = t.backgroundOverlayOpacity ?? 0.3;
        ctx.fillStyle = t.backgroundOverlay;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }
}

// ── Stickers ───────────────────────────────────────────────────────────────

/** Wrapper for a sticker. `len` converts template px to a CSS length for the host's scale. */
export function stickerBoxStyle(stk: StickerLike, len: (n: number) => string, zIndex?: number): CSSProperties {
    const cropped = (stk.height || 0) > 0;
    return {
        position: 'absolute',
        left: `${stk.x}%`,
        top: `${stk.y}%`,
        width: len(stk.width),
        height: cropped ? len(stk.height) : 'auto',
        transform: `translate(-50%, -50%) rotate(${stk.rotation || 0}deg) scaleX(${stk.flipX ? -1 : 1}) scaleY(${stk.flipY ? -1 : 1})`,
        opacity: stk.opacity ?? 1,
        overflow: cropped ? 'hidden' : 'visible',
        pointerEvents: 'none',
        zIndex,
    };
}

export function stickerImageStyle(stk: StickerLike): CSSProperties {
    if ((stk.height || 0) > 0) {
        return { width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${50 + (stk.cropX || 0)}% ${50 + (stk.cropY || 0)}%`, display: 'block' };
    }
    return { width: '100%', height: 'auto', display: 'block' };
}

/** `s` is canvas px per template px; the sticker is centred on (cx, cy). */
export function drawSticker(ctx: CanvasRenderingContext2D, img: HTMLImageElement, stk: StickerLike, cx: number, cy: number, s: number) {
    const w = stk.width * s;
    const cropped = (stk.height || 0) > 0;
    const h = cropped ? stk.height * s : (img.height / img.width) * w;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(((stk.rotation || 0) * Math.PI) / 180);
    ctx.scale(stk.flipX ? -1 : 1, stk.flipY ? -1 : 1);
    ctx.globalAlpha = stk.opacity ?? 1;

    if (cropped) {
        // object-fit: cover with object-position, as in the editor
        const k = Math.max(w / img.width, h / img.height);
        const dw = img.width * k, dh = img.height * k;
        const px = (50 + (stk.cropX || 0)) / 100, py = (50 + (stk.cropY || 0)) / 100;
        ctx.beginPath();
        ctx.rect(-w / 2, -h / 2, w, h);
        ctx.clip();
        ctx.drawImage(img, -w / 2 + (w - dw) * px, -h / 2 + (h - dh) * py, dw, dh);
    } else {
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
}
