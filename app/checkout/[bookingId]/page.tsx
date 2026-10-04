import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/header'
import { CheckoutClient } from './checkout-client'
import { Booking, Showtime, Movie, Theater, BookedSeat, Seat } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Clock, Calendar, MapPin, Ticket } from 'lucide-react'
import { format } from 'date-fns'

interface CheckoutPageProps {
  params: Promise<{ bookingId: string }>
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { bookingId } = await params
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Fetch booking with all related data
  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      *,
      showtime:showtimes(
        *,
        movie:movies(*),
        theater:theaters(*)
      ),
      booked_seats(
        *,
        seat:seats(*)
      )
    `)
    .eq('id', bookingId)
    .eq('user_id', user.id)
    .single()

  if (error || !booking) {
    notFound()
  }

  // Check if already completed
  if (booking.status === 'confirmed') {
    redirect(`/confirmation/${bookingId}`)
  }

  // Check if cancelled
  if (booking.status === 'cancelled') {
    redirect('/my-bookings')
  }

  const typedBooking = booking as Booking & {
    showtime: Showtime & { movie: Movie; theater: Theater }
    booked_seats: (BookedSeat & { seat: Seat })[]
  }

  // Sort seats
  const sortedSeats = typedBooking.booked_seats.sort((a, b) => {
    if (a.seat.row_label !== b.seat.row_label) {
      return a.seat.row_label.localeCompare(b.seat.row_label)
    }
    return a.seat.seat_number - b.seat.seat_number
  })

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button variant="ghost" className="mb-6" asChild>
          <Link href={`/book/${typedBooking.showtime_id}`} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Seat Selection
          </Link>
        </Button>

        <div className="mx-auto max-w-2xl">
          <h1 className="mb-8 text-center text-3xl font-bold text-foreground">Checkout</h1>

          {/* Booking Details Card */}
          <Card className="mb-6 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                Your Booking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Movie Info */}
              <div className="flex gap-4">
                <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-md">
                  <Image
                    src={typedBooking.showtime.movie.poster_url || "/placeholder.svg"}
                    alt={typedBooking.showtime.movie.title}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <div>
                  <Badge variant="secondary" className="mb-1">
                    {typedBooking.showtime.movie.genre}
                  </Badge>
                  <h2 className="text-lg font-semibold text-foreground">
                    {typedBooking.showtime.movie.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(typedBooking.showtime.show_date), 'EEE, MMM d')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {format(new Date(`${typedBooking.showtime.show_date}T${typedBooking.showtime.show_time}`), 'h:mm a')}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {typedBooking.showtime.theater.name}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Selected Seats */}
              <div>
                <h3 className="mb-3 font-medium text-foreground">Selected Seats</h3>
                <div className="flex flex-wrap gap-2">
                  {sortedSeats.map((bs) => (
                    <span
                      key={bs.id}
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                    >
                      {bs.seat.row_label}{bs.seat.seat_number}
                      {bs.seat.seat_type !== 'standard' && (
                        <span className="ml-1 text-xs opacity-75">({bs.seat.seat_type})</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Price Breakdown */}
              <div className="space-y-2">
                <h3 className="mb-3 font-medium text-foreground">Price Details</h3>
                {sortedSeats.map((bs) => (
                  <div key={bs.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Seat {bs.seat.row_label}{bs.seat.seat_number}
                      {bs.seat.seat_type !== 'standard' && ` (${bs.seat.seat_type})`}
                    </span>
                    <span className="text-foreground">${bs.price.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Booking Fee</span>
                  <span className="text-foreground">$1.50</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-lg font-semibold">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary">${(typedBooking.total_amount + 1.5).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Section */}
          <CheckoutClient booking={typedBooking} />
        </div>
      </main>
    </div>
  )
}
