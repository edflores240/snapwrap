# Supabase Setup Guide for Camera Booth App

Follow these steps to set up Supabase for your camera booth application.

---

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** or **"Sign In"** if you already have an account
3. Click **"New Project"**
4. Fill in the project details:
   - **Name**: `camera-booth` (or your preferred name)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose the closest region to your users
   - **Pricing Plan**: Free tier works great for this app
5. Click **"Create new project"**
6. Wait 2-3 minutes for the project to initialize

---

## Step 2: Get Your API Credentials

1. Once your project is ready, go to **Settings** → **API**
2. Copy these two values:
   - **Project URL** (under "Project URL")
   - **anon public** key (under "Project API keys")

---

## Step 3: Add Credentials to Your App

1. In your project root (`/Users/jayflores/Documents/camera-booth`), create a `.env.local` file
2. Add your credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Replace `your-project-url-here` and `your-anon-key-here` with the values you copied
4. Save the file

> **Important**: `.env.local` is already in `.gitignore` so your keys won't be committed to version control

---

## Step 4: Create Database Tables

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Copy and paste this SQL:

```sql
-- Create sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed'))
);

-- Create templates table
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  thumbnail_url TEXT,
  overlay_url TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create photos table
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  original_url TEXT,
  final_url TEXT NOT NULL,
  template_id UUID REFERENCES templates(id),
  qr_code_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_photos_session_id ON photos(session_id);
CREATE INDEX idx_photos_created_at ON photos(created_at DESC);
CREATE INDEX idx_templates_active ON templates(is_active) WHERE is_active = true;

-- Enable Row Level Security (RLS)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Create policies (allow public read/write for now - you can restrict later)
CREATE POLICY "Allow public read sessions" ON sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert sessions" ON sessions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read templates" ON templates FOR SELECT USING (is_active = true);

CREATE POLICY "Allow public read photos" ON photos FOR SELECT USING (true);
CREATE POLICY "Allow public insert photos" ON photos FOR INSERT WITH CHECK (true);
```

4. Click **"Run"** to execute the SQL
5. You should see "Success. No rows returned" — this is good!

---

## Step 5: Create Storage Bucket

1. In Supabase dashboard, go to **Storage**
2. Click **"New bucket"**
3. Bucket details:
   - **Name**: `photos`
   - **Public bucket**: Toggle **ON** (so photos are publicly accessible)
4. Click **"Create bucket"**

---

## Step 6: Configure Storage Policies

1. Click on the `photos` bucket you just created
2. Go to **Policies** tab
3. Click **"New policy"**
4. Choose **"For full customization"**
5. Create an upload policy:
   - **Policy name**: `Allow public uploads`
   - **Allowed operation**: `INSERT`
   - **Policy definition**: Use this SQL:
   ```sql
   true
   ```
6. Click **"Review"** then **"Save policy"**

7. Create a read policy:
   - Click **"New policy"** again
   - **Policy name**: `Allow public reads`
   - **Allowed operation**: `SELECT`
   - **Policy definition**:
   ```sql
   true
   ```
8. Click **"Review"** then **"Save policy"**

---

## Step 7: Add Starter Templates (Optional)

1. Go back to **SQL Editor**
2. Insert some starter templates:

```sql
INSERT INTO templates (name, overlay_url, category, thumbnail_url) VALUES
  ('Simple Frame', 'https://placeholder.com/frame1.png', 'basic', 'https://placeholder.com/frame1-thumb.png'),
  ('Birthday Party', 'https://placeholder.com/birthday.png', 'celebration', 'https://placeholder.com/birthday-thumb.png'),
  ('Wedding', 'https://placeholder.com/wedding.png', 'celebration', 'https://placeholder.com/wedding-thumb.png'),
  ('Fun & Funky', 'https://placeholder.com/funky.png', 'fun', 'https://placeholder.com/funky-thumb.png');
```

3. Click **"Run"**

> **Note**: These are placeholder URLs. We'll create actual template overlays later and upload them to Supabase Storage.

---

## Step 8: Verify Everything Works

1. Go to **Table Editor** in Supabase
2. You should see three tables: `sessions`, `templates`, `photos`
3. Click on `templates` — you should see 4 starter templates
4. Go to **Storage** — you should see the `photos` bucket

---

## ✅ Setup Complete!

Your Supabase backend is now ready. The app will:
- Store photo metadata in the `photos` table
- Upload actual images to the `photos` storage bucket
- Use templates from the `templates` table
- Track sessions in the `sessions` table

---

## Next Steps

Once this setup is complete, we'll:
1. Create the Supabase client in the Next.js app
2. Build the UI components
3. Implement camera capture
4. Test the full flow

**Keep your `.env.local` file secure and never commit it to git!**
