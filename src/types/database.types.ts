export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: 'student' | 'mentor'
          branch: string
          semester: number
          mentor_id: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          full_name: string
          role: 'student' | 'mentor'
          branch: string
          semester: number
          mentor_id?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: 'student' | 'mentor'
          branch?: string
          semester?: number
          mentor_id?: string | null
          avatar_url?: string | null
          created_at?: string
        }
      }
      subjects: {
        Row: {
          id: string
          name: string
          code: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          description?: string | null
          created_at?: string
        }
      }
      classes: {
        Row: {
          id: string
          subject_id: string
          mentor_id: string
          academic_year: string
          semester: number
          created_at: string
        }
        Insert: {
          id?: string
          subject_id: string
          mentor_id: string
          academic_year: string
          semester: number
          created_at?: string
        }
        Update: {
          id?: string
          subject_id?: string
          mentor_id?: string
          academic_year?: string
          semester?: number
          created_at?: string
        }
      }
      enrollments: {
        Row: {
          id: string
          student_id: string
          class_id: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          class_id: string
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          class_id?: string
          created_at?: string
        }
      }
      attendance: {
        Row: {
          id: string
          student_id: string
          class_id: string
          status: 'Present' | 'Absent' | 'Excused'
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          class_id: string
          status: 'Present' | 'Absent' | 'Excused'
          date: string
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          class_id?: string
          status?: 'Present' | 'Absent' | 'Excused'
          date?: string
          created_at?: string
        }
      }
      grades: {
        Row: {
          id: string
          student_id: string
          class_id: string
          internal_marks: number
          external_marks: number
          total_score: number
          grade: string
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          class_id: string
          internal_marks: number
          external_marks: number
          total_score?: number
          grade?: string
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          class_id?: string
          internal_marks?: number
          external_marks?: number
          total_score?: number
          grade?: string
          updated_at?: string
          created_at?: string
        }
      }
      timetables: {
        Row: {
          id: string
          class_id: string
          day_of_week: number
          start_time: string
          end_time: string
          location: string | null
          created_at: string
        }
        Insert: {
          id?: string
          class_id: string
          day_of_week: number
          start_time: string
          end_time: string
          location?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          class_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          location?: string | null
          created_at?: string
        }
      }
      notification_messages: {
        Row: {
          id: string
          title: string
          body: string
          type: string
          deep_link: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          body: string
          type: string
          deep_link?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          body?: string
          type?: string
          deep_link?: string | null
          created_at?: string
        }
      }
      user_notifications: {
        Row: {
          id: string
          user_id: string
          message_id: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message_id: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          message_id?: string
          is_read?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_profile: {
        Args: {
          p_user_id: string
          p_full_name: string
          p_role: string
          p_branch: string
          p_semester: number
        }
        Returns: undefined
      }
      get_attendance_summary: {
        Args: { p_student_id: string }
        Returns: {
          class_id: string
          subject_name: string
          present_count: number
          total_count: number
          percentage: number
        }[]
      }
      mark_notifications_read: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      get_mentor_cohort_summary: {
        Args: { p_mentor_id: string }
        Returns: {
          student_id: string
          full_name: string
          branch: string
          semester: number
          avg_attendance: number
          avg_total_score: number
          failing_subjects: number
          risk_level: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
