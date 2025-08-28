-- Fix user_exercise_feedback table to allow comments without sentiment

-- 1. Remove NOT NULL constraint from sentiment column
ALTER TABLE app.user_exercise_feedback ALTER COLUMN sentiment DROP NOT NULL;

-- 2. Drop existing CHECK constraint
ALTER TABLE app.user_exercise_feedback DROP CONSTRAINT user_exercise_feedback_sentiment_check;

-- 3. Add new CHECK constraint that allows NULL or valid sentiments
ALTER TABLE app.user_exercise_feedback 
ADD CONSTRAINT user_exercise_feedback_sentiment_check 
CHECK (sentiment IS NULL OR sentiment IN ('dislike', 'hard', 'love'));

-- 4. Verify the changes
\d app.user_exercise_feedback

SELECT 'Table structure updated to allow comments without sentiment' AS status;