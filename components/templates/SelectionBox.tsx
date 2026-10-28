'use client';

import React from 'react';

export type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const ALL_HANDLES: HandleType[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export const SIDE_HANDLES: HandleType[] = ['e', 'w'];

const ACCENT = '#5b8cff';
const CORNERS: HandleType[] = ['nw', 'ne', 'se', 'sw'];

// A curved-arrow cursor, shown when the pointer is just outside a corner
const ROTATE_CURSOR = `url("data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">' +
    '<path d="M19 12a7 7 0 1 1-2.05-4.95" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>' +
    '<path d="M19 4v4.5h-4.5" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M19 12a7 7 0 1 1-2.05-4.95" stroke="#111" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M19 4v4.5h-4.5" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>'
)}") 12 12, grab`;

interface SelectionBoxProps {
    /** Workspace zoom; the chrome is divided by it so it stays the same size on screen */
    zoom: number;
    /** Resize handles to show; empty for a plain outline (multi-selection, locked) */
    handles: HandleType[];
    /** Corner rotation zones */
    rotatable: boolean;
    rotation: number;
    rotating: boolean;
    onResizeStart: (e: React.MouseEvent, type: HandleType) => void;
    onRotateStart: (e: React.MouseEvent) => void;
}

const handlePosition = (type: HandleType, size: number): React.CSSProperties => ({
    top: type.includes('n') ? -size / 2 : type.includes('s') ? `calc(100% - ${size / 2}px)` : `calc(50% - ${size / 2}px)`,
    left: type.includes('w') ? -size / 2 : type.includes('e') ? `calc(100% - ${size / 2}px)` : `calc(50% - ${size / 2}px)`,
});

const resizeCursor = (type: HandleType) => (type === 'n' || type === 's' ? 'ns-resize' : type === 'e' || type === 'w' ? 'ew-resize' : type === 'nw' || type === 'se' ? 'nwse-resize' : 'nesw-resize');

/**
 * Thin, modern selection chrome: a hairline outline, small square handles and invisible
 * rotation zones just outside each corner. Rendered as a child of the element it decorates,
 * so it inherits the element's rotation.
 */
export default function SelectionBox({ zoom, handles, rotatable, rotation, rotating, onResizeStart, onRotateStart }: SelectionBoxProps) {
    const z = zoom || 1;
    const line = 1.5 / z;
    const size = 9 / z;
    const zone = 26 / z;

    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 130 }}>
            <div
                className="absolute inset-0"
                style={{ boxShadow: `0 0 0 ${line}px ${ACCENT}, 0 0 0 ${line * 3}px ${ACCENT}22`, borderRadius: 1 }}
            />

            {rotatable && CORNERS.map(type => (
                <div
                    key={`rot-${type}`}
                    className="absolute pointer-events-auto"
                    style={{
                        width: zone,
                        height: zone,
                        top: type.includes('n') ? -zone : '100%',
                        left: type.includes('w') ? -zone : '100%',
                        cursor: ROTATE_CURSOR,
                    }}
                    onMouseDown={onRotateStart}
                />
            ))}

            {handles.map(type => {
                const corner = type.length === 2;
                return (
                    <div
                        key={type}
                        className="absolute pointer-events-auto bg-white"
                        style={{
                            ...handlePosition(type, size),
                            width: corner ? size : type === 'n' || type === 's' ? size * 1.8 : size * 0.8,
                            height: corner ? size : type === 'e' || type === 'w' ? size * 1.8 : size * 0.8,
                            // side handles are pills, corners are rounded squares
                            marginLeft: corner ? 0 : type === 'n' || type === 's' ? -size * 0.4 : 0,
                            marginTop: corner ? 0 : type === 'e' || type === 'w' ? -size * 0.4 : 0,
                            border: `${line}px solid ${ACCENT}`,
                            borderRadius: corner ? 2 / z : 99,
                            boxShadow: `0 1px ${3 / z}px rgba(0,0,0,0.25)`,
                            cursor: resizeCursor(type),
                        }}
                        onMouseDown={(e) => onResizeStart(e, type)}
                    />
                );
            })}

            {rotating && (
                <div
                    className="absolute left-1/2 whitespace-nowrap rounded-full bg-neutral-950 text-white font-black tracking-wider"
                    style={{
                        top: `calc(100% + ${14 / z}px)`,
                        transform: `translateX(-50%) rotate(${-rotation}deg)`,
                        fontSize: 10 / z,
                        padding: `${3 / z}px ${8 / z}px`,
                    }}
                >
                    {Math.round(rotation)}°
                </div>
            )}
        </div>
    );
}
