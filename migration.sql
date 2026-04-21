-- 1. Fix Missing Profiles & Auto-creation Trigger
INSERT INTO public.profiles (id, full_name)
SELECT au.id, COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1))
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Drop duplicate foreign key causing 23503 error
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_user_id_profiles_fkey;

-- 3. Add new columns to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignee_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS jira_link TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'task';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS blocker_item_id TEXT;

-- 4. Fix Tasks RLS Policy to allow re-assignment (UPDATE) by any authenticated user
-- Replace the existing UPDATE policy with one that allows any team member to update
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
-- You might have different policy names, so we will just create a new one that allows updates
CREATE POLICY "Team members can update tasks" ON public.tasks FOR UPDATE USING (auth.role() = 'authenticated');
-- And ensure SELECT is allowed for all team members
DROP POLICY IF EXISTS "Team members can view all tasks" ON public.tasks;
CREATE POLICY "Team members can view all tasks" ON public.tasks FOR SELECT USING (auth.role() = 'authenticated');
