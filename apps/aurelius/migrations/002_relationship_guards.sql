BEGIN;
ALTER TABLE memberships ADD COLUMN passage_revision TEXT REFERENCES passages(revision_id);
ALTER TABLE memberships ADD COLUMN proposition_revision TEXT REFERENCES propositions(revision_id);
UPDATE memberships SET passage_revision=(SELECT p.revision_id FROM passages p WHERE json_extract(p.payload_json,'$.id')=json_extract(memberships.payload_json,'$.passage_id'));
CREATE UNIQUE INDEX membership_passage_concept ON memberships(passage_revision,concept_id) WHERE passage_revision IS NOT NULL;
CREATE UNIQUE INDEX membership_proposition_concept ON memberships(proposition_revision,concept_id) WHERE proposition_revision IS NOT NULL;
CREATE TRIGGER membership_source_insert BEFORE INSERT ON memberships WHEN (NEW.passage_revision IS NULL)=(NEW.proposition_revision IS NULL) BEGIN SELECT RAISE(ABORT,'membership needs exactly one source revision'); END;
CREATE TRIGGER membership_source_update BEFORE UPDATE ON memberships WHEN (NEW.passage_revision IS NULL)=(NEW.proposition_revision IS NULL) BEGIN SELECT RAISE(ABORT,'membership needs exactly one source revision'); END;
CREATE TRIGGER concept_parent_dag BEFORE INSERT ON concept_parents BEGIN
  SELECT RAISE(ABORT,'concept hierarchy must be acyclic') WHERE EXISTS (
    WITH RECURSIVE ancestors(id) AS (SELECT NEW.parent_id UNION SELECT p.parent_id FROM concept_parents p JOIN ancestors a ON p.child_id=a.id)
    SELECT 1 FROM ancestors WHERE id=NEW.child_id
  );
END;
CREATE TRIGGER concept_parent_dag_update BEFORE UPDATE ON concept_parents BEGIN SELECT RAISE(ABORT,'replace conceptual edges explicitly'); END;
CREATE TRIGGER derivation_dag BEFORE INSERT ON lineage BEGIN
  SELECT RAISE(ABORT,'derivation lineage must be acyclic') WHERE EXISTS (
    WITH RECURSIVE ancestors(id) AS (SELECT NEW.source_revision UNION SELECT l.source_revision FROM lineage l JOIN ancestors a ON l.target_revision=a.id)
    SELECT 1 FROM ancestors WHERE id=NEW.target_revision
  );
END;
CREATE TRIGGER derivation_no_update BEFORE UPDATE ON lineage BEGIN SELECT RAISE(ABORT,'derivation edges reference immutable revisions'); END;
CREATE TRIGGER review_no_update BEFORE UPDATE ON reviews BEGIN SELECT RAISE(ABORT,'review decisions are append-only'); END;
CREATE TRIGGER review_no_delete BEFORE DELETE ON reviews BEGIN SELECT RAISE(ABORT,'review decisions are append-only'); END;
CREATE TRIGGER event_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'events are append-only'); END;
CREATE TRIGGER event_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'events are append-only'); END;
INSERT INTO schema_migrations(version) VALUES (2);
COMMIT;
