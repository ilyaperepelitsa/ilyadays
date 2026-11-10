CREATE TABLE IF NOT EXISTS source_arguments(id TEXT PRIMARY KEY, revision_id TEXT NOT NULL UNIQUE, target_revision TEXT NOT NULL REFERENCES revisions(id), kind TEXT NOT NULL CHECK(kind IN ('explicit_reason','analogy','reason_not_stated')), payload_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS source_argument_spans(argument_id TEXT NOT NULL REFERENCES source_arguments(id), source_span_id TEXT NOT NULL REFERENCES source_spans(id), PRIMARY KEY(argument_id,source_span_id));
CREATE TRIGGER IF NOT EXISTS immutable_source_argument_update BEFORE UPDATE ON source_arguments BEGIN SELECT RAISE(ABORT,'source argument revisions are immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_source_argument_delete BEFORE DELETE ON source_arguments BEGIN SELECT RAISE(ABORT,'source argument revisions are immutable'); END;
INSERT OR IGNORE INTO schema_migrations(version) VALUES (4);
