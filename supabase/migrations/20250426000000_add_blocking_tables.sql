-- Create the blocked_users table
CREATE TABLE IF NOT EXISTS "public"."blocked_users" (
    "active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "last_updated" timestamptz NOT NULL DEFAULT now(),
    "blocker_id" uuid NOT NULL REFERENCES "public"."profile"("id") ON DELETE CASCADE,
    "blocked_id" uuid NOT NULL REFERENCES "public"."profile"("id") ON DELETE CASCADE,
    PRIMARY KEY ("blocker_id", "blocked_id")
);

-- Create the blocked_content table
CREATE TABLE IF NOT EXISTS "public"."blocked_content" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "last_updated" timestamptz NOT NULL DEFAULT now(),
    "profile_id" uuid NOT NULL REFERENCES "public"."profile"("id") ON DELETE CASCADE,
    "content_id" uuid NOT NULL,
    "content_table" text NOT NULL,
    PRIMARY KEY ("id")
);

-- Create unique constraint for blocked_content to prevent duplicates
CREATE UNIQUE INDEX blocked_content_unique_idx ON "public"."blocked_content" ("profile_id", "content_id", "content_table");

-- Add comment for documentation
COMMENT ON TABLE "public"."blocked_users" IS 'Tracks users who have been blocked by other users';
COMMENT ON TABLE "public"."blocked_content" IS 'Tracks content that has been blocked by users';

-- Set up RLS (Row Level Security)
ALTER TABLE "public"."blocked_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."blocked_content" ENABLE ROW LEVEL SECURITY;

-- Create policies for blocked_users
CREATE POLICY "Users can view their own blocked users" 
    ON "public"."blocked_users" 
    FOR SELECT 
    USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create their own blocks" 
    ON "public"."blocked_users" 
    FOR INSERT 
    WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can update their own blocks" 
    ON "public"."blocked_users" 
    FOR UPDATE 
    USING (auth.uid() = blocker_id);

CREATE POLICY "Users can delete their own blocks" 
    ON "public"."blocked_users" 
    FOR DELETE 
    USING (auth.uid() = blocker_id);

-- Create policies for blocked_content
CREATE POLICY "Users can view their own blocked content" 
    ON "public"."blocked_content" 
    FOR SELECT 
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can create their own content blocks" 
    ON "public"."blocked_content" 
    FOR INSERT 
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own content blocks" 
    ON "public"."blocked_content" 
    FOR UPDATE 
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own content blocks" 
    ON "public"."blocked_content" 
    FOR DELETE 
    USING (auth.uid() = profile_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS blocked_users_blocker_id_idx ON "public"."blocked_users" (blocker_id);
CREATE INDEX IF NOT EXISTS blocked_users_blocked_id_idx ON "public"."blocked_users" (blocked_id);
CREATE INDEX IF NOT EXISTS blocked_content_profile_id_idx ON "public"."blocked_content" (profile_id);
CREATE INDEX IF NOT EXISTS blocked_content_content_idx ON "public"."blocked_content" (content_id);
CREATE INDEX IF NOT EXISTS blocked_content_table_idx ON "public"."blocked_content" (content_table);

alter publication "powersync" add table only "public"."blocked_users";
alter publication "powersync" add table only "public"."blocked_content";