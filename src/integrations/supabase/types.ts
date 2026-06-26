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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          name: string
          note_id: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          name: string
          note_id: string
          size_bytes?: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          name?: string
          note_id?: string
          size_bytes?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          locked: boolean
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          locked?: boolean
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          locked?: boolean
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      item_attachments: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          mime_type: string
          name: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          mime_type: string
          name: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          mime_type?: string
          name?: string
          size_bytes?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      item_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          item_id: string
          item_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          archived: boolean
          category_id: string | null
          content: string
          created_at: string
          emoji: string | null
          favorite: boolean
          id: string
          pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          category_id?: string | null
          content?: string
          created_at?: string
          emoji?: string | null
          favorite?: boolean
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          category_id?: string | null
          content?: string
          created_at?: string
          emoji?: string | null
          favorite?: boolean
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          language: string
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          language?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          actual_price: number | null
          barcode: string | null
          brand: string | null
          created_at: string
          expected_price: number
          id: string
          image_url: string | null
          notes: string | null
          purchase_list_id: string
          purchased: boolean
          purchased_at: string | null
          quantity: number
          sort_order: number
          store_name: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_price?: number | null
          barcode?: string | null
          brand?: string | null
          created_at?: string
          expected_price?: number
          id?: string
          image_url?: string | null
          notes?: string | null
          purchase_list_id: string
          purchased?: boolean
          purchased_at?: string | null
          quantity?: number
          sort_order?: number
          store_name?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_price?: number | null
          barcode?: string | null
          brand?: string | null
          created_at?: string
          expected_price?: number
          id?: string
          image_url?: string | null
          notes?: string | null
          purchase_list_id?: string
          purchased?: boolean
          purchased_at?: string | null
          quantity?: number
          sort_order?: number
          store_name?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_purchase_list_id_fkey"
            columns: ["purchase_list_id"]
            isOneToOne: false
            referencedRelation: "purchase_list_stats"
            referencedColumns: ["purchase_list_id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_list_id_fkey"
            columns: ["purchase_list_id"]
            isOneToOne: false
            referencedRelation: "purchase_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_lists: {
        Row: {
          budget: number
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          end_date: string | null
          id: string
          notes: string | null
          priority: string
          start_date: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_lists_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          created_at: string
          done: boolean
          due_at: string | null
          id: string
          sort_order: number
          task_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          sort_order?: number
          task_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          sort_order?: number
          task_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklist: {
        Row: {
          created_at: string
          done: boolean
          id: string
          sort_order: number
          task_id: string
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          sort_order?: number
          task_id: string
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          sort_order?: number
          task_id?: string
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          done: boolean
          due_at: string | null
          id: string
          links: string[]
          notes: string | null
          priority: string
          progress: number
          recurrence: string
          reminder_at: string | null
          start_at: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          done?: boolean
          due_at?: string | null
          id?: string
          links?: string[]
          notes?: string | null
          priority?: string
          progress?: number
          recurrence?: string
          reminder_at?: string | null
          start_at?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          done?: boolean
          due_at?: string | null
          id?: string
          links?: string[]
          notes?: string | null
          priority?: string
          progress?: number
          recurrence?: string
          reminder_at?: string | null
          start_at?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      vault_entries: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          label: string
          notes: string
          password_ct: string
          password_iv: string
          updated_at: string
          url: string
          user_id: string
          username: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          label: string
          notes?: string
          password_ct: string
          password_iv: string
          updated_at?: string
          url?: string
          user_id: string
          username?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          label?: string
          notes?: string
          password_ct?: string
          password_iv?: string
          updated_at?: string
          url?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vault_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_settings: {
        Row: {
          created_at: string
          kdf_salt: string
          updated_at: string
          user_id: string
          verifier_ct: string
          verifier_iv: string
        }
        Insert: {
          created_at?: string
          kdf_salt: string
          updated_at?: string
          user_id: string
          verifier_ct: string
          verifier_iv: string
        }
        Update: {
          created_at?: string
          kdf_salt?: string
          updated_at?: string
          user_id?: string
          verifier_ct?: string
          verifier_iv?: string
        }
        Relationships: []
      }
    }
    Views: {
      purchase_list_stats: {
        Row: {
          actual_total: number | null
          expected_total: number | null
          items_count: number | null
          progress: number | null
          purchase_list_id: string | null
          purchased_count: number | null
          remaining_amount: number | null
          user_id: string | null
        }
        Relationships: []
      }
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
    Enums: {},
  },
} as const
