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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          org_id: string | null
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string | null
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string | null
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          amount_cents: number | null
          currency: string
          description: string | null
          id: string
          kind: string
          occurred_at: string
          org_id: string
          status: string | null
          stripe_ref: string | null
        }
        Insert: {
          amount_cents?: number | null
          currency?: string
          description?: string | null
          id?: string
          kind: string
          occurred_at?: string
          org_id: string
          status?: string | null
          stripe_ref?: string | null
        }
        Update: {
          amount_cents?: number | null
          currency?: string
          description?: string | null
          id?: string
          kind?: string
          occurred_at?: string
          org_id?: string
          status?: string | null
          stripe_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          active: boolean
          currency: string
          default_store_limit: number
          entitlements: Json
          id: string
          is_placeholder_pricing: boolean
          name: string
          price_per_location_cents: number
          stripe_price_id: string | null
          trial_days: number
          trial_store_limit: number
        }
        Insert: {
          active?: boolean
          currency?: string
          default_store_limit?: number
          entitlements?: Json
          id: string
          is_placeholder_pricing?: boolean
          name: string
          price_per_location_cents?: number
          stripe_price_id?: string | null
          trial_days?: number
          trial_store_limit?: number
        }
        Update: {
          active?: boolean
          currency?: string
          default_store_limit?: number
          entitlements?: Json
          id?: string
          is_placeholder_pricing?: boolean
          name?: string
          price_per_location_cents?: number
          stripe_price_id?: string | null
          trial_days?: number
          trial_store_limit?: number
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          location_ids: string[]
          org_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["org_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          location_ids?: string[]
          org_id: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["org_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          location_ids?: string[]
          org_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["org_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          hours: Json
          id: string
          is_verified: boolean
          name: string
          org_id: string
          phone: string | null
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          hours?: Json
          id?: string
          is_verified?: boolean
          name: string
          org_id: string
          phone?: string | null
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          hours?: Json
          id?: string
          is_verified?: boolean
          name?: string
          org_id?: string
          phone?: string | null
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_location_access: {
        Row: {
          location_id: string
          member_id: string
        }
        Insert: {
          location_id: string
          member_id: string
        }
        Update: {
          location_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_location_access_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_location_access_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          brand_accent: string
          brand_primary: string
          company_address: string
          company_name: string
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          logo_url: string | null
          name: string
          onboarding_step: number
          plan: string
          previous_brand: Json | null
          slug: string
          status: string
          store_limit: number
          store_limit_override: number | null
          suspended_reason: string | null
        }
        Insert: {
          brand_accent?: string
          brand_primary?: string
          company_address?: string
          company_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name: string
          onboarding_step?: number
          plan?: string
          previous_brand?: Json | null
          slug: string
          status?: string
          store_limit?: number
          store_limit_override?: number | null
          suspended_reason?: string | null
        }
        Update: {
          brand_accent?: string
          brand_primary?: string
          company_address?: string
          company_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          logo_url?: string | null
          name?: string
          onboarding_step?: number
          plan?: string
          previous_brand?: Json | null
          slug?: string
          status?: string
          store_limit?: number
          store_limit_override?: number | null
          suspended_reason?: string | null
        }
        Relationships: []
      }
      platform_bootstrap: {
        Row: {
          authorization_note: string
          completed_at: string
          id: boolean
          user_id: string
        }
        Insert: {
          authorization_note: string
          completed_at?: string
          id?: boolean
          user_id: string
        }
        Update: {
          authorization_note?: string
          completed_at?: string
          id?: boolean
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          preferred_language: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          preferred_language?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          preferred_language?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          error: string | null
          id: string
          org_id: string | null
          processed_at: string | null
          received_at: string
          type: string
        }
        Insert: {
          error?: string | null
          id: string
          org_id?: string | null
          processed_at?: string | null
          received_at?: string
          type: string
        }
        Update: {
          error?: string | null
          id?: string
          org_id?: string | null
          processed_at?: string | null
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billed_locations: number
          cancel_at_period_end: boolean
          canceled_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          grace_ends_at: string | null
          org_id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billed_locations?: number
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          grace_ends_at?: string | null
          org_id: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billed_locations?: number
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          grace_ends_at?: string | null
          org_id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: string }
      active_store_count: { Args: { _org_id: string }; Returns: number }
      admin_assign_owner: {
        Args: { _email: string; _org_id: string; _verification_note: string }
        Returns: undefined
      }
      admin_list_audit: {
        Args: { _limit?: number }
        Returns: {
          action: string
          actor_id: string
          created_at: string
          id: string
          metadata: Json
          org_id: string
          org_name: string
          target: string
        }[]
      }
      admin_list_organizations: {
        Args: never
        Returns: {
          created_at: string
          id: string
          is_demo: boolean
          member_count: number
          name: string
          owner_count: number
          plan: string
          slug: string
          status: string
          store_count: number
          store_limit: number
        }[]
      }
      admin_list_platform_admins: {
        Args: never
        Returns: {
          email: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }[]
      }
      admin_org_insights: {
        Args: never
        Returns: {
          active_store_count: number
          billed_locations: number
          billing_connected: boolean
          brand_customized: boolean
          created_at: string
          has_override: boolean
          id: string
          is_demo: boolean
          last_activity: string
          member_count: number
          name: string
          owner_count: number
          owner_email: string
          pending_invites: number
          plan: string
          status: string
          store_count: number
          store_limit: number
          sub_status: string
          trial_ends_at: string
        }[]
      }
      admin_set_platform_role: {
        Args: {
          _email: string
          _grant: boolean
          _reason: string
          _role: Database["public"]["Enums"]["platform_role"]
        }
        Returns: undefined
      }
      admin_set_subscription: {
        Args: {
          _org_id: string
          _plan: string
          _reason: string
          _status: string
        }
        Returns: undefined
      }
      admin_update_organization: {
        Args: {
          _org_id: string
          _plan: string
          _reason: string
          _status: string
          _store_limit: number
        }
        Returns: undefined
      }
      assert_org_operational: { Args: { _org_id: string }; Returns: undefined }
      billing_apply_stripe_event: {
        Args: {
          _amount_cents: number
          _cancel_at_period_end: boolean
          _currency: string
          _customer: string
          _event_id: string
          _org_id: string
          _period_end: string
          _period_start: string
          _plan: string
          _status: string
          _subscription: string
          _type: string
        }
        Returns: boolean
      }
      bootstrap_first_platform_admin: {
        Args: { _authorization_note: string; _user_id: string }
        Returns: undefined
      }
      can_access_location: { Args: { _location_id: string }; Returns: boolean }
      can_manage_member: { Args: { _member_id: string }; Returns: boolean }
      can_manage_org: { Args: { _org_id: string }; Returns: boolean }
      can_operate_location: { Args: { _location_id: string }; Returns: boolean }
      create_invitation: {
        Args: {
          _email: string
          _location_ids?: string[]
          _org_id: string
          _role: Database["public"]["Enums"]["org_role"]
        }
        Returns: string
      }
      create_location: {
        Args: {
          _address: string
          _name: string
          _org_id: string
          _phone: string
          _timezone: string
        }
        Returns: string
      }
      create_organization: {
        Args: {
          _brand_primary?: string
          _location_name?: string
          _name: string
        }
        Returns: string
      }
      create_test_restaurant: {
        Args: {
          _company_address: string
          _company_name: string
          _location_name: string
          _name: string
        }
        Returns: string
      }
      effective_store_limit: { Args: { _org_id: string }; Returns: number }
      get_invitation: {
        Args: { _token: string }
        Returns: {
          brand_primary: string
          email: string
          org_name: string
          org_slug: string
          role: Database["public"]["Enums"]["org_role"]
          status: string
        }[]
      }
      has_platform_role: {
        Args: {
          _role: Database["public"]["Enums"]["platform_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org_id: string }; Returns: boolean }
      is_org_owner: { Args: { _org_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      member_scope: { Args: { _member_id: string }; Returns: string[] }
      my_member: {
        Args: { _org_id: string }
        Returns: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "organization_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_org_status: {
        Args: { _org_id: string }
        Returns: {
          plan: string
          status: string
          store_limit: number
          suspended_reason: string
        }[]
      }
      org_is_operational: { Args: { _org_id: string }; Returns: boolean }
      remove_member: { Args: { _member_id: string }; Returns: undefined }
      revoke_invitation: { Args: { _id: string }; Returns: undefined }
      save_location_with_managers: {
        Args: {
          _address: string
          _hours: Json
          _id: string
          _member_ids: string[]
          _name: string
          _phone: string
          _timezone: string
        }
        Returns: undefined
      }
      save_org_brand: {
        Args: {
          _accent: string
          _logo?: string
          _org_id: string
          _primary: string
        }
        Returns: undefined
      }
      set_location_managers: {
        Args: { _location_id: string; _member_ids: string[] }
        Returns: undefined
      }
      set_location_status: {
        Args: { _id: string; _status: string }
        Returns: undefined
      }
      set_member_locations: {
        Args: { _location_ids: string[]; _member_id: string }
        Returns: undefined
      }
      set_member_role: {
        Args: {
          _member_id: string
          _role: Database["public"]["Enums"]["org_role"]
        }
        Returns: undefined
      }
      set_onboarding_step: {
        Args: { _org_id: string; _step: number }
        Returns: undefined
      }
      shares_org_with: { Args: { _user_id: string }; Returns: boolean }
      sync_org_entitlements: { Args: { _org_id: string }; Returns: undefined }
      transfer_ownership: {
        Args: { _new_owner: string; _org_id: string }
        Returns: undefined
      }
      update_location: {
        Args: {
          _address: string
          _hours: Json
          _id: string
          _name: string
          _phone: string
          _timezone: string
        }
        Returns: undefined
      }
      valid_location_hours: { Args: { _hours: Json }; Returns: boolean }
      write_audit: {
        Args: { _action: string; _meta: Json; _org: string; _target: string }
        Returns: undefined
      }
    }
    Enums: {
      org_role: "owner" | "manager" | "staff"
      platform_role: "platform_admin" | "support"
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
    Enums: {
      org_role: ["owner", "manager", "staff"],
      platform_role: ["platform_admin", "support"],
    },
  },
} as const
