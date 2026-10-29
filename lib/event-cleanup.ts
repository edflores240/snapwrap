import { supabase } from './supabase';

const BUCKET = 'booth-photos';
const PAGE = 1000;
const REMOVE_CHUNK = 100;

async function listFolder(folder: string): Promise<string[]> {
    const paths: string[] = [];
    for (let offset = 0; ; offset += PAGE) {
        const { data, error } = await supabase.storage.from(BUCKET).list(folder, { limit: PAGE, offset });
        if (error) throw error;
        if (!data || data.length === 0) break;
        // Sub-folders come back without an id; files have one
        paths.push(...data.filter(f => f.id).map(f => `${folder}/${f.name}`));
        if (data.length < PAGE) break;
    }
    return paths;
}

export interface EventDeleteResult { removedFiles: number }

/**
 * Deletes an event and everything that belongs to it: its stored photos and thumbnails, its photo rows
 * and its config (booth settings, templates, gallery settings live on the event row).
 *
 * Files go first. If they can't be removed the event row is kept, because once it is gone the owner
 * can no longer be matched to the folder and the files would be orphaned for good.
 */
export async function deleteEventCompletely(event: { id: string; slug: string }): Promise<EventDeleteResult> {
    const paths = new Set<string>([
        ...(await listFolder(event.slug)),
        ...(await listFolder(`${event.slug}/thumbs`)),
        // Template images moved out of the event settings
        ...(await listFolder(`${event.slug}/assets`)),
        // Guest camera photos and their thumbnails
        ...(await listFolder(`${event.slug}/guest`)),
        ...(await listFolder(`${event.slug}/guest/thumbs`)),
    ]);

    // Also anything the rows point at, in case a file was stored outside the usual folder
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
            .from('photos')
            .select('storage_path')
            .eq('event_id', event.id)
            .range(from, from + PAGE - 1);
        if (error) throw error;
        (data ?? []).forEach(r => r.storage_path && paths.add(r.storage_path));
        if (!data || data.length < PAGE) break;
    }

    const all = [...paths];
    let removed = 0;
    for (let i = 0; i < all.length; i += REMOVE_CHUNK) {
        const chunk = all.slice(i, i + REMOVE_CHUNK);
        const { data, error } = await supabase.storage.from(BUCKET).remove(chunk);
        if (error) throw error;
        removed += data?.length ?? 0;
    }
    // remove() reports success even when a policy hides the files, so compare what it says it deleted
    if (removed < all.length) {
        throw new Error(
            `Only ${removed} of ${all.length} files could be removed. Apply the latest database migration ` +
            `(storage delete policy) and try again.`,
        );
    }

    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) throw error;
    return { removedFiles: removed };
}
