-- Test manual insert to simulate the missing comment feedback
INSERT INTO app.user_exercise_feedback 
(user_id, session_id, exercise_order, exercise_name, exercise_key, sentiment, comment)
VALUES (
  10, 
  67, 
  1, 
  'Pike Push-Up (Flexión en V invertida para hombros)', 
  'pike_push_up_flexi_n_en_v_invertida_para_hombros_', 
  NULL, 
  'Dificil pero con encanto'
);

-- Verify the feedback was inserted
SELECT exercise_order, exercise_name, sentiment, comment 
FROM app.user_exercise_feedback 
WHERE session_id = 67 
ORDER BY exercise_order;