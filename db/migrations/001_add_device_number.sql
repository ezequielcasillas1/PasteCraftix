-- Migration: Add device_number to pastecraft_devices
-- Run this in Supabase SQL Editor to enable user-controlled device slots (1-10)

-- Add device_number column
ALTER TABLE public.pastecraft_devices 
ADD COLUMN IF NOT EXISTS device_number INTEGER;

-- Add CHECK constraint for 1-10 range
ALTER TABLE public.pastecraft_devices 
DROP CONSTRAINT IF EXISTS device_number_range;

ALTER TABLE public.pastecraft_devices 
ADD CONSTRAINT device_number_range CHECK (device_number >= 1 AND device_number <= 10);

-- Add UNIQUE constraint on (user_id, device_number)
ALTER TABLE public.pastecraft_devices 
DROP CONSTRAINT IF EXISTS unique_user_device_number;

ALTER TABLE public.pastecraft_devices 
ADD CONSTRAINT unique_user_device_number UNIQUE (user_id, device_number);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_pastecraft_devices_device_number 
ON public.pastecraft_devices(device_number);
