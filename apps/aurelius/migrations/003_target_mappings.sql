BEGIN;
CREATE TABLE target_mappings(id TEXT PRIMARY KEY,target_revision TEXT NOT NULL REFERENCES revisions(id),block_id TEXT NOT NULL,start_scalar INTEGER NOT NULL CHECK(start_scalar>=0),end_scalar INTEGER NOT NULL CHECK(end_scalar>start_scalar),exact_text TEXT NOT NULL,payload_json TEXT NOT NULL);
CREATE TABLE target_mapping_sources(mapping_id TEXT NOT NULL REFERENCES target_mappings(id),source_span TEXT NOT NULL REFERENCES source_spans(id),PRIMARY KEY(mapping_id,source_span));
INSERT INTO schema_migrations(version) VALUES(3);
COMMIT;
