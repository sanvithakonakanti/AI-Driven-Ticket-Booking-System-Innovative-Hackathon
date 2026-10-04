'use client'

import { useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { SeatSelector } from '@/components/seat-selector'
import { Showtime, Movie, Theater, SeatWithStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface BookingClientProps {
  showtime: Showtime & { movie: Movie; theater: Theater }
  userId: string | null
}

export function BookingClient({ showtime, userId }: BookingClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [selectedSeats, setSelectedSeats] = useState<SeatWithStatus[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [isBooking, setIsBooking] = useState(false)
  const supabase = createClient()

  const handleSelectionChange = useCallback((seats: SeatWithStatus[], total: number) => {
    setSelectedSeats(seats)
    setTotalAmount(total)
  }, [])

  const handleBooking = async () => {
    if (!userId) {
      toast.error('Please sign in to complete your booking')
      router.push('/auth/login')
      return
    }

    if (selectedSeats.length === 0) {
      toast.error('Please select at least one seat')
      return
    }

    setIsBooking(true)

    try {
      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: userId,
          showtime_id: showtime.id,
          total_amount: totalAmount,
          status: 'pending',
          payment_status: 'pending',
        })
        .select()
        .single()

      if (bookingError) throw bookingError

      // Create booked seats
      const bookedSeats = selectedSeats.map((seat) => {
        const multiplier = seat.seat_type === 'vip' ? 1.5 : seat.seat_type === 'premium' ? 1.25 : 1
        return {
          booking_id: booking.id,
          seat_id: seat.id,
          price: showtime.price * multiplier,
        }
      })

      const { error: seatsError } = await supabase
        .from('booked_seats')
        .insert(bookedSeats)

      if (seatsError) throw seatsError

      // Clear seat locks for this user
      await supabase
        .from('seat_locks')
        .delete()
        .eq('user_id', userId)
        .eq('showtime_id', showtime.id)

      // Redirect to checkout/confirmation
      router.push(`/checkout/${booking.id}`)
    } catch (error) {
      console.error('Booking error:', error)
      toast.error('Failed to create booking. Please try again.')
    } finally {
      setIsBooking(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
      {/* Seat Selection Area */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle>Select Your Seats</CardTitle>
        </CardHeader>
        <CardContent>
          <SeatSelector
            showtimeId={showtime.id}
            theaterId={showtime.theater_id}
            userId={userId}
            basePrice={showtime.price}
            onSelectionChange={handleSelectionChange}
          />
        </CardContent>
      </Card>

      {/* Booking Summary */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Booking Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium text-foreground">{showtime.movie.title}</p>
              <p className="text-sm text-muted-foreground">{showtime.theater.name}</p>
            </div>

            <Separator />

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Selected Seats</p>
              {selectedSeats.length === 0 ? (
                <p className="text-sm text-muted-foreground">No seats selected</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedSeats
                    .sort((a, b) => {
                      if (a.row_label !== b.row_label) {
                        return a.row_label.localeCompare(b.row_label)
                      }
                      return a.seat_number - b.seat_number
                    })
                    .map((seat) => (
                      <span
                        key={seat.id}
                        className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
                      >
                        {seat.row_label}{seat.seat_number}
                        {seat.seat_type !== 'standard' && ` (${seat.seat_type})`}
                      </span>
                    ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tickets ({selectedSeats.length})</span>
                <span className="text-foreground">${totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Booking Fee</span>
                <span className="text-foreground">$1.50</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-primary">
                  ${selectedSeats.length > 0 ? (totalAmount + 1.5).toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            {!userId ? (
              <Button className="w-full" asChild>
                <Link href={`/auth/login?returnUrl=${encodeURIComponent(pathname)}`}>Sign in to Book</Link>
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={handleBooking}
                disabled={selectedSeats.length === 0 || isBooking}
              >
                {isBooking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Proceed to Checkout'
                )}
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Seats are held for 10 minutes during selection
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
