'use client';

import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Group } from 'react-konva';
import { TemplateConfig } from './TemplateDesigner';
import useImage from 'use-image';

interface TemplateVisualizerProps {
    template: TemplateConfig;
    capturedPhotos?: (string | null)[];
    width?: number; // Optional override for rendering size
    hideSlots?: boolean;
    showForegroundOnly?: boolean;
    showBackgroundOnly?: boolean;
}

export interface TemplateVisualizerHandle {
    getSnapshot: () => Promise<{ background: string; foreground: string }>;
}

const TemplateVisualizer = forwardRef<TemplateVisualizerHandle, TemplateVisualizerProps>(
    ({ template, capturedPhotos = [], width: displayWidth, hideSlots, showForegroundOnly, showBackgroundOnly }, ref) => {
        const stageRef = useRef<any>(null);
        const [bgImg] = useImage(template.backgroundImage || '');
        
        const [stickerImages, setStickerImages] = useState<{id: string, img: HTMLImageElement | null, sticker: any}[]>([]);
        const [photoImages, setPhotoImages] = useState<(HTMLImageElement | null)[]>([]);

        useEffect(() => {
            if (!template.stickers || template.stickers.length === 0) { setStickerImages([]); return; }
            Promise.all(template.stickers.map(s => new Promise<any>(res => {
                const img = new window.Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => res({ id: s.id, img, sticker: s });
                img.onerror = () => res({ id: s.id, img: null, sticker: s });
                img.src = s.src;
            }))).then(setStickerImages);
        }, [template.stickers]);

        useEffect(() => {
            if (!capturedPhotos || capturedPhotos.length === 0) { setPhotoImages([]); return; }
            Promise.all(capturedPhotos.map(src => new Promise<HTMLImageElement | null>(res => {
                if (!src) return res(null);
                const img = new window.Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => res(img);
                img.onerror = () => res(null);
                img.src = src;
            }))).then(setPhotoImages);
        }, [capturedPhotos]);

        const scale = (displayWidth || template.width) / template.width;
        const width = template.width * scale;
        const height = template.height * scale;

        useImperativeHandle(ref, () => ({
            getSnapshot: async () => {
                if (!stageRef.current) return { background: '', foreground: '' };

                // 1. Capture Background
                // Hide foreground layers
                const layers = stageRef.current.getLayers();
                const bgLayer = layers[0];
                const slotLayer = layers[1];
                const fgLayer = layers[2];

                fgLayer.hide();
                slotLayer.hide();
                bgLayer.show();
                const background = stageRef.current.toDataURL({ pixelRatio: 2 });

                // 2. Capture Foreground
                bgLayer.hide();
                slotLayer.hide();
                fgLayer.show();
                const foreground = stageRef.current.toDataURL({ pixelRatio: 2 });

                // Reset visibility
                bgLayer.show();
                slotLayer.show();
                fgLayer.show();

                return { background, foreground };
            }
        }));

        return (
            <Stage 
                width={width} 
                height={height} 
                ref={stageRef}
                style={{ borderRadius: `${template.borderRadius * scale}px`, overflow: 'hidden' }}
            >
                {/* Layer 0: Background */}
                {!showForegroundOnly && (
                    <Layer>
                        {/* Solid Background */}
                        <Rect
                            width={width}
                            height={height}
                            fill={template.background?.includes('gradient') ? undefined : template.background}
                        />
                        {/* Background Image */}
                        {bgImg && (
                            <KonvaImage
                                image={bgImg}
                                width={width}
                                height={height}
                                listening={false}
                            />
                        )}
                    </Layer>
                )}

                {/* Layer 1: Slots (Photos) */}
                {!showForegroundOnly && !showBackgroundOnly && !hideSlots && (
                    <Layer>
                        {template.slots.map((slot, i) => {
                            const sw = (slot.width / 100) * width;
                            const sh = (slot.height / 100) * height;
                            const sx = (slot.x / 100) * width;
                            const sy = (slot.y / 100) * height;

                            return (
                                <Group 
                                    key={slot.id} 
                                    x={sx + sw / 2} 
                                    y={sy + sh / 2} 
                                    rotation={slot.rotation}
                                    offsetX={sw / 2}
                                    offsetY={sh / 2}
                                >
                                    <Rect
                                        width={sw}
                                        height={sh}
                                        fill="#000"
                                        cornerRadius={template.borderRadius * scale}
                                        stroke={template.borderColor}
                                        strokeWidth={template.borderWidth * scale}
                                    />
                                    {photoImages[i] && (
                                        <KonvaImage
                                            image={photoImages[i] as any}
                                            width={sw}
                                            height={sh}
                                            cornerRadius={template.borderRadius * scale}
                                            crop={{
                                                x: 0,
                                                y: 0,
                                                width: (photoImages[i] as any).width,
                                                height: (photoImages[i] as any).height,
                                            }}
                                        />
                                    )}
                                </Group>
                            );
                        })}
                    </Layer>
                )}

                {/* Layer 2: Foreground (Stickers, Text, Borders) */}
                {!showBackgroundOnly && (
                    <Layer>
                        {/* Stickers */}
                        {(template.stickers || []).map((stk, i) => {
                            const img = stickerImages[i]?.img;
                            if (!img) return null;
                            
                            const sw = (stk.width / template.width) * width;
                            const sh = (img.height / img.width) * sw;
                            
                            return (
                                <KonvaImage
                                    key={stk.id}
                                    image={img}
                                    x={(stk.x / 100) * width}
                                    y={(stk.y / 100) * height}
                                    width={sw}
                                    height={sh}
                                    rotation={stk.rotation}
                                    offsetX={sw / 2}
                                    offsetY={sh / 2}
                                />
                            );
                        })}

                        {/* Text Elements - Center anchored to match CSS translate(-50%,-50%) */}
                        {template.textElements.map((txt) => (
                            <Text
                                key={txt.id}
                                text={txt.text}
                                x={(txt.x / 100) * width}
                                y={(txt.y / 100) * height}
                                fontSize={txt.fontSize * scale}
                                fontFamily={txt.fontFamily}
                                fill={txt.color}
                                fontStyle={`${txt.fontStyle} ${txt.fontWeight}`}
                                align="center"
                                rotation={txt.rotation}
                                opacity={txt.opacity}
                                shadowBlur={txt.textShadow ? 4 : 0}
                                shadowColor="rgba(0,0,0,0.5)"
                                // Perfect centering logic for Konva Text
                                width={width}
                                offsetX={width / 2}
                                offsetY={(txt.fontSize * scale) / 2}
                            />
                        ))}

                        {/* Template Border (Capture this in the snapshot!) */}
                        {template.borderWidth > 0 && (
                            <Rect
                                width={width}
                                height={height}
                                stroke={template.borderColor}
                                strokeWidth={template.borderWidth * scale * 2} // Double because it strokes from center
                                cornerRadius={template.borderRadius * scale}
                                listening={false}
                            />
                        )}

                        {/* Watermark */}
                        {template.watermarkText && (
                            <Text
                                text={template.watermarkText.toUpperCase()}
                                x={width / 2}
                                y={height - 15 * scale}
                                fontSize={10 * scale}
                                fill="rgba(0,0,0,0.3)"
                                align="center"
                                width={width}
                                offsetX={width / 2}
                                letterSpacing={2 * scale}
                            />
                        )}
                    </Layer>
                )}
            </Stage>
        );
    }
);

TemplateVisualizer.displayName = 'TemplateVisualizer';

export default TemplateVisualizer;
