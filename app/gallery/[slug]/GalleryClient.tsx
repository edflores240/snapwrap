'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { GALLERY_PAGE_SIZE as PAGE_SIZE, GALLERY_PHOTO_COLUMNS as PHOTO_COLUMNS } from '@/lib/gallery-queries';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { resolveEventTheme } from '@/lib/event-theme';
import ImageViewer, { viewerButton, viewerButtonPrimary } from '@/components/ui/ImageViewer';
import Link from 'next/link';
import { Download, Printer, Images, Lock } from 'lucide-react';

export interface Event {
    id: string;
    name: string;
    slug: string;
    date: string;
    config: any;
}

export interface Photo {
    id: string;
    image_url: string;
    thumb_url?: string | null;
    final_url: string;
    created_at: string;
}


interface Props {
    initialEvent: Event;
    initialPhotos: Photo[];
    initialTotal: number;
}

export default function GalleryClient({ initialEvent, initialPhotos, initialTotal }: Props) {
    const event = initialEvent;
    const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
    const [loadingMore, setLoadingMore] = useState(false);
    const totalPhotos = initialTotal;
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    const loadMore = async () => {
        if (loadingMore) return;
        setLoadingMore(true);
        try {
            const { data, error } = await supabase
                .from('photos')
                .select(PHOTO_COLUMNS)
                .eq('event_id', event.id)
                .eq('is_published', true)
                .order('created_at', { ascending: false })
                .range(photos.length, photos.length + PAGE_SIZE - 1);
            if (error) throw error;
            // Photos taken since the first load shift the offsets, so drop any repeats
            setPhotos(prev => {
                const seen = new Set(prev.map(p => p.id));
                return [...prev, ...((data as Photo[]) || []).filter(p => !seen.has(p.id))];
            });
        } catch (error) {
            console.error('Error loading more photos:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleDownload = async (url: string, id: string) => {
        setDownloadingId(id);
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `snapwrap-${id}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            window.open(url, '_blank');
        } finally {
            setDownloadingId(null);
        }
    };

    const executePrint = (url: string) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <html>
                <head>
                    <title>SnapWrap Print</title>
                    <style>
                        @page { margin: 0; size: 4in 6in; }
                        body { margin: 0; display: flex; align-items: center; justify-content: center; height: 6in; width: 4in; background: white; }
                        img { max-width: 100%; max-height: 100%; object-fit: contain; }
                    </style>
                </head>
                <body onload="window.print(); setTimeout(() => window.close(), 1000);">
                    <img src="${url}" />
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const { primary: themeColor, secondary: pageBg } = resolveEventTheme(event.config);

    return (
        <div className="min-h-screen" style={{ background: pageBg, color: themeColor }}>
            {/* Guest album link, when the guest camera is on */}
            {event.config?.guestCamera?.enabled && (() => {
                const opensAt = event.config.guestCamera.revealAt ? new Date(event.config.guestCamera.revealAt) : null;
                const open = !!opensAt && opensAt.getTime() <= Date.now();
                return (
                    <div className="max-w-7xl mx-auto px-8 pt-10 flex justify-center">
                        <Link
                            href={`/g/${event.slug}/album`}
                            className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                            style={{ border: `2px solid ${themeColor}`, color: themeColor }}
                        >
                            {open ? <Images size={16} /> : <Lock size={16} />}
                            {open ? 'Guest album' : opensAt ? `Guest album · opens ${opensAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Guest album · coming soon'}
                        </Link>
                    </div>
                );
            })()}

            {/* Gallery Grid - Start immediately with photos */}
            <main className="max-w-7xl mx-auto px-8 py-20 pb-40">
                {photos.length === 0 ? (
                    <div className="py-40 text-center space-y-4">
                        <div className="text-neutral-200 text-4xl font-black uppercase tracking-tighter">Empty Archive</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {photos.map((photo, i) => (
                            <motion.div
                                key={photo.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: (i % PAGE_SIZE) * 0.05 }}
                                whileHover={{ y: -8, boxShadow: `0 20px 40px -10px ${themeColor}22` }}
                                className="group relative aspect-[3/4.5] bg-black/5 rounded-lg overflow-hidden transition-all duration-500 cursor-zoom-in"
                                style={{ border: `1px solid ${themeColor}1a` }}
                                onClick={() => setPreviewIndex(i)}
                            >
                                <Image
                                    src={photo.final_url || photo.thumb_url || photo.image_url}
                                    alt="Capture"
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                                />
                                
                                {/* Public Controls - Icon Only */}
                                <div className="absolute inset-0 bg-neutral-900/60 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[2px] flex flex-col justify-end p-6">
                                    <div className="space-y-3 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); executePrint(photo.final_url || photo.image_url); }}
                                                className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-md transition-colors border border-white/20 flex items-center justify-center"
                                                title="Print"
                                            >
                                                <Printer size={16} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDownload(photo.final_url || photo.image_url, photo.id); }}
                                                disabled={downloadingId === photo.id}
                                                className="flex-1 bg-white text-neutral-900 py-3 rounded-md transition-colors flex items-center justify-center disabled:opacity-50"
                                                title="Download"
                                            >
                                                {downloadingId === photo.id ? (
                                                    <div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
                                                ) : (
                                                    <Download size={16} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {photos.length > 0 && photos.length < totalPhotos && (
                    <div className="mt-16 flex justify-center">
                        <button
                            onClick={loadMore}
                            disabled={loadingMore}
                            className="px-8 py-3 rounded-md text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-70 disabled:opacity-50"
                            style={{ border: `1.5px solid ${themeColor}55`, color: themeColor }}
                        >
                            {loadingMore ? 'Loading…' : `Load more (${totalPhotos - photos.length} left)`}
                        </button>
                    </div>
                )}
            </main>

            {/* Lightbox: swipe, arrows or keys to move between photos */}
            <ImageViewer
                items={photos.map(p => ({ id: p.id, src: p.final_url || p.image_url, thumb: p.thumb_url }))}
                index={previewIndex}
                onIndexChange={setPreviewIndex}
                onClose={() => setPreviewIndex(null)}
                onNearEnd={photos.length < totalPhotos ? loadMore : undefined}
                actions={(item) => (
                    <>
                        <button onClick={() => executePrint(item.src)} className={viewerButton}><Printer size={16} /> Print</button>
                        <button onClick={() => handleDownload(item.src, item.id)} disabled={downloadingId === item.id} className={viewerButtonPrimary}>
                            {downloadingId === item.id ? <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : <Download size={16} />} Download
                        </button>
                    </>
                )}
            />
        </div>
    );
}
