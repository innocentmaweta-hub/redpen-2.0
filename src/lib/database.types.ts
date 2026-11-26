export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_grading_runs: {
        Row: {
          assessment_id: string | null
          batch_job_id: string | null
          created_at: string
          error_message: string | null
          id: string
          input_summary: Json
          model: string
          output_summary: Json
          owner_id: string
          provider: string
          status: string
        }
        Insert: {
          assessment_id?: string | null
          batch_job_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_summary?: Json
          model: string
          output_summary?: Json
          owner_id: string
          provider: string
          status: string
        }
        Update: {
          assessment_id?: string | null
          batch_job_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_summary?: Json
          model?: string
          output_summary?: Json
          owner_id?: string
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_grading_runs_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_grading_runs_batch_job_id_fkey"
            columns: ["batch_job_id"]
            isOneToOne: false
            referencedRelation: "batch_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          answer_paper_path: string | null
          assessed_at: string
          course_id: string | null
          created_at: string
          id: string
          marking_scheme_path: string | null
          owner_id: string
          paper_filename: string | null
          status: string
          student_id: string | null
          workbook_id: string | null
        }
        Insert: {
          answer_paper_path?: string | null
          assessed_at?: string
          course_id?: string | null
          created_at?: string
          id?: string
          marking_scheme_path?: string | null
          owner_id: string
          paper_filename?: string | null
          status?: string
          student_id?: string | null
          workbook_id?: string | null
        }
        Update: {
          answer_paper_path?: string | null
          assessed_at?: string
          course_id?: string | null
          created_at?: string
          id?: string
          marking_scheme_path?: string | null
          owner_id?: string
          paper_filename?: string | null
          status?: string
          student_id?: string | null
          workbook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_workbook_id_fkey"
            columns: ["workbook_id"]
            isOneToOne: false
            referencedRelation: "workbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_job_files: {
        Row: {
          batch_job_id: string
          created_at: string
          detected_student_name: string | null
          error_message: string | null
          file_size_bytes: number
          id: string
          original_filename: string
          owner_id: string
          status: string
          storage_path: string
        }
        Insert: {
          batch_job_id: string
          created_at?: string
          detected_student_name?: string | null
          error_message?: string | null
          file_size_bytes?: number
          id?: string
          original_filename: string
          owner_id: string
          status?: string
          storage_path: string
        }
        Update: {
          batch_job_id?: string
          created_at?: string
          detected_student_name?: string | null
          error_message?: string | null
          file_size_bytes?: number
          id?: string
          original_filename?: string
          owner_id?: string
          status?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_job_files_batch_job_id_fkey"
            columns: ["batch_job_id"]
            isOneToOne: false
            referencedRelation: "batch_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_jobs: {
        Row: {
          completed_files: number
          course_id: string | null
          created_at: string
          id: string
          marking_scheme_path: string | null
          owner_id: string
          status: string
          total_files: number
          updated_at: string
          workbook_id: string | null
        }
        Insert: {
          completed_files?: number
          course_id?: string | null
          created_at?: string
          id?: string
          marking_scheme_path?: string | null
          owner_id: string
          status?: string
          total_files?: number
          updated_at?: string
          workbook_id?: string | null
        }
        Update: {
          completed_files?: number
          course_id?: string | null
          created_at?: string
          id?: string
          marking_scheme_path?: string | null
          owner_id?: string
          status?: string
          total_files?: number
          updated_at?: string
          workbook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_jobs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_jobs_workbook_id_fkey"
            columns: ["workbook_id"]
            isOneToOne: false
            referencedRelation: "workbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          academic_year: string | null
          code: string
          created_at: string
          id: string
          name: string
          owner_id: string
          term: string | null
          updated_at: string
          workbook_id: string
        }
        Insert: {
          academic_year?: string | null
          code?: string
          created_at?: string
          id?: string
          name: string
          owner_id: string
          term?: string | null
          updated_at?: string
          workbook_id: string
        }
        Update: {
          academic_year?: string | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          term?: string | null
          updated_at?: string
          workbook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_workbook_id_fkey"
            columns: ["workbook_id"]
            isOneToOne: false
            referencedRelation: "workbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      grading_results: {
        Row: {
          assessment_id: string
          created_at: string
          feedback: string
          grade: string
          id: string
          maximum_score: number
          owner_id: string
          paper_annotations: Json
          percentage: number
          question_scores: Json
          score: number
        }
        Insert: {
          assessment_id: string
          created_at?: string
          feedback?: string
          grade?: string
          id?: string
          maximum_score?: number
          owner_id: string
          paper_annotations?: Json
          percentage?: number
          question_scores?: Json
          score?: number
        }
        Update: {
          assessment_id?: string
          created_at?: string
          feedback?: string
          grade?: string
          id?: string
          maximum_score?: number
          owner_id?: string
          paper_annotations?: Json
          percentage?: number
          question_scores?: Json
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "grading_results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: true
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_memberships: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          member_role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          member_role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          member_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_memberships_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          institution_name: string | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          institution_name?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          institution_name?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          class_name: string | null
          created_at: string
          full_name: string
          id: string
          owner_id: string
          student_number: string | null
        }
        Insert: {
          class_name?: string | null
          created_at?: string
          full_name: string
          id?: string
          owner_id: string
          student_number?: string | null
        }
        Update: {
          class_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
          owner_id?: string
          student_number?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          preferences?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workbooks: {
        Row: {
          created_at: string
          id: string
          institution_id: string | null
          institution_name: string | null
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workbooks_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_snapshots: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
