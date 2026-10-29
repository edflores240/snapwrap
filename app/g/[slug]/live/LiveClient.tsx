'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { AnimatePresence, motion } from 'framer-motion';
import { Maximize2 } from 'lucide-react';
import { getSlideshow, readGuestConfig, type SlideshowPhoto } from '@/lib/guest-camera';
import type { GuestEvent } from '../GuestApp';

const SLIDE_MS = 6000;
const POLL_MS = 10000;
const SERIF = '"Playfair Display", Georgia, serif';

/** Full-screen slideshow for a projector: new photos jump the queue, older ones keep cycling */
export default function LiveClient({ event }: { event: GuestEvent }) {
    const cfg = useMemo(() => readGuestConfig((event.config as { guestCamera?: unknown } | null)?.guestCamera), [event.config]);
    const [photos, setPhotos] = useState<SlideshowPhoto[]>([]);
    const [available, setAvailable] = useState<boolean | null>(null);
    const [current, setCurrent] = useState<SlideshowPhoto | null>(null);
    const [origin, setOrigin] = useState('');
    const [chromeVisible, setChromeVisible] = useState(true);
    const playQueue = useRef<SlideshowPhoto[]>([]);
    const seen = useRef<Set<string>>(new Set());
    const cursor = useRef(0);
    const photosRef = useRef<SlideshowPhoto[]>([]);

    // The origin only exists in the browser
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setOrigin(window.location.origin); }, []);

    // Poll for new photos
    useEffect(() => {
        let stopped = false;
        const poll = async () => {
            try {
                const res = await getSlideshow(event.id, 80);
                if (stopped) return;
                setAvailable(!!res.available);
                const fresh = res.photos.filter(p => !seen.current.has(p.id));
                fresh.forEach(p => seen.current.add(p.id));
                // Oldest of the new ones first, so they appear in the order they were taken
                playQueue.current.push(...[...fresh].reverse());
                photosRef.current = res.photos;
                setPhotos(res.photos);
            } catch { /* keep showing what we have */ }
        };
        void poll();
        const t = setInterval(poll, POLL_MS);
        return () => { stopped = true; clearInterval(t); };
    }, [event.id]);

    // Advance: queued new photos first, then loop through everything
    useEffect(() => {
        const next = () => {
            const queued = playQueue.current.shift();
            if (queued) { setCurrent(queued); return; }
            const all = photosRef.current;
            if (all.length === 0) return;
            cursor.current = (cursor.current + 1) % all.length;
            setCurrent(all[cursor.current]);
        };
        const first = setTimeout(next, 0);
        const t = setInterval(next, SLIDE_MS);
        return () => { clearTimeout(first); clearInterval(t); };
    }, [available]);

    // Hide the buttons while the room is watching
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const show = () => { setChromeVisible(true); clearTimeout(timer); timer = setTimeout(() => setChromeVisible(false), 3000); };
        show();
        window.addEventListener('mousemove', show);
        return () => { window.removeEventListener('mousemove', show); clearTimeout(timer); };
    }, []);

    const fullscreen = () => { void document.documentElement.requestFullscreen?.(); };

    if (available === false) {
        return (
            <main className="min-h-screen bg-black text-white flex items-center justify-center p-8 text-center">
                <div className="max-w-md space-y-3">
                    <h1 className="text-3xl" style={{ fontFamily: SERIF }}>{event.name}</h1>
                    <p className="opacity-60 text-sm">
                        The live slideshow isn&apos;t on. Turn on &ldquo;Live slideshow&rdquo; in the event&apos;s Guest Camera settings, or open this page after the album is revealed.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="fixed inset-0 bg-black text-white overflow-hidden" style={{ cursor: chromeVisible ? 'default' : 'none' }}>
            <AnimatePresence mode="sync">
                {current && (
                    <motion.div
                        key={current.id}
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.2 }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={current.image_url} alt="" className="absolute inset-0 w-full h-full object-cover blur-3xl scale-125 opacity-50" />
                        <motion.img
                            src={current.image_url}
                            alt=""
                            className="absolute inset-0 w-full h-full object-contain"
                            initial={{ scale: 1 }}
                            animate={{ scale: 1.06 }}
                            transition={{ duration: SLIDE_MS / 1000 + 1.5, ease: 'linear' }}
                        />
                        {(current.caption || current.guest_name) && (
                            <div className="absolute left-0 right-0 bottom-0 p-10 pr-56 bg-gradient-to-t from-black/70 to-transparent">
                                {current.caption && <p className="text-3xl" style={{ fontFamily: SERIF }}>{current.caption}</p>}
                                {current.guest_name && <p className="text-sm uppercase tracking-[0.3em] opacity-70 mt-2">{current.guest_name}</p>}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {photos.length === 0 && available && (
                <div className="absolute inset-0 flex items-center justify-center text-center p-8">
                    <div>
                        <h1 className="text-5xl mb-4" style={{ fontFamily: SERIF }}>{cfg.welcomeTitle || event.name}</h1>
                        <p className="opacity-60">Scan the code to add the first photo.</p>
                    </div>
                </div>
            )}

            {/* Join code */}
            {origin && (
                <div className="absolute right-6 bottom-6 bg-white rounded-2xl p-3 shadow-2xl text-center">
                    <QRCode value={`${origin}/g/${event.slug}`} size={104} level="M" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-black/60 mt-2">Add your photos</p>
                </div>
            )}

            <button
                onClick={fullscreen}
                className={`absolute top-5 right-5 w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center transition-opacity ${chromeVisible ? 'opacity-100' : 'opacity-0'}`}
                aria-label="Full screen"
            >
                <Maximize2 size={18} />
            </button>
        </main>
    );
}
