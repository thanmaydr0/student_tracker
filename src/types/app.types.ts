import type { Database } from './database.types'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

export interface StudentProfile extends ProfileRow {
  role: 'student'
}

export interface MentorProfile extends ProfileRow {
  role: 'mentor'
}

export interface AttendanceSummary {
  class_id: string
  subject_name: string
  present: number
  total: number
  percentage: number
}

export interface GradeSummary {
  class_id: string
  subject_name: string
  internal: number
  external: number
  total: number
  grade: string
}

export interface PredictionResult {
  predicted_grade: 'A' | 'B' | 'C' | 'D' | 'F'
  risk_level: 'Low' | 'Medium' | 'High'
  suggestions: string[]
  confidence_note: string
}

export interface TimetableSlot {
  id: string
  class_id: string
  subject_name: string
  mentor_name: string
  day_of_week: number
  start_time: string
  end_time: string
  location: string | null
}

export interface NotificationItem {
  id: string
  message_id: string
  title: string
  body: string
  type: string
  deep_link: string | null
  is_read: boolean
  created_at: string
}
