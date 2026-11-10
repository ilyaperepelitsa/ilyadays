from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class Command(StrictModel):
    id: str = Field(pattern=r'^[a-zA-Z0-9_-]{1,100}$')
    type: Literal['create', 'edit', 'link', 'unlink', 'link_edit', 'link_review', 'bundle', 'review', 'lock', 'preference', 'map_target']
    expected_version: int = Field(ge=0)
    at: str = Field(max_length=64)
    payload: dict[str, Any]


class Passage(StrictModel):
    id: str
    revision_id: str
    edition_id: str
    book: str
    section: str
    locator: str
    text: str
    raw_text: str
    text_hash: str = Field(pattern=r'^[a-f0-9]{64}$')
    normalization: Literal['identity-v1']
    authorship: str


class SourceSpan(StrictModel):
    id: str
    passage_revision: str
    start: int = Field(ge=0)
    end: int = Field(gt=0)
    exact: str = Field(min_length=1)
    prefix: str
    suffix: str
    text_hash: str
    validation: Literal['valid']


class Workspace(StrictModel):
    fixture_revision: int = 1
    target_mappings: list[dict[str, Any]] = Field(default_factory=list)
    import_audit: dict[str, Any] | None = None
    schema_version: Literal[1]
    version: int = Field(ge=0)
    corpus_kind: Literal['synthetic', 'hays', 'public_domain_backup']
    offset_convention: Literal['unicode-scalar-half-open-v1']
    editions: list[dict[str, Any]]
    passages: list[Passage]
    spans: list[SourceSpan]
    conclusions: list[dict[str, Any]]
    expressions: list[dict[str, Any]]
    revisions: list[dict[str, Any]]
    propositions: list[dict[str, Any]] = Field(default_factory=list)
    bundles: list[dict[str, Any]]
    links: list[dict[str, Any]]
    assessments: dict[str, dict[str, str]]
    concepts: list[dict[str, Any]]
    memberships: list[dict[str, Any]]
    preferences: dict[str, dict[str, Any]]
    reviews: list[dict[str, Any]]
    events: list[dict[str, Any]]
