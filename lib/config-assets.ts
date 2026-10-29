import { supabase } from './supabase';

/**
 * Event settings live in one JSON column (events.config). Template backgrounds, snapshots and
 * stickers used to be embedded in it as base64 data URLs, which made some events 4 MB. Every save then
 * rewrote all of it (hitting Supabase's statement timeout) and every page load downloaded it.
 *
 * These helpers move such images into storage and leave only their URLs in the JSON.
 */

const BUCKET = 'booth-photos';
const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,/i;
const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };

const isDataUrl = (v: unknown): v is string => typeof v === 'string' && DATA_URL.test(v);

function collect(value: unknown, into: Set<string>) {
    if (isDataUrl(value)) into.add(value);
    else if (Array.isArray(value)) value.forEach(v => collect(v, into));
    else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach(v => collect(v, into));
}

/** True when the JSON still carries embedded images */
export function hasDataUrls(value: unknown): boolean {
    const found = new Set<string>();
    collect(value, found);
    return found.size > 0;
}

/** Swaps every string found in `map` for its replacement, anywhere in the JSON */
export function applyReplacements<T>(value: T, map: Map<string, string>): T {
    if (typeof value === 'string') return (map.get(value) ?? value) as T;
    if (Array.isArray(value)) return value.map(v => applyReplacements(v, map)) as T;
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, applyReplacements(v, map)])) as T;
    }
    return value;
}

async function shortHash(text: string): Promise<string> {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Uploads each embedded image once (same picture = same file) and returns data URL -> public URL.
 * An image that fails to upload is simply left out of the map, so it stays embedded rather than lost.
 */
export async function uploadDataUrls(value: unknown, slug: string): Promise<Map<string, string>> {
    const found = new Set<string>();
    collect(value, found);
    const map = new Map<string, string>();
    const queue = [...found];

    const worker = async () => {
        for (let url = queue.shift(); url; url = queue.shift()) {
            try {
                const mime = DATA_URL.exec(url)![1].toLowerCase();
                const path = `${slug}/assets/${await shortHash(url)}.${EXTENSIONS[mime] ?? 'png'}`;
                const blob = await (await fetch(url)).blob();
                const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: mime, upsert: false });
                // Already uploaded by an earlier run
                if (error && !/already exists|duplicate/i.test(error.message) && String((error as { statusCode?: string }).statusCode) !== '409') throw error;
                map.set(url, supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
            } catch (err) {
                console.warn('Could not move an embedded image to storage:', (err as Error).message);
            }
        }
    };
    await Promise.all([worker(), worker(), worker()]);
    return map;
}

/** Convenience: upload everything embedded in `value` and return the slimmed-down copy */
export async function externalizeDataUrls<T>(value: T, slug: string): Promise<{ value: T; moved: number }> {
    const map = await uploadDataUrls(value, slug);
    return { value: map.size ? applyReplacements(value, map) : value, moved: map.size };
}
