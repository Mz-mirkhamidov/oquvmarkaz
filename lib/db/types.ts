/**
 * Generated from the live Qalqon Supabase project (mxxsmgkpdgdexodvdpzb)
 * via mcp__Supabase__generate_typescript_types after applying migrations
 * 0001-0012. Regenerate the same way after any future migration:
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
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account: {
        Row: {
          accessToken: string | null
          accessTokenExpiresAt: string | null
          accountId: string
          createdAt: string
          id: string
          idToken: string | null
          password: string | null
          providerId: string
          refreshToken: string | null
          refreshTokenExpiresAt: string | null
          scope: string | null
          updatedAt: string
          userId: string
        }
        Insert: {
          accessToken?: string | null
          accessTokenExpiresAt?: string | null
          accountId: string
          createdAt?: string
          id?: string
          idToken?: string | null
          password?: string | null
          providerId: string
          refreshToken?: string | null
          refreshTokenExpiresAt?: string | null
          scope?: string | null
          updatedAt: string
          userId: string
        }
        Update: {
          accessToken?: string | null
          accessTokenExpiresAt?: string | null
          accountId?: string
          createdAt?: string
          id?: string
          idToken?: string | null
          password?: string | null
          providerId?: string
          refreshToken?: string | null
          refreshTokenExpiresAt?: string | null
          scope?: string | null
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "user"
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
            foreignKeyName: "attendance_days_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          ip: unknown
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
          ip?: unknown
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
          ip?: unknown
          org_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      auth_events: {
        Row: {
          at: string
          code: string
          detail: Json | null
          device_id: string | null
          id: number
          ip: unknown
          ok: boolean
          org_id: string | null
          stage: string
          telegram_id: number | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          at?: string
          code: string
          detail?: Json | null
          device_id?: string | null
          id?: number
          ip?: unknown
          ok: boolean
          org_id?: string | null
          stage: string
          telegram_id?: number | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          at?: string
          code?: string
          detail?: Json | null
          device_id?: string | null
          id?: number
          ip?: unknown
          ok?: boolean
          org_id?: string | null
          stage?: string
          telegram_id?: number | null
          user_agent?: string | null
          user_id?: string | null
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
        ]
      }
      devices: {
        Row: {
          bind_code: string | null
          bind_expires: string | null
          bound_at: string | null
          created_at: string
          created_by: string | null
          id: string
          is_blocked: boolean
          label: string | null
          last_seen_at: string | null
          org_id: string
          secret_hash: string
          user_agent: string | null
        }
        Insert: {
          bind_code?: string | null
          bind_expires?: string | null
          bound_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_blocked?: boolean
          label?: string | null
          last_seen_at?: string | null
          org_id: string
          secret_hash: string
          user_agent?: string | null
        }
        Update: {
          bind_code?: string | null
          bind_expires?: string | null
          bound_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_blocked?: boolean
          label?: string | null
          last_seen_at?: string | null
          org_id?: string
          secret_hash?: string
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
        ]
      }
      login_tokens: {
        Row: {
          chat_id: number
          consumed_at: string | null
          consumed_ip: unknown
          created_at: string
          created_ip: unknown
          expires_at: string
          first_name: string | null
          id: string
          telegram_id: number
          telegram_username: string | null
          token_hash: string
        }
        Insert: {
          chat_id: number
          consumed_at?: string | null
          consumed_ip?: unknown
          created_at?: string
          created_ip?: unknown
          expires_at: string
          first_name?: string | null
          id?: string
          telegram_id: number
          telegram_username?: string | null
          token_hash: string
        }
        Update: {
          chat_id?: number
          consumed_at?: string | null
          consumed_ip?: unknown
          created_at?: string
          created_ip?: unknown
          expires_at?: string
          first_name?: string | null
          id?: string
          telegram_id?: number
          telegram_username?: string | null
          token_hash?: string
        }
        Relationships: []
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
      session: {
        Row: {
          createdAt: string
          deviceId: string | null
          expiresAt: string
          id: string
          ipAddress: string | null
          token: string
          updatedAt: string
          userAgent: string | null
          userId: string
        }
        Insert: {
          createdAt?: string
          deviceId?: string | null
          expiresAt: string
          id?: string
          ipAddress?: string | null
          token: string
          updatedAt: string
          userAgent?: string | null
          userId: string
        }
        Update: {
          createdAt?: string
          deviceId?: string | null
          expiresAt?: string
          id?: string
          ipAddress?: string | null
          token?: string
          updatedAt?: string
          userAgent?: string | null
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "user"
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
      user: {
        Row: {
          appRole: string | null
          createdAt: string
          email: string
          emailVerified: boolean
          failedPinCount: number | null
          fullName: string | null
          id: string
          image: string | null
          isActive: boolean | null
          lockedUntil: string | null
          name: string
          orgId: string | null
          pinHash: string | null
          telegramId: string | null
          telegramUsername: string | null
          updatedAt: string
        }
        Insert: {
          appRole?: string | null
          createdAt?: string
          email: string
          emailVerified: boolean
          failedPinCount?: number | null
          fullName?: string | null
          id?: string
          image?: string | null
          isActive?: boolean | null
          lockedUntil?: string | null
          name: string
          orgId?: string | null
          pinHash?: string | null
          telegramId?: string | null
          telegramUsername?: string | null
          updatedAt?: string
        }
        Update: {
          appRole?: string | null
          createdAt?: string
          email?: string
          emailVerified?: boolean
          failedPinCount?: number | null
          fullName?: string | null
          id?: string
          image?: string | null
          isActive?: boolean | null
          lockedUntil?: string | null
          name?: string
          orgId?: string | null
          pinHash?: string | null
          telegramId?: string | null
          telegramUsername?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
      verification: {
        Row: {
          createdAt: string
          expiresAt: string
          id: string
          identifier: string
          updatedAt: string
          value: string
        }
        Insert: {
          createdAt?: string
          expiresAt: string
          id?: string
          identifier: string
          updatedAt?: string
          value: string
        }
        Update: {
          createdAt?: string
          expiresAt?: string
          id?: string
          identifier?: string
          updatedAt?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
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
          p_correction_note?: string
          p_day_id: string
          p_device_id: string
          p_marked_by: string
          p_new_id: string
          p_note?: string
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
