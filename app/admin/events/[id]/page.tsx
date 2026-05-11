'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronLeft, 
    Calendar, 
    Settings, 
    Image as ImageIcon, 
    Layout, 
    Globe, 
    ArrowUpRight, 
    Clock, 
    Trash2, 
    Plus,
    Download,
    Palette,
    Printer,
    X,
    Mail,
    MessageCircle,
    Phone,
    Link as LinkIcon,
    RefreshCw,
    ExternalLink,
    LayoutGrid,
    Columns,
    StretchHorizontal,
    Tally4
} from 'lucide-react';
import TemplateDesigner, { TemplateConfig } from '@/components/templates/TemplateDesigner';
import PrintDesigner from '@/components/PrintDesigner';

interface Event {
    id: string;
    name: string;
    slug: string;
    date: string;
    description: string;
    is_active: boolean;
    config: any;
    created_at: string;
}

const TemplatePreview = ({ template }: { template: TemplateConfig }) => {
    const isPortrait = template.width < template.height;
    return (
        <div 
            className="relative w-full h-full rounded-lg shadow-inner overflow-hidden border border-white/10" 
            style={{ 
                backgroundColor: template.background,
                backgroundImage: template.backgroundImage ? `url(${template.backgroundImage})` : 'none',
                backgroundSize: 'cover',
                aspectRatio: `${template.width} / ${template.height}`,
                maxWidth: '100%',
                maxHeight: '100%',
            }}
        >
            {template.slots.map((slot) => (
                <div 
                    key={slot.id}
                    className="absolute bg-neutral-200/40 border border-white/20 rounded-sm"
                    style={{
                        left: `${slot.x}%`,
                        top: `${slot.y}%`,
                        width: `${slot.width}%`,
                        height: `${slot.height}%`,
                        transform: `rotate(${slot.rotation}deg)`,
                    }}
                />
            ))}
            {template.textElements.map((txt) => (
                <div 
                    key={txt.id}
                    className="absolute text-[2px] font-bold leading-none pointer-events-none truncate text-center"
                    style={{
                        left: `${txt.x}%`,
                        top: `${txt.y}%`,
                        color: txt.color,
                        transform: `translate(-50%, -50%) rotate(${txt.rotation}deg)`,
                        fontSize: `${txt.fontSize / 15}px`,
                        opacity: txt.opacity,
                    }}
                >
                    {txt.text}
                </div>
            ))}
        </div>
    );
};

const ConfirmModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmText = "Decommission", 
    themeColor = "#171717" 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    onConfirm: () => void, 
    title: string, 
    message: string, 
    confirmText?: string, 
    themeColor?: string 
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
                    />
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-neutral-100"
                    >
                        <div className="p-10 space-y-8">
                            <div className="space-y-3">
                                <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight">{title}</h3>
                                <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest leading-relaxed">{message}</p>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button 
                                    variant="ghost" 
                                    onClick={onClose}
                                    className="flex-1 h-12 rounded-full border border-neutral-100 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-50 transition-all"
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    onClick={() => { onConfirm(); onClose(); }}
                                    className="flex-1 h-12 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg transition-all"
                                    style={{ backgroundColor: themeColor, color: '#fff' }}
                                >
                                    {confirmText}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default function EventDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'templates' | 'booth' | 'gallery' | 'gallery-config'>('overview');

    // Booth customization state
    const [boothSettings, setBoothSettings] = useState({
        welcomeMessage: '',
        countdownSeconds: 3,
        autoSnap: true,
        themeColor: '#171717',
        gesturesEnabled: true,
    });
    const [savingBooth, setSavingBooth] = useState(false);
    const [boothPhotos, setBoothPhotos] = useState<any[]>([]);

    // Gallery customization state
    const [gallerySettings, setGallerySettings] = useState({
        themeStyle: 'modern',
        layoutType: 'carousel',
        title: '',
        subtitle: '',
        handwrittenNote: 'All yours!',
        primaryColor: '#000000',
        secondaryColor: '#ffffff'
    });

    // Template CRUD state
    const [templates, setTemplates] = useState<TemplateConfig[]>([]);
    const [showEditor, setShowEditor] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<TemplateConfig | null>(null);

    // Custom Confirm State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });

    // Fullscreen Preview state
    const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

    // Download state
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    // Share state
    const [copied, setCopied] = useState(false);
    const [showShareMenu, setShowShareMenu] = useState(false);

    // Bulk actions
    const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
    const [showPrintDesigner, setShowPrintDesigner] = useState(false);
    const [isConfirmingBulkDelete, setIsConfirmingBulkDelete] = useState(false);

    useEffect(() => {
        if (params.id) {
            fetchEvent();
        }
    }, [params.id]);

    const fetchEvent = async () => {
        try {
            const [eventRes, photosRes] = await Promise.all([
                supabase
                    .from('events')
                    .select('*')
                    .eq('id', params.id as string)
                    .single(),
                supabase
                    .from('photos')
                    .select('*')
                    .eq('event_id', params.id as string)
                    .order('created_at', { ascending: false })
            ]);

            if (eventRes.error) throw eventRes.error;
            if (photosRes.error) throw photosRes.error;

            setEvent(eventRes.data);
            if (photosRes.data) setBoothPhotos(photosRes.data);

            // Sync settings
            if (eventRes.data.config?.templates) setTemplates(eventRes.data.config.templates);
            if (eventRes.data.config?.boothSettings) setBoothSettings(prev => ({ ...prev, ...eventRes.data.config.boothSettings }));
            if (eventRes.data.config?.publicPage) setGallerySettings(prev => ({ ...prev, ...eventRes.data.config.publicPage }));

        } catch (error) {
            console.error('Error fetching event data:', error);
            router.push('/admin/events');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveBoothSettings = async () => {
        if (!event) return;
        setSavingBooth(true);
        try {
            const config = { 
                ...(event.config || {}), 
                boothSettings,
                publicPage: gallerySettings 
            };
            const { error } = await supabase.from('events').update({ config }).eq('id', event.id);
            if (error) throw error;
            setEvent({ ...event, config });
        } catch (err) {
            console.error(err);
        } finally {
            setSavingBooth(false);
        }
    };

    const handleTogglePublish = async (id: string, current: boolean) => {
        try {
            const { error } = await supabase
                .from('photos')
                .update({ is_published: !current })
                .eq('id', id);
            if (error) throw error;
            setBoothPhotos(prev => prev.map(p => p.id === id ? { ...p, is_published: !current } : p));
        } catch (err) {
            console.error(err);
        }
    };
    const getContrastColor = (hex: string) => {
        if (!hex || hex.length < 7) return '#ffffff';
        try {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            return brightness > 180 ? '#171717' : '#ffffff';
        } catch (e) {
            return '#ffffff';
        }
    };

    const executePrint = (url: string) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <html>
                <head>
                    <title>SnapWrap Print</title>
                    <style>
                        @page { margin: 0; size: 4in 6in; }
                        body { 
                            margin: 0; 
                            padding: 0; 
                            display: flex; 
                            align-items: center; 
                            justify-content: center; 
                            height: 6in; 
                            width: 4in; 
                            background: white; 
                        }
                        img { 
                            max-width: 100%; 
                            max-height: 100%; 
                            object-fit: contain; 
                        }
                    </style>
                </head>
                <body onload="window.print(); setTimeout(() => window.close(), 1000);">
                    <img src="${url}" />
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleDownload = async (url: string, id: string) => {
        setDownloadingId(id);
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `snapwrap-${id}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(url, '_blank');
        } finally {
            setDownloadingId(null);
        }
    };

    const handleShareAction = (type: 'copy' | 'gmail' | 'messenger' | 'whatsapp') => {
        if (!event) return;
        const url = `${window.location.origin}/gallery/${event.slug}`;
        const text = `View the SnapWrap archive for ${event.name}: ${url}`;
        
        switch (type) {
            case 'copy':
                navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
                break;
            case 'gmail':
                window.open(`https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=&su=${encodeURIComponent(event.name + ' Archive Access')}&body=${encodeURIComponent(text)}`, '_blank');
                break;
            case 'messenger':
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
                break;
            case 'whatsapp':
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                break;
        }
    };

    const togglePhotoSelection = (id: string) => {
        setSelectedPhotos(prev => 
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
        setIsConfirmingBulkDelete(false);
    };

    const handleBulkPrint = () => {
        setShowPrintDesigner(true);
    };

    const handleBulkDelete = async () => {
        if (selectedPhotos.length === 0) return;
        
        if (!isConfirmingBulkDelete) {
            setIsConfirmingBulkDelete(true);
            return;
        }

        try {
            const { error } = await supabase
                .from('photos')
                .delete()
                .in('id', selectedPhotos);

            if (error) throw error;

            setBoothPhotos(prev => prev.filter(p => !selectedPhotos.includes(p.id)));
            setSelectedPhotos([]);
            setIsConfirmingBulkDelete(false);
        } catch (err) {
            console.error('Error deleting photos:', err);
            alert('Failed to delete photos.');
            setIsConfirmingBulkDelete(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <div className="w-6 h-6 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
                <p className="text-neutral-400 font-medium animate-pulse">Retrieving Archives...</p>
            </div>
        );
    }

    if (!event) return null;

    const tabs = [
        { id: 'overview', label: 'Overview', icon: Layout },
        { id: 'gallery', label: 'Media', icon: ImageIcon },
        { id: 'gallery-config', label: 'Gallery Config', icon: Globe },
        { id: 'templates', label: 'Templates', icon: Settings },
        { id: 'booth', label: 'Booth Config', icon: Palette },
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-32">
            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: ${boothSettings.themeColor}99;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: ${boothSettings.themeColor};
                }
            `}} />
            {/* Header: Simplified & Minimal */}
            <header className="space-y-6">
                <Link href="/admin/events" className="inline-flex items-center gap-2 text-neutral-400 hover:text-neutral-900 transition-colors group">
                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Archive View</span>
                </Link>
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <h1 className="text-5xl font-black tracking-tight text-neutral-900">{event.name}</h1>
                            <div 
                                className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.2em] transition-colors"
                                style={{ 
                                    backgroundColor: event.is_active ? boothSettings.themeColor : '#f5f5f5',
                                    color: event.is_active ? getContrastColor(boothSettings.themeColor) : '#a3a3a3'
                                }}
                            >
                                {event.is_active ? 'Live' : 'Locked'}
                            </div>
                        </div>
                        <div className="flex items-center gap-8 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                            <div className="flex items-center gap-2 border-r border-neutral-200 pr-8">
                                <Calendar size={12} className="text-neutral-300" />
                                {new Date(event.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock size={12} className="text-neutral-300" />
                                Ref: {event.slug}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link href={`/e/${event.slug}`} target="_blank">
                            <Button variant="ghost" className="rounded-full px-8 h-12 font-black text-[10px] uppercase tracking-widest border-2 border-neutral-100 hover:border-neutral-900 transition-all">
                                Launch Booth <ArrowUpRight size={14} className="ml-2" />
                            </Button>
                        </Link>
                        <AnimatePresence>
                            {activeTab === 'gallery' && (
                                <motion.div
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                >
                                    <Button 
                                        variant="ghost"
                                        onClick={() => setShowShareMenu(true)}
                                        className="rounded-full px-8 h-12 font-black text-[10px] uppercase tracking-widest shadow-xl transition-all"
                                        style={{ 
                                            backgroundColor: boothSettings.themeColor,
                                            color: getContrastColor(boothSettings.themeColor),
                                            boxShadow: `0 10px 20px -10px ${boothSettings.themeColor}40`
                                        }}
                                    >
                                        Share Access
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header>

            {/* Sub-Navigation: Minimal Underline Style */}
            <nav className="flex gap-10 border-b border-neutral-100">
                {(tabs as any).map((tab: any) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`pb-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
                            activeTab === tab.id ? 'text-neutral-900' : 'text-neutral-300 hover:text-neutral-500'
                        }`}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <motion.div 
                                layoutId="tab-underline" 
                                className="absolute bottom-0 left-0 right-0 h-0.5" 
                                style={{ backgroundColor: boothSettings.themeColor }}
                            />
                        )}
                    </button>
                ))}
            </nav>

            {/* Content Area */}
            <main className="min-h-[400px]">
                <AnimatePresence mode="wait">
                    {activeTab === 'overview' && (
                        <motion.div 
                            key="overview"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-8"
                        >
                            <Card className="p-10 border-neutral-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                                <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-10">Total Captures</h3>
                                <div className="text-6xl font-black text-neutral-900 mb-2 tabular-nums">{boothPhotos.length}</div>
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase" style={{ color: boothSettings.themeColor }}>
                                    <ArrowUpRight size={12} /> Active Syncing
                                </div>
                            </Card>
                            
                            <Card className="p-10 border-neutral-100 bg-white shadow-sm">
                                <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-10">Visual Configs</h3>
                                <div className="text-6xl font-black text-neutral-900 mb-2 tabular-nums">{templates.length}</div>
                                <p className="text-[10px] font-bold text-neutral-400 uppercase">Registered Layouts</p>
                            </Card>

                            <Card className="p-10 border-neutral-100 bg-white shadow-sm">
                                <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-10">Sync Status</h3>
                                <div className="flex items-center gap-4">
                                    <div className={`w-4 h-4 rounded-full ${event.is_active ? 'bg-neutral-900 animate-pulse' : 'bg-neutral-200'}`} />
                                    <span className="text-4xl font-black text-neutral-900 uppercase tracking-tight">
                                        {event.is_active ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                                <p className="text-[10px] font-bold text-neutral-400 uppercase mt-4">Database Persistence</p>
                            </Card>
                        </motion.div>
                    )}

                    {activeTab === 'gallery' && (
                        <motion.div 
                            key="gallery"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-10"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <h2 className="text-[10px] font-black text-neutral-900 uppercase tracking-[0.2em]">Archived Media</h2>
                                    <button 
                                        onClick={() => {
                                            setIsRefreshing(true);
                                            fetchEvent().finally(() => setIsRefreshing(false));
                                        }}
                                        disabled={isRefreshing}
                                        className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-neutral-200 hover:border-neutral-900 transition-all text-neutral-400 hover:text-neutral-900 disabled:opacity-50 group"
                                        title="Refresh Gallery"
                                    >
                                        <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
                                        <span className="text-[9px] font-black uppercase tracking-widest">Reload Gallery</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{boothPhotos.length} Units</span>
                                    <div className="h-4 w-px bg-neutral-200" />
                                    <Link 
                                        href={`/e/${event.slug}/gallery`} 
                                        target="_blank"
                                        className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 transition-all shadow-lg hover:shadow-xl active:scale-95"
                                    >
                                        <ExternalLink size={12} />
                                        <span className="text-[9px] font-black uppercase tracking-widest">View Public Gallery</span>
                                    </Link>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                {boothPhotos.map((photo, i) => (
                                    <motion.div 
                                        key={photo.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: Math.min(i * 0.05, 0.3) }}
                                        whileHover={{ 
                                            y: -5,
                                            boxShadow: `0 20px 40px -10px ${boothSettings.themeColor}33`,
                                            borderColor: boothSettings.themeColor
                                        }}
                                        className="group relative aspect-[3/4.5] bg-neutral-50 rounded-lg overflow-hidden border border-neutral-100 transition-all duration-500"
                                    >
                                        {/* Selection Indicator */}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); togglePhotoSelection(photo.id); }}
                                            className="absolute top-4 left-4 z-20 w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center"
                                            style={{ 
                                                backgroundColor: selectedPhotos.includes(photo.id) ? boothSettings.themeColor : 'rgba(255,255,255,0.1)',
                                                borderColor: selectedPhotos.includes(photo.id) ? boothSettings.themeColor : 'rgba(255,255,255,0.5)',
                                            }}
                                        >
                                            {selectedPhotos.includes(photo.id) && <div className="w-2 h-2 bg-white rounded-full" />}
                                        </button>

                                        <div 
                                            className={`relative w-full h-full transition-opacity duration-500 ${!photo.is_published ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'} ${selectedPhotos.includes(photo.id) ? 'scale-90 opacity-60' : ''}`}
                                        >
                                            <Image
                                                src={photo.final_url || photo.image_url}
                                                alt="Archived Capture"
                                                fill
                                                className="object-cover transition-transform duration-700 group-hover:scale-105"
                                                sizes="(max-width: 768px) 50vw, 20vw"
                                                quality={60}
                                                loading="lazy"
                                            />
                                        </div>
                                        
                                        {/* Minimal Hover Controls */}
                                        <div 
                                            className="absolute inset-0 bg-neutral-900/60 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[2px] flex flex-col justify-between p-4 cursor-zoom-in"
                                            onClick={() => setPreviewPhoto(photo.final_url || photo.image_url)}
                                            title="Click to preview"
                                        >
                                            <div className="flex justify-end">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleTogglePublish(photo.id, photo.is_published); }}
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                                        photo.is_published 
                                                        ? 'bg-white/10 hover:bg-red-500 text-white' 
                                                        : 'bg-white/10 hover:bg-white text-neutral-900'
                                                    }`}
                                                    title={photo.is_published ? 'Unpublish' : 'Publish'}
                                                >
                                                    {photo.is_published ? <X size={14} /> : <Plus size={14} />}
                                                </button>
                                            </div>
                                            
                                            <div className="space-y-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                                <div className="flex gap-2">
                                                {/* Removed single print button as per user request */}
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDownload(photo.final_url || photo.image_url, photo.id); }}
                                                    disabled={downloadingId === photo.id}
                                                    className="w-full bg-white text-neutral-900 py-3 rounded-md text-[8px] font-black uppercase tracking-[0.1em] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                                    title="Download"
                                                >
                                                    {downloadingId === photo.id ? (
                                                        <div className="w-3 h-3 border border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
                                                    ) : (
                                                        <Download size={12} />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'booth' && (
                        <motion.div 
                            key="booth"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="max-w-2xl mx-auto"
                        >
                            <Card className="p-12 border-neutral-100 bg-white space-y-12 shadow-sm">
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight">Public Terminal Config</h3>
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Adjust the public booth behavior and aesthetic</p>
                                </div>

                                <div className="space-y-12">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-neutral-900 uppercase tracking-[0.2em]">Welcome Message</label>
                                        <input
                                            type="text"
                                            value={boothSettings.welcomeMessage}
                                            onChange={(e) => setBoothSettings({ ...boothSettings, welcomeMessage: e.target.value })}
                                            className="w-full bg-neutral-50 border border-neutral-100 rounded-lg px-6 py-5 text-sm focus:outline-none focus:border-neutral-900 transition-all font-medium"
                                            placeholder="ARCHIVE_WELCOME_SEQ"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-10">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-neutral-900 uppercase tracking-[0.2em]">Countdown Delay</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[3, 5, 7].map(s => (
                                                    <button 
                                                        key={s}
                                                        onClick={() => setBoothSettings({ ...boothSettings, countdownSeconds: s })}
                                                        className="py-3 rounded text-[10px] font-black transition-all border"
                                                        style={{ 
                                                            backgroundColor: boothSettings.countdownSeconds === s ? boothSettings.themeColor : '#fff',
                                                            color: boothSettings.countdownSeconds === s ? '#fff' : '#a3a3a3',
                                                            borderColor: boothSettings.countdownSeconds === s ? boothSettings.themeColor : '#f5f5f5'
                                                        }}
                                                    >
                                                        {s}S
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-neutral-900 uppercase tracking-[0.2em]">Branding Tint</label>
                                            <div className="flex items-center gap-4 p-1 bg-neutral-50 rounded-lg border border-neutral-100">
                                                <input
                                                    type="color"
                                                    value={boothSettings.themeColor}
                                                    onChange={(e) => setBoothSettings({ ...boothSettings, themeColor: e.target.value })}
                                                    className="w-10 h-10 rounded-md cursor-pointer border-0 bg-transparent"
                                                />
                                                <span className="text-[10px] font-mono font-black text-neutral-900 uppercase">{boothSettings.themeColor}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-10 border-t border-neutral-100 flex justify-end">
                                        <Button 
                                            variant="ghost"
                                            onClick={handleSaveBoothSettings} 
                                            disabled={savingBooth}
                                            className="px-12 h-14 font-black uppercase tracking-[0.2em] text-[10px] rounded-full shadow-lg transition-all"
                                            style={{ 
                                                backgroundColor: boothSettings.themeColor,
                                                color: getContrastColor(boothSettings.themeColor),
                                                boxShadow: `0 10px 20px -10px ${boothSettings.themeColor}40`
                                            }}
                                        >
                                            {savingBooth ? 'Syncing...' : 'Update Protocol'}
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    )}

                    {activeTab === 'gallery-config' && (
                        <motion.div 
                            key="gallery-config"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="max-w-2xl mx-auto"
                        >
                            <Card className="p-12 border-neutral-100 bg-white space-y-12 shadow-sm">
                                <div className="space-y-2">
                                    <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight">Gallery Aesthetic Protocol</h3>
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Customize the official guest-facing archive</p>
                                </div>

                                <div className="space-y-12">
                                    <div className="space-y-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-neutral-900 uppercase tracking-[0.2em]">Visual Theme</label>
                                            <div className="grid grid-cols-2 gap-4">
                                                {['modern', 'valentine', 'minimal', 'dark', 'retro', 'editorial', 'neon', 'organic', 'serenity', 'industrial', 'vibrant'].map(t => (
                                                    <button 
                                                        key={t}
                                                        onClick={() => setGallerySettings({ ...gallerySettings, themeStyle: t })}
                                                        className={`p-4 rounded-xl border-2 transition-all text-left group ${
                                                            gallerySettings.themeStyle === t 
                                                            ? 'border-neutral-900 bg-neutral-900 text-white shadow-xl scale-[1.02]' 
                                                            : 'border-neutral-100 hover:border-neutral-200 bg-neutral-50/50'
                                                        }`}
                                                    >
                                                        <p className="text-[10px] font-black uppercase tracking-widest mb-1">{t}</p>
                                                        <div className={`h-1 w-8 rounded-full ${t === 'dark' || gallerySettings.themeStyle === t ? 'bg-white/20' : 'bg-neutral-200'}`} />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-neutral-900 uppercase tracking-[0.2em]">Gallery Architecture</label>
                                            <div className="grid grid-cols-4 gap-4">
                                                {[
                                                    { id: 'carousel', label: 'Carousel', icon: StretchHorizontal },
                                                    { id: 'grid', label: 'Modern Grid', icon: LayoutGrid },
                                                    { id: 'sidebar', label: 'Sidebar Split', icon: Columns },
                                                    { id: 'mosaic', label: 'Mosaic Flow', icon: Tally4 }
                                                ].map(l => (
                                                    <button 
                                                        key={l.id}
                                                        onClick={() => setGallerySettings({ ...gallerySettings, layoutType: l.id })}
                                                        className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all group ${
                                                            gallerySettings.layoutType === l.id 
                                                            ? 'border-neutral-900 bg-neutral-900 text-white shadow-xl' 
                                                            : 'border-neutral-100 hover:border-neutral-200 bg-neutral-50/50'
                                                        }`}
                                                    >
                                                        <l.icon size={18} />
                                                        <span className="text-[8px] font-black uppercase tracking-widest">{l.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-neutral-900 uppercase tracking-[0.2em]">Color Strategy</label>
                                            <div className="grid grid-cols-2 gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                                                <div className="space-y-2">
                                                    <label className="text-[8px] font-bold text-neutral-400 uppercase">Primary Color</label>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="color"
                                                            value={gallerySettings.primaryColor}
                                                            onChange={(e) => setGallerySettings({ ...gallerySettings, primaryColor: e.target.value })}
                                                            className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                                                        />
                                                        <span className="text-[10px] font-mono font-black text-neutral-900 uppercase">{gallerySettings.primaryColor}</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[8px] font-bold text-neutral-400 uppercase">Secondary Color</label>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="color"
                                                            value={gallerySettings.secondaryColor}
                                                            onChange={(e) => setGallerySettings({ ...gallerySettings, secondaryColor: e.target.value })}
                                                            className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                                                        />
                                                        <span className="text-[10px] font-mono font-black text-neutral-900 uppercase">{gallerySettings.secondaryColor}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-neutral-900 uppercase tracking-[0.2em]">Headline Title</label>
                                            <input
                                                type="text"
                                                value={gallerySettings.title}
                                                onChange={(e) => setGallerySettings({ ...gallerySettings, title: e.target.value })}
                                                className="w-full bg-neutral-50 border border-neutral-100 rounded-lg px-6 py-5 text-sm focus:outline-none focus:border-neutral-900 transition-all font-medium"
                                                placeholder={event.name}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-neutral-900 uppercase tracking-[0.2em]">Subtext Description</label>
                                            <textarea
                                                value={gallerySettings.subtitle}
                                                onChange={(e) => setGallerySettings({ ...gallerySettings, subtitle: e.target.value })}
                                                className="w-full bg-neutral-50 border border-neutral-100 rounded-lg px-6 py-5 text-sm focus:outline-none focus:border-neutral-900 transition-all font-medium h-32"
                                                placeholder="Capturing moments, creating memories."
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-neutral-900 uppercase tracking-[0.2em]">Handwritten Note</label>
                                            <input
                                                type="text"
                                                value={gallerySettings.handwrittenNote}
                                                onChange={(e) => setGallerySettings({ ...gallerySettings, handwrittenNote: e.target.value })}
                                                className="w-full bg-neutral-50 border border-neutral-100 rounded-lg px-6 py-5 text-sm focus:outline-none focus:border-neutral-900 transition-all font-medium"
                                                placeholder="All yours!"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-10 border-t border-neutral-100 flex justify-end">
                                        <Button 
                                            variant="ghost"
                                            onClick={handleSaveBoothSettings} 
                                            disabled={savingBooth}
                                            className="px-12 h-14 font-black uppercase tracking-[0.2em] text-[10px] rounded-full shadow-lg transition-all"
                                            style={{ 
                                                backgroundColor: boothSettings.themeColor,
                                                color: getContrastColor(boothSettings.themeColor),
                                                boxShadow: `0 10px 20px -10px ${boothSettings.themeColor}40`
                                            }}
                                        >
                                            {savingBooth ? 'Syncing...' : 'Update Protocol'}
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    )}
                    {activeTab === 'templates' && (
                        <motion.div 
                            key="templates"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-10"
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="text-[10px] font-black text-neutral-900 uppercase tracking-[0.2em]">Registered Layouts</h2>
                                <button 
                                    onClick={() => { setEditingTemplate(null); setShowEditor(true); }} 
                                    className="group relative h-11 flex items-center gap-4 pl-5 pr-7 bg-neutral-900 rounded-full overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl"
                                >
                                    {/* Animated Background Overlay */}
                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
                                        style={{ background: `linear-gradient(45deg, ${boothSettings.themeColor}44, transparent)` }} 
                                    />
                                    
                                    <div className="relative z-10 w-5 h-5 rounded-full bg-white flex items-center justify-center text-neutral-900 group-hover:rotate-90 transition-transform duration-500">
                                        <Plus size={12} />
                                    </div>
                                    <span className="relative z-10 text-[9px] font-black text-white uppercase tracking-[0.2em]">Add New Template</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
                                {templates.map((tpl) => {
                                    const isPortrait = tpl.width < tpl.height;
                                    const orientationLabel = tpl.width === tpl.height ? 'Square' : isPortrait ? 'Portrait' : 'Landscape';
                                    
                                    return (
                                        <Card key={tpl.id} className="group relative overflow-hidden border-neutral-100 bg-white hover:border-neutral-900 transition-all duration-700 shadow-sm hover:shadow-2xl">
                                            <div className="aspect-[3/4] bg-neutral-50 flex items-center justify-center p-8 transition-all duration-700 group-hover:bg-neutral-100 relative overflow-hidden">
                                                {/* Subtle Background Pattern */}
                                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                                                
                                                <div className="w-full h-full flex items-center justify-center p-4">
                                                    <TemplatePreview template={tpl} />
                                                </div>

                                                <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                                                    <div className="px-2 py-1 bg-neutral-900 text-white text-[7px] font-black uppercase tracking-widest rounded shadow-xl">
                                                        {orientationLabel}
                                                    </div>
                                                    <div className="px-2 py-1 bg-white border border-neutral-200 text-neutral-900 text-[7px] font-black uppercase tracking-widest rounded shadow-xl">
                                                        {tpl.width}×{tpl.height}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-6 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-1">
                                                        <h4 className="text-[10px] font-black text-neutral-900 uppercase tracking-widest">{tpl.name}</h4>
                                                        <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-tighter">
                                                            {tpl.slots.length} Photo Slots • {tpl.layout.rows}x{tpl.layout.cols} Matrix
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button 
                                                            onClick={() => { setEditingTemplate(tpl); setShowEditor(true); }} 
                                                            className="p-2.5 bg-neutral-50 hover:bg-neutral-900 hover:text-white rounded-full transition-all duration-300"
                                                        >
                                                            <Settings size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => { 
                                                                setConfirmModal({
                                                                    isOpen: true,
                                                                    title: 'Decommission Layout',
                                                                    message: `Are you sure you want to permanently remove "${tpl.name}"? This action cannot be reversed.`,
                                                                    onConfirm: async () => {
                                                                        const updated = templates.filter(t => t.id !== tpl.id);
                                                                        setTemplates(updated);
                                                                        const config = { ...(event.config || {}), templates: updated };
                                                                        await supabase.from('events').update({ config }).eq('id', event.id);
                                                                        setEvent({ ...event, config });
                                                                    }
                                                                });
                                                            }}
                                                            className="p-2.5 bg-neutral-50 hover:bg-red-500 hover:text-white rounded-full transition-all duration-300"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Template Editor Fullscreen Overlay */}
            <AnimatePresence>
                {showEditor && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-white overflow-y-auto"
                    >
                        <div className="max-w-7xl mx-auto p-8 md:p-16 space-y-16">
                            <div className="flex justify-between items-center border-b border-neutral-100 pb-12">
                                <div className="space-y-2">
                                    <h2 className="text-4xl font-black uppercase tracking-tight">Design Protocol</h2>
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em]">Configuring visual output for automated capture</p>
                                </div>
                                <button 
                                    onClick={() => setShowEditor(false)} 
                                    className="px-8 h-12 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform text-white"
                                    style={{ 
                                        backgroundColor: boothSettings.themeColor,
                                        color: getContrastColor(boothSettings.themeColor)
                                    }}
                                >
                                    Close Designer
                                </button>
                            </div>
                            <TemplateDesigner 
                                initialTemplate={editingTemplate}
                                onClose={() => setShowEditor(false)}
                                onSave={(tpl) => {
                                    let updated: TemplateConfig[];
                                    const existingIndex = templates.findIndex(t => t.id === tpl.id);
                                    if (existingIndex >= 0) {
                                        updated = templates.map(t => t.id === tpl.id ? tpl : t);
                                    } else {
                                        updated = [...templates, tpl];
                                    }
                                    setTemplates(updated);
                                    const config = { ...(event.config || {}), templates: updated };
                                    supabase.from('events').update({ config }).eq('id', event.id).then(() => {
                                        setEvent({ ...event, config });
                                    });
                                    setShowEditor(false);
                                }}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Image Fullscreen Preview (Lightbox) */}
            <AnimatePresence>
                {previewPhoto && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setPreviewPhoto(null)}
                        className="fixed inset-0 z-[200] bg-neutral-900/95 backdrop-blur-xl flex items-center justify-center p-8 md:p-20 cursor-zoom-out"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full h-full max-w-5xl flex flex-col items-center justify-center gap-6"
                        >
                            <div className="relative w-full flex-1">
                                <Image
                                    src={previewPhoto}
                                    alt="Fullscreen Preview"
                                    fill
                                    className="object-contain"
                                    quality={100}
                                    unoptimized
                                    priority
                                />
                            </div>
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => executePrint(previewPhoto)}
                                    className="bg-white/10 hover:bg-white text-white hover:text-neutral-900 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-md flex items-center gap-2"
                                >
                                    <Printer size={14} /> Print Photo
                                </button>
                                <button 
                                    onClick={() => handleDownload(previewPhoto, 'preview')}
                                    disabled={downloadingId === 'preview'}
                                    className="bg-white/10 hover:bg-white text-white hover:text-neutral-900 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-md flex items-center gap-2 disabled:opacity-50"
                                >
                                    {downloadingId === 'preview' ? (
                                        <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Download size={14} />
                                    )}
                                    {downloadingId === 'preview' ? 'Downloading...' : 'Download Original'}
                                </button>
                                <button 
                                    onClick={() => setPreviewPhoto(null)}
                                    className="bg-white text-neutral-900 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                        <button 
                            className="absolute top-10 right-10 text-white/40 hover:text-white transition-colors"
                            onClick={() => setPreviewPhoto(null)}
                        >
                            <Plus size={40} className="rotate-45" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Bulk Actions Bar */}
            <AnimatePresence>
                {selectedPhotos.length > 0 && (
                    <motion.div 
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[250] bg-white border border-neutral-200 rounded-2xl shadow-2xl p-6 flex items-center gap-10"
                    >
                        <div className="flex flex-col gap-1 pr-10 border-r border-neutral-100">
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Active Batch</span>
                            <span className="text-xl font-black text-neutral-900">{selectedPhotos.length} Items</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setSelectedPhotos([])}
                                className="px-6 py-3 text-[10px] font-black text-neutral-400 uppercase tracking-widest hover:text-neutral-900 transition-colors"
                            >
                                Clear
                            </button>
                            <Button 
                                variant="ghost"
                                onClick={handleBulkPrint}
                                className="px-8 h-14 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all"
                                style={{ 
                                    backgroundColor: boothSettings.themeColor,
                                    color: getContrastColor(boothSettings.themeColor),
                                    boxShadow: `0 10px 30px -10px ${boothSettings.themeColor}66`
                                }}
                            >
                                <Printer size={16} className="mr-2" /> Print Batch
                            </Button>
                            <button 
                                onClick={handleBulkDelete}
                                onMouseLeave={() => setIsConfirmingBulkDelete(false)}
                                className={`px-6 h-11 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg ${
                                    isConfirmingBulkDelete 
                                    ? 'bg-red-600 text-white scale-105 shadow-red-500/40 ring-4 ring-red-500/20' 
                                    : 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white'
                                }`}
                            >
                                <Trash2 size={14} />
                                {isConfirmingBulkDelete ? 'Confirm Permanent Delete?' : 'Delete Selection'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Share Menu Modal */}
            <AnimatePresence>
                {showShareMenu && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowShareMenu(false)}
                        className="fixed inset-0 z-[300] bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-6"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl p-10 max-w-sm w-full shadow-2xl space-y-10"
                        >
                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight">Distribution Protocol</h3>
                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em]">Select an export channel for archive access</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { id: 'copy', label: 'Clipboard', icon: LinkIcon, color: '#171717' },
                                    { id: 'gmail', label: 'Gmail', icon: Mail, color: '#EA4335' },
                                    { id: 'messenger', label: 'Messenger', icon: MessageCircle, color: '#0084FF' },
                                    { id: 'whatsapp', label: 'WhatsApp', icon: Phone, color: '#25D366' },
                                ].map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => { handleShareAction(option.id as any); if(option.id !== 'copy') setShowShareMenu(false); }}
                                        className="flex flex-col items-center justify-center gap-4 p-6 rounded-2xl bg-neutral-50 hover:bg-neutral-100 transition-all border border-neutral-100 group"
                                    >
                                        <option.icon size={24} style={{ color: option.id === 'copy' ? boothSettings.themeColor : option.color }} className="transition-transform group-hover:scale-110" />
                                        <span className="text-[10px] font-black text-neutral-900 uppercase tracking-widest">{option.id === 'copy' && copied ? 'Copied!' : option.label}</span>
                                    </button>
                                ))}
                            </div>

                            <button 
                                onClick={() => setShowShareMenu(false)}
                                className="w-full py-4 text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em] hover:text-neutral-900 transition-colors"
                            >
                                Cancel
                            </button>
                        </motion.div>
                    </motion.div>
                )}
                {showPrintDesigner && (
                    <PrintDesigner 
                        selectedPhotos={boothPhotos.filter(p => selectedPhotos.includes(p.id)).map(p => ({
                            id: p.id,
                            url: p.final_url || p.image_url
                        }))}
                        allPhotos={boothPhotos.map(p => ({
                            id: p.id,
                            url: p.final_url || p.image_url
                        }))}
                        templates={templates.map(t => ({
                            id: t.id,
                            name: t.name,
                            preview: t.backgroundImage || '',
                            layout: t.layout,
                            gap: t.gap,
                            padding: t.padding,
                            background: t.background
                        }))}
                        onClose={() => setShowPrintDesigner(false)}
                        themeColor={boothSettings.themeColor}
                    />
                )}
            </AnimatePresence>

            <ConfirmModal 
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                themeColor={boothSettings.themeColor}
            />
        </div>
    );
}
