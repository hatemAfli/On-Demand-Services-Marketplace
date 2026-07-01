-- Run manually in Supabase SQL Editor (or via psql on DIRECT_URL).
-- Do NOT run `npx prisma migrate deploy` for this file — it is outside Prisma migrations.

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Embeddings table (one row per GivenService — provider or company offering)
CREATE TABLE IF NOT EXISTS provider_service_embeddings (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  given_service_id           UUID NOT NULL REFERENCES given_services(id) ON DELETE CASCADE,
  owner_id                   UUID NOT NULL,
  owner_type                 TEXT NOT NULL, -- 'PROVIDER' | 'COMPANY'
  service_id                 UUID NOT NULL,
  service_name               TEXT NOT NULL,
  category_name              TEXT NOT NULL,
  city                       TEXT NOT NULL,
  price                      FLOAT NOT NULL,
  pricing_type               TEXT NOT NULL,
  average_rating             FLOAT DEFAULT 0,
  total_reviews              INT DEFAULT 0,
  is_available_immediately   BOOLEAN DEFAULT FALSE,
  is_top_provider            BOOLEAN DEFAULT FALSE,
  is_active                  BOOLEAN DEFAULT TRUE,
  embedding                  VECTOR(1536),
  embedding_text             TEXT,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for upsert on given_service_id
CREATE UNIQUE INDEX IF NOT EXISTS provider_service_embeddings_given_service_id_key
  ON provider_service_embeddings(given_service_id);

-- 3. Vector similarity index (run AFTER initial bulk sync for best recall)
CREATE INDEX IF NOT EXISTS provider_service_embeddings_vector_idx
  ON provider_service_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. Filter index
CREATE INDEX IF NOT EXISTS provider_service_embeddings_active_idx
  ON provider_service_embeddings(is_active, city);

CREATE INDEX IF NOT EXISTS provider_service_embeddings_owner_type_idx
  ON provider_service_embeddings(owner_type, is_active);

-- 5. Similarity search (supports optional owner_type filter for provider vs company)
CREATE OR REPLACE FUNCTION match_providers(
  query_embedding    VECTOR(1536),
  match_count        INT DEFAULT 10,
  filter_city        TEXT DEFAULT NULL,
  filter_min_rating  FLOAT DEFAULT NULL,
  filter_available   BOOLEAN DEFAULT NULL,
  filter_max_price   FLOAT DEFAULT NULL,
  filter_owner_type  TEXT DEFAULT NULL
)
RETURNS TABLE (
  given_service_id UUID,
  owner_id         UUID,
  owner_type       TEXT,
  service_id       UUID,
  service_name     TEXT,
  category_name    TEXT,
  city             TEXT,
  price            FLOAT,
  pricing_type     TEXT,
  average_rating   FLOAT,
  total_reviews    INT,
  is_top_provider  BOOLEAN,
  similarity       FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    e.given_service_id,
    e.owner_id,
    e.owner_type,
    e.service_id,
    e.service_name,
    e.category_name,
    e.city,
    e.price,
    e.pricing_type,
    e.average_rating,
    e.total_reviews,
    e.is_top_provider,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM provider_service_embeddings e
  WHERE
    e.is_active = TRUE
    AND e.embedding IS NOT NULL
    AND (filter_city IS NULL OR lower(e.city) = lower(filter_city))
    AND (filter_min_rating IS NULL OR e.average_rating >= filter_min_rating)
    AND (filter_available IS NULL OR e.is_available_immediately = filter_available)
    AND (filter_max_price IS NULL OR e.price <= filter_max_price)
    AND (filter_owner_type IS NULL OR e.owner_type = filter_owner_type)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 6. PostgREST / Supabase API permissions (for Python chatbot semantic search)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON provider_service_embeddings TO postgres, service_role;
GRANT SELECT ON provider_service_embeddings TO anon, authenticated;
GRANT EXECUTE ON FUNCTION match_providers TO postgres, service_role, anon, authenticated;
