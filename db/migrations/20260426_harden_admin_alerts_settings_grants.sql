-- Harden admin_alerts_settings table exposure.
-- Admin alert functions and authenticated admin checks remain available.

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_alerts_settings FROM anon;
