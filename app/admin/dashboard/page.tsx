'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { 
    Calendar, 
    Camera, 
    HardDrive, 
    Activity, 
    ArrowUpRight, 
    Clock, 
    Plus, 
    Palette 
} from 'lucide-react';

export default function AdminDashboard() {
    const [stats, setStats] = useState({ events: 0, photos: 0, storage: '0 MB' });
    const [recentPhotos, setRecentPhotos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [
                { count: eventsCount },
                { count: photosCount },
                { data: activity }
            ] = await Promise.all([
                supabase.from('events').select('*', { count: 'exact', head: true }),
                supabase.from('photos').select('*', { count: 'exact', head: true }),
                supabase.from('photos')
                    .select('id, created_at, final_url, image_url, events(name)')
                    .order('created_at', { ascending: false })
                    .limit(5)
            ]);

            setStats({
                events: eventsCount || 0,
                photos: photosCount || 0,
                storage: `${((photosCount || 0) * 0.8).toFixed(1)} MB`,
            });
            setRecentPhotos(activity || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const statItems = [
        { label: 'Total Events', value: stats.events.toString(), icon: Calendar, color: 'text-neutral-900', bg: 'bg-neutral-100' },
        { label: 'Total Photos', value: stats.photos.toString(), icon: Camera, color: 'text-neutral-900', bg: 'bg-neutral-100' },
        { label: 'Storage Used', value: stats.storage, icon: HardDrive, color: 'text-neutral-900', bg: 'bg-neutral-100' },
        { label: 'System Status', value: 'Active', icon: Activity, color: 'text-neutral-900', bg: 'bg-neutral-100' },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-6 h-6 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-neutral-900 mb-2">Overview</h1>
                    <p className="text-neutral-500 font-medium">Monitoring your photo booth ecosystem.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/booth">
                        <Button variant="ghost" className="rounded-full px-6 font-semibold border-neutral-200">
                            Launch Booth <ArrowUpRight size={16} className="ml-2" />
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statItems.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.label} className="p-8 hover:shadow-xl transition-all duration-300 border-neutral-100 group">
                            <div className="flex justify-between items-start mb-6">
                                <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                                    <Icon size={24} />
                                </div>
                            </div>
                            <h3 className="text-4xl font-bold tracking-tight mb-2 text-neutral-900">{stat.value}</h3>
                            <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest">{stat.label}</p>
                        </Card>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Recent Activity */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold tracking-tight">Recent Activity</h3>
                        <Link href="/admin/events" className="text-sm font-bold text-neutral-400 hover:text-neutral-900 transition-colors uppercase tracking-widest">
                            View All
                        </Link>
                    </div>

                    <div className="space-y-3">
                        {recentPhotos.length === 0 ? (
                            <div className="p-12 text-center rounded-3xl bg-neutral-50 border border-dashed border-neutral-200">
                                <p className="text-neutral-400 font-medium">No recent activity recorded yet.</p>
                            </div>
                        ) : (
                            recentPhotos.map((photo) => (
                                <div key={photo.id} className="group flex items-center justify-between p-4 rounded-2xl bg-white border border-neutral-100 hover:border-neutral-900 transition-all duration-300">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-xl bg-neutral-100 overflow-hidden flex-shrink-0 border border-neutral-100">
                                            {(photo.final_url || photo.image_url) && (
                                                <img
                                                    src={photo.final_url || photo.image_url}
                                                    alt="Recent"
                                                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                                                />
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-bold text-neutral-900">
                                                Shot taken at <span className="text-neutral-500 font-medium">{photo.events?.name || 'Unknown Event'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-tighter mt-1">
                                                <Clock size={12} />
                                                {new Date(photo.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-4">
                                        <ArrowUpRight size={20} className="text-neutral-300" />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-6">
                    <h3 className="text-xl font-bold tracking-tight">Quick Actions</h3>
                    <div className="space-y-4">
                        <Link href="/admin/events/new">
                            <div className="p-6 rounded-3xl bg-neutral-900 text-white hover:bg-neutral-800 transition-all cursor-pointer flex items-center gap-5 group shadow-xl shadow-neutral-200">
                                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Plus size={24} />
                                </div>
                                <div>
                                    <div className="font-bold tracking-tight">Create Event</div>
                                    <div className="text-xs text-neutral-400 font-medium">Launch a new experience</div>
                                </div>
                            </div>
                        </Link>

                        <Link href="/admin/templates/new">
                            <div className="p-6 rounded-3xl bg-white border border-neutral-100 hover:border-neutral-900 transition-all cursor-pointer flex items-center gap-5 group">
                                <div className="w-12 h-12 rounded-2xl bg-neutral-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Palette size={24} />
                                </div>
                                <div>
                                    <div className="font-bold tracking-tight text-neutral-900">Design Template</div>
                                    <div className="text-xs text-neutral-400 font-medium">Customize the look</div>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
