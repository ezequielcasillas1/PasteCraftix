-- Per-user shuffle deck for funky animal name generation (no repeats until full cycle).
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS funky_animal_deck JSONB DEFAULT NULL;

COMMENT ON COLUMN public.user_profiles.funky_animal_deck IS
  'Shuffle bag for ai-name: { "remaining": ["Fox", "Penguin", ...], "cycle": 1 }';
