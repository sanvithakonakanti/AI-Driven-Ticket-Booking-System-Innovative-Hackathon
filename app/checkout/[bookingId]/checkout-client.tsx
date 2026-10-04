'use client'

import React from "react"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Booking } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CreditCard, Loader2, Lock } from 'lucide-react'

interface CheckoutClientProps {
  booking: Booking
}

export function CheckoutClient({ booking }: CheckoutClientProps) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [name, setName] = useState('')
  const supabase = createClient()

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = (matches && matches[0]) || ''
    const parts = []
    for (let i = 0; i < match.length; i += 4) {
      parts.push(match.substring(i, i + 4))
    }
    return parts.length ? parts.join(' ') : v
  }

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4)
    }
    return v
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Basic validation
    if (cardNumber.replace(/\s/g, '').length < 16) {
      toast.error('Please enter a valid card number')
      return
    }
    if (expiry.length < 5) {
      toast.error('Please enter a valid expiry date')
      return
    }
    if (cvv.length < 3) {
      toast.error('Please enter a valid CVV')
      return
    }
    if (!name.trim()) {
      toast.error('Please enter the cardholder name')
      return
    }

    setIsProcessing(true)

    try {
      // Simulate payment processing (in production, integrate with Stripe/payment provider)
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Update booking status
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          payment_status: 'completed',
        })
        .eq('id', booking.id)

      if (error) throw error

      // Clear any remaining seat locks
      await supabase
        .from('seat_locks')
        .delete()
        .eq('showtime_id', booking.showtime_id)
        .eq('user_id', booking.user_id)

      toast.success('Payment successful!')
      router.push(`/confirmation/${booking.id}`)
    } catch (error) {
      console.error('Payment error:', error)
      toast.error('Payment failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = async () => {
    try {
      // Update booking status to cancelled
      await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', booking.id)

      // Clear seat locks
      await supabase
        .from('seat_locks')
        .delete()
        .eq('showtime_id', booking.showtime_id)
        .eq('user_id', booking.user_id)

      toast.info('Booking cancelled')
      router.push('/')
    } catch (error) {
      console.error('Cancel error:', error)
      toast.error('Failed to cancel booking')
    }
  }

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Payment Details
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cardName">Cardholder Name</Label>
            <Input
              id="cardName"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input
              id="cardNumber"
              placeholder="1234 5678 9012 3456"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              maxLength={19}
              disabled={isProcessing}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiry">Expiry Date</Label>
              <Input
                id="expiry"
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                maxLength={5}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cvv">CVV</Label>
              <Input
                id="cvv"
                placeholder="123"
                type="password"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                disabled={isProcessing}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span>Your payment information is secure and encrypted</span>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing Payment...
              </>
            ) : (
              `Pay $${(booking.total_amount + 1.5).toFixed(2)}`
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={handleCancel}
            disabled={isProcessing}
          >
            Cancel Booking
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
