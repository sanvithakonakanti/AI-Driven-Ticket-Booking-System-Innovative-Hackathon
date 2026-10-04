'use client'

import Link from 'next/link'
import { Showtime, ShowtimeWithRelease } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format, isPast, formatDistanceToNow } from 'date-fns'
import { Zap, Clock } from 'lucide-react'

interface ShowtimeCardProps {
  showtime: Showtime | ShowtimeWithRelease
}

export function ShowtimeCard({ showtime }: ShowtimeCardProps) {
  // Combine date and time for display
  const dateTimeStr = `${showtime.show_date}T${showtime.show_time}`
  const showDateTime = new Date(dateTimeStr)
  const formattedTime = format(showDateTime, 'h:mm a')
  const formattedDate = format(new Date(showtime.show_date), 'EEE, MMM d')

  // Check if this is a showtime with ticket release info
  const showtimeWithRelease = showtime as ShowtimeWithRelease
  const releaseTime = showtimeWithRelease.ticket_release_time 
    ? new Date(showtimeWithRelease.ticket_release_time) 
    : null
  const isReleased = !releaseTime || isPast(releaseTime)

  return (
    <Card className="bg-card transition-all hover:ring-2 hover:ring-primary/50">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">{formattedTime}</span>
            <Badge variant="outline" className="text-xs">
              {showtime.theater?.name || 'Screen'}
            </Badge>
            {!isReleased && (
              <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-500">
                <Clock className="mr-1 h-3 w-3" />
                Pre-book
              </Badge>
            )}
          </div>
          <span className="text-sm text-muted-foreground">{formattedDate}</span>
          {!isReleased && releaseTime && (
            <span className="text-xs text-amber-500">
              Tickets release {formatDistanceToNow(releaseTime, { addSuffix: true })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-lg font-bold text-primary">${showtime.price.toFixed(2)}</span>
            <p className="text-xs text-muted-foreground">per seat</p>
          </div>
          {isReleased ? (
            <Button asChild>
              <Link href={`/book/${showtime.id}`}>Select Seats</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 bg-transparent">
              <Link href={`/pre-book/${showtime.id}`}>
                <Zap className="mr-2 h-4 w-4" />
                Pre-book
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
