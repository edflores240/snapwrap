'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { motion } from 'framer-motion';

interface Event {
    id: string;
    name: string;
    slug: string;
    date: string;
    is_active: boolean;
    created_at: string;
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
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                setEvents(data);
            }
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
                        <div key={i} className="h-48 rounded-3xl bg-gray-100 animate-pulse" />
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
                    {events.map((event, index) => (
                        <motion.div
                            key={event.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card className="group hover:shadow-lg hover:border-indigo-200 transition-all duration-300 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-start to-primary-end opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${event.is_active
                                                ? 'bg-green-100 text-green-700 border border-green-200'
                                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                                            }`}>
                                            {event.is_active ? 'Active' : 'Archived'}
                                        </div>
                                        <div className="text-xs text-gray-500 font-medium">
                                            {new Date(event.date).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-900 mb-1 truncate" title={event.name}>
                                        {event.name}
                                    </h3>
                                    <p className="text-sm text-indigo-600 mb-6 truncate font-mono">
                                        /{event.slug || 'no-slug'}
                                    </p>

                                    <div className="flex gap-2 mt-auto">
                                        <Link href={`/admin/events/${event.id}`} className="flex-1">
                                            <Button variant="secondary" className="w-full">
                                                Manage
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            className="px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleDelete(event.id)}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                            </svg>
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
