'use client';

import React, { useEffect, useRef, useState } from 'react';
import TemplateVisualizer, { TemplateVisualizerHandle } from '../templates/TemplateVisualizer';
import { TemplateConfig } from '../templates/TemplateDesigner';

interface PhotoCompositorProps {
    photoDataUrl: string;
    overlayUrl: string;
    templateConfig?: TemplateConfig;
    onComposed: (composedDataUrl: string) => void;
}

export function PhotoCompositor({ photoDataUrl, overlayUrl, templateConfig, onComposed }: PhotoCompositorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const visualizerRef = useRef<TemplateVisualizerHandle>(null);
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
            if (templateConfig && visualizerRef.current) {
                // Give React a moment to render the visualizer with the new props
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Real-time Konva Composition for precise Z-Index layering
                const snapshot = await visualizerRef.current.getSnapshot();
                
                const resultImg = new Image();
                resultImg.crossOrigin = 'anonymous';
                await new Promise((resolve, reject) => {
                    resultImg.onload = resolve;
                    resultImg.onerror = reject;
                    resultImg.src = snapshot.background; // background contains the full flattened image including slots
                });

                canvas.width = resultImg.width;
                canvas.height = resultImg.height;
                ctx.drawImage(resultImg, 0, 0);

                onComposed(snapshot.background);
            } else {
                // Fallback Legacy Flat Composition
                const photoImg = new Image();
                photoImg.crossOrigin = 'anonymous';
                await new Promise((resolve, reject) => {
                    photoImg.onload = resolve;
                    photoImg.onerror = reject;
                    photoImg.src = photoDataUrl;
                });

                canvas.width = photoImg.width;
                canvas.height = photoImg.height;
                ctx.drawImage(photoImg, 0, 0);

                const overlayImg = new Image();
                overlayImg.crossOrigin = 'anonymous';
                await new Promise((resolve, reject) => {
                    overlayImg.onload = resolve;
                    overlayImg.onerror = reject;
                    overlayImg.src = overlayUrl;
                });

                ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);

                const composedDataUrl = canvas.toDataURL('image/png', 1.0);
                onComposed(composedDataUrl);
            }
        } catch (error) {
            console.error('Error composing image:', error);
        } finally {
            setIsComposing(false);
        }
    };

    return (
        <div className="relative">
            {templateConfig && (
                <div className="fixed -top-[9999px] -left-[9999px] pointer-events-none opacity-0">
                    <TemplateVisualizer 
                        ref={visualizerRef}
                        template={templateConfig}
                        capturedPhotos={[photoDataUrl]}
                    />
                </div>
            )}
            <canvas ref={canvasRef} className="w-full h-auto rounded-2xl" />
            {isComposing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl">
                    <div className="text-2xl font-bold text-white">Composing...</div>
                </div>
            )}
        </div>
    );
}
