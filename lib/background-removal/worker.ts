/// <reference lib="webworker" />
import { AutoModel, AutoProcessor, RawImage, Tensor, env } from '@huggingface/transformers';

/**
 * Two engines, both open-source and run entirely in the browser:
 *  - BiRefNet (lite), MIT: best quality, but it needs WebGPU with enough storage buffers and ~1 GB of memory
 *  - U-2-Netp, Apache-2.0: 4.6 MB, runs anywhere (also on the CPU), a little rougher on fine edges
 */
const BIREFNET_ID = 'onnx-community/BiRefNet_lite-ONNX';
const U2NETP_ID = 'BritishWerewolf/U-2-Netp';
const MAX_SIDE = 1600; // larger images are scaled down first to keep memory in check

env.allowLocalModels = false;

type ModelLoader = typeof AutoModel.from_pretrained;
type Model = Awaited<ReturnType<ModelLoader>>;
type Engine =
    | { kind: 'birefnet'; model: Model; processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> }
    | { kind: 'u2netp'; model: Model };

const loaded: Partial<Record<Engine['kind'], Promise<Engine>>> = {};
let webgpuBroken = false;

const post = (message: Record<string, unknown>) => (self as unknown as Worker).postMessage(message);

// The BiRefNet WebGPU shaders bind 11 storage buffers; plenty of GPUs/browsers only allow 8-10
const NEEDED_STORAGE_BUFFERS = 11;

async function webgpuUsable(): Promise<boolean> {
    if (webgpuBroken || !('gpu' in navigator)) return false;
    try {
        const gpu = (navigator as Navigator & { gpu: { requestAdapter(): Promise<{ limits: Record<string, number> } | null> } }).gpu;
        const adapter = await gpu.requestAdapter();
        return !!adapter && adapter.limits.maxStorageBuffersPerShaderStage >= NEEDED_STORAGE_BUFFERS;
    } catch {
        return false;
    }
}

function downloadProgress() {
    const files = new Map<string, { loaded: number; total: number }>();
    return (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status === 'progress' && p.file && p.total) {
            files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
            let done = 0, total = 0;
            files.forEach(f => { done += f.loaded; total += f.total; });
            post({ type: 'progress', stage: 'download', value: total ? done / total : 0 });
        }
    };
}

function loadEngine(kind: Engine['kind']): Promise<Engine> {
    if (!loaded[kind]) {
        const promise: Promise<Engine> = (async () => {
            if (kind === 'birefnet') {
                const model = await AutoModel.from_pretrained(BIREFNET_ID, { device: 'webgpu', dtype: 'fp16', progress_callback: downloadProgress() });
                const processor = await AutoProcessor.from_pretrained(BIREFNET_ID);
                return { kind, model, processor };
            }
            const model = await AutoModel.from_pretrained(U2NETP_ID, { dtype: 'fp32', progress_callback: downloadProgress() });
            return { kind, model };
        })();
        promise.catch(() => { delete loaded[kind]; }); // allow a retry after a failed download
        loaded[kind] = promise;
    }
    return loaded[kind]!;
}

/** Alpha mask (0-255, one byte per pixel) at the image's own size. */
async function birefnetMask(engine: Extract<Engine, { kind: 'birefnet' }>, image: RawImage): Promise<Uint8Array> {
    const { pixel_values } = await engine.processor(image);
    const { output_image } = await engine.model({ input_image: pixel_values });
    const mask = await RawImage.fromTensor(output_image[0].sigmoid().mul(255).to('uint8')).resize(image.width, image.height);
    return mask.data as Uint8Array;
}

async function u2netpMask(engine: Extract<Engine, { kind: 'u2netp' }>, image: RawImage): Promise<Uint8Array> {
    const SIZE = 320;
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    const rgb = (await image.resize(SIZE, SIZE)).rgb();
    let max = 1;
    for (let i = 0; i < rgb.data.length; i++) if (rgb.data[i] > max) max = rgb.data[i];
    const input = new Float32Array(3 * SIZE * SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        for (let c = 0; c < 3; c++) input[c * SIZE * SIZE + i] = (rgb.data[i * 3 + c] / max - mean[c]) / std[c];
    }

    // The first output is the fused prediction; the others are intermediate side outputs
    const outputs = await engine.model({ 'input.1': new Tensor('float32', input, [1, 3, SIZE, SIZE]) });
    const pred = Object.values(outputs)[0] as Tensor;
    const values = pred.data as Float32Array;

    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < values.length; i++) { lo = Math.min(lo, values[i]); hi = Math.max(hi, values[i]); }
    const range = hi - lo || 1;

    // Tighten the soft edges of the low-resolution prediction before scaling it up
    const bytes = new Uint8ClampedArray(SIZE * SIZE);
    for (let i = 0; i < bytes.length; i++) {
        const t = Math.min(1, Math.max(0, ((values[i] - lo) / range - 0.2) / 0.6));
        bytes[i] = Math.round(t * t * (3 - 2 * t) * 255);
    }
    const mask = await new RawImage(bytes, SIZE, SIZE, 1).resize(image.width, image.height);
    return mask.data as Uint8Array;
}

async function removeBackground(blob: Blob): Promise<Blob> {
    post({ type: 'progress', stage: 'process', value: 0 });
    let image = await RawImage.fromBlob(blob);
    const longest = Math.max(image.width, image.height);
    if (longest > MAX_SIDE) {
        const k = MAX_SIDE / longest;
        image = await image.resize(Math.round(image.width * k), Math.round(image.height * k));
    }

    let mask: Uint8Array | null = null;
    if (await webgpuUsable()) {
        try {
            mask = await birefnetMask(await loadEngine('birefnet') as Extract<Engine, { kind: 'birefnet' }>, image);
        } catch {
            // A GPU that passes the limit check can still fail to run it; use the lighter engine instead
            webgpuBroken = true;
        }
    }
    if (!mask) mask = await u2netpMask(await loadEngine('u2netp') as Extract<Engine, { kind: 'u2netp' }>, image);

    // Use the mask as the alpha channel of the original picture
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d')!;
    const source = await createImageBitmap(blob, { resizeWidth: image.width, resizeHeight: image.height });
    ctx.drawImage(source, 0, 0);
    source.close();
    const pixels = ctx.getImageData(0, 0, image.width, image.height);
    for (let i = 0; i < mask.length; i++) pixels.data[i * 4 + 3] = mask[i];
    ctx.putImageData(pixels, 0, 0);
    return canvas.convertToBlob({ type: 'image/png' });
}

self.onmessage = async (e: MessageEvent<{ id: number; blob: Blob }>) => {
    const { id, blob } = e.data;
    try {
        post({ type: 'done', id, blob: await removeBackground(blob) });
    } catch (err) {
        post({ type: 'error', id, message: err instanceof Error ? err.message : String(err) });
    }
};
