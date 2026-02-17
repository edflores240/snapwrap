'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TemplateConfig, PRESET_TEMPLATES } from '@/components/templates/TemplateDesigner';
import TemplatePreview from '@/components/templates/TemplatePreview';
import QRCode from 'react-qr-code';

interface Event {
    id: string;
    name: string;
    slug: string;
    date: string;
    description: string;
    is_active: boolean;
    config: any;
}

type BoothStep = 'welcome' | 'select-template' | 'mirror' | 'capture' | 'review' | 'qr' | 'done';

interface BoothSettings {
    welcomeMessage: string;
    countdownSeconds: number;
    autoSnap: boolean;
    themeColor: string;
}

const DEFAULT_BOOTH_SETTINGS: BoothSettings = {
    welcomeMessage: '',
    countdownSeconds: 3,
    autoSnap: true,
    themeColor: '#6366f1',
};

// Helper to derive lighter/darker shades from a hex color
function hexToHSL(hex: string): { h: number; s: number; l: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export default function PublicBoothPage() {
    const params = useParams();
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState<TemplateConfig[]>([]);
    const [boothSettings, setBoothSettings] = useState<BoothSettings>(DEFAULT_BOOTH_SETTINGS);

    // Booth flow state
    const [step, setStep] = useState<BoothStep>('welcome');
    const [selectedTemplate, setSelectedTemplate] = useState<TemplateConfig | null>(null);
    const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
    const [currentSlotIndex, setCurrentSlotIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'full' | 'zoomed'>('full');
    const [countdown, setCountdown] = useState<number | null>(null);
    const [flashActive, setFlashActive] = useState(false);
    const [isAutoSnapping, setIsAutoSnapping] = useState(false);
    const [betweenShots, setBetweenShots] = useState(false);

    // QR / Upload state
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [uploadingComposite, setUploadingComposite] = useState(false);

    // Camera
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const autoSnapRef = useRef(false);
    const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

    const clearTimeouts = useCallback(() => {
        timeoutsRef.current.forEach(clearTimeout);
        timeoutsRef.current = [];
    }, []);

    const wait = useCallback((ms: number) => {
        return new Promise<void>((resolve) => {
            const id = setTimeout(() => {
                resolve();
                timeoutsRef.current = timeoutsRef.current.filter(t => t !== id);
            }, ms);
            timeoutsRef.current.push(id);
        });
    }, []);

    // Derived theme values
    const tc = boothSettings.themeColor || '#6366f1';
    const hsl = hexToHSL(tc);
    const themeGradient = `linear-gradient(135deg, ${tc}, hsl(${(hsl.h + 30) % 360}, ${hsl.s}%, ${hsl.l}%))`;
    const themeShadow = `0 10px 40px ${tc}40`;
    const themeBgSubtle = `linear-gradient(135deg, hsl(${hsl.h}, ${hsl.s}%, 8%) 0%, #030712 50%, hsl(${(hsl.h + 30) % 360}, ${Math.max(hsl.s - 20, 10)}%, 10%) 100%)`;

    // Camera Selection State
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

    // Load Devices
    useEffect(() => {
        const getDevices = async () => {
            try {
                await navigator.mediaDevices.getUserMedia({ video: true }); // Request permission
                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
                setDevices(videoDevices);

                // Load saved or default
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

    const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value;
        setSelectedDeviceId(newId);
        localStorage.setItem('cameraInfo.deviceId', newId);
    };

    useEffect(() => {
        if (params.slug) fetchEvent();
        return () => {
            stopCamera();
            clearTimeouts();
        };
    }, [params.slug]);

    const fetchEvent = async () => {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('slug', params.slug)
                .eq('is_active', true)
                .single();
            if (error) throw error;
            setEvent(data);

            // Load booth settings from config
            if (data.config?.boothSettings) {
                setBoothSettings(prev => ({ ...prev, ...data.config.boothSettings }));
            }

            // Load templates: event config → localStorage → preset fallback
            if (data.config?.templates && data.config.templates.length > 0) {
                setTemplates(data.config.templates);
            } else {
                const stored = localStorage.getItem(`templates_${data.id}`);
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        if (parsed.length > 0) { setTemplates(parsed); return; }
                    } catch { }
                }
                // Fallback: use the 12 creative preset templates
                setTemplates(PRESET_TEMPLATES.map(p => ({ ...p, id: `preset_${p.name.replace(/\s+/g, '_').toLowerCase()}` })));
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    // ── Camera ─────────────────────────────────────────────────────────

    const startCamera = async () => {
        try {
            stopCamera(); // Ensure previous stream stops

            const constraints: MediaStreamConstraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                    facingMode: selectedDeviceId ? undefined : 'user'
                },
                audio: false,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error('Camera error:', err);
            alert('Could not access camera. Please allow camera permissions.');
        }
    };

    // Restart camera when device changes
    useEffect(() => {
        if ((step === 'mirror' || step === 'capture') && selectedDeviceId) {
            startCamera();
        }
    }, [selectedDeviceId]);

    // Re-attach stream when step changes (because video element remounts)
    useEffect(() => {
        if ((step === 'mirror' || step === 'capture') && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [step]);

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    };

    // Callback ref to ensure video stream is attached instantly on mount/remount
    const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
        videoRef.current = node;
        if (node && streamRef.current) {
            node.srcObject = streamRef.current;
            node.play().catch(() => { }); // Ensure play
        }
    }, []);

    const takePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !selectedTemplate) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;

        // 1. Calculate the Target Aspect Ratio (from Template Slot Grid)
        // Assuming uniform grid:
        const rows = selectedTemplate.layout.rows;
        const cols = selectedTemplate.layout.cols;
        const gap = selectedTemplate.gap;
        const pad = selectedTemplate.padding;

        // Calculate cell aspect ratio based on reference width (420)
        // (Similar logic to render)
        const refW = 420;
        const refH = refW * (rows > cols ? 4 / 3 : 3 / 4);
        const padPctX = (pad / refW) * 100;
        const gapPctX = (gap / refW) * 100;
        const gridW = 100 - (padPctX * 2);
        const cellW = (gridW - (gapPctX * (cols - 1))) / cols;

        const padPctY = (pad / refH) * 100;
        const gapPctY = (gap / refH) * 100;
        const gridH = 100 - (padPctY * 2);
        const cellH = (gridH - (gapPctY * (rows - 1))) / rows;

        // Convert % back to Ratio: (cellW * refW) / (cellH * refH)
        // Or simpler: cellW % of refW / cellH % of refH
        // Ratio = (cellW/100 * refW) / (cellH/100 * refH)
        const slotWidth = (cellW / 100) * refW;
        const slotHeight = (cellH / 100) * refH;

        const targetRatio = slotWidth / slotHeight;

        // 2. Video Source Ratio
        const videoRatio = video.videoWidth / video.videoHeight;

        let sx = 0, sy = 0, sWidth = video.videoWidth, sHeight = video.videoHeight;

        // 3. Crop (Cover Logic)
        if (videoRatio > targetRatio) {
            // Video wider than slot
            sWidth = video.videoHeight * targetRatio;
            sx = (video.videoWidth - sWidth) / 2;
        } else {
            // Video tall/narrower than slot
            sHeight = video.videoWidth / targetRatio;
            sy = (video.videoHeight - sHeight) / 2;
        }

        canvas.width = sWidth;
        canvas.height = sHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.95);
    }, [selectedTemplate]);

    // ── Auto-Snap Flow ────────────────────────────────────────────────

    const runAutoSnap = useCallback(async (template: TemplateConfig) => {
        setIsAutoSnapping(true);
        autoSnapRef.current = true;
        const photos: string[] = [];

        // Initial delay to show full template
        setViewMode('full');
        await wait(1000);

        for (let i = 0; i < template.slots.length; i++) {
            if (!autoSnapRef.current) break;

            setCurrentSlotIndex(i);

            // Zoom in
            setViewMode('zoomed');
            await wait(1200); // Wait for zoom transition

            // Countdown using settings
            const cdSeconds = boothSettings.countdownSeconds || 3;
            for (let c = cdSeconds; c > 0; c--) {
                if (!autoSnapRef.current) break;
                setCountdown(c);
                await wait(1000);
            }
            setCountdown(null);

            if (!autoSnapRef.current) break;

            // Flash + capture
            setFlashActive(true);
            await wait(150);
            const photo = takePhoto();
            setFlashActive(false);

            if (photo) {
                photos.push(photo);
                setCapturedPhotos([...photos]);
            }

            // Brief pause to show captured photo in slot
            await wait(500);
        }

        if (autoSnapRef.current && photos.length === template.slots.length) {
            setViewMode('full');
            await wait(500);
            // All photos captured — go to review
            setStep('review');
            stopCamera();
        }

        setIsAutoSnapping(false);
        setCountdown(null);
        setViewMode('full');
    }, [takePhoto, boothSettings.countdownSeconds, wait]);

    // ── Step Handlers ──────────────────────────────────────────────────

    const handleSelectTemplate = async (tpl: TemplateConfig) => {
        setSelectedTemplate(tpl);
        setCapturedPhotos([]);
        setCurrentSlotIndex(0);

        // Go to Mirror Step first!
        setStep('mirror');
        await startCamera();
    };

    const handleMirrorReady = () => {
        setStep('capture');
        // Auto-snap if enabled, otherwise wait for manual capture
        if (boothSettings.autoSnap !== false && selectedTemplate) {
            setTimeout(() => {
                runAutoSnap(selectedTemplate);
            }, 500);
        }
    };

    // Manual snap: take one photo at a time
    const handleManualSnap = () => {
        if (!selectedTemplate) return;
        setFlashActive(true);
        setTimeout(() => {
            const photo = takePhoto();
            setFlashActive(false);
            if (photo) {
                const updated = [...capturedPhotos, photo];
                setCapturedPhotos(updated);
                setCurrentSlotIndex(updated.length);
                if (updated.length === selectedTemplate.slots.length) {
                    setStep('review');
                    stopCamera();
                }
            }
        }, 150);
    };

    const handleRetake = async () => {
        autoSnapRef.current = false;
        clearTimeouts();
        setIsAutoSnapping(false);
        setCapturedPhotos([]);
        setCurrentSlotIndex(0);
        setDownloadUrl(null);
        setStep('capture');
        await startCamera();
        if (selectedTemplate && boothSettings.autoSnap !== false) {
            setTimeout(() => {
                runAutoSnap(selectedTemplate);
            }, 1000);
        }
    };

    // ── Generate Composite + Upload + QR ───────────────────────────────

    const handleConfirmAndGenerateQR = async () => {
        if (!selectedTemplate || !event) return;
        setUploadingComposite(true);

        try {
            const compositeDataUrl = await generateComposite();
            if (!compositeDataUrl) throw new Error('Failed to generate composite');

            // Convert data URL → Blob
            const res = await fetch(compositeDataUrl);
            const blob = await res.blob();

            const fileName = `${event.slug}/${Date.now()}.jpg`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('booth-photos')
                .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                // Fallback: use data URL directly
                handleFallbackDownload(compositeDataUrl);
                return;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('booth-photos')
                .getPublicUrl(fileName);

            const publicUrl = urlData.publicUrl;

            // Insert record into photos table
            const { data: photoRecord, error: insertError } = await supabase
                .from('photos')
                .insert({
                    event_id: event.id,
                    storage_path: fileName,
                    image_url: publicUrl,
                })
                .select('id')
                .single();

            if (insertError) {
                console.error('Insert error:', insertError);
                handleFallbackDownload(compositeDataUrl);
                return;
            }

            // Build download page URL
            const baseUrl = window.location.origin;
            setDownloadUrl(`${baseUrl}/download/${photoRecord.id}`);
            setStep('qr');
        } catch (err) {
            console.error('Error generating QR:', err);
            // Fallback: just download locally
            const compositeDataUrl = await generateComposite();
            if (compositeDataUrl) handleFallbackDownload(compositeDataUrl);
        } finally {
            setUploadingComposite(false);
        }
    };

    const handleFallbackDownload = (dataUrl: string) => {
        const link = document.createElement('a');
        link.download = `snapwrap-${Date.now()}.jpg`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setStep('done');
    };

    const generateComposite = async (): Promise<string | null> => {
        if (!selectedTemplate) { return null; }

        const compositeCanvas = document.createElement('canvas');
        const SCALE = 3;
        const W = 420 * SCALE;
        const PAD = selectedTemplate.padding * SCALE;
        const GAP = selectedTemplate.gap * SCALE;
        const BORDER_R = selectedTemplate.borderRadius * SCALE;

        const cols = selectedTemplate.layout.cols;
        const rows = selectedTemplate.layout.rows;
        const gridW = W - PAD * 2;
        const slotW = (gridW - GAP * (cols - 1)) / cols;
        const aspectRatio = rows > cols ? 4 / 3 : 3 / 4;
        const slotH = slotW / aspectRatio;
        const gridH = slotH * rows + GAP * (rows - 1);
        const H = gridH + PAD * 2 + 60 * SCALE;

        compositeCanvas.width = W;
        compositeCanvas.height = H;
        const ctx = compositeCanvas.getContext('2d');
        if (!ctx) { return null; }

        // Rounded rect clip for entire canvas
        ctx.beginPath();
        ctx.roundRect(0, 0, W, H, BORDER_R);
        ctx.clip();

        // Background
        const bg = selectedTemplate.background;
        if (bg.startsWith('linear-gradient')) {
            // Parse gradient
            const gradientMatch = bg.match(/linear-gradient\(([^,]+),\s*(.+)\)/);
            if (gradientMatch) {
                const colors = gradientMatch[2].split(/,\s*(?=#|rgba?|[a-z])/).map(c => {
                    const parts = c.trim().split(/\s+/);
                    return { color: parts[0], stop: parseInt(parts[1]) / 100 || 0 };
                });
                const grad = ctx.createLinearGradient(0, 0, W * 0.5, H);
                colors.forEach(c => grad.addColorStop(c.stop, c.color));
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = '#ffffff';
            }
        } else {
            ctx.fillStyle = bg || '#ffffff';
        }
        ctx.fillRect(0, 0, W, H);

        // Background Image (if set, draw on top of the solid/gradient fill)
        const drawBgImage = (): Promise<void> => {
            return new Promise((res) => {
                if (selectedTemplate.backgroundImage) {
                    const bgImg = new Image();
                    bgImg.crossOrigin = 'anonymous';
                    bgImg.onload = () => {
                        // Cover fill: scale to fill entire canvas
                        const imgAspect = bgImg.width / bgImg.height;
                        const canvasAspect = W / H;
                        let sx = 0, sy = 0, sw = bgImg.width, sh = bgImg.height;
                        if (imgAspect > canvasAspect) {
                            sw = bgImg.height * canvasAspect;
                            sx = (bgImg.width - sw) / 2;
                        } else {
                            sh = bgImg.width / canvasAspect;
                            sy = (bgImg.height - sh) / 2;
                        }
                        ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, W, H);
                        res();
                    };
                    bgImg.onerror = () => res(); // Fallback: just keep the solid/gradient bg
                    bgImg.src = selectedTemplate.backgroundImage;
                } else {
                    res();
                }
            });
        };

        await drawBgImage();

        // Border
        if (selectedTemplate.borderWidth) {
            ctx.strokeStyle = selectedTemplate.borderColor;
            ctx.lineWidth = selectedTemplate.borderWidth * SCALE;
            ctx.beginPath();
            ctx.roundRect(0, 0, W, H, BORDER_R);
            ctx.stroke();
        }

        // Draw photos
        const drawPromises = capturedPhotos.map((photoSrc, i) => {
            return new Promise<void>((res) => {
                const img = new Image();
                img.onload = () => {
                    const row = Math.floor(i / cols);
                    const col = i % cols;
                    const x = PAD + col * (slotW + GAP);
                    const y = PAD + 30 * SCALE + row * (slotH + GAP);
                    const r = Math.max(BORDER_R - PAD / 2, 4);

                    ctx.save();
                    ctx.beginPath();
                    ctx.roundRect(x, y, slotW, slotH, r);
                    ctx.clip();

                    // Cover fill
                    const imgAspect = img.width / img.height;
                    const slotAspect = slotW / slotH;
                    let sx = 0, sy = 0, sw = img.width, sh = img.height;
                    if (imgAspect > slotAspect) {
                        sw = img.height * slotAspect;
                        sx = (img.width - sw) / 2;
                    } else {
                        sh = img.width / slotAspect;
                        sy = (img.height - sh) / 2;
                    }
                    ctx.drawImage(img, sx, sy, sw, sh, x, y, slotW, slotH);
                    ctx.restore();
                    res();
                };
                img.onerror = () => res();
                img.src = photoSrc;
            });
        });

        await Promise.all(drawPromises);

        // Text elements
        selectedTemplate.textElements.forEach((el) => {
            ctx.save();
            ctx.font = `${el.fontStyle === 'italic' ? 'italic ' : ''}${el.fontWeight} ${el.fontSize * SCALE}px ${el.fontFamily}`;
            ctx.fillStyle = el.color;
            ctx.globalAlpha = el.opacity;
            ctx.textAlign = 'center';
            const tx = (el.x / 100) * W;
            const ty = (el.y / 100) * H;
            ctx.translate(tx, ty);
            ctx.rotate((el.rotation * Math.PI) / 180);
            if (el.letterSpacing) {
                ctx.letterSpacing = `${el.letterSpacing * SCALE}px`;
            }
            ctx.fillText(el.text, 0, 0);
            ctx.restore();
        });

        // Stickers
        const stickerPromises = (selectedTemplate.stickers || []).map((stk) => {
            return new Promise<void>((res) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    ctx.save();
                    const tx = (stk.x / 100) * W;
                    const ty = (stk.y / 100) * H;
                    ctx.translate(tx, ty);
                    ctx.rotate((stk.rotation * Math.PI) / 180);
                    const w = stk.width * SCALE;
                    const h = (img.height / img.width) * w;
                    ctx.drawImage(img, -w / 2, -h / 2, w, h);
                    ctx.restore();
                    res();
                };
                img.onerror = () => res();
                img.src = stk.src;
            });
        });

        await Promise.all(stickerPromises);

        // Watermark
        if (selectedTemplate.watermarkText) {
            ctx.font = `400 ${10 * SCALE}px sans-serif`;
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.textAlign = 'center';
            ctx.fillText(selectedTemplate.watermarkText.toUpperCase(), W / 2, H - 10 * SCALE);
        }

        return compositeCanvas.toDataURL('image/jpeg', 0.92);
    };

    // ── Loading / Error ──────────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Loading event...</p>
                </div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
                <div className="text-center max-w-md px-6">
                    <div className="text-6xl mb-4">😕</div>
                    <h1 className="text-2xl font-bold mb-2">Event Not Found</h1>
                    <p className="text-gray-400">This event may have ended or the link is incorrect.</p>
                </div>
            </div>
        );
    }

    // ── Render ────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gray-950 text-white relative overflow-hidden">
            {/* Subtle gradient bg */}
            <div className="fixed inset-0 pointer-events-none" style={{ background: themeBgSubtle }} />

            {/* Flash effect */}
            {flashActive && (
                <div className="fixed inset-0 z-50 bg-white pointer-events-none" style={{ animation: 'flash 0.3s ease-out' }} />
            )}

            <canvas ref={canvasRef} className="hidden" />

            <style jsx>{`
                @keyframes flash {
                    0% { opacity: 1; }
                    100% { opacity: 0; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes countPulse {
                    0% { transform: scale(0.5); opacity: 0; }
                    50% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes qrGlow {
                    0%, 100% { box-shadow: 0 0 20px ${tc}50; }
                    50% { box-shadow: 0 0 40px ${tc}90; }
                }
                .animate-slideUp { animation: slideUp 0.6s ease-out; }
                .animate-countPulse { animation: countPulse 0.8s ease-out; }
                .animate-qrGlow { animation: qrGlow 2s ease-in-out infinite; }
            `}</style>

            <div className="relative z-10 min-h-screen flex flex-col">
                {/* ── STEP: Welcome ─────────────────────────────────────── */}
                {step === 'welcome' && (
                    <div className="flex-1 flex items-center justify-center px-6 animate-slideUp">
                        <div className="text-center max-w-2xl">
                            <div className="text-7xl mb-6">📸</div>
                            <h1
                                className="text-5xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent"
                                style={{ backgroundImage: themeGradient }}
                            >
                                {event.name}
                            </h1>
                            {boothSettings.welcomeMessage && (
                                <p className="text-2xl text-gray-300 mb-4 font-medium">
                                    {boothSettings.welcomeMessage}
                                </p>
                            )}
                            <p className="text-xl text-gray-400 mb-2">
                                {new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            {event.description && (
                                <p className="text-gray-500 mb-8 max-w-md mx-auto">{event.description}</p>
                            )}

                            <button
                                onClick={() => setStep(templates.length > 0 ? 'select-template' : 'capture')}
                                className="px-12 py-5 text-xl font-bold rounded-2xl text-white shadow-xl transition-all hover:scale-105 active:scale-95"
                                style={{ background: themeGradient, boxShadow: themeShadow }}
                            >
                                Start Photo Booth →
                            </button>

                            <div className="mt-16 grid grid-cols-3 gap-8 text-center max-w-lg mx-auto">
                                <div>
                                    <div className="text-3xl mb-2">🎨</div>
                                    <p className="text-sm text-gray-500">Pick a template</p>
                                </div>
                                <div>
                                    <div className="text-3xl mb-2">📸</div>
                                    <p className="text-sm text-gray-500">{boothSettings.autoSnap !== false ? 'Auto-snap photos' : 'Take photos'}</p>
                                </div>
                                <div>
                                    <div className="text-3xl mb-2">📱</div>
                                    <p className="text-sm text-gray-500">Scan QR to download</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── STEP: Select Template ─────────────────────────────── */}
                {step === 'select-template' && (
                    <div className="flex-1 flex flex-col px-6 py-12 animate-slideUp">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl font-bold mb-2">Choose Your Layout</h2>
                            <p className="text-gray-400">Pick a template for your photos</p>
                        </div>

                        <div className="flex-1 flex items-center justify-center">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-5xl">
                                {templates.map((tpl) => (
                                    <button
                                        key={tpl.id}
                                        onClick={() => handleSelectTemplate(tpl)}
                                        className="group p-4 rounded-2xl border-2 border-white/10 bg-white/5 hover:bg-white/10 transition-all hover:scale-105 active:scale-95"
                                        style={{ '--hover-border': `${tc}80` } as any}
                                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${tc}80`)}
                                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                                    >
                                        <div className="flex justify-center mb-3">
                                            <TemplatePreview template={tpl} width={140} />
                                        </div>
                                        <p className="font-semibold text-sm text-white">{tpl.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {tpl.slots.length} photo{tpl.slots.length !== 1 ? 's' : ''}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="text-center mt-8">
                            <button onClick={() => setStep('welcome')} className="text-gray-500 hover:text-white transition-colors text-sm">
                                ← Back
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP: Mirror (Preparation) ────────────────────────── */}
                {step === 'mirror' && (
                    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 animate-slideUp">
                        <div className="w-full max-w-2xl text-center mb-6">
                            <h2 className="text-3xl font-bold mb-2">Get Ready! ✨</h2>
                            <p className="text-gray-400">Check your look and select your camera</p>
                        </div>

                        <div className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden bg-black border-2 border-white/10 shadow-2xl">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover transform scale-x-[-1]"
                            />

                            {/* Camera Switcher */}
                            {devices.length > 0 && (
                                <div className="absolute top-4 right-4 z-20">
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

                        <div className="mt-8 flex gap-4">
                            <button
                                onClick={() => { setStep('select-template'); stopCamera(); }}
                                className="px-6 py-3 rounded-xl border border-white/20 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm"
                            >
                                ← Back
                            </button>

                            <button
                                onClick={handleMirrorReady}
                                className="px-12 py-5 rounded-full text-white font-bold text-xl shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                                style={{ background: themeGradient, boxShadow: themeShadow }}
                            >
                                <span>I'M READY!</span>
                                <span className="text-2xl">📸</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP: Capture (Auto-Snap) ────────────────────────── */}
                {step === 'capture' && selectedTemplate && (
                    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
                        {/* Progress bar */}
                        <div className="w-full max-w-2xl mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-xl font-bold">
                                    Photo {Math.min(currentSlotIndex + 1, selectedTemplate.slots.length)} of {selectedTemplate.slots.length}
                                </h2>
                                <span className="text-sm text-gray-400">
                                    {isAutoSnapping ? '🔴 Recording...' : boothSettings.autoSnap !== false ? 'Ready' : 'Tap to capture'}
                                </span>
                            </div>
                            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full transition-all duration-500 rounded-full"
                                    style={{
                                        width: `${(capturedPhotos.length / selectedTemplate.slots.length) * 100}%`,
                                        background: themeGradient,
                                    }}
                                />
                            </div>
                        </div>

                        {/* Camera viewport - Dynamic Perspective */}
                        <div
                            className="relative w-full max-w-4xl rounded-3xl overflow-hidden bg-black border-4 border-white/10 shadow-2xl"
                            style={{
                                aspectRatio: `${selectedTemplate.layout.cols} / ${selectedTemplate.layout.rows}`
                            }}
                        >
                            {/* 1. Camera Feed Removed (Now inside Slots) */}
                            {/* video was here */}

                            {/* 2. Scalable Template Overlay */}
                            <div
                                className="absolute inset-0 transition-transform duration-1000 ease-in-out origin-center will-change-transform"
                                style={{
                                    containerType: 'inline-size',
                                    transform: (() => {
                                        if (viewMode === 'full' || !selectedTemplate) return 'scale(0.9)';

                                        // Calculate Zoom to current slot
                                        const slot = selectedTemplate.slots[currentSlotIndex];
                                        if (!slot) return 'scale(1)';

                                        // Using generic units assuming 100x100 coord system for calculations
                                        // The SVG viewbox is 0 0 1200 1200*(aspect)
                                        // Let's rely on percentage logic since template.slots are in Grid units, but we need % relative to container
                                        // Actually simplest: Assume Container is 100% x 100%

                                        // Logic:
                                        // Template Layout: Rows, Cols. Gap, Padding.
                                        // We need to find the center of the slot in % relative to the Template.

                                        const rows = selectedTemplate.layout.rows;
                                        const cols = selectedTemplate.layout.cols;
                                        const gap = selectedTemplate.gap;
                                        const pad = selectedTemplate.padding;

                                        // Calculate slot geometry in hypothetical "Template Units" (e.g. Total Width = 1000)
                                        // This is tricky without exact pixel mapping.
                                        // Alternative: Use the Grid logic.

                                        // Zoom Factor: Gentle Zoom (Keep ~20% context)
                                        // Previous was 1.5x of cols. Now let's just ensure the slot takes up ~60-70% of view.
                                        // Current Size (in %) = 100/cols approx.
                                        // Target Size = 70%. Scale = 70 / (100/cols) = 0.7 * cols.
                                        const scale = Math.max(1, selectedTemplate.layout.cols * 0.75);

                                        // Let's compute Slot Center (Cx, Cy) in percentage (0-100)
                                        const row = Math.floor(currentSlotIndex / cols);
                                        const col = currentSlotIndex % cols;

                                        // Total Width Units = cols + gaps + pads?
                                        // No, the renderer (below) uses flex/grid with % or pixels? 
                                        // Refactoring Helper:
                                        // Let's define the center based on row/col index simply:
                                        const cellW = 100 / cols;
                                        const cellH = 100 / rows;
                                        const centerX = (col + 0.5) * cellW;
                                        const centerY = (row + 0.5) * cellH;

                                        // Scale: We want the slot to fill say 60% of the screen?
                                        // Zoom Factor = 3 (Safe generic zoom)
                                        // Or cleaner: S = 1 / (1/cols) * 0.8 => 0.8 * cols.


                                        // Translate to center:
                                        // T = 50 - Center * S ? No.
                                        // Render transforms: translate((50 - Cx)%, (50 - Cy)%) scale(S)

                                        return `scale(${scale}) translate(${50 - centerX}%, ${50 - centerY}%)`;
                                    })()
                                }}
                            >
                                {/* 1. Template Background Layer */}
                                <div
                                    className="absolute inset-0 w-full h-full"
                                    style={{
                                        background: selectedTemplate.background.includes('gradient') || selectedTemplate.background.includes('url')
                                            ? selectedTemplate.background
                                            : selectedTemplate.background,
                                        backgroundImage: selectedTemplate.backgroundImage ? `url(${selectedTemplate.backgroundImage})` : undefined,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                    }}
                                />

                                {/* 2. Slot Grid (Render Photos or Camera) */}
                                <div className="absolute inset-0 w-full h-full">
                                    {selectedTemplate.slots.map((_, i) => {
                                        const cols = selectedTemplate.layout.cols;
                                        const rows = selectedTemplate.layout.rows;
                                        const pad = selectedTemplate.padding;
                                        const gap = selectedTemplate.gap;

                                        // Use same calc as standardizer (420 ref)
                                        const refW = 420;
                                        const refH = refW * (rows > cols ? 4 / 3 : 3 / 4);
                                        const padPctX = (pad / refW) * 100;
                                        const padPctY = (pad / refH) * 100;
                                        const gapPctX = (gap / refW) * 100;
                                        const gapPctY = (gap / refH) * 100;

                                        const gridW = 100 - (padPctX * 2);
                                        const gridH = 100 - (padPctY * 2);
                                        const cellW = (gridW - (gapPctX * (cols - 1))) / cols;
                                        const cellH = (gridH - (gapPctY * (rows - 1))) / rows;

                                        const r = Math.floor(i / cols);
                                        const c = i % cols;

                                        const isCurrent = i === currentSlotIndex;
                                        // Show camera if current AND auto-snapping (or just ready to snap)
                                        // If not auto-snapping yet (just preview), we might show it in first slot?
                                        // "isAutoSnapping" is strictly for the countdown loop.
                                        // If we are in 'capture' step, we should show camera in current slot.
                                        const showCamera = isCurrent && !capturedPhotos[i];

                                        return (
                                            <div
                                                key={i}
                                                className="absolute overflow-hidden rounded-lg bg-black/10"
                                                style={{
                                                    left: `${padPctX + (c * (cellW + gapPctX))}%`,
                                                    top: `${padPctY + (r * (cellH + gapPctY))}%`,
                                                    width: `${cellW}%`,
                                                    height: `${cellH}%`,
                                                    borderRadius: `${selectedTemplate.borderRadius}px`, // Use template radius if avail? Or fixed.
                                                    // Design tweak: user wants template radius. Let's assume standard 1% or similar if not in config.
                                                }}
                                            >
                                                {/* Render Photo if captured */}
                                                {capturedPhotos[i] && (
                                                    <img src={capturedPhotos[i]} className="absolute inset-0 w-full h-full object-cover" />
                                                )}

                                                {/* Render Camera if active */}
                                                {showCamera && (
                                                    <div className="absolute inset-0 w-full h-full">
                                                        <video
                                                            ref={setVideoRef}
                                                            autoPlay
                                                            playsInline
                                                            muted
                                                            className="absolute inset-0 w-full h-full object-cover"
                                                            style={{ transform: 'scaleX(-1)' }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* 3. Text & Stickers Overlay */}
                                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                                    {selectedTemplate.textElements.map((el) => (
                                        <div key={el.id} style={{
                                            position: 'absolute',
                                            left: `${el.x}%`, top: `${el.y}%`,
                                            transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
                                            color: el.color,
                                            fontSize: `calc(${el.fontSize} / 420 * 100cqw)`,
                                            fontFamily: el.fontFamily,
                                            fontWeight: el.fontWeight,
                                            fontStyle: el.fontStyle,
                                            width: 'max-content',
                                            textShadow: el.textShadow
                                        }}>
                                            {el.text}
                                        </div>
                                    ))}
                                    {(selectedTemplate.stickers || []).map((stk) => (
                                        <div key={stk.id} style={{
                                            position: 'absolute',
                                            left: `${stk.x}%`, top: `${stk.y}%`,
                                            width: `calc(${stk.width} / 420 * 100cqw)`,
                                            transform: `translate(-50%, -50%) rotate(${stk.rotation}deg)`
                                        }}>
                                            <img src={stk.src} className="w-full h-auto drop-shadow-md" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Countdown overlay - Always centered in viewport (fixed) */}
                            {countdown !== null && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center">
                                    <span className="text-9xl font-bold text-white drop-shadow-lg animate-countPulse" key={countdown}>
                                        {countdown}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Captured thumbnails */}
                        <div className="flex gap-3 mt-6">
                            {selectedTemplate.slots.map((_: any, i: number) => (
                                <div
                                    key={i}
                                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${i < capturedPhotos.length
                                        ? 'shadow-lg'
                                        : i === currentSlotIndex
                                            ? 'border-white/50 animate-pulse'
                                            : 'border-white/10'
                                        }`}
                                    style={i < capturedPhotos.length ? { borderColor: tc, boxShadow: `0 4px 12px ${tc}30` } : undefined}
                                >
                                    {capturedPhotos[i] ? (
                                        <img src={capturedPhotos[i]} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-600 text-xs">
                                            {i + 1}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Controls */}
                        <div className="mt-6 flex items-center gap-4">
                            <button
                                onClick={() => {
                                    autoSnapRef.current = false;
                                    clearTimeouts();
                                    setIsAutoSnapping(false);
                                    setStep('select-template');
                                    stopCamera();
                                }}
                                className="px-6 py-3 rounded-xl border border-white/20 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm"
                            >
                                ← Change Template
                            </button>
                            {/* Manual capture button when auto-snap is off */}
                            {boothSettings.autoSnap === false && capturedPhotos.length < selectedTemplate.slots.length && (
                                <button
                                    onClick={handleManualSnap}
                                    className="px-8 py-4 rounded-2xl text-white font-bold shadow-xl transition-all hover:scale-105 active:scale-95 text-lg"
                                    style={{ background: themeGradient, boxShadow: themeShadow }}
                                >
                                    📸 Take Photo
                                </button>
                            )}
                            {!isAutoSnapping && boothSettings.autoSnap !== false && capturedPhotos.length < selectedTemplate.slots.length && (
                                <button
                                    onClick={() => runAutoSnap(selectedTemplate)}
                                    className="px-6 py-3 rounded-xl text-white font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105"
                                    style={{ background: themeGradient }}
                                >
                                    ▶ Start Auto-Snap
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── STEP: Review ──────────────────────────────────────── */}
                {step === 'review' && selectedTemplate && (
                    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 animate-slideUp">
                        <h2 className="text-3xl font-bold mb-8">Looking Good? 🔥</h2>

                        {/* Composite preview */}
                        <div
                            className="relative shadow-2xl mx-auto"
                            style={{
                                width: 'min(90vw, 600px)',
                                background: selectedTemplate.backgroundImage
                                    ? `url(${selectedTemplate.backgroundImage}) center/cover no-repeat`
                                    : selectedTemplate.background,
                                borderRadius: selectedTemplate.borderRadius,
                                padding: selectedTemplate.padding * 0.85,
                                border: selectedTemplate.borderWidth
                                    ? `${selectedTemplate.borderWidth}px solid ${selectedTemplate.borderColor}`
                                    : 'none',
                            }}
                        >
                            <div
                                className="grid"
                                style={{
                                    gridTemplateRows: `repeat(${selectedTemplate.layout.rows}, 1fr)`,
                                    gridTemplateColumns: `repeat(${selectedTemplate.layout.cols}, 1fr)`,
                                    gap: selectedTemplate.gap * 0.85,
                                }}
                            >
                                {selectedTemplate.slots.map((slot: any, i: number) => (
                                    <div
                                        key={slot.id}
                                        className="overflow-hidden"
                                        style={{
                                            aspectRatio: selectedTemplate.layout.rows > selectedTemplate.layout.cols ? '4/3' : '3/4',
                                            borderRadius: Math.max(selectedTemplate.borderRadius - selectedTemplate.padding / 2, 4),
                                        }}
                                    >
                                        {capturedPhotos[i] ? (
                                            <img src={capturedPhotos[i]} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500">No photo</div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Text elements */}
                            {selectedTemplate.textElements.map((el: any) => (
                                <div
                                    key={el.id}
                                    className="absolute whitespace-nowrap pointer-events-none"
                                    style={{
                                        left: `${el.x}%`,
                                        top: `${el.y}%`,
                                        transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
                                        fontSize: el.fontSize * 0.85,
                                        fontFamily: el.fontFamily,
                                        color: el.color,
                                        fontWeight: el.fontWeight,
                                        fontStyle: el.fontStyle,
                                        letterSpacing: el.letterSpacing,
                                        textShadow: el.textShadow,
                                        opacity: el.opacity,
                                    }}
                                >
                                    {el.text}
                                </div>
                            ))}

                            {/* Stickers */}
                            {(selectedTemplate.stickers || []).map((stk: any) => (
                                <div
                                    key={stk.id}
                                    className="absolute select-none pointer-events-none"
                                    style={{
                                        left: `${stk.x}%`,
                                        top: `${stk.y}%`,
                                        width: `${stk.width}px`,
                                        transform: `translate(-50%, -50%) rotate(${stk.rotation}deg) scale(0.85)`,
                                        zIndex: 20,
                                    }}
                                >
                                    <img src={stk.src} alt="sticker" className="w-full h-auto drop-shadow-md" />
                                </div>
                            ))}

                            {/* Watermark */}
                            {selectedTemplate.watermarkText && (
                                <div className="absolute bottom-2 left-0 right-0 text-center" style={{ fontSize: 9, opacity: 0.3, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }}>
                                    {selectedTemplate.watermarkText}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={handleRetake}
                                className="px-6 py-3 rounded-xl border-2 border-white/20 text-white hover:bg-white/10 transition-all font-semibold"
                            >
                                🔄 Retake
                            </button>
                            <button
                                onClick={handleConfirmAndGenerateQR}
                                disabled={uploadingComposite}
                                className="px-8 py-3 rounded-xl text-white font-bold shadow-xl hover:shadow-2xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: themeGradient, boxShadow: themeShadow }}
                            >
                                {uploadingComposite ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Generating QR...
                                    </span>
                                ) : (
                                    '✅ Looks Great!'
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP: QR Code ─────────────────────────────────────── */}
                {step === 'qr' && downloadUrl && (
                    <div className="flex-1 flex items-center justify-center px-6 animate-slideUp">
                        <div className="text-center max-w-lg">
                            <div className="text-6xl mb-4">📱</div>
                            <h2
                                className="text-4xl font-bold mb-2 bg-clip-text text-transparent"
                                style={{ backgroundImage: themeGradient }}
                            >
                                Scan to Download
                            </h2>
                            <p className="text-gray-400 text-lg mb-8">
                                Point your phone&apos;s camera at the QR code to save your photo
                            </p>

                            {/* QR Code */}
                            <div className="inline-block p-6 bg-white rounded-3xl shadow-2xl animate-qrGlow">
                                <QRCode
                                    value={downloadUrl}
                                    size={240}
                                    level="H"
                                    bgColor="#ffffff"
                                    fgColor="#1e1b4b"
                                />
                            </div>

                            <div className="mt-6 text-center">
                                <p className="text-sm text-gray-500 mb-2">Or visit this link:</p>
                                <a
                                    href={downloadUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-400 hover:text-indigo-300 underline break-all font-monotext-sm block px-4 py-2 bg-white/5 rounded-lg border border-white/10 transition-colors"
                                >
                                    {downloadUrl}
                                </a>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-4 justify-center mt-8">
                                <button
                                    onClick={() => {
                                        setCapturedPhotos([]);
                                        setCurrentSlotIndex(0);
                                        setSelectedTemplate(null);
                                        setDownloadUrl(null);
                                        setStep(templates.length > 0 ? 'select-template' : 'welcome');
                                    }}
                                    className="px-8 py-3 rounded-xl text-white font-bold shadow-xl hover:shadow-2xl transition-all hover:scale-105"
                                    style={{ background: themeGradient, boxShadow: themeShadow }}
                                >
                                    📸 Next Guest
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── STEP: Done (Fallback) ──────────────────────────────── */}
                {step === 'done' && (
                    <div className="flex-1 flex items-center justify-center px-6 animate-slideUp">
                        <div className="text-center">
                            <div className="text-8xl mb-6">🎉</div>
                            <h2 className="text-4xl font-bold mb-3">Photo Saved!</h2>
                            <p className="text-gray-400 text-lg mb-8">Your photo has been downloaded.</p>
                            <button
                                onClick={() => {
                                    setCapturedPhotos([]);
                                    setCurrentSlotIndex(0);
                                    setSelectedTemplate(null);
                                    setStep(templates.length > 0 ? 'select-template' : 'welcome');
                                }}
                                className="px-8 py-3 rounded-xl text-white font-bold shadow-xl hover:shadow-2xl transition-all hover:scale-105"
                                style={{ background: themeGradient, boxShadow: themeShadow }}
                            >
                                📸 Take Another Photo
                            </button>
                        </div>
                    </div>
                )}

                {/* Branding */}
                <div className="text-center py-4 text-xs text-gray-600">
                    Powered by <span className="font-semibold text-gray-400">SnapWrap</span>
                </div>
            </div>
        </div>
    );
}
