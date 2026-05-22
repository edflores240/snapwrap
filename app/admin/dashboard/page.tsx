'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '../layout';
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
import { Playfair_Display } from 'next/font/google';

const playfair = Playfair_Display({ subsets: ['latin'] });

export default function AdminDashboard() {
    const { profile } = useAdmin();
    const [stats, setStats] = useState({ events: 0, photos: 0, storage: '0 MB' });
    const [recentPhotos, setRecentPhotos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [
                { count: eventsCount },
                { count: photosCount },
                { data: activity }
            ] = await Promise.all([
                supabase.from('events').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
                supabase.from('photos').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
                supabase.from('photos')
                    .select('id, created_at, image_url, events(name)')
                    .eq('user_id', user.id)
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
        { label: 'Total Events', value: stats.events.toString(), icon: Calendar, color: 'text-[#8B6E3F]', bg: 'bg-[#F5F0E6]' },
        { label: 'Total Photos', value: stats.photos.toString(), icon: Camera, color: 'text-[#5A7350]', bg: 'bg-[#EBF0E9]' },
        { label: 'Storage Used', value: stats.storage, icon: HardDrive, color: 'text-[#5B4F96]', bg: 'bg-[#EAE8F5]' },
        { label: 'System Status', value: 'Active', icon: Activity, color: 'text-[#5A7350]', bg: 'bg-[#EBF0E9]' },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-6 h-6 border-2 border-neutral-200 border-t-[#2A2724] rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className={`text-4xl font-black tracking-tight text-[#2A2724] mb-2 ${playfair.className}`}>
                        {profile?.business_name ? `Welcome, ${profile.business_name}` : 'Overview'}
                    </h1>
                    <p className="text-neutral-500 font-medium">Monitoring your photo booth ecosystem.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/booth">
                        <Button variant="ghost" className="rounded-full px-6 font-semibold border-[#ECE8DF] text-[#2A2724] hover:bg-[#ECE8DF]/40">
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
                        <Card key={stat.label} className="p-8 hover:shadow-xl transition-all duration-300 border-[#ECE8DF] group">
                            <div className="flex justify-between items-start mb-6">
                                <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                                    <Icon size={24} />
                                </div>
                            </div>
                            <h3 className={`text-4xl font-black tracking-tight mb-2 text-[#2A2724] ${playfair.className}`}>{stat.value}</h3>
                            <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">{stat.label}</p>
                        </Card>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Recent Activity */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className={`text-xl font-black tracking-tight text-[#2A2724] ${playfair.className}`}>Recent Activity</h3>
                        <Link href="/admin/events" className="text-xs font-black text-neutral-400 hover:text-[#2A2724] transition-colors uppercase tracking-widest">
                            View All
                        </Link>
                    </div>

                    <div className="space-y-3">
                        {recentPhotos.length === 0 ? (
                            <div className="p-12 text-center rounded-3xl bg-[#FAF8F5] border border-dashed border-[#ECE8DF]">
                                <p className="text-neutral-400 font-medium">No recent activity recorded yet.</p>
                            </div>
                        ) : (
                            recentPhotos.map((photo) => (
                                <div key={photo.id} className="group flex items-center justify-between p-4 rounded-2xl bg-white border border-[#ECE8DF] hover:border-[#2A2724] transition-all duration-300">
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 rounded-xl bg-[#FAF8F5] overflow-hidden flex-shrink-0 border border-[#ECE8DF]">
                                            {(photo.final_url || photo.image_url) && (
                                                <img
                                                    src={photo.final_url || photo.image_url}
                                                    alt="Recent"
                                                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                                                />
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-bold text-[#2A2724]">
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
                    <h3 className={`text-xl font-black tracking-tight text-[#2A2724] ${playfair.className}`}>Quick Actions</h3>
                    <div className="space-y-4">
                        <Link href="/admin/events/new">
                            <div className="p-6 rounded-3xl bg-[#2A2724] text-white hover:bg-[#3D3935] transition-all cursor-pointer flex items-center gap-5 group shadow-sm border border-[#2A2724]">
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
                            <div className="p-6 rounded-3xl bg-white border border-[#ECE8DF] hover:border-[#2A2724] transition-all cursor-pointer flex items-center gap-5 group shadow-sm">
                                <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Palette size={24} />
                                </div>
                                <div>
                                    <div className="font-bold tracking-tight text-[#2A2724]">Design Template</div>
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
