'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TemplateConfig, PRESET_TEMPLATES } from '@/components/templates/TemplateDesigner';
import TemplatePreview from '@/components/templates/TemplatePreview';
import PrintDesigner from '@/components/PrintDesigner';
import QRCode from 'react-qr-code';

import { 
    FlipHorizontal, Video, ZoomIn, ZoomOut, 
    RotateCcw, RotateCw, Plus, X, ArrowUp, ArrowDown, Trash2, Printer 
} from 'lucide-react';

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
    // Sub-state within the 'capture' step: live camera | counting down | previewing just-taken photo
    const [captureSubState, setCaptureSubState] = useState<'live' | 'countdown' | 'preview'>('live');
    const [countdown, setCountdown] = useState<number | null>(null);
    const [flashActive, setFlashActive] = useState(false);

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


    // Derived theme values
    const tc = boothSettings.themeColor || '#6366f1';
    const hsl = hexToHSL(tc);
    const themeGradient = `linear-gradient(135deg, ${tc}, hsl(${(hsl.h + 30) % 360}, ${hsl.s}%, ${hsl.l}%))`;
    const themeShadow = `0 10px 40px ${tc}40`;
    const themeBgSubtle = `linear-gradient(135deg, hsl(${hsl.h}, ${hsl.s}%, 8%) 0%, #030712 50%, hsl(${(hsl.h + 30) % 360}, ${Math.max(hsl.s - 20, 10)}%, 10%) 100%)`;

    // Camera Selection State
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [isMirrored, setIsMirrored] = useState(true);
    const [zoom, setZoom] = useState(1);

    // Movable Photos State (for Review step)
    const [photoTransforms, setPhotoTransforms] = useState<any[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [dragTarget, setDragTarget] = useState<number | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0, photoX: 0, photoY: 0 });
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, index: number } | null>(null);

    // Print designer state
    const [showPrintPicker, setShowPrintPicker] = useState(false);
    const [printCompositeUrl, setPrintCompositeUrl] = useState<string | null>(null);
    const [generatingPrint, setGeneratingPrint] = useState(false);

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

        if (isMirrored) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }

        // Apply Zoom to source crop
        const zWidth = sWidth / zoom;
        const zHeight = sHeight / zoom;
        const zx = sx + (sWidth - zWidth) / 2;
        const zy = sy + (sHeight - zHeight) / 2;

        ctx.drawImage(video, zx, zy, zWidth, zHeight, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.95);
    }, [selectedTemplate, isMirrored, zoom]);

    // ── Step Handlers ──────────────────────────────────────────────────

    const handleSelectTemplate = async (tpl: TemplateConfig) => {
        setSelectedTemplate(tpl);
        setCapturedPhotos(new Array(tpl.slots.length).fill(null));
        setPhotoTransforms(tpl.slots.map((slot, i) => ({
            id: i,
            x: slot.x,
            y: slot.y,
            width: slot.width,
            height: slot.height,
            rotation: slot.rotation || 0,
            scale: 1,
            zIndex: i + 10
        })));
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
        const url = await generateAndSaveComposite();
        if (url) {
            setDownloadUrl(url);
            setStep('qr');
        }
    };

    const handleOpenPrintPicker = async () => {
        setGeneratingPrint(true);
        setShowPrintPicker(true);
        const compositeDataUrl = await generateComposite();
        setPrintCompositeUrl(compositeDataUrl);
        setGeneratingPrint(false);
    };



    const generateAndSaveComposite = async (existingDataUrl?: string) => {
        if (!selectedTemplate || !event) return null;
        setUploadingComposite(true);

        try {
            const compositeDataUrl = existingDataUrl || await generateComposite();
            if (!compositeDataUrl) throw new Error('Failed to generate composite');

            const res = await fetch(compositeDataUrl);
            const blob = await res.blob();
            const fileName = `${event.slug}/${Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('booth-photos')
                .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                handleFallbackDownload(compositeDataUrl);
                return null;
            }

            const { data: urlData } = supabase.storage.from('booth-photos').getPublicUrl(fileName);
            const publicUrl = urlData.publicUrl;

            const { data: photoRecord, error: insertError } = await supabase
                .from('photos')
                .insert({ event_id: event.id, storage_path: fileName, image_url: publicUrl })
                .select('id').single();

            if (insertError) {
                console.error('Insert error:', insertError);
                handleFallbackDownload(compositeDataUrl);
                return null;
            }

            return `${window.location.origin}/download/${photoRecord.id}`;
        } catch (err) {
            console.error('Error in generateAndSaveComposite:', err);
            return null;
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
        const SCALE = 4; // High resolution output
        const W = selectedTemplate.width * SCALE;
        const H = selectedTemplate.height * SCALE;

        compositeCanvas.width = W;
        compositeCanvas.height = H;
        const ctx = compositeCanvas.getContext('2d');
        if (!ctx) { return null; }

        // Helper to load an image
        const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((res, rej) => {
                const img = new window.Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => res(img);
                img.onerror = rej;
                img.src = src;
            });
        };

        try {
            // ── 1. Background ────────────────────────────────────────────
            if (selectedTemplate.backgroundImage) {
                try {
                    const bg = await loadImage(selectedTemplate.backgroundImage);
                    ctx.drawImage(bg, 0, 0, W, H);
                } catch {
                    ctx.fillStyle = selectedTemplate.background || '#ffffff';
                    ctx.fillRect(0, 0, W, H);
                }
            } else {
                ctx.fillStyle = selectedTemplate.background || '#ffffff';
                ctx.fillRect(0, 0, W, H);
            }

            // ── 2. Unified Z-Index Sorted Rendering ──────────────────────
            // Uses direct zIndex values from the template (same as TemplateVisualizer/TemplateDesigner)

            interface RenderItem {
                type: 'slot' | 'sticker' | 'text';
                zIndex: number;
                data: any;
                slotIndex?: number;
            }

            const renderList: RenderItem[] = [];

            // Add photo slots
            selectedTemplate.slots.forEach((slot, i) => {
                renderList.push({ type: 'slot', zIndex: slot.zIndex ?? 0, data: slot, slotIndex: i });
            });

            // Add stickers
            (selectedTemplate.stickers || []).forEach(sticker => {
                renderList.push({ type: 'sticker', zIndex: sticker.zIndex ?? 0, data: sticker });
            });

            // Add text elements
            (selectedTemplate.textElements || []).forEach(txt => {
                renderList.push({ type: 'text', zIndex: txt.zIndex ?? 0, data: txt });
            });

            // Sort by z-index (lowest first = painted first = behind)
            renderList.sort((a, b) => a.zIndex - b.zIndex);

            // Draw each element in z-order
            for (const item of renderList) {
                if (item.type === 'slot') {
                    const i = item.slotIndex!;
                    const transform = photoTransforms[i];
                    if (!transform) continue;
                    const slot = item.data;
                    const photoSrc = capturedPhotos[i];

                    const sw = (transform.width / 100) * W * (transform.scale || 1);
                    const sh = (transform.height / 100) * H * (transform.scale || 1);
                    const sx = (transform.x / 100) * W;
                    const sy = (transform.y / 100) * H;
                    const radius = (selectedTemplate.borderRadius / 4) * SCALE;

                    ctx.save();
                    ctx.translate(sx + sw / 2, sy + sh / 2);
                    ctx.rotate(((transform.rotation || 0) * Math.PI) / 180);

                    // Draw slot background (black placeholder)
                    ctx.beginPath();
                    ctx.roundRect(-sw / 2, -sh / 2, sw, sh, radius);
                    ctx.fillStyle = '#000000';
                    ctx.fill();

                    // Draw captured photo if available
                    if (photoSrc) {
                        ctx.beginPath();
                        ctx.roundRect(-sw / 2, -sh / 2, sw, sh, radius);
                        ctx.clip();

                        const img = await loadImage(photoSrc);
                        const imgAspect = img.width / img.height;
                        const slotAspect = sw / sh;
                        let drawSW = img.width, drawSH = img.height;
                        let drawSX = 0, drawSY = 0;

                        if (imgAspect > slotAspect) {
                            drawSW = img.height * slotAspect;
                            drawSX = (img.width - drawSW) / 2;
                        } else {
                            drawSH = img.width / slotAspect;
                            drawSY = (img.height - drawSH) / 2;
                        }

                        ctx.drawImage(img, drawSX, drawSY, drawSW, drawSH, -sw / 2, -sh / 2, sw, sh);
                    }

                    ctx.restore();

                    // Draw slot border (outside clip)
                    if (selectedTemplate.borderWidth > 0) {
                        ctx.save();
                        ctx.translate(sx + sw / 2, sy + sh / 2);
                        ctx.rotate(((slot.rotation || 0) * Math.PI) / 180);
                        ctx.strokeStyle = selectedTemplate.borderColor;
                        ctx.lineWidth = (selectedTemplate.borderWidth / 2) * SCALE;
                        ctx.beginPath();
                        ctx.roundRect(-sw / 2, -sh / 2, sw, sh, radius);
                        ctx.stroke();
                        ctx.restore();
                    }

                } else if (item.type === 'sticker') {
                    const stk = item.data;
                    try {
                        const img = await loadImage(stk.src);
                        const stkW = (stk.width / selectedTemplate.width) * W;
                        const stkH = (img.height / img.width) * stkW;
                        const stkX = (stk.x / 100) * W;
                        const stkY = (stk.y / 100) * H;

                        ctx.save();
                        ctx.translate(stkX, stkY);
                        ctx.rotate(((stk.rotation || 0) * Math.PI) / 180);
                        ctx.scale(stk.flipX ? -1 : 1, stk.flipY ? -1 : 1);
                        ctx.globalAlpha = stk.opacity ?? 1;
                        ctx.drawImage(img, -stkW / 2, -stkH / 2, stkW, stkH);
                        ctx.restore();
                    } catch (e) {
                        console.warn('Failed to load sticker:', stk.src, e);
                    }

                } else if (item.type === 'text') {
                    const txt = item.data;
                    const txtX = (txt.x / 100) * W;
                    const txtY = (txt.y / 100) * H;
                    const fontSize = txt.fontSize * SCALE;

                    ctx.save();
                    ctx.translate(txtX, txtY);
                    ctx.rotate(((txt.rotation || 0) * Math.PI) / 180);
                    ctx.globalAlpha = txt.opacity ?? 1;
                    ctx.font = `${txt.fontStyle || ''} ${txt.fontWeight || ''} ${fontSize}px ${txt.fontFamily || 'sans-serif'}`.trim();
                    ctx.fillStyle = txt.color || '#000000';
                    ctx.textAlign = (txt.textAlign as CanvasTextAlign) || 'center';
                    ctx.textBaseline = 'middle';

                    if (txt.letterSpacing) {
                        // Manual letter spacing
                        const chars = txt.text.split('');
                        let xOffset = 0;
                        const totalWidth = chars.reduce((acc: number, ch: string) => acc + ctx.measureText(ch).width + (txt.letterSpacing * SCALE), 0);
                        let startX = txt.textAlign === 'center' ? -totalWidth / 2 : 0;
                        chars.forEach((ch: string) => {
                            ctx.fillText(ch, startX + xOffset, 0);
                            xOffset += ctx.measureText(ch).width + (txt.letterSpacing * SCALE);
                        });
                    } else {
                        ctx.fillText(txt.text, 0, 0);
                    }
                    ctx.restore();
                }
            }

            // ── 3. Global Overlays ──────────────────────────────────────
            // Template outer border
            if (selectedTemplate.borderWidth > 0) {
                ctx.strokeStyle = selectedTemplate.borderColor;
                ctx.lineWidth = selectedTemplate.borderWidth * SCALE * 2;
                const outerRadius = (selectedTemplate.borderRadius) * SCALE;
                ctx.beginPath();
                ctx.roundRect(0, 0, W, H, outerRadius);
                ctx.stroke();
            }

            // Watermark
            if (selectedTemplate.watermarkText) {
                const wmFontSize = 10 * SCALE;
                ctx.font = `bold ${wmFontSize}px sans-serif`;
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(selectedTemplate.watermarkText.toUpperCase(), W / 2, H - (10 * SCALE));
            }

            return compositeCanvas.toDataURL('image/jpeg', 0.95);
        } catch (err) {
            console.error('Error in generateComposite:', err);
            return null;
        }
    };

    // ── Review Drag Logic ───────────────────────────────────────────
    const startPhotoDrag = (e: React.MouseEvent, index: number) => {
        if (step !== 'review') return;
        e.preventDefault();
        setIsDragging(true);
        setDragTarget(index);
        const transform = photoTransforms[index];
        setDragStart({
            x: e.clientX,
            y: e.clientY,
            photoX: transform.x,
            photoY: transform.y
        });
        
        // Bring to front on click
        const maxZ = Math.max(...photoTransforms.map(p => p.zIndex || 0), 10);
        updatePhotoTransform(index, { zIndex: maxZ + 1 });
    };

    const handleWorkspaceMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || dragTarget === null) return;
        
        const deltaX = ((e.clientX - dragStart.x) / window.innerWidth) * 100;
        const deltaY = ((e.clientY - dragStart.y) / window.innerHeight) * 100;
        
        updatePhotoTransform(dragTarget, {
            x: dragStart.photoX + deltaX,
            y: dragStart.photoY + deltaY
        });
    };

    const handleWorkspaceMouseUp = () => {
        setIsDragging(false);
        setDragTarget(null);
    };

    const updatePhotoTransform = (index: number, updates: any) => {
        setPhotoTransforms(prev => prev.map((p, i) => i === index ? { ...p, ...updates } : p));
    };

    const handlePhotoContextMenu = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, index });
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
                    <div className="w-16 h-1 bg-white/10 mx-auto mb-8 rounded-full" />
                    <h1 className="text-2xl font-black uppercase tracking-widest mb-2">Access Denied</h1>
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
                            <div className="mb-8 flex justify-center">
                                <div className="w-16 h-1 w-24 bg-white/10 rounded-full" />
                            </div>
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

                            <div className="mt-20 grid grid-cols-3 gap-12 text-center max-w-xl mx-auto">
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">01. Protocol</p>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Select Layout</p>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">02. Execute</p>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Capture Phase</p>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">03. Distribute</p>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Digital Transfer</p>
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
                        <div className="w-full max-w-2xl text-center mb-8">
                            <h2 className="text-4xl font-black text-white uppercase tracking-tight mb-3">Calibration Phase</h2>
                            <p className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.3em]">Adjust your position and verify optical feed</p>
                        </div>

                        <div className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden bg-black border-2 border-white/10 shadow-2xl">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                                style={{ transform: `${isMirrored ? 'scaleX(-1)' : ''} scale(${zoom})` }}
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

                            {/* Mirror Toggle Button */}
                            <div className="absolute top-4 left-4 z-20">
                                <button
                                    onClick={() => setIsMirrored(!isMirrored)}
                                    className="bg-black/50 backdrop-blur-md border border-white/20 rounded-full p-3 text-white hover:bg-black/70 transition-all flex items-center justify-center group"
                                    title={isMirrored ? "Disable Mirror" : "Enable Mirror"}
                                >
                                    {isMirrored ? (
                                        <FlipHorizontal size={18} className="group-hover:scale-110 transition-transform" />
                                    ) : (
                                        <Video size={18} className="group-hover:scale-110 transition-transform" />
                                    )}
                                </button>
                            </div>
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
                                className="px-16 py-6 rounded-full text-white font-black text-sm uppercase tracking-[0.4em] shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-4"
                                style={{ background: themeGradient, boxShadow: themeShadow }}
                            >
                                Initiate Sequence
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP: Capture (One-by-One) ────────────────────────── */}
                {step === 'capture' && selectedTemplate && (() => {
                    const W = selectedTemplate.width;
                    const H = selectedTemplate.height;

                    return (
                        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
                            {/* Header + progress bar */}
                            <div className="w-full max-w-2xl mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">
                                        Sequence <span style={{ color: tc }}>{currentSlotIndex + 1}</span> / {selectedTemplate.slots.length}
                                    </h2>
                                    <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                                        {captureSubState === 'countdown' ? 'Arming System...' : captureSubState === 'preview' ? 'Verify Capture' : 'Ready for Input'}
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
                                className="relative overflow-hidden bg-black shadow-2xl mx-auto"
                                style={{
                                    borderColor: captureSubState === 'preview' ? tc : (selectedTemplate.borderColor || 'rgba(255,255,255,0.1)'),
                                    boxShadow: captureSubState === 'preview' ? `0 0 40px ${tc}40` : undefined,
                                    aspectRatio: `${W} / ${H}`,
                                    height: 'min(70vh, 800px)',
                                    width: 'auto',
                                    maxWidth: '100%',
                                    borderRadius: `${selectedTemplate.borderRadius}px`,
                                    borderWidth: `${selectedTemplate.borderWidth || 0}px`,
                                    borderStyle: 'solid',
                                    containerType: 'inline-size',
                                }}
                            >
                                {/* Background */}
                                <div
                                    className="absolute inset-0 w-full h-full"
                                    style={{
                                        background: selectedTemplate.background,
                                        backgroundImage: selectedTemplate.backgroundImage ? `url(${selectedTemplate.backgroundImage})` : undefined,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                    }}
                                />

                                {/* Unified sorted render: slots, stickers, text in z-order */}
                                {[
                                    ...selectedTemplate.slots.map((slot: any, i: number) => ({ type: 'slot' as const, zIndex: slot.zIndex ?? 0, data: slot, slotIndex: i })),
                                    ...(selectedTemplate.stickers || []).map((stk: any) => ({ type: 'sticker' as const, zIndex: stk.zIndex ?? 0, data: stk })),
                                    ...selectedTemplate.textElements.map((el: any) => ({ type: 'text' as const, zIndex: el.zIndex ?? 0, data: el })),
                                ].sort((a, b) => a.zIndex - b.zIndex).map((item) => {
                                    if (item.type === 'slot') {
                                        const slot = item.data;
                                        const i = item.slotIndex!;
                                        const isCurrent = i === currentSlotIndex;
                                        const showCamera = isCurrent && (captureSubState === 'live' || captureSubState === 'countdown') && !capturedPhotos[i];
                                        return (
                                            <div
                                                key={slot.id}
                                                className="absolute overflow-hidden bg-black/10 transition-all duration-300"
                                                style={{
                                                    left: `${slot.x}%`,
                                                    top: `${slot.y}%`,
                                                    width: `${slot.width}%`,
                                                    height: `${slot.height}%`,
                                                    transform: `rotate(${slot.rotation || 0}deg)`,
                                                    zIndex: item.zIndex,
                                                    borderRadius: `${selectedTemplate.borderRadius / 4}px`,
                                                    border: selectedTemplate.borderWidth > 0 ? `${selectedTemplate.borderWidth / 2}px solid ${selectedTemplate.borderColor}` : 'none',
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
                                                            style={{ transform: `${isMirrored ? 'scaleX(-1)' : ''} scale(${zoom})` }}
                                                        />
                                                    </div>
                                                )}
                                                {!capturedPhotos[i] && !showCamera && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60">
                                                        <span className="text-gray-600 text-[10px] font-black uppercase tracking-widest">P{i + 1}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    if (item.type === 'sticker') {
                                        const stk = item.data;
                                        return (
                                            <div key={stk.id} style={{
                                                position: 'absolute',
                                                left: `${stk.x}%`,
                                                top: `${stk.y}%`,
                                                width: `calc(${stk.width} / ${selectedTemplate.width} * 100cqw)`,
                                                transform: `translate(-50%, -50%) rotate(${stk.rotation}deg)`,
                                                zIndex: item.zIndex,
                                                pointerEvents: 'none',
                                            }}>
                                                <img src={stk.src} className="w-full h-auto drop-shadow-md" />
                                            </div>
                                        );
                                    }
                                    const el = item.data;
                                    return (
                                        <div key={el.id} style={{
                                            position: 'absolute',
                                            left: `${el.x}%`,
                                            top: `${el.y}%`,
                                            transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
                                            color: el.color,
                                            fontSize: `calc(${el.fontSize} / ${selectedTemplate.width} * 100cqw)`,
                                            fontFamily: el.fontFamily,
                                            fontWeight: el.fontWeight,
                                            fontStyle: el.fontStyle,
                                            width: 'max-content',
                                            textShadow: el.textShadow,
                                            zIndex: item.zIndex,
                                            pointerEvents: 'none',
                                        }}>{el.text}</div>
                                    );
                                })}

                            {/* Countdown is rendered as a fixed fullscreen overlay — see below */}



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
                                        style={{ transform: `${isMirrored ? 'scaleX(-1)' : ''} scale(${zoom})` }}
                                    />
                                    
                                    {/* Main Focus Frame */}
                                    <div className="relative z-10 border-8 border-white/20 rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] transition-all duration-500 scale-110"
                                        style={{ 
                                            aspectRatio: `${selectedTemplate.width} / ${selectedTemplate.height}`,
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
                                            style={{ transform: `${isMirrored ? 'scaleX(-1)' : ''} scale(${zoom})` }}
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
                                        <span className="relative text-[10px] font-black uppercase tracking-widest">
                                            Trigger Capture
                                        </span>
                                    </button>

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

                                    {/* Mirror Toggle Button */}
                                    <button
                                        onClick={() => setIsMirrored(!isMirrored)}
                                        className="bg-black/50 border border-white/15 rounded-xl p-3 text-white hover:bg-white/10 transition-all flex items-center justify-center group shrink-0"
                                        title={isMirrored ? "Disable Mirror" : "Enable Mirror"}
                                    >
                                        {isMirrored ? (
                                            <FlipHorizontal size={18} className="group-hover:scale-110 transition-transform" />
                                        ) : (
                                            <Video size={18} className="group-hover:scale-110 transition-transform" />
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Zoom Slider at the Bottom */}
                            {captureSubState === 'live' && (
                                <div className="w-full max-w-md mt-2 flex items-center gap-4 bg-black/40 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-2xl shadow-2xl">
                                    <ZoomOut size={16} className="text-white/40" />
                                    <input 
                                        type="range" 
                                        min={1} 
                                        max={3} 
                                        step={0.1} 
                                        value={zoom} 
                                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                                        className="flex-1 accent-white"
                                    />
                                    <ZoomIn size={16} className="text-white/40" />
                                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest min-w-[3rem] text-right">
                                        {zoom.toFixed(1)}x
                                    </span>
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
                                        <button
                                            id="retake-slot-button"
                                            onClick={handleRetakeSlot}
                                            className="relative flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white/80 hover:text-white transition-colors border border-white/10 rounded-2xl"
                                            style={{
                                                background: 'rgba(255,255,255,0.06)',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-widest">Retake Sequence</span>
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
                                        <div className="absolute inset-0 flex items-center justify-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                                                READY
                                            </span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                                                {currentSlotIndex + 1 >= selectedTemplate.slots.length
                                                    ? 'Finalize Sequence'
                                                    : 'Continue Protocol'}
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
                        <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-10">Verification Protocol</h2>

                        {/* Composite preview - Unified Layout Engine */}
                        <div
                            className="relative shadow-2xl mx-auto overflow-hidden"
                            style={{
                                width: 'min(90vw, 600px)',
                                aspectRatio: `${selectedTemplate.width} / ${selectedTemplate.height}`,
                                containerType: 'inline-size', 
                                borderRadius: `${selectedTemplate.borderRadius}px`,
                                borderWidth: `${selectedTemplate.borderWidth || 0}px`,
                                borderColor: selectedTemplate.borderColor || 'transparent',
                                borderStyle: 'solid'
                            }}
                        >
                            {/* Background */}
                            <div
                                className="absolute inset-0 w-full h-full"
                                style={{
                                    background: selectedTemplate.background,
                                    backgroundImage: selectedTemplate.backgroundImage ? `url(${selectedTemplate.backgroundImage})` : undefined,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                            />

                            {/* Unified sorted render: slots (draggable), stickers, text in z-order */}
                            <div className="absolute inset-0 w-full h-full"
                                 onMouseMove={handleWorkspaceMouseMove}
                                 onMouseUp={handleWorkspaceMouseUp}
                                 onMouseLeave={handleWorkspaceMouseUp}>
                                {[
                                    ...selectedTemplate.slots.map((slot, i) => ({ type: 'slot' as const, zIndex: slot.zIndex ?? 0, data: slot, slotIndex: i })),
                                    ...(selectedTemplate.stickers || []).map((stk) => ({ type: 'sticker' as const, zIndex: stk.zIndex ?? 0, data: stk })),
                                    ...selectedTemplate.textElements.map((el) => ({ type: 'text' as const, zIndex: el.zIndex ?? 0, data: el })),
                                ].sort((a, b) => a.zIndex - b.zIndex).map((item) => {
                                    if (item.type === 'slot') {
                                        const i = item.slotIndex!;
                                        const transform = photoTransforms[i];
                                        if (!transform) return null;
                                        return (
                                            <div
                                                key={item.data.id}
                                                onMouseDown={(e) => startPhotoDrag(e, i)}
                                                onContextMenu={(e) => handlePhotoContextMenu(e, i)}
                                                className={`absolute overflow-hidden transition-shadow duration-300 cursor-move ${dragTarget === i ? 'ring-2 ring-white/50 shadow-2xl' : ''}`}
                                                style={{
                                                    left: `${transform.x}%`,
                                                    top: `${transform.y}%`,
                                                    width: `${transform.width}%`,
                                                    height: `${transform.height}%`,
                                                    transform: `rotate(${transform.rotation || 0}deg) scale(${transform.scale || 1})`,
                                                    zIndex: item.zIndex,
                                                    borderRadius: `${selectedTemplate.borderRadius / 4}px`,
                                                    border: selectedTemplate.borderWidth > 0 ? `${selectedTemplate.borderWidth / 2}px solid ${selectedTemplate.borderColor}` : 'none',
                                                }}
                                            >
                                                {capturedPhotos[i] ? (
                                                    <img src={capturedPhotos[i]} alt={`Photo ${i + 1}`} className="w-full h-full object-cover pointer-events-none" />
                                                ) : (
                                                    <div className="w-full h-full bg-gray-800 flex items-center justify-center text-gray-500">No photo</div>
                                                )}
                                            </div>
                                        );
                                    }
                                    if (item.type === 'sticker') {
                                        const stk = item.data;
                                        return (
                                            <div key={stk.id} style={{
                                                position: 'absolute',
                                                left: `${stk.x}%`,
                                                top: `${stk.y}%`,
                                                width: `calc(${stk.width} / ${selectedTemplate.width} * 100cqw)`,
                                                transform: `translate(-50%, -50%) rotate(${stk.rotation}deg)`,
                                                zIndex: item.zIndex,
                                                pointerEvents: 'none',
                                            }}>
                                                <img src={stk.src} className="w-full h-auto drop-shadow-md" />
                                            </div>
                                        );
                                    }
                                    const el = item.data;
                                    return (
                                        <div key={el.id} style={{
                                            position: 'absolute',
                                            left: `${el.x}%`,
                                            top: `${el.y}%`,
                                            transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
                                            color: el.color,
                                            fontSize: `calc(${el.fontSize} / ${selectedTemplate.width} * 100cqw)`,
                                            fontFamily: el.fontFamily,
                                            fontWeight: el.fontWeight,
                                            fontStyle: el.fontStyle,
                                            width: 'max-content',
                                            textShadow: el.textShadow,
                                            zIndex: item.zIndex,
                                            pointerEvents: 'none',
                                        }}>
                                            {el.text}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Watermark */}
                            {selectedTemplate.watermarkText && (
                                <div className="absolute bottom-2 left-0 right-0 text-center" style={{ fontSize: '2cqw', opacity: 0.3, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', pointerEvents: 'none' }}>
                                    {selectedTemplate.watermarkText}
                                </div>
                            )}
                        </div>

                        {/* Actions + Gesture for confirm */}
                        <div className="flex flex-col items-center gap-3 mt-8">
                            <div className="flex gap-4">
                                <button
                                    onClick={handleRetake}
                                    className="px-6 py-3 rounded-xl border-2 border-white/20 text-white hover:bg-white/10 transition-all font-semibold flex items-center gap-2"
                                >
                                    Reset All
                                </button>
                                <button
                                    id="confirm-qr-button"
                                    onClick={handleConfirmAndGenerateQR}
                                    disabled={uploadingComposite}
                                    className="px-8 py-3 rounded-xl text-white font-bold shadow-xl hover:shadow-2xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed border border-white/20"
                                    style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}
                                >
                                    {uploadingComposite ? '...' : 'Digital Copy'}
                                </button>
                                <button
                                    onClick={handleOpenPrintPicker}
                                    disabled={uploadingComposite}
                                    className="px-10 py-3 rounded-xl text-white font-black shadow-2xl hover:shadow-indigo-500/40 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                                    style={{ background: themeGradient, boxShadow: themeShadow }}
                                >
                                    <Printer size={18} />
                                    <span>Print Souvenir</span>
                                </button>
                            </div>


                        </div>
                    </div>
                )}

                {/* ── GENERATING PRINT COMPOSITE LOADING OVERLAY ───────── */}
                {generatingPrint && (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}>
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin" />
                            <span className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">Preparing print studio…</span>
                        </div>
                    </div>
                )}

                {/* ── FULL PRINT DESIGNER ───────────────────────────────── */}
                {showPrintPicker && printCompositeUrl && (
                    <div className="fixed inset-0 z-[300]">
                        <PrintDesigner
                            selectedPhotos={[{ id: 'composite', url: printCompositeUrl }]}
                            allPhotos={[{ id: 'composite', url: printCompositeUrl }]}
                            templates={[]}
                            onClose={() => setShowPrintPicker(false)}
                            themeColor={tc}
                        />
                    </div>
                )}

                {/* ── STEP: QR Code ─────────────────────────────────────── */}
                {step === 'qr' && downloadUrl && (
                    <div className="flex-1 flex items-center justify-center px-6 animate-slideUp">
                        <div className="text-center max-w-lg">
                            <div className="mb-8 flex justify-center">
                                <div className="w-16 h-1 w-24 bg-white/10 rounded-full" />
                            </div>
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
                                    New Session
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── STEP: Done (Fallback) ──────────────────────────────── */}
                {step === 'done' && (
                    <div className="flex-1 flex items-center justify-center px-6 animate-slideUp">
                        <div className="text-center">
                            <div className="mb-10 flex justify-center">
                                <div className="w-16 h-1 bg-white/10 rounded-full" />
                            </div>
                            <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-3">Session Complete</h2>
                            <p className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-10">Data successfully transferred to your device</p>
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
                                    Initiate New Session
                            </button>
                        </div>
                    </div>
                )}

                {/* Branding */}
                <div className="text-center py-4 text-xs text-gray-600">
                    Powered by <span className="font-semibold text-gray-400">SnapWrap</span>
                </div>

                {/* ── Context Menu ── */}
                {contextMenu && (
                    <>
                        <div className="fixed inset-0 z-[190]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
                        <div 
                            className="fixed z-[200] bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl py-2 min-w-[180px] animate-in fade-in zoom-in duration-200"
                            style={{ left: contextMenu.x, top: contextMenu.y }}
                        >
                            <div className="px-4 py-2 border-b border-white/5 mb-1">
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Edit Photo {contextMenu.index + 1}</p>
                            </div>
                            <button 
                                onClick={() => {
                                    if (!selectedTemplate) return;
                                    const slot = selectedTemplate.slots[contextMenu.index];
                                    updatePhotoTransform(contextMenu.index, { 
                                        x: slot.x, y: slot.y, rotation: slot.rotation || 0, scale: 1 
                                    });
                                    setContextMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-white/5 text-sm flex items-center gap-3 transition-colors"
                            >
                                <RotateCcw size={14} className="text-indigo-400" />
                                <span>Reset Position</span>
                            </button>
                            <button 
                                onClick={() => {
                                    const transform = photoTransforms[contextMenu.index];
                                    updatePhotoTransform(contextMenu.index, { rotation: (transform.rotation || 0) + 90 });
                                    setContextMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-white/5 text-sm flex items-center gap-3 transition-colors"
                            >
                                <RotateCw size={14} className="text-indigo-400" />
                                <span>Rotate 90°</span>
                            </button>
                            <button 
                                onClick={() => {
                                    const transform = photoTransforms[contextMenu.index];
                                    updatePhotoTransform(contextMenu.index, { scale: (transform.scale || 1) + 0.1 });
                                    setContextMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-white/5 text-sm flex items-center gap-3 transition-colors"
                            >
                                <Plus size={14} className="text-indigo-400" />
                                <span>Scale Up</span>
                            </button>
                            <button 
                                onClick={() => {
                                    const transform = photoTransforms[contextMenu.index];
                                    updatePhotoTransform(contextMenu.index, { scale: Math.max(0.1, (transform.scale || 1) - 0.1) });
                                    setContextMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-white/5 text-sm flex items-center gap-3 transition-colors"
                            >
                                <X size={14} className="text-indigo-400" />
                                <span>Scale Down</span>
                            </button>
                            <div className="h-px bg-white/5 my-1" />
                            <button 
                                onClick={() => {
                                    const maxZ = Math.max(...photoTransforms.map(p => p.zIndex || 0));
                                    updatePhotoTransform(contextMenu.index, { zIndex: maxZ + 1 });
                                    setContextMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-white/5 text-sm flex items-center gap-3 transition-colors"
                            >
                                <ArrowUp size={14} className="text-green-400" />
                                <span>Bring to Front</span>
                            </button>
                            <button 
                                onClick={() => {
                                    const minZ = Math.min(...photoTransforms.map(p => p.zIndex || 0));
                                    updatePhotoTransform(contextMenu.index, { zIndex: minZ - 1 });
                                    setContextMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-white/5 text-sm flex items-center gap-3 transition-colors"
                            >
                                <ArrowDown size={14} className="text-green-400" />
                                <span>Send to Back</span>
                            </button>
                            <div className="h-px bg-white/5 my-1" />
                            <button 
                                onClick={() => {
                                    const newPhotos = [...capturedPhotos];
                                    newPhotos[contextMenu.index] = null as any;
                                    setCapturedPhotos(newPhotos);
                                    setCurrentSlotIndex(contextMenu.index);
                                    setStep('capture');
                                    setCaptureSubState('live');
                                    setContextMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-red-500/10 text-sm flex items-center gap-3 transition-colors text-red-400"
                            >
                                <Trash2 size={14} />
                                <span>Retake Photo</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
