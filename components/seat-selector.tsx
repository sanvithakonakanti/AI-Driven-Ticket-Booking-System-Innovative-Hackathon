'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SeatWithStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface SeatSelectorProps {
  showtimeId: string
  theaterId: string
  userId: string | null
  basePrice: number
  onSelectionChange: (seats: SeatWithStatus[], total: number) => void
}

export function SeatSelector({
  showtimeId,
  theaterId,
  userId,
  basePrice,
  onSelectionChange,
}: SeatSelectorProps) {
  const [seats, setSeats] = useState<SeatWithStatus[]>([])
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Fetch seats and their status
  const fetchSeats = useCallback(async () => {
    // Get all seats for the theater
    const { data: theaterSeats, error: seatsError } = await supabase
      .from('seats')
      .select('*')
      .eq('theater_id', theaterId)
      .order('row_label')
      .order('seat_number')

    if (seatsError) {
      console.error('Error fetching seats:', seatsError)
      return
    }

    // Get booked seats for this showtime
    const { data: bookedSeats, error: bookedError } = await supabase
      .from('booked_seats')
      .select('seat_id, booking:bookings!inner(status)')
      .eq('booking.showtime_id', showtimeId)
      .in('booking.status', ['pending', 'confirmed'])

    if (bookedError) {
      console.error('Error fetching booked seats:', bookedError)
    }

    // Get locked seats for this showtime
    const { data: lockedSeats, error: lockedError } = await supabase
      .from('seat_locks')
      .select('seat_id, user_id')
      .eq('showtime_id', showtimeId)
      .gt('expires_at', new Date().toISOString())

    if (lockedError) {
      console.error('Error fetching locked seats:', lockedError)
    }

    const bookedSeatIds = new Set((bookedSeats || []).map((bs) => bs.seat_id))
    const lockedSeatMap = new Map(
      (lockedSeats || []).map((ls) => [ls.seat_id, ls.user_id])
    )

    // Map seats with their status
    const seatsWithStatus: SeatWithStatus[] = (theaterSeats || []).map((seat) => {
      let status: SeatWithStatus['status'] = 'available'
      
      if (bookedSeatIds.has(seat.id)) {
        status = 'booked'
      } else if (lockedSeatMap.has(seat.id)) {
        // If locked by current user, show as selected
        if (lockedSeatMap.get(seat.id) === userId) {
          status = 'selected'
        } else {
          status = 'locked'
        }
      } else if (selectedSeats.has(seat.id)) {
        status = 'selected'
      }

      return { ...seat, status }
    })

    setSeats(seatsWithStatus)
    setLoading(false)
  }, [supabase, theaterId, showtimeId, userId, selectedSeats])

  useEffect(() => {
    fetchSeats()

    // Set up real-time subscription for seat updates
    const channel = supabase
      .channel(`seats-${showtimeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booked_seats',
        },
        () => {
          fetchSeats()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'seat_locks',
        },
        () => {
          fetchSeats()
        }
      )
      .subscribe()

    // Refresh every 10 seconds to handle lock expirations
    const interval = setInterval(fetchSeats, 10000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [supabase, showtimeId, fetchSeats])

  // Update parent when selection changes
  useEffect(() => {
    const selected = seats.filter((s) => selectedSeats.has(s.id))
    const total = selected.reduce((sum, seat) => {
      const multiplier = seat.seat_type === 'vip' ? 1.5 : seat.seat_type === 'premium' ? 1.25 : 1
      return sum + basePrice * multiplier
    }, 0)
    onSelectionChange(selected, total)
  }, [selectedSeats, seats, basePrice, onSelectionChange])

  const handleSeatClick = async (seat: SeatWithStatus) => {
    if (!userId) {
      toast.error('Please sign in to select seats')
      return
    }

    if (seat.status === 'booked' || seat.status === 'locked') {
      return
    }

    const newSelection = new Set(selectedSeats)
    
    if (selectedSeats.has(seat.id)) {
      // Deselect seat
      newSelection.delete(seat.id)
      
      // Remove lock
      await supabase
        .from('seat_locks')
        .delete()
        .eq('seat_id', seat.id)
        .eq('user_id', userId)
    } else {
      // Check max seats limit
      if (newSelection.size >= 10) {
        toast.error('Maximum 10 seats per booking')
        return
      }

      // Select seat and create lock
      newSelection.add(seat.id)
      
      const { error } = await supabase
        .from('seat_locks')
        .upsert({
          seat_id: seat.id,
          showtime_id: showtimeId,
          user_id: userId,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min lock
        })

      if (error) {
        console.error('Error locking seat:', error)
        newSelection.delete(seat.id)
        toast.error('Failed to reserve seat. It may have been taken.')
        fetchSeats()
        return
      }
    }

    setSelectedSeats(newSelection)
  }

  // Group seats by row
  const seatsByRow = seats.reduce((acc, seat) => {
    if (!acc[seat.row_label]) {
      acc[seat.row_label] = []
    }
    acc[seat.row_label].push(seat)
    return acc
  }, {} as Record<string, SeatWithStatus[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Screen indicator */}
      <div className="mx-auto w-3/4 max-w-md">
        <div className="h-2 rounded-t-full bg-primary/60" />
        <p className="mt-2 text-center text-sm text-muted-foreground">Screen</p>
      </div>

      {/* Seat grid */}
      <div className="mx-auto max-w-3xl space-y-2 overflow-x-auto py-4">
        {Object.entries(seatsByRow).map(([rowLabel, rowSeats]) => (
          <div key={rowLabel} className="flex items-center justify-center gap-2">
            <span className="w-6 text-center text-sm font-medium text-muted-foreground">
              {rowLabel}
            </span>
            <div className="flex gap-1">
              {rowSeats.map((seat) => (
                <button
                  key={seat.id}
                  onClick={() => handleSeatClick(seat)}
                  disabled={seat.status === 'booked' || seat.status === 'locked'}
                  className={cn(
                    'h-7 w-7 rounded-t-lg text-xs font-medium transition-all',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
                    seat.status === 'available' && 'bg-seat-available text-foreground hover:bg-seat-available/80 cursor-pointer',
                    seat.status === 'selected' && 'bg-seat-selected text-primary-foreground cursor-pointer',
                    seat.status === 'booked' && 'bg-seat-booked text-muted-foreground cursor-not-allowed',
                    seat.status === 'locked' && 'bg-seat-locked text-accent-foreground cursor-not-allowed',
                    seat.seat_type === 'vip' && 'ring-1 ring-accent',
                    seat.seat_type === 'premium' && 'ring-1 ring-primary/50'
                  )}
                  title={`${rowLabel}${seat.seat_number} - ${seat.seat_type} - ${seat.status}`}
                >
                  {seat.seat_number}
                </button>
              ))}
            </div>
            <span className="w-6 text-center text-sm font-medium text-muted-foreground">
              {rowLabel}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-t-md bg-seat-available" />
          <span className="text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-t-md bg-seat-selected" />
          <span className="text-muted-foreground">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-t-md bg-seat-booked" />
          <span className="text-muted-foreground">Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-t-md bg-seat-locked" />
          <span className="text-muted-foreground">Reserved</span>
        </div>
      </div>
    </div>
  )
}
