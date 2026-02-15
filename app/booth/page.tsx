'use client';

import React, { useState } from 'react';
import { CameraFeed } from '@/components/camera/CameraFeed';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function BoothPage() {
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [step, setStep] = useState<'camera' | 'preview'>('camera');

    const handleCapture = (imageDataUrl: string) => {
        setCapturedImage(imageDataUrl);
        setStep('preview');
    };

    const handleRetake = () => {
        setCapturedImage(null);
        setStep('camera');
    };

    return (
        <main className="min-h-screen relative">
            <GradientBackground />

            <div className="container mx-auto px-4 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <Link href="/">
                        <h1 className="text-5xl font-black mb-2 cursor-pointer hover:scale-105 transition-transform inline-block">
                            <span className="text-gradient">SnapWrap</span>
                        </h1>
                    </Link>
                    <p className="text-gray-400">
                        {step === 'camera' ? 'Position yourself and click to capture' : 'Preview your photo'}
                    </p>
                </div>

                <div className="max-w-4xl mx-auto">
                    {step === 'camera' ? (
                        <CameraFeed onCapture={handleCapture} isActive={true} />
                    ) : (
                        <div className="space-y-8">
                            {/* Preview */}
                            <div className="glass rounded-3xl p-4">
                                <img
                                    src={capturedImage || ''}
                                    alt="Captured photo"
                                    className="w-full h-auto rounded-2xl"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button variant="ghost" onClick={handleRetake}>
                                    ↺ Retake Photo
                                </Button>
                                <Link href={`/booth/templates?image=${encodeURIComponent(capturedImage || '')}`}>
                                    <Button variant="primary" size="lg">
                                        🎨 Choose Template →
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* Back Button */}
                <div className="text-center mt-12">
                    <Link href="/">
                        <Button variant="ghost" size="sm">
                            ← Back to Home
                        </Button>
                    </Link>
                </div>
            </div>
        </main>
    );
}
