-- Create user_stickers table for reusable stickers
CREATE TABLE IF NOT EXISTS user_stickers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_user_stickers_user_id ON user_stickers(user_id);

-- RLS Policies
ALTER TABLE user_stickers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own stickers" ON user_stickers;
CREATE POLICY "Users can view own stickers"
    ON user_stickers FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own stickers" ON user_stickers;
CREATE POLICY "Users can insert own stickers"
    ON user_stickers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own stickers" ON user_stickers;
CREATE POLICY "Users can delete own stickers"
    ON user_stickers FOR DELETE
    USING (auth.uid() = user_id);
