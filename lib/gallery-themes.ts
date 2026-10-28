export interface GalleryPalette {
    /** Text, accents, pill and button colour */
    primary: string;
    /** Page background */
    secondary: string;
}

/** Each theme's default colours. These reproduce the look the theme had before colours were configurable. */
export const THEME_PALETTES: Record<string, GalleryPalette> = {
    modern:     { primary: '#171717', secondary: '#FFF8F0' },
    valentine:  { primary: '#8B0000', secondary: '#FFE4E1' },
    minimal:    { primary: '#000000', secondary: '#FFFFFF' },
    dark:       { primary: '#FFFFFF', secondary: '#171717' },
    retro:      { primary: '#2B2B2B', secondary: '#E9E4D9' },
    editorial:  { primary: '#000000', secondary: '#FCFCFC' },
    neon:       { primary: '#FFFFFF', secondary: '#050505' },
    organic:    { primary: '#4A4A4A', secondary: '#F4F1EA' },
    serenity:   { primary: '#A3A3A3', secondary: '#FFFFFF' },
    industrial: { primary: '#E5E5E5', secondary: '#1A1A1A' },
    vibrant:    { primary: '#000000', secondary: '#FFEB3B' },
};

export const GALLERY_THEME_KEYS = Object.keys(THEME_PALETTES);

const same = (a?: string, b?: string) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

/**
 * Colours to render a gallery with. Events saved before the colours were wired up all stored
 * black/white as a placeholder, so that pair (or nothing) means "use the theme's own palette".
 */
export function resolveGalleryColors(theme: string, primary?: string, secondary?: string): GalleryPalette {
    const palette = THEME_PALETTES[theme] ?? THEME_PALETTES.modern;
    const unset = !primary || !secondary || (same(primary, '#000000') && same(secondary, '#ffffff'));
    return unset ? palette : { primary, secondary };
}
