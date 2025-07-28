export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      ai_performance_metrics: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          measured_at: string
          metric_type: string
          metric_value: number
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          measured_at?: string
          metric_type: string
          metric_value: number
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          measured_at?: string
          metric_type?: string
          metric_value?: number
        }
        Relationships: []
      }
      ai_responses: {
        Row: {
          confidence_score: number | null
          created_at: string
          created_by: string | null
          email_id: number
          id: string
          is_sent: boolean | null
          language: string
          response_content: string
          tone: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          email_id: number
          id?: string
          is_sent?: boolean | null
          language?: string
          response_content: string
          tone?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          email_id?: number
          id?: string
          is_sent?: boolean | null
          language?: string
          response_content?: string
          tone?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_responses_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "email_history"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_intelligence: {
        Row: {
          ai_summary: string | null
          business_patterns: Json | null
          communication_style: Json | null
          created_at: string
          customer_id: number
          decision_factors: Json | null
          id: string
          last_analysis: string
          lifetime_value: number | null
          next_best_action: string | null
          opportunity_score: number | null
          price_sensitivity: string | null
          risk_score: number | null
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          business_patterns?: Json | null
          communication_style?: Json | null
          created_at?: string
          customer_id: number
          decision_factors?: Json | null
          id?: string
          last_analysis?: string
          lifetime_value?: number | null
          next_best_action?: string | null
          opportunity_score?: number | null
          price_sensitivity?: string | null
          risk_score?: number | null
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          business_patterns?: Json | null
          communication_style?: Json | null
          created_at?: string
          customer_id?: number
          decision_factors?: Json | null
          id?: string
          last_analysis?: string
          lifetime_value?: number | null
          next_best_action?: string | null
          opportunity_score?: number | null
          price_sensitivity?: string | null
          risk_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_intelligence_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          brand: string | null
          company: string | null
          created_at: string | null
          email: string
          id: number
          name: string
          phone: string | null
          teamleader_id: string | null
        }
        Insert: {
          brand?: string | null
          company?: string | null
          created_at?: string | null
          email: string
          id?: number
          name: string
          phone?: string | null
          teamleader_id?: string | null
        }
        Update: {
          brand?: string | null
          company?: string | null
          created_at?: string | null
          email?: string
          id?: number
          name?: string
          phone?: string | null
          teamleader_id?: string | null
        }
        Relationships: []
      }
      email_accounts: {
        Row: {
          access_token: string
          backfill_enabled: boolean | null
          backfill_end_date: string | null
          backfill_start_date: string | null
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          last_backfill_timestamp: string | null
          last_quota_reset: string | null
          last_sync_error: string | null
          last_sync_timestamp: string | null
          provider: string
          quota_usage: number | null
          refresh_token: string | null
          sync_error_count: number | null
          sync_status: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          backfill_enabled?: boolean | null
          backfill_end_date?: string | null
          backfill_start_date?: string | null
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          last_backfill_timestamp?: string | null
          last_quota_reset?: string | null
          last_sync_error?: string | null
          last_sync_timestamp?: string | null
          provider: string
          quota_usage?: number | null
          refresh_token?: string | null
          sync_error_count?: number | null
          sync_status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          backfill_enabled?: boolean | null
          backfill_end_date?: string | null
          backfill_start_date?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          last_backfill_timestamp?: string | null
          last_quota_reset?: string | null
          last_sync_error?: string | null
          last_sync_timestamp?: string | null
          provider?: string
          quota_usage?: number | null
          refresh_token?: string | null
          sync_error_count?: number | null
          sync_status?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_analytics: {
        Row: {
          analysis_timestamp: string
          batch_id: string | null
          created_at: string
          email_id: number
          entities: Json | null
          id: string
          intent: string
          intent_confidence: number | null
          key_phrases: Json | null
          language: string
          sentiment: string
          sentiment_score: number | null
          urgency: string
        }
        Insert: {
          analysis_timestamp?: string
          batch_id?: string | null
          created_at?: string
          email_id: number
          entities?: Json | null
          id?: string
          intent?: string
          intent_confidence?: number | null
          key_phrases?: Json | null
          language?: string
          sentiment?: string
          sentiment_score?: number | null
          urgency?: string
        }
        Update: {
          analysis_timestamp?: string
          batch_id?: string | null
          created_at?: string
          email_id?: number
          entities?: Json | null
          id?: string
          intent?: string
          intent_confidence?: number | null
          key_phrases?: Json | null
          language?: string
          sentiment?: string
          sentiment_score?: number | null
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_analytics_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: true
            referencedRelation: "email_history"
            referencedColumns: ["id"]
          },
        ]
      }
      email_backfill_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          email_account_id: string
          emails_processed: number | null
          end_date: string
          error_message: string | null
          id: string
          quota_used: number | null
          start_date: string
          status: string
          total_estimated: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          email_account_id: string
          emails_processed?: number | null
          end_date: string
          error_message?: string | null
          id?: string
          quota_used?: number | null
          start_date: string
          status?: string
          total_estimated?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          email_account_id?: string
          emails_processed?: number | null
          end_date?: string
          error_message?: string | null
          id?: string
          quota_used?: number | null
          start_date?: string
          status?: string
          total_estimated?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_backfill_progress_email_account_id_fkey"
            columns: ["email_account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_history: {
        Row: {
          analysis_status: string | null
          attachments: Json | null
          body: string | null
          brand: string | null
          created_at: string | null
          customer_id: number | null
          direction: string | null
          external_id: string | null
          from_address: string | null
          id: number
          last_analyzed: string | null
          processed: boolean | null
          received_at: string | null
          subject: string | null
          thread_id: string | null
          to_address: string | null
        }
        Insert: {
          analysis_status?: string | null
          attachments?: Json | null
          body?: string | null
          brand?: string | null
          created_at?: string | null
          customer_id?: number | null
          direction?: string | null
          external_id?: string | null
          from_address?: string | null
          id?: number
          last_analyzed?: string | null
          processed?: boolean | null
          received_at?: string | null
          subject?: string | null
          thread_id?: string | null
          to_address?: string | null
        }
        Update: {
          analysis_status?: string | null
          attachments?: Json | null
          body?: string | null
          brand?: string | null
          created_at?: string | null
          customer_id?: number | null
          direction?: string | null
          external_id?: string | null
          from_address?: string | null
          id?: number
          last_analyzed?: string | null
          processed?: boolean | null
          received_at?: string | null
          subject?: string | null
          thread_id?: string | null
          to_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_processing_jobs: {
        Row: {
          batch_size: number | null
          created_at: string
          emails_processed: number | null
          end_time: string | null
          error_count: number | null
          error_details: Json | null
          id: string
          job_type: string
          start_time: string | null
          status: string
          success_count: number | null
          updated_at: string
        }
        Insert: {
          batch_size?: number | null
          created_at?: string
          emails_processed?: number | null
          end_time?: string | null
          error_count?: number | null
          error_details?: Json | null
          id?: string
          job_type: string
          start_time?: string | null
          status?: string
          success_count?: number | null
          updated_at?: string
        }
        Update: {
          batch_size?: number | null
          created_at?: string
          emails_processed?: number | null
          end_time?: string | null
          error_count?: number | null
          error_details?: Json | null
          id?: string
          job_type?: string
          start_time?: string | null
          status?: string
          success_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      email_template_performance: {
        Row: {
          conversions: number | null
          created_at: string | null
          date: string | null
          emails_clicked: number | null
          emails_opened: number | null
          emails_sent: number | null
          id: string
          template_id: string
        }
        Insert: {
          conversions?: number | null
          created_at?: string | null
          date?: string | null
          emails_clicked?: number | null
          emails_opened?: number | null
          emails_sent?: number | null
          id?: string
          template_id: string
        }
        Update: {
          conversions?: number | null
          created_at?: string | null
          date?: string | null
          emails_clicked?: number | null
          emails_opened?: number | null
          emails_sent?: number | null
          id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_template_performance_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_versions: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          subject: string
          template_id: string
          variables: Json | null
          version: number
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          subject: string
          template_id: string
          variables?: Json | null
          version: number
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          subject?: string
          template_id?: string
          variables?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          ab_test_group: string | null
          brand: string
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_ab_test: boolean | null
          is_active: boolean | null
          language: Database["public"]["Enums"]["supported_language"]
          name: string
          subject: string
          type: Database["public"]["Enums"]["email_template_type"]
          updated_at: string | null
          variables: Json | null
          version: number | null
        }
        Insert: {
          ab_test_group?: string | null
          brand: string
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_ab_test?: boolean | null
          is_active?: boolean | null
          language?: Database["public"]["Enums"]["supported_language"]
          name: string
          subject: string
          type: Database["public"]["Enums"]["email_template_type"]
          updated_at?: string | null
          variables?: Json | null
          version?: number | null
        }
        Update: {
          ab_test_group?: string | null
          brand?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_ab_test?: boolean | null
          is_active?: boolean | null
          language?: Database["public"]["Enums"]["supported_language"]
          name?: string
          subject?: string
          type?: Database["public"]["Enums"]["email_template_type"]
          updated_at?: string | null
          variables?: Json | null
          version?: number | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number | null
          created_at: string | null
          customer_id: number | null
          due_date: string | null
          id: number
          invoice_number: string
          quote_id: number | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          customer_id?: number | null
          due_date?: string | null
          id?: number
          invoice_number: string
          quote_id?: number | null
          status?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          customer_id?: number | null
          due_date?: string | null
          id?: number
          invoice_number?: string
          quote_id?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string | null
          customer_id: number | null
          discount: number | null
          id: number
          items: Json | null
          pdf_url: string | null
          quote_number: string
          status: string | null
          total_price: number | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: number | null
          discount?: number | null
          id?: number
          items?: Json | null
          pdf_url?: string | null
          quote_number: string
          status?: string | null
          total_price?: number | null
        }
        Update: {
          created_at?: string | null
          customer_id?: number | null
          discount?: number | null
          id?: number
          items?: Json | null
          pdf_url?: string | null
          quote_number?: string
          status?: string | null
          total_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_date_range_processed: {
        Args: { p_account_id: string; p_start_date: string; p_end_date: string }
        Returns: boolean
      }
      start_email_processing: {
        Args: { p_job_type: string; p_batch_size?: number }
        Returns: string
      }
      update_processing_job: {
        Args: {
          p_job_id: string
          p_status: string
          p_emails_processed?: number
          p_success_count?: number
          p_error_count?: number
          p_error_details?: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      email_template_type:
        | "new_quote"
        | "follow_up"
        | "quote_accepted"
        | "invoice"
      supported_language: "en" | "de" | "fr" | "nl"
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
      email_template_type: [
        "new_quote",
        "follow_up",
        "quote_accepted",
        "invoice",
      ],
      supported_language: ["en", "de", "fr", "nl"],
    },
  },
} as const
