'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Playfair_Display } from 'next/font/google';

const playfair = Playfair_Display({ subsets: ['latin'] });

export default function NewEventPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        date: '',
        description: ''
    });

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const name = e.target.value;
        const slug = name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
        setFormData(prev => ({ ...prev, name, slug }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { supabase } = await import('@/lib/supabase');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('events')
                .insert([
                    {
                        name: formData.name,
                        slug: formData.slug,
                        date: formData.date,
                        description: formData.description,
                        is_active: true,
                        config: {},
                        user_id: user.id,
                    }
                ]);

            if (error) throw error;

            router.push('/admin/events');
        } catch (error: any) {
            console.error('Error creating event:', error);
            alert('Failed to create event: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-6">
                <h1 className={`text-3xl font-black text-[#2A2724] mb-2 ${playfair.className}`}>Create New Event</h1>
                <p className="text-neutral-500 font-medium">Set up a new photo booth session</p>
            </div>

            <Card className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-[#2A2724] mb-2">
                            Event Name
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={handleNameChange}
                            className="w-full bg-white border border-[#ECE8DF] rounded-xl px-4 py-3 text-[#2A2724] focus:outline-none focus:border-[#2A2724] transition-all"
                            placeholder="e.g. Summer Party 2024"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-[#2A2724] mb-2">
                            Event Date
                        </label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full bg-white border border-[#ECE8DF] rounded-xl px-4 py-3 text-[#2A2724] focus:outline-none focus:border-[#2A2724] transition-all"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-[#2A2724] mb-2">
                            Event URL Slug
                        </label>
                        <div className="flex items-center">
                            <span className="bg-[#FAF8F5] border border-[#ECE8DF] border-r-0 rounded-l-xl px-4 py-3 text-neutral-400 font-mono text-sm">
                                snapwrap.com/e/
                            </span>
                            <input
                                type="text"
                                value={formData.slug}
                                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                className="flex-1 bg-white border border-[#ECE8DF] rounded-r-xl px-4 py-3 text-[#2A2724] focus:outline-none focus:border-[#2A2724] transition-all font-mono"
                                placeholder="jay-wedding"
                                required
                            />
                        </div>
                        <p className="text-xs text-neutral-400 mt-2">
                            This will be the unique link for your guests.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-[#2A2724] mb-2">
                            Description (Optional)
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full bg-white border border-[#ECE8DF] rounded-xl px-4 py-3 text-[#2A2724] focus:outline-none focus:border-[#2A2724] transition-all h-32 resize-none"
                            placeholder="Internal notes about this event..."
                        />
                    </div>

                    <div className="flex gap-4 pt-4">
                        <Button
                            type="button"
                            onClick={() => router.back()}
                            className="flex-1 rounded-full border border-[#ECE8DF] text-[#2A2724] hover:bg-[#ECE8DF]/40 font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-[#2A2724] hover:bg-[#3D3935] text-white rounded-full font-bold shadow-sm"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create Event'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
