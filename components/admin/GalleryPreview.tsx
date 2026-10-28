'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';

interface Props {
    slug: string;
    /** Current, possibly unsaved, public page settings */
    settings: Record<string, unknown>;
}

const DEVICES = {
    desktop: { width: 1280, height: 800, label: 'Desktop', icon: Monitor },
    mobile: { width: 390, height: 780, label: 'Mobile', icon: Smartphone },
} as const;

/**
 * Live preview of the public gallery. It embeds the real page, so fonts, layouts and photos match
 * exactly, and pushes unsaved settings into it with postMessage — no save or reload needed.
 */
export default function GalleryPreview({ slug, settings }: Props) {
    const [device, setDevice] = useState<keyof typeof DEVICES>('desktop');
    const [boxWidth, setBoxWidth] = useState(0);
    const boxRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLIFrameElement>(null);
    const settingsRef = useRef(settings);

    const send = useCallback(() => {
        frameRef.current?.contentWindow?.postMessage(
            { type: 'gallery-preview', publicPage: settingsRef.current },
            window.location.origin,
        );
    }, []);

    // Push every settings change into the frame
    useEffect(() => {
        settingsRef.current = settings;
        send();
    }, [settings, send]);

    // The frame announces itself once it has mounted, which can be after our first send
    useEffect(() => {
        const onMessage = (e: MessageEvent) => {
            if (e.origin === window.location.origin && e.data?.type === 'gallery-preview-ready') send();
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [send]);

    useEffect(() => {
        if (!boxRef.current) return;
        const ro = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
        ro.observe(boxRef.current);
        return () => ro.disconnect();
    }, []);

    const { width, height } = DEVICES[device];
    const scale = boxWidth > 0 ? Math.min(1, boxWidth / width) : 1;

    return (
        <div className="xl:sticky xl:top-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black text-[#2A2724] uppercase tracking-[0.2em]">Live Preview</p>
                    <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Updates as you edit · unsaved changes included</p>
                </div>
                <div className="flex gap-1 p-1 bg-[#FAF8F5] border border-[#ECE8DF] rounded-full">
                    {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map(d => {
                        const Icon = DEVICES[d].icon;
                        return (
                            <button
                                key={d}
                                type="button"
                                onClick={() => setDevice(d)}
                                title={DEVICES[d].label}
                                className={`p-2 rounded-full transition-all ${device === d ? 'bg-[#2A2724] text-white' : 'text-neutral-400 hover:text-[#2A2724]'}`}
                            >
                                <Icon size={14} />
                            </button>
                        );
                    })}
                </div>
            </div>

            <div ref={boxRef} className="w-full rounded-2xl border border-[#ECE8DF] bg-[#FAF8F5] overflow-hidden flex justify-center">
                <div style={{ width: width * scale, height: height * scale }}>
                    <iframe
                        ref={frameRef}
                        src={`/e/${slug}/gallery?preview=1`}
                        title="Gallery preview"
                        onLoad={send}
                        style={{
                            width,
                            height,
                            border: 0,
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left',
                            background: 'white',
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
