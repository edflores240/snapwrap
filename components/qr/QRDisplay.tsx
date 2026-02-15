'use client';

import React from 'react';
import QRCodeSVG from 'react-qr-code';
import { Card } from '@/components/ui/Card';

interface QRDisplayProps {
    downloadUrl: string;
    photoUrl: string;
}

export function QRDisplay({ downloadUrl, photoUrl }: QRDisplayProps) {
    return (
        <div className="space-y-8">
            {/* QR Code Card */}
            <Card className="text-center p-12">
                <h3 className="text-3xl font-bold mb-6">
                    📱 Scan to Download
                </h3>

                {/* QR Code */}
                <div className="inline-block p-6 bg-white rounded-2xl">
                    <QRCodeSVG
                        value={downloadUrl}
                        size={256}
                        level="H"
                    />
                </div>

                <p className="text-gray-400 mt-6">
                    Scan this QR code with your phone camera to download your photo
                </p>
            </Card>

            {/* Photo Preview */}
            <Card>
                <div className="aspect-video rounded-2xl overflow-hidden">
                    <img
                        src={photoUrl}
                        alt="Your photo"
                        className="w-full h-full object-cover"
                    />
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-4">
                    <a
                        href={photoUrl}
                        download="snapwrap-photo.png"
                        className="flex-1"
                    >
                        <button className="w-full gradient-primary text-white font-semibold rounded-2xl px-6 py-3 hover-lift">
                            💾 Download Now
                        </button>
                    </a>
                    <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                    >
                        <button className="w-full glass border-glow text-white font-semibold rounded-2xl px-6 py-3 hover-lift">
                            🔗 Open Link
                        </button>
                    </a>
                </div>
            </Card>
        </div>
    );
}
