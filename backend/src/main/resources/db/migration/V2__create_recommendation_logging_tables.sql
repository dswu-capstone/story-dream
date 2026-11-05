CREATE TABLE recommendation (
    id BIGSERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES child(id) ON DELETE CASCADE,
    language_code VARCHAR(20) NOT NULL,
    algorithm_version VARCHAR(50) NOT NULL,
    recommendation_version BIGINT NOT NULL DEFAULT 1,
    refresh_reason VARCHAR(30) NOT NULL DEFAULT 'REQUEST',
    page_number INTEGER NOT NULL CHECK (page_number >= 0),
    page_size INTEGER NOT NULL CHECK (page_size > 0),
    input_interests TEXT[] NOT NULL DEFAULT '{}',
    invalidated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recommendation_item (
    id BIGSERIAL PRIMARY KEY,
    recommendation_id BIGINT NOT NULL REFERENCES recommendation(id) ON DELETE CASCADE,
    original_story_id INTEGER NOT NULL REFERENCES original_story(id),
    rank INTEGER NOT NULL CHECK (rank > 0),
    score DOUBLE PRECISION NOT NULL,
    CONSTRAINT uk_recommendation_item_story UNIQUE (recommendation_id, original_story_id),
    CONSTRAINT uk_recommendation_item_rank UNIQUE (recommendation_id, rank)
);

CREATE TABLE recommendation_exposure (
    id BIGSERIAL PRIMARY KEY,
    recommendation_item_id BIGINT NOT NULL REFERENCES recommendation_item(id) ON DELETE CASCADE,
    view_session_id VARCHAR(128) NOT NULL,
    exposed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_recommendation_exposure_session
        UNIQUE (recommendation_item_id, view_session_id)
);

CREATE TABLE story_click (
    id BIGSERIAL PRIMARY KEY,
    recommendation_exposure_id BIGINT NOT NULL
        REFERENCES recommendation_exposure(id) ON DELETE CASCADE,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_story_click_exposure UNIQUE (recommendation_exposure_id)
);

CREATE INDEX idx_recommendation_child_language_created
    ON recommendation (child_id, language_code, created_at DESC);
CREATE INDEX idx_recommendation_item_recommendation
    ON recommendation_item (recommendation_id);
CREATE INDEX idx_recommendation_exposure_item
    ON recommendation_exposure (recommendation_item_id);
CREATE INDEX idx_recommendation_exposure_exposed_at
    ON recommendation_exposure (exposed_at DESC);
CREATE INDEX idx_story_click_clicked_at
    ON story_click (clicked_at DESC);
