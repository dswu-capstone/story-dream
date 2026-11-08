ALTER TABLE recommendation
    ADD COLUMN invalidation_reason VARCHAR(30);

CREATE INDEX idx_recommendation_active_child_language
    ON recommendation (child_id, language_code)
    WHERE invalidated_at IS NULL;
