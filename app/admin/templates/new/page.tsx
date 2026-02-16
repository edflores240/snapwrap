'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import TemplateDesigner, { TemplateConfig } from '@/components/templates/TemplateDesigner';

export default function NewTemplatePage() {
    const router = useRouter();

    const handleSave = (config: TemplateConfig) => {
        console.log('Template Configuration:', config);
        // For now, since this is a standalone creaetor, we'll just alert the JSON
        // In a real app, this might save to a global library
        const json = JSON.stringify(config, null, 2);
        navigator.clipboard.writeText(json);
        alert('Template configuration copied to clipboard! (Check console for full JSON)');
    };

    const handleClose = () => {
        router.back();
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <div className="flex-1 relative">
                <TemplateDesigner
                    onSave={handleSave}
                    onClose={handleClose}
                />
            </div>
        </div>
    );
}
