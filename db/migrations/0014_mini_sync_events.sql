-- Miniapp sync event log for review cards, life loop, and future social state.
-- This keeps the client mutation protocol durable once Supabase env is enabled.

CREATE TABLE IF NOT EXISTS mini_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  user_id text,
  auth_mode text NOT NULL DEFAULT 'local',
  mutation_id text NOT NULL UNIQUE,
  mutation_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  mutation_status text NOT NULL DEFAULT 'pending',
  mutation_created_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_mini_sync_client_received
  ON mini_sync_events(client_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_mini_sync_user_received
  ON mini_sync_events(user_id, received_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mini_sync_type_received
  ON mini_sync_events(mutation_type, received_at DESC);

ALTER TABLE mini_sync_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mini_sync_events'
      AND policyname = 'service_role_full'
  ) THEN
    CREATE POLICY "service_role_full" ON mini_sync_events
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE mini_sync_events IS
  'Miniapp client mutation log for cross-device sync, review events, life loop, and leaderboard inputs.';
