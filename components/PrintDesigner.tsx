'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Printer, Plus, Heart, Star, Camera, Smile, Crown, Sparkles,
    BringToFront, SendToBack, Crop, Maximize, Trash2,
    ChevronLeft, ChevronRight, FilePlus, ZoomIn, ZoomOut, Search,
    Undo, Redo, RefreshCw, Lock, Unlock,
    AlignLeft, AlignCenter, AlignRight, AlignStartVertical as AlignTop, AlignCenterVertical as AlignMiddle, AlignEndVertical as AlignBottom,
    MoveHorizontal, MoveVertical
} from 'lucide-react';
import Image from 'next/image';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface PrintItem {
    id: string;
    url: string;
    type: 'photo' | 'template';
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    zIndex: number;
    fitMode: 'cover' | 'contain';
    isLocked?: boolean;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
}

interface Page { id: string; items: PrintItem[]; }

interface PaperSize { name: string; width: number; height: number; }

/* ─── Constants ─────────────────────────────────────────────────────────── */

const PAPER_SIZES: PaperSize[] = [
    { name: '102mm x 152mm', width: 101.6, height: 152.4 },
    { name: '127mm x 178mm', width: 127, height: 177.8 },
    { name: 'A4', width: 210, height: 297 },
    { name: 'Letter', width: 215.9, height: 279.4 },
    { name: 'Legal', width: 215.9, height: 355.6 },
    { name: 'Custom', width: 150, height: 150 },
];

const GRID_LAYOUTS = [
    // ── Single / Strip (photo booth classics)
    { label: '1 Full', rows: 1, cols: 1 },
    { label: '2 Strip', rows: 2, cols: 1 },
    { label: '3 Strip', rows: 3, cols: 1 },
    { label: '4 Strip', rows: 4, cols: 1 },
    // ── 2-column
    { label: '1×2', rows: 1, cols: 2 },
    { label: '2×2', rows: 2, cols: 2 },
    { label: '3×2', rows: 3, cols: 2 },
    { label: '4×2', rows: 4, cols: 2 },
    { label: '5×2', rows: 5, cols: 2 },
    { label: '6×2', rows: 6, cols: 2 },
    // ── 3-column
    { label: '1×3', rows: 1, cols: 3 },
    { label: '2×3', rows: 2, cols: 3 },
    { label: '3×3', rows: 3, cols: 3 },
    { label: '4×3', rows: 4, cols: 3 },
    { label: '5×3', rows: 5, cols: 3 },
    { label: '6×3', rows: 6, cols: 3 },
    // ── 4-column
    { label: '2×4', rows: 2, cols: 4 },
    { label: '3×4', rows: 3, cols: 4 },
    { label: '4×4', rows: 4, cols: 4 },
    { label: '5×4', rows: 5, cols: 4 },
];

/* ─── Resize handles: [cursor, pos classes, dxMul, dyMul, resW, resH] ─── */
type HandleDef = [string, string, number, number, boolean, boolean];
const HANDLES: HandleDef[] = [
    // All handles sit 4px INSIDE the image edge — no overflow onto adjacent images
    ['nwse-resize', 'top-1 left-1', -1, -1, true, true],
    ['ns-resize', 'top-1 left-1/2 -translate-x-1/2', 0, -1, false, true],
    ['nesw-resize', 'top-1 right-1', 1, -1, true, true],
    ['ew-resize', 'right-1 top-1/2 -translate-y-1/2', 1, 0, true, false],
    ['nwse-resize', 'bottom-1 right-1', 1, 1, true, true],
    ['ns-resize', 'bottom-1 left-1/2 -translate-x-1/2', 0, 1, false, true],
    ['nesw-resize', 'bottom-1 left-1', -1, 1, true, true],
    ['ew-resize', 'left-1 top-1/2 -translate-y-1/2', -1, 0, true, false],
];

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function PrintDesigner({
    selectedPhotos, allPhotos, templates, onClose, themeColor
}: {
    selectedPhotos: { id: string; url: string }[];
    allPhotos: { id: string; url: string }[];
    templates: { id: string; name: string; preview: string; layout: { rows: number; cols: number }; gap: number; padding: number; background: string }[];
    onClose: () => void;
    themeColor: string;
}) {
    const [paper, setPaper] = useState<PaperSize>(PAPER_SIZES[0]);
    const [pages, setPages] = useState<Page[]>([{ id: 'p1', items: [] }]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
    const selectedItemId = selectedItemIds[selectedItemIds.length - 1] ?? null;
    const [selectionBox, setSelectionBox] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
    const [scale, setScale] = useState(2);
    const [nextZ, setNextZ] = useState(10);
    const [gridGap, setGridGap] = useState(3);  // mm between cells
    const [gridPad, setGridPad] = useState(5);  // mm from paper edge
    const [activeLayout, setActiveLayout] = useState<{ rows: number, cols: number } | null>(null);
    const [isReplacing, setIsReplacing] = useState(false);
    const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, itemId: string } | null>(null);
    const [isConfirmingBulkDelete, setIsConfirmingBulkDelete] = useState(false);

    // Undo/Redo state
    const [history, setHistory] = useState<Page[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    /* live items from current page */
    const items = pages[currentPageIndex].items;

    /* helper – always captures fresh currentPageIndex from render scope */
    const setItems = (updater: (prev: PrintItem[]) => PrintItem[]) => {
        const newPages = pages.map((p, i) =>
            i === currentPageIndex ? { ...p, items: updater(p.items) } : p
        );
        setPages(newPages);
        return newPages;
    };

    const rotatePaper = () => {
        setPaper(prev => ({ ...prev, width: prev.height, height: prev.width }));
    };

    const pushToHistory = useCallback((currentPages: Page[]) => {
        setHistory(prev => {
            const next = prev.slice(0, historyIndex + 1);
            next.push(JSON.parse(JSON.stringify(currentPages)));
            if (next.length > 50) next.shift();
            return next;
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
    }, [historyIndex]);

    // Close context menu on click outside
    useEffect(() => {
        const hideMenu = () => setContextMenu(null);
        window.addEventListener('click', hideMenu);
        return () => window.removeEventListener('click', hideMenu);
    }, []);

    const replaceImage = (id: string, newUrl: string) => {
        const newPages = setItems(prev => prev.map(it =>
            it.id === id ? { ...it, url: newUrl } : it
        ));
        pushToHistory(newPages);
        setIsReplacing(false);
    };

    const undo = useCallback(() => {
        if (historyIndex <= 0) return;
        const prevIndex = historyIndex - 1;
        const prevPages = JSON.parse(JSON.stringify(history[prevIndex]));
        setPages(prevPages);
        setHistoryIndex(prevIndex);
        setSelectedItemIds([]);
    }, [history, historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;
        const nextIndex = historyIndex + 1;
        const nextPages = JSON.parse(JSON.stringify(history[nextIndex]));
        setPages(nextPages);
        setHistoryIndex(nextIndex);
        setSelectedItemIds([]);
    }, [history, historyIndex]);

    /* seed with selected photos on mount */
    useEffect(() => {
        const initial: PrintItem[] = selectedPhotos.map((ph, i) => ({
            id: `${ph.id}-${Math.random()}`,
            url: ph.url,
            type: 'photo',
            x: 5 + (i % 2) * 45,
            y: 5 + Math.floor(i / 2) * 65,
            width: 40, height: 55,
            rotation: 0,
            zIndex: i + 1,
            fitMode: 'contain',
        }));
        setPages([{ id: 'p1', items: initial }]);
        setNextZ(initial.length + 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPhotos]);

    // Initial history push
    useEffect(() => {
        if (history.length === 0 && pages[0].items.length > 0) {
            pushToHistory(pages);
        }
    }, [pages, history.length, pushToHistory]);

    /* ── item helpers ── */
    const addItem = (url: string, type: 'photo' | 'template', fixedW?: number, fixedH?: number) => {

        // Load image to get its natural aspect ratio → size the div to match exactly
        const probe = new window.Image();
        probe.onload = () => {
            const aspect = probe.naturalWidth / probe.naturalHeight;
            // Fit within 65% of the paper, preserving aspect ratio
            let w = paper.width * 0.65;
            let h = w / aspect;
            if (h > paper.height * 0.65) {
                h = paper.height * 0.65;
                w = h * aspect;
            }
            // Center on paper
            const x = (paper.width - w) / 2;
            const y = (paper.height - h) / 2;
            const item: PrintItem = {
                id: `item-${Math.random()}`, url, type,
                x, y, width: w, height: h,
                rotation: 0, zIndex: nextZ,
                fitMode: 'cover',  // div matches image aspect → cover = no letterbox
            };
            const newPages = setItems(prev => [...prev, item]);
            pushToHistory(newPages);
            setSelectedItemIds([item.id]);
            setNextZ(z => z + 1);
        };
        probe.onerror = () => {
            // Fallback to defaults if image fails to load
            const item: PrintItem = {
                id: `item-${Math.random()}`, url, type,
                x: 10, y: 10, width: fixedW ?? 40, height: fixedH ?? 55,
                rotation: 0, zIndex: nextZ, fitMode: 'contain',
            };
            const newPages = setItems(prev => [...prev, item]);
            pushToHistory(newPages);
            setSelectedItemIds([item.id]);
            setNextZ(z => z + 1);
        };
        probe.src = url;
    };

    const updateItem = (id: string, updates: Partial<PrintItem>) =>
        setItems(prev => prev.map(it => it.id === id ? { ...it, ...updates } : it));

    const alignSelected = (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
        if (selectedItemIds.length < 2) return;
        const selectedItems = items.filter(it => selectedItemIds.includes(it.id));

        let targetValue = 0;
        if (mode === 'left') targetValue = Math.min(...selectedItems.map(it => it.x));
        if (mode === 'right') targetValue = Math.max(...selectedItems.map(it => it.x + it.width));
        if (mode === 'center') {
            const minX = Math.min(...selectedItems.map(it => it.x));
            const maxX = Math.max(...selectedItems.map(it => it.x + it.width));
            targetValue = minX + (maxX - minX) / 2;
        }
        if (mode === 'top') targetValue = Math.min(...selectedItems.map(it => it.y));
        if (mode === 'bottom') targetValue = Math.max(...selectedItems.map(it => it.y + it.height));
        if (mode === 'middle') {
            const minY = Math.min(...selectedItems.map(it => it.y));
            const maxY = Math.max(...selectedItems.map(it => it.y + it.height));
            targetValue = minY + (maxY - minY) / 2;
        }

        const newPages = setItems(prev => prev.map(it => {
            if (!selectedItemIds.includes(it.id)) return it;
            if (mode === 'left') return { ...it, x: targetValue };
            if (mode === 'right') return { ...it, x: targetValue - it.width };
            if (mode === 'center') return { ...it, x: targetValue - it.width / 2 };
            if (mode === 'top') return { ...it, y: targetValue };
            if (mode === 'bottom') return { ...it, y: targetValue - it.height };
            if (mode === 'middle') return { ...it, y: targetValue - it.height / 2 };
            return it;
        }));
        pushToHistory(newPages);
    };

    const distributeSelected = (axis: 'horizontal' | 'vertical') => {
        if (selectedItemIds.length < 3) return;
        const selectedItems = [...items.filter(it => selectedItemIds.includes(it.id))];

        if (axis === 'horizontal') {
            selectedItems.sort((a, b) => a.x - b.x);
            const minX = selectedItems[0].x;
            const maxX = selectedItems[selectedItems.length - 1].x + selectedItems[selectedItems.length - 1].width;
            const totalWidths = selectedItems.reduce((acc, it) => acc + it.width, 0);
            const gap = (maxX - minX - totalWidths) / (selectedItems.length - 1);

            let currentX = minX;
            const newPages = setItems(prev => {
                const mapped = prev.map(it => {
                    const sItem = selectedItems.find(si => si.id === it.id);
                    if (!sItem) return it;
                    return { ...it, _tempSortX: sItem.x } as any;
                });
                // Sort the selected subset by their current X to apply distribution in order
                const selectedSubset = mapped.filter(it => selectedItemIds.includes(it.id)).sort((a: any, b: any) => (a._tempSortX || 0) - (b._tempSortX || 0));

                return mapped.map(it => {
                    const subIdx = selectedSubset.findIndex(ss => ss.id === it.id);
                    if (subIdx === -1) return it;
                    const updated = { ...it, x: currentX };
                    currentX += it.width + gap;
                    delete (updated as any)._tempSortX;
                    return updated;
                });
            });
            pushToHistory(newPages);
        } else {
            selectedItems.sort((a, b) => a.y - b.y);
            const minY = selectedItems[0].y;
            const maxY = selectedItems[selectedItems.length - 1].y + selectedItems[selectedItems.length - 1].height;
            const totalHeights = selectedItems.reduce((acc, it) => acc + it.height, 0);
            const gap = (maxY - minY - totalHeights) / (selectedItems.length - 1);

            let currentY = minY;
            const newPages = setItems(prev => {
                const mapped = prev.map(it => {
                    const sItem = selectedItems.find(si => si.id === it.id);
                    if (!sItem) return it;
                    return { ...it, _tempSortY: sItem.y } as any;
                });
                const selectedSubset = mapped.filter(it => selectedItemIds.includes(it.id)).sort((a: any, b: any) => (a._tempSortY || 0) - (b._tempSortY || 0));

                return mapped.map(it => {
                    const subIdx = selectedSubset.findIndex(ss => ss.id === it.id);
                    if (subIdx === -1) return it;
                    const updated = { ...it, y: currentY };
                    currentY += it.height + gap;
                    delete (updated as any)._tempSortY;
                    return updated;
                });
            });
            pushToHistory(newPages);
        }
    };

    const deleteItem = useCallback((id: string) => {
        const newPages = setItems(prev => prev.filter(it => it.id !== id));
        pushToHistory(newPages);
        setSelectedItemIds(prev => prev.filter(pid => pid !== id));
    }, [pushToHistory, setItems]);

    const deleteSelectedItems = useCallback(() => {
        if (selectedItemIds.length === 0) return;

        if (!isConfirmingBulkDelete) {
            setIsConfirmingBulkDelete(true);
            return;
        }

        const newPages = setItems(prev => prev.filter(it => !selectedItemIds.includes(it.id)));
        pushToHistory(newPages);
        setSelectedItemIds([]);
        setIsConfirmingBulkDelete(false);
    }, [selectedItemIds, isConfirmingBulkDelete, pushToHistory, setItems]);

    const handleContextMenu = (e: React.MouseEvent, itemId: string) => {
        e.preventDefault();
        setSelectedItemIds([itemId]);
        setContextMenu({ x: e.clientX, y: e.clientY, itemId });
    };

    /* ── grid layout — accepts explicit gap/pad for realtime slider updates ── */
    const applyGridLayout = (rows: number, cols: number, gap = gridGap, pad = gridPad) => {
        const cellW = (paper.width - pad * 2 - gap * (cols - 1)) / cols;
        const cellH = (paper.height - pad * 2 - gap * (rows - 1)) / rows;

        setActiveLayout({ rows, cols });
        const newPages = setItems(prev => {
            const photos = prev.filter(it => it.type === 'photo');
            const decor = prev.filter(it => it.type !== 'photo').map(it => ({ ...it, zIndex: 20 }));

            const arranged: PrintItem[] = photos.map((ph, idx) => {
                const r = Math.floor(idx / cols);
                const c = idx % cols;
                return {
                    ...ph,
                    x: pad + c * (cellW + gap),
                    y: pad + r * (cellH + gap),
                    width: cellW,
                    height: cellH,
                    zIndex: 5,
                    fitMode: 'contain' as const,
                };
            });

            return [...arranged, ...decor];
        });
        pushToHistory(newPages);
    };

    /* ── pages ── */
    const addPage = () => {
        const newPages = [...pages, { id: `p-${Math.random()}`, items: [] }];
        setPages(newPages);
        pushToHistory(newPages);
        setCurrentPageIndex(pages.length);
        setSelectedItemIds([]);
    };
    const deletePage = (idx: number) => {
        if (pages.length === 1) return;
        setPages(p => p.filter((_, i) => i !== idx));
        setCurrentPageIndex(Math.max(0, idx - 1));
    };

    /* ── plain-mouse drag (no Framer Motion drag) ── */
    const startDrag = (e: React.MouseEvent, item: PrintItem) => {
        if (item.isLocked) return;
        e.stopPropagation();
        e.preventDefault();

        let isSelected = selectedItemIds.includes(item.id);

        if (e.shiftKey) {
            if (isSelected) {
                setSelectedItemIds(prev => prev.filter(id => id !== item.id));
                isSelected = false;
            } else {
                setSelectedItemIds(prev => [...prev, item.id]);
                isSelected = true;
            }
        } else if (!isSelected) {
            setSelectedItemIds([item.id]);
            isSelected = true;
        }
        setIsConfirmingBulkDelete(false);

        const dragTargets = isSelected
            ? (e.shiftKey ? [...selectedItemIds.filter(id => id !== item.id), item.id] : selectedItemIds)
            : [item.id];

        if (e.shiftKey && !isSelected) return; // Deselected, don't drag

        const ox = e.clientX, oy = e.clientY;
        const startStates = items.filter(it => dragTargets.includes(it.id))
            .map(it => ({ id: it.id, x: it.x, y: it.y }));

        const onMove = (m: MouseEvent) => {
            const dx = (m.clientX - ox) / scale;
            const dy = (m.clientY - oy) / scale;
            setItems(prev => prev.map(it => {
                const s = startStates.find(ss => ss.id === it.id);
                if (s) return { ...it, x: s.x + dx, y: s.y + dy };
                return it;
            }));
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            setPages(current => {
                pushToHistory(current);
                return current;
            });
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    /* ── selection marquee ── */
    const startMarquee = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Left click only
        const rect = e.currentTarget.getBoundingClientRect();
        const x1 = (e.clientX - rect.left) / scale;
        const y1 = (e.clientY - rect.top) / scale;

        const onMove = (m: MouseEvent) => {
            const x2 = (m.clientX - rect.left) / scale;
            const y2 = (m.clientY - rect.top) / scale;
            setSelectionBox({ x1, y1, x2, y2 });

            const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
            const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);

            const hits = items.filter(it =>
                it.x < maxX && it.x + it.width > minX &&
                it.y < maxY && it.y + it.height > minY
            ).map(it => it.id);
            setSelectedItemIds(hits);
        };
        const onUp = () => {
            setSelectionBox(null);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };
    const startResize = (e: React.MouseEvent, item: PrintItem, dx: number, dy: number, resW: boolean, resH: boolean) => {
        if (item.isLocked) return;
        e.stopPropagation(); e.preventDefault();
        const ox = e.clientX, oy = e.clientY;
        const { width: sw, height: sh, x: sox, y: soy } = item;

        const onMove = (m: MouseEvent) => {
            const rDx = (m.clientX - ox) / scale;
            const rDy = (m.clientY - oy) / scale;
            const updates: Partial<PrintItem> = {};
            if (resW) {
                const nw = Math.max(5, sw + rDx * dx);
                updates.width = nw;
                if (dx < 0) updates.x = sox - (nw - sw);
            }
            if (resH) {
                const nh = Math.max(5, sh + rDy * dy);
                updates.height = nh;
                if (dy < 0) updates.y = soy - (nh - sh);
            }
            updateItem(item.id, updates);
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            setPages(current => {
                pushToHistory(current);
                return current;
            });
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    /* ── print ── */
    const handlePrint = () => {
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<html><head><title>SnapWrap Print</title><style>
            @page{margin:0;size:${paper.width}mm ${paper.height}mm}
            body{margin:0;padding:0;background:white}
            .page{width:${paper.width}mm;height:${paper.height}mm;position:relative;overflow:hidden;page-break-after:always;background:white}
            .item{position:absolute;overflow:hidden}
            img{width:100%;height:100%}
        </style></head><body onload="window.print();setTimeout(()=>window.close(),1200);">
            ${pages.map(pg => `<div class="page">${[...pg.items].sort((a, b) => a.zIndex - b.zIndex).map(it =>
            `<div class="item" style="left:${it.x}mm;top:${it.y}mm;width:${it.width}mm;height:${it.height}mm;transform:rotate(${it.rotation}deg);z-index:${it.zIndex}">
                        <div style="width:100%;height:100%;position:relative;overflow:hidden">
                            <img src="${it.url}" style="width:100%;height:100%;object-fit:${it.fitMode};transform:scale(${it.scale || 1}) translate(${it.offsetX || 0}%, ${it.offsetY || 0}%)"/>
                        </div>
                    </div>`
        ).join('')
            }</div>`).join('')}
        </body></html>`);
        w.document.close();
    };

    /* ─── Keyboard & Mouse Shortcuts ─── */
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isCtrl = e.ctrlKey || e.metaKey;

            // Undo: Ctrl + Z
            if (isCtrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            // Redo: Ctrl + Y or Ctrl + Shift + Z
            if ((isCtrl && e.key.toLowerCase() === 'y') || (isCtrl && e.shiftKey && e.key.toLowerCase() === 'z')) {
                e.preventDefault();
                redo();
            }
            // Delete: Delete or Backspace
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemIds.length > 0) {
                if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    deleteSelectedItems();
                }
            }
            // Zoom: Ctrl + / Ctrl - (including numpad)
            if (isCtrl && (e.key === '=' || e.key === '+' || e.key === 'Add')) {
                e.preventDefault();
                setScale(prev => Math.min(6, prev + 0.25));
            }
            if (isCtrl && (e.key === '-' || e.key === 'Subtract')) {
                e.preventDefault();
                setScale(prev => Math.max(0.5, prev - 0.25));
            }
            if (isCtrl && (e.key === '0' || e.key === 'Numpad0')) {
                e.preventDefault();
                setScale(2);
            }
        };

        // Ctrl + Wheel Zoom
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.25 : 0.25;
                setScale(prev => Math.max(0.5, Math.min(6, prev + delta)));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('wheel', handleWheel);
        };
    }, [selectedItemIds, undo, redo, deleteSelectedItems, setScale]);

    /* ─── Render ──────────────────────────────────────────────────────── */
    const selectedItem = items.find(it => it.id === selectedItemId) ?? null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] bg-neutral-900 flex flex-col font-sans"
        >
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                    height: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: ${themeColor}99;
                    border-radius: 10px;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: ${themeColor};
                }
            `}} />
            {/* Header */}
            <header className="h-16 bg-neutral-950 border-b border-white/5 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors"><X size={22} /></button>
                    <div className="h-6 w-px bg-white/10" />
                    <span className="text-xs font-black text-white uppercase tracking-widest">Print Designer</span>
                </div>

                <div className="flex items-center gap-4">
                    {/* Undo/Redo */}
                    <div className="flex items-center gap-1 bg-neutral-900 rounded-full px-2 py-1 border border-white/5 mr-2">
                        <button
                            onClick={undo}
                            disabled={historyIndex <= 0}
                            className="p-1.5 text-neutral-500 hover:text-white transition-colors disabled:opacity-20"
                            title="Undo (Ctrl+Z)"
                        >
                            <Undo size={16} />
                        </button>
                        <button
                            onClick={redo}
                            disabled={historyIndex >= history.length - 1}
                            className="p-1.5 text-neutral-500 hover:text-white transition-colors disabled:opacity-20"
                            title="Redo (Ctrl+Y)"
                        >
                            <Redo size={16} />
                        </button>
                    </div>

                    {/* Zoom Controls */}
                    <div className="flex items-center gap-1 bg-neutral-900 rounded-full px-2 py-1 border border-white/5 mr-2">
                        <button
                            onClick={() => setScale(prev => Math.max(0.5, prev - 0.25))}
                            className="p-1.5 text-neutral-500 hover:text-white transition-colors"
                            title="Zoom Out"
                        >
                            <ZoomOut size={16} />
                        </button>
                        <div className="px-2 min-w-[60px] text-center border-x border-white/5">
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                {Math.round((scale / 2) * 100)}%
                            </span>
                        </div>
                        <button
                            onClick={() => setScale(prev => Math.min(6, prev + 0.25))}
                            className="p-1.5 text-neutral-500 hover:text-white transition-colors"
                            title="Zoom In"
                        >
                            <ZoomIn size={16} />
                        </button>
                        <button
                            onClick={() => setScale(2)}
                            className="p-1.5 text-neutral-400 hover:text-white transition-colors border-l border-white/5 ml-1"
                            title="Reset Zoom"
                        >
                            <Search size={14} />
                        </button>
                    </div>

                    {/* Page nav */}
                    <div className="flex items-center gap-2 bg-neutral-900 rounded-full px-3 py-1 border border-white/5">
                        <button disabled={currentPageIndex === 0} onClick={() => setCurrentPageIndex(p => p - 1)} className="text-neutral-500 hover:text-white disabled:opacity-20"><ChevronLeft size={16} /></button>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest px-2">Page {currentPageIndex + 1}/{pages.length}</span>
                        <button disabled={currentPageIndex === pages.length - 1} onClick={() => setCurrentPageIndex(p => p + 1)} className="text-neutral-500 hover:text-white disabled:opacity-20"><ChevronRight size={16} /></button>
                        <button onClick={addPage} className="ml-1 pl-2 border-l border-white/10 text-neutral-400 hover:text-white"><FilePlus size={16} /></button>
                    </div>
                    {/* Paper size */}
                    {/* Orientation Toggle */}
                    <div className="flex bg-neutral-950 rounded-full p-1 border border-white/5">
                        <button 
                            onClick={() => setPaper(prev => ({ ...prev, width: Math.min(prev.width, prev.height), height: Math.max(prev.width, prev.height) }))}
                            className={`p-2 rounded-full transition-all ${paper.width < paper.height ? 'bg-white text-neutral-900' : 'text-neutral-500 hover:text-white'}`}
                            title="Portrait"
                        >
                            <div className="w-3 h-4 border-2 border-current rounded-[1px]" />
                        </button>
                        <button 
                            onClick={() => setPaper(prev => ({ ...prev, width: Math.max(prev.width, prev.height), height: Math.min(prev.width, prev.height) }))}
                            className={`p-2 rounded-full transition-all ${paper.width > paper.height ? 'bg-white text-neutral-900' : 'text-neutral-500 hover:text-white'}`}
                            title="Landscape"
                        >
                            <div className="w-4 h-3 border-2 border-current rounded-[1px]" />
                        </button>
                    </div>

                    {/* Paper size dropdown */}
                    <div className="relative group">
                        <select 
                            onChange={(e) => {
                                const s = PAPER_SIZES.find(sz => sz.name === e.target.value);
                                if (s) setPaper(s);
                            }}
                            value={paper.name}
                            className="bg-neutral-900 border border-white/5 rounded-full px-5 py-2 text-[10px] font-black text-white uppercase tracking-widest outline-none appearance-none pr-10 focus:border-white/20 transition-all cursor-pointer"
                        >
                            {PAPER_SIZES.map(s => (
                                <option key={s.name} value={s.name}>{s.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                            <ChevronRight size={14} className="rotate-90" />
                        </div>
                    </div>

                    {/* Custom Size Inputs */}
                    {paper.name === 'Custom' && (
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-neutral-900 rounded-full px-3 py-1 border border-blue-500/30">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[8px] font-black text-neutral-500 uppercase tracking-tighter">W</span>
                                    <input type="number" value={paper.width} onChange={e => {
                                        const w = +e.target.value;
                                        setPaper({ ...paper, width: w });
                                        localStorage.setItem('snapwrap_print_last_w', w.toString());
                                    }}
                                        className="w-12 bg-transparent text-[10px] font-black text-white outline-none border-b border-white/10 focus:border-blue-400 text-center"
                                    />
                                    <span className="text-[8px] text-neutral-600">mm</span>
                                </div>
                                <div className="h-3 w-px bg-white/10 mx-1" />
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[8px] font-black text-neutral-500 uppercase tracking-tighter">H</span>
                                    <input type="number" value={paper.height} onChange={e => {
                                        const h = +e.target.value;
                                        setPaper({ ...paper, height: h });
                                        localStorage.setItem('snapwrap_print_last_h', h.toString());
                                    }}
                                        className="w-12 bg-transparent text-[10px] font-black text-white outline-none border-b border-white/10 focus:border-blue-400 text-center"
                                    />
                                    <span className="text-[8px] text-neutral-600">mm</span>
                                </div>
                            </div>

                            {localStorage.getItem('snapwrap_print_last_w') && (
                                <button 
                                    onClick={() => {
                                        const w = parseFloat(localStorage.getItem('snapwrap_print_last_w') || '150');
                                        const h = parseFloat(localStorage.getItem('snapwrap_print_last_h') || '150');
                                        setPaper({ ...paper, width: w, height: h });
                                    }}
                                    className="bg-neutral-900 px-3 py-1.5 rounded-full border border-white/10 text-[8px] font-black text-neutral-400 hover:text-white transition-all uppercase tracking-widest"
                                >
                                    Recall: {localStorage.getItem('snapwrap_print_last_w')}x{localStorage.getItem('snapwrap_print_last_h')}
                                </button>
                            )}
                            
                            <button 
                                onClick={rotatePaper}
                                className="p-1.5 bg-neutral-900 rounded-full border border-white/5 text-neutral-400 hover:text-blue-400 transition-all"
                                title="Rotate Paper 90°"
                            >
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    )}
                    <button onClick={handlePrint}
                        className="px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2 text-white"
                        style={{ backgroundColor: themeColor || '#6366f1' }}
                    ><Printer size={14} /> Print</button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <aside className="w-72 bg-neutral-950 border-r border-white/5 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                        {/* Add Photos */}
                        <section className="space-y-3">
                            <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Photos</h3>
                            <div className="grid grid-cols-2 gap-1.5 max-h-[380px] overflow-y-auto custom-scrollbar">
                                {allPhotos.map(ph => (
                                    <button key={ph.id}
                                        onClick={() => addItem(ph.url, 'photo')}
                                        draggable="true"
                                        onDragStart={e => e.dataTransfer.setData('replaceUrl', ph.url)}
                                        className="relative aspect-[3/4] rounded-lg overflow-hidden border border-white/5 hover:border-white/30 transition-all group cursor-grab active:cursor-grabbing"
                                    >
                                        <Image src={ph.url} alt="" fill className="object-cover group-hover:scale-105 transition-transform" unoptimized />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <div className="flex flex-col items-center gap-1">
                                                <Plus className="text-white" size={18} />
                                                <span className="text-[6px] text-white font-black uppercase tracking-tighter">Drag to Swap</span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Grid Layouts */}
                        <section className="space-y-3">
                            <h3 className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Grid Layouts</h3>

                            {/* Gap & Padding controls */}
                            <div className="space-y-2 bg-neutral-900 rounded-xl p-3 border border-white/5">
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest flex justify-between">
                                        Gap between images <span className="text-white">{gridGap}mm</span>
                                    </label>
                                    <input type="range" min={0} max={15} step={1}
                                        value={gridGap}
                                        onChange={e => {
                                            const v = +e.target.value;
                                            setGridGap(v);
                                            if (activeLayout) applyGridLayout(activeLayout.rows, activeLayout.cols, v, gridPad);
                                        }}
                                        className="w-full accent-blue-400 h-1"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest flex justify-between">
                                        Edge margin <span className="text-white">{gridPad}mm</span>
                                    </label>
                                    <input type="range" min={0} max={20} step={1}
                                        value={gridPad}
                                        onChange={e => {
                                            const v = +e.target.value;
                                            setGridPad(v);
                                            if (activeLayout) applyGridLayout(activeLayout.rows, activeLayout.cols, gridGap, v);
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-1.5">
                                {GRID_LAYOUTS.map(l => {
                                    const isActive = activeLayout?.rows === l.rows && activeLayout?.cols === l.cols;
                                    return (
                                        <button key={l.label} onClick={() => applyGridLayout(l.rows, l.cols)}
                                            className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all group ${isActive
                                                ? 'bg-blue-500/20 border-blue-400'
                                                : 'bg-neutral-900 border-white/5 hover:border-blue-400/60 hover:bg-neutral-800'
                                                }`}
                                            title={l.label}
                                        >
                                            <div className="w-full aspect-[3/4] rounded overflow-hidden"
                                                style={{ display: 'grid', gridTemplateColumns: `repeat(${l.cols},1fr)`, gridTemplateRows: `repeat(${l.rows},1fr)`, gap: '1px' }}
                                            >
                                                {Array.from({ length: l.rows * l.cols }).map((_, i) => (
                                                    <div key={i} className={`transition-colors ${isActive ? 'bg-blue-400/70' : 'bg-neutral-600 group-hover:bg-blue-500/70'}`} />
                                                ))}
                                            </div>
                                            <p className={`text-[7px] font-black uppercase tracking-wider leading-none transition-colors ${isActive ? 'text-blue-400' : 'text-neutral-500 group-hover:text-white'}`}>{l.cols}×{l.rows}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Multi-Select Alignment Tools */}
                        {selectedItemIds.length > 1 && (
                            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-6 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[9px] font-black text-white uppercase tracking-[0.2em]">Bulk Actions ({selectedItemIds.length})</h3>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Alignment</label>
                                    <div className="grid grid-cols-3 gap-1">
                                        {[
                                            { mode: 'left', icon: AlignLeft, label: 'Left' },
                                            { mode: 'center', icon: AlignCenter, label: 'Center' },
                                            { mode: 'right', icon: AlignRight, label: 'Right' },
                                            { mode: 'top', icon: AlignTop, label: 'Top' },
                                            { mode: 'middle', icon: AlignMiddle, label: 'Middle' },
                                            { mode: 'bottom', icon: AlignBottom, label: 'Bottom' },
                                        ].map(tool => (
                                            <button key={tool.mode} onClick={() => alignSelected(tool.mode as any)}
                                                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-neutral-900 border border-white/5 hover:border-blue-500/50 hover:bg-neutral-800 transition-all group"
                                            >
                                                <tool.icon size={14} className="text-neutral-400 group-hover:text-blue-400" />
                                                <span className="text-[7px] font-black uppercase text-neutral-600 group-hover:text-white">{tool.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Distribution</label>
                                    <div className="grid grid-cols-2 gap-1">
                                        <button onClick={() => distributeSelected('horizontal')} disabled={selectedItemIds.length < 3}
                                            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-neutral-900 border border-white/5 hover:border-blue-500/50 hover:bg-neutral-800 transition-all group disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <MoveHorizontal size={14} className="text-neutral-400 group-hover:text-blue-400" />
                                            <span className="text-[7px] font-black uppercase text-neutral-600 group-hover:text-white">Horizontal</span>
                                        </button>
                                        <button onClick={() => distributeSelected('vertical')} disabled={selectedItemIds.length < 3}
                                            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-neutral-900 border border-white/5 hover:border-blue-500/50 hover:bg-neutral-800 transition-all group disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <MoveVertical size={14} className="text-neutral-400 group-hover:text-blue-400" />
                                            <span className="text-[7px] font-black uppercase text-neutral-600 group-hover:text-white">Vertical</span>
                                        </button>
                                    </div>
                                    <button 
                                        onClick={deleteSelectedItems}
                                        onMouseLeave={() => setIsConfirmingBulkDelete(false)}
                                        className={`w-full py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 mt-2 ${
                                            isConfirmingBulkDelete 
                                            ? 'bg-red-600 text-white scale-[0.98]' 
                                            : 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white'
                                        }`}
                                    >
                                        <Trash2 size={12} /> 
                                        {isConfirmingBulkDelete ? 'Click again to confirm' : 'Delete Selection'}
                                    </button>
                                </div>
                            </motion.section>
                        )}

                        {/* Selected item properties */}
                        {selectedItem && (
                            <motion.section initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 pt-6 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[9px] font-black text-white uppercase tracking-[0.2em]">Selected</h3>
                                    <button
                                        onClick={() => setIsReplacing(!isReplacing)}
                                        className={`px-2 py-1 rounded-md text-[7px] font-black uppercase tracking-widest transition-all ${isReplacing ? 'bg-blue-500 text-white' : 'bg-white/5 text-neutral-400 hover:text-white'}`}
                                    >
                                        {isReplacing ? 'Cancel Replace' : 'Replace Image'}
                                    </button>
                                </div>

                                {isReplacing ? (
                                    <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto custom-scrollbar p-2 bg-black/20 rounded-xl border border-white/5">
                                        {allPhotos.map(ph => (
                                            <button key={ph.id} onClick={() => replaceImage(selectedItem.id, ph.url)}
                                                className="relative aspect-[3/4] rounded-lg overflow-hidden border border-white/5 hover:border-blue-400 transition-all group"
                                            >
                                                <Image src={ph.url} alt="" fill className="object-cover" unoptimized />
                                                <div className="absolute inset-0 bg-blue-500/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <RefreshCw className="text-white animate-spin-slow" size={16} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        {/* Fit mode */}
                                        <div className="space-y-2">
                                            <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Image Fit</label>
                                            <div className="flex bg-neutral-900 rounded-xl p-0.5 border border-white/5">
                                                {(['contain', 'cover'] as const).map(mode => (
                                                    <button key={mode} onClick={() => updateItem(selectedItem.id, { fitMode: mode })}
                                                        className={`flex-1 py-2.5 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${selectedItem.fitMode === mode ? 'bg-white text-neutral-900' : 'text-neutral-500 hover:text-white'}`}
                                                    >
                                                        {mode === 'contain' ? <><Maximize size={12} /> Full</> : <><Crop size={12} /> Fill</>}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Layer order */}
                                        <div className="flex gap-2">
                                            <button onClick={() => updateItem(selectedItem.id, { zIndex: nextZ })}
                                                className="flex-1 py-2.5 bg-neutral-900 rounded-lg text-[8px] font-black uppercase tracking-widest flex flex-col items-center gap-1 border border-white/5 hover:border-white/20"
                                            ><BringToFront size={14} /> Front</button>
                                            <button onClick={() => updateItem(selectedItem.id, { zIndex: 1 })}
                                                className="flex-1 py-2.5 bg-neutral-900 rounded-lg text-[8px] font-black uppercase tracking-widest flex flex-col items-center gap-1 border border-white/5 hover:border-white/20"
                                            ><SendToBack size={14} /> Back</button>
                                        </div>

                                        {/* Rotation */}
                                        <div className="space-y-2">
                                            <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest flex justify-between">
                                                Rotation <span>{selectedItem.rotation}°</span>
                                            </label>
                                            <input type="range" min={0} max={360} step={15}
                                                value={selectedItem.rotation}
                                                onChange={e => updateItem(selectedItem.id, { rotation: +e.target.value })}
                                                className="w-full accent-white"
                                            />
                                        </div>

                                        {/* Advanced Crop */}
                                        <div className="space-y-4 pt-4 border-t border-white/5 bg-white/[0.02] p-3 rounded-xl mt-4 border-l-2 border-l-blue-500/50">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Crop size={12} className="text-blue-400" />
                                                <label className="text-[9px] font-black text-white uppercase tracking-widest">Image Composition</label>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest flex justify-between">
                                                    Zoom / Crop <span>{Math.round((selectedItem.scale || 1) * 100)}%</span>
                                                </label>
                                                <input type="range" min={1} max={5} step={0.05}
                                                    value={selectedItem.scale || 1}
                                                    onChange={e => updateItem(selectedItem.id, { scale: +e.target.value })}
                                                    className="w-full accent-blue-500"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-2">
                                                    <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Pan X</label>
                                                    <input type="range" min={-50} max={50} step={1}
                                                        value={selectedItem.offsetX || 0}
                                                        onChange={e => updateItem(selectedItem.id, { offsetX: +e.target.value })}
                                                        className="w-full accent-neutral-600"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Pan Y</label>
                                                    <input type="range" min={-50} max={50} step={1}
                                                        value={selectedItem.offsetY || 0}
                                                        onChange={e => updateItem(selectedItem.id, { offsetY: +e.target.value })}
                                                        className="w-full accent-neutral-600"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => updateItem(selectedItem.id, { scale: 1, offsetX: 0, offsetY: 0 })}
                                                className="w-full py-2 text-[7px] font-black uppercase tracking-[0.2em] text-neutral-500 hover:text-white transition-colors"
                                            >Reset Crop</button>
                                        </div>

                                        {/* Delete */}
                                        <button onClick={deleteSelectedItems}
                                            className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                        ><Trash2 size={14} /> Delete</button>
                                    </>
                                )}
                            </motion.section>
                        )}
                    </div>

                    {/* Bottom page actions */}
                    <div className="p-4 border-t border-white/5 flex gap-2">
                        <button onClick={() => deletePage(currentPageIndex)} disabled={pages.length === 1}
                            className="flex-1 py-2.5 bg-red-500/10 text-red-400 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white disabled:opacity-20 transition-all flex items-center justify-center gap-1"
                        ><Trash2 size={12} /> Del Page</button>
                        <button onClick={addPage}
                            className="flex-1 py-2.5 bg-white/10 text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-white hover:text-neutral-900 transition-all flex items-center justify-center gap-1"
                        ><Plus size={12} /> New Page</button>
                    </div>
                </aside>

                {/* Canvas */}
                <main
                    className="flex-1 bg-[#fafafa] overflow-auto flex items-start justify-center p-16 cursor-default"
                    style={{ 
                        backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)', 
                        backgroundSize: '30px 30px' 
                    }}
                    onMouseDown={e => {
                        if (e.target === e.currentTarget) {
                            setSelectedItemIds([]);
                        }
                    }}
                >
                    {/* Paper */}
                    <div
                        className="relative bg-white shadow-2xl shrink-0"
                        style={{ width: paper.width * scale, height: paper.height * scale }}
                        onMouseDown={e => {
                            if (e.target === e.currentTarget) startMarquee(e);
                        }}
                    >
                        {/* Grid dots */}
                        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
                            style={{ backgroundImage: 'linear-gradient(#000 1px,transparent 1px),linear-gradient(90deg,#000 1px,transparent 1px)', backgroundSize: `${10 * scale}px ${10 * scale}px` }}
                        />

                        {/* Items */}
                        <AnimatePresence>
                            {[...items].sort((a, b) => a.zIndex - b.zIndex).map(item => {
                                const isSelected = selectedItemIds.includes(item.id);
                                return (
                                    <div
                                        key={item.id}
                                        className={`absolute select-none border-2 transition-all ${dragOverItemId === item.id ? 'border-blue-500 scale-[1.02] shadow-lg shadow-blue-500/20' :
                                            isSelected ? 'border-blue-400 shadow-xl' : 'border-transparent hover:border-neutral-300'
                                            }`}
                                        style={{
                                            left: item.x * scale,
                                            top: item.y * scale,
                                            width: item.width * scale,
                                            height: item.height * scale,
                                            transform: `rotate(${item.rotation}deg)`,
                                            zIndex: isSelected || dragOverItemId === item.id ? 999 : item.zIndex,
                                            cursor: 'move',
                                        }}
                                        onMouseDown={e => { startDrag(e, item); setContextMenu(null); }}
                                        onContextMenu={e => handleContextMenu(e, item.id)}
                                        onClick={e => {
                                            e.stopPropagation();
                                            setContextMenu(null);
                                            // Selection handled in onMouseDown (startDrag)
                                        }}
                                        onDragOver={e => {
                                            if (item.type === 'photo' || item.type === 'template') {
                                                e.preventDefault();
                                                setDragOverItemId(item.id);
                                            }
                                        }}
                                        onDragLeave={() => setDragOverItemId(null)}
                                        onDrop={e => {
                                            e.preventDefault();
                                            setDragOverItemId(null);
                                            const url = e.dataTransfer.getData('replaceUrl');
                                            if (url) replaceImage(item.id, url);
                                        }}
                                    >
                                        {/* Locked Indicator */}
                                        {item.isLocked && (
                                            <div className="absolute top-1 left-1 bg-black/60 p-1 rounded-md text-white z-[1001] backdrop-blur-sm">
                                                <Lock size={10} />
                                            </div>
                                        )}

                                        {/* Content */}
                                        <div className="w-full h-full relative overflow-hidden pointer-events-none">
                                            <Image src={item.url} alt="" fill
                                                className={`transition-all duration-300 ${item.fitMode === 'cover' ? 'object-cover' : 'object-contain'}`}
                                                style={{
                                                    transform: `scale(${item.scale || 1}) translate(${(item.offsetX || 0)}%, ${(item.offsetY || 0)}%)`
                                                }}
                                                unoptimized
                                            />
                                        </div>

                                        {/* Selection handles */}
                                        {isSelected && (
                                            <>
                                                {/* Delete — top-right corner, inside the image */}
                                                <button
                                                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow hover:bg-red-600 transition-colors z-[1000]"
                                                    onClick={e => { e.stopPropagation(); deleteItem(item.id); }}
                                                    onMouseDown={e => e.stopPropagation()}
                                                ><Trash2 size={10} /></button>

                                                {/* 8 resize handles */}
                                                {HANDLES.map(([cursor, pos, dx, dy, resW, resH], hi) => (
                                                    <div key={hi}
                                                        className={`absolute ${pos} w-1.5 h-1.5 bg-white border border-blue-400 rounded-[2px] z-[1000]`}
                                                        style={{ cursor }}
                                                        onMouseDown={e => startResize(e, item, dx, dy, resW, resH)}
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </AnimatePresence>

                        {/* Selection Box Overlay */}
                        {selectionBox && (
                            <div
                                className="absolute border-blue-400 bg-blue-400/5 backdrop-blur-[1px] pointer-events-none z-[2000] rounded-[2px]"
                                style={{
                                    borderStyle: 'dashed',
                                    borderWidth: '1.5px',
                                    left: Math.min(selectionBox.x1, selectionBox.x2) * scale,
                                    top: Math.min(selectionBox.y1, selectionBox.y2) * scale,
                                    width: Math.abs(selectionBox.x2 - selectionBox.x1) * scale,
                                    height: Math.abs(selectionBox.y2 - selectionBox.y1) * scale,
                                }}
                            />
                        )}
                    </div>
                </main>
            </div>

            {/* Context Menu */}
            <AnimatePresence>
                {contextMenu && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed z-[1000] bg-neutral-900 border border-white/10 rounded-xl shadow-2xl p-1.5 w-48"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onClick={e => e.stopPropagation()}
                    >
                        {(() => {
                            const item = items.find(it => it.id === contextMenu.itemId);
                            if (!item) return null;
                            return (
                                <div className="flex flex-col gap-0.5">
                                    <button
                                        onClick={() => {
                                            updateItem(item.id, { isLocked: !item.isLocked });
                                            setContextMenu(null);
                                        }}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        {item.isLocked ? <><Unlock size={14} className="text-blue-400" /> Unlock Layer</> : <><Lock size={14} /> Lock Layer</>}
                                    </button>

                                    <button
                                        onClick={() => {
                                            updateItem(item.id, { fitMode: item.fitMode === 'cover' ? 'contain' : 'cover' });
                                            setContextMenu(null);
                                        }}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        <Crop size={14} /> {item.fitMode === 'cover' ? 'Fit Whole Image' : 'Fill Container'}
                                    </button>

                                    <button
                                        onClick={() => {
                                            updateItem(item.id, { scale: 1, offsetX: 0, offsetY: 0 });
                                            setContextMenu(null);
                                        }}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        <RefreshCw size={14} /> Reset Zoom & Pan
                                    </button>

                                    <div className="h-px bg-white/5 my-1" />

                                    <button
                                        onClick={() => {
                                            updateItem(item.id, { zIndex: nextZ });
                                            setNextZ(z => z + 1);
                                            setContextMenu(null);
                                        }}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        <BringToFront size={14} /> Bring to Front
                                    </button>

                                    <button
                                        onClick={() => {
                                            deleteItem(item.id);
                                            setContextMenu(null);
                                        }}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all"
                                    >
                                        <Trash2 size={14} /> Delete Layer
                                    </button>
                                </div>
                            );
                        })()}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
