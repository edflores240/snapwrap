import React from 'react';

export function GradientBackground({ className = '' }: { className?: string }) {
    return (
        <div className={`fixed inset-0 -z-10 overflow-hidden ${className}`}>
            {/* Base dark background */}
            <div className="absolute inset-0 bg-[#0a0a0a]" />

            {/* Animated gradient orbs */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-float" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />

            {/* Radial gradient overlay */}
            <div className="absolute inset-0 gradient-radial" />

            {/* Noise texture overlay for depth */}
            <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />
        </div>
    );
}
