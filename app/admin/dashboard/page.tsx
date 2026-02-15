'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function AdminDashboard() {
    const [stats, setStats] = useState({ events: 0, photos: 0, storage: '0 MB' });
    const [recentPhotos, setRecentPhotos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // 1. Counts
            const { count: eventsCount } = await supabase.from('events').select('*', { count: 'exact', head: true });
            const { count: photosCount } = await supabase.from('photos').select('*', { count: 'exact', head: true });

            // 2. Recent Activity (Photos)
            const { data: activity } = await supabase
                .from('photos')
                .select('id, created_at, final_url, image_url, events(name)')
                .order('created_at', { ascending: false })
                .limit(5);

            setStats({
                events: eventsCount || 0,
                photos: photosCount || 0,
                storage: `${((photosCount || 0) * 2.5).toFixed(1)} MB`, // Est. 2.5MB per photo
            });
            setRecentPhotos(activity || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const statItems = [
        { label: 'Total Events', value: stats.events.toString(), icon: '📅', color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'Total Photos', value: stats.photos.toString(), icon: '📸', color: 'text-purple-500', bg: 'bg-purple-500/10' },
        { label: 'Storage Used', value: stats.storage, icon: '💾', color: 'text-orange-500', bg: 'bg-orange-500/10' },
        { label: 'System Status', value: 'Active', icon: '🟢', color: 'text-green-500', bg: 'bg-green-500/10' },
    ];

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading Dashboard stats...</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
                    <p className="text-gray-400">Overview of your photo booth usage</p>
                </div>
                <Link href="/booth">
                    <Button variant="ghost">Launch Booth ↗</Button>
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statItems.map((stat) => (
                    <Card key={stat.label} className="p-6 hover:bg-white/5 transition-colors border-white/5">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl text-2xl ${stat.bg} ${stat.color}`}>
                                {stat.icon}
                            </div>
                        </div>
                        <h3 className="text-3xl font-bold mb-1">{stat.value}</h3>
                        <p className="text-sm text-gray-400">{stat.label}</p>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity */}
                <Card className="p-6 lg:col-span-2 border-white/5">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold">Recent Uploads</h3>
                        <Link href="/admin/events">
                            <span className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer">View All Events</span>
                        </Link>
                    </div>

                    <div className="space-y-4">
                        {recentPhotos.length === 0 ? (
                            <p className="text-gray-500 text-sm italic">No recent activity.</p>
                        ) : (
                            recentPhotos.map((photo) => (
                                <div key={photo.id} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                    <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden flex-shrink-0">
                                        {(photo.final_url || photo.image_url) && (
                                            <img
                                                src={photo.final_url || photo.image_url}
                                                alt="Recent"
                                                className="w-full h-full object-cover"
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-medium">New photo in <span className="text-white font-bold">{photo.events?.name || 'Unknown Event'}</span></div>
                                        <div className="text-xs text-gray-400">
                                            {new Date(photo.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {/* Quick Actions */}
                <Card className="p-6 border-white/5 h-fit">
                    <h3 className="text-xl font-bold mb-6">Quick Actions</h3>
                    <div className="grid grid-cols-1 gap-4">
                        <Link href="/admin/events/new">
                            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600/20 to-blue-400/10 border border-blue-500/20 hover:border-blue-500/50 transition-all cursor-pointer flex items-center gap-4 group">
                                <div className="text-2xl group-hover:scale-110 transition-transform">📅</div>
                                <div>
                                    <div className="font-bold text-blue-100">Create Event</div>
                                    <div className="text-xs text-blue-300">Set up a new booth</div>
                                </div>
                            </div>
                        </Link>

                        <Link href="/admin/templates/new">
                            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-600/20 to-purple-400/10 border border-purple-500/20 hover:border-purple-500/50 transition-all cursor-pointer flex items-center gap-4 group">
                                <div className="text-2xl group-hover:scale-110 transition-transform">🎨</div>
                                <div>
                                    <div className="font-bold text-purple-100">Design Template</div>
                                    <div className="text-xs text-purple-300">Create a new layout</div>
                                </div>
                            </div>
                        </Link>
                    </div>
                </Card>
            </div>
        </div>
    );
}
