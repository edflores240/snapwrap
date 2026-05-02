'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TemplateConfig, PRESET_TEMPLATES } from '@/components/templates/TemplateDesigner';
import TemplatePreview from '@/components/templates/TemplatePreview';
import QRCode from 'react-qr-code';
import { GestureDetector, GestureMode } from '@/components/camera/GestureDetector';

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
    gesturesEnabled: boolean;
}

const DEFAULT_BOOTH_SETTINGS: BoothSettings = {
    welcomeMessage: '',
    countdownSeconds: 3,
    autoSnap: true,
    themeColor: '#6366f1',
    gesturesEnabled: true,
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
    // Sub-state within the 'capture' step: live camera | counting down | previewing just-taken photo
    const [captureSubState, setCaptureSubState] = useState<'live' | 'countdown' | 'preview'>('live');
    const [countdown, setCountdown] = useState<number | null>(null);
    const [flashActive, setFlashActive] = useState(false);
    // Gesture hold feedback (driven by GestureDetector's onHoldProgress)
    const [gestureHoldProgress, setGestureHoldProgress] = useState(0);
    const [gestureHoldTarget, setGestureHoldTarget] = useState<'retake' | 'confirm' | null>(null);
    // Auto-keep: after a snap, photo auto-advances after AUTO_KEEP_MS unless retaken
    const [autoKeepProgress, setAutoKeepProgress] = useState(0);
    const autoKeepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // QR / Upload state
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [uploadingComposite, setUploadingComposite] = useState(false);

    // Camera
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);
    // Dedicated hidden video for GestureDetector — always has the stream,
    // independent of whether the slot's visible <video> is mounted or not
    const gestureVideoRef = useRef<HTMLVideoElement>(null);
    // Separate hidden video element used for gesture detection on the Review step
    const reviewVideoRef = useRef<HTMLVideoElement>(null);
    const reviewStreamRef = useRef<MediaStream | null>(null);

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
            if (countdownRef.current) clearTimeout(countdownRef.current);
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
            // Always pipe stream to the dedicate gesture video too
            if (gestureVideoRef.current) {
                gestureVideoRef.current.srcObject = stream;
                gestureVideoRef.current.play().catch(() => { });
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
        if ((step === 'mirror' || step === 'capture') && streamRef.current) {
            if (videoRef.current) videoRef.current.srcObject = streamRef.current;
            // Keep gesture video in sync too
            if (gestureVideoRef.current) {
                gestureVideoRef.current.srcObject = streamRef.current;
                gestureVideoRef.current.play().catch(() => { });
            }
        }
    }, [step]);

    // Start/stop a lightweight background camera for gesture detection on Review step
    useEffect(() => {
        if (step === 'review') {
            // Start hidden gesture camera
            navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240, deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined },
                audio: false,
            }).then(stream => {
                reviewStreamRef.current = stream;
                if (reviewVideoRef.current) {
                    reviewVideoRef.current.srcObject = stream;
                    reviewVideoRef.current.play().catch(() => { });
                }
            }).catch(() => { }); // Silently fail — gesture is nice-to-have
        } else {
            reviewStreamRef.current?.getTracks().forEach(t => t.stop());
            reviewStreamRef.current = null;
        }
    }, [step, selectedDeviceId]);

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    };

    // Callback ref to ensure video stream is attached instantly on mount/remount
    const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
        videoRef.current = node;
        if (node && streamRef.current) {
            node.srcObject = streamRef.current;
            node.play().catch(() => { });
        }
    }, []);

    // Callback ref for the always-on hidden gesture video
    const setGestureVideoRef = useCallback((node: HTMLVideoElement | null) => {
        gestureVideoRef.current = node;
        if (node && streamRef.current) {
            node.srcObject = streamRef.current;
            node.play().catch(() => { });
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
        const targetRatio = rows > cols ? 3 / 2 : 16 / 9;

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

    // ── Step Handlers ──────────────────────────────────────────────────

    const handleSelectTemplate = async (tpl: TemplateConfig) => {
        setSelectedTemplate(tpl);
        setCapturedPhotos([]);
        setCurrentSlotIndex(0);
        setCaptureSubState('live');
        setStep('mirror');
        await startCamera();
    };

    const handleMirrorReady = () => {
        setStep('capture');
        setCaptureSubState('live');
    };

    // ── One-by-One Capture ─────────────────────────────────────────────

    /**
     * handleSnapSlot — triggered by the "Snap!" button.
     * Runs a 3-2-1 countdown then captures the current slot.
     */
    const handleSnapSlot = useCallback(() => {
        if (captureSubState !== 'live') return;
        setCaptureSubState('countdown');

        const cdSeconds = boothSettings.countdownSeconds || 3;
        setCountdown(cdSeconds);

        let remaining = cdSeconds - 1;
        const tick = () => {
            if (remaining > 0) {
                setCountdown(remaining);
                remaining--;
                countdownRef.current = setTimeout(tick, 1000);
            } else {
                // Fire!
                setCountdown(null);
                setFlashActive(true);
                setTimeout(() => {
                    const photo = takePhoto();
                    setFlashActive(false);
                    if (photo) {
                        setCapturedPhotos(prev => {
                            const next = [...prev];
                            next[currentSlotIndex] = photo;
                            return next;
                        });
                    }
                    setCaptureSubState('preview');
                }, 150);
            }
        };

        countdownRef.current = setTimeout(tick, 1000);
    }, [captureSubState, boothSettings.countdownSeconds, takePhoto, currentSlotIndex]);

    /**
     * handleKeepSlot — user happy with the current photo.
     * Advances to the next empty slot, or transitions to review.
     */
    const handleKeepSlot = useCallback(() => {
        if (!selectedTemplate) return;
        const nextIndex = currentSlotIndex + 1;
        if (nextIndex >= selectedTemplate.slots.length) {
            // All done → review
            setStep('review');
            stopCamera();
        } else {
            setCurrentSlotIndex(nextIndex);
            setCaptureSubState('live');
        }
    }, [selectedTemplate, currentSlotIndex]);

    /**
     * handleRetakeSlot — user wants to redo the current slot.
     * Clears just that slot and goes back to live camera.
     */
    const handleRetakeSlot = useCallback(() => {
        if (countdownRef.current) clearTimeout(countdownRef.current);
        // Cancel any in-progress auto-keep timer
        if (autoKeepTimerRef.current) {
            clearInterval(autoKeepTimerRef.current);
            autoKeepTimerRef.current = null;
        }
        setAutoKeepProgress(0);
        setCapturedPhotos(prev => {
            const next = [...prev];
            next[currentSlotIndex] = '';
            return next;
        });
        setCountdown(null);
        setCaptureSubState('live');
    }, [currentSlotIndex]);

    /** Auto-keep: once a photo is in preview, auto-advance after 2.5s */
    const AUTO_KEEP_MS = 10000;
    useEffect(() => {
        if (captureSubState !== 'preview') {
            if (autoKeepTimerRef.current) {
                clearInterval(autoKeepTimerRef.current);
                autoKeepTimerRef.current = null;
            }
            setAutoKeepProgress(0);
            return;
        }
        let elapsed = 0;
        const TICK = 50;
        autoKeepTimerRef.current = setInterval(() => {
            elapsed += TICK;
            const pct = Math.min(100, (elapsed / AUTO_KEEP_MS) * 100);
            setAutoKeepProgress(pct);
            if (elapsed >= AUTO_KEEP_MS) {
                clearInterval(autoKeepTimerRef.current!);
                autoKeepTimerRef.current = null;
                setAutoKeepProgress(0);
                handleKeepSlot();
            }
        }, TICK);
        return () => {
            if (autoKeepTimerRef.current) clearInterval(autoKeepTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [captureSubState, currentSlotIndex]);

    /** Full retake from the review screen — goes back to slot 0. */
    const handleRetake = async () => {
        setCapturedPhotos([]);
        setCurrentSlotIndex(0);
        setCaptureSubState('live');
        setDownloadUrl(null);
        setStep('capture');
        await startCamera();
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
        const aspectRatio = rows > cols ? 3 / 2 : 16 / 9; // 3:2 portrait, 16:9 landscape for groups
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
            // Re-calculate font size based on 420 scale (since canvas uses 420*SCALE as W)
            // cqw in review = % of width.
            // If font is 20px in 420px, it is 4.7% width.
            // In canvas W = 420*SCALE. Font = 20*SCALE.
            // This means logic matches perfectly.

            ctx.save();
            ctx.font = `${el.fontStyle === 'italic' ? 'italic ' : ''}${el.fontWeight} ${el.fontSize * SCALE}px ${el.fontFamily}`;
            ctx.fillStyle = el.color;
            ctx.globalAlpha = el.opacity;
            ctx.textAlign = 'center';
            const tx = (el.x / 100) * W;
            const ty = (el.y / 100) * H;
            ctx.translate(tx, ty);
            ctx.rotate((el.rotation * Math.PI) / 180);
            if (el.textShadow) {
                // Parse simple shadow if possible or ignore for canvasMVP
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 4 * SCALE;
            }
            if (el.letterSpacing) {
                // ctx.letterSpacing is experimental, might not work in all browsers
                // fallback or skip
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
        <div className="h-screen bg-gray-950 text-white relative overflow-hidden">
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
                    50% { transform: scale(3); opacity: 1; }
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

            <div className="relative z-10 h-full flex flex-col overflow-y-auto">
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

                {/* ── STEP: Capture (One-by-One) ────────────────────────── */}
                {step === 'capture' && selectedTemplate && (() => {
                    const W = 420;
                    const pad = selectedTemplate.padding;
                    const gap = selectedTemplate.gap;
                    const cols = selectedTemplate.layout.cols;
                    const rows = selectedTemplate.layout.rows;
                    const gridW = W - pad * 2;
                    const slotW = (gridW - gap * (cols - 1)) / cols;
                    const slotAspectRatio = rows > cols ? 3 / 2 : 16 / 9;
                    const slotH = slotW / slotAspectRatio;
                    const gridH = slotH * rows + gap * (rows - 1);
                    const H = gridH + pad * 2 + 60;

                    const padPctX = (pad / W) * 100;
                    const padPctY = ((pad + 30) / H) * 100;
                    const gapPctX = (gap / W) * 100;
                    const gapPctY = (gap / H) * 100;
                    const cellW = (slotW / W) * 100;
                    const cellH = (slotH / H) * 100;

                    return (
                        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
                            {/* Header + progress bar */}
                            <div className="w-full max-w-2xl mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="text-xl font-bold">
                                        Photo <span style={{ color: tc }}>{currentSlotIndex + 1}</span> of {selectedTemplate.slots.length}
                                    </h2>
                                    <span className="text-sm text-gray-400">
                                        {captureSubState === 'countdown' ? '🟡 Get ready…' : captureSubState === 'preview' ? '✅ Looking good!' : '📸 Tap to snap'}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    {selectedTemplate.slots.map((_: any, i: number) => (
                                        <div
                                            key={i}
                                            className="h-2 flex-1 rounded-full transition-all duration-500"
                                            style={{
                                                background: capturedPhotos[i]
                                                    ? themeGradient
                                                    : i === currentSlotIndex
                                                        ? `${tc}50`
                                                        : 'rgba(255,255,255,0.1)',
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Camera / Template viewport — capped at 70vh so action bar is always visible */}
                            <div
                                className="relative rounded-3xl overflow-hidden bg-black border-4 shadow-2xl mx-auto"
                                style={{
                                    borderColor: captureSubState === 'preview' ? tc : 'rgba(255,255,255,0.1)',
                                    boxShadow: captureSubState === 'preview' ? `0 0 40px ${tc}40` : undefined,
                                    aspectRatio: `${W} / ${H}`,
                                    height: 'min(70vh, 800px)',
                                    width: 'auto',
                                    maxWidth: '100%',
                                }}
                            >
                                {/* Template background */}
                                <div
                                    className="absolute inset-0 w-full h-full"
                                    style={{
                                        background: selectedTemplate.background,
                                        backgroundImage: selectedTemplate.backgroundImage ? `url(${selectedTemplate.backgroundImage})` : undefined,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                    }}
                                />

                                {/* Slot Grid */}
                                <div className="absolute inset-0 w-full h-full">
                                    {selectedTemplate.slots.map((_: any, i: number) => {
                                        const r = Math.floor(i / cols);
                                        const c = i % cols;
                                        const isCurrent = i === currentSlotIndex;
                                        const showCamera = isCurrent && (captureSubState === 'live' || captureSubState === 'countdown') && !capturedPhotos[i];

                                    return (
                                        <div
                                            key={i}
                                            className="absolute overflow-hidden bg-black/10 transition-all duration-300"
                                            style={{
                                                left: `${padPctX + c * (cellW + gapPctX)}%`,
                                                top: `${padPctY + r * (cellH + gapPctY)}%`,
                                                width: `${cellW}%`,
                                                height: `${cellH}%`,
                                                borderRadius: `${selectedTemplate.borderRadius}px`,
                                                outline: isCurrent && captureSubState === 'preview'
                                                    ? `3px solid ${tc}`
                                                    : isCurrent ? `2px solid ${tc}80` : 'none',
                                                outlineOffset: '2px',
                                            }}
                                        >
                                            {capturedPhotos[i] && (
                                                <img src={capturedPhotos[i]} alt={`Photo ${i + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                                            )}
                                            {showCamera && (
                                                <div className="absolute inset-0 w-full h-full">
                                                    <video
                                                        ref={setVideoRef}
                                                        autoPlay playsInline muted
                                                        className="absolute inset-0 w-full h-full object-cover"
                                                        style={{ transform: 'scaleX(-1)' }}
                                                    />
                                                </div>
                                            )}
                                            {!capturedPhotos[i] && !showCamera && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60">
                                                    <span className="text-gray-600 text-2xl font-bold">{i + 1}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Text & Stickers overlay */}
                            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl" style={{ containerType: 'inline-size' }}>
                                {selectedTemplate.textElements.map((el: any) => (
                                    <div key={el.id} style={{
                                        position: 'absolute', left: `${el.x}%`, top: `${el.y}%`,
                                        transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
                                        color: el.color, fontSize: `calc(${el.fontSize} / 420 * 100cqw)`,
                                        fontFamily: el.fontFamily, fontWeight: el.fontWeight,
                                        fontStyle: el.fontStyle, width: 'max-content', textShadow: el.textShadow
                                    }}>{el.text}</div>
                                ))}
                                {(selectedTemplate.stickers || []).map((stk: any) => (
                                    <div key={stk.id} style={{
                                        position: 'absolute', left: `${stk.x}%`, top: `${stk.y}%`,
                                        width: `calc(${stk.width} / 420 * 100cqw)`,
                                        transform: `translate(-50%, -50%) rotate(${stk.rotation}deg)`
                                    }}><img src={stk.src} className="w-full h-auto drop-shadow-md" /></div>
                                ))}
                            </div>

                            {/* Countdown is rendered as a fixed fullscreen overlay — see below */}

                            {/* Hidden video: always carries the stream for gesture detection */}
                            <video
                                ref={setGestureVideoRef}
                                autoPlay playsInline muted
                                className="hidden"
                            />

                            {/* GestureDetector — only when gestures are enabled */}
                            {boothSettings.gesturesEnabled && (
                                <GestureDetector
                                    videoRef={gestureVideoRef}
                                    mode={captureSubState === 'live' ? 'snap' : captureSubState === 'preview' ? 'preview' : 'off'}
                                    onRetake={handleRetakeSlot}
                                    onConfirm={captureSubState === 'live' ? handleSnapSlot : handleKeepSlot}
                                    onHoldProgress={(progress, target) => {
                                        setGestureHoldProgress(progress);
                                        setGestureHoldTarget(target);
                                    }}
                                    themeColor={tc}
                                />
                            )}

                            {/* ── Fullscreen Countdown Overlay (The "Ultimate Zoom") ── */}
                            {countdown !== null && (
                                <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-fadeIn">
                                    {/* Blurred Background Feed */}
                                    <video
                                        ref={(el) => {
                                            if (el && streamRef.current) {
                                                el.srcObject = streamRef.current;
                                            }
                                        }}
                                        autoPlay playsInline muted
                                        className="absolute inset-0 w-full h-full object-cover opacity-40 blur-xl"
                                        style={{ transform: 'scaleX(-1)' }}
                                    />
                                    
                                    {/* Main Focus Frame */}
                                    <div className="relative z-10 border-8 border-white/20 rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] transition-all duration-500 scale-110"
                                        style={{ 
                                            aspectRatio: (() => {
                                                const W = 420;
                                                const PAD = selectedTemplate.padding;
                                                const GAP = selectedTemplate.gap;
                                                const cols = selectedTemplate.layout.cols;
                                                const rows = selectedTemplate.layout.rows;
                                                const gridW = W - PAD * 2;
                                                const slotW = (gridW - GAP * (cols - 1)) / cols;
                                                const slotAspectRatio = rows > cols ? 3 / 2 : 16 / 9;
                                                const slotH = slotW / slotAspectRatio;
                                                const gridH = slotH * rows + GAP * (rows - 1);
                                                const H = gridH + PAD * 2 + 60;
                                                return `${W} / ${H}`;
                                            })(),
                                            width: 'min(85vw, 1000px)', 
                                            maxHeight: '75vh' 
                                        }}>
                                        <video
                                            ref={(el) => {
                                                if (el && streamRef.current) {
                                                    el.srcObject = streamRef.current;
                                                }
                                            }}
                                            autoPlay playsInline muted
                                            className="w-full h-full object-cover"
                                            style={{ transform: 'scaleX(-1)' }}
                                        />
                                        {/* Vignette & Corner Accents */}
                                        <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.6)]" />
                                        <div className="absolute top-8 left-8 w-12 h-12 border-t-4 border-l-4 border-white/40 rounded-tl-2xl" />
                                        <div className="absolute top-8 right-8 w-12 h-12 border-t-4 border-r-4 border-white/40 rounded-tr-2xl" />
                                        <div className="absolute bottom-8 left-8 w-12 h-12 border-b-4 border-l-4 border-white/40 rounded-bl-2xl" />
                                        <div className="absolute bottom-8 right-8 w-12 h-12 border-b-4 border-r-4 border-white/40 rounded-br-2xl" />
                                    </div>

                                    {/* Massive Countdown Number */}
                                    <div className="relative z-20 -mt-20">
                                        <span
                                            className="font-black text-white animate-countPulse block"
                                            key={countdown}
                                            style={{ 
                                                fontSize: 'clamp(10rem, 25vw, 22rem)', 
                                                textShadow: `0 0 80px ${tc}, 0 0 160px ${tc}80, 0 20px 40px rgba(0,0,0,0.5)` 
                                            }}
                                        >
                                            {countdown}
                                        </span>
                                    </div>
                                    
                                    {/* Action Hint */}
                                    <div className="absolute bottom-12 flex flex-col items-center gap-4 animate-bounce">
                                        <div className="px-8 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold tracking-[0.2em] uppercase text-lg">
                                            Smile!
                                        </div>
                                    </div>

                                    {/* Flash Effect on Last Second (optional visual polish) */}
                                    {countdown === 1 && <div className="absolute inset-0 z-[110] bg-white animate-flash opacity-0 pointer-events-none" />}
                                </div>
                            )}
                        </div>

                        {/* ── Action Bar ──────────────────────────────────────────── */}
                        <div className="mt-4 w-full max-w-3xl flex flex-col items-center gap-3">

                            {/* Live: ← Template | Snap button | gesture hint | camera switcher */}
                            {captureSubState === 'live' && (
                                <div className="w-full flex items-center gap-3">
                                    <button
                                        onClick={() => { setStep('select-template'); stopCamera(); }}
                                        className="px-4 py-2.5 rounded-xl border border-white/15 text-gray-500 hover:text-white hover:bg-white/10 transition-all text-sm shrink-0"
                                    >← Template</button>

                                    {/* Snap button — always visible */}
                                    <button
                                        id="snap-button"
                                        onClick={handleSnapSlot}
                                        className="relative flex-1 flex items-center justify-center gap-2.5 py-3 rounded-2xl font-semibold text-white transition-all hover:scale-[1.02] active:scale-95 overflow-hidden"
                                        style={{ background: themeGradient, boxShadow: themeShadow }}
                                    >
                                        {/* Gesture hold fill overlay */}
                                        {boothSettings.gesturesEnabled && gestureHoldTarget === 'confirm' && (
                                            <div
                                                className="absolute inset-0 rounded-2xl bg-white/20"
                                                style={{ width: `${gestureHoldProgress}%`, transition: 'width 0.05s linear' }}
                                            />
                                        )}
                                        <span className="relative text-lg">📸</span>
                                        <span className="relative text-sm font-bold">
                                            {boothSettings.gesturesEnabled && gestureHoldTarget === 'confirm'
                                                ? `Snapping… ${Math.round(gestureHoldProgress)}%`
                                                : 'Snap!'}
                                        </span>
                                    </button>

                                    {boothSettings.gesturesEnabled && (
                                        <div className="shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs text-white/40"
                                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                            <span>👍</span>
                                            <span>or snap</span>
                                        </div>
                                    )}

                                    {devices.length > 1 && (
                                        <select
                                            className="bg-black/50 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none hover:bg-white/10 cursor-pointer appearance-none shrink-0"
                                            value={selectedDeviceId} onChange={handleDeviceChange} title="Switch Camera"
                                        >
                                            {devices.map((d, i) => (
                                                <option key={d.deviceId} value={d.deviceId} className="bg-gray-900">{d.label || `Camera ${i + 1}`}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}

                            {/* Countdown: cancel only */}
                            {captureSubState === 'countdown' && (
                                <div className="flex justify-center">
                                    <button
                                        onClick={handleRetakeSlot}
                                        className="px-6 py-2.5 rounded-xl border border-white/15 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm"
                                    >✕ Cancel</button>
                                </div>
                            )}

                            {/* Preview: Retake + Keep buttons (always) + gesture overlays if enabled */}
                            {captureSubState === 'preview' && (
                                <div className="w-full flex items-center gap-3">
                                    {/* Retake button */}
                                    <div className="relative overflow-hidden rounded-2xl shrink-0">
                                        {boothSettings.gesturesEnabled && gestureHoldTarget === 'retake' && (
                                            <div
                                                className="absolute inset-y-0 left-0 bg-red-500/30 rounded-2xl"
                                                style={{ width: `${gestureHoldProgress}%`, transition: 'width 0.05s linear' }}
                                            />
                                        )}
                                        <button
                                            id="retake-slot-button"
                                            onClick={handleRetakeSlot}
                                            className="relative flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white/80 hover:text-white transition-colors"
                                            style={{
                                                background: boothSettings.gesturesEnabled && gestureHoldTarget === 'retake'
                                                    ? 'rgba(248,113,113,0.15)'
                                                    : 'rgba(255,255,255,0.06)',
                                                border: boothSettings.gesturesEnabled && gestureHoldTarget === 'retake'
                                                    ? '1px solid rgba(248,113,113,0.4)'
                                                    : '1px solid rgba(255,255,255,0.12)',
                                                borderRadius: '16px',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            {boothSettings.gesturesEnabled && <span className="text-base">✋</span>}
                                            <span>🔄 Retake</span>
                                        </button>
                                    </div>

                                    {/* Keep / auto-keep bar */}
                                    <div className="relative flex-1 h-12 rounded-2xl overflow-hidden"
                                        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${tc}30` }}>
                                        {/* Auto-keep fill (10s) */}
                                        <div
                                            className="absolute inset-y-0 left-0 rounded-2xl"
                                            style={{
                                                width: `${autoKeepProgress}%`,
                                                background: `linear-gradient(90deg, ${tc}25, ${tc}50)`,
                                                transition: 'width 0.05s linear',
                                            }}
                                        />
                                        {/* Thumbsup instant-keep overlay */}
                                        {boothSettings.gesturesEnabled && gestureHoldTarget === 'confirm' && (
                                            <div
                                                className="absolute inset-y-0 left-0 rounded-2xl"
                                                style={{
                                                    width: `${gestureHoldProgress}%`,
                                                    background: `linear-gradient(90deg, ${tc}80, ${tc})`,
                                                    transition: 'width 0.05s linear',
                                                }}
                                            />
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center gap-2">
                                            <span className="text-base">
                                                {boothSettings.gesturesEnabled && gestureHoldTarget === 'confirm' ? '👍' : '✅'}
                                            </span>
                                            <span className="text-sm font-semibold text-white/80">
                                                {boothSettings.gesturesEnabled && gestureHoldTarget === 'confirm'
                                                    ? `Keeping now… ${Math.round(gestureHoldProgress)}%`
                                                    : currentSlotIndex + 1 >= selectedTemplate.slots.length
                                                    ? 'Keep & Finish'
                                                    : 'Keep & Next →'}
                                            </span>
                                        </div>
                                        {/* Tap anywhere = immediate keep */}
                                        <button
                                            id="keep-slot-button"
                                            onClick={handleKeepSlot}
                                            className="absolute inset-0 w-full h-full opacity-0"
                                            aria-label="Keep photo"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Thumbnail strip — active slot auto-scrolls into view */}
                        <div className="flex gap-3 mt-5 overflow-x-auto pb-1 max-w-full" style={{ scrollbarWidth: 'none' }}>
                            {selectedTemplate.slots.map((_: any, i: number) => (
                                <div
                                    key={i}
                                    ref={(el) => {
                                        if (el && i === currentSlotIndex) {
                                            el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                        }
                                    }}
                                    className={`shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all duration-300 ${i === currentSlotIndex && captureSubState === 'preview'
                                            ? 'scale-110'
                                            : capturedPhotos[i]
                                                ? 'shadow-lg'
                                                : i === currentSlotIndex
                                                    ? 'border-white/60 animate-pulse'
                                                    : 'border-white/10'
                                        }`}
                                    style={{
                                        borderColor: i === currentSlotIndex && captureSubState === 'preview'
                                            ? tc
                                            : capturedPhotos[i] ? tc : undefined,
                                        boxShadow: i === currentSlotIndex && captureSubState === 'preview'
                                            ? `0 0 16px ${tc}80`
                                            : capturedPhotos[i] ? `0 4px 12px ${tc}40` : undefined,
                                    }}
                                >
                                    {capturedPhotos[i] ? (
                                        <img src={capturedPhotos[i]} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-600 text-xs font-bold">{i + 1}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    );
                })()}

                {/* ── STEP: Review ──────────────────────────────────────── */}
                {step === 'review' && selectedTemplate && (
                    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 animate-slideUp">
                        <h2 className="text-3xl font-bold mb-8">Looking Good? 🔥</h2>

                        {/* Composite preview - Unified Layout Engine */}
                        <div
                            className="relative shadow-2xl mx-auto overflow-hidden rounded-3xl"
                            style={{
                                width: 'min(90vw, 600px)',
                                aspectRatio: (() => {
                                    const W = 420;
                                    const PAD = selectedTemplate.padding;
                                    const GAP = selectedTemplate.gap;
                                    const cols = selectedTemplate.layout.cols;
                                    const rows = selectedTemplate.layout.rows;
                                    const gridW = W - PAD * 2;
                                    const slotW = (gridW - GAP * (cols - 1)) / cols;
                                    const slotAspectRatio = rows > cols ? 3 / 2 : 16 / 9;
                                    const slotH = slotW / slotAspectRatio;
                                    const gridH = slotH * rows + GAP * (rows - 1);
                                    const H = gridH + PAD * 2 + 60; // 60 for watermark
                                    return `${W} / ${H}`;
                                })(),
                                containerType: 'inline-size', // Enable cqw units
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

                            {/* 2. Slot Grid (Render Photos) */}
                            <div className="absolute inset-0 w-full h-full">
                                {selectedTemplate.slots.map((_: any, i: number) => {
                                    const cols = selectedTemplate.layout.cols;
                                    const rows = selectedTemplate.layout.rows;
                                    const pad = selectedTemplate.padding;
                                    const gap = selectedTemplate.gap;

                                    const W = 420;
                                    const gridW = W - pad * 2;
                                    const slotW = (gridW - gap * (cols - 1)) / cols;
                                    const slotAspectRatio = rows > cols ? 3 / 2 : 16 / 9;
                                    const slotH = slotW / slotAspectRatio;
                                    const gridH = slotH * rows + gap * (rows - 1);
                                    const H = gridH + pad * 2 + 60;

                                    const padPctX = (pad / W) * 100;
                                    const padPctY = ((pad + 30) / H) * 100; // Add 30 to center vertically, matching generateComposite
                                    const gapPctX = (gap / W) * 100;
                                    const gapPctY = (gap / H) * 100;

                                    const cellW = (slotW / W) * 100;
                                    const cellH = (slotH / H) * 100;


                                    const r = Math.floor(i / cols);
                                    const c = i % cols;

                                    return (
                                        <div
                                            key={i}
                                            className="absolute overflow-hidden rounded-lg bg-black/10"
                                            style={{
                                                left: `${padPctX + (c * (cellW + gapPctX))}%`,
                                                top: `${padPctY + (r * (cellH + gapPctY))}%`,
                                                width: `${cellW}%`,
                                                height: `${cellH}%`,
                                                borderRadius: `${selectedTemplate.borderRadius}px`, // approximate match? 
                                                // Actually lets use % or just standard px since container scales.
                                                // To match exactly, we might want to scale radius too. 
                                                // For now, fixed px is usually ok or use %.
                                            }}
                                        >
                                            {capturedPhotos[i] ? (
                                                <img src={capturedPhotos[i]} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500">No photo</div>
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

                            {/* Watermark */}
                            {selectedTemplate.watermarkText && (
                                <div className="absolute bottom-2 left-0 right-0 text-center" style={{ fontSize: '2cqw', opacity: 0.3, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', pointerEvents: 'none' }}>
                                    {selectedTemplate.watermarkText}
                                </div>
                            )}
                        </div>

                        {/* Actions + 👍 gesture for confirm */}
                        <div className="flex flex-col items-center gap-3 mt-8">
                            <div className="flex gap-4">
                                <button
                                    onClick={handleRetake}
                                    className="px-6 py-3 rounded-xl border-2 border-white/20 text-white hover:bg-white/10 transition-all font-semibold flex items-center gap-2"
                                >
                                    🔄 Retake All
                                </button>
                                <button
                                    id="confirm-qr-button"
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

                            {/* Thumbs-up gesture hint */}
                            <div className="relative w-full flex justify-center mt-1">
                                {/* Hidden video element for gesture-only camera on review screen */}
                                <video ref={reviewVideoRef} autoPlay playsInline muted className="hidden" />

                                <GestureDetector
                                    videoRef={reviewVideoRef}
                                    mode="confirm"
                                    onRetake={() => { }}
                                    onConfirm={handleConfirmAndGenerateQR}
                                    themeColor={tc}
                                />
                            </div>
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
