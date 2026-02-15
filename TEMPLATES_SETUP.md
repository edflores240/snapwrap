# Adding Template Overlays to SnapWrap

This guide shows you how to add the generated template overlays to your Supabase database.

## Step 1: Upload Templates to Supabase Storage

1. Go to your Supabase dashboard
2. Navigate to **Storage** → `photos` bucket
3. Create a new folder called `templates`
4. Upload the template PNG files from `public/templates/`:
   - `simple-frame.png`
   - `birthday-party.png`

5. After uploading, click on each file and copy its **Public URL**

## Step 2: Add Templates to Database

1. Go to **SQL Editor** in Supabase
2. Run this SQL to add the templates:

```sql
-- Simple Frame Template
INSERT INTO templates (name, category, overlay_url, thumbnail_url, is_active) VALUES (
  'Simple Frame',
  'basic',
  'https://YOUR-PROJECT.supabase.co/storage/v1/object/public/photos/templates/simple-frame.png',
  'https://YOUR-PROJECT.supabase.co/storage/v1/object/public/photos/templates/simple-frame.png',
  true
);

-- Birthday Party Template
INSERT INTO templates (name, category, overlay_url, thumbnail_url, is_active) VALUES (
  'Birthday Party',
  'celebration',
  'https://YOUR-PROJECT.supabase.co/storage/v1/object/public/photos/templates/birthday-party.png',
  'https://YOUR-PROJECT.supabase.co/storage/v1/object/public/photos/templates/birthday-party.png',
  true
);
```

3. **Replace** `YOUR-PROJECT.supabase.co` with your actual Supabase URL
4. Click **Run**

## Alternative: Upload via Supabase Client

You can also use the Supabase JavaScript client to upload programmatically. Create a new file `scripts/upload-templates.js`:

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function uploadTemplates() {
  const templates = [
    { name: 'Simple Frame', category: 'basic', file: 'simple-frame.png' },
    { name: 'Birthday Party', category: 'celebration', file: 'birthday-party.png' }
  ];

  for (const template of templates) {
    const filePath = path.join(__dirname, '..', 'public', 'templates', template.file);
    const fileBuffer = fs.readFileSync(filePath);

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('photos')
      .upload(`templates/${template.file}`, fileBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error(`Error uploading ${template.name}:`, uploadError);
      continue;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('photos')
      .getPublicUrl(`templates/${template.file}`);

    // Insert into database
    const { error: dbError } = await supabase
      .from('templates')
      .insert({
        name: template.name,
        category: template.category,
        overlay_url: urlData.publicUrl,
        thumbnail_url: urlData.publicUrl,
        is_active: true
      });

    if (dbError) {
      console.error(`Error inserting ${template.name}:`, dbError);
    } else {
      console.log(`✅ ${template.name} uploaded successfully`);
    }
  }
}

uploadTemplates();
```

Run it with:
```bash
node scripts/upload-templates.js
```

## Verify

1. Go to **Table Editor** → `templates` in Supabase
2. You should see 2 templates listed
3. Visit your app at `/booth/templates` to see them in action!

---

**Note**: The template images are stored in `public/templates/` for reference. You can create more custom overlays and follow the same process to add them.
