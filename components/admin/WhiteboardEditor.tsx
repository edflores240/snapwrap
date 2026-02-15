'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function WhiteboardEditor() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
    const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);

    useEffect(() => {
        if (canvasRef.current && !canvas) {
            const initCanvas = new fabric.Canvas(canvasRef.current, {
                width: 800,
                height: 600, // 4:3 aspect ratio equivalent for 1920x1080 scaled down? No, let's do 16:9
                backgroundColor: 'rgba(0,0,0,0)', // Transparent
            });

            // Set wrapper dims
            initCanvas.setDimensions({ width: 800, height: 450 }); // 16:9

            initCanvas.on('selection:created', (e) => setSelectedObject(e.selected?.[0] || null));
            initCanvas.on('selection:cleared', () => setSelectedObject(null));

            setCanvas(initCanvas);

            // Add border guide
            const rect = new fabric.Rect({
                left: 0,
                top: 0,
                width: 800,
                height: 450,
                fill: 'transparent',
                stroke: '#6366f1',
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: false,
                evented: false,
            });
            initCanvas.add(rect);
        }

        return () => {
            // canvas?.dispose(); // Strict mode might double init
        };
    }, []);

    const addText = () => {
        if (!canvas) return;
        const text = new fabric.IText('Double click to edit', {
            left: 100,
            top: 100,
            fontFamily: 'sans-serif',
            fill: '#ffffff',
            fontSize: 24,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
    };

    const addShape = (type: 'rect' | 'circle') => {
        if (!canvas) return;
        let shape;
        if (type === 'rect') {
            shape = new fabric.Rect({
                left: 150,
                top: 150,
                fill: '#6366f1',
                width: 100,
                height: 100,
            });
        } else {
            shape = new fabric.Circle({
                left: 150,
                top: 150,
                fill: '#14b8a6',
                radius: 50,
            });
        }
        canvas.add(shape);
    };

    const deleteSelected = () => {
        if (!canvas || !canvas.getActiveObject()) return;
        canvas.remove(canvas.getActiveObject()!);
        setSelectedObject(null);
    };

    const downloadTemplate = () => {
        if (!canvas) return;
        // Hide guide if needed, or just export
        const dataUrl = canvas.toDataURL({
            format: 'png',
            multiplier: 2.4, // Scale up to 1920x1080 (800 * 2.4 = 1920)
            enableRetinaScaling: true,
        });

        const link = document.createElement('a');
        link.download = 'template.png';
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex gap-6 h-[calc(100vh-140px)]">
            {/* Toolbar */}
            <Card className="w-64 p-4 space-y-4 flex flex-col">
                <h3 className="font-bold text-lg mb-2">Tools</h3>
                <Button onClick={addText} variant="secondary" size="sm" className="w-full">
                    Tt Add Text
                </Button>
                <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => addShape('rect')} variant="ghost" size="sm">
                        ⬜ Rect
                    </Button>
                    <Button onClick={() => addShape('circle')} variant="ghost" size="sm">
                        ⭕ Circle
                    </Button>
                </div>

                <div className="border-t border-white/10 my-4" />

                <h3 className="font-bold text-lg mb-2">Properties</h3>
                {selectedObject ? (
                    <div className="space-y-2">
                        <div>
                            <label className="text-xs text-gray-400">Color</label>
                            <div className="flex gap-2 mt-1">
                                {['#ffffff', '#000000', '#6366f1', '#14b8a6', '#f43f5e'].map((c) => (
                                    <div
                                        key={c}
                                        className="w-6 h-6 rounded-full cursor-pointer border border-white/20"
                                        style={{ backgroundColor: c }}
                                        onClick={() => {
                                            selectedObject.set('fill', c);
                                            canvas?.renderAll();
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                        <Button onClick={deleteSelected} className="w-full bg-red-500/20 text-red-200 hover:bg-red-500/30">
                            Delete
                        </Button>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500">Select an object to edit</p>
                )}

                <div className="mt-auto">
                    <Button onClick={downloadTemplate} variant="primary" className="w-full">
                        💾 Download PNG
                    </Button>
                </div>
            </Card>

            {/* Canvas Area */}
            <div className="flex-1 bg-[#1a1a1a] rounded-2xl border border-white/10 flex items-center justify-center p-8 overflow-auto">
                <div className="relative shadow-2xl">
                    <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/checkerboard.png')] opacity-10 pointer-events-none" />
                    <canvas ref={canvasRef} className="border border-white/20 rounded-lg" />
                </div>
            </div>
        </div>
    );
}
