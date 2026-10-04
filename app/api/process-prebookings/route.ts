import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// This API route processes all queued pre-bookings that are ready
// It should be called periodically (e.g., via cron job or manual trigger)
export async function POST(request: Request) {
  try {
    // Optional: Add a secret key for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    // If CRON_SECRET is set, validate it
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Get all pre-bookings that are ready to process
    const { data: readyPreBookings, error: fetchError } = await supabase
      .rpc('get_ready_pre_bookings')

    if (fetchError) {
      console.error('[v0] Error fetching ready pre-bookings:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch pre-bookings' }, { status: 500 })
    }

    if (!readyPreBookings || readyPreBookings.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No pre-bookings to process',
        processed: 0 
      })
    }

    const results = []

    // Process each pre-booking
    for (const preBooking of readyPreBookings) {
      const { data: result, error: processError } = await supabase
        .rpc('process_pre_booking', { p_pre_booking_id: preBooking.pre_booking_id })

      if (processError) {
        console.error(`[v0] Error processing pre-booking ${preBooking.pre_booking_id}:`, processError)
        results.push({
          pre_booking_id: preBooking.pre_booking_id,
          success: false,
          error: processError.message
        })
      } else {
        results.push({
          pre_booking_id: preBooking.pre_booking_id,
          ...result
        })
      }
    }

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Processed ${readyPreBookings.length} pre-bookings`,
      processed: readyPreBookings.length,
      successful,
      failed,
      results
    })
  } catch (error) {
    console.error('[v0] Unexpected error in process-prebookings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Allow GET for easy testing/manual triggering
export async function GET(request: Request) {
  return POST(request)
}
