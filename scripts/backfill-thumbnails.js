// Generates ~480px thumbnails for photos taken before thumb_url existed.
//
//   node scripts/backfill-thumbnails.js          # do it
//   node scripts/backfill-thumbnails.js --dry    # just count
//
// Needs SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase dashboard > Project Settings > API).
// Safe to re-run: only photos with a null thumb_url are touched.
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const env = {};
fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8').split('\n').forEach(line => {
    const i = line.indexOf('=');
    if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const BUCKET = 'booth-photos';
const BATCH = 50;
const dry = process.argv.includes('--dry');
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
    const { count } = await supabase.from('photos').select('id', { count: 'exact', head: true })
        .is('thumb_url', null).not('image_url', 'is', null);
    console.log(`${count} photo(s) need thumbnails`);
    if (dry || !count) return;

    let done = 0, failed = 0;
    const failedIds = new Set();
    for (;;) {
        const { data: rows, error } = await supabase.from('photos')
            .select('id, image_url, storage_path')
            .is('thumb_url', null).not('image_url', 'is', null)
            .order('created_at').limit(BATCH + failedIds.size);
        if (error) throw error;
        const todo = rows.filter(r => !failedIds.has(r.id)).slice(0, BATCH);
        if (todo.length === 0) break;

        for (const row of todo) {
            try {
                const res = await fetch(row.image_url);
                if (!res.ok) throw new Error(`download ${res.status}`);
                const thumb = await sharp(Buffer.from(await res.arrayBuffer()))
                    .rotate()
                    .resize({ width: 480, withoutEnlargement: true })
                    .jpeg({ quality: 75, mozjpeg: true })
                    .toBuffer();

                // storage_path is "<event-slug>/<file>.jpg"; mirror the booth's "<slug>/thumbs/<id>.jpg"
                const slug = (row.storage_path || '').split('/')[0] || 'legacy';
                const thumbPath = `${slug}/thumbs/${row.id}.jpg`;
                const { error: upErr } = await supabase.storage.from(BUCKET)
                    .upload(thumbPath, thumb, { contentType: 'image/jpeg', upsert: true });
                if (upErr) throw upErr;

                const thumbUrl = supabase.storage.from(BUCKET).getPublicUrl(thumbPath).data.publicUrl;
                const { error: updErr } = await supabase.from('photos').update({ thumb_url: thumbUrl }).eq('id', row.id);
                if (updErr) throw updErr;
                done++;
            } catch (err) {
                failed++;
                failedIds.add(row.id);
                console.error(`  ${row.id}: ${err.message || err}`);
            }
        }
        console.log(`  ${done} done, ${failed} failed`);
    }
    console.log(`Finished: ${done} thumbnails created, ${failed} failed`);
}

main().catch(err => { console.error(err); process.exit(1); });
