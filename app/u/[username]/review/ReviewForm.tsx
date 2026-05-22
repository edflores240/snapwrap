'use client';

import { useState } from 'react';
import { Star, Loader2, CheckCircle2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import type { ThemeColors } from '@/lib/color-utils';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ReviewFormProps {
    profileId: string;
    businessName: string;
    accent: string;
    accentContrast: string;
    t: ThemeColors;
}

export default function ReviewForm({ profileId, businessName, accent, accentContrast, t }: ReviewFormProps) {
    const [rating, setRating] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [author, setAuthor] = useState('');
    const [role, setRole] = useState('');
    const [company, setCompany] = useState('');
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!author.trim() || !text.trim() || rating === 0) {
            setError('Please fill in your name, a review, and a star rating.');
            return;
        }
        setSubmitting(true);
        setError('');
        const { error: dbErr } = await supabase.from('testimonial_submissions').insert({
            profile_id: profileId,
            author: author.trim(),
            role: role.trim() || null,
            company: company.trim() || null,
            text: text.trim(),
            rating,
        });
        setSubmitting(false);
        if (dbErr) {
            setError('Something went wrong. Please try again.');
        } else {
            setDone(true);
        }
    }

    if (done) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <CheckCircle2 size={48} style={{ color: accent }} />
                <h2 className="text-2xl font-black" style={{ color: t.text }}>Thanks for your review!</h2>
                <p className="text-sm max-w-xs" style={{ color: t.muted }}>
                    Your review has been submitted. {businessName} will publish it once approved.
                </p>
            </div>
        );
    }

    const inputStyle = {
        backgroundColor: t.surface,
        color: t.text,
        borderColor: t.border,
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Star rating */}
            <div>
                <label className="block text-sm font-bold mb-2" style={{ color: t.text }}>Your rating *</label>
                <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} type="button"
                            onMouseEnter={() => setHovered(n)}
                            onMouseLeave={() => setHovered(0)}
                            onClick={() => setRating(n)}
                            className="transition-transform hover:scale-110 focus:outline-none">
                            <Star size={32} fill={(hovered || rating) >= n ? accent : 'none'}
                                stroke={(hovered || rating) >= n ? accent : t.border} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Author */}
            <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: t.text }}>Your name *</label>
                <input value={author} onChange={e => setAuthor(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 transition-all"
                    style={{ ...inputStyle, ['--tw-ring-color' as string]: `${accent}66` }}
                />
            </div>

            {/* Role + Company */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm font-bold mb-1.5" style={{ color: t.text }}>Role</label>
                    <input value={role} onChange={e => setRole(e.target.value)}
                        placeholder="Bride"
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 transition-all"
                        style={inputStyle}
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold mb-1.5" style={{ color: t.text }}>Company / Event</label>
                    <input value={company} onChange={e => setCompany(e.target.value)}
                        placeholder="Smith Wedding"
                        className="w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 transition-all"
                        style={inputStyle}
                    />
                </div>
            </div>

            {/* Review text */}
            <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: t.text }}>Your review *</label>
                <textarea value={text} onChange={e => setText(e.target.value)}
                    rows={4} placeholder="Tell us about your experience…"
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 transition-all resize-none"
                    style={inputStyle}
                />
            </div>

            {error && <p className="text-sm font-medium text-red-500">{error}</p>}

            <button type="submit" disabled={submitting}
                className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: accent, color: accentContrast }}>
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : 'Submit Review'}
            </button>
        </form>
    );
}
