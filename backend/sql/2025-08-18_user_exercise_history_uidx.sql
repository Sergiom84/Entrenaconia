-- Idempotent unique index to avoid duplicates in the same session per exercise
-- If you want more precision, extend the table to include exercise_order and adjust the index accordingly.

SET search_path = app, public;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_user_hist_unique
ON app.user_exercise_history (user_id, session_id, exercise_name);

