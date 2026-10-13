CREATE TABLE IF NOT EXISTS pairings (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  poll_hash TEXT NOT NULL,
  state TEXT NOT NULL UNIQUE,
  code_verifier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result_json TEXT,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  connection_hash TEXT NOT NULL,
  encrypted_tokens TEXT NOT NULL,
  sync_cursor TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS pairings_state_idx ON pairings(state);
