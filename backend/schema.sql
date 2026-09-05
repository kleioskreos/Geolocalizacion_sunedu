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
