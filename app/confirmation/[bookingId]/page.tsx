import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/header'
import { Booking, Showtime, Movie, Theater, BookedSeat, Seat } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircle2, Clock, Calendar, MapPin, Ticket, Home } from 'lucide-react'
import { format } from 'date-fns'

interface ConfirmationPageProps {
  params: Promise<{ bookingId: string }>
}

export default async function ConfirmationPage({ params }: ConfirmationPageProps) {
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

  // Only show confirmation for confirmed bookings
  if (booking.status !== 'confirmed') {
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
        <div className="mx-auto max-w-2xl">
          {/* Success Message */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">Booking Confirmed!</h1>
            <p className="text-muted-foreground">
              Your tickets have been booked successfully. Show this confirmation at the cinema.
            </p>
          </div>

          {/* Ticket Card */}
          <Card className="mb-6 overflow-hidden bg-card">
            {/* Ticket Header */}
            <div className="bg-primary px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ticket className="h-6 w-6 text-primary-foreground" />
                  <span className="font-semibold text-primary-foreground">E-Ticket</span>
                </div>
                <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground">
                  {sortedSeats.length} {sortedSeats.length === 1 ? 'Ticket' : 'Tickets'}
                </Badge>
              </div>
            </div>

            <CardContent className="p-6">
              {/* Movie Info */}
              <div className="mb-6 flex gap-4">
                <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-md">
                  <Image
                    src={typedBooking.showtime.movie.poster_url || "/placeholder.svg"}
                    alt={typedBooking.showtime.movie.title}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
                <div>
                  <Badge variant="secondary" className="mb-1">
                    {typedBooking.showtime.movie.genre}
                  </Badge>
                  <h2 className="text-xl font-bold text-foreground">
                    {typedBooking.showtime.movie.title}
                  </h2>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(typedBooking.showtime.show_date), 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {format(new Date(`${typedBooking.showtime.show_date}T${typedBooking.showtime.show_time}`), 'h:mm a')}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {typedBooking.showtime.theater.name}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Seats */}
              <div className="my-6">
                <p className="mb-3 text-sm font-medium text-muted-foreground">SEATS</p>
                <div className="flex flex-wrap gap-2">
                  {sortedSeats.map((bs) => (
                    <span
                      key={bs.id}
                      className="rounded-md bg-secondary px-4 py-2 text-lg font-bold text-secondary-foreground"
                    >
                      {bs.seat.row_label}{bs.seat.seat_number}
                    </span>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Booking Details */}
              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Booking ID</p>
                  <p className="font-mono font-medium text-foreground">
                    {typedBooking.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Paid</p>
                  <p className="font-bold text-primary">
                    ${(typedBooking.total_amount + 1.5).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Status</p>
                  <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                    Paid
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Booked On</p>
                  <p className="text-foreground">
                    {format(new Date(typedBooking.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </CardContent>

            {/* Dashed line effect */}
            <div className="relative">
              <div className="absolute left-0 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
              <div className="absolute right-0 h-6 w-6 -translate-y-1/2 translate-x-1/2 rounded-full bg-background" />
              <div className="border-t-2 border-dashed border-border" />
            </div>

            {/* QR Code Section */}
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 h-32 w-32 rounded-lg bg-foreground p-2">
                <div className="grid h-full w-full grid-cols-5 grid-rows-5 gap-0.5">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div
                      key={i}
                      className={`${Math.random() > 0.5 ? 'bg-background' : 'bg-transparent'}`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Scan this code at the cinema entrance
              </p>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="flex-1" asChild>
              <Link href="/my-bookings">
                <Ticket className="mr-2 h-4 w-4" />
                View My Bookings
              </Link>
            </Button>
            <Button variant="outline" className="flex-1 bg-transparent" asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
