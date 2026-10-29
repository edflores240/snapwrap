'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, SwitchCamera, Zap, ZapOff, ImagePlus, Shuffle, Check, RotateCcw } from 'lucide-react';
import {
    GUEST_FILTERS, filterById, renderShot, shotFromFile,
    type CapturedShot, type GuestConfig,
} from '@/lib/guest-camera';

interface Props {
    config: GuestConfig;
    accent: string;
    shotsLeft: number;
    onClose: () => void;
    /** Resolves once the shot is safely queued for upload */
    onKeep: (shot: CapturedShot, caption: string, prompt: string | null) => Promise<void>;
}

export default function GuestCamera({ config, accent, shotsLeft, onClose, onKeep }: Props) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [facing, setFacing] = useState<'user' | 'environment'>('environment');
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [torchSupported, setTorchSupported] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [filterId, setFilterId] = useState(config.filtersEnabled ? 'natural' : 'natural');
    const [flash, setFlash] = useState(false);
    const [shot, setShot] = useState<CapturedShot | null>(null);
    const [caption, setCaption] = useState('');
    const [saving, setSaving] = useState(false);
    const [justSaved, setJustSaved] = useState(false);
    const [portrait, setPortrait] = useState(true);
    const [promptIndex, setPromptIndex] = useState<number | null>(config.prompts.length ? Math.floor(Math.random() * config.prompts.length) : null);

    const prompt = promptIndex !== null ? config.prompts[promptIndex] ?? null : null;
    const filter = filterById(filterId);

    useEffect(() => {
        const update = () => setPortrait(window.innerHeight >= window.innerWidth);
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // (Re)start the camera when the facing mode changes
    useEffect(() => {
        let cancelled = false;
        setReady(false);
        setTorchOn(false);

        (async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setError('This browser can\'t open the camera. Try Safari or Chrome, or add a photo from your library.');
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
                    audio: false,
                });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current?.getTracks().forEach(t => t.stop());
                streamRef.current = stream;
                const video = videoRef.current;
                if (video) {
                    video.srcObject = stream;
                    await video.play().catch(() => undefined);
                }
                const caps = (stream.getVideoTracks()[0]?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
                setTorchSupported(!!caps.torch);
                setError(null);
                setReady(true);
            } catch (err) {
                const name = (err as DOMException).name;
                setError(name === 'NotAllowedError'
                    ? 'Camera access was blocked. Allow the camera for this page in your browser settings and try again.'
                    : 'We couldn\'t start your camera.');
            }
        })();

        return () => { cancelled = true; };
    }, [facing]);

    useEffect(() => () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }, []);

    // Free the preview image when it's replaced or the camera closes
    useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.previewUrl); }, [shot]);

    const toggleTorch = async () => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (!track) return;
        const next = !torchOn;
        try {
            await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
            setTorchOn(next);
        } catch { setTorchSupported(false); }
    };

    const snap = useCallback(async () => {
        const video = videoRef.current;
        const frame = frameRef.current;
        if (!video || !frame || !ready || shotsLeft <= 0 || video.videoWidth === 0) return;
        setFlash(true);
        setTimeout(() => setFlash(false), 140);
        try {
            const next = await renderShot(video, video.videoWidth, video.videoHeight, frame.clientWidth / frame.clientHeight, {
                mirror: facing === 'user',
                filter,
            });
            setShot(next);
            setCaption('');
        } catch {
            setError('That photo didn\'t work. Try again.');
        }
    }, [ready, shotsLeft, facing, filter]);

    const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || shotsLeft <= 0) return;
        try {
            setShot(await shotFromFile(file));
            setCaption('');
        } catch {
            setError('We couldn\'t read that photo.');
        }
    };

    const keep = async () => {
        if (!shot || saving) return;
        setSaving(true);
        try {
            await onKeep(shot, caption, prompt);
            setShot(null);
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 1600);
            if (shotsLeft - 1 <= 0) onClose();
            else if (config.prompts.length > 1) setPromptIndex(i => {
                // Move on to a different prompt for the next shot
                let n = Math.floor(Math.random() * config.prompts.length);
                if (n === i) n = (n + 1) % config.prompts.length;
                return n;
            });
        } finally {
            setSaving(false);
        }
    };

    const shufflePrompt = () => {
        if (config.prompts.length < 2) return;
        setPromptIndex(i => {
            let n = Math.floor(Math.random() * config.prompts.length);
            if (n === i) n = (n + 1) % config.prompts.length;
            return n;
        });
    };

    const ratio = portrait ? 3 / 4 : 4 / 3;

    return (
        <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col select-none">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
                <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" aria-label="Close camera">
                    <X size={18} />
                </button>
                <div className="px-4 py-1.5 rounded-full bg-white/10 text-[11px] font-bold tracking-widest uppercase">
                    {shotsLeft} {shotsLeft === 1 ? 'shot' : 'shots'} left
                </div>
                <div className="flex gap-2">
                    {torchSupported && facing === 'environment' && (
                        <button onClick={toggleTorch} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" aria-label="Flash">
                            {torchOn ? <Zap size={18} style={{ color: '#facc15' }} /> : <ZapOff size={18} />}
                        </button>
                    )}
                    <button onClick={() => setFacing(f => (f === 'user' ? 'environment' : 'user'))} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center" aria-label="Flip camera">
                        <SwitchCamera size={18} />
                    </button>
                </div>
            </div>

            {/* Prompt */}
            {prompt && !shot && (
                <div className="px-4 pb-2 flex justify-center">
                    <div className="flex items-center gap-2 pl-4 pr-2 py-1.5 rounded-full text-[12px] font-semibold" style={{ background: `${accent}dd` }}>
                        <span>{prompt}</span>
                        {config.prompts.length > 1 && (
                            <button onClick={shufflePrompt} className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center" aria-label="Another idea">
                                <Shuffle size={12} />
                            </button>
                        )}
                        <button onClick={() => setPromptIndex(null)} className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center" aria-label="Skip the idea">
                            <X size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* Viewfinder / review */}
            <div className="flex-1 min-h-0 flex items-center justify-center px-2">
                <div
                    ref={frameRef}
                    className="relative overflow-hidden rounded-2xl bg-neutral-900"
                    style={{ aspectRatio: ratio, height: '100%', maxWidth: '100%' }}
                >
                    <video
                        ref={videoRef}
                        autoPlay playsInline muted
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined, filter: filter.css, visibility: shot ? 'hidden' : 'visible' }}
                    />
                    {!shot && filter.vignette > 0 && (
                        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${filter.vignette}) 100%)` }} />
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {shot && <img src={shot.previewUrl} alt="Your shot" className="absolute inset-0 w-full h-full object-cover" />}
                    {flash && <div className="absolute inset-0 bg-white" />}
                    {justSaved && (
                        <div className="absolute inset-x-0 top-4 flex justify-center">
                            <div className="px-4 py-2 rounded-full bg-white text-black text-xs font-bold flex items-center gap-2"><Check size={14} /> Saved</div>
                        </div>
                    )}
                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 gap-4 bg-black/80">
                            <p className="text-sm text-white/80">{error}</p>
                            {config.allowLibrary && (
                                <button onClick={() => fileRef.current?.click()} className="px-5 py-2.5 rounded-full text-sm font-bold" style={{ background: accent }}>
                                    Choose from library
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] space-y-3">
                {shot ? (
                    <>
                        {config.captionsEnabled && (
                            <input
                                value={caption}
                                onChange={e => setCaption(e.target.value)}
                                maxLength={120}
                                placeholder="Add a caption (optional)"
                                className="w-full bg-white/10 rounded-full px-5 py-3 text-sm placeholder-white/40 outline-none focus:bg-white/15"
                            />
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShot(null)}
                                disabled={saving}
                                className="flex-1 py-3.5 rounded-full bg-white/10 font-bold text-sm flex items-center justify-center gap-2"
                            >
                                <RotateCcw size={16} /> Retake
                            </button>
                            <button
                                onClick={keep}
                                disabled={saving}
                                className="flex-[1.4] py-3.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                                style={{ background: accent }}
                            >
                                <Check size={16} /> {saving ? 'Saving…' : 'Keep it'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {config.filtersEnabled && (
                            <div className="flex gap-2 overflow-x-auto justify-center" style={{ scrollbarWidth: 'none' }}>
                                {GUEST_FILTERS.map(fl => (
                                    <button
                                        key={fl.id}
                                        onClick={() => setFilterId(fl.id)}
                                        className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${filterId === fl.id ? 'text-black bg-white' : 'bg-white/10 text-white/70'}`}
                                    >
                                        {fl.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center justify-between px-4">
                            <div className="w-12">
                                {config.allowLibrary && (
                                    <button onClick={() => fileRef.current?.click()} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center" aria-label="Choose from library">
                                        <ImagePlus size={20} />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={snap}
                                disabled={!ready || shotsLeft <= 0}
                                className="w-[76px] h-[76px] rounded-full border-4 border-white p-1.5 disabled:opacity-40 active:scale-95 transition-transform"
                                aria-label="Take photo"
                            >
                                <div className="w-full h-full rounded-full bg-white" />
                            </button>
                            <div className="w-12" />
                        </div>
                    </>
                )}
            </div>

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
        </div>
    );
}
