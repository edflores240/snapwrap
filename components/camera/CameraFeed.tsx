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

    // Camera Selection State
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

    // 1. List Cameras
    useEffect(() => {
        const getDevices = async () => {
            try {
                // Request permission first to get labels
                await navigator.mediaDevices.getUserMedia({ video: true });
                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
                setDevices(videoDevices);

                // Load saved preference or default
                const savedId = localStorage.getItem('cameraInfo.deviceId');
                if (savedId && videoDevices.find(d => d.deviceId === savedId)) {
                    setSelectedDeviceId(savedId);
                } else if (videoDevices.length > 0) {
                    setSelectedDeviceId(videoDevices[0].deviceId);
                }
            } catch (err) {
                console.error('Error listing devices:', err);
            }
        };
        getDevices();
    }, []);

    // 2. Start Camera when active or selection changes
    useEffect(() => {
        if (!isActive || !selectedDeviceId) return;

        let currentStream: MediaStream | null = null;

        const startCamera = async () => {
            try {
                // Stop previous stream
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }

                currentStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: { exact: selectedDeviceId },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    },
                    audio: false
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = currentStream;
                    setStream(currentStream);
                    setError(null);
                }
            } catch (err) {
                console.error('Camera access error:', err);
                setError('Could not access selected camera.');
            }
        };

        startCamera();

        return () => {
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [isActive, selectedDeviceId]);

    // Countdown animation
    useEffect(() => {
        if (countdown === null || countdown === 0) return;

        const timer = setTimeout(() => {
            setCountdown(prev => (prev !== null && prev > 1 ? prev - 1 : null));
            if (countdown === 1) capturePhoto();
        }, 1000);

        return () => clearTimeout(timer);
    }, [countdown]);

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        onCapture(canvas.toDataURL('image/png'));
    };

    const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value;
        setSelectedDeviceId(newId);
        localStorage.setItem('cameraInfo.deviceId', newId);
    };

    if (error) {
        return (
            <div className="glass rounded-3xl p-12 text-center">
                <div className="text-6xl mb-4">📷</div>
                <h3 className="text-2xl font-bold mb-4">Camera Error</h3>
                <p className="text-gray-400 mb-6">{error}</p>
                <div className="flex gap-4 justify-center">
                    <Button onClick={() => window.location.reload()}>Reload</Button>
                    <select
                        className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
                        value={selectedDeviceId}
                        onChange={handleDeviceChange}
                    >
                        {devices.map(d => (
                            <option key={d.deviceId} value={d.deviceId}>
                                {d.label || `Camera ${d.deviceId.slice(0, 5)}...`}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        );
    }

    return (
        <div className="relative group">
            {/* Video Preview */}
            <div className="relative rounded-3xl overflow-hidden border-glow animate-glow shadow-2xl bg-black">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-auto block transform scale-x-[-1]" // Mirror effect usually preferred
                />

                {/* Countdown Overlay */}
                {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20">
                        <div className="text-[15rem] font-black text-white drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)] animate-bounce">
                            {countdown}
                        </div>
                    </div>
                )}

                {/* Camera Switcher (Always visible in Mirror Mode) */}
                {!countdown && (
                    <div className="absolute top-4 right-4 z-10 transition-opacity">
                        <select
                            className="bg-black/50 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-sm text-white focus:outline-none hover:bg-black/70 cursor-pointer appearance-none text-center"
                            value={selectedDeviceId}
                            onChange={handleDeviceChange}
                            title="Switch Camera"
                        >
                            {devices.map((d, i) => (
                                <option key={d.deviceId} value={d.deviceId} className="bg-gray-900">
                                    {d.label || `Camera ${i + 1}`}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Capture Button */}
            <div className="mt-8 text-center bg-transparent">
                <Button
                    size="lg"
                    onClick={() => setCountdown(3)}
                    disabled={countdown !== null}
                    className="h-24 px-12 rounded-full flex items-center gap-4 bg-white hover:bg-gray-200 text-black border-4 border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all hover:scale-105 active:scale-95 mx-auto"
                >
                    <span className="text-4xl">✨</span>
                    <span className="text-xl font-bold tracking-wider">I'M READY!</span>
                </Button>
                <p className="mt-4 text-gray-400 text-sm">Check your look & select camera above</p>
            </div>

            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
