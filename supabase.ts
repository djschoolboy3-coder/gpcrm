import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Stage = {
  id: string
  name: string
  position: number
  color: string
  created_at: string
}

export type Tag = {
  id: string
  name: string
  color: string
  created_at: string
}

export type Deal = {
  id: string
  prospect_name: string
  company: string | null
  stage_id: string | null
  tag_ids: string[]
  is_archived: boolean
  archived_at: string | null
  archived_stage_name: string | null
  archive_reason: string | null
  created_at: string
  updated_at: string
}

export type DealNote = {
  id: string
  deal_id: string
  note: string
  created_at: string
}

export type DailyLog = {
  id: string
  date: string
  dms_sent: number
  follow_up_dms: number
  calls_booked: number
  calls_completed: number
  created_at: string
  updated_at: string
}

export type Goal = {
  id: string
  type: string
  value: number
  updated_at: string
}
