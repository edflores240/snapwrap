'use client';

import React from 'react';
import { TemplateConfig } from './TemplateDesigner';
import { textElementStyle } from '@/lib/template-text';
import { stickerBoxStyle, stickerImageStyle } from '@/lib/template-render';

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
                aspectRatio: `${tpl.width} / ${tpl.height}`,
                borderRadius: tpl.borderRadius * scale,
            }}
        >
            {/* 1. Template Background */}
            {tpl.backgroundSnapshot ? (
                <img 
                    src={tpl.backgroundSnapshot} 
                    className="absolute inset-0 w-full h-full object-cover" 
                    alt=""
                />
            ) : (
                <div
                    className="absolute inset-0 w-full h-full"
                    style={{
                        background: tpl.background,
                        backgroundImage: tpl.backgroundImage ? `url(${tpl.backgroundImage})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        padding: tpl.padding * scale,
                        border: tpl.borderWidth ? `${tpl.borderWidth * scale}px solid ${tpl.borderColor}` : 'none',
                    }}
                />
            )}
            {/* Photo Slots (Visual Matrix Architecture) */}
            <div className="absolute inset-0 pointer-events-none">
                {tpl.slots.map((slot, i) => (
                    <div
                        key={slot.id}
                        className="absolute overflow-hidden flex items-center justify-center border transition-all duration-300"
                        style={{
                            left: `${slot.x}%`,
                            top: `${slot.y}%`,
                            width: `${slot.width}%`,
                            height: `${slot.height}%`,
                            transform: `rotate(${slot.rotation || 0}deg)`,
                            background: tpl.backgroundImage ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                            borderRadius: Math.min((tpl.borderRadius / 4) * scale, 8),
                            borderColor: `${tpl.borderColor}40`,
                            borderStyle: 'dashed',
                        }}
                    >
                        {showLabels && (
                            <span
                                className="text-[7px] font-black uppercase tracking-tighter"
                                style={{
                                    fontSize: Math.max(6 * scale, 5),
                                    color: tpl.borderColor,
                                    opacity: 0.4,
                                }}
                            >
                                P{i + 1}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {/* 3. Text & Stickers Overlay */}
            {tpl.foregroundSnapshot ? (
                <img 
                    src={tpl.foregroundSnapshot} 
                    className="absolute inset-0 w-full h-full pointer-events-none z-20" 
                    alt=""
                />
            ) : (
                <>
                    {/* Text elements */}
                    {tpl.textElements.map((el) => (
                        <div key={el.id} className="pointer-events-none" style={textElementStyle(el, n => `${n * scale}px`)}>
                            {el.text}
                        </div>
                    ))}

                    {/* Stickers */}
                    {(tpl.stickers || []).map((stk) => (
                        <div key={stk.id} style={stickerBoxStyle(stk, n => `${n * scale}px`, 15)}>
                            <img src={stk.src} alt="" style={stickerImageStyle(stk)} />
                        </div>
                    ))}

                    {/* Watermark fallback */}
                    {tpl.watermarkText && (
                        <div className="absolute bottom-1 left-0 right-0 text-center text-[5px] font-black opacity-30 text-white uppercase tracking-widest">
                            {tpl.watermarkText}
                        </div>
                    )}
                </>
            )}
        </div >
    );
}
