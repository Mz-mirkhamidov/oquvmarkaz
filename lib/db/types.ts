/**
 * Generated from the live Qalqon Supabase project (mxxsmgkpdgdexodvdpzb)
 * via mcp__Supabase__generate_typescript_types after applying migrations
 * 0001-0007. Regenerate the same way after any future migration:
 *   mcp__Supabase__generate_typescript_types({ project_id: "mxxsmgkpdgdexodvdpzb" })
 * and paste the `Database` type (plus helpers) back in below.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          created_at: string
          failed_pin_count: number
          full_name: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          locked_until: string | null
          org_id: string
          pin_hash: string | null
          pin_set_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          telegram_id: number | null
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          failed_pin_count?: number
          full_name: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          locked_until?: string | null
          org_id: string
          pin_hash?: string | null
          pin_set_at?: string | null
          role: Database["public"]["Enums"]["user_role"]
          telegram_id?: number | null
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          failed_pin_count?: number
          full_name?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          locked_until?: string | null
          org_id?: string
          pin_hash?: string | null
          pin_set_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          telegram_id?: number | null
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_days: {
        Row: {
          absent_count: number
          closed_at: string | null
          closed_by: string | null
          created_at: string
          day_date: string
          day_seal: string | null
          id: string
          opened_at: string
          org_id: string
          present_count: number
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          sealed_at: string | null
          status: Database["public"]["Enums"]["day_status"]
          total_count: number
        }
        Insert: {
          absent_count?: number
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          day_date: string
          day_seal?: string | null
          id?: string
          opened_at?: string
          org_id: string
          present_count?: number
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          sealed_at?: string | null
          status?: Database["public"]["Enums"]["day_status"]
          total_count?: number
        }
        Update: {
          absent_count?: number
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          day_date?: string
          day_seal?: string | null
          id?: string
          opened_at?: string
          org_id?: string
          present_count?: number
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          sealed_at?: string | null
          status?: Database["public"]["Enums"]["day_status"]
          total_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_days_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_days_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_days_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_photos: {
        Row: {
          bytes: number
          child_id: string
          height: number | null
          id: string
          is_thumbnail_only: boolean
          org_id: string
          purge_after: string | null
          record_id: string
          sha256: string
          storage_path: string
          taken_at: string
          uploaded_at: string
          width: number | null
        }
        Insert: {
          bytes: number
          child_id: string
          height?: number | null
          id: string
          is_thumbnail_only?: boolean
          org_id: string
          purge_after?: string | null
          record_id: string
          sha256: string
          storage_path: string
          taken_at: string
          uploaded_at?: string
          width?: number | null
        }
        Update: {
          bytes?: number
          child_id?: string
          height?: number | null
          id?: string
          is_thumbnail_only?: boolean
          org_id?: string
          purge_after?: string | null
          record_id?: string
          sha256?: string
          storage_path?: string
          taken_at?: string
          uploaded_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_photos_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_photos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_photos_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: true
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          child_id: string
          client_marked_at: string | null
          correction_note: string | null
          created_at: string
          day_id: string
          device_id: string | null
          id: string
          is_current: boolean
          marked_at: string
          marked_by: string | null
          note: string | null
          org_id: string
          status: Database["public"]["Enums"]["attend_status"]
          supersedes_id: string | null
        }
        Insert: {
          child_id: string
          client_marked_at?: string | null
          correction_note?: string | null
          created_at?: string
          day_id: string
          device_id?: string | null
          id: string
          is_current?: boolean
          marked_at?: string
          marked_by?: string | null
          note?: string | null
          org_id: string
          status: Database["public"]["Enums"]["attend_status"]
          supersedes_id?: string | null
        }
        Update: {
          child_id?: string
          client_marked_at?: string | null
          correction_note?: string | null
          created_at?: string
          day_id?: string
          device_id?: string | null
          id?: string
          is_current?: boolean
          marked_at?: string
          marked_by?: string | null
          note?: string | null
          org_id?: string
          status?: Database["public"]["Enums"]["attend_status"]
          supersedes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "attendance_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          ip: unknown | null
          org_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: number
          ip?: unknown | null
          org_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: number
          ip?: unknown | null
          org_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      children: {
        Row: {
          avatar_path: string | null
          birth_date: string | null
          created_at: string
          enrolled_at: string
          full_name: string
          gender: string | null
          group_id: string | null
          id: string
          is_active: boolean
          is_subsidized: boolean
          left_at: string | null
          monthly_fee: number | null
          org_id: string
          parent_name: string | null
          parent_phone: string | null
          photo_consent: boolean
          photo_consent_at: string | null
          photo_consent_by: string | null
          state_system_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          birth_date?: string | null
          created_at?: string
          enrolled_at?: string
          full_name: string
          gender?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_subsidized?: boolean
          left_at?: string | null
          monthly_fee?: number | null
          org_id: string
          parent_name?: string | null
          parent_phone?: string | null
          photo_consent?: boolean
          photo_consent_at?: string | null
          photo_consent_by?: string | null
          state_system_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          birth_date?: string | null
          created_at?: string
          enrolled_at?: string
          full_name?: string
          gender?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          is_subsidized?: boolean
          left_at?: string | null
          monthly_fee?: number | null
          org_id?: string
          parent_name?: string | null
          parent_phone?: string | null
          photo_consent?: boolean
          photo_consent_at?: string | null
          photo_consent_by?: string | null
          state_system_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_photo_consent_by_fkey"
            columns: ["photo_consent_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          device_key: string
          id: string
          is_blocked: boolean
          label: string | null
          last_seen_at: string | null
          org_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          device_key: string
          id?: string
          is_blocked?: boolean
          label?: string | null
          last_seen_at?: string | null
          org_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          device_key?: string
          id?: string
          is_blocked?: boolean
          label?: string | null
          last_seen_at?: string | null
          org_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_items: {
        Row: {
          check_id: string
          dispute_id: string
        }
        Insert: {
          check_id: string
          dispute_id: string
        }
        Update: {
          check_id?: string
          dispute_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_items_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "state_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_items_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          affected_children: number
          affected_days: number
          bundle_code: string | null
          bundle_path: string | null
          created_at: string
          created_by: string | null
          estimated_amount: number | null
          id: string
          org_id: string
          period_month: string
          response_note: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          submitted_at: string | null
          submitted_to: string | null
          title: string
          updated_at: string
        }
        Insert: {
          affected_children?: number
          affected_days?: number
          bundle_code?: string | null
          bundle_path?: string | null
          created_at?: string
          created_by?: string | null
          estimated_amount?: number | null
          id?: string
          org_id: string
          period_month: string
          response_note?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          submitted_at?: string | null
          submitted_to?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          affected_children?: number
          affected_days?: number
          bundle_code?: string | null
          bundle_path?: string | null
          created_at?: string
          created_by?: string | null
          estimated_amount?: number | null
          id?: string
          org_id?: string
          period_month?: string
          response_note?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          submitted_at?: string | null
          submitted_to?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          sort_order: number
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          sort_order?: number
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          sort_order?: number
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempts: number
          child_id: string | null
          created_at: string
          id: number
          kind: string
          last_error: string | null
          org_id: string
          parent_id: string | null
          payload: Json
          scheduled_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["outbox_status"]
        }
        Insert: {
          attempts?: number
          child_id?: string | null
          created_at?: string
          id?: number
          kind: string
          last_error?: string | null
          org_id: string
          parent_id?: string | null
          payload: Json
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbox_status"]
        }
        Update: {
          attempts?: number
          child_id?: string | null
          created_at?: string
          id?: number
          kind?: string
          last_error?: string | null
          org_id?: string
          parent_id?: string | null
          payload?: Json
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbox_status"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          capacity: number | null
          created_at: string
          day_close_hour: number
          default_fee: number | null
          district: string | null
          id: string
          is_active: boolean
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          phone: string | null
          photo_required: boolean
          plan: string
          region: string | null
          slug: string | null
          subsidy_enabled: boolean
          timezone: string
          trial_ends_at: string
          updated_at: string
          work_days: number[]
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          created_at?: string
          day_close_hour?: number
          default_fee?: number | null
          district?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          phone?: string | null
          photo_required?: boolean
          plan?: string
          region?: string | null
          slug?: string | null
          subsidy_enabled?: boolean
          timezone?: string
          trial_ends_at?: string
          updated_at?: string
          work_days?: number[]
        }
        Update: {
          address?: string | null
          capacity?: number | null
          created_at?: string
          day_close_hour?: number
          default_fee?: number | null
          district?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_type?: Database["public"]["Enums"]["org_type"]
          phone?: string | null
          photo_required?: boolean
          plan?: string
          region?: string | null
          slug?: string | null
          subsidy_enabled?: boolean
          timezone?: string
          trial_ends_at?: string
          updated_at?: string
          work_days?: number[]
        }
        Relationships: []
      }
      parent_children: {
        Row: {
          child_id: string
          parent_id: string
        }
        Insert: {
          child_id: string
          parent_id: string
        }
        Update: {
          child_id?: string
          parent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_children_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          created_at: string
          full_name: string
          id: string
          link_code: string | null
          link_code_expires: string | null
          linked_at: string | null
          notify_enabled: boolean
          org_id: string
          phone: string | null
          telegram_chat_id: number | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          link_code?: string | null
          link_code_expires?: string | null
          linked_at?: string | null
          notify_enabled?: boolean
          org_id: string
          phone?: string | null
          telegram_chat_id?: number | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          link_code?: string | null
          link_code_expires?: string | null
          linked_at?: string | null
          notify_enabled?: boolean
          org_id?: string
          phone?: string | null
          telegram_chat_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      refresh_tokens: {
        Row: {
          created_at: string
          device_id: string | null
          expires_at: string
          id: string
          replaced_by: string | null
          revoked_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          expires_at: string
          id?: string
          replaced_by?: string | null
          revoked_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          expires_at?: string
          id?: string
          replaced_by?: string | null
          revoked_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refresh_tokens_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refresh_tokens_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "refresh_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refresh_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      state_checks: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          child_id: string
          created_at: string
          day_id: string
          id: string
          note: string | null
          org_id: string
          our_status: Database["public"]["Enums"]["attend_status"]
          reason: Database["public"]["Enums"]["reject_reason"] | null
          result: Database["public"]["Enums"]["state_result"]
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          child_id: string
          created_at?: string
          day_id: string
          id?: string
          note?: string | null
          org_id: string
          our_status: Database["public"]["Enums"]["attend_status"]
          reason?: Database["public"]["Enums"]["reject_reason"] | null
          result?: Database["public"]["Enums"]["state_result"]
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          child_id?: string
          created_at?: string
          day_id?: string
          id?: string
          note?: string | null
          org_id?: string
          our_status?: Database["public"]["Enums"]["attend_status"]
          reason?: Database["public"]["Enums"]["reject_reason"] | null
          result?: Database["public"]["Enums"]["state_result"]
        }
        Relationships: [
          {
            foreignKeyName: "state_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "state_checks_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "state_checks_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "attendance_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "state_checks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_ops: {
        Row: {
          created_at: string
          device_id: string | null
          op_id: string
          op_type: string
          org_id: string
          reason: string | null
          result: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          op_id: string
          op_type: string
          org_id: string
          reason?: string | null
          result: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          op_id?: string
          op_type?: string
          org_id?: string
          reason?: string | null
          result?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_org_id: { Args: Record<PropertyKey, never>; Returns: string }
      auth_user_id: { Args: Record<PropertyKey, never>; Returns: string }
      auth_user_role: { Args: Record<PropertyKey, never>; Returns: string }
      hit_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      is_manager: { Args: Record<PropertyKey, never>; Returns: boolean }
      supersede_attendance_record: {
        Args: {
          p_child_id: string
          p_client_marked_at: string
          p_correction_note?: string | null
          p_day_id: string
          p_device_id: string | null
          p_marked_by: string
          p_new_id: string
          p_note?: string | null
          p_org_id: string
          p_status: Database["public"]["Enums"]["attend_status"]
        }
        Returns: {
          child_id: string
          client_marked_at: string | null
          correction_note: string | null
          created_at: string
          day_id: string
          device_id: string | null
          id: string
          is_current: boolean
          marked_at: string
          marked_by: string | null
          note: string | null
          org_id: string
          status: Database["public"]["Enums"]["attend_status"]
          supersedes_id: string | null
        }
      }
    }
    Enums: {
      attend_status: "present" | "absent" | "sick" | "vacation"
      day_status: "open" | "closed" | "reopened"
      dispute_status: "draft" | "submitted" | "won" | "lost" | "cancelled"
      org_type: "oilaviy" | "dxsh" | "xususiy"
      outbox_status: "pending" | "sent" | "failed" | "cancelled"
      reject_reason: "tizim_qotdi" | "rasm_tanilmadi" | "xatolik" | "boshqa"
      state_result: "pending" | "accepted" | "rejected"
      user_role: "owner" | "director" | "teacher"
    }
    CompositeTypes: Record<string, never>
  }
}

// Convenience aliases used throughout lib/ and app/api/ — kept stable
// across regenerations so call sites never need to change.
export type OrgType = Database["public"]["Enums"]["org_type"]
export type UserRole = Database["public"]["Enums"]["user_role"]
export type AttendStatus = Database["public"]["Enums"]["attend_status"]
export type DayStatus = Database["public"]["Enums"]["day_status"]
