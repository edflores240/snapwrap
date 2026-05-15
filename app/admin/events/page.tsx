'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { motion } from 'framer-motion';
import { Calendar, Trash2 } from 'lucide-react';

interface Event {
    id: string;
    name: string;
    slug: string;
    date: string;
    is_active: boolean;
    created_at: string;
    boothSettings?: {
        themeColor?: string;
    } | null;
}

export default function EventsPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('id, name, slug, date, is_active, created_at, config->boothSettings')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setEvents(data as Event[]);
        } catch (error) {
            console.error('Error fetching events:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this event? This cannot be undone.')) return;

        try {
            const { error } = await supabase.from('events').delete().eq('id', id);
            if (error) throw error;
            setEvents(events.filter(e => e.id !== id));
        } catch (error) {
            console.error('Error deleting event:', error);
            alert('Failed to delete event');
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Events
                    </h1>
                    <p className="text-gray-600">Manage your photo booth sessions and galleries</p>
                </div>
                <Link href="/admin/events/new">
                    <Button variant="primary" className="shadow-lg hover:shadow-primary/25">
                        + Create Event
                    </Button>
                </Link>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="relative">
                            <div
                                className="absolute inset-0 bg-neutral-100 rounded-2xl translate-y-[-12px] z-0"
                                style={{ clipPath: 'polygon(0% 20%, 40% 20%, 48% 0%, 100% 0%, 100% 100%, 0% 100%)' }}
                            />
                            <div className="relative z-10 min-h-[280px] bg-white border border-neutral-200 rounded-2xl overflow-hidden flex flex-col animate-pulse">
                                <div className="h-1 w-full bg-neutral-100" />
                                <div className="p-10 flex flex-col flex-1">
                                    <div className="flex justify-between mb-8">
                                        <div className="h-4 w-14 bg-neutral-100 rounded-sm" />
                                        <div className="h-4 w-24 bg-neutral-100 rounded-sm" />
                                    </div>
                                    <div className="space-y-3 mb-auto">
                                        <div className="h-6 w-3/4 bg-neutral-100 rounded" />
                                        <div className="h-4 w-1/2 bg-neutral-100 rounded-full" />
                                    </div>
                                    <div className="mt-12 pt-8 border-t border-dashed border-neutral-200 flex justify-between items-center">
                                        <div className="space-y-1">
                                            <div className="h-2 w-16 bg-neutral-100 rounded" />
                                            <div className="h-3 w-24 bg-neutral-100 rounded" />
                                        </div>
                                        <div className="h-8 w-8 bg-neutral-100 rounded-lg" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : events.length === 0 ? (
                <Card className="p-12 text-center border-dashed border-2">
                    <div className="text-gray-600 mb-4 text-lg">No events found</div>
                    <Link href="/admin/events/new">
                        <Button variant="secondary">Create your first event</Button>
                    </Link>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.map((event, index) => {
                        const color = event.boothSettings?.themeColor || '#171717';
                        return (
                            <motion.div
                                key={event.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                style={{ rotate: index % 2 === 0 ? '-0.5deg' : '0.5deg' }}
                                className="group"
                            >
                                <Link href={`/admin/events/${event.id}`} className="block relative">
                                    {/* Folder Back Layer (The Tab) */}
                                    <div
                                        className="absolute inset-0 rounded-2xl transform translate-y-[-12px] transition-transform group-hover:translate-y-[-16px] duration-300 z-0"
                                        style={{
                                            clipPath: 'polygon(0% 20%, 40% 20%, 48% 0%, 100% 0%, 100% 100%, 0% 100%)',
                                            backgroundColor: `${color}18`,
                                            border: `1px solid ${color}35`,
                                        }}
                                    />

                                    {/* Folder Front Layer (The Main Card) */}
                                    <div
                                        className="relative min-h-[280px] bg-white rounded-2xl shadow-sm transition-all duration-300 group-hover:translate-y-[-2px] flex flex-col z-10 overflow-hidden"
                                        style={{
                                            border: `1px solid ${color}25`,
                                            boxShadow: `0 1px 3px 0 ${color}15`,
                                        }}
                                        onMouseEnter={e => {
                                            (e.currentTarget as HTMLDivElement).style.boxShadow = `0 20px 40px -12px ${color}30, 0 4px 16px -4px ${color}20`;
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget as HTMLDivElement).style.boxShadow = `0 1px 3px 0 ${color}15`;
                                        }}
                                    >
                                        {/* Theme color accent strip */}
                                        <div className="h-1 w-full flex-shrink-0" style={{ backgroundColor: color }} />

                                        {/* Paper Texture Overlay */}
                                        <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')] rounded-2xl" />

                                        <div className="p-10 flex flex-col h-full relative z-10 flex-1">
                                            <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
                                                <div
                                                    className="px-2 py-1 rounded-sm text-[8px] font-black uppercase tracking-[0.2em]"
                                                    style={{
                                                        backgroundColor: event.is_active ? color : '#f5f5f5',
                                                        color: event.is_active ? '#fff' : '#a3a3a3',
                                                    }}
                                                >
                                                    {event.is_active ? 'Active' : 'Archived'}
                                                </div>
                                                <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                                    <Calendar size={10} />
                                                    {new Date(event.date).toLocaleDateString(undefined, {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    })}
                                                </div>
                                            </div>

                                            <div className="mb-auto space-y-6">
                                                <h3 className="text-2xl font-bold text-neutral-900 leading-tight">
                                                    {event.name}
                                                </h3>

                                                <div className="flex flex-wrap gap-2">
                                                    <div
                                                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full border"
                                                        style={{
                                                            backgroundColor: `${color}08`,
                                                            borderColor: `${color}20`,
                                                        }}
                                                    >
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                                                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                                            {event.slug || 'no-slug'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-12 pt-8 border-t border-dashed border-neutral-200 flex items-center justify-between">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-black text-neutral-300 uppercase tracking-widest">
                                                        Serial Number
                                                    </span>
                                                    <span className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest">
                                                        SR-{event.id.slice(0, 8)}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        handleDelete(event.id);
                                                    }}
                                                    className="text-neutral-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
