-- Gunderson & Partners CRM Schema
-- Run this in your Supabase SQL editor

-- Daily activity logs
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  dms_sent INTEGER DEFAULT 0,
  follow_up_dms INTEGER DEFAULT 0,
  calls_booked INTEGER DEFAULT 0,
  calls_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRM Stages (customizable)
CREATE TABLE IF NOT EXISTS stages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default stages
INSERT INTO stages (name, position, color) VALUES
  ('Introduction', 1, '#3B82F6'),
  ('Valuation IP', 2, '#8B5CF6'),
  ('Valuation Accepted', 3, '#F59E0B'),
  ('LOI IP', 4, '#EF4444'),
  ('LOI Accepted', 5, '#10B981')
ON CONFLICT DO NOTHING;

-- Tags (customizable)
CREATE TABLE IF NOT EXISTS tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default tags
INSERT INTO tags (name, color) VALUES
  ('Hot Lead', '#EF4444'),
  ('Cold Lead', '#3B82F6'),
  ('Follow Up', '#F59E0B'),
  ('High Value', '#10B981')
ON CONFLICT DO NOTHING;

-- Deals
CREATE TABLE IF NOT EXISTS deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_name TEXT NOT NULL,
  company TEXT,
  stage_id UUID REFERENCES stages(id),
  tag_ids UUID[] DEFAULT '{}',
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  archived_stage_name TEXT,
  archive_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deal notes (append-only log)
CREATE TABLE IF NOT EXISTS deal_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goals
CREATE TABLE IF NOT EXISTS goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default goals
INSERT INTO goals (type, value) VALUES
  ('daily_dms', 50),
  ('weekly_dms', 250),
  ('daily_follow_up_dms', 20),
  ('weekly_follow_up_dms', 100),
  ('daily_calls_booked', 5),
  ('weekly_calls_booked', 25),
  ('booking_rate', 10)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (open for now — no auth)
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Open policies (single-user app, no auth)
CREATE POLICY "Allow all" ON daily_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON stages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON deals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON deal_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON goals FOR ALL USING (true) WITH CHECK (true);
