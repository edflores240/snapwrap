export async function getCroppedBlob(
    imageSrc: string,
    pixelCrop: { x: number; y: number; width: number; height: number },
    outputSize = 400,
    quality = 0.92,
): Promise<Blob> {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = imageSrc;
    });
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, outputSize, outputSize);
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Canvas empty'))), 'image/jpeg', quality);
    });
}

/** Downscales an image blob to a small JPEG for grids and previews. */
export async function makeThumbnail(blob: Blob, maxWidth = 480, quality = 0.75): Promise<Blob> {
    const bitmap = await createImageBitmap(blob);
    const ratio = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return new Promise((resolve, reject) => {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Canvas empty'))), 'image/jpeg', quality);
    });
}
