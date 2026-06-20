-- Migration: Add follow-up DMs tracking
-- Run this in Supabase SQL Editor if you already ran schema.sql

-- Add follow_up_dms column to daily_logs
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS follow_up_dms INTEGER DEFAULT 0;

-- Add follow-up DM goals
INSERT INTO goals (type, value) VALUES
  ('daily_follow_up_dms', 20),
  ('weekly_follow_up_dms', 100)
ON CONFLICT DO NOTHING;
