-- Supabase SQL Schema for LinkedIn AI Auto-Applier

-- 1. user_profile: Stores static resume data
CREATE TABLE IF NOT EXISTS user_profile (
    id UUID PRIMARY KEY DEFAULT auth.uid(),
    full_name TEXT,
    tagline TEXT,
    work_experience JSONB, -- Array of experiences
    education JSONB,       -- Array of education details
    hobbies TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. star_stories: Stores work stories in STAR format
CREATE TABLE IF NOT EXISTS star_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profile(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    situation TEXT,
    task TEXT,
    action TEXT,
    result TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. applications: Tracks applied jobs
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profile(id) ON DELETE CASCADE,
    job_title TEXT NOT NULL,
    company TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Ongoing', -- e.g., 'Ongoing', 'Interview', 'Rejected'
    date_applied TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    url TEXT,
    notes TEXT,
    last_status_update TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. memory_bank: Key-value store for custom application questions
CREATE TABLE IF NOT EXISTS memory_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profile(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, question)
);

-- RLS (Row Level Security) - Ensure users can only access their own data
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_bank ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can only view their own profile" ON user_profile FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can only update their own profile" ON user_profile FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can only view their own star stories" ON star_stories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own star stories" ON star_stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own star stories" ON star_stories FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can only view their own applications" ON applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own applications" ON applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own applications" ON applications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can only view their own memory bank" ON memory_bank FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own memory bank" ON memory_bank FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own memory bank" ON memory_bank FOR UPDATE USING (auth.uid() = user_id);
