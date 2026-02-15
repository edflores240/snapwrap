'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Inter, Playfair_Display, Caveat } from 'next/font/google';
import { motion, AnimatePresence } from 'framer-motion';

const inter = Inter({ subsets: ['latin'] });
const playfair = Playfair_Display({ subsets: ['latin'] });
const caveat = Caveat({ subsets: ['latin'] });

interface Event {
    id: string;
    name: string;
    date: string;
    slug: string;
    config: any;
}

interface Photo {
    id: string;
    final_url: string;
    image_url: string;
    created_at: string;
    is_published: boolean;
}

const THEMES = {
    modern: {
        bg: 'bg-[#FFF8F0]',
        text: 'text-neutral-900',
        accent: 'bg-[#FF8FAB]',
        fontTitle: playfair.className,
        fontBody: inter.className,
        handwritten: 'text-neutral-800',
    },
    valentine: {
        bg: 'bg-[#FFE4E1]',
        text: 'text-[#8B0000]',
        accent: 'bg-[#FF69B4]',
        fontTitle: playfair.className,
        fontBody: inter.className,
        handwritten: 'text-[#D2691E]',
    },
    minimal: {
        bg: 'bg-white',
        text: 'text-black',
        accent: 'bg-black text-white',
        fontTitle: inter.className,
        fontBody: inter.className,
        handwritten: 'text-gray-500',
    },
    dark: {
        bg: 'bg-neutral-900',
        text: 'text-white',
        accent: 'bg-white text-black',
        fontTitle: playfair.className,
        fontBody: inter.className,
        handwritten: 'text-gray-400',
    }
};

type ThemeKey = keyof typeof THEMES;

const getOptimizedUrl = (url: string) => {
    if (!url) return '';
    return url;
};

export default function PublicGalleryPage() {
    const params = useParams();
    const [event, setEvent] = useState<Event | null>(null);
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);

    // Lightbox
    const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

    // Auto Scroll State
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        if (params.slug) fetchEventAndPhotos();
    }, [params.slug]);

    const fetchEventAndPhotos = async () => {
        try {
            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .select('*')
                .eq('slug', params.slug as string)
                .single();

            if (eventError) throw eventError;
            setEvent(eventData);

            if (eventData) {
                const { data: photoData } = await supabase
                    .from('photos')
                    .select('*')
                    .eq('event_id', eventData.id)
                    .eq('is_published', true)
                    .order('created_at', { ascending: false });
                setPhotos(photoData || []);
            }
        } catch (error) {
            console.error('Error loading gallery:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fix: Using 6 duplicates to ensure we have enough width
    const displayPhotos = photos.length > 0
        ? [...photos, ...photos, ...photos, ...photos, ...photos, ...photos]
        : [];

    // Robust Auto-Scroll Logic without Time Delta
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || displayPhotos.length === 0) return;

        let animationFrameId: number;
        let running = true;

        const scroll = () => {
            if (!running) return;

            if (!isHovered) {
                el.scrollLeft += 1; // Faster, simple increment

                // Seamless Loop:
                // We reset when we reach approximately half the scroll width.
                // Since we have 6 sets, resetting at 1/2 way means valid content exists at 0.
                if (el.scrollLeft >= (el.scrollWidth / 2)) {
                    el.scrollLeft = 0;
                }
            }
            animationFrameId = requestAnimationFrame(scroll);
        };

        animationFrameId = requestAnimationFrame(scroll);
        return () => {
            running = false;
            cancelAnimationFrame(animationFrameId);
        };
    }, [isHovered, displayPhotos.length]); // Depend on length to restart if photos load

    if (loading) {
        return (
            <main className="min-h-screen bg-[#FFF8F0] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
                    <p className={`text-neutral-500 font-medium ${playfair.className} tracking-widest`}>LOADING MOMENTS...</p>
                </div>
            </main>
        );
    }

    if (!event) return null;

    const themeStyle = (event.config?.publicPage?.themeStyle || 'modern') as ThemeKey;
    const currentTheme = THEMES[themeStyle] || THEMES.modern;

    return (
        <main className={`min-h-screen relative overflow-x-hidden flex flex-col ${currentTheme.bg} ${currentTheme.text} transition-colors duration-500`}>

            {/* Header */}
            <header className="relative z-10 pt-16 pb-0 px-6 text-center max-w-5xl mx-auto w-full">
                <div className={`absolute top-4 left-4 md:top-10 md:left-[10%] rotate-[-10deg] ${currentTheme.handwritten} opacity-80 pointer-events-none`}>
                    <span className={`${caveat.className} text-xl md:text-2xl`}>All yours!</span>
                    <svg width="30" height="30" viewBox="0 0 100 100" className="opacity-80 mt-1 ml-2 md:w-[40px] md:h-[40px]"><path d="M10,10 Q50,50 90,10" fill="none" stroke="currentColor" strokeWidth="3" /></svg>
                </div>
                <div className={`inline-block px-4 py-1 rounded-full text-xs md:text-sm font-medium mb-4 ${themeStyle === 'minimal' ? 'bg-gray-100' : 'bg-[#FFE5B4] text-[#8B4513]'} transform -rotate-1 shadow-sm`}>
                    {new Date(event.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
                <h1 className={`text-5xl md:text-8xl font-black tracking-tighter leading-[0.9] text-center mb-4 ${currentTheme.fontTitle}`}>
                    {event.config?.publicPage?.title || event.name}
                </h1>
                <p className={`text-base md:text-xl opacity-70 max-w-2xl mx-auto leading-relaxed px-4 ${currentTheme.fontBody}`}>
                    {event.config?.publicPage?.subtitle || "Capturing moments, creating memories."}
                </p>
                <div className={`absolute top-[60%] right-2 scale-75 md:scale-100 md:top-[40%] md:right-[5%] rotate-[15deg] ${currentTheme.handwritten} opacity-90 pointer-events-none`}>
                    <span className={`${caveat.className} text-2xl md:text-3xl`}>Download & Share</span>
                    <svg width="40" height="40" viewBox="0 0 100 100" className="mt-2 ml-4 md:w-[60px] md:h-[60px]">
                        <path d="M10,10 C30,80 80,10 90,90" fill="none" stroke="currentColor" strokeWidth="3" markerEnd="url(#arrow)" />
                        <defs>
                            <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                                <path d="M0,0 L0,6 L9,3 z" fill="currentColor" />
                            </marker>
                        </defs>
                    </svg>
                </div>
            </header>

            {/* Draggable Infinite Carousel */}
            <div className="flex-1 flex flex-col justify-center py-6 md:py-10 relative min-h-[60vh]">
                {photos.length === 0 ? (
                    <div className="text-center opacity-50 py-20">
                        <p className="text-xl">No photos yet.</p>
                    </div>
                ) : (
                    <div
                        ref={scrollRef}
                        className="flex overflow-x-auto gap-6 md:gap-10 px-4 no-scrollbar items-center cursor-grab active:cursor-grabbing py-8"
                        style={{ scrollBehavior: 'auto', WebkitOverflowScrolling: 'touch' }}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        onTouchStart={() => setIsHovered(true)}
                        onTouchEnd={() => setTimeout(() => setIsHovered(false), 1000)}
                    >
                        {displayPhotos.map((photo, i) => {
                            const rotation = i % 2 === 0 ? 'rotate-[-2deg]' : 'rotate-[2deg]';
                            const translateY = i % 2 === 0 ? 'translate-y-2' : '-translate-y-2';

                            return (
                                <div
                                    key={`${photo.id}-${i}`}
                                    className={`flex-shrink-0 w-[260px] md:w-[380px] aspect-[3/4] group select-none relative transition-all duration-500 ease-out hover:z-10 hover:scale-105 hover:rotate-0 ${rotation} ${translateY}`}
                                    onClick={() => setFullscreenIndex(i % photos.length)}
                                >
                                    <div className="w-full h-full bg-white p-3 md:p-4 shadow-xl transform transition-transform duration-300 pointer-events-none">
                                        <div className="w-full h-full relative overflow-hidden bg-gray-100 border border-gray-100">
                                            <img
                                                src={getOptimizedUrl(photo.final_url || photo.image_url)}
                                                alt="Event snap"
                                                className="w-full h-full object-cover"
                                                loading={i < 4 ? "eager" : "lazy"}
                                                draggable={false}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Fixed Footer */}
            <footer className={`py-12 border-t ${themeStyle === 'dark' ? 'border-white/10' : 'border-black/5'} bg-opacity-50`}>
                <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 items-start text-sm opacity-80">

                    {/* Event Info */}
                    <div className="text-center md:text-left">
                        <h3 className={`text-lg font-bold mb-2 ${currentTheme.fontTitle}`}>Event Details</h3>
                        <p className="font-medium">{event.name}</p>
                        <p className="opacity-70">{new Date(event.date).toLocaleDateString()}</p>
                    </div>

                    {/* Copyright */}
                    <div className="text-center flex flex-col items-center justify-center h-full pt-2">
                        <p className="font-bold mb-1">SnapWrap Photo Booth</p>
                        <p className="text-xs opacity-60">&copy; {new Date().getFullYear()} All rights reserved.</p>
                    </div>

                    {/* Developer Info (Inlined) */}
                    <div className="text-center md:text-right">
                        <h3 className={`text-lg font-bold mb-2 ${currentTheme.fontTitle}`}>Book Us</h3>
                        <div className="flex flex-col gap-1 items-center md:items-end">
                            <p className="font-medium">Jay Flores</p>
                            <a href="mailto:edflores240@gmail.com" className="hover:underline opacity-80 hover:opacity-100">edflores240@gmail.com</a>
                            <a href="tel:09480285798" className="hover:underline opacity-80 hover:opacity-100">09480285798</a>
                            <a href="https://instagram.com/eddyjayflores" target="_blank" className="hover:underline opacity-80 hover:opacity-100">@eddyjayflores</a>
                        </div>
                    </div>
                </div>
            </footer>

            <style jsx>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>

            {/* Lightbox Overlay */}
            <AnimatePresence>
                {fullscreenIndex !== null && photos[fullscreenIndex] && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center backdrop-blur-xl"
                        onClick={() => setFullscreenIndex(null)}
                    >
                        <button className="absolute top-6 right-6 p-4 text-white/50 hover:text-white transition-colors z-50" onClick={() => setFullscreenIndex(null)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <motion.img
                            key={fullscreenIndex}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            src={getOptimizedUrl(photos[fullscreenIndex].final_url || photos[fullscreenIndex].image_url)}
                            className="max-w-full max-h-[85vh] object-contain shadow-2xl p-2 bg-white rounded-sm"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="absolute bottom-10 flex gap-6" onClick={(e) => e.stopPropagation()}>
                            <button onClick={(e) => { e.stopPropagation(); setFullscreenIndex((fullscreenIndex - 1 + photos.length) % photos.length); }} className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md">←</button>
                            <a href={photos[fullscreenIndex].final_url || photos[fullscreenIndex].image_url} download className="px-8 py-3 rounded-full bg-white text-black font-bold hover:bg-gray-200 transition-colors shadow-lg flex items-center gap-2">Download</a>
                            <button onClick={(e) => { e.stopPropagation(); setFullscreenIndex((fullscreenIndex + 1) % photos.length); }} className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md">→</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
