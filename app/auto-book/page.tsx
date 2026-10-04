'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Zap, Clock, CheckCircle, XCircle, Film, Calendar, MapPin, Loader2, Trash2, AlertCircle } from 'lucide-react'
import { format, formatDistanceToNow, isPast } from 'date-fns'
import type { PreBooking, Showtime, Movie, Wallet } from '@/lib/types'
import Link from 'next/link'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from '@/hooks/use-toast'

interface PreBookingWithDetails extends PreBooking {
  showtime: Showtime & {
    movie: Movie
    ticket_release_time: string
  }
  pre_booked_seats: Array<{
    id: string
    seat_id: string
    price: number
    seat: {
      row_label: string
      seat_number: number
      seat_type: string
    }
  }>
}

export default function AutoBookPage() {
  const [preBookings, setPreBookings] = useState<PreBookingWithDetails[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Load wallet
      const { data: walletData } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (walletData) {
        setWallet(walletData as Wallet)
      }

      // Load pre-bookings with details
      const { data: preBookingsData, error } = await supabase
        .from('pre_bookings')
        .select(`
          *,
          showtime:showtimes(
            *,
            movie:movies(*),
            theater:theaters(*)
          ),
          pre_booked_seats(
            *,
            seat:seats(*)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[v0] Error loading pre-bookings:', error)
      } else if (preBookingsData) {
        setPreBookings(preBookingsData as PreBookingWithDetails[])
      }

      setLoading(false)
    }

    loadData()

    // Subscribe to pre-booking updates
    const channel = supabase
      .channel('prebooking-updates')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pre_bookings' },
        async () => {
          // Reload pre-bookings on any change
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return
          
          const { data } = await supabase
            .from('pre_bookings')
            .select(`
              *,
              showtime:showtimes(
                *,
                movie:movies(*),
                theater:theaters(*)
              ),
              pre_booked_seats(
                *,
                seat:seats(*)
              )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
          
          if (data) {
            setPreBookings(data as PreBookingWithDetails[])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, router])

  const handleCancel = async (preBookingId: string) => {
    const { error } = await supabase
      .from('pre_bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', preBookingId)

    if (error) {
      toast({ title: 'Error', description: 'Failed to cancel pre-booking', variant: 'destructive' })
    } else {
      toast({ title: 'Cancelled', description: 'Pre-booking has been cancelled' })
      setPreBookings(prev => prev.map(pb => 
        pb.id === preBookingId ? { ...pb, status: 'cancelled' } : pb
      ))
    }
  }

  const queuedBookings = preBookings.filter(pb => pb.status === 'queued')
  const completedBookings = preBookings.filter(pb => pb.status === 'completed')
  const failedBookings = preBookings.filter(pb => pb.status === 'failed' || pb.status === 'cancelled')

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Auto-Book</h1>
            <p className="mt-2 text-muted-foreground">
              Pre-select seats and book automatically when tickets release
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Card className="border-border bg-card px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Wallet Balance:</span>
                <span className="font-bold text-foreground">${wallet?.balance.toFixed(2) || '0.00'}</span>
              </div>
            </Card>
            <Button asChild>
              <Link href="/wallet">Add Funds</Link>
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-full bg-primary/20 p-3">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">How Auto-Book Works</h3>
              <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>1. Browse upcoming movies and select a showtime</li>
                <li>2. Pre-select your preferred seats before tickets go live</li>
                <li>3. Ensure sufficient wallet balance for automatic payment</li>
                <li>4. When tickets release, we auto-book your seats instantly</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Pre-bookings Tabs */}
        <Tabs defaultValue="queued">
          <TabsList className="mb-6">
            <TabsTrigger value="queued" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Queued ({queuedBookings.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Completed ({completedBookings.length})
            </TabsTrigger>
            <TabsTrigger value="failed" className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Failed/Cancelled ({failedBookings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queued">
            {queuedBookings.length === 0 ? (
              <EmptyState 
                title="No queued bookings"
                description="Browse movies and pre-select seats to queue automatic bookings"
                actionLabel="Browse Movies"
                actionHref="/"
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {queuedBookings.map((pb) => (
                  <PreBookingCard 
                    key={pb.id} 
                    preBooking={pb} 
                    onCancel={handleCancel}
                    walletBalance={wallet?.balance || 0}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {completedBookings.length === 0 ? (
              <EmptyState 
                title="No completed bookings yet"
                description="Completed auto-bookings will appear here"
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {completedBookings.map((pb) => (
                  <PreBookingCard 
                    key={pb.id} 
                    preBooking={pb}
                    walletBalance={wallet?.balance || 0}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="failed">
            {failedBookings.length === 0 ? (
              <EmptyState 
                title="No failed or cancelled bookings"
                description="Failed or cancelled pre-bookings will appear here"
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {failedBookings.map((pb) => (
                  <PreBookingCard 
                    key={pb.id} 
                    preBooking={pb}
                    walletBalance={wallet?.balance || 0}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

function PreBookingCard({ 
  preBooking, 
  onCancel,
  walletBalance 
}: { 
  preBooking: PreBookingWithDetails
  onCancel?: (id: string) => void
  walletBalance: number
}) {
  const showtime = preBooking.showtime
  const movie = showtime?.movie
  const seats = preBooking.pre_booked_seats
  const releaseTime = showtime?.ticket_release_time ? new Date(showtime.ticket_release_time) : null
  const isReleased = releaseTime ? isPast(releaseTime) : false
  const hasInsufficientFunds = walletBalance < preBooking.total_amount

  const statusConfig = {
    queued: { color: 'bg-amber-500/20 text-amber-500', label: 'Queued' },
    processing: { color: 'bg-blue-500/20 text-blue-500', label: 'Processing' },
    completed: { color: 'bg-green-500/20 text-green-500', label: 'Completed' },
    failed: { color: 'bg-red-500/20 text-red-500', label: 'Failed' },
    cancelled: { color: 'bg-gray-500/20 text-gray-400', label: 'Cancelled' },
  }

  const status = statusConfig[preBooking.status]

  return (
    <Card className="border-border bg-card overflow-hidden">
      <div className="flex">
        {movie?.poster_url && (
          <div className="hidden sm:block w-24 flex-shrink-0">
            <img
              src={movie.poster_url || '/placeholder.svg'}
              alt={movie.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-foreground line-clamp-1">{movie?.title}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {showtime?.show_date ? format(new Date(showtime.show_date), 'MMM d') : 'N/A'}
                </span>
                <span>{showtime?.show_time ? format(new Date(`2000-01-01T${showtime.show_time}`), 'h:mm a') : 'N/A'}</span>
              </div>
            </div>
            <Badge className={status.color}>{status.label}</Badge>
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            {seats?.map((s) => (
              <Badge key={s.id} variant="outline" className="text-xs">
                {s.seat?.row_label}{s.seat?.seat_number}
              </Badge>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div>
              <span className="text-lg font-bold text-foreground">${preBooking.total_amount.toFixed(2)}</span>
            </div>
            {preBooking.status === 'queued' && releaseTime && (
              <div className="text-right text-xs text-muted-foreground">
                {isReleased ? (
                  <span className="text-primary">Processing soon...</span>
                ) : (
                  <span>Releases {formatDistanceToNow(releaseTime, { addSuffix: true })}</span>
                )}
              </div>
            )}
          </div>

          {preBooking.status === 'queued' && hasInsufficientFunds && (
            <div className="mt-2 flex items-center gap-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
              <AlertCircle className="h-4 w-4" />
              Insufficient wallet balance
            </div>
          )}

          {preBooking.failure_reason && (
            <div className="mt-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
              {preBooking.failure_reason}
            </div>
          )}

          {preBooking.status === 'completed' && preBooking.booking_id && (
            <Button asChild size="sm" className="mt-3 w-full">
              <Link href={`/confirmation/${preBooking.booking_id}`}>View Ticket</Link>
            </Button>
          )}

          {preBooking.status === 'queued' && onCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="mt-3 w-full bg-transparent">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Cancel Pre-booking
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Pre-booking?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove your seat reservation from the queue. You can create a new pre-booking later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep It</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onCancel(preBooking.id)}>
                    Yes, Cancel
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </Card>
  )
}

function EmptyState({ 
  title, 
  description, 
  actionLabel, 
  actionHref 
}: { 
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
      <Film className="mb-4 h-12 w-12 text-muted-foreground/50" />
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {actionLabel && actionHref && (
        <Button asChild className="mt-4">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  )
}
