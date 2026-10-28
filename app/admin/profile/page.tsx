'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '../layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Camera, Plus, Trash2, ExternalLink, Loader2, Check,
    ZoomIn, ZoomOut, Copy, Star, CheckCircle2, XCircle,
    Globe, Mail, Phone, Link as LinkIcon,
} from 'lucide-react';
import { InstagramIcon, FacebookIcon, TwitterIcon, YoutubeIcon, LinkedinIcon, TiktokIcon } from '@/components/SocialIcons';
import Link from 'next/link';
import type { ServicePackage, Testimonial, CustomLink, CustomLinkIcon } from '@/lib/auth';
import { getCroppedBlob } from '@/lib/image-utils';
import { Playfair_Display } from 'next/font/google';

const playfair = Playfair_Display({ subsets: ['latin'] });

// ── Icon options for custom links ─────────────────────────────────────────────

const ICON_OPTIONS: { value: CustomLinkIcon; label: string; icon: React.ReactNode }[] = [
    { value: 'instagram', label: 'Instagram',  icon: <InstagramIcon size={14} /> },
    { value: 'facebook',  label: 'Facebook',   icon: <FacebookIcon  size={14} /> },
    { value: 'tiktok',    label: 'TikTok',     icon: <TiktokIcon    size={14} /> },
    { value: 'twitter',   label: 'Twitter',    icon: <TwitterIcon   size={14} /> },
    { value: 'youtube',   label: 'YouTube',    icon: <YoutubeIcon   size={14} /> },
    { value: 'linkedin',  label: 'LinkedIn',   icon: <LinkedinIcon  size={14} /> },
    { value: 'email',     label: 'Email',      icon: <Mail          size={14} /> },
    { value: 'phone',     label: 'Phone',      icon: <Phone         size={14} /> },
    { value: 'website',   label: 'Website',    icon: <Globe         size={14} /> },
    { value: 'link',      label: 'Other Link', icon: <LinkIcon      size={14} /> },
];

// ── Pending submission type ───────────────────────────────────────────────────

interface Submission {
    id: string;
    author: string;
    role: string | null;
    company: string | null;
    text: string;
    rating: number | null;
    created_at: string;
}

// ── Page component ────────────────────────────────────────────────────────────

export default function ProfilePage() {
    const { profile, refreshProfile } = useAdmin();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [copied, setCopied] = useState(false);

    // Crop modal state
    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const onCropComplete = useCallback((_: unknown, pixels: { x: number; y: number; width: number; height: number }) => {
        setCroppedAreaPixels(pixels);
    }, []);

    const [form, setForm] = useState({ business_name: '', bio: '', location: '', website: '', logo_url: '' });
    const [services, setServices] = useState<ServicePackage[]>([]);
    const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);
    const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [loadingSubmissions, setLoadingSubmissions] = useState(true);

    useEffect(() => {
        if (!profile) return;
        setForm({
            business_name: profile.business_name ?? '',
            bio: profile.bio ?? '',
            location: profile.location ?? '',
            website: profile.website ?? '',
            logo_url: profile.logo_url ?? '',
        });
        setServices(profile.services ?? []);
        setCustomLinks(Array.isArray(profile.custom_links) ? profile.custom_links : []);
        setTestimonials(profile.testimonials ?? []);
        fetchSubmissions(profile.id);
    }, [profile]);

    async function fetchSubmissions(profileId: string) {
        setLoadingSubmissions(true);
        try {
            const { data } = await supabase
                .from('testimonial_submissions')
                .select('id, author, role, company, text, rating, created_at')
                .eq('profile_id', profileId)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });
            setSubmissions((data as Submission[]) ?? []);
        } catch (err) {
            console.error('Failed to fetch submissions:', err);
        } finally {
            setLoadingSubmissions(false);
        }
    }

    const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { setCropSrc(reader.result as string); setCrop({ x: 0, y: 0 }); setZoom(1); };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const cropAndUpload = async () => {
        if (!cropSrc || !croppedAreaPixels || !profile) return;
        setUploadingLogo(true);
        setCropSrc(null);
        try {
            const blob = await getCroppedBlob(cropSrc, croppedAreaPixels);
            const path = `logos/${profile.id}.jpg`;
            const { error } = await supabase.storage.from('booth-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
            if (error) throw error;
            const { data: { publicUrl } } = supabase.storage.from('booth-photos').getPublicUrl(path);
            setForm(prev => ({ ...prev, logo_url: `${publicUrl}?t=${Date.now()}` }));
        } catch (err) { console.error('Logo upload failed:', err); }
        finally { setUploadingLogo(false); }
    };

    const handleSave = async () => {
        if (!profile) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('profiles').update({
                business_name: form.business_name || null,
                bio: form.bio || null,
                location: form.location || null,
                website: form.website || null,
                logo_url: form.logo_url || null,
                services,
                custom_links: customLinks,
                testimonials,
            }).eq('id', profile.id);
            if (error) throw error;
            await refreshProfile();
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) { console.error('Save failed:', err); }
        finally { setSaving(false); }
    };

    // ── Custom links helpers ────────────────────────────────────────────────

    const addLink = () => {
        setCustomLinks(prev => [...prev, { id: crypto.randomUUID(), label: '', url: '', icon: 'link' }]);
    };

    const updateLink = (id: string, field: keyof CustomLink, value: string) => {
        setCustomLinks(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
    };

    const removeLink = (id: string) => setCustomLinks(prev => prev.filter(l => l.id !== id));

    // ── Testimonials helpers ────────────────────────────────────────────────

    const addTestimonial = () => {
        setTestimonials(prev => [...prev, { id: crypto.randomUUID(), author: '', role: '', company: '', text: '', rating: 5 }]);
    };

    const updateTestimonial = (id: string, field: keyof Testimonial, value: unknown) => {
        setTestimonials(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const removeTestimonial = (id: string) => setTestimonials(prev => prev.filter(t => t.id !== id));

    // ── Review request approve/decline ──────────────────────────────────────

    const approveSubmission = async (sub: Submission) => {
        setApprovingId(sub.id);
        const newTestimonial: Testimonial = {
            id: crypto.randomUUID(),
            author: sub.author,
            role: sub.role ?? undefined,
            company: sub.company ?? undefined,
            text: sub.text,
            rating: sub.rating ?? 5,
        };
        const updatedTestimonials = [...testimonials, newTestimonial];
        await supabase.from('testimonial_submissions').update({ status: 'approved' }).eq('id', sub.id);
        await supabase.from('profiles').update({ testimonials: updatedTestimonials }).eq('id', profile!.id);
        setTestimonials(updatedTestimonials);
        setSubmissions(prev => prev.filter(s => s.id !== sub.id));
        setApprovingId(null);
    };

    const declineSubmission = async (id: string) => {
        setApprovingId(id);
        await supabase.from('testimonial_submissions').update({ status: 'declined' }).eq('id', id);
        setSubmissions(prev => prev.filter(s => s.id !== id));
        setApprovingId(null);
    };

    // ── Service helpers ─────────────────────────────────────────────────────

    const addService = () => setServices(prev => [...prev, { id: crypto.randomUUID(), title: '', description: '', price: '', features: [] }]);
    const updateService = (id: string, field: keyof ServicePackage, value: unknown) =>
        setServices(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    const removeService = (id: string) => setServices(prev => prev.filter(s => s.id !== id));
    const addFeature = (sid: string) => setServices(prev => prev.map(s => s.id === sid ? { ...s, features: [...s.features, ''] } : s));
    const updateFeature = (sid: string, idx: number, val: string) =>
        setServices(prev => prev.map(s => s.id === sid ? { ...s, features: s.features.map((f, i) => i === idx ? val : f) } : s));
    const removeFeature = (sid: string, idx: number) =>
        setServices(prev => prev.map(s => s.id === sid ? { ...s, features: s.features.filter((_, i) => i !== idx) } : s));

    if (!profile) {
        return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-neutral-300" /></div>;
    }

    const reviewUrl = typeof window !== 'undefined' ? `${window.location.origin}/u/${profile.username}/review` : `/u/${profile.username}/review`;

    return (
        <div className="max-w-3xl mx-auto space-y-12 pb-32">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className={`text-4xl font-black tracking-tight text-[#2A2724] mb-2 ${playfair.className}`}>Profile</h1>
                    <p className="text-neutral-500 font-medium">Your public business page at{' '}
                        <Link href={`/u/${profile.username}`} target="_blank" className="text-[#2A2724] font-bold hover:underline inline-flex items-center gap-1">
                            /u/{profile.username} <ExternalLink size={12} />
                        </Link>
                    </p>
                </div>
                <Button onClick={handleSave} disabled={saving}
                    className="rounded-full px-8 h-12 font-bold text-sm flex items-center gap-2 bg-[#2A2724] text-white hover:bg-[#3D3935] disabled:opacity-50 transition-all">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
                    {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                </Button>
            </div>

            {/* Business Info */}
            <Card className="p-8 border-neutral-100 space-y-8">
                <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400">Business Info</h2>
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-neutral-400 transition-colors relative group"
                        onClick={() => fileInputRef.current?.click()}>
                        {form.logo_url
                            ? <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
                            : <Camera size={24} className="text-neutral-300" />}
                        {uploadingLogo && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                <Loader2 size={16} className="animate-spin text-neutral-500" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                            <Camera size={16} className="text-white" />
                        </div>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                    <div>
                        <p className="text-sm font-semibold text-neutral-900">Business Logo</p>
                        <p className="text-xs text-neutral-400 mt-1">Click to upload · 400×400px recommended</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                        { key: 'business_name', label: 'Business Name', placeholder: "Jay's Photo Co.", type: 'text' },
                        { key: 'location',      label: 'Location',      placeholder: 'Los Angeles, CA',  type: 'text' },
                        { key: 'website',       label: 'Website',       placeholder: 'https://yoursite.com', type: 'url' },
                    ].map(({ key, label, placeholder, type }) => (
                        <div key={key} className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</label>
                            <input type={type} value={(form as Record<string, string>)[key]}
                                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                                className="w-full bg-[#FAF8F5] border border-[#ECE8DF] rounded-xl px-4 py-3 text-[#2A2724] focus:outline-none focus:border-[#2A2724] transition-all placeholder:text-neutral-300 text-sm"
                                placeholder={placeholder} />
                        </div>
                    ))}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">Username</label>
                        <input type="text" value={profile.username} disabled
                            className="w-full bg-[#FAF8F5] border border-[#ECE8DF] rounded-xl px-4 py-3 text-neutral-400 text-sm cursor-not-allowed" />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">Bio</label>
                    <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
                        rows={3}
                        className="w-full bg-white border border-[#ECE8DF] rounded-xl px-4 py-3 text-[#2A2724] focus:outline-none focus:border-[#2A2724] transition-all placeholder:text-neutral-300 text-sm resize-none"
                        placeholder="Tell clients what makes your photo booth service special..." />
                </div>
            </Card>

            {/* Custom Contact Links */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400">Contact Links</h2>
                        <p className="text-xs text-neutral-400 mt-1">Shown on your profile's contact section — add, reorder, delete</p>
                    </div>
                    <button onClick={addLink}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2A2724] text-white text-xs font-bold hover:bg-[#3D3935] transition-all">
                        <Plus size={14} /> Add Link
                    </button>
                </div>

                {customLinks.length === 0 && (
                    <div className="p-10 text-center rounded-2xl bg-[#FAF8F5] border border-dashed border-[#ECE8DF]">
                        <p className="text-neutral-400 text-sm font-medium">No links yet. Add Instagram, website, booking link, etc.</p>
                    </div>
                )}

                <div className="space-y-3">
                    {customLinks.map(link => (
                        <Card key={link.id} className="p-4 border-[#ECE8DF]">
                            <div className="flex items-center gap-3">
                                <select value={link.icon} onChange={e => updateLink(link.id, 'icon', e.target.value)}
                                    className="bg-[#FAF8F5] border border-[#ECE8DF] rounded-lg px-2 py-2 text-[#2A2724] text-xs font-medium focus:outline-none focus:border-[#2A2724] transition-all">
                                    {ICON_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <input type="text" value={link.label} onChange={e => updateLink(link.id, 'label', e.target.value)}
                                    placeholder="Label (e.g. Instagram)"
                                    className="w-32 bg-[#FAF8F5] border border-[#ECE8DF] rounded-lg px-3 py-2 text-[#2A2724] text-sm focus:outline-none focus:border-[#2A2724] transition-all" />
                                <input type="url" value={link.url} onChange={e => updateLink(link.id, 'url', e.target.value)}
                                    placeholder="https://..."
                                    className="flex-1 bg-[#FAF8F5] border border-[#ECE8DF] rounded-lg px-3 py-2 text-[#2A2724] text-sm focus:outline-none focus:border-[#2A2724] transition-all" />
                                <button onClick={() => removeLink(link.id)}
                                    className="text-neutral-300 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-lg flex-shrink-0">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
 
            {/* Page Appearance */}
            <Card className="p-8 border-[#ECE8DF] flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400">Page Appearance</h2>
                    <p className="text-sm font-bold text-[#2A2724] mt-2">Design your public profile</p>
                    <p className="text-xs text-neutral-500 mt-1 max-w-sm">Customize colors, themes, and layout with live preview.</p>
                </div>
                <Link href="/admin/profile/appearance"
                    className="shrink-0 flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#2A2724] text-white font-bold text-sm hover:bg-[#3D3935] transition-all shadow-sm">
                    Open Live Editor <ExternalLink size={16} />
                </Link>
            </Card>er            {/* Service Packages */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400">Service Packages</h2>
                        <p className="text-xs text-neutral-400 mt-1">Shown on your public profile page</p>
                    </div>
                    <button onClick={addService}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2A2724] text-white text-xs font-bold hover:bg-[#3D3935] transition-all">
                        <Plus size={14} /> Add Package
                    </button>
                </div>
 
                {services.length === 0 && (
                    <div className="p-10 text-center rounded-2xl bg-[#FAF8F5] border border-dashed border-[#ECE8DF]">
                        <p className="text-neutral-400 text-sm font-medium">No packages yet. Add one to showcase your offerings.</p>
                    </div>
                )}
 
                <div className="space-y-4">
                    {services.map((service, si) => (
                        <Card key={service.id} className="p-6 border-[#ECE8DF] space-y-5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-widest text-neutral-400">Package {si + 1}</span>
                                <button onClick={() => removeService(service.id)}
                                    className="text-neutral-300 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-lg">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">Title</label>
                                    <input type="text" value={service.title} onChange={e => updateService(service.id, 'title', e.target.value)}
                                        className="w-full bg-white border border-[#ECE8DF] rounded-xl px-4 py-2.5 text-[#2A2724] focus:outline-none focus:border-[#2A2724] transition-all text-sm"
                                        placeholder="Basic Package" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">Price</label>
                                    <input type="text" value={service.price} onChange={e => updateService(service.id, 'price', e.target.value)}
                                        className="w-full bg-white border border-[#ECE8DF] rounded-xl px-4 py-2.5 text-[#2A2724] focus:outline-none focus:border-[#2A2724] transition-all text-sm"
                                        placeholder="$500" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">Description</label>
                                <textarea value={service.description} onChange={e => updateService(service.id, 'description', e.target.value)}
                                    rows={2}
                                    className="w-full bg-white border border-[#ECE8DF] rounded-xl px-4 py-2.5 text-[#2A2724] focus:outline-none focus:border-[#2A2724] transition-all text-sm resize-none"
                                    placeholder="2 hours of photo booth coverage..." />
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">Features</label>
                                    <button onClick={() => addFeature(service.id)} className="text-xs font-bold text-neutral-500 hover:text-[#2A2724] transition-colors flex items-center gap-1">
                                        <Plus size={12} /> Add
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {service.features.map((feature, fi) => (
                                        <div key={fi} className="flex items-center gap-2">
                                            <input type="text" value={feature} onChange={e => updateFeature(service.id, fi, e.target.value)}
                                                className="flex-1 bg-white border border-[#ECE8DF] rounded-lg px-3 py-2 text-[#2A2724] focus:outline-none focus:border-[#2A2724] transition-all text-sm"
                                                placeholder="Unlimited prints" />
                                            <button onClick={() => removeFeature(service.id, fi)} className="text-neutral-300 hover:text-red-400 transition-colors p-1">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Review Requests */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400">
                            Review Requests
                            {submissions.length > 0 && (
                                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-neutral-900 text-white text-[10px] font-black">
                                    {submissions.length}
                                </span>
                            )}
                        </h2>
                        <p className="text-xs text-neutral-400 mt-1">Share the link so clients can submit reviews</p>
                    </div>
                    <button onClick={() => {
                        navigator.clipboard.writeText(reviewUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#ECE8DF] text-neutral-600 text-xs font-bold hover:bg-[#FAF8F5] transition-all">
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied!' : 'Copy Review Link'}
                    </button>
                </div>

                {loadingSubmissions ? (
                    <div className="space-y-4">
                        {[1, 2].map(n => (
                            <Card key={n} className="p-6 border-[#ECE8DF] space-y-4 animate-pulse">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 bg-neutral-200 rounded-md w-1/4" />
                                        <div className="h-3 bg-neutral-100 rounded-md w-1/3" />
                                        <div className="flex gap-1 pt-1">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div key={i} className="w-3 h-3 rounded-full bg-neutral-200" />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="h-3 bg-neutral-200 rounded-md w-16" />
                                </div>
                                <div className="space-y-2">
                                    <div className="h-3 bg-neutral-100 rounded-md w-full" />
                                    <div className="h-3 bg-neutral-100 rounded-md w-5/6" />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <div className="h-8 bg-neutral-200 rounded-lg w-20" />
                                    <div className="h-8 bg-neutral-100 rounded-lg w-20" />
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : submissions.length === 0 ? (
                    <div className="p-10 text-center rounded-2xl bg-[#FAF8F5] border border-dashed border-[#ECE8DF]">
                        <p className="text-neutral-400 text-sm font-medium">No pending reviews. Share your review link with clients.</p>
                        <p className="text-neutral-300 text-xs mt-2 font-mono">/u/{profile.username}/review</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {submissions.map(sub => (
                            <Card key={sub.id} className="p-6 border-[#ECE8DF] space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="font-bold text-[#2A2724] text-sm">{sub.author}</p>
                                        {(sub.role || sub.company) && (
                                            <p className="text-xs text-neutral-400">{[sub.role, sub.company].filter(Boolean).join(' · ')}</p>
                                        )}
                                        {sub.rating && (
                                            <div className="flex items-center gap-0.5 mt-1">
                                                {[1,2,3,4,5].map(n => (
                                                    <Star key={n} size={12} className={n <= sub.rating! ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-xs text-neutral-400 flex-shrink-0">
                                        {new Date(sub.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-sm text-neutral-600 leading-relaxed">{sub.text}</p>
                                <div className="flex items-center gap-3 pt-1">
                                    <button onClick={() => approveSubmission(sub)} disabled={approvingId === sub.id}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2A2724] text-white text-xs font-bold hover:bg-[#3D3935] transition-all disabled:opacity-50">
                                        {approvingId === sub.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                        Approve
                                    </button>
                                    <button onClick={() => declineSubmission(sub.id)} disabled={approvingId === sub.id}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#ECE8DF] text-neutral-500 text-xs font-bold hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all disabled:opacity-50">
                                        <XCircle size={12} /> Decline
                                    </button>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Testimonials */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400">Published Testimonials</h2>
                        <p className="text-xs text-neutral-400 mt-1">Manually add reviews or they appear here after approval</p>
                    </div>
                    <button onClick={addTestimonial}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2A2724] text-white text-xs font-bold hover:bg-[#3D3935] transition-all">
                        <Plus size={14} /> Add Review
                    </button>
                </div>
 
                {testimonials.length === 0 && (
                    <div className="p-10 text-center rounded-2xl bg-[#FAF8F5] border border-dashed border-[#ECE8DF]">
                        <p className="text-neutral-400 text-sm font-medium">No reviews yet. Approve client submissions or add manually.</p>
                    </div>
                )}
 
                <div className="space-y-4">
                    {testimonials.map((t, ti) => (
                        <Card key={t.id} className="p-6 border-[#ECE8DF] space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-widest text-neutral-400">Review {ti + 1}</span>
                                <button onClick={() => removeTestimonial(t.id)}
                                    className="text-neutral-300 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-lg">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <div className="flex items-center gap-1">
                                {[1,2,3,4,5].map(n => (
                                    <button key={n} onClick={() => updateTestimonial(t.id, 'rating', n)} className="transition-transform hover:scale-110">
                                        <Star size={18} className={n <= (t.rating ?? 5) ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'} />
                                    </button>
                                ))}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">Review Text</label>
                                <textarea value={t.text} onChange={e => updateTestimonial(t.id, 'text', e.target.value)}
                                    rows={3}
                                    className="w-full bg-white border border-[#ECE8DF] rounded-xl px-4 py-3 text-[#2A2724] focus:outline-none focus:border-[#2A2724] transition-all placeholder:text-neutral-300 text-sm resize-none"
                                    placeholder="Amazing service! They made our wedding unforgettable..." />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { field: 'author', label: 'Client Name', placeholder: 'Sarah Johnson' },
                                    { field: 'role',    label: 'Role / Title', placeholder: 'Bride'  },
                                    { field: 'company', label: 'Company',      placeholder: 'The Grand Venue' },
                                ].map(({ field, label, placeholder }) => (
                                    <div key={field} className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</label>
                                        <input type="text" value={(t as unknown as Record<string, string>)[field] ?? ''}
                                            onChange={e => updateTestimonial(t.id, field as keyof Testimonial, e.target.value)}
                                            className="w-full bg-white border border-[#ECE8DF] rounded-xl px-4 py-2.5 text-[#2A2724] focus:outline-none focus:border-[#2A2724] transition-all text-sm"
                                            placeholder={placeholder} />
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Mobile sticky save */}
            <div className="fixed bottom-0 left-64 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-[#ECE8DF] flex justify-end md:hidden z-50">
                <Button onClick={handleSave} disabled={saving}
                    className="rounded-full px-8 h-11 font-bold text-sm bg-[#2A2724] text-white hover:bg-[#3D3935]">
                    {saving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>

            {/* Crop Modal */}
            {cropSrc && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-neutral-900/70 backdrop-blur-sm">
                    <div className="bg-white border border-[#ECE8DF] rounded-3xl shadow-2xl overflow-hidden w-full max-w-sm">
                        <div className="p-6 border-b border-[#ECE8DF]">
                            <h3 className="text-sm font-black uppercase tracking-widest text-[#2A2724]">Crop Logo</h3>
                            <p className="text-xs text-neutral-400 mt-1">Square crop — outputs at 400×400px</p>
                        </div>
                        <div className="relative w-full h-72 bg-neutral-900">
                            <Cropper image={cropSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round"
                                showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
                        </div>
                        <div className="px-6 py-4 flex items-center gap-3 border-b border-[#ECE8DF]">
                            <ZoomOut size={16} className="text-neutral-400 flex-shrink-0" />
                            <input type="range" min={1} max={3} step={0.01} value={zoom}
                                onChange={e => setZoom(Number(e.target.value))} className="flex-1 accent-[#2A2724]" />
                            <ZoomIn size={16} className="text-neutral-400 flex-shrink-0" />
                        </div>
                        <div className="p-6 flex gap-3">
                            <button onClick={() => setCropSrc(null)}
                                className="flex-1 py-3 rounded-xl border border-[#ECE8DF] text-sm font-bold text-neutral-500 hover:bg-[#ECE8DF]/40 transition-all">
                                Cancel
                            </button>
                            <button onClick={cropAndUpload}
                                className="flex-[2] py-3 rounded-xl bg-[#2A2724] text-white text-sm font-bold hover:bg-[#3D3935] transition-all">
                                Apply Crop
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
