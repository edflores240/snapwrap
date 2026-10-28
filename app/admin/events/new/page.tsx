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
    const [visibility, setVisibility] = useState<'public' | 'private'>('public');
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

            const row = {
                name: formData.name,
                slug: formData.slug,
                date: formData.date,
                description: formData.description,
                is_active: true,
                config: {},
                user_id: user.id,
            };
            let { error } = await supabase.from('events').insert([{ ...row, visibility }]);
            if (error?.code === '42703' || error?.code === 'PGRST204') {
                // visibility column not migrated yet: public events still work, private ones need the migration
                if (visibility === 'private') throw new Error('Run the latest database migration to enable private events.');
                ({ error } = await supabase.from('events').insert([row]));
            }

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

                    <div>
                        <label className="block text-sm font-bold text-[#2A2724] mb-2">
                            Privacy
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {([
                                ['public', 'Public', 'Shown in your portfolio on your public profile.'],
                                ['private', 'Only me', 'Hidden from your portfolio. Guests with the booth or gallery link can still open it.'],
                            ] as const).map(([value, title, hint]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setVisibility(value)}
                                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                                        visibility === value ? 'border-[#2A2724] bg-[#FAF8F5]' : 'border-[#ECE8DF] hover:border-neutral-300'
                                    }`}
                                >
                                    <p className="text-sm font-black text-[#2A2724]">{title}</p>
                                    <p className="text-xs text-neutral-500 mt-1 leading-snug">{hint}</p>
                                </button>
                            ))}
                        </div>
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
