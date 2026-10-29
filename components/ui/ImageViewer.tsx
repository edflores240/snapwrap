'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface ViewerItem {
    id: string;
    src: string;
    /** Small version shown (blurred) while the full image loads */
    thumb?: string | null;
    title?: string | null;
    subtitle?: string | null;
}

interface ImageViewerProps {
    items: ViewerItem[];
    /** Index of the open image; null keeps the viewer closed */
    index: number | null;
    onIndexChange: (index: number) => void;
    onClose: () => void;
    /** Buttons under the image (download, heart, print...) */
    actions?: (item: ViewerItem, index: number) => React.ReactNode;
    /** Called when the viewer gets within a few images of the end, to load more */
    onNearEnd?: () => void;
    /** Wrap around at the first and last image */
    loop?: boolean;
}

const SWIPE_DISTANCE = 70;
const SWIPE_SPEED = 480;
const CLOSE_DISTANCE = 120;

const slide = {
    enter: (dir: number) => ({ x: dir > 0 ? '60%' : '-60%', opacity: 0, scale: 0.96 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-60%' : '60%', opacity: 0, scale: 0.96 }),
};

/**
 * One full-screen image viewer for every gallery in the app. Swipe left/right (or use the arrow keys or
 * buttons) to move between images, swipe down or press Escape to close.
 */
export default function ImageViewer({ items, index, onIndexChange, onClose, actions, onNearEnd, loop = false }: ImageViewerProps) {
    const open = index !== null && index >= 0 && index < items.length;
    const [direction, setDirection] = useState(1);
    const lastIndex = useRef(index);

    const go = useCallback((delta: number) => {
        if (index === null || items.length === 0) return;
        let next = index + delta;
        if (loop) next = (next + items.length) % items.length;
        else if (next < 0 || next >= items.length) return;
        setDirection(delta >= 0 ? 1 : -1);
        onIndexChange(next);
    }, [index, items.length, loop, onIndexChange]);

    useEffect(() => { lastIndex.current = index; }, [index]);

    // Keyboard and page scroll lock while open
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight') go(1);
            else if (e.key === 'ArrowLeft') go(-1);
        };
        window.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
    }, [open, go, onClose]);

    // Warm the neighbours so swiping feels instant, and ask for more near the end
    useEffect(() => {
        if (!open || index === null) return;
        [index - 1, index + 1].forEach(i => {
            const item = items[i];
            if (item) { const img = new window.Image(); img.src = item.src; }
        });
        if (onNearEnd && index >= items.length - 3) onNearEnd();
    }, [open, index, items, onNearEnd]);

    const onDragEnd = (_: unknown, info: PanInfo) => {
        const { x, y } = info.offset;
        if (Math.abs(y) > Math.abs(x) && y > CLOSE_DISTANCE) { onClose(); return; }
        if (Math.abs(x) >= Math.abs(y)) {
            if (x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_SPEED) go(1);
            else if (x > SWIPE_DISTANCE || info.velocity.x > SWIPE_SPEED) go(-1);
        }
    };

    const item = open && index !== null ? items[index] : null;
    const canPrev = index !== null && (loop ? items.length > 1 : index > 0);
    const canNext = index !== null && (loop ? items.length > 1 : index < items.length - 1);

    return (
        <AnimatePresence>
            {item && index !== null && (
                <motion.div
                    key="viewer"
                    className="fixed inset-0 z-[300] flex flex-col bg-black/95 text-white backdrop-blur-xl select-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    role="dialog"
                    aria-modal="true"
                >
                    {/* Top bar */}
                    <div className="relative z-10 flex items-center justify-between px-4 pt-[max(14px,env(safe-area-inset-top))] pb-2">
                        <span className="px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur text-[11px] font-bold tabular-nums tracking-wider">
                            {index + 1} / {items.length}
                        </span>
                        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center transition-colors" aria-label="Close">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Stage */}
                    <div className="relative flex-1 min-h-0 overflow-hidden" onClick={onClose}>
                        <AnimatePresence initial={false} custom={direction} mode="popLayout">
                            <motion.div
                                key={item.id}
                                custom={direction}
                                variants={slide}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.9 }}
                                drag
                                dragDirectionLock
                                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                                dragElastic={0.45}
                                onDragEnd={onDragEnd}
                                className="absolute inset-0 flex items-center justify-center px-3 touch-none cursor-grab active:cursor-grabbing"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={item.src}
                                    alt={item.title || ''}
                                    draggable={false}
                                    onClick={e => e.stopPropagation()}
                                    className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                                    style={item.thumb ? { backgroundImage: `url(${item.thumb})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                                />
                            </motion.div>
                        </AnimatePresence>

                        {/* Arrows for mouse users; touch users swipe */}
                        {canPrev && (
                            <button onClick={e => { e.stopPropagation(); go(-1); }} className="hidden md:flex absolute left-5 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white hover:text-black backdrop-blur items-center justify-center transition-colors" aria-label="Previous">
                                <ChevronLeft size={22} />
                            </button>
                        )}
                        {canNext && (
                            <button onClick={e => { e.stopPropagation(); go(1); }} className="hidden md:flex absolute right-5 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white hover:text-black backdrop-blur items-center justify-center transition-colors" aria-label="Next">
                                <ChevronRight size={22} />
                            </button>
                        )}
                    </div>

                    {/* Caption and actions */}
                    <div className="relative z-10 px-4 pt-3 pb-[max(18px,env(safe-area-inset-bottom))] flex flex-col items-center gap-3">
                        {(item.title || item.subtitle) && (
                            <div className="text-center max-w-md">
                                {item.title && <p className="text-sm font-semibold leading-snug">{item.title}</p>}
                                {item.subtitle && <p className="text-xs text-white/55 mt-0.5">{item.subtitle}</p>}
                            </div>
                        )}
                        {actions && <div className="flex items-center justify-center gap-2.5 flex-wrap">{actions(item, index)}</div>}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/** Shared look for the buttons passed to `actions` */
export const viewerButton = 'h-11 px-5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50';
export const viewerButtonPrimary = 'h-11 px-5 rounded-full bg-white text-black hover:bg-white/90 text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50';
