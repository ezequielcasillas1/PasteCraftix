-- Create category_files table
CREATE TABLE public.category_files (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  name text NOT NULL,
  color_accent text DEFAULT '#3b82f6',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  device_id text,
  CONSTRAINT category_files_pkey PRIMARY KEY (id),
  CONSTRAINT category_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id)
);

-- Create file_categories junction table
CREATE TABLE public.file_categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  file_id uuid NOT NULL,
  category_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  device_id text,
  CONSTRAINT file_categories_pkey PRIMARY KEY (id),
  CONSTRAINT file_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id),
  CONSTRAINT file_categories_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.category_files(id) ON DELETE CASCADE,
  CONSTRAINT file_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE,
  CONSTRAINT file_categories_unique_mapping UNIQUE (file_id, category_id)
);

-- Enable RLS
ALTER TABLE public.category_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for category_files
CREATE POLICY "Users can view their own category files"
  ON public.category_files FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own category files"
  ON public.category_files FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own category files"
  ON public.category_files FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own category files"
  ON public.category_files FOR DELETE
  USING (auth.uid()::text = user_id);

-- RLS Policies for file_categories
CREATE POLICY "Users can view their own file categories"
  ON public.file_categories FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own file categories"
  ON public.file_categories FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own file categories"
  ON public.file_categories FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own file categories"
  ON public.file_categories FOR DELETE
  USING (auth.uid()::text = user_id);

-- Triggers for updated_at
CREATE TRIGGER handle_updated_at_category_files
  BEFORE UPDATE ON public.category_files
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime();
