import Link from 'next/link'
import Image from 'next/image'
import { Booking, Showtime, Movie, Theater, BookedSeat, Seat } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Calendar, MapPin, Ticket } from 'lucide-react'
import { format, isPast } from 'date-fns'

interface BookingCardProps {
  booking: Booking & {
    showtime: Showtime & { movie: Movie; theater: Theater }
    booked_seats: (BookedSeat & { seat: Seat })[]
  }
}

export function BookingCard({ booking }: BookingCardProps) {
  const showDateTime = new Date(`${booking.showtime.show_date}T${booking.showtime.show_time}`)
  const isPastShowtime = isPast(showDateTime)
  
  // Sort seats
  const sortedSeats = booking.booked_seats.sort((a, b) => {
    if (a.seat.row_label !== b.seat.row_label) {
      return a.seat.row_label.localeCompare(b.seat.row_label)
    }
    return a.seat.seat_number - b.seat.seat_number
  })

  const getStatusBadge = () => {
    if (booking.status === 'cancelled') {
      return <Badge variant="destructive">Cancelled</Badge>
    }
    if (isPastShowtime) {
      return <Badge variant="secondary">Completed</Badge>
    }
    if (booking.status === 'confirmed') {
      return <Badge className="bg-green-500/20 text-green-500">Confirmed</Badge>
    }
    return <Badge variant="outline">Pending</Badge>
  }

  return (
    <Card className="overflow-hidden bg-card transition-all hover:ring-1 hover:ring-border">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Movie Poster */}
          <div className="relative h-48 w-full sm:h-auto sm:w-32 flex-shrink-0">
            <Image
              src={booking.showtime.movie.poster_url || "/placeholder.svg"}
              alt={booking.showtime.movie.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 128px"
            />
          </div>

          {/* Booking Details */}
          <div className="flex flex-1 flex-col p-4">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {booking.showtime.movie.title}
                </h3>
                <Badge variant="secondary" className="mt-1">
                  {booking.showtime.movie.genre}
                </Badge>
              </div>
              {getStatusBadge()}
            </div>

            <div className="mb-4 space-y-1 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(new Date(booking.showtime.show_date), 'EEE, MMM d, yyyy')}
              </p>
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {format(showDateTime, 'h:mm a')}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {booking.showtime.theater.name}
              </p>
            </div>

            {/* Seats */}
            <div className="mb-4">
              <p className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
                <Ticket className="h-4 w-4" />
                Seats:
              </p>
              <div className="flex flex-wrap gap-1">
                {sortedSeats.map((bs) => (
                  <span
                    key={bs.id}
                    className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                  >
                    {bs.seat.row_label}{bs.seat.seat_number}
                  </span>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-auto flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="font-bold text-primary">
                  ${(booking.total_amount + 1.5).toFixed(2)}
                </p>
              </div>
              {booking.status === 'confirmed' && !isPastShowtime && (
                <Button size="sm" asChild>
                  <Link href={`/confirmation/${booking.id}`}>View Ticket</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
