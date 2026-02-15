'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { Button } from '@/components/ui/Button';
import { PhotoCompositor } from '@/components/editor/PhotoCompositor';
import { QRDisplay } from '@/components/qr/QRDisplay';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function PreviewPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen relative flex items-center justify-center">
                <GradientBackground />
                <div className="text-center">
                    <div className="text-6xl mb-4 animate-pulse">⏳</div>
                    <p className="text-gray-400">Loading...</p>
                </div>
            </main>
        }>
            <PreviewPageContent />
        </Suspense>
    );
}

function PreviewPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const capturedImage = searchParams.get('image');
    const templateId = searchParams.get('templateId');

    const [template, setTemplate] = useState<any>(null);
    const [composedImage, setComposedImage] = useState<string | null>(null);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [authChecking, setAuthChecking] = useState(true);

    // Auth guard: only admin can access preview
    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.replace('/admin/login');
                return;
            }
            setAuthChecking(false);
        })();
    }, [router]);

    useEffect(() => {
        if (!authChecking && templateId) {
            fetchTemplate();
        }
    }, [authChecking, templateId]);

    const fetchTemplate = async () => {
        try {
            const { data, error } = await supabase
                .from('templates')
                .select('*')
                .eq('id', templateId)
                .single();

            if (error) throw error;
            setTemplate(data);
        } catch (error) {
            console.error('Error fetching template:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleComposed = (dataUrl: string) => {
        setComposedImage(dataUrl);
    };

    const dataURLtoFile = (dataurl: string, filename: string): File => {
        let arr = dataurl.split(','),
            mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png',
            bstr = atob(arr[1]),
            n = bstr.length,
            u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    };

    const handleConfirm = async () => {
        if (!composedImage) return;

        setUploading(true);
        try {
            // 1. Convert Data URL to File
            const rawFile = dataURLtoFile(composedImage, `photo-${Date.now()}.png`);
            console.log(`Original size: ${(rawFile.size / 1024 / 1024).toFixed(2)} MB`);

            // 2. Compress using library
            const options = {
                maxSizeMB: 1,          // Limit to 1MB
                maxWidthOrHeight: 3840, // 4K Resolution limit (preserves high res)
                useWebWorker: true,
                fileType: 'image/jpeg', // Force JPEG for better compression
                initialQuality: 0.9,    // Start high
            };

            let compressedFile = rawFile;
            try {
                // Dynamic import to avoid SSR issues
                const imageCompression = (await import('browser-image-compression')).default;
                compressedFile = await imageCompression(rawFile, options);
                console.log(`Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
            } catch (error) {
                console.error('Compression failed, falling back to original:', error);
            }

            // Generate unique filename
            const filename = `photo-${Date.now()}.jpg`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('photos')
                .upload(filename, compressedFile, {
                    contentType: 'image/jpeg',
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('photos')
                .getPublicUrl(filename);

            const publicUrl = urlData.publicUrl;
            setUploadedUrl(publicUrl);

            // Create photo record in database
            const { data: photoData, error: photoError } = await supabase
                .from('photos')
                .insert({
                    final_url: publicUrl,
                    template_id: templateId,
                    qr_code_url: `${window.location.origin}/download/${filename}` // Fallback, usually ID based
                })
                .select()
                .single();

            if (photoError) throw photoError;

            // Set download URL for QR code
            const downloadLink = `${window.location.origin}/download/${photoData.id}`;
            setDownloadUrl(downloadLink);

        } catch (error) {
            console.error('Error uploading photo:', error);
            alert('Failed to upload photo. Please check your network connection.');
        } finally {
            setUploading(false);
        }
    };

    if (authChecking) {
        return (
            <main className="min-h-screen relative flex items-center justify-center">
                <GradientBackground />
                <div className="text-center">
                    <div className="text-6xl mb-4 animate-pulse">🔒</div>
                    <p className="text-gray-400">Verifying access...</p>
                </div>
            </main>
        );
    }

    if (!capturedImage || !templateId) {
        return (
            <main className="min-h-screen relative flex items-center justify-center">
                <GradientBackground />
                <div className="text-center">
                    <h2 className="text-3xl font-bold mb-4">Missing data</h2>
                    <Link href="/booth">
                        <Button>Start Over</Button>
                    </Link>
                </div>
            </main>
        );
    }

    if (loading) {
        return (
            <main className="min-h-screen relative flex items-center justify-center">
                <GradientBackground />
                <div className="text-center">
                    <div className="text-6xl mb-4 animate-pulse">⏳</div>
                    <p className="text-gray-400">Loading...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen relative">
            <GradientBackground />

            <div className="container mx-auto px-4 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-black mb-2">
                        <span className="text-gradient">Preview & Download</span>
                    </h1>
                    <p className="text-gray-400">
                        {downloadUrl ? 'Your photo is ready!' : 'Review your photo'}
                    </p>
                </div>

                <div className="max-w-3xl mx-auto">
                    {!downloadUrl ? (
                        <>
                            {/* Photo with Template */}
                            <div className="bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transform rotate-1 transition-transform hover:rotate-0 duration-300 mb-8 max-w-2xl mx-auto">
                                {template && (
                                    <PhotoCompositor
                                        photoDataUrl={capturedImage}
                                        overlayUrl={template.overlay_url}
                                        onComposed={handleComposed}
                                    />
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link href="/booth/templates">
                                    <Button variant="ghost">
                                        ← Change Template
                                    </Button>
                                </Link>
                                <Button
                                    variant="primary"
                                    size="lg"
                                    onClick={handleConfirm}
                                    disabled={!composedImage || uploading}
                                >
                                    {uploading ? 'Uploading...' : '✨ Generate QR Code'}
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* QR Code Display */}
                            <QRDisplay
                                downloadUrl={downloadUrl}
                                photoUrl={uploadedUrl || composedImage || ''}
                            />

                            {/* Start Over */}
                            <div className="text-center mt-12">
                                <Link href="/booth">
                                    <Button variant="primary" size="lg">
                                        📸 Take Another Photo
                                    </Button>
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
