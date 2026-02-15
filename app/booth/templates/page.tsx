'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Template {
    id: string;
    name: string;
    thumbnail_url: string | null;
    overlay_url: string;
    category: string;
}

export default function TemplatesPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen relative flex items-center justify-center">
                <GradientBackground />
                <div className="text-center py-20">
                    <div className="text-4xl mb-4 animate-pulse">🎨</div>
                    <p className="text-gray-400">Loading templates...</p>
                </div>
            </main>
        }>
            <TemplatesPageContent />
        </Suspense>
    );
}

function TemplatesPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const capturedImage = searchParams.get('image');

    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const { data, error } = await supabase
                .from('templates')
                .select('*')
                .eq('is_active', true);

            if (error) throw error;
            setTemplates(data || []);
        } catch (error) {
            console.error('Error fetching templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleContinue = () => {
        if (!selectedTemplate || !capturedImage) return;

        router.push(
            `/booth/preview?image=${encodeURIComponent(capturedImage)}&templateId=${selectedTemplate.id}`
        );
    };

    if (!capturedImage) {
        return (
            <main className="min-h-screen relative flex items-center justify-center">
                <GradientBackground />
                <div className="text-center">
                    <h2 className="text-3xl font-bold mb-4">No photo captured</h2>
                    <Link href="/booth">
                        <Button>Go to Camera</Button>
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen relative">
            <GradientBackground />

            <div className="container mx-auto px-4 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-black mb-2">
                        <span className="text-gradient">Choose a Template</span>
                    </h1>
                    <p className="text-gray-400">Select a frame to apply to your photo</p>
                </div>

                <div className="max-w-6xl mx-auto">
                    {loading ? (
                        <div className="text-center py-20">
                            <div className="text-4xl mb-4 animate-pulse">🎨</div>
                            <p className="text-gray-400">Loading templates...</p>
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="text-6xl mb-4">📦</div>
                            <h3 className="text-2xl font-bold mb-4">No Templates Available</h3>
                            <p className="text-gray-400 mb-8">
                                Please add templates to your Supabase database first.
                            </p>
                            <Link href="/booth">
                                <Button variant="ghost">← Back to Camera</Button>
                            </Link>
                        </div>
                    ) : (
                        <>
                            {/* Template Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12">
                                {templates.map((template) => (
                                    <Card
                                        key={template.id}
                                        className={`cursor-pointer transition-all ${selectedTemplate?.id === template.id
                                            ? 'ring-2 ring-purple-500'
                                            : ''
                                            }`}
                                        onClick={() => setSelectedTemplate(template)}
                                    >
                                        <div className="aspect-square bg-gray-800 rounded-2xl mb-4 flex items-center justify-center overflow-hidden">
                                            {template.thumbnail_url ? (
                                                <img
                                                    src={template.thumbnail_url}
                                                    alt={template.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="text-5xl">🖼️</div>
                                            )}
                                        </div>
                                        <h4 className="font-semibold text-center">{template.name}</h4>
                                        <p className="text-xs text-gray-500 text-center capitalize">
                                            {template.category}
                                        </p>
                                    </Card>
                                ))}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link href="/booth">
                                    <Button variant="ghost">
                                        ← Back to Camera
                                    </Button>
                                </Link>
                                <Button
                                    variant="primary"
                                    size="lg"
                                    disabled={!selectedTemplate}
                                    onClick={handleContinue}
                                >
                                    {selectedTemplate ? '✨ Apply Template →' : 'Select a Template'}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
