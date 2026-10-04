-- Seed data for CineTix Movie Booking

-- Insert Theaters
INSERT INTO theaters (id, name, total_rows, seats_per_row) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Screen 1 - IMAX', 12, 16),
  ('22222222-2222-2222-2222-222222222222', 'Screen 2 - Dolby Atmos', 10, 14),
  ('33333333-3333-3333-3333-333333333333', 'Screen 3 - Standard', 8, 12);

-- Insert Movies
INSERT INTO movies (id, title, description, genre, duration_minutes, rating, poster_url, backdrop_url, release_date, is_now_showing) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Dune: Part Three', 'The epic conclusion to the Dune saga. Paul Atreides must lead the Fremen in the final battle for Arrakis while confronting the dark prophecy of his future.', 'Sci-Fi', 175, 'PG-13', '/posters/dune3.jpg', '/backdrops/dune3.jpg', '2026-01-15', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'The Last Horizon', 'A gripping space thriller about astronauts stranded on Mars who must find a way home before their supplies run out.', 'Sci-Fi', 142, 'PG-13', '/posters/horizon.jpg', '/backdrops/horizon.jpg', '2026-01-20', true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Midnight in Paris 2', 'Owen Wilson returns for another magical journey through time in the City of Lights.', 'Romance', 118, 'PG', '/posters/paris2.jpg', '/backdrops/paris2.jpg', '2026-01-10', true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Shadow Protocol', 'A former CIA operative is pulled back into action when a ghost from her past threatens global security.', 'Action', 128, 'R', '/posters/shadow.jpg', '/backdrops/shadow.jpg', '2026-01-25', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'The Laughing Man', 'A dark comedy about a failed comedian who accidentally becomes a viral sensation.', 'Comedy', 105, 'R', '/posters/laughing.jpg', '/backdrops/laughing.jpg', '2026-01-18', true),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Echoes of Tomorrow', 'A mind-bending thriller where a woman receives messages from her future self.', 'Thriller', 134, 'PG-13', '/posters/echoes.jpg', '/backdrops/echoes.jpg', '2026-02-01', false);

-- Generate seats for Screen 1 (IMAX - 12 rows, 16 seats each)
INSERT INTO seats (theater_id, row_label, seat_number, seat_type)
SELECT 
  '11111111-1111-1111-1111-111111111111',
  chr(64 + row_num),
  seat_num,
  CASE 
    WHEN row_num <= 3 THEN 'standard'
    WHEN row_num <= 9 THEN 'premium'
    ELSE 'vip'
  END
FROM generate_series(1, 12) AS row_num, generate_series(1, 16) AS seat_num;

-- Generate seats for Screen 2 (Dolby Atmos - 10 rows, 14 seats each)
INSERT INTO seats (theater_id, row_label, seat_number, seat_type)
SELECT 
  '22222222-2222-2222-2222-222222222222',
  chr(64 + row_num),
  seat_num,
  CASE 
    WHEN row_num <= 3 THEN 'standard'
    WHEN row_num <= 7 THEN 'premium'
    ELSE 'vip'
  END
FROM generate_series(1, 10) AS row_num, generate_series(1, 14) AS seat_num;

-- Generate seats for Screen 3 (Standard - 8 rows, 12 seats each)
INSERT INTO seats (theater_id, row_label, seat_number, seat_type)
SELECT 
  '33333333-3333-3333-3333-333333333333',
  chr(64 + row_num),
  seat_num,
  CASE 
    WHEN row_num <= 2 THEN 'standard'
    WHEN row_num <= 6 THEN 'premium'
    ELSE 'vip'
  END
FROM generate_series(1, 8) AS row_num, generate_series(1, 12) AS seat_num;

-- Generate showtimes for the next 7 days
INSERT INTO showtimes (movie_id, theater_id, show_date, show_time, price)
SELECT 
  m.id,
  t.id,
  CURRENT_DATE + d.day_offset,
  time_slot.show_time,
  CASE 
    WHEN t.name LIKE '%IMAX%' THEN 18.00
    WHEN t.name LIKE '%Dolby%' THEN 15.00
    ELSE 12.00
  END
FROM movies m
CROSS JOIN theaters t
CROSS JOIN generate_series(0, 6) AS d(day_offset)
CROSS JOIN (
  VALUES 
    ('10:30'::TIME),
    ('13:15'::TIME),
    ('16:00'::TIME),
    ('19:00'::TIME),
    ('21:45'::TIME)
) AS time_slot(show_time)
WHERE m.is_now_showing = true
  AND (
    -- IMAX shows blockbusters
    (t.name LIKE '%IMAX%' AND m.genre IN ('Sci-Fi', 'Action')) OR
    -- Dolby shows various genres
    (t.name LIKE '%Dolby%' AND m.genre IN ('Sci-Fi', 'Action', 'Thriller')) OR
    -- Standard shows all
    (t.name LIKE '%Standard%')
  );
