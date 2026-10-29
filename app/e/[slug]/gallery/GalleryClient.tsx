'use client';

import React, { useEffect, useState, useRef, type CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { motion, MotionConfig, type TargetAndTransition } from 'framer-motion';
import AmbientMotion from '@/components/gallery/AmbientMotion';
import ImageViewer, { viewerButtonPrimary } from '@/components/ui/ImageViewer';
import { entranceProps, hoverProps, patternStyle } from '@/lib/gallery-effects';
import { resolveGalleryColors } from '@/lib/gallery-themes';
import { THEMES, HEADING_FONTS, headlineFontSize, caveat, playfair, type ThemeKey } from '@/lib/gallery-typography';
import { CAROUSEL_MAX_PHOTOS as MAX_GALLERY_PHOTOS, CAROUSEL_PHOTO_COLUMNS as GALLERY_COLUMNS } from '@/lib/gallery-queries';
import { 
    RefreshCw, 
    Download, 
    Share2, 
    Heart, 
    Star, 
    Sparkles,
    Images,
    Lock
} from 'lucide-react';

const CORNERS: Record<string, number> = { sharp: 0, soft: 14, round: 36 };
const SPACING: Record<string, number> = { tight: 8, loose: 56 };
const PHOTO_MIN_WIDTH: Record<string, number> = { small: 200, medium: 300, large: 440 };
const CAROUSEL_HEIGHT_VH: Record<string, number> = { small: 38, medium: 52, large: 72 };
const SCROLL_PX_PER_FRAME: Record<string, number> = { slow: 0.4, normal: 1, fast: 2.2 };

/** Only http(s), mailto and tel links are allowed; anything else (e.g. javascript:) is dropped. */
function safeLink(raw: string | undefined): string | null {
    const url = (raw || '').trim();
    if (!url) return null;
    if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;
    return `https://${url}`;
}

// Utility to determine if text should be black or white based on background hex
function getContrastColor(hexcolor: string) {
    if (!hexcolor) return '#000000';
    const r = parseInt(hexcolor.substring(1, 3), 16);
    const g = parseInt(hexcolor.substring(3, 5), 16);
    const b = parseInt(hexcolor.substring(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

export interface Event {
    id: string;
    name: string;
    date: string;
    slug: string;
    config: any;
}

export interface Photo {
    id: string;
    final_url: string;
    image_url: string;
    thumb_url?: string | null;
    created_at: string;
    is_published: boolean;
}




const getOptimizedUrl = (url: string) => {
    if (!url) return '';
    return url;
};

interface Props {
    initialEvent: Event;
    initialPhotos: Photo[];
}

export default function GalleryClient({ initialEvent, initialPhotos }: Props) {
    const [event, setEvent] = useState<Event | null>(initialEvent);
    const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Admin live preview: the event config editor posts unsaved settings into this page
    const [previewSettings, setPreviewSettings] = useState<Record<string, any> | null>(null);
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get('preview') !== '1') return;
        const onMessage = (e: MessageEvent) => {
            if (e.origin !== window.location.origin || e.data?.type !== 'gallery-preview') return;
            setPreviewSettings(e.data.publicPage);
        };
        window.addEventListener('message', onMessage);
        window.parent.postMessage({ type: 'gallery-preview-ready' }, window.location.origin);
        return () => window.removeEventListener('message', onMessage);
    }, []);

    // Lightbox
    const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

    // Auto Scroll State
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    // Download State
    const [downloading, setDownloading] = useState(false);

    const fetchEventAndPhotos = async () => {
        try {
            // Event and photos load in parallel; the inner join filters photos by event slug.
            // Capped because the carousel below repeats the list to fill the screen.
            const [eventRes, photosRes] = await Promise.all([
                supabase.from('events').select('*').eq('slug', initialEvent.slug).single(),
                supabase
                    .from('photos')
                    .select(`${GALLERY_COLUMNS}, events!inner(slug)`)
                    .eq('events.slug', initialEvent.slug)
                    .eq('is_published', true)
                    .order('created_at', { ascending: false })
                    .limit(MAX_GALLERY_PHOTOS),
            ]);

            if (eventRes.error) throw eventRes.error;
            setEvent(eventRes.data);
            setPhotos((photosRes.data as unknown as Photo[]) || []);
        } catch (error) {
            console.error('Error loading gallery:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
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

    const scrollSpeed = SCROLL_PX_PER_FRAME[(previewSettings ?? event?.config?.publicPage ?? {}).scrollSpeed] ?? 1;

    // Robust Auto-Scroll Logic without Time Delta
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || displayPhotos.length === 0) return;

        let animationFrameId: number;
        let running = true;
        // scrollLeft is rounded by the browser, so keep the fractional position ourselves for slow speeds
        let position = el.scrollLeft;

        const scroll = () => {
            if (!running) return;

            if (!isHovered) {
                position += scrollSpeed;
                el.scrollLeft = position;

                // Seamless Loop:
                // We reset when we reach approximately half the scroll width.
                // Since we have 6 sets, resetting at 1/2 way means valid content exists at 0.
                if (position >= (el.scrollWidth / 2)) {
                    position = 0;
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
    }, [isHovered, displayPhotos.length, scrollSpeed]); // Depend on length to restart if photos load

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

    const pp = previewSettings ?? event.config?.publicPage ?? {};
    const themeStyle = (pp.themeStyle || 'modern') as ThemeKey;
    const { primary: primaryColor, secondary: secondaryColor } = resolveGalleryColors(themeStyle, pp.primaryColor, pp.secondaryColor);
    const currentTheme = THEMES[themeStyle] || THEMES.modern;

    const layoutType = pp.layoutType || 'carousel';

    // Display options (all optional; "theme" keeps the theme's own look)
    const headingClass = HEADING_FONTS[pp.headingFont] ?? currentTheme.fontTitle;
    const alignLeft = pp.textAlign === 'left';
    const showDate = pp.showDate !== false;
    const showNote = pp.showNote !== false;
    const showRefresh = pp.showRefresh !== false;
    const gap = SPACING[pp.spacing];
    const minPhotoWidth = PHOTO_MIN_WIDTH[pp.photoSize];
    const ctaHref = pp.ctaLabel ? safeLink(pp.ctaUrl) : null;

    // Link to the guest album when the guest camera is on; it says when the album opens if that hasn't happened
    const guestCfg = event.config?.guestCamera;
    const albumHref = guestCfg?.enabled ? `/g/${event.slug}/album` : null;
    const albumOpensAt = guestCfg?.revealAt ? new Date(guestCfg.revealAt) : null;
    const albumOpen = !!albumOpensAt && albumOpensAt.getTime() <= Date.now();

    const pattern = patternStyle(pp.bgPattern, primaryColor, pp.patternStrength);
    const hover = hoverProps(pp.hover);
    const zoomOnHover = !pp.hover || pp.hover === 'theme' || pp.hover === 'zoom';
    const cardMotion = (i: number, stagger: number, fallback: { initial: TargetAndTransition; animate: TargetAndTransition }) => ({
        ...(entranceProps(pp.entrance, i, stagger) ?? { ...fallback, transition: { delay: (i % stagger) * 0.05 } }),
        ...(hover ?? {}),
    });

    const cardStyle: CSSProperties = {};
    if (pp.corners in CORNERS) cardStyle.borderRadius = CORNERS[pp.corners];
    if (pp.frame === 'none') { cardStyle.border = '0'; cardStyle.boxShadow = 'none'; }
    else if (pp.frame === 'thin') { cardStyle.border = `2px solid ${primaryColor}33`; }
    else if (pp.frame === 'thick') { cardStyle.border = '10px solid #ffffff'; cardStyle.boxShadow = '0 18px 40px -12px rgba(0,0,0,0.35)'; }

    const renderHeader = (isSidebar = false) => (
        <header className={`${isSidebar ? 'text-left space-y-8' : `relative z-10 pt-16 pb-0 px-6 ${alignLeft ? 'text-left' : 'text-center'} max-w-5xl mx-auto w-full`}`}>
            {!isSidebar && showNote && (
                <div className={`absolute top-4 left-4 md:top-10 md:left-[10%] rotate-[-10deg] opacity-80 pointer-events-none`} style={{ color: primaryColor }}>
                    <span className={`${caveat.className} text-xl md:text-2xl`}>
                        {pp.handwrittenNote || "All yours!"}
                    </span>
                    <svg width="30" height="30" viewBox="0 0 100 100" className="opacity-80 mt-1 ml-2 md:w-[40px] md:h-[40px]"><path d="M10,10 Q50,50 90,10" fill="none" stroke="currentColor" strokeWidth="3" /></svg>
                </div>
            )}
            
            {showDate && (
                <div
                    className={`inline-block px-4 py-1 rounded-full text-xs md:text-sm font-medium mb-4 transform -rotate-1 shadow-sm`}
                    style={{ backgroundColor: primaryColor, color: getContrastColor(primaryColor) }}
                >
                    {new Date(event.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
            )}

            <div className={`${isSidebar || alignLeft ? 'text-left' : 'text-center'} mb-4`}>
                <h1
                    className={`font-black tracking-tighter leading-[0.95] max-w-full break-words ${headingClass} ${(currentTheme as any).titleStyle || ''}`}
                    style={{ fontSize: headlineFontSize(pp.title || event.name, currentTheme as { titleMax?: number; titleEm?: number }, isSidebar), overflowWrap: 'anywhere' }}
                >
                    {pp.title || event.name}
                </h1>
            </div>
            
            <p className={`text-base md:text-xl opacity-70 ${isSidebar || alignLeft ? 'text-left max-w-2xl' : 'text-center max-w-2xl mx-auto'} leading-relaxed ${currentTheme.fontBody}`}>
                {pp.subtitle || "Capturing moments, creating memories."}
            </p>

            {isSidebar && showNote && (
                <div className="opacity-80 pt-10" style={{ color: primaryColor }}>
                    <span className={`${caveat.className} text-2xl md:text-3xl`}>
                        {pp.handwrittenNote || "All yours!"}
                    </span>
                </div>
            )}

            {(showRefresh || ctaHref || albumHref) && (
                <div className={`mt-8 flex flex-wrap gap-3 ${isSidebar || alignLeft ? 'justify-start' : 'justify-center'}`}>
                    {ctaHref && (
                        <a
                            href={ctaHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl"
                            style={{ backgroundColor: primaryColor, color: getContrastColor(primaryColor) }}
                        >
                            {pp.ctaLabel}
                        </a>
                    )}
                    {albumHref && (
                        <Link
                            href={albumHref}
                            className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                            style={{ border: `2px solid ${primaryColor}`, color: primaryColor }}
                        >
                            {albumOpen ? <Images size={16} /> : <Lock size={16} />}
                            {albumOpen
                                ? 'Guest album'
                                : albumOpensAt
                                    ? `Guest album · opens ${albumOpensAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                                    : 'Guest album · coming soon'}
                        </Link>
                    )}
                    {showRefresh && (
                        <button
                            onClick={() => {
                                setRefreshing(true);
                                fetchEventAndPhotos();
                            }}
                            className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                            style={ctaHref
                                ? { border: `2px solid ${primaryColor}`, color: primaryColor }
                                : { backgroundColor: primaryColor, color: getContrastColor(primaryColor), boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                            Refresh Gallery
                        </button>
                    )}
                </div>
            )}
        </header>
    );

    return (
        <MotionConfig reducedMotion="user">
        <main 
            className="min-h-screen relative overflow-x-hidden flex flex-col transition-colors duration-500"
            style={{ 
                backgroundColor: secondaryColor,
                color: primaryColor,
                '--primary': primaryColor, 
                '--secondary': secondaryColor,
                '--primary-glow': `${primaryColor}44` 
            } as any}
        >
            {pattern && (
                <div
                    className={`absolute inset-0 pointer-events-none ${pp.bgMotion === 'drift' ? 'gal-drift' : ''}`}
                    style={{ ...pattern, zIndex: 0, ...(pp.bgMotion === 'drift' ? { animation: 'gal-drift 18s linear infinite' } : {}) }}
                    aria-hidden
                />
            )}
            {pp.bgMotion && pp.bgMotion !== 'none' && pp.bgMotion !== 'drift' && (
                <AmbientMotion kind={pp.bgMotion} primary={primaryColor} secondary={secondaryColor} />
            )}

            {layoutType !== 'sidebar' && renderHeader()}

            <div className={`relative z-[1] flex-1 flex flex-col ${layoutType === 'sidebar' ? 'md:flex-row' : ''} min-h-[60vh]`}>
                
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
                            style={gap !== undefined ? { gap } : undefined}
                        >
                            {displayPhotos.map((photo, i) => (
                                <motion.div
                                    key={`${photo.id}-${i}`}
                                    onClick={() => setFullscreenIndex(i % photos.length)}
                                    className={`flex-shrink-0 relative aspect-[3/4] h-[50vh] md:h-[65vh] overflow-hidden group cursor-pointer ${currentTheme.card}`}
                                    style={{ ...cardStyle, ...(CAROUSEL_HEIGHT_VH[pp.photoSize] ? { height: `${CAROUSEL_HEIGHT_VH[pp.photoSize]}vh` } : {}) }}
                                    {...cardMotion(i, 10, { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 } })}
                                >
                                    <img
                                        src={photo.final_url || photo.thumb_url || photo.image_url}
                                        alt="Gallery Photo"
                                        className={`w-full h-full object-cover transition-transform duration-700 ${zoomOnHover ? 'group-hover:scale-110' : ''}`}
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
                        <div
                            className={`${minPhotoWidth ? '' : 'columns-2 md:columns-3 lg:columns-4 '}gap-6 max-w-7xl mx-auto px-6 py-10`}
                            style={{ ...(minPhotoWidth ? { columnWidth: minPhotoWidth } : {}), ...(gap !== undefined ? { columnGap: gap } : {}) }}
                        >
                            {photos.map((photo, i) => (
                                <motion.div
                                    key={photo.id}
                                    onClick={() => setFullscreenIndex(i)}
                                    className={`relative break-inside-avoid overflow-hidden group cursor-pointer ${currentTheme.card}`}
                                    style={{ ...cardStyle, marginBottom: gap ?? 24 }}
                                    {...cardMotion(i, 20, { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 } })}
                                >
                                    <img
                                        src={photo.final_url || photo.thumb_url || photo.image_url}
                                        alt="Gallery Photo"
                                        className={`w-full object-cover transition-all duration-700 ${zoomOnHover ? 'group-hover:scale-105' : ''}`}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-6">
                                        <Sparkles className="text-white" size={16} />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div
                            className={`grid ${minPhotoWidth ? '' : `grid-cols-1 md:grid-cols-2 ${layoutType === 'sidebar' ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`} gap-8 max-w-7xl mx-auto px-6 py-10 w-full`}
                            style={{
                                ...(minPhotoWidth ? { gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minPhotoWidth}px), 1fr))` } : {}),
                                ...(gap !== undefined ? { gap } : {}),
                            }}
                        >
                            {photos.map((photo, i) => (
                                <motion.div
                                    key={photo.id}
                                    onClick={() => setFullscreenIndex(i)}
                                    className={`relative aspect-square overflow-hidden group cursor-pointer ${currentTheme.card} ${i % 3 === 1 && !minPhotoWidth ? 'md:mt-12' : ''}`}
                                    style={cardStyle}
                                    {...cardMotion(i, 20, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } })}
                                >
                                    <img
                                        src={photo.final_url || photo.thumb_url || photo.image_url}
                                        alt="Gallery Photo"
                                        className={`w-full h-full object-cover transition-all duration-700 ${zoomOnHover ? 'group-hover:scale-110' : ''}`}
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

            {/* Lightbox: swipe, arrows or keys to move between photos */}
            <ImageViewer
                items={photos.map(p => ({ id: p.id, src: p.final_url || p.image_url, thumb: p.thumb_url }))}
                index={fullscreenIndex}
                onIndexChange={setFullscreenIndex}
                onClose={() => setFullscreenIndex(null)}
                loop
                actions={(item) => (
                    <button
                        onClick={() => {
                            const link = document.createElement('a');
                            link.href = item.src;
                            link.download = `snapwrap-${item.id}.jpg`;
                            link.click();
                        }}
                        className={viewerButtonPrimary}
                    >
                        <Download size={16} /> Download
                    </button>
                )}
            />

            {/* Footer */}
            <footer className="relative z-10 py-10 text-center opacity-30 text-[10px] font-black uppercase tracking-[0.3em]">
                Powered by SnapWrap
            </footer>
        </main>
        </MotionConfig>
    );
}
