'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { 
    Inter, 
    Playfair_Display, 
    Caveat, 
    Anton, 
    Bodoni_Moda, 
    Space_Grotesk,
    Syne,
    Bebas_Neue,
    Montserrat,
    Outfit
} from 'next/font/google';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    RefreshCw, 
    Download, 
    Share2, 
    Heart, 
    Star, 
    Sparkles, 
    X, 
    ChevronLeft, 
    ChevronRight 
} from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });
const playfair = Playfair_Display({ subsets: ['latin'] });
const caveat = Caveat({ subsets: ['latin'] });
const anton = Anton({ weight: '400', subsets: ['latin'] });
const bodoni = Bodoni_Moda({ subsets: ['latin'] });
const space = Space_Grotesk({ subsets: ['latin'] });
const syne = Syne({ subsets: ['latin'] });
const bebas = Bebas_Neue({ weight: '400', subsets: ['latin'] });
const montserrat = Montserrat({ subsets: ['latin'] });
const outfit = Outfit({ subsets: ['latin'] });

// Utility to determine if text should be black or white based on background hex
function getContrastColor(hexcolor: string) {
    if (!hexcolor) return '#000000';
    const r = parseInt(hexcolor.substring(1, 3), 16);
    const g = parseInt(hexcolor.substring(3, 5), 16);
    const b = parseInt(hexcolor.substring(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

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
        fontTitle: playfair.className,
        fontBody: inter.className,
        handwritten: 'text-neutral-800',
        layout: 'carousel',
        card: 'rounded-2xl shadow-xl border-white/40 border-t-4',
    },
    valentine: {
        bg: 'bg-[#FFE4E1]',
        text: 'text-[#8B0000]',
        fontTitle: playfair.className,
        fontBody: inter.className,
        handwritten: 'text-[#D2691E]',
        layout: 'carousel',
        card: 'rounded-[3rem] shadow-2xl border-white/60 border-8',
    },
    minimal: {
        bg: 'bg-white',
        text: 'text-black',
        fontTitle: inter.className,
        fontBody: inter.className,
        handwritten: 'text-gray-500',
        layout: 'grid',
        card: 'rounded-none border border-black/5 shadow-sm hover:shadow-lg',
    },
    dark: {
        bg: 'bg-neutral-900',
        text: 'text-white',
        fontTitle: playfair.className,
        fontBody: inter.className,
        handwritten: 'text-gray-400',
        layout: 'carousel',
        card: 'rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-white/5',
    },
    retro: {
        bg: 'bg-[#e9e4d9]',
        text: 'text-[#2b2b2b]',
        fontTitle: anton.className,
        fontBody: space.className,
        handwritten: 'text-blue-900',
        layout: 'grid',
        card: 'rounded-sm bg-white p-4 shadow-xl border-b-8 border-r-8 border-black/10 hover:border-black/20',
        titleStyle: 'uppercase tracking-tighter italic',
    },
    editorial: {
        bg: 'bg-[#fcfcfc]',
        text: 'text-black',
        fontTitle: bodoni.className,
        fontBody: inter.className,
        handwritten: 'text-neutral-400',
        layout: 'asymmetrical',
        card: 'rounded-none shadow-none grayscale hover:grayscale-0 transition-all duration-700',
        titleStyle: 'font-light tracking-[0.2em] uppercase text-7xl',
    },
    neon: {
        bg: 'bg-[#050505]',
        text: 'text-white',
        fontTitle: syne.className,
        fontBody: space.className,
        handwritten: 'text-pink-500',
        layout: 'grid',
        card: 'rounded-2xl border border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:border-accent hover:shadow-[0_0_30px_var(--accent-glow)]',
        titleStyle: 'font-black tracking-widest uppercase',
    },
    organic: {
        bg: 'bg-[#f4f1ea]',
        text: 'text-[#4a4a4a]',
        fontTitle: playfair.className,
        fontBody: inter.className,
        handwritten: 'text-[#8b9d83]',
        layout: 'carousel',
        card: 'rounded-[2.5rem] border-0 shadow-lg hover:shadow-xl',
    },
    serenity: {
        bg: 'bg-[#ffffff]',
        text: 'text-neutral-400',
        fontTitle: outfit.className,
        fontBody: inter.className,
        handwritten: 'text-neutral-300',
        layout: 'grid',
        card: 'rounded-none border-b border-neutral-100 shadow-none hover:bg-neutral-50',
        titleStyle: 'font-light tracking-[0.4em] uppercase text-5xl',
    },
    industrial: {
        bg: 'bg-[#1a1a1a]',
        text: 'text-[#e5e5e5]',
        fontTitle: bebas.className,
        fontBody: space.className,
        handwritten: 'text-yellow-500',
        layout: 'mosaic',
        card: 'rounded-none border-2 border-[#333] shadow-none hover:border-yellow-500',
        titleStyle: 'tracking-widest text-9xl leading-none',
    },
    vibrant: {
        bg: 'bg-[#ffeb3b]',
        text: 'text-black',
        fontTitle: anton.className,
        fontBody: montserrat.className,
        handwritten: 'text-pink-600',
        layout: 'grid',
        card: 'rounded-xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none',
        titleStyle: 'uppercase -rotate-2 bg-black text-white px-8 py-2 inline-block',
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

    // Download State
    const [downloading, setDownloading] = useState(false);

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

    const handleDownload = async (url: string) => {
        if (!url || downloading) return;
        setDownloading(true);
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = `snapwrap-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            // Fallback: open in new tab
            window.open(url, '_blank');
        } finally {
            setDownloading(false);
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
    const primaryColor = event.config?.publicPage?.primaryColor || '#000000';
    const secondaryColor = event.config?.publicPage?.secondaryColor || '#ffffff';
    const currentTheme = THEMES[themeStyle] || THEMES.modern;

    const layoutType = event.config?.publicPage?.layoutType || 'carousel';

    const renderHeader = (isSidebar = false) => (
        <header className={`${isSidebar ? 'text-left space-y-8' : 'relative z-10 pt-16 pb-0 px-6 text-center max-w-5xl mx-auto w-full'}`}>
            {!isSidebar && (
                <div className={`absolute top-4 left-4 md:top-10 md:left-[10%] rotate-[-10deg] ${currentTheme.handwritten} opacity-80 pointer-events-none`}>
                    <span className={`${caveat.className} text-xl md:text-2xl`}>
                        {event.config?.publicPage?.handwrittenNote || "All yours!"}
                    </span>
                    <svg width="30" height="30" viewBox="0 0 100 100" className="opacity-80 mt-1 ml-2 md:w-[40px] md:h-[40px]"><path d="M10,10 Q50,50 90,10" fill="none" stroke="currentColor" strokeWidth="3" /></svg>
                </div>
            )}
            
            <div 
                className={`inline-block px-4 py-1 rounded-full text-xs md:text-sm font-medium mb-4 transform -rotate-1 shadow-sm`}
                style={{ backgroundColor: secondaryColor, color: getContrastColor(secondaryColor) }}
            >
                {new Date(event.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            
            <div className={`${isSidebar ? 'text-left' : 'text-center'} mb-4`}>
                <h1 className={`text-5xl md:text-8xl font-black tracking-tighter leading-[0.9] ${currentTheme.fontTitle} ${(currentTheme as any).titleStyle || ''}`}>
                    {event.config?.publicPage?.title || event.name}
                </h1>
            </div>
            
            <p className={`text-base md:text-xl opacity-70 ${isSidebar ? 'text-left' : 'text-center max-w-2xl mx-auto'} leading-relaxed ${currentTheme.fontBody}`}>
                {event.config?.publicPage?.subtitle || "Capturing moments, creating memories."}
            </p>

            {isSidebar && (
                <div className={`${currentTheme.handwritten} opacity-80 pt-10`}>
                    <span className={`${caveat.className} text-2xl md:text-3xl`}>
                        {event.config?.publicPage?.handwrittenNote || "All yours!"}
                    </span>
                </div>
            )}

            <div className={`mt-8 flex ${isSidebar ? 'justify-start' : 'justify-center'}`}>
                <button 
                    onClick={() => {
                        setLoading(true);
                        fetchEventAndPhotos();
                    }}
                    className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl`}
                    style={{ backgroundColor: primaryColor, color: getContrastColor(primaryColor) }}
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh Gallery
                </button>
            </div>
        </header>
    );

    return (
        <main 
            className={`min-h-screen relative overflow-x-hidden flex flex-col ${currentTheme.bg} ${currentTheme.text} transition-colors duration-500`}
            style={{ 
                '--primary': primaryColor, 
                '--secondary': secondaryColor,
                '--primary-glow': `${primaryColor}44` 
            } as any}
        >
            {layoutType !== 'sidebar' && renderHeader()}

            <div className={`flex-1 flex flex-col ${layoutType === 'sidebar' ? 'md:flex-row' : ''} min-h-[60vh]`}>
                
                {layoutType === 'sidebar' && (
                    <div className="w-full md:w-[400px] lg:w-[500px] p-8 md:p-16 md:sticky md:top-0 h-fit">
                        {renderHeader(true)}
                    </div>
                )}

                <div className={`flex-1 ${layoutType === 'sidebar' ? 'p-6 md:p-16' : ''}`}>
                    {photos.length === 0 ? (
                        <div className="text-center opacity-50 py-20">
                            <p className={`text-xl ${currentTheme.fontBody}`}>No photos yet.</p>
                        </div>
                    ) : layoutType === 'carousel' ? (
                        <div
                            ref={scrollRef}
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                            className="flex gap-4 md:gap-10 overflow-x-hidden py-10 px-6 cursor-grab active:cursor-grabbing select-none items-center"
                        >
                            {displayPhotos.map((photo, i) => (
                                <motion.div
                                    key={`${photo.id}-${i}`}
                                    onClick={() => setFullscreenIndex(i % photos.length)}
                                    className={`flex-shrink-0 relative aspect-[3/4] h-[50vh] md:h-[65vh] overflow-hidden group cursor-pointer ${currentTheme.card}`}
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: (i % 10) * 0.05 }}
                                >
                                    <img
                                        src={photo.final_url || photo.image_url}
                                        alt="Gallery Photo"
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4">
                                        <div className="bg-white/20 backdrop-blur-md p-3 rounded-full hover:bg-white/40 transition-colors">
                                            <Star className="text-white" size={24} />
                                        </div>
                                        <div className="bg-white p-3 rounded-full hover:scale-110 transition-transform">
                                            <Share2 className="text-black" size={24} />
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : layoutType === 'mosaic' ? (
                        <div className="columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6 max-w-7xl mx-auto px-6 py-10">
                            {photos.map((photo, i) => (
                                <motion.div
                                    key={photo.id}
                                    onClick={() => setFullscreenIndex(i)}
                                    className={`relative break-inside-avoid overflow-hidden group cursor-pointer ${currentTheme.card}`}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: (i % 20) * 0.05 }}
                                >
                                    <img
                                        src={photo.final_url || photo.image_url}
                                        alt="Gallery Photo"
                                        className="w-full object-cover transition-all duration-700 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-6">
                                        <Sparkles className="text-white" size={16} />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className={`grid grid-cols-1 md:grid-cols-2 ${layoutType === 'sidebar' ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-8 max-w-7xl mx-auto px-6 py-10 w-full`}>
                            {photos.map((photo, i) => (
                                <motion.div
                                    key={photo.id}
                                    onClick={() => setFullscreenIndex(i)}
                                    className={`relative aspect-square overflow-hidden group cursor-pointer ${currentTheme.card} ${i % 3 === 1 ? 'md:mt-12' : ''}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: (i % 20) * 0.05 }}
                                >
                                    <img
                                        src={photo.final_url || photo.image_url}
                                        alt="Gallery Photo"
                                        className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                        <div className="bg-white/20 backdrop-blur-md p-4 rounded-full">
                                            <Heart className="text-white fill-white" size={24} />
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox / Fullscreen */}
            <AnimatePresence>
                {fullscreenIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 md:p-8"
                        onClick={() => setFullscreenIndex(null)}
                    >
                        {/* Top Close Button */}
                        <div className="absolute top-6 right-6 z-[110]">
                            <button 
                                onClick={() => setFullscreenIndex(null)}
                                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Navigation Buttons */}
                        <div className="absolute inset-y-0 left-4 md:left-10 flex items-center z-[110]">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setFullscreenIndex((fullscreenIndex - 1 + photos.length) % photos.length); }}
                                className="p-4 bg-white/10 hover:bg-white text-white hover:text-black rounded-full backdrop-blur-md transition-all"
                            >
                                <ChevronLeft size={32} />
                            </button>
                        </div>
                        <div className="absolute inset-y-0 right-4 md:right-10 flex items-center z-[110]">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setFullscreenIndex((fullscreenIndex + 1) % photos.length); }}
                                className="p-4 bg-white/10 hover:bg-white text-white hover:text-black rounded-full backdrop-blur-md transition-all"
                            >
                                <ChevronRight size={32} />
                            </button>
                        </div>

                        {/* Content Container */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full h-full max-w-4xl flex flex-col items-center justify-center gap-8"
                        >
                            <div className="relative w-full h-[65vh] md:h-[75vh] flex items-center justify-center overflow-hidden">
                                <img
                                    src={photos[fullscreenIndex].final_url || photos[fullscreenIndex].image_url}
                                    alt="Fullscreen Preview"
                                    className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                                />
                            </div>
                            
                            <div className="flex gap-4 z-[120]">
                                <button 
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = photos[fullscreenIndex].final_url || photos[fullscreenIndex].image_url;
                                        link.download = `snapwrap-${photos[fullscreenIndex].id}.jpg`;
                                        link.click();
                                    }}
                                    className="px-8 py-4 rounded-full bg-white text-black font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2 shadow-2xl"
                                >
                                    <Download size={16} /> Download Photo
                                </button>
                                <button 
                                    onClick={() => setFullscreenIndex(null)}
                                    className="px-8 py-4 rounded-full bg-white/10 text-white font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all backdrop-blur-md border border-white/20"
                                >
                                    Close Preview
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Footer */}
            <footer className="relative z-10 py-10 text-center opacity-30 text-[10px] font-black uppercase tracking-[0.3em]">
                Powered by SnapWrap
            </footer>
        </main>
    );
}
