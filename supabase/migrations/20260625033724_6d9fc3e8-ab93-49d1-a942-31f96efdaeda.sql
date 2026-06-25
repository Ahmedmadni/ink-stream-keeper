ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none';

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_recurrence_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_recurrence_check
  CHECK (recurrence IN ('none','daily','weekly','monthly'));

CREATE INDEX IF NOT EXISTS tasks_reminder_at_idx ON public.tasks(reminder_at) WHERE reminder_at IS NOT NULL;