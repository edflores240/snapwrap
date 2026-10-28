'use client';

import React, { useId } from 'react';
import { curveGlyphs, parseTextShadows, type TextLike } from '@/lib/template-text';
import { useFontsVersion } from '@/lib/fonts';

interface Props {
    el: TextLike;
    /** Converts template px to a CSS length for the host's scale (see textElementStyle) */
    len: (n: number) => string;
}

/**
 * Contents of a template text element: plain text, or text laid out along an arc when `curve` is set.
 * The curved version is an SVG sized in template px and scaled by `len`, so it grows with the template.
 */
export default function TemplateTextBody({ el, len }: Props) {
    const pathId = useId();
    useFontsVersion(); // re-measure once the web font has loaded

    const curved = el.curve ? curveGlyphs(el, 1) : null;
    if (!curved) return <span style={{ whiteSpace: 'pre-wrap' }}>{el.text}</span>;

    const { geometry } = curved;
    const w = geometry.halfWidth * 2;
    const h = geometry.halfHeight * 2;

    // text-shadow's blur radius is twice drop-shadow's, so halve it to look the same
    const shadow = parseTextShadows(el.textShadow)
        .map(s => `drop-shadow(${len(s.x)} ${len(s.y)} ${len(s.blur / 2)} ${s.color})`)
        .join(' ');

    return (
        <svg
            width={len(w)}
            height={len(h)}
            viewBox={`${-geometry.halfWidth} ${-geometry.halfHeight} ${w} ${h}`}
            style={{ display: 'block', overflow: 'visible', filter: shadow || undefined }}
            aria-label={el.text}
        >
            <path id={pathId} d={geometry.path} fill="none" />
            <text
                fill={el.color}
                stroke={el.textStrokeWidth ? el.textStroke || '#000000' : undefined}
                strokeWidth={el.textStrokeWidth || undefined}
                strokeLinejoin="round"
                style={{
                    fontFamily: el.fontFamily,
                    fontSize: el.fontSize,
                    fontWeight: el.fontWeight,
                    fontStyle: el.fontStyle,
                    letterSpacing: el.letterSpacing || 0,
                }}
            >
                <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">{el.text.replace(/\n/g, ' ')}</textPath>
            </text>
        </svg>
    );
}
