'use client';

import React, { useEffect, useRef, useState } from 'react';

interface PhotoCompositorProps {
    photoDataUrl: string;
    overlayUrl: string;
    onComposed: (composedDataUrl: string) => void;
}

export function PhotoCompositor({ photoDataUrl, overlayUrl, onComposed }: PhotoCompositorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isComposing, setIsComposing] = useState(false);

    useEffect(() => {
        composeImage();
    }, [photoDataUrl, overlayUrl]);

    const composeImage = async () => {
        if (!canvasRef.current) return;

        setIsComposing(true);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        try {
            // Load photo
            const photoImg = new Image();
            photoImg.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                photoImg.onload = resolve;
                photoImg.onerror = reject;
                photoImg.src = photoDataUrl;
            });

            // Set canvas size to photo dimensions
            canvas.width = photoImg.width;
            canvas.height = photoImg.height;

            // Draw photo
            ctx.drawImage(photoImg, 0, 0);

            // Load and draw overlay
            const overlayImg = new Image();
            overlayImg.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                overlayImg.onload = resolve;
                overlayImg.onerror = reject;
                overlayImg.src = overlayUrl;
            });

            // Draw overlay on top
            ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);

            // Get composed image
            const composedDataUrl = canvas.toDataURL('image/png', 1.0);
            onComposed(composedDataUrl);
        } catch (error) {
            console.error('Error composing image:', error);
        } finally {
            setIsComposing(false);
        }
    };

    return (
        <div className="relative">
            <canvas ref={canvasRef} className="w-full h-auto rounded-2xl" />
            {isComposing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl">
                    <div className="text-2xl font-bold text-white">Composing...</div>
                </div>
            )}
        </div>
    );
}
