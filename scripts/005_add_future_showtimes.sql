-- Add future showtimes with ticket release times for testing pre-booking
-- These showtimes have tickets that will release in the future

-- Get theater IDs
DO $$
DECLARE
  v_theater_1 UUID;
  v_theater_2 UUID;
  v_movie_id UUID;
BEGIN
  -- Get theater IDs (use any available theater if specific ones don't exist)
  SELECT id INTO v_theater_1 FROM theaters ORDER BY name LIMIT 1;
  SELECT id INTO v_theater_2 FROM theaters ORDER BY name LIMIT 1 OFFSET 1;
  
  -- If no second theater, use the first one
  IF v_theater_2 IS NULL THEN
    v_theater_2 := v_theater_1;
  END IF;
  
  -- Exit if no theaters exist
  IF v_theater_1 IS NULL THEN
    RAISE NOTICE 'No theaters found, skipping showtime creation';
    RETURN;
  END IF;
  
  -- For each movie, add some future showtimes with release times
  FOR v_movie_id IN SELECT id FROM movies LOOP
    -- Showtime 1: Releases in 5 minutes (for testing)
    INSERT INTO showtimes (movie_id, theater_id, show_date, show_time, price, is_active, ticket_release_time)
    VALUES (
      v_movie_id,
      v_theater_1,
      (CURRENT_DATE + INTERVAL '7 days')::date,
      '19:00:00',
      15.99,
      true,
      NOW() + INTERVAL '5 minutes'
    )
    ON CONFLICT DO NOTHING;
    
    -- Showtime 2: Releases in 1 hour
    INSERT INTO showtimes (movie_id, theater_id, show_date, show_time, price, is_active, ticket_release_time)
    VALUES (
      v_movie_id,
      v_theater_2,
      (CURRENT_DATE + INTERVAL '7 days')::date,
      '21:30:00',
      18.99,
      true,
      NOW() + INTERVAL '1 hour'
    )
    ON CONFLICT DO NOTHING;
    
    -- Showtime 3: Releases in 24 hours
    INSERT INTO showtimes (movie_id, theater_id, show_date, show_time, price, is_active, ticket_release_time)
    VALUES (
      v_movie_id,
      v_theater_1,
      (CURRENT_DATE + INTERVAL '14 days')::date,
      '18:00:00',
      14.99,
      true,
      NOW() + INTERVAL '24 hours'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Update any existing showtimes without ticket_release_time to have one in the past (already released)
UPDATE showtimes
SET ticket_release_time = (show_date::timestamp + show_time::time) - INTERVAL '24 hours'
WHERE ticket_release_time IS NULL;
