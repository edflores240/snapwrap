'use client';

import React, { useEffect, useState } from 'react';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Photo {
    id: string;
    final_url: string;
    image_url: string;
    created_at: string;
}

export default function GalleryPage() {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        fetchPhotos();
    }, []);

    const fetchPhotos = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('photos')
                .select('id, final_url, image_url, created_at')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setPhotos(data || []);
        } catch (error) {
            console.error('Error fetching photos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (photo: Photo) => {
        if (!confirm('Delete this photo permanently? This cannot be undone.')) return;
        setDeleting(photo.id);
        try {
            // Try to delete from storage if final_url contains storage path
            const url = photo.final_url || photo.image_url;
            if (url) {
                const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
                if (match) {
                    await supabase.storage.from(match[1]).remove([match[2]]);
                }
            }
            // Delete DB row
            const { error } = await supabase.from('photos').delete().eq('id', photo.id);
            if (error) throw error;
            setPhotos(prev => prev.filter(p => p.id !== photo.id));
        } catch (error) {
            console.error('Error deleting photo:', error);
            alert('Failed to delete photo.');
        } finally {
            setDeleting(null);
        }
    };

    return (
        <main className="min-h-screen relative">
            <GradientBackground />

            <div className="container mx-auto px-4 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <Link href="/">
                        <h1 className="text-5xl font-black mb-2 cursor-pointer hover:scale-105 transition-transform inline-block">
                            <span className="text-gradient">SnapWrap Gallery</span>
                        </h1>
                    </Link>
                    <p className="text-gray-400 mb-6">Recent photos from the booth</p>

                    {/* Reload Button */}
                    <button
                        onClick={fetchPhotos}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                        <span className={loading ? 'animate-spin' : ''}>🔄</span>
                        {loading ? 'Refreshing...' : 'Reload'}
                    </button>
                </div>

                {loading && photos.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4 animate-pulse">📸</div>
                        <p className="text-gray-400">Loading gallery...</p>
                    </div>
                ) : photos.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">🖼️</div>
                        <h3 className="text-2xl font-bold mb-4">No Photos Yet</h3>
                        <p className="text-gray-400 mb-8">
                            Be the first to capture a memory!
                        </p>
                        <Link href="/booth">
                            <Button variant="primary" size="lg">
                                📸 Take a Photo
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Photo Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12">
                            {photos.map((photo) => (
                                <Card key={photo.id} className="p-0 overflow-hidden group relative">
                                    <Link href={`/download/${photo.id}`}>
                                        <div className="aspect-square overflow-hidden">
                                            <img
                                                src={photo.final_url || photo.image_url}
                                                alt="Gallery photo"
                                                className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                                            />
                                        </div>
                                    </Link>
                                    {/* Delete Button */}
                                    <button
                                        onClick={() => handleDelete(photo)}
                                        disabled={deleting === photo.id}
                                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-sm backdrop-blur-sm"
                                        title="Delete photo"
                                    >
                                        {deleting === photo.id ? '⏳' : '🗑'}
                                    </button>
                                </Card>
                            ))}
                        </div>

                        {/* CTA */}
                        <div className="text-center">
                            <Link href="/booth">
                                <Button variant="primary" size="lg">
                                    📸 Take Your Own Photo
                                </Button>
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
