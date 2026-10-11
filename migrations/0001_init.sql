-- SPEC §5.1. Nothing else is stored: no timestamps finer than a month, no IPs, no user agents.

CREATE TABLE blobs (
  id            TEXT PRIMARY KEY,      -- base64url, 22 chars (16 bytes)
  parent_id     TEXT,                  -- family blob id for kid blobs, NULL for family blobs
  write_hash    TEXT NOT NULL,         -- base64url SHA-256 of the write token
  version       INTEGER NOT NULL,      -- starts at 1, +1 per successful PUT
  ct            BLOB NOT NULL,         -- ciphertext (SPEC §7.3)
  touched_month TEXT NOT NULL          -- 'YYYY-MM' of last write; coarse on purpose
);
CREATE INDEX blobs_parent ON blobs(parent_id);

CREATE TABLE invites (
  code_hash   TEXT PRIMARY KEY,        -- base64url SHA-256 of the invite code
  expires_on  TEXT NOT NULL            -- 'YYYY-MM-DD', last valid day
);
