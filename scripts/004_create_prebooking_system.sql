-- Pre-booking queue system for automatic ticket booking
-- Users can select seats before tickets go live

-- Add ticket_release_time to showtimes (when tickets become available)
ALTER TABLE showtimes 
ADD COLUMN IF NOT EXISTS ticket_release_time TIMESTAMPTZ;

-- Update existing showtimes to have release time (24 hours before show)
UPDATE showtimes 
SET ticket_release_time = (show_date::timestamp + show_time::time) - INTERVAL '24 hours'
WHERE ticket_release_time IS NULL;

-- Create pre_bookings table for queued seat reservations
CREATE TABLE IF NOT EXISTS pre_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  showtime_id UUID NOT NULL REFERENCES showtimes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  failure_reason TEXT,
  processed_at TIMESTAMPTZ,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create pre_booked_seats table
CREATE TABLE IF NOT EXISTS pre_booked_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_booking_id UUID NOT NULL REFERENCES pre_bookings(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL REFERENCES seats(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pre_booking_id, seat_id)
);

-- Enable RLS
ALTER TABLE pre_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_booked_seats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pre_bookings
CREATE POLICY "Users can view their own pre-bookings"
  ON pre_bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pre-bookings"
  ON pre_bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pre-bookings"
  ON pre_bookings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pre-bookings"
  ON pre_bookings FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for pre_booked_seats
CREATE POLICY "Users can view their pre-booked seats"
  ON pre_booked_seats FOR SELECT
  USING (
    pre_booking_id IN (
      SELECT id FROM pre_bookings WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create pre-booked seats"
  ON pre_booked_seats FOR INSERT
  WITH CHECK (
    pre_booking_id IN (
      SELECT id FROM pre_bookings WHERE user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pre_bookings_status ON pre_bookings(status);
CREATE INDEX IF NOT EXISTS idx_pre_bookings_showtime ON pre_bookings(showtime_id);
CREATE INDEX IF NOT EXISTS idx_pre_bookings_user ON pre_bookings(user_id);

-- Function to process pre-bookings when tickets are released
CREATE OR REPLACE FUNCTION process_pre_booking(p_pre_booking_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pre_booking RECORD;
  v_seat RECORD;
  v_booking_id UUID;
  v_wallet_result JSON;
  v_seat_available BOOLEAN;
  v_booked_seat_ids UUID[];
BEGIN
  -- Get pre-booking details
  SELECT pb.*, s.ticket_release_time, s.show_date, s.show_time
  INTO v_pre_booking
  FROM pre_bookings pb
  JOIN showtimes s ON s.id = pb.showtime_id
  WHERE pb.id = p_pre_booking_id
  FOR UPDATE;
  
  IF v_pre_booking IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Pre-booking not found');
  END IF;
  
  IF v_pre_booking.status != 'queued' THEN
    RETURN json_build_object('success', false, 'error', 'Pre-booking already processed');
  END IF;
  
  -- Check if tickets are released
  IF v_pre_booking.ticket_release_time > NOW() THEN
    RETURN json_build_object('success', false, 'error', 'Tickets not yet released');
  END IF;
  
  -- Update status to processing
  UPDATE pre_bookings SET status = 'processing', updated_at = NOW()
  WHERE id = p_pre_booking_id;
  
  -- Check if all seats are available
  FOR v_seat IN 
    SELECT pbs.seat_id, pbs.price
    FROM pre_booked_seats pbs
    WHERE pbs.pre_booking_id = p_pre_booking_id
  LOOP
    -- Check if seat is already booked
    SELECT NOT EXISTS (
      SELECT 1 FROM booked_seats bs
      JOIN bookings b ON b.id = bs.booking_id
      WHERE bs.seat_id = v_seat.seat_id
        AND b.showtime_id = v_pre_booking.showtime_id
        AND b.status IN ('pending', 'confirmed')
    ) INTO v_seat_available;
    
    IF NOT v_seat_available THEN
      -- Mark as failed
      UPDATE pre_bookings 
      SET status = 'failed', 
          failure_reason = 'One or more seats are no longer available',
          processed_at = NOW(),
          updated_at = NOW()
      WHERE id = p_pre_booking_id;
      
      RETURN json_build_object('success', false, 'error', 'Seats not available');
    END IF;
  END LOOP;
  
  -- Deduct from wallet
  SELECT deduct_from_wallet(
    v_pre_booking.user_id,
    v_pre_booking.total_amount,
    NULL,
    'Auto-booking for showtime'
  ) INTO v_wallet_result;
  
  IF NOT (v_wallet_result->>'success')::boolean THEN
    UPDATE pre_bookings 
    SET status = 'failed', 
        failure_reason = v_wallet_result->>'error',
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_pre_booking_id;
    
    RETURN json_build_object('success', false, 'error', v_wallet_result->>'error');
  END IF;
  
  -- Create the actual booking
  INSERT INTO bookings (user_id, showtime_id, total_amount, status)
  VALUES (v_pre_booking.user_id, v_pre_booking.showtime_id, v_pre_booking.total_amount, 'confirmed')
  RETURNING id INTO v_booking_id;
  
  -- Create booked seats
  INSERT INTO booked_seats (booking_id, seat_id, price)
  SELECT v_booking_id, pbs.seat_id, pbs.price
  FROM pre_booked_seats pbs
  WHERE pbs.pre_booking_id = p_pre_booking_id;
  
  -- Update pre-booking as completed
  UPDATE pre_bookings 
  SET status = 'completed', 
      booking_id = v_booking_id,
      processed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_pre_booking_id;
  
  -- Update wallet transaction with booking_id
  UPDATE wallet_transactions
  SET booking_id = v_booking_id
  WHERE id = (
    SELECT wt.id FROM wallet_transactions wt
    WHERE wt.wallet_id = (SELECT w.id FROM wallets w WHERE w.user_id = v_pre_booking.user_id)
      AND wt.booking_id IS NULL
      AND wt.type = 'deduction'
    ORDER BY wt.created_at DESC
    LIMIT 1
  );
  
  RETURN json_build_object('success', true, 'booking_id', v_booking_id);
END;
$$;

-- Function to get queued pre-bookings ready for processing
CREATE OR REPLACE FUNCTION get_ready_pre_bookings()
RETURNS TABLE (
  pre_booking_id UUID,
  user_id UUID,
  showtime_id UUID,
  total_amount DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT pb.id, pb.user_id, pb.showtime_id, pb.total_amount
  FROM pre_bookings pb
  JOIN showtimes s ON s.id = pb.showtime_id
  WHERE pb.status = 'queued'
    AND s.ticket_release_time <= NOW()
  ORDER BY pb.priority DESC, pb.created_at ASC;
END;
$$;
