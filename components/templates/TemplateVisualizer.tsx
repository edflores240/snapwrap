'use client';

import React, { forwardRef, useImperativeHandle, useMemo, useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Group, Ellipse, RegularPolygon, Star as KonvaStar, Line as KonvaLine } from 'react-konva';
import { TemplateConfig, ShapeElement } from './TemplateDesigner';
import useImage from 'use-image';
import { drawTemplateBackground } from '@/lib/template-render';
import { TEXT_LINE_HEIGHT, curveGlyphs, loadTextFonts, measureTextBlock, parseTextShadows } from '@/lib/template-text';

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
        const [bgImg] = useImage(template.backgroundImage || '', 'anonymous');
        
        const capturedPhotos = capturedPhotosProp || [];

        // Text is measured with the real font, so wait for web fonts and then redraw
        const [fontsReady, setFontsReady] = useState(0);
        useEffect(() => {
            let live = true;
            loadTextFonts(template.textElements || []).then(() => live && setFontsReady(n => n + 1));
            return () => { live = false; };
        }, [template.textElements]);
        
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

        const backgroundCanvas = useMemo(() => {
            if (typeof document === 'undefined') return null;
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(width));
            c.height = Math.max(1, Math.round(height));
            const ctx = c.getContext('2d');
            if (!ctx) return null;
            drawTemplateBackground(ctx, template, c.width, c.height, bgImg ?? null);
            return c;
        }, [template.background, template.backgroundImage, template.backgroundOverlay, template.backgroundOverlayOpacity, bgImg, width, height]); // eslint-disable-line react-hooks/exhaustive-deps

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
                        {/* 1. Background: colour/gradient, image and tint, drawn by the same code as the final photo */}
                        {backgroundCanvas && (
                            <KonvaImage image={backgroundCanvas} width={width} height={height} listening={false} />
                        )}

                        {/* 3. Unified Content Rendering (Sorted by Z-Index) */}
                        {(() => {
                            const items: any[] = [
                                ...(template.slots || []).map(s => ({ type: 'slot', data: s, zIndex: s.zIndex ?? 0 })),
                                ...(template.stickers || []).map(s => ({ type: 'sticker', data: s, zIndex: s.zIndex ?? 0 })),
                                ...(template.textElements || []).map(t => ({ type: 'text', data: t, zIndex: t.zIndex ?? 0 })),
                                ...(template.shapes || []).map(s => ({ type: 'shape', data: s, zIndex: s.zIndex ?? 0 })),
                            ];

                            return items.sort((a, b) => a.zIndex - b.zIndex).map((item) => {
                                if (item.type === 'slot' && !showForegroundOnly && !hideSlots) {
                                    const s = item.data;
                                    const sw = (s.width / 100) * width;
                                    const sh = (s.height / 100) * height;
                                    const i = template.slots.indexOf(s);
                                    const img = photoImages[i];
                                    const isCircleSlot = s.clipShape === 'circle';
                                    const cornerR = isCircleSlot ? 0 : (s.borderRadius ?? template.borderRadius) * scale;
                                    return (
                                        <Group
                                            key={s.id}
                                            x={(s.x / 100) * width}
                                            y={(s.y / 100) * height}
                                            rotation={s.rotation}
                                            clipFunc={isCircleSlot ? (ctx) => {
                                                ctx.ellipse(sw / 2, sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
                                            } : undefined}
                                        >
                                            <Rect
                                                width={sw}
                                                height={sh}
                                                fill="#000"
                                                cornerRadius={cornerR}
                                                stroke={template.borderColor}
                                                strokeWidth={template.borderWidth * scale}
                                            />
                                            {img && (
                                                <KonvaImage
                                                    image={img as any}
                                                    width={sw}
                                                    height={sh}
                                                    cornerRadius={cornerR}
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
                                    const cropped = (stk.height || 0) > 0;
                                    const sh = cropped ? (stk.height / template.width) * width : (img.height / img.width) * sw;
                                    // object-fit: cover + object-position, as in the editor
                                    const k = Math.max(sw / img.width, sh / img.height);
                                    const cw = sw / k, ch = sh / k;
                                    const crop = cropped ? {
                                        x: (img.width - cw) * ((50 + (stk.cropX || 0)) / 100),
                                        y: (img.height - ch) * ((50 + (stk.cropY || 0)) / 100),
                                        width: cw,
                                        height: ch,
                                    } : undefined;
                                    return (
                                        <KonvaImage
                                            key={stk.id}
                                            image={img}
                                            x={(stk.x / 100) * width}
                                            y={(stk.y / 100) * height}
                                            width={sw}
                                            height={sh}
                                            crop={crop}
                                            rotation={stk.rotation}
                                            offsetX={sw / 2}
                                            offsetY={sh / 2}
                                            opacity={stk.opacity ?? 1}
                                            scaleX={stk.flipX ? -1 : 1}
                                            scaleY={stk.flipY ? -1 : 1}
                                        />
                                    );
                                } else if (item.type === 'shape') {
                                    const shp = item.data as ShapeElement;
                                    const sx = (shp.x / 100) * width;
                                    const sy = (shp.y / 100) * height;
                                    const sw = (shp.width / 100) * width;
                                    const sh = (shp.height / 100) * height;
                                    const cx = sx + sw / 2;
                                    const cy = sy + sh / 2;
                                    if (shp.shapeType === 'rect') return (
                                        <Rect key={shp.id} x={sx} y={sy} width={sw} height={sh}
                                            fill={shp.fillColor} stroke={shp.strokeColor} strokeWidth={shp.strokeWidth}
                                            cornerRadius={shp.borderRadius * scale} opacity={shp.opacity}
                                            rotation={shp.rotation} offsetX={0} offsetY={0} />
                                    );
                                    if (shp.shapeType === 'circle') return (
                                        <Ellipse key={shp.id} x={cx} y={cy} radiusX={sw / 2} radiusY={sh / 2}
                                            fill={shp.fillColor} stroke={shp.strokeColor} strokeWidth={shp.strokeWidth}
                                            opacity={shp.opacity} rotation={shp.rotation} />
                                    );
                                    if (shp.shapeType === 'triangle') return (
                                        <RegularPolygon key={shp.id} x={cx} y={cy} sides={3}
                                            radius={Math.max(sw, sh) / 2}
                                            fill={shp.fillColor} stroke={shp.strokeColor} strokeWidth={shp.strokeWidth}
                                            opacity={shp.opacity} rotation={shp.rotation} />
                                    );
                                    if (shp.shapeType === 'star') return (
                                        <KonvaStar key={shp.id} x={cx} y={cy} numPoints={5}
                                            innerRadius={Math.max(sw, sh) * 0.2} outerRadius={Math.max(sw, sh) / 2}
                                            fill={shp.fillColor} stroke={shp.strokeColor} strokeWidth={shp.strokeWidth}
                                            opacity={shp.opacity} rotation={shp.rotation} />
                                    );
                                    if (shp.shapeType === 'line') return (
                                        <KonvaLine key={shp.id}
                                            points={[sx, cy, sx + sw, cy]}
                                            stroke={shp.strokeColor || shp.fillColor}
                                            strokeWidth={Math.max(2, shp.strokeWidth)}
                                            opacity={shp.opacity} rotation={shp.rotation}
                                            offsetX={sw / 2} />
                                    );
                                    return null;
                                } else if (item.type === 'text') {
                                    const txt = item.data;
                                    const shadow = parseTextShadows(txt.textShadow)[0];
                                    const curved = txt.curve ? curveGlyphs(txt, scale) : null;
                                    if (curved) {
                                        // Curved text: one node per character, placed and tilted along the arc
                                        const cx = (txt.x / 100) * width;
                                        const cy = (txt.y / 100) * height;
                                        const fontPx = txt.fontSize * scale;
                                        return (
                                            <Group key={`${txt.id}-${fontsReady}`} x={cx} y={cy} rotation={txt.rotation} opacity={txt.opacity} listening={false}>
                                                {curved.glyphs.map((g, gi) => (
                                                    <Text
                                                        key={gi}
                                                        text={g.text}
                                                        x={g.x}
                                                        y={g.y}
                                                        rotation={(g.rotation * 180) / Math.PI}
                                                        offsetX={g.width / 2}
                                                        offsetY={fontPx * 0.82}
                                                        fontSize={fontPx}
                                                        fontFamily={txt.fontFamily}
                                                        fontStyle={`${txt.fontStyle === 'italic' ? 'italic ' : ''}${txt.fontWeight}`.trim()}
                                                        lineHeight={1}
                                                        fill={txt.color}
                                                        stroke={txt.textStrokeWidth ? txt.textStroke || '#000000' : undefined}
                                                        strokeWidth={(txt.textStrokeWidth || 0) * scale}
                                                        shadowColor={shadow?.color}
                                                        shadowOffsetX={(shadow?.x || 0) * scale}
                                                        shadowOffsetY={(shadow?.y || 0) * scale}
                                                        shadowBlur={(shadow?.blur || 0) * scale}
                                                        shadowEnabled={!!shadow}
                                                    />
                                                ))}
                                            </Group>
                                        );
                                    }
                                    // Same box the DOM and canvas renderers use, centred on (x, y) like them
                                    const block = measureTextBlock(txt, scale);
                                    return (
                                        <Text
                                            key={`${txt.id}-${fontsReady}`}
                                            text={txt.text}
                                            x={(txt.x / 100) * width}
                                            y={(txt.y / 100) * height}
                                            width={Math.ceil(block.width) + 2}
                                            offsetX={(Math.ceil(block.width) + 2) / 2}
                                            offsetY={block.height / 2}
                                            fontSize={txt.fontSize * scale}
                                            fontFamily={txt.fontFamily}
                                            fontStyle={`${txt.fontStyle === 'italic' ? 'italic ' : ''}${txt.fontWeight}`.trim()}
                                            lineHeight={TEXT_LINE_HEIGHT}
                                            fill={txt.color}
                                            align={txt.textAlign as any}
                                            letterSpacing={(txt.letterSpacing || 0) * scale}
                                            opacity={txt.opacity}
                                            rotation={txt.rotation}
                                            stroke={txt.textStrokeWidth ? txt.textStroke || '#000000' : undefined}
                                            strokeWidth={(txt.textStrokeWidth || 0) * scale}
                                            shadowColor={shadow?.color}
                                            shadowOffsetX={(shadow?.x || 0) * scale}
                                            shadowOffsetY={(shadow?.y || 0) * scale}
                                            shadowBlur={(shadow?.blur || 0) * scale}
                                            shadowEnabled={!!shadow}
                                            listening={false}
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
