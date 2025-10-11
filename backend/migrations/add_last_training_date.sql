-- Ensure user_home_training_stats tracks last completed session date
ALTER TABLE app.user_home_training_stats
ADD COLUMN IF NOT EXISTS last_training_date DATE;

-- Backfill using existing completed home training sessions
WITH latest_sessions AS (
  SELECT user_id, MAX(completed_at::date) AS last_training_date
  FROM app.home_training_sessions
  WHERE status = 'completed'
  GROUP BY user_id
)
UPDATE app.user_home_training_stats stats
SET last_training_date = latest_sessions.last_training_date,
    updated_at = NOW()
FROM latest_sessions
WHERE stats.user_id = latest_sessions.user_id
  AND (stats.last_training_date IS NULL OR stats.last_training_date < latest_sessions.last_training_date);
