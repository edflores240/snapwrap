'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Printer, X, Layout, Calendar, Clock, Camera } from 'lucide-react';

interface Event {
    id: string;
    name: string;
    slug: string;
    date: string;
    config: any;
}

interface Photo {
    id: string;
    image_url: string;
    final_url: string;
    created_at: string;
}

export default function PublicGallery() {
    const params = useParams();
    const [event, setEvent] = useState<Event | null>(null);
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    useEffect(() => {
        if (params.slug) {
            fetchGallery();
        }
    }, [params.slug]);

    const fetchGallery = async () => {
        try {
            // Fetch Event
            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .select('*')
                .eq('slug', params.slug)
                .single();

            if (eventError) throw eventError;
            setEvent(eventData);

            // Fetch Published Photos
            const { data: photosData, error: photosError } = await supabase
                .from('photos')
                .select('*')
                .eq('event_id', eventData.id)
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            if (photosError) throw photosError;
            setPhotos(photosData || []);

        } catch (error) {
            console.error('Error fetching gallery:', error);
        } finally {
            setLoading(false);
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

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F7F7F5] flex flex-col items-center justify-center gap-4">
                <div className="w-6 h-6 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Opening Archive...</p>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-[#F7F7F5] flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="text-6xl font-black text-neutral-200 uppercase tracking-tighter">404</div>
                <h1 className="text-xl font-black text-neutral-900 uppercase tracking-widest">Archive Not Found</h1>
                <p className="text-sm text-neutral-400 font-medium max-w-xs">The requested collection does not exist or has been removed from the repository.</p>
            </div>
        );
    }

    const themeColor = event.config?.boothSettings?.themeColor || '#171717';

    return (
        <div className="min-h-screen bg-[#F7F7F5] selection:bg-neutral-900 selection:text-white">
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
                                transition={{ delay: i * 0.05 }}
                                whileHover={{ y: -8, boxShadow: `0 20px 40px -10px ${themeColor}22` }}
                                className="group relative aspect-[3/4.5] bg-white rounded-lg overflow-hidden border border-neutral-100 transition-all duration-500 cursor-zoom-in"
                                onDoubleClick={() => setPreviewPhoto(photo.final_url || photo.image_url)}
                            >
                                <Image
                                    src={photo.final_url || photo.image_url}
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
            </main>

            {/* Lightbox - Icon Only Controls */}
            <AnimatePresence>
                {previewPhoto && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setPreviewPhoto(null)}
                        className="fixed inset-0 z-[200] bg-neutral-900/95 backdrop-blur-xl flex items-center justify-center p-8 md:p-20 cursor-zoom-out"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full h-full max-w-5xl flex flex-col items-center justify-center gap-6"
                        >
                            <div className="relative w-full flex-1">
                                <Image
                                    src={previewPhoto}
                                    alt="Preview"
                                    fill
                                    className="object-contain"
                                    quality={100}
                                    unoptimized
                                />
                            </div>
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => executePrint(previewPhoto)}
                                    className="bg-white/10 hover:bg-white text-white hover:text-neutral-900 w-14 h-14 rounded-full transition-all backdrop-blur-md flex items-center justify-center"
                                    title="Print"
                                >
                                    <Printer size={20} />
                                </button>
                                <button 
                                    onClick={() => handleDownload(previewPhoto, 'preview')}
                                    disabled={downloadingId === 'preview'}
                                    className="bg-white/10 hover:bg-white text-white hover:text-neutral-900 w-14 h-14 rounded-full transition-all backdrop-blur-md flex items-center justify-center disabled:opacity-50"
                                    title="Download"
                                >
                                    {downloadingId === 'preview' ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Download size={20} />
                                    )}
                                </button>
                                <button 
                                    onClick={() => setPreviewPhoto(null)}
                                    className="bg-white text-neutral-900 w-14 h-14 rounded-full hover:scale-105 transition-all flex items-center justify-center"
                                    title="Close"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
