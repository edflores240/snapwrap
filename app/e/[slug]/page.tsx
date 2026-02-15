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

type BoothStep = 'welcome' | 'select-template' | 'capture' | 'review' | 'qr' | 'done';

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

    // Derived theme values
    const tc = boothSettings.themeColor || '#6366f1';
    const hsl = hexToHSL(tc);
    const themeGradient = `linear-gradient(135deg, ${tc}, hsl(${(hsl.h + 30) % 360}, ${hsl.s}%, ${hsl.l}%))`;
    const themeShadow = `0 10px 40px ${tc}40`;
    const themeBgSubtle = `linear-gradient(135deg, hsl(${hsl.h}, ${hsl.s}%, 8%) 0%, #030712 50%, hsl(${(hsl.h + 30) % 360}, ${Math.max(hsl.s - 20, 10)}%, 10%) 100%)`;

    useEffect(() => {
        if (params.slug) fetchEvent();
        return () => { stopCamera(); };
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
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error('Camera error:', err);
            alert('Could not access camera. Please allow camera permissions.');
        }
    };

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    };

    const takePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // Mirror (selfie mode)
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.9);
    }, []);

    // ── Auto-Snap Flow ────────────────────────────────────────────────

    const runAutoSnap = useCallback(async (template: TemplateConfig) => {
        setIsAutoSnapping(true);
        autoSnapRef.current = true;
        const photos: string[] = [];

        for (let i = 0; i < template.slots.length; i++) {
            if (!autoSnapRef.current) break;

            setCurrentSlotIndex(i);

            // Short breather between shots (not before first)
            if (i > 0) {
                setBetweenShots(true);
                await new Promise(r => setTimeout(r, 1500));
                setBetweenShots(false);
            }

            // Countdown using settings
            const cdSeconds = boothSettings.countdownSeconds || 3;
            for (let c = cdSeconds; c > 0; c--) {
                if (!autoSnapRef.current) break;
                setCountdown(c);
                await new Promise(r => setTimeout(r, 1000));
            }
            setCountdown(null);

            if (!autoSnapRef.current) break;

            // Flash + capture
            setFlashActive(true);
            await new Promise(r => setTimeout(r, 150));
            const photo = takePhoto();
            setFlashActive(false);

            if (photo) {
                photos.push(photo);
                setCapturedPhotos([...photos]);
            }
        }

        if (autoSnapRef.current && photos.length === template.slots.length) {
            // All photos captured — go to review
            setStep('review');
            stopCamera();
        }

        setIsAutoSnapping(false);
        setCountdown(null);
    }, [takePhoto, boothSettings.countdownSeconds]);

    // ── Step Handlers ──────────────────────────────────────────────────

    const handleSelectTemplate = async (tpl: TemplateConfig) => {
        setSelectedTemplate(tpl);
        setCapturedPhotos([]);
        setCurrentSlotIndex(0);
        setStep('capture');
        await startCamera();
        // Auto-snap if enabled, otherwise wait for manual capture
        if (boothSettings.autoSnap !== false) {
            setTimeout(() => {
                runAutoSnap(tpl);
            }, 1000);
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

                        {/* Camera viewport */}
                        <div className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden bg-black border-2 border-white/10 shadow-2xl">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                                style={{ transform: 'scaleX(-1)' }}
                            />

                            {/* Countdown overlay */}
                            {countdown !== null && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <span className="text-9xl font-bold text-white animate-countPulse" key={countdown}>
                                        {countdown}
                                    </span>
                                </div>
                            )}

                            {/* "Get Ready" between shots */}
                            {betweenShots && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <div className="text-center animate-slideUp">
                                        <p className="text-4xl font-bold text-white mb-2">Get Ready!</p>
                                        <p className="text-lg text-gray-300">Next photo coming up...</p>
                                    </div>
                                </div>
                            )}

                            {/* Photo count badge */}
                            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-semibold">
                                📷 {capturedPhotos.length}/{selectedTemplate.slots.length}
                            </div>
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
                                onClick={() => { autoSnapRef.current = false; setStep('select-template'); stopCamera(); }}
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
                            className="relative shadow-2xl"
                            style={{
                                width: 360,
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

                            <p className="text-sm text-gray-500 mt-6 break-all max-w-sm mx-auto font-mono">
                                {downloadUrl}
                            </p>

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
