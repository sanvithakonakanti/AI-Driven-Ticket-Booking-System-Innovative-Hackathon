import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, MapPin, Zap } from 'lucide-react'
import { format, formatDistanceToNow, isPast } from 'date-fns'
import type { Showtime, Movie, Theater } from '@/lib/types'
import { PreBookClient } from './pre-book-client'
import Image from 'next/image'

interface ShowtimeWithDetails extends Showtime {
  movie: Movie
  theater: Theater
  ticket_release_time: string | null
}

export default async function PreBookPage({
  params,
}: {
  params: Promise<{ showtimeId: string }>
}) {
  const { showtimeId } = await params
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  // Fetch showtime with movie and theater details
  const { data: showtime, error } = await supabase
    .from('showtimes')
    .select(`
      *,
      movie:movies(*),
      theater:theaters(*)
    `)
    .eq('id', showtimeId)
    .single()

  if (error || !showtime) {
    redirect('/')
  }

  const typedShowtime = showtime as ShowtimeWithDetails

  // Check if tickets are already released (if so, redirect to normal booking)
  if (typedShowtime.ticket_release_time && isPast(new Date(typedShowtime.ticket_release_time))) {
    redirect(`/book/${showtimeId}`)
  }

  // Fetch seats for the theater
  const { data: seats } = await supabase
    .from('seats')
    .select('*')
    .eq('theater_id', typedShowtime.theater_id)
    .order('row_label')
    .order('seat_number')

  // Fetch user's wallet
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Check if user already has a pre-booking for this showtime
  const { data: existingPreBooking } = await supabase
    .from('pre_bookings')
    .select('*')
    .eq('user_id', user.id)
    .eq('showtime_id', showtimeId)
    .eq('status', 'queued')
    .single()

  const releaseTime = typedShowtime.ticket_release_time 
    ? new Date(typedShowtime.ticket_release_time) 
    : null

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Info Banner */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-primary/20 p-2">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Pre-Book Mode</p>
              <p className="text-sm text-muted-foreground">
                {releaseTime 
                  ? `Tickets release ${formatDistanceToNow(releaseTime, { addSuffix: true })}. Select seats now and we'll book automatically!`
                  : 'Select your preferred seats for automatic booking when tickets go live.'
                }
              </p>
            </div>
            {releaseTime && (
              <Badge variant="outline" className="hidden sm:flex">
                Release: {format(releaseTime, 'MMM d, h:mm a')}
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Movie Info */}
        <Card className="mb-6 border-border bg-card">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="hidden sm:block w-20 flex-shrink-0 overflow-hidden rounded-md">
                <Image
                  src={typedShowtime.movie.poster_url || '/placeholder.svg'}
                  alt={typedShowtime.movie.title}
                  width={80}
                  height={120}
                  className="h-auto w-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-foreground">{typedShowtime.movie.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(typedShowtime.show_date), 'EEE, MMM d, yyyy')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {format(new Date(`${typedShowtime.show_date}T${typedShowtime.show_time}`), 'h:mm a')}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {typedShowtime.theater.name}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pre-book Client */}
        <PreBookClient
          showtime={typedShowtime}
          seats={seats || []}
          wallet={wallet}
          userId={user.id}
          existingPreBooking={existingPreBooking}
        />
      </main>
    </div>
  )
}
