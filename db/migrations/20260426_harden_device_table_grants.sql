-- Harden legacy device-sync table exposure.
-- Active clients no longer depend on anonymous access for these tables.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.device_sync_state FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.pastecraft_devices FROM anon;
