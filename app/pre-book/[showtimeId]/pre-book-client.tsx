'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Wallet, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import type { Showtime, Movie, Theater, Seat, Wallet as WalletType, PreBooking } from '@/lib/types'
import { toast } from '@/hooks/use-toast'
import Link from 'next/link'

interface ShowtimeWithDetails extends Showtime {
  movie: Movie
  theater: Theater
  ticket_release_time: string | null
}

interface PreBookClientProps {
  showtime: ShowtimeWithDetails
  seats: Seat[]
  wallet: WalletType | null
  userId: string
  existingPreBooking: PreBooking | null
}

const SEAT_TYPE_PRICES = {
  standard: 1,
  premium: 1.25,
  vip: 1.5,
}

export function PreBookClient({ 
  showtime, 
  seats, 
  wallet, 
  userId,
  existingPreBooking 
}: PreBookClientProps) {
  const [selectedSeats, setSelectedSeats] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [isSuccess, setIsSuccess] = useState(!!existingPreBooking)
  const router = useRouter()
  const supabase = createClient()

  // Group seats by row
  const seatsByRow = seats.reduce((acc, seat) => {
    if (!acc[seat.row_label]) {
      acc[seat.row_label] = []
    }
    acc[seat.row_label].push(seat)
    return acc
  }, {} as Record<string, Seat[]>)

  const rows = Object.keys(seatsByRow).sort()

  // Calculate totals
  const selectedSeatObjects = seats.filter(s => selectedSeats.includes(s.id))
  const totalAmount = selectedSeatObjects.reduce((sum, seat) => {
    const multiplier = SEAT_TYPE_PRICES[seat.seat_type as keyof typeof SEAT_TYPE_PRICES] || 1
    return sum + (showtime.price * multiplier)
  }, 0)

  const hasInsufficientFunds = (wallet?.balance || 0) < totalAmount
  const canSubmit = selectedSeats.length > 0 && !hasInsufficientFunds && !isSuccess

  const toggleSeat = (seatId: string) => {
    if (isSuccess) return
    setSelectedSeats(prev => 
      prev.includes(seatId)
        ? prev.filter(id => id !== seatId)
        : [...prev, seatId]
    )
  }

  const handlePreBook = async () => {
    if (!canSubmit) return

    startTransition(async () => {
      try {
        // Create pre-booking
        const { data: preBooking, error: preBookError } = await supabase
          .from('pre_bookings')
          .insert({
            user_id: userId,
            showtime_id: showtime.id,
            status: 'queued',
            total_amount: totalAmount,
            priority: 0,
          })
          .select()
          .single()

        if (preBookError) throw preBookError

        // Create pre-booked seats
        const preBookedSeatsData = selectedSeatObjects.map(seat => ({
          pre_booking_id: preBooking.id,
          seat_id: seat.id,
          price: showtime.price * (SEAT_TYPE_PRICES[seat.seat_type as keyof typeof SEAT_TYPE_PRICES] || 1),
        }))

        const { error: seatsError } = await supabase
          .from('pre_booked_seats')
          .insert(preBookedSeatsData)

        if (seatsError) throw seatsError

        setIsSuccess(true)
        toast({ 
          title: 'Pre-booking created!', 
          description: 'Your seats are queued for automatic booking' 
        })

        // Redirect to auto-book page after a delay
        setTimeout(() => {
          router.push('/auto-book')
        }, 2000)
      } catch (error) {
        console.error('[v0] Pre-booking error:', error)
        toast({ 
          title: 'Error', 
          description: 'Failed to create pre-booking. Please try again.',
          variant: 'destructive' 
        })
      }
    })
  }

  if (existingPreBooking) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-green-500/20 p-4">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <h3 className="mt-4 text-xl font-semibold text-foreground">Pre-booking Already Exists</h3>
          <p className="mt-2 text-muted-foreground">
            You have already pre-booked seats for this showtime
          </p>
          <Button asChild className="mt-6">
            <Link href="/auto-book">View My Pre-bookings</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isSuccess) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-green-500/20 p-4">
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <h3 className="mt-4 text-xl font-semibold text-foreground">Pre-booking Confirmed!</h3>
          <p className="mt-2 text-muted-foreground">
            Your seats are queued for automatic booking when tickets release
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Redirecting to your pre-bookings...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Seat Map */}
      <div className="lg:col-span-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Select Your Seats</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Screen */}
            <div className="mb-8">
              <div className="mx-auto h-2 w-3/4 rounded-t-full bg-primary/30" />
              <p className="mt-2 text-center text-xs text-muted-foreground">SCREEN</p>
            </div>

            {/* Seat Grid */}
            <div className="flex flex-col items-center gap-2">
              {rows.map((row) => (
                <div key={row} className="flex items-center gap-2">
                  <span className="w-6 text-center text-sm font-medium text-muted-foreground">
                    {row}
                  </span>
                  <div className="flex gap-1">
                    {seatsByRow[row]
                      .sort((a, b) => a.seat_number - b.seat_number)
                      .map((seat) => {
                        const isSelected = selectedSeats.includes(seat.id)
                        
                        return (
                          <button
                            key={seat.id}
                            onClick={() => toggleSeat(seat.id)}
                            className={`
                              h-7 w-7 rounded-t-md text-xs font-medium transition-all
                              ${isSelected
                                ? 'bg-seat-selected text-white scale-110'
                                : seat.seat_type === 'vip'
                                ? 'bg-amber-500/30 text-amber-500 hover:bg-amber-500/50'
                                : seat.seat_type === 'premium'
                                ? 'bg-blue-500/30 text-blue-400 hover:bg-blue-500/50'
                                : 'bg-seat-available text-white hover:bg-seat-available/80'
                              }
                            `}
                            title={`${seat.row_label}${seat.seat_number} - ${seat.seat_type}`}
                          >
                            {seat.seat_number}
                          </button>
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-t-sm bg-seat-available" />
                <span className="text-muted-foreground">Standard</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-t-sm bg-blue-500/30" />
                <span className="text-muted-foreground">Premium (+25%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-t-sm bg-amber-500/30" />
                <span className="text-muted-foreground">VIP (+50%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-t-sm bg-seat-selected" />
                <span className="text-muted-foreground">Selected</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <div className="lg:col-span-1">
        <Card className="sticky top-24 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Pre-booking Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Wallet Balance */}
            <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Wallet Balance</span>
              </div>
              <span className="font-semibold text-foreground">${wallet?.balance.toFixed(2) || '0.00'}</span>
            </div>

            {/* Selected Seats */}
            {selectedSeats.length > 0 ? (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Selected Seats</p>
                <div className="flex flex-wrap gap-1">
                  {selectedSeatObjects.map((seat) => (
                    <Badge key={seat.id} variant="secondary">
                      {seat.row_label}{seat.seat_number}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Select seats to pre-book
              </p>
            )}

            {/* Price Breakdown */}
            {selectedSeats.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{selectedSeats.length} seat(s)</span>
                  <span className="text-foreground">${totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-foreground">Amount to Reserve</span>
                  <span className="text-primary">${totalAmount.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Insufficient Funds Warning */}
            {hasInsufficientFunds && selectedSeats.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="font-medium">Insufficient wallet balance</p>
                  <p className="text-xs">Add ${(totalAmount - (wallet?.balance || 0)).toFixed(2)} more</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <Button
                onClick={handlePreBook}
                disabled={!canSubmit || isPending}
                className="w-full"
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Queue Pre-booking
              </Button>
              
              {hasInsufficientFunds && (
                <Button variant="outline" asChild className="w-full bg-transparent">
                  <Link href="/wallet">Add Money to Wallet</Link>
                </Button>
              )}
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Money will be deducted from wallet when tickets are released
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
