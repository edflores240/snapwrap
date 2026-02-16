'use client';

import React from 'react';
import { TemplateConfig } from './TemplateDesigner';

interface TemplatePreviewProps {
    template: TemplateConfig;
    width?: number;
    showLabels?: boolean;
    className?: string;
}

/**
 * A reusable mini-preview that renders a TemplateConfig
 * exactly as the editor shows it — background, grid, text, watermark.
 */
export default function TemplatePreview({
    template: tpl,
    width = 220,
    showLabels = true,
    className = '',
}: TemplatePreviewProps) {
    const scale = width / 420; // 420 is the editor reference width

    return (
        <div
            className={`relative overflow-hidden select-none ${className}`}
            style={{
                width,
                background: tpl.backgroundImage
                    ? `url(${tpl.backgroundImage}) center/cover no-repeat`
                    : tpl.background,
                borderRadius: tpl.borderRadius * scale,
                padding: tpl.padding * scale,
                border: tpl.borderWidth
                    ? `${Math.max(tpl.borderWidth * scale, 1)}px solid ${tpl.borderColor}`
                    : 'none',
            }}
        >
            {/* Photo grid */}
            <div
                className="grid"
                style={{
                    gridTemplateRows: `repeat(${tpl.layout.rows}, 1fr)`,
                    gridTemplateColumns: `repeat(${tpl.layout.cols}, 1fr)`,
                    gap: tpl.gap * scale,
                }}
            >
                {tpl.slots.map((slot, i) => (
                    <div
                        key={slot.id}
                        className="relative overflow-hidden flex items-center justify-center"
                        style={{
                            aspectRatio: tpl.layout.rows > tpl.layout.cols ? '4/3' : '3/4',
                            background: tpl.backgroundImage ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)',
                            borderRadius: Math.max((tpl.borderRadius - tpl.padding / 2) * scale, 2),
                            border: `1px dashed ${tpl.borderColor}`,
                        }}
                    >
                        {showLabels && (
                            <span
                                className="text-center pointer-events-none"
                                style={{
                                    fontSize: Math.max(8 * scale, 6),
                                    color: tpl.borderColor,
                                    opacity: 0.6,
                                }}
                            >
                                📷
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* Text elements */}
            {tpl.textElements.map((el) => (
                <div
                    key={el.id}
                    className="absolute whitespace-nowrap pointer-events-none"
                    style={{
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
                        fontSize: Math.max(el.fontSize * scale, 6),
                        fontFamily: el.fontFamily,
                        color: el.color,
                        fontWeight: el.fontWeight,
                        fontStyle: el.fontStyle,
                        letterSpacing: el.letterSpacing * scale,
                        textShadow: el.textShadow,
                        opacity: el.opacity,
                        lineHeight: 1.2,
                    }}
                >
                    {el.text}
                </div>
            ))}

            {/* Stickers */}
            {
                (tpl.stickers || []).map((stk) => (
                    <div
                        key={stk.id}
                        className="absolute pointer-events-none"
                        style={{
                            left: `${stk.x}%`,
                            top: `${stk.y}%`,
                            width: stk.width * scale,
                            transform: `translate(-50%, -50%) rotate(${stk.rotation}deg)`,
                            zIndex: 15, // Above photos (implicit z=0) and below text if desired? Let's put text above stickers usually.
                        }}
                    >
                        <img src={stk.src} alt="sticker" className="w-full h-auto drop-shadow-md" />
                    </div>
                ))
            }

            {/* Watermark */}
            {
                tpl.watermarkText && (
                    <div
                        className="absolute bottom-1 left-0 right-0 text-center pointer-events-none"
                        style={{
                            fontSize: Math.max(10 * scale, 5),
                            opacity: 0.3,
                            letterSpacing: 2 * scale,
                            textTransform: 'uppercase',
                            color: tpl.background.includes('linear') || tpl.background.startsWith('#1') || tpl.background.startsWith('#0')
                                ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)',
                        }}
                    >
                        {tpl.watermarkText}
                    </div>
                )
            }
        </div >
    );
}
