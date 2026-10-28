export interface BackgroundRemovalProgress {
    /** 'download' while the model is fetched (first use only), then 'process' while it runs */
    stage: 'download' | 'process';
    /** 0–1 during download; process has no measurable progress */
    value: number;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (b: Blob) => void; reject: (e: Error) => void }>();
let onProgress: ((p: BackgroundRemovalProgress) => void) | undefined;

function getWorker() {
    if (worker) return worker;
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
        const m = e.data;
        if (m.type === 'progress') { onProgress?.({ stage: m.stage, value: m.value }); return; }
        const job = pending.get(m.id);
        if (!job) return;
        pending.delete(m.id);
        if (m.type === 'done') job.resolve(m.blob);
        else job.reject(new Error(m.message));
    };
    worker.onerror = (e) => {
        pending.forEach(j => j.reject(new Error(e.message || 'Background removal failed')));
        pending.clear();
        worker?.terminate();
        worker = null;
    };
    return worker;
}

/**
 * Removes the background from an image in the browser (nothing is uploaded anywhere) and returns a
 * transparent PNG. The first call downloads the model (~115 MB on a capable GPU, 5 MB otherwise), which
 * the browser then caches.
 */
export function removeBackground(image: Blob, progress?: (p: BackgroundRemovalProgress) => void): Promise<Blob> {
    onProgress = progress;
    return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        getWorker().postMessage({ id, blob: image });
    });
}
