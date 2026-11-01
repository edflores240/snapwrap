/**
 * Save an image to the visitor's device.
 *
 * `<a download>` is ignored for cross-origin URLs, and on phones a blob link often just opens the picture.
 * So: on a phone, hand the file to the share sheet (which has "Save Image"); elsewhere download the blob;
 * and if the file can't be fetched, ask the storage server to send it as an attachment.
 */

const isPhone = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

/** Supabase storage serves a file as an attachment when the URL carries ?download=<name> */
function asAttachment(url: string, filename: string): string {
    try {
        const u = new URL(url);
        if (!u.pathname.includes('/storage/v1/object/')) return url;
        u.searchParams.set('download', filename);
        return u.toString();
    } catch { return url; }
}

function clickLink(href: string, filename?: string) {
    const a = document.createElement('a');
    a.href = href;
    if (filename) a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export async function downloadImage(url: string, filename: string): Promise<void> {
    let blob: Blob | null = null;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        blob = await res.blob();
    } catch {
        clickLink(asAttachment(url, filename));
        return;
    }

    const type = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
    if (isPhone() && typeof navigator.share === 'function') {
        const file = new File([blob], filename, { type });
        if (navigator.canShare?.({ files: [file] })) {
            try { await navigator.share({ files: [file] }); return; }
            catch (e) { if ((e as DOMException)?.name === 'AbortError') return; /* otherwise fall through */ }
        }
    }

    const objectUrl = URL.createObjectURL(blob);
    clickLink(objectUrl, filename);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
