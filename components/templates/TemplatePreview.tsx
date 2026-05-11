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
                        <div key={el.id} className="absolute whitespace-nowrap pointer-events-none"
                            style={{
                                left: `${el.x}%`, top: `${el.y}%`,
                                transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
                                fontSize: Math.max(el.fontSize * scale, 6),
                                fontFamily: el.fontFamily, color: el.color,
                                fontWeight: el.fontWeight, fontStyle: el.fontStyle,
                                letterSpacing: el.letterSpacing * scale, textShadow: el.textShadow,
                                opacity: el.opacity, lineHeight: 1.2,
                            }}
                        >
                            {el.text}
                        </div>
                    ))}

                    {/* Stickers */}
                    {(tpl.stickers || []).map((stk) => (
                        <div key={stk.id} className="absolute pointer-events-none"
                            style={{
                                left: `${stk.x}%`, top: `${stk.y}%`,
                                width: stk.width * scale,
                                transform: `translate(-50%, -50%) rotate(${stk.rotation}deg)`,
                                zIndex: 15,
                            }}
                        >
                            <img src={stk.src} alt="sticker" className="w-full h-auto drop-shadow-md" />
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
