import { supabase } from './supabase';

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

export interface GuestFilter {
    id: string;
    label: string;
    /** CSS filter for the live preview */
    css: string;
    brightness: number;
    contrast: number;
    saturate: number;
    sepia: number;
    gray: number;
    grain: number;
    vignette: number;
    dateStamp: boolean;
}

const f = (id: string, label: string, o: Partial<GuestFilter>): GuestFilter => {
    const full: GuestFilter = { id, label, css: '', brightness: 1, contrast: 1, saturate: 1, sepia: 0, gray: 0, grain: 0, vignette: 0, dateStamp: false, ...o };
    full.css = [
        full.brightness !== 1 && `brightness(${full.brightness})`,
        full.contrast !== 1 && `contrast(${full.contrast})`,
        full.saturate !== 1 && `saturate(${full.saturate})`,
        full.sepia > 0 && `sepia(${full.sepia})`,
        full.gray > 0 && `grayscale(${full.gray})`,
    ].filter(Boolean).join(' ') || 'none';
    return full;
};

export const GUEST_FILTERS: GuestFilter[] = [
    f('natural', 'Natural', {}),
    f('disposable', 'Disposable', { brightness: 1.04, contrast: 1.12, saturate: 1.2, sepia: 0.16, grain: 0.1, vignette: 0.35, dateStamp: true }),
    f('vintage', 'Vintage', { contrast: 1.05, saturate: 0.9, sepia: 0.45, grain: 0.08, vignette: 0.25 }),
    f('bw', 'B&W', { contrast: 1.15, gray: 1, grain: 0.09, vignette: 0.2 }),
    f('vivid', 'Vivid', { contrast: 1.08, saturate: 1.5 }),
];

export const filterById = (id: string) => GUEST_FILTERS.find(x => x.id === id) ?? GUEST_FILTERS[0];

const MAX_SIDE = 1600;

function toBlob(canvas: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
    return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Canvas empty'))), 'image/jpeg', quality));
}

/** Browsers without CanvasRenderingContext2D.filter (older Safari) get the same look by hand */
function applyFilterByHand(ctx: CanvasRenderingContext2D, w: number, h: number, flt: GuestFilter) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
    for (let i = 0; i < d.length; i += 4) {
        let r = d[i] * flt.brightness, g = d[i + 1] * flt.brightness, b = d[i + 2] * flt.brightness;
        r = (r - 128) * flt.contrast + 128; g = (g - 128) * flt.contrast + 128; b = (b - 128) * flt.contrast + 128;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = lum + (r - lum) * flt.saturate; g = lum + (g - lum) * flt.saturate; b = lum + (b - lum) * flt.saturate;
        if (flt.sepia > 0) {
            const sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b;
            r += (sr - r) * flt.sepia; g += (sg - g) * flt.sepia; b += (sb - b) * flt.sepia;
        }
        if (flt.gray > 0) {
            const l = 0.299 * r + 0.587 * g + 0.114 * b;
            r += (l - r) * flt.gray; g += (l - g) * flt.gray; b += (l - b) * flt.gray;
        }
        d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
    }
    ctx.putImageData(img, 0, 0);
}

function paintFinish(ctx: CanvasRenderingContext2D, w: number, h: number, flt: GuestFilter) {
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
        ctx.globalAlpha = flt.grain;
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
    if (flt.dateStamp) {
        const d = new Date();
        const stamp = `'${String(d.getFullYear()).slice(2)} ${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}`;
        const size = Math.round(Math.min(w, h) * 0.04);
        ctx.save();
        ctx.font = `700 ${size}px "Courier New", monospace`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(255,120,0,0.8)';
        ctx.shadowBlur = size * 0.5;
        ctx.fillStyle = '#ff9a3c';
        ctx.fillText(stamp, w - size, h - size);
        ctx.restore();
    }
}

export interface CapturedShot { full: Blob; thumb: Blob; previewUrl: string; /** tiny data URL for the locked-album teaser */ preview: string }

/**
 * Draws the part of `source` that matches `frameRatio` (width / height) at no more than 1600px,
 * applies the filter and returns a full-size JPEG plus a small thumbnail.
 */
export async function renderShot(
    source: HTMLVideoElement | ImageBitmap,
    sourceW: number,
    sourceH: number,
    frameRatio: number,
    opts: { mirror: boolean; filter: GuestFilter },
): Promise<CapturedShot> {
    // Crop like object-fit: cover
    let sw = sourceW, sh = sourceH, sx = 0, sy = 0;
    if (sourceW / sourceH > frameRatio) { sw = sourceH * frameRatio; sx = (sourceW - sw) / 2; }
    else { sh = sourceW / frameRatio; sy = (sourceH - sh) / 2; }

    const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
    const w = Math.round(sw * scale), h = Math.round(sh * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const hasCtxFilter = typeof (ctx as CanvasRenderingContext2D & { filter?: string }).filter === 'string';
    const flt = opts.filter;
    if (hasCtxFilter && flt.css !== 'none') ctx.filter = flt.css;
    // `mirror` is deliberately not applied: the guest sees themselves mirrored, but the saved photo is how others see them
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
    ctx.filter = 'none';
    if (!hasCtxFilter && flt.css !== 'none') applyFilterByHand(ctx, w, h, flt);
    paintFinish(ctx, w, h, flt);

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

/** A photo from the guest's library, scaled down like a camera shot */
export async function shotFromFile(file: File): Promise<CapturedShot> {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
        return await renderShot(bitmap, bitmap.width, bitmap.height, bitmap.width / bitmap.height, { mirror: false, filter: GUEST_FILTERS[0] });
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
