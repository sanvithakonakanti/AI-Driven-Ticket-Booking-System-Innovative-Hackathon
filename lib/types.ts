export interface Movie {
  id: string
  title: string
  description: string
  duration_minutes: number
  genre: string
  rating: string
  poster_url: string
  release_date: string
  created_at: string
}

export interface Theater {
  id: string
  name: string
  total_rows: number
  seats_per_row: number
  created_at: string
}

export interface Showtime {
  id: string
  movie_id: string
  theater_id: string
  show_date: string
  show_time: string
  price: number
  is_active: boolean
  created_at: string
  movie?: Movie
  theater?: Theater
}

export interface Seat {
  id: string
  theater_id: string
  row_label: string
  seat_number: number
  seat_type: 'standard' | 'premium' | 'vip'
  created_at: string
}

export interface SeatWithStatus extends Seat {
  status: 'available' | 'selected' | 'booked' | 'locked'
}

export interface Booking {
  id: string
  user_id: string
  showtime_id: string
  total_amount: number
  status: 'pending' | 'confirmed' | 'cancelled'
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded'
  created_at: string
  showtime?: Showtime
  seats?: BookedSeat[]
}

export interface BookedSeat {
  id: string
  booking_id: string
  seat_id: string
  price: number
  created_at: string
  seat?: Seat
}

export interface SeatLock {
  id: string
  seat_id: string
  showtime_id: string
  user_id: string
  expires_at: string
  created_at: string
}

export interface Wallet {
  id: string
  user_id: string
  balance: number
  created_at: string
  updated_at: string
}

export interface WalletTransaction {
  id: string
  wallet_id: string
  type: 'credit' | 'deduction' | 'refund'
  amount: number
  description: string
  booking_id?: string
  created_at: string
}

export interface PreBooking {
  id: string
  user_id: string
  showtime_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  priority: number
  total_amount: number
  failure_reason?: string
  processed_at?: string
  booking_id?: string
  created_at: string
  updated_at: string
  showtime?: Showtime & { ticket_release_time?: string }
  pre_booked_seats?: PreBookedSeat[]
}

export interface PreBookedSeat {
  id: string
  pre_booking_id: string
  seat_id: string
  price: number
  created_at: string
  seat?: Seat
}

export interface ShowtimeWithRelease extends Showtime {
  ticket_release_time?: string
}
