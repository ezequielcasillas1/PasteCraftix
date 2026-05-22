-- Harden page_views INSERT with path constraints.
-- Date: 2026-05-22

ALTER TABLE public.page_views
  DROP CONSTRAINT IF EXISTS page_views_path_length_check;

ALTER TABLE public.page_views
  ADD CONSTRAINT page_views_path_length_check
  CHECK (char_length(path) <= 200 AND path ~ '^/');

ALTER TABLE public.page_views
  DROP CONSTRAINT IF EXISTS page_views_visitor_id_length_check;

ALTER TABLE public.page_views
  ADD CONSTRAINT page_views_visitor_id_length_check
  CHECK (visitor_id IS NULL OR char_length(visitor_id) <= 64);
