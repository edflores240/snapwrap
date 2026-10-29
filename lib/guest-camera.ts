import { supabase } from './supabase';
import { FILM_LOOKS, FilmRenderer, drawStamp, lookById, type FilmLook } from './film-filters';

/**
 * Guest camera: settings, server calls and in-browser capture helpers.
 *
 * Settings live in events.config.guestCamera. Everything guests do goes through the SECURITY DEFINER
 * functions from the 20260529000000_guest_camera migration, which enforce the shot limit, the open and
 * close window and the reveal time on the server.
 */

// ── Settings ───────────────────────────────────────────────────────────────

export interface GuestConfig {
    enabled: boolean;
    shotsPerGuest: number;
    /** ISO timestamps; empty string means "no limit" (opensAt/closesAt) or "not yet" (revealAt) */
    opensAt: string;
    closesAt: string;
    revealAt: string;
    requireApproval: boolean;
    askName: boolean;
    askTable: boolean;
    allowLibrary: boolean;
    captionsEnabled: boolean;
    filtersEnabled: boolean;
    prompts: string[];
    slideshowLive: boolean;
    /** Blurred previews of the photos on the locked album screen */
    showTeaser: boolean;
    welcomeTitle: string;
    welcomeMessage: string;
    thankYouMessage: string;
}

export const DEFAULT_GUEST_CONFIG: GuestConfig = {
    enabled: false,
    shotsPerGuest: 10,
    opensAt: '',
    closesAt: '',
    revealAt: '',
    requireApproval: true,
    askName: true,
    askTable: false,
    allowLibrary: false,
    captionsEnabled: true,
    filtersEnabled: true,
    prompts: [],
    slideshowLive: false,
    showTeaser: true,
    welcomeTitle: '',
    welcomeMessage: '',
    thankYouMessage: '',
};

export const WEDDING_PROMPTS = [
    'The happy couple',
    'Dance floor moves',
    'Someone crying happy tears',
    'The cake',
    'Your table',
    'Best outfit of the night',
    'A hug from someone you love',
    'The grooms/brides squad',
    'Something blue',
    'The sweetest moment',
];

export function readGuestConfig(raw: unknown): GuestConfig {
    const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<GuestConfig>;
    return {
        ...DEFAULT_GUEST_CONFIG,
        ...src,
        shotsPerGuest: Math.min(100, Math.max(1, Number(src.shotsPerGuest) || DEFAULT_GUEST_CONFIG.shotsPerGuest)),
        prompts: Array.isArray(src.prompts) ? src.prompts.filter(p => typeof p === 'string' && p.trim()) : [],
    };
}

// ── Server state ───────────────────────────────────────────────────────────

export type GuestPhase = 'not_open' | 'open' | 'closed';

export interface GuestState {
    enabled: boolean;
    now?: string;
    phase?: GuestPhase;
    opensAt?: string | null;
    closesAt?: string | null;
    revealAt?: string | null;
    revealed?: boolean;
    joined?: boolean;
    blocked?: boolean;
    quota?: number;
    used?: number;
}

export type GuestPhotoStatus = 'pending' | 'approved' | 'hidden';

export interface GuestPhoto {
    id: string;
    image_url: string;
    thumb_url: string | null;
    caption: string | null;
    prompt: string | null;
    guest_status: GuestPhotoStatus;
    like_count: number;
    created_at: string;
}

export interface AlbumPhoto {
    id: string;
    image_url: string;
    thumb_url: string | null;
    caption: string | null;
    prompt: string | null;
    like_count: number;
    created_at: string;
    guest_name: string | null;
    liked: boolean;
}

export interface AlbumResult {
    enabled: boolean;
    revealed: boolean;
    revealAt?: string | null;
    now?: string;
    total?: number;
    /** ~24px data-URL previews, only sent while the album is locked */
    teaser?: string[];
    photos?: AlbumPhoto[];
    facets?: { guests: { id: string; name: string; count: number }[]; prompts: string[] };
}

export interface SlideshowPhoto {
    id: string;
    image_url: string;
    caption: string | null;
    created_at: string;
    guest_name: string | null;
    from_guest: boolean;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw error;
    return data as T;
}

export const getGuestState = (eventId: string, sessionId: string | null) =>
    rpc<GuestState>('guest_state', { p_event_id: eventId, p_session_id: sessionId });

export const joinGuest = (eventId: string, sessionId: string, name: string, table: string) =>
    rpc<GuestState>('guest_join', { p_event_id: eventId, p_session_id: sessionId, p_name: name, p_table: table });

export const getMyPhotos = (eventId: string, sessionId: string) =>
    rpc<GuestPhoto[]>('guest_my_photos', { p_event_id: eventId, p_session_id: sessionId });

export const getAlbum = (eventId: string, visitorId: string, opts: { sort: 'new' | 'loved'; guest: string | null; prompt: string | null; limit: number; offset: number }) =>
    rpc<AlbumResult>('guest_album', {
        p_event_id: eventId, p_visitor_id: visitorId, p_sort: opts.sort,
        p_guest: opts.guest, p_prompt: opts.prompt, p_limit: opts.limit, p_offset: opts.offset,
    });

export const toggleLike = (photoId: string, visitorId: string) =>
    rpc<{ liked: boolean; like_count: number }>('guest_toggle_like', { p_photo_id: photoId, p_visitor_id: visitorId });

export const getSlideshow = (eventId: string, limit = 80) =>
    rpc<{ enabled: boolean; available?: boolean; photos: SlideshowPhoto[] }>('guest_slideshow', { p_event_id: eventId, p_limit: limit });

const BUCKET = 'booth-photos';

/** Removes a deleted shot's full-size picture and thumbnail from storage (best effort) */
export async function deleteMyPhoto(photoId: string, sessionId: string) {
    const res = await rpc<{ deleted: boolean; storage_path: string | null }>('guest_delete_photo', { p_photo_id: photoId, p_session_id: sessionId });
    if (res.storage_path) {
        const thumb = res.storage_path.replace(/\/guest\/([^/]+)$/, '/guest/thumbs/$1');
        await supabase.storage.from(BUCKET).remove([res.storage_path, thumb]).catch(() => undefined);
    }
    return res.deleted;
}

/** Messages the server raises when a photo can never be accepted */
export const PERMANENT_GUEST_ERRORS = ['guest_quota', 'guest_closed', 'guest_blocked', 'guest_unknown', 'guest_disabled', 'guest_bad_path'];

export function guestErrorMessage(code: string | undefined): string {
    switch (code) {
        case 'guest_quota': return "You've used all your shots.";
        case 'guest_closed': return 'The camera is closed.';
        case 'guest_blocked': return 'This device can no longer add photos.';
        default: return 'Something went wrong.';
    }
}

// ── Identity (one anonymous id per phone, per event) ───────────────────────

export interface GuestIdentity { sessionId: string; name: string; table: string }

const memory = new Map<string, string>();

function safeGet(key: string): string | null {
    try { return window.localStorage.getItem(key) ?? memory.get(key) ?? null; } catch { return memory.get(key) ?? null; }
}
function safeSet(key: string, value: string) {
    memory.set(key, value);
    try { window.localStorage.setItem(key, value); } catch { /* private mode: memory only */ }
}

export function uuid(): string {
    const c: Crypto = globalThis.crypto;
    if (typeof c.randomUUID === 'function') return c.randomUUID();
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function loadGuestIdentity(eventId: string): GuestIdentity | null {
    const raw = safeGet(`snapwrap-guest-${eventId}`);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as GuestIdentity;
        return parsed.sessionId ? parsed : null;
    } catch { return null; }
}

export function saveGuestIdentity(eventId: string, identity: GuestIdentity) {
    safeSet(`snapwrap-guest-${eventId}`, JSON.stringify(identity));
}

/** Anonymous id used for hearts, shared across events on this device */
export function getVisitorId(): string {
    let id = safeGet('snapwrap-visitor');
    if (!id) { id = uuid(); safeSet('snapwrap-visitor', id); }
    return id;
}

export function guestUrl(origin: string, slug: string, page: '' | 'album' | 'live' = '') {
    return `${origin}/g/${slug}${page ? `/${page}` : ''}`;
}

// ── Capture ────────────────────────────────────────────────────────────────

export type GuestFilter = FilmLook;
export const GUEST_FILTERS = FILM_LOOKS;
export const filterById = lookById;

/** CSS filter that approximates a look; used on browsers without WebGL */
export function basicCss(l: FilmLook): string {
    const b = l.basic;
    return [
        b.brightness !== 1 && `brightness(${b.brightness})`,
        b.contrast !== 1 && `contrast(${b.contrast})`,
        b.saturate !== 1 && `saturate(${b.saturate})`,
        b.sepia > 0 && `sepia(${b.sepia})`,
        b.gray > 0 && `grayscale(${b.gray})`,
    ].filter(Boolean).join(' ') || 'none';
}

const MAX_SIDE = 1600;

function toBlob(canvas: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
    return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Canvas empty'))), 'image/jpeg', quality));
}

/** Browsers without CanvasRenderingContext2D.filter (older Safari) get the basic look by hand */
function applyFilterByHand(ctx: CanvasRenderingContext2D, w: number, h: number, flt: FilmLook) {
    const k = flt.basic;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
    for (let i = 0; i < d.length; i += 4) {
        let r = d[i] * k.brightness, g = d[i + 1] * k.brightness, b = d[i + 2] * k.brightness;
        r = (r - 128) * k.contrast + 128; g = (g - 128) * k.contrast + 128; b = (b - 128) * k.contrast + 128;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = lum + (r - lum) * k.saturate; g = lum + (g - lum) * k.saturate; b = lum + (b - lum) * k.saturate;
        if (k.sepia > 0) {
            const sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b;
            r += (sr - r) * k.sepia; g += (sg - g) * k.sepia; b += (sb - b) * k.sepia;
        }
        if (k.gray > 0) {
            const l = 0.299 * r + 0.587 * g + 0.114 * b;
            r += (l - r) * k.gray; g += (l - g) * k.gray; b += (l - b) * k.gray;
        }
        d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
    }
    ctx.putImageData(img, 0, 0);
}

function paintFallbackFinish(ctx: CanvasRenderingContext2D, w: number, h: number, flt: FilmLook) {
    if (flt.grain > 0) {
        const tile = document.createElement('canvas');
        tile.width = tile.height = 160;
        const tctx = tile.getContext('2d')!;
        const noise = tctx.createImageData(160, 160);
        for (let i = 0; i < noise.data.length; i += 4) {
            const v = Math.random() * 255;
            noise.data[i] = noise.data[i + 1] = noise.data[i + 2] = v;
            noise.data[i + 3] = 255;
        }
        tctx.putImageData(noise, 0, 0);
        ctx.save();
        ctx.globalAlpha = Math.min(0.2, flt.grain * 0.6);
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = ctx.createPattern(tile, 'repeat')!;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }
    if (flt.vignette > 0) {
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(0,0,0,${flt.vignette})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }
}

export interface CapturedShot { full: Blob; thumb: Blob; previewUrl: string; /** tiny data URL for the locked-album teaser */ preview: string }

/** Full-size JPEG, a thumbnail and the ~24px teaser preview of a finished canvas */
async function finishShot(canvas: HTMLCanvasElement): Promise<CapturedShot> {
    const w = canvas.width, h = canvas.height;
    const full = await toBlob(canvas, 0.85);
    const ratio = Math.min(1, 480 / w);
    const small = document.createElement('canvas');
    small.width = Math.round(w * ratio); small.height = Math.round(h * ratio);
    small.getContext('2d')!.drawImage(canvas, 0, 0, small.width, small.height);
    const thumb = await toBlob(small, 0.75);

    // A ~24px version (a few hundred bytes) is all the locked album ever shows, blurred further
    const tiny = document.createElement('canvas');
    tiny.width = 24; tiny.height = Math.max(1, Math.round(24 * (h / w)));
    tiny.getContext('2d')!.drawImage(canvas, 0, 0, tiny.width, tiny.height);
    const preview = tiny.toDataURL('image/jpeg', 0.5);

    return { full, thumb, previewUrl: URL.createObjectURL(full), preview };
}

// Where the light leak lands; each photo gets a different corner
const LEAK_SPOTS: [number, number][] = [[0.96, 0.1], [0.04, 0.92], [0.98, 0.62], [0.08, 0.2], [0.55, 0.98]];

let captureRenderer: FilmRenderer | null | undefined;
function getCaptureRenderer(): FilmRenderer | null {
    if (captureRenderer === undefined) captureRenderer = FilmRenderer.create(document.createElement('canvas'));
    return captureRenderer;
}

/**
 * Draws the part of `source` that matches `frameRatio` (width / height) at no more than 1600px, runs
 * the film look over it and returns the JPEG, a thumbnail and the teaser preview.
 * `source` should be a video or canvas (WebGL ignores the flip flag for ImageBitmap).
 */
export async function renderShot(
    source: HTMLVideoElement | HTMLCanvasElement,
    sourceW: number,
    sourceH: number,
    frameRatio: number,
    opts: { filter: FilmLook },
): Promise<CapturedShot> {
    // Crop like object-fit: cover
    let sw = sourceW, sh = sourceH, sx = 0, sy = 0;
    if (sourceW / sourceH > frameRatio) { sw = sourceH * frameRatio; sx = (sourceW - sw) / 2; }
    else { sh = sourceW / frameRatio; sy = (sourceH - sh) / 2; }

    const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
    const w = Math.round(sw * scale), h = Math.round(sh * scale);
    const look = opts.filter;

    const gl = getCaptureRenderer();
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const ctx = out.getContext('2d')!;

    if (gl) {
        gl.resize(w, h);
        // `mirror` is deliberately off: guests see themselves mirrored, the saved photo is how others see them
        gl.draw(source, sourceW, sourceH, look, { mirror: false, seed: Math.random() * 1000, leakPos: LEAK_SPOTS[Math.floor(Math.random() * LEAK_SPOTS.length)] });
        ctx.drawImage(gl.canvas, 0, 0);
    } else {
        const hasCtxFilter = typeof (ctx as CanvasRenderingContext2D & { filter?: string }).filter === 'string';
        const css = basicCss(look);
        if (hasCtxFilter && css !== 'none') ctx.filter = css;
        ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
        ctx.filter = 'none';
        if (!hasCtxFilter && css !== 'none') applyFilterByHand(ctx, w, h, look);
        paintFallbackFinish(ctx, w, h, look);
    }
    drawStamp(ctx, w, h, look);
    return finishShot(out);
}

/** A photo from the guest's library, scaled down like a camera shot and given the chosen look */
export async function shotFromFile(file: File, look: FilmLook = FILM_LOOKS[0]): Promise<CapturedShot> {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
        const c = document.createElement('canvas');
        c.width = bitmap.width; c.height = bitmap.height;
        c.getContext('2d')!.drawImage(bitmap, 0, 0);
        return await renderShot(c, c.width, c.height, c.width / c.height, { filter: look });
    } finally {
        bitmap.close();
    }
}

// ── Time ───────────────────────────────────────────────────────────────────

export function countdownParts(ms: number) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return {
        days: Math.floor(total / 86400),
        hours: Math.floor((total % 86400) / 3600),
        minutes: Math.floor((total % 3600) / 60),
        seconds: total % 60,
    };
}

/** ISO string -> value for <input type="datetime-local"> in the viewer's timezone */
export function toLocalInput(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
