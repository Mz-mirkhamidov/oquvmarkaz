/**
 * Hand-written subset of the generated Supabase `Database` type, covering
 * only the tables M1 touches. There is no live Qalqon Supabase project
 * yet, so this can't be generated from
 * `mcp__Supabase__generate_typescript_types` — once a project exists and
 * the migrations in supabase/migrations/ are applied, regenerate this
 * file from the real schema and it should be a drop-in superset
 * replacement (same table/column names, same shapes).
 *
 * Shape matters here: @supabase/postgrest-js only infers real Row/Insert/
 * Update types (instead of falling back to `never`) when each table also
 * carries `Relationships: []` and the schema carries `Views`/`Functions`
 * — see GenericTable/GenericSchema in postgrest-js's common.ts.
 */

export type OrgType = "oilaviy" | "dxsh" | "xususiy";
export type UserRole = "owner" | "director" | "teacher";

interface Table<Row, Insert, Update> {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
}

interface Fn<Args, Returns> {
  Args: Args;
  Returns: Returns;
}

type OrganizationRow = {
  id: string;
  name: string;
  org_type: OrgType;
  region: string | null;
  district: string | null;
  address: string | null;
  phone: string | null;
  capacity: number | null;
  subsidy_enabled: boolean;
  photo_required: boolean;
  work_days: number[];
  day_close_hour: number;
  default_fee: number | null;
  timezone: string;
  plan: string;
  trial_ends_at: string;
  slug: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type AppUserRow = {
  id: string;
  org_id: string;
  full_name: string;
  role: UserRole;
  telegram_id: number | null;
  telegram_username: string | null;
  pin_hash: string | null;
  pin_set_at: string | null;
  failed_pin_count: number;
  locked_until: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

type DeviceRow = {
  id: string;
  org_id: string;
  device_key: string;
  label: string | null;
  user_agent: string | null;
  last_seen_at: string | null;
  is_blocked: boolean;
  created_at: string;
};

type GroupRow = {
  id: string;
  org_id: string;
  name: string;
  teacher_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ChildRow = {
  id: string;
  org_id: string;
  group_id: string | null;
  full_name: string;
  birth_date: string | null;
  gender: "m" | "f" | null;
  state_system_id: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  monthly_fee: number | null;
  is_subsidized: boolean;
  photo_consent: boolean;
  photo_consent_at: string | null;
  photo_consent_by: string | null;
  avatar_path: string | null;
  enrolled_at: string;
  left_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type RefreshTokenRow = {
  id: string;
  user_id: string;
  device_id: string | null;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  replaced_by: string | null;
  created_at: string;
};

type RateLimitRow = { key: string; window_start: string; count: number };

type AuditLogRow = {
  id: number;
  org_id: string | null;
  actor_id: string | null;
  actor_role: UserRole | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      organizations: Table<
        OrganizationRow,
        Partial<OrganizationRow> & { name: string; org_type: OrgType },
        Partial<OrganizationRow>
      >;
      app_users: Table<
        AppUserRow,
        Partial<AppUserRow> & { org_id: string; full_name: string; role: UserRole },
        Partial<AppUserRow>
      >;
      devices: Table<
        DeviceRow,
        Partial<DeviceRow> & { org_id: string; device_key: string },
        Partial<DeviceRow>
      >;
      groups: Table<
        GroupRow,
        Partial<GroupRow> & { org_id: string; name: string },
        Partial<GroupRow>
      >;
      children: Table<
        ChildRow,
        Partial<ChildRow> & { org_id: string; full_name: string },
        Partial<ChildRow>
      >;
      refresh_tokens: Table<
        RefreshTokenRow,
        Partial<RefreshTokenRow> & { user_id: string; token_hash: string; expires_at: string },
        Partial<RefreshTokenRow>
      >;
      rate_limits: Table<
        RateLimitRow,
        { key: string; window_start: string; count?: number },
        Partial<RateLimitRow>
      >;
      audit_log: Table<
        AuditLogRow,
        Partial<AuditLogRow> & { action: string; entity: string },
        Partial<AuditLogRow>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      hit_rate_limit: Fn<
        { p_key: string; p_window_seconds: number; p_limit: number },
        boolean
      >;
    };
  };
}
