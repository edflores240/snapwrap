'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';

interface CameraFeedProps {
    onCapture: (imageDataUrl: string) => void;
    isActive: boolean;
}

export function CameraFeed({ onCapture, isActive }: CameraFeedProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Initialize camera
    useEffect(() => {
        if (!isActive) return;

        const startCamera = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        facingMode: 'user'
                    },
                    audio: false
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                    setStream(mediaStream);
                    setError(null);
                }
            } catch (err) {
                console.error('Camera access error:', err);
                setError('Could not access camera. Please grant camera permissions.');
            }
        };

        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [isActive]);

    // Countdown animation
    useEffect(() => {
        if (countdown === null || countdown === 0) return;

        const timer = setTimeout(() => {
            if (countdown > 1) {
                setCountdown(countdown - 1);
            } else {
                setCountdown(null);
                capturePhoto();
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [countdown]);

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get image as data URL
        const imageDataUrl = canvas.toDataURL('image/png');
        onCapture(imageDataUrl);
    };

    const handleCaptureClick = () => {
        setCountdown(3);
    };

    if (error) {
        return (
            <div className="glass rounded-3xl p-12 text-center">
                <div className="text-6xl mb-4">📷</div>
                <h3 className="text-2xl font-bold mb-4">Camera Access Required</h3>
                <p className="text-gray-400 mb-6">{error}</p>
                <Button onClick={() => window.location.reload()}>
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Video Preview */}
            <div className="relative rounded-3xl overflow-hidden border-glow animate-glow">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-auto block"
                />

                {/* Countdown Overlay */}
                {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="text-9xl font-black text-gradient animate-float">
                            {countdown}
                        </div>
                    </div>
                )}
            </div>

            {/* Capture Button */}
            <div className="mt-8 text-center">
                <Button
                    size="lg"
                    onClick={handleCaptureClick}
                    disabled={countdown !== null}
                >
                    {countdown !== null ? 'Capturing...' : '📸 Take Photo'}
                </Button>
            </div>

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
