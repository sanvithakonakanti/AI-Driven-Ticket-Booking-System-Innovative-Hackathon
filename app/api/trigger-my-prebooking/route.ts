import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// This API allows a user to manually trigger processing of their own pre-bookings
// Useful for testing or when user wants immediate processing
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { preBookingId } = body

    if (!preBookingId) {
      return NextResponse.json({ error: 'preBookingId is required' }, { status: 400 })
    }

    // Verify the pre-booking belongs to this user
    const { data: preBooking, error: fetchError } = await supabase
      .from('pre_bookings')
      .select('*, showtime:showtimes(ticket_release_time)')
      .eq('id', preBookingId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !preBooking) {
      return NextResponse.json({ error: 'Pre-booking not found' }, { status: 404 })
    }

    if (preBooking.status !== 'queued') {
      return NextResponse.json({ 
        error: 'Pre-booking is not in queued status',
        currentStatus: preBooking.status 
      }, { status: 400 })
    }

    // Check if tickets are released
    const releaseTime = preBooking.showtime?.ticket_release_time
    if (releaseTime && new Date(releaseTime) > new Date()) {
      return NextResponse.json({ 
        error: 'Tickets are not yet released',
        releaseTime 
      }, { status: 400 })
    }

    // Process the pre-booking
    const { data: result, error: processError } = await supabase
      .rpc('process_pre_booking', { p_pre_booking_id: preBookingId })

    if (processError) {
      console.error('[v0] Error processing pre-booking:', processError)
      return NextResponse.json({ 
        success: false,
        error: processError.message 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: result?.success || false,
      booking_id: result?.booking_id,
      error: result?.error
    })
  } catch (error) {
    console.error('[v0] Unexpected error in trigger-my-prebooking:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
