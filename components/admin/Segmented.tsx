'use client';

import React from 'react';

interface Props<T extends string> {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
}

/** Small pill-style choice picker used in the admin settings panels. */
export default function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
    return (
        <div className="space-y-2">
            <label className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">{label}</label>
            <div className="flex flex-wrap gap-1 p-1 bg-[#FAF8F5] border border-[#ECE8DF] rounded-xl">
                {options.map(o => (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onChange(o.value)}
                        className={`flex-1 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                            value === o.value ? 'bg-[#2A2724] text-white shadow-sm' : 'text-neutral-400 hover:text-[#2A2724]'
                        }`}
                    >
                        {o.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
