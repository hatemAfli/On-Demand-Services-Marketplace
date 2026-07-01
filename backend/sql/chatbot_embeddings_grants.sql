-- Run in Supabase SQL Editor if the Python chatbot gets
-- "permission denied for schema public" on match_providers RPC.
-- (NestJS sync now uses Prisma directly; this is mainly for chatbot search.)

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON provider_service_embeddings
  TO postgres, service_role;

GRANT SELECT ON provider_service_embeddings TO anon, authenticated;

GRANT EXECUTE ON FUNCTION match_providers(
  vector, int, text, float, boolean, float, text
) TO postgres, service_role, anon, authenticated;

-- Optional: allow service_role full access via RLS bypass (already bypasses RLS)
ALTER TABLE provider_service_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_embeddings_all" ON provider_service_embeddings;
CREATE POLICY "service_role_embeddings_all"
  ON provider_service_embeddings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "read_embeddings_authenticated" ON provider_service_embeddings;
CREATE POLICY "read_embeddings_authenticated"
  ON provider_service_embeddings
  FOR SELECT
  TO authenticated, anon
  USING (is_active = true);
