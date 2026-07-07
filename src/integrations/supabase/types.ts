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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      guardian_patient_links: {
        Row: {
          created_at: string | null
          guardian_id: string
          id: string
          patient_id: string
          permissions: Json | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          guardian_id: string
          id?: string
          patient_id: string
          permissions?: Json | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          guardian_id?: string
          id?: string
          patient_id?: string
          permissions?: Json | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardian_patient_links_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_patient_links_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      link_requests: {
        Row: {
          created_at: string
          guardian_id: string
          id: string
          patient_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          guardian_id: string
          id?: string
          patient_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          guardian_id?: string
          id?: string
          patient_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      medication_logs: {
        Row: {
          actual_time: string | null
          created_at: string | null
          effectiveness_rating: number | null
          id: string
          medication_id: string
          notes: string | null
          patient_id: string
          scheduled_time: string
          side_effects: string | null
          status: Database["public"]["Enums"]["log_status"]
        }
        Insert: {
          actual_time?: string | null
          created_at?: string | null
          effectiveness_rating?: number | null
          id?: string
          medication_id: string
          notes?: string | null
          patient_id: string
          scheduled_time: string
          side_effects?: string | null
          status: Database["public"]["Enums"]["log_status"]
        }
        Update: {
          actual_time?: string | null
          created_at?: string | null
          effectiveness_rating?: number | null
          id?: string
          medication_id?: string
          notes?: string | null
          patient_id?: string
          scheduled_time?: string
          side_effects?: string | null
          status?: Database["public"]["Enums"]["log_status"]
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string | null
          dosage: string
          dose_times: string[] | null
          end_date: string | null
          frequency: Database["public"]["Enums"]["medication_frequency"]
          id: string
          image_url: string | null
          instructions: string | null
          is_active: boolean | null
          name: string
          patient_id: string
          start_date: string
          time: string
          unit: Database["public"]["Enums"]["medication_unit"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dosage: string
          dose_times?: string[] | null
          end_date?: string | null
          frequency: Database["public"]["Enums"]["medication_frequency"]
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_active?: boolean | null
          name: string
          patient_id: string
          start_date: string
          time: string
          unit: Database["public"]["Enums"]["medication_unit"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dosage?: string
          dose_times?: string[] | null
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["medication_frequency"]
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_active?: boolean | null
          name?: string
          patient_id?: string
          start_date?: string
          time?: string
          unit?: Database["public"]["Enums"]["medication_unit"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_verifications: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          last_resend_at: string | null
          otp_hash: string
          resend_count: number | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          last_resend_at?: string | null
          otp_hash: string
          resend_count?: number | null
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          last_resend_at?: string | null
          otp_hash?: string
          resend_count?: number | null
          verified?: boolean | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          healthcare_provider: string | null
          id: string
          last_name: string
          patient_code: string | null
          phone: string | null
          profile_photo_url: string | null
          updated_at: string | null
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          healthcare_provider?: string | null
          id: string
          last_name: string
          patient_code?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          updated_at?: string | null
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          healthcare_provider?: string | null
          id?: string
          last_name?: string
          patient_code?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          subscription: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          subscription: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          subscription?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_adherence_rate: {
        Args: {
          p_end_date?: string
          p_patient_id: string
          p_start_date?: string
        }
        Returns: number
      }
      calculate_current_streak: {
        Args: { p_patient_id: string }
        Returns: number
      }
      cleanup_expired_otps: { Args: never; Returns: undefined }
      create_link_request_by_code: {
        Args: { p_guardian_id: string; p_patient_code: string }
        Returns: string
      }
      generate_patient_code: { Args: never; Returns: string }
      get_guardian_patients_summary: {
        Args: { p_guardian_id: string }
        Returns: {
          adherence_rate: number
          last_update: string
          patient_id: string
          patient_name: string
          today_taken: number
          today_total: number
        }[]
      }
      get_medication_history: {
        Args: {
          p_days_back?: number
          p_medication_id?: string
          p_patient_id: string
        }
        Returns: {
          actual_time: string
          effectiveness_rating: number
          log_id: string
          medication_name: string
          notes: string
          scheduled_time: string
          side_effects: string
          status: Database["public"]["Enums"]["log_status"]
        }[]
      }
      get_todays_schedule: {
        Args: { p_patient_id: string }
        Returns: {
          dosage: string
          image_url: string
          instructions: string
          medication_id: string
          medication_name: string
          scheduled_time: string
          status: Database["public"]["Enums"]["log_status"]
          unit: Database["public"]["Enums"]["medication_unit"]
        }[]
      }
      log_medication_taken: {
        Args: {
          p_actual_time?: string
          p_effectiveness_rating?: number
          p_medication_id: string
          p_notes?: string
          p_patient_id: string
          p_scheduled_time?: string
          p_side_effects?: string
        }
        Returns: string
      }
      send_medication_reminders: { Args: never; Returns: undefined }
    }
    Enums: {
      log_status: "taken" | "missed" | "skipped"
      medication_frequency:
        | "daily"
        | "twice_daily"
        | "three_times_daily"
        | "four_times_daily"
        | "weekly"
        | "as_needed"
      medication_unit:
        | "mg"
        | "ml"
        | "tablet"
        | "capsule"
        | "drops"
        | "spray"
        | "patch"
      user_type: "patient" | "guardian"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      log_status: ["taken", "missed", "skipped"],
      medication_frequency: [
        "daily",
        "twice_daily",
        "three_times_daily",
        "four_times_daily",
        "weekly",
        "as_needed",
      ],
      medication_unit: [
        "mg",
        "ml",
        "tablet",
        "capsule",
        "drops",
        "spray",
        "patch",
      ],
      user_type: ["patient", "guardian"],
    },
  },
} as const
