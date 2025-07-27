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
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
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
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
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
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
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
      email_history: {
        Row: {
          attachments: Json | null
          body: string | null
          brand: string | null
          created_at: string | null
          customer_id: number | null
          direction: string | null
          external_id: string | null
          from_address: string | null
          id: number
          processed: boolean | null
          received_at: string | null
          subject: string | null
          thread_id: string | null
          to_address: string | null
        }
        Insert: {
          attachments?: Json | null
          body?: string | null
          brand?: string | null
          created_at?: string | null
          customer_id?: number | null
          direction?: string | null
          external_id?: string | null
          from_address?: string | null
          id?: number
          processed?: boolean | null
          received_at?: string | null
          subject?: string | null
          thread_id?: string | null
          to_address?: string | null
        }
        Update: {
          attachments?: Json | null
          body?: string | null
          brand?: string | null
          created_at?: string | null
          customer_id?: number | null
          direction?: string | null
          external_id?: string | null
          from_address?: string | null
          id?: number
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
      [_ in never]: never
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
