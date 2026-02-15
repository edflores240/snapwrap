'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the editor to avoid SSR issues with fabric.js
const WhiteboardEditor = dynamic(
    () => import('@/components/admin/WhiteboardEditor'),
    { ssr: false, loading: () => <p>Loading Editor...</p> }
);

export default function NewTemplatePage() {
    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">Create New Template</h1>
                <p className="text-gray-400">Design a custom overlay for your event</p>
            </div>

            <WhiteboardEditor />
        </div>
    );
}
