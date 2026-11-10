CREATE TABLE IF NOT EXISTS annotation_runs(id TEXT PRIMARY KEY, target_revision TEXT NOT NULL REFERENCES revisions(id), payload_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS annotation_pieces(run_id TEXT NOT NULL REFERENCES annotation_runs(id), piece_id TEXT NOT NULL, passage_revision TEXT NOT NULL REFERENCES passages(revision_id), start_offset INTEGER NOT NULL, end_offset INTEGER NOT NULL, exact_text TEXT NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(run_id,piece_id));
CREATE TRIGGER IF NOT EXISTS immutable_annotation_run_update BEFORE UPDATE ON annotation_runs BEGIN SELECT RAISE(ABORT,'annotation runs are immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_annotation_run_delete BEFORE DELETE ON annotation_runs BEGIN SELECT RAISE(ABORT,'annotation runs are immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_annotation_piece_update BEFORE UPDATE ON annotation_pieces BEGIN SELECT RAISE(ABORT,'annotation pieces are immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_annotation_piece_delete BEFORE DELETE ON annotation_pieces BEGIN SELECT RAISE(ABORT,'annotation pieces are immutable'); END;
INSERT OR IGNORE INTO schema_migrations(version) VALUES (5);
