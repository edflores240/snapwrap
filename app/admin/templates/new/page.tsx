'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import TemplateDesigner, { TemplateConfig } from '@/components/templates/TemplateDesigner';

export default function NewTemplatePage() {
    const router = useRouter();

    const handleSave = (config: TemplateConfig) => {
        try {
            const existingStr = localStorage.getItem('snapwrap_custom_templates');
            const existing = existingStr ? JSON.parse(existingStr) : [];
            const updated = existing.filter((t: TemplateConfig) => t.id !== config.id);
            updated.unshift(config);
            localStorage.setItem('snapwrap_custom_templates', JSON.stringify(updated));
            alert('Template saved successfully! It will now be available when you launch the booth.');
        } catch (e) {
            console.error('Error saving template:', e);
            alert('Failed to save template.');
        }
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
