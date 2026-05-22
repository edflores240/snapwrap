'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { createProfile, isUsernameTaken } from '@/lib/auth';
import { Inter, Playfair_Display, Caveat } from 'next/font/google';
import { CheckCircle, Loader2 } from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });
const playfair = Playfair_Display({ subsets: ['latin'] });
const caveat = Caveat({ subsets: ['latin'] });

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [username, setUsername] = useState('');
    const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'taken' | 'available'>('idle');
    const [businessName, setBusinessName] = useState('');
    const [location, setLocation] = useState('');

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/admin/login');
                return;
            }
            // If profile already exists, skip onboarding
            const { data } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', session.user.id)
                .single();
            if (data) {
                router.push('/admin/dashboard');
                return;
            }
            setUserId(session.user.id);
            setLoading(false);
        };
        init();
    }, [router]);

    // Debounced username check
    useEffect(() => {
        if (!username) {
            setUsernameStatus('idle');
            return;
        }
        const clean = username.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (clean !== username) {
            setUsername(clean);
            return;
        }
        if (username.length < 3) {
            setUsernameStatus('idle');
            return;
        }
        setUsernameStatus('checking');
        const timer = setTimeout(async () => {
            const taken = await isUsernameTaken(username);
            setUsernameStatus(taken ? 'taken' : 'available');
        }, 500);
        return () => clearTimeout(timer);
    }, [username]);

    const handleNext = () => {
        if (usernameStatus !== 'available') return;
        setStep(2);
    };

    const handleSubmit = async () => {
        if (!userId) return;
        setSubmitting(true);
        setError(null);
        try {
            await createProfile(userId, username, businessName || undefined);
            router.push('/admin/dashboard');
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Check the browser console for details.');
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0]">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
        );
    }

    return (
        <main className={`min-h-screen relative flex items-center justify-center p-4 bg-[#FFF8F0] ${inter.className} text-neutral-900 overflow-hidden`}>
            {/* Decorative blobs */}
            <div className="absolute top-[15%] right-[10%] w-72 h-72 bg-[#FFE4E1] rounded-full blur-[120px] opacity-50 pointer-events-none" />
            <div className="absolute bottom-[15%] left-[8%] w-64 h-64 bg-[#E0F7FA] rounded-full blur-[100px] opacity-50 pointer-events-none" />

            <div className={`absolute top-10 left-10 md:left-20 rotate-[-6deg] ${caveat.className} text-2xl text-neutral-400 pointer-events-none opacity-50`}>
                Let's get started!
            </div>

            <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-2xl shadow-2xl border border-neutral-100 relative z-10">
                {/* Step indicator */}
                <div className="flex items-center gap-3 mb-8">
                    {[1, 2].map((s) => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${s < step ? 'bg-neutral-900 text-white' : s === step ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                                {s < step ? <CheckCircle size={14} /> : s}
                            </div>
                            {s < 2 && <div className={`h-0.5 w-10 rounded-full transition-all ${step > s ? 'bg-neutral-900' : 'bg-neutral-100'}`} />}
                        </div>
                    ))}
                    <span className="ml-auto text-xs font-bold text-neutral-400 uppercase tracking-widest">Step {step} of 2</span>
                </div>

                {step === 1 && (
                    <>
                        <div className="mb-8">
                            <h1 className={`text-3xl font-bold mb-2 ${playfair.className} tracking-tight`}>Choose your username</h1>
                            <p className="text-neutral-500 text-sm">This becomes your public profile URL.</p>
                        </div>

                        <div className="space-y-2 mb-6">
                            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 ml-1">
                                Username
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-mono select-none">
                                    snapwrap.com/u/
                                </span>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-[148px] pr-10 py-3 text-neutral-900 font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all placeholder:text-neutral-300"
                                    placeholder="your-name"
                                    minLength={3}
                                    maxLength={30}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {usernameStatus === 'checking' && <Loader2 size={16} className="animate-spin text-neutral-400" />}
                                    {usernameStatus === 'available' && <CheckCircle size={16} className="text-green-500" />}
                                    {usernameStatus === 'taken' && <span className="text-red-400 text-xs font-bold">✗</span>}
                                </div>
                            </div>
                            {usernameStatus === 'taken' && (
                                <p className="text-xs text-red-500 font-medium ml-1">That username is already taken.</p>
                            )}
                            {usernameStatus === 'available' && (
                                <p className="text-xs text-green-600 font-medium ml-1">Username is available!</p>
                            )}
                            {username.length > 0 && username.length < 3 && (
                                <p className="text-xs text-neutral-400 ml-1">At least 3 characters required.</p>
                            )}
                        </div>

                        <button
                            onClick={handleNext}
                            disabled={usernameStatus !== 'available'}
                            className="w-full bg-neutral-900 text-white rounded-xl py-4 font-bold tracking-wide shadow-lg hover:bg-neutral-800 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            Continue →
                        </button>
                    </>
                )}

                {step === 2 && (
                    <>
                        <div className="mb-8">
                            <h1 className={`text-3xl font-bold mb-2 ${playfair.className} tracking-tight`}>About your business</h1>
                            <p className="text-neutral-500 text-sm">Help clients find and recognize you. You can update this later.</p>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-xl mb-6 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <div className="space-y-5 mb-8">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2 ml-1">
                                    Business Name <span className="text-neutral-300 normal-case font-normal">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all placeholder:text-neutral-300"
                                    placeholder="e.g. Jay's Photo Co."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2 ml-1">
                                    Location <span className="text-neutral-300 normal-case font-normal">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all placeholder:text-neutral-300"
                                    placeholder="e.g. Los Angeles, CA"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep(1)}
                                className="flex-1 bg-white text-neutral-600 border border-neutral-200 rounded-xl py-4 font-bold tracking-wide hover:bg-neutral-50 transition-all"
                            >
                                ← Back
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="flex-[2] bg-neutral-900 text-white rounded-xl py-4 font-bold tracking-wide shadow-lg hover:bg-neutral-800 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <><Loader2 size={16} className="animate-spin" /> Setting up...</>
                                ) : (
                                    'Launch Dashboard →'
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="absolute bottom-6 text-center w-full text-[10px] text-neutral-300 uppercase tracking-widest">
                SnapWrap
            </div>
        </main>
    );
}
