'use client';

import React from 'react';

export function DeveloperFooter() {
    return (
        <footer className="relative mt-16 border-t border-white/10">
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            <div className="relative max-w-4xl mx-auto px-6 py-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    {/* Left: Branding */}
                    <div className="text-center md:text-left">
                        <p className="text-sm text-gray-400">
                            Developed by{' '}
                            <span className="font-semibold text-white">Jay Flores</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            Want the same for your events? Get in touch!
                        </p>
                    </div>

                    {/* Right: Contact Info */}
                    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
                        <a
                            href="mailto:edflores240@gmail.com"
                            className="flex items-center gap-1.5 hover:text-white transition-colors"
                        >
                            <span className="text-base">✉️</span>
                            edflores240@gmail.com
                        </a>
                        <span className="hidden md:inline text-gray-700">|</span>
                        <a
                            href="tel:09480285798"
                            className="flex items-center gap-1.5 hover:text-white transition-colors"
                        >
                            <span className="text-base">📱</span>
                            09480285798
                        </a>
                        <span className="hidden md:inline text-gray-700">|</span>
                        <a
                            href="https://instagram.com/eddyjayflores"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 hover:text-white transition-colors"
                        >
                            <span className="text-base">📸</span>
                            @eddyjayflores
                        </a>
                    </div>
                </div>

                <div className="text-center mt-6">
                    <p className="text-[10px] text-gray-600">
                        © {new Date().getFullYear()} SnapWrap Photo Booth
                    </p>
                </div>
            </div>
        </footer>
    );
}
