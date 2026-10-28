import Image from 'next/image';

interface LogoProps {
    /** Rendered size in px (the mark is a square) */
    size?: number;
    className?: string;
    priority?: boolean;
}

/** The SnapWrap shutter mark. */
export default function Logo({ size = 32, className = '', priority = false }: LogoProps) {
    return (
        <Image
            src="/logo.jpeg"
            alt="SnapWrap"
            width={size}
            height={size}
            priority={priority}
            className={`rounded-lg shrink-0 ${className}`}
            style={{ width: size, height: size }}
        />
    );
}
