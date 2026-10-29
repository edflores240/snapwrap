import { resolveGalleryColors } from './gallery-themes';

/**
 * One colour scheme per event, edited above the admin tabs and used by every page: photo booth,
 * public gallery, guest camera and album.
 *
 * It's saved as config.colorScheme. For events that never set one, the colours the gallery already
 * had (publicPage) and the booth tint (boothSettings.themeColor) are used, so nothing changes until
 * someone picks a scheme. Saving a scheme also writes those older fields, so every existing page
 * that reads them follows along.
 */

export interface ColorScheme {
    /** Name of the preset the colours started from; informational only */
    preset: string;
    /** Text, buttons and accents */
    primary: string;
    /** Page background */
    secondary: string;
}

type Config = Record<string, any> | null | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface EventTheme extends ColorScheme {
    /** The gallery's design style (fonts and layout), e.g. "modern" or "editorial" */
    galleryStyle: string;
}

export function resolveEventTheme(config: Config): EventTheme {
    const scheme = config?.colorScheme;
    const gallery = config?.publicPage ?? {};
    const preset = scheme?.preset ?? gallery.themeStyle ?? 'modern';
    const colors = resolveGalleryColors(preset, scheme?.primary ?? gallery.primaryColor, scheme?.secondary ?? gallery.secondaryColor);
    // Events with no scheme keep their booth tint as the primary colour
    const primary = !scheme && !gallery.primaryColor && config?.boothSettings?.themeColor ? config.boothSettings.themeColor : colors.primary;
    return { preset, primary, secondary: colors.secondary, galleryStyle: gallery.themeStyle ?? 'modern' };
}

/** Returns a copy of the config with the scheme saved and mirrored into the fields older pages read */
export function applyColorScheme(config: Config, scheme: ColorScheme): Record<string, any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    return {
        ...(config ?? {}),
        colorScheme: scheme,
        publicPage: { ...(config?.publicPage ?? {}), primaryColor: scheme.primary, secondaryColor: scheme.secondary },
        boothSettings: { ...(config?.boothSettings ?? {}), themeColor: scheme.primary },
    };
}

const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) || 0;

/** 0 (black) to 1 (white) perceived brightness of a #rrggbb colour */
export function brightness(hex: string): number {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return 0;
    return (channel(hex, 0) * 299 + channel(hex, 1) * 587 + channel(hex, 2) * 114) / 255000;
}

/** Black or white, whichever reads on top of `hex` */
export const contrastOn = (hex: string) => (brightness(hex) >= 0.5 ? '#000000' : '#ffffff');

/**
 * A colour that stays visible on a dark screen such as the camera: the primary colour when it's
 * bright enough, otherwise the secondary one, otherwise white.
 */
export function accentOnDark(theme: ColorScheme): string {
    if (brightness(theme.primary) > 0.28) return theme.primary;
    if (brightness(theme.secondary) > 0.28) return theme.secondary;
    return '#ffffff';
}
