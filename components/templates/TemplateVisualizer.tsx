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
    ({ template, capturedPhotos: capturedPhotosProp, width: displayWidth, hideSlots, showForegroundOnly, showBackgroundOnly }, ref) => {
        const stageRef = useRef<any>(null);
        const [bgImg] = useImage(template.backgroundImage || '');
        
        const capturedPhotos = capturedPhotosProp || [];
        
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
            if (!capturedPhotos || capturedPhotos.length === 0) { 
                setPhotoImages([]); 
                return; 
            }
            Promise.all(capturedPhotos.map(src => new Promise<HTMLImageElement | null>(res => {
                if (!src) return res(null);
                const img = new window.Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => res(img);
                img.onerror = () => res(null);
                img.src = src;
            }))).then(setPhotoImages);
        }, [capturedPhotos.join(',')]); // Use stringified version for stability if array is recreated

        const scale = (displayWidth || template.width) / template.width;
        const width = template.width * scale;
        const height = template.height * scale;

        useImperativeHandle(ref, () => ({
            getSnapshot: async () => {
                if (!stageRef.current) return { background: '', foreground: '' };

                // Capture everything in one shot as we have a unified layer
                const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
                return { background: dataUrl, foreground: '' };
            }
        }));

        return (
            <Stage 
                width={width} 
                height={height} 
                ref={stageRef}
                style={{ borderRadius: `${template.borderRadius * scale}px`, overflow: 'hidden' }}
            >
                {!showBackgroundOnly && (
                    <Layer>
                        {/* 1. Background Color */}
                        <Rect
                            width={width}
                            height={height}
                            fill={template.background?.includes('gradient') ? undefined : template.background}
                        />

                        {/* 2. Background Image (if any) */}
                        {bgImg && (
                            <KonvaImage
                                image={bgImg}
                                width={width}
                                height={height}
                                listening={false}
                            />
                        )}

                        {/* 3. Unified Content Rendering (Sorted by Z-Index) */}
                        {(() => {
                            const items: any[] = [
                                ...(template.slots || []).map(s => ({ type: 'slot', data: s, zIndex: s.zIndex ?? 0 })),
                                ...(template.stickers || []).map(s => ({ type: 'sticker', data: s, zIndex: s.zIndex ?? 0 })),
                                ...(template.textElements || []).map(t => ({ type: 'text', data: t, zIndex: t.zIndex ?? 0 }))
                            ];

                            return items.sort((a, b) => a.zIndex - b.zIndex).map((item) => {
                                if (item.type === 'slot' && !showForegroundOnly && !hideSlots) {
                                    const s = item.data;
                                    const sw = (s.width / 100) * width;
                                    const sh = (s.height / 100) * height;
                                    const i = template.slots.indexOf(s);
                                    const img = photoImages[i];
                                    return (
                                        <Group key={s.id} x={(s.x / 100) * width} y={(s.y / 100) * height} rotation={s.rotation}>
                                            <Rect
                                                width={sw}
                                                height={sh}
                                                fill="#000"
                                                cornerRadius={template.borderRadius * scale}
                                                stroke={template.borderColor}
                                                strokeWidth={template.borderWidth * scale}
                                            />
                                            {img && (
                                                <KonvaImage
                                                    image={img as any}
                                                    width={sw}
                                                    height={sh}
                                                    cornerRadius={template.borderRadius * scale}
                                                    crop={{
                                                        x: 0,
                                                        y: 0,
                                                        width: img.width,
                                                        height: img.height,
                                                    }}
                                                />
                                            )}
                                        </Group>
                                    );
                                } else if (item.type === 'sticker') {
                                    const stk = item.data;
                                    const imgEntry = stickerImages.find(si => si.id === stk.id);
                                    const img = imgEntry?.img;
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
                                            opacity={stk.opacity ?? 1}
                                            scaleX={stk.flipX ? -1 : 1}
                                            scaleY={stk.flipY ? -1 : 1}
                                        />
                                    );
                                } else if (item.type === 'text') {
                                    const txt = item.data;
                                    return (
                                        <Text
                                            key={txt.id}
                                            text={txt.text}
                                            x={(txt.x / 100) * width}
                                            y={(txt.y / 100) * height}
                                            fontSize={txt.fontSize * scale}
                                            fontFamily={txt.fontFamily}
                                            fill={txt.color}
                                            fontStyle={`${txt.fontStyle} ${txt.fontWeight}`}
                                            align={txt.textAlign as any}
                                            letterSpacing={txt.letterSpacing}
                                            opacity={txt.opacity}
                                            rotation={txt.rotation}
                                            offsetX={(txt.fontSize * scale * txt.text.length) / 4}
                                            offsetY={(txt.fontSize * scale) / 2}
                                        />
                                    );
                                }
                                return null;
                            });
                        })()}

                        {/* 4. Global Overlays (Borders, Watermarks) */}
                        {template.borderWidth > 0 && (
                            <Rect
                                width={width}
                                height={height}
                                stroke={template.borderColor}
                                strokeWidth={template.borderWidth * scale * 2}
                                cornerRadius={template.borderRadius * scale}
                                listening={false}
                            />
                        )}

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
