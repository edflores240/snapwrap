// Shared by the server pages and their client components. These must not live in a 'use client'
// file: the server only sees a reference to a client module's exports, not the values.
export const GALLERY_PAGE_SIZE = 24;
export const GALLERY_PHOTO_COLUMNS = 'id, image_url, thumb_url, created_at';

export const CAROUSEL_MAX_PHOTOS = 60;
export const CAROUSEL_PHOTO_COLUMNS = 'id, image_url, thumb_url, created_at, is_published';
