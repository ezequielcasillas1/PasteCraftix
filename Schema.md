-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.ai_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  history_id bigint NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['summary'::text, 'breakdown'::text])),
  title text,
  threads jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT ai_history_pkey PRIMARY KEY (id),
  CONSTRAINT ai_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
);
CREATE TABLE public.archived_clips (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  clip_id text NOT NULL,
  text text NOT NULL,
  category text DEFAULT 'Uncategorized'::text,
  timestamp bigint NOT NULL,
  archived_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  device_id text,
  content_hash text,
  CONSTRAINT archived_clips_pkey PRIMARY KEY (id),
  CONSTRAINT archived_clips_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
);
CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  data jsonb,
  device_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  category_id text NOT NULL,
  name text NOT NULL,
  icon text DEFAULT '📁'::text,
  created_at timestamp with time zone DEFAULT now(),
  auth_user_id uuid,
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  device_id text,
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id),
  CONSTRAINT categories_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.change_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  kind text NOT NULL CHECK (kind = ANY (ARRAY['ROW_DML'::text, 'DDL'::text])),
  schema_name text,
  table_name text,
  operation text,
  actor_db_role text NOT NULL DEFAULT CURRENT_USER,
  actor_auth_uid uuid,
  client_addr inet,
  txid bigint NOT NULL DEFAULT txid_current(),
  row_old jsonb,
  row_new jsonb,
  ddl_command_tag text,
  ddl_object_type text,
  ddl_object_identity text,
  ddl_command text,
  CONSTRAINT change_audit_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.clipboard_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  content text NOT NULL,
  device_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clipboard_history_pkey PRIMARY KEY (id),
  CONSTRAINT clipboard_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
);
CREATE TABLE public.clips (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  clip_id text NOT NULL,
  text text NOT NULL,
  category text DEFAULT 'Uncategorized'::text,
  timestamp bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  auth_user_id uuid,
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  device_id text,
  content_hash text,
  CONSTRAINT clips_pkey PRIMARY KEY (id),
  CONSTRAINT clips_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id),
  CONSTRAINT clips_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.coupon_codes (
  id bigint NOT NULL DEFAULT nextval('coupon_codes_id_seq'::regclass),
  code text NOT NULL UNIQUE,
  benefit_type text NOT NULL,
  benefit_value integer,
  is_active boolean DEFAULT true,
  description text,
  expires_at timestamp with time zone,
  max_redemptions integer,
  redemption_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupon_codes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.coupon_redemptions (
  id bigint NOT NULL DEFAULT nextval('coupon_redemptions_id_seq'::regclass),
  coupon_code_id bigint,
  user_id uuid,
  redeemed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupon_redemptions_pkey PRIMARY KEY (id),
  CONSTRAINT coupon_redemptions_coupon_code_id_fkey FOREIGN KEY (coupon_code_id) REFERENCES public.coupon_codes(id),
  CONSTRAINT coupon_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.device_sync_state (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  device_id text NOT NULL,
  last_sync_at timestamp with time zone DEFAULT now(),
  last_seen_at timestamp with time zone DEFAULT now(),
  last_sync_ms bigint,
  CONSTRAINT device_sync_state_pkey PRIMARY KEY (id),
  CONSTRAINT device_sync_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
);
CREATE TABLE public.note_versions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  note_id text NOT NULL,
  version_at timestamp with time zone DEFAULT now(),
  snapshot jsonb NOT NULL,
  device_id text,
  CONSTRAINT note_versions_pkey PRIMARY KEY (id),
  CONSTRAINT note_versions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
);
CREATE TABLE public.notes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  note_id text NOT NULL,
  note_type text NOT NULL DEFAULT 'note'::text,
  title text,
  description text,
  body text,
  attachments jsonb DEFAULT '[]'::jsonb,
  note_refs jsonb DEFAULT '[]'::jsonb,
  source_note_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  device_id text,
  updated_ms bigint,
  content_hash text,
  CONSTRAINT notes_pkey PRIMARY KEY (id),
  CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
);
CREATE TABLE public.pastecraft_devices (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  device_id text NOT NULL,
  display_name text,
  last_seen_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pastecraft_devices_pkey PRIMARY KEY (id),
  CONSTRAINT pastecraft_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
);
CREATE TABLE public.settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL UNIQUE,
  auto_delete_period text DEFAULT 'never'::text,
  theme text DEFAULT 'light'::text,
  auto_hide boolean DEFAULT true,
  show_timestamps boolean DEFAULT true,
  max_clips_display integer DEFAULT 20,
  delimiter text DEFAULT 'comma'::text,
  custom_delimiter text DEFAULT ', '::text,
  deduplicate boolean DEFAULT false,
  sort boolean DEFAULT false,
  uppercase boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  album_attachment_open_mode text,
  CONSTRAINT settings_pkey PRIMARY KEY (id),
  CONSTRAINT settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
);
CREATE TABLE public.user_profiles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL UNIQUE,
  user_name text,
  ai_generated_name text,
  profile_image_url text,
  profile_image_base64 text,
  generated_image_url text,
  ai_generated_image boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  auth_user_id uuid,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_subscriptions (
  id bigint NOT NULL DEFAULT nextval('user_subscriptions_id_seq'::regclass),
  user_id uuid UNIQUE,
  email text NOT NULL,
  subscription_tier text NOT NULL DEFAULT 'free'::text,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text DEFAULT 'active'::text,
  trial_ends_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  has_unlimited_ai boolean DEFAULT false,
  ai_access_expires_at timestamp with time zone,
  CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);