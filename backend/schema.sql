CREATE TABLE IF NOT EXISTS schools (
 id text PRIMARY KEY,
 data jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schools_department_idx ON schools ((data->>'departamento'));
CREATE TABLE IF NOT EXISTS administrators (
 username text PRIMARY KEY,
 password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS institution_links (
 external_id text PRIMARY KEY,
 school_id text NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
 external_name text NOT NULL DEFAULT '',
 external_place text NOT NULL DEFAULT '',
 aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS institution_links_school_idx ON institution_links (school_id);
CREATE TABLE IF NOT EXISTS match_sessions (
 id text PRIMARY KEY,
 data jsonb NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_sessions_expiry_idx ON match_sessions (expires_at);
