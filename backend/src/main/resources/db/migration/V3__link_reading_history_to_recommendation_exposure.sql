ALTER TABLE reading_history
    ADD COLUMN recommendation_exposure_id BIGINT;

ALTER TABLE reading_history
    ADD CONSTRAINT fk_reading_history_recommendation_exposure
        FOREIGN KEY (recommendation_exposure_id)
        REFERENCES recommendation_exposure(id)
        ON DELETE SET NULL;

CREATE INDEX idx_reading_history_recommendation_exposure
    ON reading_history (recommendation_exposure_id);
