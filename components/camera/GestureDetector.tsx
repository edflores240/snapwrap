'use client';

/**
 * GestureDetector
 *
 * Headless: only renders the skeleton canvas overlay on the video.
 * The parent is responsible for rendering the gesture HUD.
 *
 * Modes:
 *   'snap'    → 👍 Thumbs Up (held 1s)      → onConfirm()
 *   'retake'  → ✋ Open Palm (held 700ms)    → onRetake()
 *   'confirm' → 👍 Thumbs Up (held 1s)      → onConfirm()
 *   'off'     → detection paused
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';

export type GestureMode = 'snap' | 'retake' | 'preview' | 'confirm' | 'off';

interface GestureDetectorProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    mode: GestureMode;
    onRetake: () => void;
    onConfirm: () => void;
    // Callback for hold progress (0-100) so parent can render the HUD
    onHoldProgress?: (progress: number, target: 'retake' | 'confirm' | null) => void;
    themeColor?: string;
}

const FINGER_TIPS = [4, 8, 12, 16, 20];
const FINGER_MCP  = [2, 5,  9, 13, 17];

type Landmark = { x: number; y: number; z: number };
type Pose = 'open' | 'closed' | 'thumbsup' | 'other' | 'none';

function classifyHand(lm: Landmark[]): Pose {
    if (!lm || lm.length < 21) return 'other';

    const thumbUp      = lm[4].y < lm[0].y - 0.08;
    const indexCurled  = lm[8].y  > lm[5].y  + 0.01;
    const middleCurled = lm[12].y > lm[9].y  + 0.01;
    const ringCurled   = lm[16].y > lm[13].y + 0.01;
    const pinkyCurled  = lm[20].y > lm[17].y + 0.01;
    if (thumbUp && indexCurled && middleCurled && ringCurled && pinkyCurled) return 'thumbsup';

    let extended = 0;
    for (let f = 1; f < 5; f++) {
        if (lm[FINGER_TIPS[f]].y < lm[FINGER_MCP[f]].y - 0.03) extended++;
    }
    if (extended >= 3) return 'open';
    if (extended <= 1) return 'closed';
    return 'other';
}

export function GestureDetector({
    videoRef,
    mode,
    onRetake,
    onConfirm,
    onHoldProgress,
    themeColor = '#6366f1',
}: GestureDetectorProps) {
    const canvasRef     = useRef<HTMLCanvasElement>(null);
    const landmarkerRef = useRef<any>(null);
    const animFrameRef  = useRef<number>(0);
    const modeRef       = useRef<GestureMode>(mode);
    const holdStartRef  = useRef<number | null>(null);
    const holdTargetRef = useRef<'retake' | 'confirm' | null>(null);
    const debounceRef   = useRef<boolean>(false);

    const [isReady, setIsReady] = useState(false);

    // Per-gesture hold durations
    const HOLD_MS = { retake: 2000, confirm: 1000, snap: 1000 } as const;
    const GRACE_MS = 200;

    useEffect(() => {
        modeRef.current       = mode;
        holdStartRef.current  = null;
        holdTargetRef.current = null;
        debounceRef.current   = false;
        onHoldProgress?.(0, null);
    }, [mode]);

    // ── Init ──────────────────────────────────────────────────────────
    const initLandmarker = useCallback(async () => {
        try {
            const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
            const WASM  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
            const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
            const vision = await FilesetResolver.forVisionTasks(WASM);

            let lm: any = null;
            try {
                lm = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
                    runningMode: 'VIDEO', numHands: 1,
                    minHandDetectionConfidence: 0.5,
                    minHandPresenceConfidence: 0.5,
                    minTrackingConfidence: 0.4,
                });
            } catch {
                lm = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
                    runningMode: 'VIDEO', numHands: 1,
                    minHandDetectionConfidence: 0.5,
                    minHandPresenceConfidence: 0.5,
                    minTrackingConfidence: 0.4,
                });
            }
            landmarkerRef.current = lm;
            setIsReady(true);
        } catch (err) {
            console.warn('[GestureDetector] Failed to init:', err);
        }
    }, []);

    // ── Detection Loop ─────────────────────────────────────────────────
    const detect = useCallback(() => {
        const video  = videoRef.current;
        const canvas = canvasRef.current;
        const lm     = landmarkerRef.current;
        const m      = modeRef.current;

        if (!video || !canvas || !lm || m === 'off' || video.readyState < 2) {
            animFrameRef.current = requestAnimationFrame(detect);
            return;
        }

        const now = performance.now();
        let results: any;
        try { results = lm.detectForVideo(video, now); }
        catch { animFrameRef.current = requestAnimationFrame(detect); return; }

        // Draw skeleton overlay
        const ctx = canvas.getContext('2d');
        if (ctx) {
            canvas.width  = video.videoWidth  || 640;
            canvas.height = video.videoHeight || 480;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const lmks = results?.landmarks?.[0];
            if (lmks) drawSkeleton(ctx, lmks, canvas.width, canvas.height, themeColor);
        }

        const lmks = results?.landmarks?.[0];
        const pose: Pose = lmks ? classifyHand(lmks) : 'none';

        // ── Classify target ────────────────────────────────────────────
        let targetAction: 'retake' | 'confirm' | null = null;

        if (!debounceRef.current) {
            if (m === 'snap' || m === 'confirm') {
                if (pose === 'thumbsup') targetAction = 'confirm';
            }
            if (m === 'retake') {
                if (pose === 'open') targetAction = 'retake';
            }
            if (m === 'preview') {
                // Open palm → retake (700ms hold)
                // Thumbs up → instant keep (1s hold)
                // Visually distinct poses — no conflict
                if (pose === 'open')     targetAction = 'retake';
                if (pose === 'thumbsup') targetAction = 'confirm';
            }
        }

        // ── Hold timer ─────────────────────────────────────────────────
        if (targetAction) {
            if (holdTargetRef.current !== targetAction) {
                holdStartRef.current  = now;
                holdTargetRef.current = targetAction;
            }

            const key = targetAction === 'retake' ? 'retake' : 'confirm';
            const duration = HOLD_MS[key];
            const elapsed  = now - (holdStartRef.current ?? now);
            const progress = Math.min(100, (elapsed / duration) * 100);
            onHoldProgress?.(progress, targetAction);

            if (elapsed >= duration) {
                const fired = holdTargetRef.current;
                holdStartRef.current  = null;
                holdTargetRef.current = null;
                debounceRef.current   = true;
                onHoldProgress?.(0, null);

                if (fired === 'retake')  onRetake();
                if (fired === 'confirm') onConfirm();

                // Snap mode: very short debounce — mode will change anyway
                const debounceDuration = m === 'snap' ? 300 : 2000;
                setTimeout(() => { debounceRef.current = false; }, debounceDuration);
            }
        } else {
            // Grace window: brief flicker frames don't cancel the hold
            if (holdStartRef.current !== null && holdTargetRef.current) {
                const elapsed  = now - holdStartRef.current;
                const key      = holdTargetRef.current === 'retake' ? 'retake' : 'confirm';
                const duration = HOLD_MS[key];
                const withinGrace = elapsed < duration - GRACE_MS;

                if (!withinGrace) {
                    holdStartRef.current  = null;
                    holdTargetRef.current = null;
                    onHoldProgress?.(0, null);
                }
                // else: grace window active — keep timer running
            }
        }

        animFrameRef.current = requestAnimationFrame(detect);
    }, [videoRef, themeColor, onRetake, onConfirm, onHoldProgress]);

    useEffect(() => { initLandmarker(); }, [initLandmarker]);

    useEffect(() => {
        if (!isReady) return;
        animFrameRef.current = requestAnimationFrame(detect);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [isReady, detect]);

    // Only render the skeleton canvas — HUD is rendered by parent
    return (
        <>
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-20"
                style={{ transform: 'scaleX(-1)' }}
            />
            {!isReady && (
                <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs text-white/50 backdrop-blur-md"
                    style={{ background: 'rgba(0,0,0,0.4)' }}>
                    <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" />
                    Loading gestures…
                </div>
            )}
        </>
    );
}

function drawSkeleton(
    ctx: CanvasRenderingContext2D,
    landmarks: Landmark[],
    w: number, h: number,
    color: string
) {
    const CONNECTIONS = [
        [0,1],[1,2],[2,3],[3,4],
        [0,5],[5,6],[6,7],[7,8],
        [0,9],[9,10],[10,11],[11,12],
        [0,13],[13,14],[14,15],[15,16],
        [0,17],[17,18],[18,19],[19,20],
        [5,9],[9,13],[13,17],
    ];
    ctx.lineWidth   = 2;
    ctx.strokeStyle = `${color}99`;
    ctx.fillStyle   = `${color}dd`;
    CONNECTIONS.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
        ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
        ctx.stroke();
    });
    landmarks.forEach(lm => {
        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}
