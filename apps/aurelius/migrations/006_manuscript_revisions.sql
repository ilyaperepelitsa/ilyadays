CREATE TABLE manuscript_revisions(id TEXT PRIMARY KEY, parent_id TEXT REFERENCES manuscript_revisions(id), payload_json TEXT NOT NULL);
CREATE TABLE manuscript_lessons(manuscript_revision TEXT NOT NULL REFERENCES manuscript_revisions(id), chapter_id TEXT NOT NULL, position INTEGER NOT NULL, conclusion_revision TEXT NOT NULL REFERENCES revisions(id), expression_revision TEXT REFERENCES revisions(id), PRIMARY KEY(manuscript_revision,chapter_id,position));
CREATE TRIGGER immutable_manuscript_update BEFORE UPDATE ON manuscript_revisions BEGIN SELECT RAISE(ABORT,'manuscript revisions are immutable'); END;
CREATE TRIGGER immutable_manuscript_delete BEFORE DELETE ON manuscript_revisions BEGIN SELECT RAISE(ABORT,'manuscript revisions are immutable'); END;
CREATE TRIGGER immutable_manuscript_lesson_update BEFORE UPDATE ON manuscript_lessons BEGIN SELECT RAISE(ABORT,'manuscript lesson references are immutable'); END;
CREATE TRIGGER immutable_manuscript_lesson_delete BEFORE DELETE ON manuscript_lessons BEGIN SELECT RAISE(ABORT,'manuscript lesson references are immutable'); END;
INSERT OR IGNORE INTO schema_migrations(version) VALUES (6);
