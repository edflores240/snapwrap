'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import TemplateDesigner, { TemplateConfig, PRESET_TEMPLATES } from '@/components/templates/TemplateDesigner';
import TemplatePreview from '@/components/templates/TemplatePreview';

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

export default function EventDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'templates' | 'booth' | 'gallery' | 'public-page'>('overview');

    // Booth customization state
    const [boothSettings, setBoothSettings] = useState({
        welcomeMessage: '',
        countdownSeconds: 3,
        autoSnap: true,
        themeColor: '#6366f1',
    });
    const [savingBooth, setSavingBooth] = useState(false);
    const [boothPhotos, setBoothPhotos] = useState<any[]>([]);

    // Public Page state
    const [publicPageSettings, setPublicPageSettings] = useState({
        title: '',
        subtitle: '',
        themeColor: '',
        themeStyle: 'modern',
    });
    const [savingPublicPage, setSavingPublicPage] = useState(false);

    // Template CRUD state
    const [templates, setTemplates] = useState<TemplateConfig[]>([]);
    const [showEditor, setShowEditor] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<TemplateConfig | null>(null);

    // Gallery management state
    const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const handleToggleSelect = (id: string) => {
        setSelectedPhotos(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleDeleteSelected = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedPhotos.length} photos? This cannot be undone.`)) return;

        setActionLoading(true);
        try {
            // Get URLs for storage deletion
            const photosToDelete = boothPhotos.filter(p => selectedPhotos.includes(p.id));
            const storagePaths = photosToDelete
                .map(p => {
                    const url = p.final_url || p.image_url;
                    if (!url) return null;
                    const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
                    return match ? { bucket: match[1], path: match[2] } : null;
                })
                .filter(Boolean) as { bucket: string, path: string }[];

            // Group by bucket for efficient deletion
            const buckets = [...new Set(storagePaths.map(p => p.bucket))];
            for (const bucket of buckets) {
                const paths = storagePaths.filter(p => p.bucket === bucket).map(p => p.path);
                if (paths.length > 0) {
                    await supabase.storage.from(bucket).remove(paths);
                }
            }

            // Delete from DB
            const { error } = await supabase
                .from('photos')
                .delete()
                .in('id', selectedPhotos);

            if (error) throw error;

            // Update UI
            setBoothPhotos(prev => prev.filter(p => !selectedPhotos.includes(p.id)));
            setSelectedPhotos([]);
            setIsSelectionMode(false);
        } catch (error) {
            console.error('Error deleting photos:', error);
            alert('Failed to delete some photos');
        } finally {
            setActionLoading(false);
        }
    };

    const handleTogglePublish = async (publish: boolean) => {
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('photos')
                .update({ is_published: publish })
                .in('id', selectedPhotos);

            if (error) throw error;

            // Update UI
            setBoothPhotos(prev => prev.map(p =>
                selectedPhotos.includes(p.id) ? { ...p, is_published: publish } : p
            ));
            setSelectedPhotos([]);
            setIsSelectionMode(false);
        } catch (error) {
            console.error('Error updating photos:', error);
            alert('Failed to update photos');
        } finally {
            setActionLoading(false);
        }
    };

    useEffect(() => {
        if (params.id) {
            fetchEvent();
        }
    }, [params.id]);

    const fetchEvent = async () => {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('id', params.id as string)
                .single();

            if (error) throw error;
            setEvent(data);

            // Load templates from config (DB first, then localStorage fallback)
            if (data.config?.templates && data.config.templates.length > 0) {
                setTemplates(data.config.templates);
            } else {
                const stored = localStorage.getItem(`templates_${params.id}`);
                if (stored) {
                    try { setTemplates(JSON.parse(stored)); } catch { }
                }
            }

            // Load booth settings from config
            if (data.config?.boothSettings) {
                setBoothSettings((prev: any) => ({ ...prev, ...data.config.boothSettings }));
            }

            // Load public page settings
            if (data.config?.publicPage) {
                setPublicPageSettings(data.config.publicPage);
            } else {
                // Default defaults
                setPublicPageSettings({
                    title: data.name || 'Event Gallery',
                    subtitle: new Date(data.date).toLocaleDateString(),
                    themeColor: data.config.boothSettings?.themeColor || '#6366f1',
                    themeStyle: data.config.publicPage?.themeStyle || 'modern',
                });
            }

            // Load booth photos
            const { data: photos } = await supabase
                .from('photos')
                .select('*')
                .eq('event_id', data.id)
                .order('created_at', { ascending: false });
            if (photos) setBoothPhotos(photos);
        } catch (error) {
            console.error('Error fetching event:', error);
            router.push('/admin/events');
        } finally {
            setLoading(false);
        }
    };

    // ── Template CRUD ────────────────────────────────────────────────────

    const saveTemplatesToDb = async (newTemplates: TemplateConfig[]) => {
        if (!event) return;

        // Always save to localStorage as reliable fallback
        localStorage.setItem(`templates_${event.id}`, JSON.stringify(newTemplates));

        try {
            const config = { ...(event.config || {}), templates: newTemplates };
            const { error, status, statusText } = await supabase
                .from('events')
                .update({ config })
                .eq('id', event.id);

            if (error) {
                console.warn(`Supabase save failed (${status} ${statusText}):`, error.message || error.code || error);
                console.warn('Templates saved to localStorage as fallback.');
            } else {
                setEvent({ ...event, config });
            }
        } catch (error: any) {
            console.warn('DB save error (using localStorage):', error?.message || error);
        }
    };

    const handleSaveTemplate = (tpl: TemplateConfig) => {
        let updated: TemplateConfig[];
        const existingIndex = templates.findIndex(t => t.id === tpl.id);

        if (existingIndex >= 0) {
            updated = templates.map(t => t.id === tpl.id ? tpl : t);
        } else {
            updated = [...templates, tpl];
        }

        setTemplates(updated);
        saveTemplatesToDb(updated);
        setShowEditor(false);
        setEditingTemplate(null);
    };

    const handleDeleteTemplate = (id: string) => {
        if (!confirm('Delete this template?')) return;
        const updated = templates.filter(t => t.id !== id);
        setTemplates(updated);
        saveTemplatesToDb(updated);
    };

    const handleEditTemplate = (tpl: TemplateConfig) => {
        setEditingTemplate(tpl);
        setShowEditor(true);
    };

    const handleAddTemplate = () => {
        setEditingTemplate(null);
        setShowEditor(true);
    };

    const handleSaveBoothSettings = async () => {
        if (!event) return;
        setSavingBooth(true);
        try {
            const config = event.config || {};
            config.boothSettings = boothSettings;
            await supabase
                .from('events')
                .update({ config })
                .eq('id', event.id);
            setEvent({ ...event, config });
            localStorage.setItem(`booth_settings_${event.id}`, JSON.stringify(boothSettings));
        } catch (err) {
            console.error('Error saving booth settings:', err);
        } finally {
            setSavingBooth(false);
        }
    };

    const handleSavePublicPage = async () => {
        if (!event) return;
        setSavingPublicPage(true);
        try {
            const config = event.config || {};
            config.publicPage = publicPageSettings;
            await supabase
                .from('events')
                .update({ config })
                .eq('id', event.id);
            setEvent({ ...event, config });
            alert('Public page settings saved!');
        } catch (err) {
            console.error('Error saving public page settings:', err);
            alert('Failed to save settings');
        } finally {
            setSavingPublicPage(false);
        }
    };

    // ── Render ───────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-gray-600">Loading event...</div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-gray-600">Event not found</div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link href="/admin/events">
                            <Button variant="ghost" className="px-2 text-gray-700 hover:text-gray-900">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                                </svg>
                            </Button>
                        </Link>
                        <h1 className="text-4xl font-bold text-gray-900">{event.name}</h1>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 ml-11">
                        <span>📅 {new Date(event.date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="font-mono text-indigo-600">/{event.slug}</span>
                        <span>•</span>
                        <span className={event.is_active ? 'text-green-600 font-medium' : 'text-gray-500'}>
                            {event.is_active ? '● Active' : '○ Archived'}
                        </span>
                    </div>
                </div>
                <div className="flex gap-3">
                    {event.slug ? (
                        <>
                            <Link href={`/e/${event.slug}/gallery`} target="_blank">
                                <Button variant="secondary">View Gallery</Button>
                            </Link>
                            <Link href={`/e/${event.slug}`} target="_blank">
                                <Button variant="secondary">Preview Booth</Button>
                            </Link>
                        </>
                    ) : (
                        <div className="flex gap-3">
                            <Button variant="secondary" disabled>View Gallery</Button>
                            <Button variant="secondary" disabled title="Event needs a slug to preview">
                                Preview Booth
                            </Button>
                        </div>
                    )}
                    <Button variant="primary">Share Link</Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-6 border-b border-gray-200">
                {([
                    { key: 'overview' as const, label: 'Overview' },
                    { key: 'templates' as const, label: 'Templates' },
                    { key: 'booth' as const, label: 'Booth' },
                    { key: 'gallery' as const, label: 'Gallery' },
                    { key: 'public-page' as const, label: 'Public Page' },
                ]).map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`pb-3 px-1 font-medium transition-colors relative ${activeTab === tab.key
                            ? 'text-indigo-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {tab.label}
                        {tab.key === 'templates' && templates.length > 0 && (
                            <span className="ml-2 bg-indigo-100 text-indigo-600 text-xs px-2 py-0.5 rounded-full font-semibold">
                                {templates.length}
                            </span>
                        )}
                        {activeTab === tab.key && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-start to-primary-end" />
                        )}
                    </button>
                ))}
            </div>

            {/* ── Tab Content ─────────────────────────────────────────────── */}

            {/* Overview */}
            {
                activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="p-6 border-l-4 border-indigo-500">
                            <div className="text-sm text-gray-600 mb-1 font-medium">Total Photos</div>
                            <div className="text-3xl font-bold text-gray-900">0</div>
                        </Card>
                        <Card className="p-6 border-l-4 border-purple-500">
                            <div className="text-sm text-gray-600 mb-1 font-medium">Templates</div>
                            <div className="text-3xl font-bold text-gray-900">{templates.length}</div>
                        </Card>
                        <Card className="p-6 border-l-4 border-teal-500">
                            <div className="text-sm text-gray-600 mb-1 font-medium">Status</div>
                            <div className="text-3xl font-bold text-gray-900">{event.is_active ? 'Live' : 'Off'}</div>
                        </Card>
                    </div>
                )
            }

            {/* Templates */}
            {
                activeTab === 'templates' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Photo Templates</h2>
                                <p className="text-sm text-gray-600">Manage layouts that guests can choose from in the booth</p>
                            </div>
                            <Button variant="primary" onClick={handleAddTemplate}>
                                + Add Template
                            </Button>
                        </div>

                        {templates.length === 0 ? (
                            <Card className="p-12">
                                <div className="text-center">
                                    <div className="text-6xl mb-4">🎨</div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">No templates yet</h3>
                                    <p className="text-gray-600 mb-6 max-w-sm mx-auto">
                                        Create your first template to define how photos will look in the booth.
                                        You can start from a preset or build from scratch.
                                    </p>
                                    <Button variant="primary" onClick={handleAddTemplate}>
                                        Create First Template
                                    </Button>
                                </div>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {templates.map((tpl) => (
                                    <Card key={tpl.id} className="overflow-hidden group hover:shadow-lg transition-all">
                                        {/* Visual preview */}
                                        <div className="flex items-center justify-center p-4 bg-gray-50 min-h-[200px]">
                                            <TemplatePreview template={tpl} width={180} />
                                        </div>

                                        {/* Card body */}
                                        <div className="p-4 border-t border-gray-100">
                                            <h3 className="font-bold text-gray-900 truncate">{tpl.name}</h3>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {tpl.layout.rows}×{tpl.layout.cols} · {tpl.slots.length} photo{tpl.slots.length !== 1 ? 's' : ''}
                                                {' · '}{tpl.textElements.length} text
                                            </p>

                                            <div className="flex gap-2 mt-3">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="flex-1"
                                                    onClick={() => handleEditTemplate(tpl)}
                                                >
                                                    ✏️ Edit
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-600 hover:bg-red-50"
                                                    onClick={() => handleDeleteTemplate(tpl.id)}
                                                >
                                                    🗑️
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }

            {/* Booth Customization */}
            {
                activeTab === 'booth' && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Customize Booth</h2>
                            <p className="text-sm text-gray-600">Configure the public photo booth experience</p>
                        </div>

                        <Card className="p-6">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-2">Welcome Message</label>
                                    <input
                                        type="text"
                                        value={boothSettings.welcomeMessage}
                                        onChange={(e) => setBoothSettings({ ...boothSettings, welcomeMessage: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                        placeholder="e.g. Welcome to our photo booth!"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Shown on the booth welcome screen</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-2">Countdown (seconds)</label>
                                    <div className="flex items-center gap-3">
                                        {[3, 5, 7, 10].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => setBoothSettings({ ...boothSettings, countdownSeconds: n })}
                                                className={`px-4 py-2 rounded-lg font-semibold transition-all ${boothSettings.countdownSeconds === n
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {n}s
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-2">Auto-Snap Mode</label>
                                    <button
                                        onClick={() => setBoothSettings({ ...boothSettings, autoSnap: !boothSettings.autoSnap })}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${boothSettings.autoSnap ? 'bg-indigo-600' : 'bg-gray-300'
                                            }`}
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${boothSettings.autoSnap ? 'translate-x-6' : 'translate-x-1'
                                            }`} />
                                    </button>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {boothSettings.autoSnap
                                            ? 'Photos will be taken automatically with countdown between each shot'
                                            : 'Guests must tap capture for each photo'
                                        }
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-2">Theme Color</label>
                                    <div className="flex items-center gap-3">
                                        {['#6366f1', '#ec4899', '#f97316', '#10b981', '#8b5cf6', '#06b6d4'].map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setBoothSettings({ ...boothSettings, themeColor: color })}
                                                className={`w-10 h-10 rounded-full border-4 transition-all ${boothSettings.themeColor === color ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
                                                    }`}
                                                style={{ background: color }}
                                            />
                                        ))}
                                        <input
                                            type="color"
                                            value={boothSettings.themeColor}
                                            onChange={(e) => setBoothSettings({ ...boothSettings, themeColor: e.target.value })}
                                            className="w-10 h-10 rounded-full cursor-pointer border-0"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <Button variant="primary" onClick={handleSaveBoothSettings} disabled={savingBooth}>
                                        {savingBooth ? 'Saving...' : '💾 Save Booth Settings'}
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        {/* Live Preview Link */}
                        {event.slug && (
                            <Card className="p-6">
                                <h3 className="font-bold text-gray-900 mb-2">Booth Link</h3>
                                <div className="flex items-center gap-3">
                                    <code className="flex-1 bg-gray-100 px-4 py-3 rounded-xl text-sm text-gray-700 font-mono">
                                        {typeof window !== 'undefined' ? window.location.origin : ''}/e/{event.slug}
                                    </code>
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${window.location.origin}/e/${event.slug}`);
                                            alert('Link copied!');
                                        }}
                                    >
                                        📋 Copy
                                    </Button>
                                </div>
                            </Card>
                        )}
                    </div>
                )
            }

            {/* Gallery */}
            {
                activeTab === 'gallery' && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Photo Gallery</h2>
                                <p className="text-sm text-gray-600">{boothPhotos.length} photos taken at this event</p>
                            </div>

                            {boothPhotos.length > 0 && (
                                <div className="flex items-center gap-2">
                                    {isSelectionMode ? (
                                        <>
                                            <div className="flex items-center gap-2 mr-2 border-r border-gray-200 pr-4">
                                                <span className="text-sm font-medium text-indigo-600">{selectedPhotos.length} selected</span>
                                                <button
                                                    onClick={() => setSelectedPhotos(selectedPhotos.length === boothPhotos.length ? [] : boothPhotos.map(p => p.id))}
                                                    className="text-xs text-gray-500 hover:text-indigo-600 underline"
                                                >
                                                    {selectedPhotos.length === boothPhotos.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleTogglePublish(true)}
                                                    disabled={selectedPhotos.length === 0 || actionLoading}
                                                    className="text-xs"
                                                >
                                                    👁 Publish
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleTogglePublish(false)}
                                                    disabled={selectedPhotos.length === 0 || actionLoading}
                                                    className="text-xs"
                                                >
                                                    🚫 Unpublish
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={handleDeleteSelected}
                                                    disabled={selectedPhotos.length === 0 || actionLoading}
                                                    className="text-xs ml-2 bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300"
                                                >
                                                    🗑 Delete
                                                </Button>
                                                <button
                                                    onClick={() => { setIsSelectionMode(false); setSelectedPhotos([]); }}
                                                    className="ml-2 text-gray-400 hover:text-gray-600 p-1"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <Button variant="secondary" size="sm" onClick={() => setIsSelectionMode(true)}>
                                            Select Photos
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>

                        {boothPhotos.length === 0 ? (
                            <Card className="p-12">
                                <div className="text-center">
                                    <div className="text-6xl mb-4">📷</div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">No photos yet</h3>
                                    <p className="text-gray-600 max-w-sm mx-auto">
                                        Photos taken in the booth will appear here. Share the booth link to get started!
                                    </p>
                                </div>
                            </Card>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {boothPhotos.map((photo) => (
                                        <div
                                            key={photo.id}
                                            className={`relative group aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${selectedPhotos.includes(photo.id)
                                                ? 'border-indigo-500 ring-4 ring-indigo-500/20'
                                                : 'border-transparent hover:border-gray-300'
                                                } ${isSelectionMode && !selectedPhotos.includes(photo.id) ? 'opacity-60 scale-95' : ''}`}
                                            onClick={() => isSelectionMode && handleToggleSelect(photo.id)}
                                        >
                                            <img
                                                src={photo.image_url || photo.final_url}
                                                alt="Booth photo"
                                                loading="lazy"
                                                className="w-full h-full object-cover"
                                            />

                                            {/* Status Badge */}
                                            <div className="absolute top-2 right-2">
                                                {photo.is_published ? (
                                                    <span className="bg-green-500/90 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm">
                                                        Published
                                                    </span>
                                                ) : (
                                                    <span className="bg-gray-500/90 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm">
                                                        Hidden
                                                    </span>
                                                )}
                                            </div>

                                            {/* Selection Overlay */}
                                            {isSelectionMode && (
                                                <div className={`absolute inset-0 flex items-center justify-center transition-colors ${selectedPhotos.includes(photo.id) ? 'bg-indigo-500/20' : 'bg-transparent hover:bg-black/10'
                                                    }`}>
                                                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${selectedPhotos.includes(photo.id)
                                                        ? 'bg-indigo-600 border-indigo-600 scale-110 shadow-lg'
                                                        : 'bg-white/80 border-gray-400'
                                                        }`}>
                                                        {selectedPhotos.includes(photo.id) && (
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-white">
                                                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {!isSelectionMode && (
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <a
                                                        href={photo.image_url || photo.final_url}
                                                        download
                                                        className="p-2 bg-white rounded-full text-gray-900 hover:bg-gray-100 transition-colors"
                                                        onClick={(e) => e.stopPropagation()}
                                                        title="Download"
                                                    >
                                                        ⬇
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )
            }

            {/* Public Page Config */}
            {
                activeTab === 'public-page' && (
                    <div className="max-w-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Public Gallery Settings</h2>
                                <p className="text-sm text-gray-600">Configure how the public gallery looks</p>
                            </div>
                            <Button
                                variant="primary"
                                onClick={handleSavePublicPage}
                                disabled={savingPublicPage}
                            >
                                {savingPublicPage ? 'Saving...' : 'Save Settings'}
                            </Button>
                        </div>

                        <Card className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-2">Gallery Title</label>
                                <input
                                    type="text"
                                    value={publicPageSettings.title}
                                    onChange={(e) => setPublicPageSettings({ ...publicPageSettings, title: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                    placeholder="e.g. Valentine's Day Party"
                                />
                                <p className="text-xs text-gray-500 mt-1">Appears at the top of the gallery page</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-2">Subtitle / Date</label>
                                <input
                                    type="text"
                                    value={publicPageSettings.subtitle}
                                    onChange={(e) => setPublicPageSettings({ ...publicPageSettings, subtitle: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                    placeholder="e.g. Feb 14, 2024"
                                />
                                <p className="text-xs text-gray-500 mt-1">Appears below the title</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-2">Theme Style</label>
                                <select
                                    value={publicPageSettings.themeStyle || 'modern'}
                                    onChange={(e) => setPublicPageSettings({ ...publicPageSettings, themeStyle: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                >
                                    <option value="modern">Modern (Dark)</option>
                                    <option value="valentine">Valentine's Day (Pink)</option>
                                    <option value="minimal">Minimal (Light)</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">choose the overall look and feel</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-2">Theme Color</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={publicPageSettings.themeColor || '#6366f1'}
                                        onChange={(e) => setPublicPageSettings({ ...publicPageSettings, themeColor: e.target.value })}
                                        className="h-10 w-20 p-1 rounded border border-gray-300 cursor-pointer"
                                    />
                                    <span className="text-sm font-mono text-gray-600">
                                        {publicPageSettings.themeColor || '#6366f1'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Main color for buttons and accents</p>
                            </div>

                            {/* We can add more settings here like custom colors later */}
                        </Card>
                    </div>
                )
            }

            {/* Template Editor Modal */}
            {
                showEditor && (
                    <TemplateDesigner
                        initialTemplate={editingTemplate}
                        onSave={handleSaveTemplate}
                        onClose={() => {
                            setShowEditor(false);
                            setEditingTemplate(null);
                        }}
                    />
                )
            }
        </div >
    );
}
