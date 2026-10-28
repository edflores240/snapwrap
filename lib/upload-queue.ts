'use client';

import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';

/**
 * Background upload queue for booth photos.
 *
 * Photos are saved to IndexedDB (falling back to memory) and uploaded one at a
 * time with exponential backoff, so guests never wait on the network. The photo
 * id is chosen by the caller, which means a QR link can be shown before the
 * upload finishes.
 */

const DB_NAME = 'snapwrap-uploads';
const STORE = 'queue';
const BUCKET = 'booth-photos';

export interface QueuedPhoto {
    id: string;
    eventId: string;
    eventSlug: string;
    full: Blob;
    thumb: Blob | null;
}

interface StoredPhoto extends QueuedPhoto {
    createdAt: number;
}

export type QueueStatus = 'idle' | 'syncing' | 'offline' | 'retrying';
interface QueueSnapshot { pending: number; status: QueueStatus }

const memoryStore = new Map<string, StoredPhoto>();
const nextAttemptAt = new Map<string, number>();
const attempts = new Map<string, number>();
const listeners = new Set<() => void>();

let snapshot: QueueSnapshot = { pending: 0, status: 'idle' };
let running = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let initialised = false;

const SERVER_SNAPSHOT: QueueSnapshot = { pending: 0, status: 'idle' };

function setSnapshot(next: QueueSnapshot) {
    if (next.pending === snapshot.pending && next.status === snapshot.status) return;
    snapshot = next;
    listeners.forEach(l => l());
}

// ── Storage ────────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(resolve => {
        if (typeof indexedDB === 'undefined') return resolve(null);
        try {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
    return dbPromise;
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function putItem(item: StoredPhoto) {
    memoryStore.set(item.id, item);
    const db = await openDb();
    if (db) await tx(db, 'readwrite', s => s.put(item)).catch(() => undefined);
}

async function deleteItem(id: string) {
    memoryStore.delete(id);
    attempts.delete(id);
    nextAttemptAt.delete(id);
    const db = await openDb();
    if (db) await tx(db, 'readwrite', s => s.delete(id)).catch(() => undefined);
}

async function allItems(): Promise<StoredPhoto[]> {
    const db = await openDb();
    const persisted = db ? await tx<StoredPhoto[]>(db, 'readonly', s => s.getAll()).catch(() => []) : [];
    const merged = new Map<string, StoredPhoto>(memoryStore);
    persisted.forEach(p => merged.set(p.id, p));
    return [...merged.values()].sort((a, b) => a.createdAt - b.createdAt);
}

// ── Upload ─────────────────────────────────────────────────────────────────

function isAlreadyExists(err: { message?: string; statusCode?: string | number } | null) {
    if (!err) return false;
    return String(err.statusCode) === '409' || /already exists|duplicate/i.test(err.message ?? '');
}

async function uploadFile(path: string, blob: Blob) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    // A retry after a half-finished attempt will find the file already there
    if (error && !isAlreadyExists(error)) throw error;
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function uploadItem(item: StoredPhoto) {
    const imageUrl = await uploadFile(`${item.eventSlug}/${item.id}.jpg`, item.full);
    const thumbUrl = item.thumb ? await uploadFile(`${item.eventSlug}/thumbs/${item.id}.jpg`, item.thumb) : null;

    const row = {
        id: item.id,
        event_id: item.eventId,
        storage_path: `${item.eventSlug}/${item.id}.jpg`,
        image_url: imageUrl,
    };
    let { error } = await supabase.from('photos').insert({ ...row, thumb_url: thumbUrl });
    // 42703 / PGRST204 = thumb_url column not migrated yet: save the photo anyway rather than lose it
    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
        console.warn('photos.thumb_url is missing; run the 20260526000000_photos_thumb_url migration');
        ({ error } = await supabase.from('photos').insert(row));
    }
    // 23505 = row already inserted by an earlier attempt
    if (error && error.code !== '23505') throw error;
}

async function refreshPending(status?: QueueStatus) {
    const pending = (await allItems()).length;
    setSnapshot({ pending, status: pending === 0 ? 'idle' : status ?? snapshot.status });
}

async function processQueue() {
    if (running) return;
    running = true;
    try {
        for (;;) {
            const items = await allItems();
            if (items.length === 0) break;

            const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
            if (offline) { setSnapshot({ pending: items.length, status: 'offline' }); break; }

            const now = Date.now();
            const due = items.find(i => (nextAttemptAt.get(i.id) ?? 0) <= now);
            if (!due) {
                setSnapshot({ pending: items.length, status: 'retrying' });
                scheduleRetry(Math.min(...items.map(i => nextAttemptAt.get(i.id) ?? 0)) - now);
                break;
            }

            setSnapshot({ pending: items.length, status: 'syncing' });
            try {
                await uploadItem(due);
                await deleteItem(due.id);
            } catch (err) {
                const n = (attempts.get(due.id) ?? 0) + 1;
                attempts.set(due.id, n);
                nextAttemptAt.set(due.id, Date.now() + Math.min(60_000, 2_000 * 2 ** n));
                // Supabase errors are class instances whose fields don't enumerate, so log them explicitly
                const e = err as { message?: string; code?: string; statusCode?: string | number; details?: string };
                console.error(`Upload failed for ${due.id} (attempt ${n}):`, e.message ?? err, { code: e.code, status: e.statusCode, details: e.details });
            }
        }
    } finally {
        running = false;
        await refreshPending();
    }
}

function scheduleRetry(ms: number) {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { retryTimer = null; void processQueue(); }, Math.max(ms, 500));
}

// ── Public API ─────────────────────────────────────────────────────────────

export function newPhotoId(): string {
    const c: Crypto = globalThis.crypto;
    // randomUUID only exists in secure contexts; build a v4 id by hand otherwise
    if (typeof c.randomUUID === 'function') return c.randomUUID();
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Saves a photo locally and starts uploading it in the background. Resolves once it is safely queued. */
export async function enqueuePhoto(photo: QueuedPhoto) {
    await putItem({ ...photo, createdAt: Date.now() });
    await refreshPending('syncing');
    void processQueue();
}

/** Resumes photos persisted by earlier sessions and wires up reconnect handling. Safe to call repeatedly. */
export function initUploadQueue() {
    if (initialised || typeof window === 'undefined') return;
    initialised = true;
    window.addEventListener('online', () => void processQueue());
    window.addEventListener('offline', () => void refreshPending('offline'));
    void processQueue();
}

export function useUploadQueue(): QueueSnapshot {
    return useSyncExternalStore(
        cb => { listeners.add(cb); return () => { listeners.delete(cb); }; },
        () => snapshot,
        () => SERVER_SNAPSHOT,
    );
}
