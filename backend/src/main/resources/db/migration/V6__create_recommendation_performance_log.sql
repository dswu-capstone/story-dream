CREATE TABLE recommendation_performance_log (
    id BIGSERIAL PRIMARY KEY,
    recommendation_id BIGINT NOT NULL UNIQUE
        REFERENCES recommendation(id) ON DELETE CASCADE,
    cache_hit BOOLEAN NOT NULL,
    behavior_aggregation_ms BIGINT NOT NULL CHECK (behavior_aggregation_ms >= 0),
    ai_or_cache_ms BIGINT NOT NULL CHECK (ai_or_cache_ms >= 0),
    persistence_ms BIGINT NOT NULL CHECK (persistence_ms >= 0),
    total_ms BIGINT NOT NULL CHECK (total_ms >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recommendation_performance_created_at
    ON recommendation_performance_log (created_at DESC);
