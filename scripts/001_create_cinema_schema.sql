-- CineTix Movie Booking Database Schema

-- Movies table
CREATE TABLE IF NOT EXISTS movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  genre TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  rating TEXT,
  poster_url TEXT,
  backdrop_url TEXT,
  release_date DATE,
  is_now_showing BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Theaters/Screens table
CREATE TABLE IF NOT EXISTS theaters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 10,
  seats_per_row INTEGER NOT NULL DEFAULT 12,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Showtimes table
CREATE TABLE IF NOT EXISTS showtimes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  theater_id UUID NOT NULL REFERENCES theaters(id) ON DELETE CASCADE,
  show_date DATE NOT NULL,
  show_time TIME NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 12.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seats table (represents individual seats in a theater)
CREATE TABLE IF NOT EXISTS seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theater_id UUID NOT NULL REFERENCES theaters(id) ON DELETE CASCADE,
  row_label TEXT NOT NULL,
  seat_number INTEGER NOT NULL,
  seat_type TEXT DEFAULT 'standard', -- standard, premium, vip
  UNIQUE(theater_id, row_label, seat_number)
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  showtime_id UUID NOT NULL REFERENCES showtimes(id) ON DELETE CASCADE,
  total_amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'confirmed', -- pending, confirmed, cancelled
  booking_reference TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booked seats table (junction table for booking and seats)
CREATE TABLE IF NOT EXISTS booked_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  showtime_id UUID NOT NULL REFERENCES showtimes(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(showtime_id, seat_id)
);

-- Seat locks table (for temporary seat reservation during checkout)
CREATE TABLE IF NOT EXISTS seat_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showtime_id UUID NOT NULL REFERENCES showtimes(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(showtime_id, seat_id)
);

-- Enable Row Level Security
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE theaters ENABLE ROW LEVEL SECURITY;
ALTER TABLE showtimes ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booked_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_locks ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Movies: Public read access
CREATE POLICY "movies_public_read" ON movies FOR SELECT USING (true);

-- Theaters: Public read access
CREATE POLICY "theaters_public_read" ON theaters FOR SELECT USING (true);

-- Showtimes: Public read access
CREATE POLICY "showtimes_public_read" ON showtimes FOR SELECT USING (true);

-- Seats: Public read access
CREATE POLICY "seats_public_read" ON seats FOR SELECT USING (true);

-- Bookings: Users can only see and manage their own bookings
CREATE POLICY "bookings_select_own" ON bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bookings_insert_own" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookings_update_own" ON bookings FOR UPDATE USING (auth.uid() = user_id);

-- Booked seats: Public read (to show occupied seats), users insert via booking
CREATE POLICY "booked_seats_public_read" ON booked_seats FOR SELECT USING (true);
CREATE POLICY "booked_seats_insert_own" ON booked_seats FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND user_id = auth.uid())
);

-- Seat locks: Users can manage their own locks, public can read (to see locked seats)
CREATE POLICY "seat_locks_public_read" ON seat_locks FOR SELECT USING (true);
CREATE POLICY "seat_locks_insert_own" ON seat_locks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "seat_locks_delete_own" ON seat_locks FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_showtimes_movie ON showtimes(movie_id);
CREATE INDEX IF NOT EXISTS idx_showtimes_date ON showtimes(show_date);
CREATE INDEX IF NOT EXISTS idx_booked_seats_showtime ON booked_seats(showtime_id);
CREATE INDEX IF NOT EXISTS idx_seat_locks_showtime ON seat_locks(showtime_id);
CREATE INDEX IF NOT EXISTS idx_seat_locks_expires ON seat_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
