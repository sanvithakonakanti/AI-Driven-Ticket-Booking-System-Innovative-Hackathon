'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Clock, CreditCard, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import type { Wallet as WalletType, WalletTransaction } from '@/lib/types'
import { toast } from '@/hooks/use-toast'

const QUICK_AMOUNTS = [100, 250, 500, 1000]

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletType | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [customAmount, setCustomAmount] = useState('')
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadWallet() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Get or create wallet
      let { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (walletError && walletError.code === 'PGRST116') {
        // Wallet doesn't exist, create one
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .insert({ user_id: user.id, balance: 0 })
          .select()
          .single()
        
        if (createError) {
          console.error('[v0] Error creating wallet:', createError)
          toast({ title: 'Error', description: 'Failed to create wallet', variant: 'destructive' })
          return
        }
        walletData = newWallet
      }

      if (walletData) {
        setWallet(walletData as WalletType)
        
        // Load transactions
        const { data: txns } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('wallet_id', walletData.id)
          .order('created_at', { ascending: false })
          .limit(50)
        
        if (txns) {
          setTransactions(txns as WalletTransaction[])
        }
      }
      
      setLoading(false)
    }

    loadWallet()

    // Subscribe to wallet changes
    const channel = supabase
      .channel('wallet-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'wallets' },
        (payload) => {
          if (payload.new) {
            setWallet(payload.new as WalletType)
          }
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wallet_transactions' },
        (payload) => {
          if (payload.new) {
            setTransactions(prev => [payload.new as WalletTransaction, ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, router])

  const handleAddMoney = async () => {
    const amount = selectedAmount || (customAmount ? parseFloat(customAmount) : 0)
    
    if (!amount || amount <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid amount', variant: 'destructive' })
      return
    }

    if (!wallet) return

    startTransition(async () => {
      // Call the add_to_wallet function
      const { data, error } = await supabase
        .rpc('add_to_wallet', {
          p_user_id: wallet.user_id,
          p_amount: amount,
          p_description: 'Wallet top-up'
        })

      if (error) {
        console.error('[v0] Error adding money:', error)
        toast({ title: 'Error', description: 'Failed to add money to wallet', variant: 'destructive' })
        return
      }

      toast({ title: 'Success', description: `Added $${amount.toFixed(2)} to your wallet` })
      setCustomAmount('')
      setSelectedAmount(null)
      
      // Refresh wallet data
      const { data: updatedWallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', wallet.id)
        .single()
      
      if (updatedWallet) {
        setWallet(updatedWallet as WalletType)
      }

      // Refresh transactions
      const { data: txns } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (txns) {
        setTransactions(txns as WalletTransaction[])
      }
    })
  }

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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">My Wallet</h1>
          <p className="mt-2 text-muted-foreground">
            Add money to your wallet for instant automated bookings
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Balance Card */}
          <Card className="lg:col-span-1 border-border bg-card">
            <CardHeader className="pb-4">
              <CardDescription className="text-muted-foreground">Available Balance</CardDescription>
              <CardTitle className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-foreground">
                  ${wallet?.balance.toFixed(2) || '0.00'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-3">
                <Wallet className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">
                  Used for automatic ticket bookings
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Add Money Card */}
          <Card className="lg:col-span-2 border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Plus className="h-5 w-5" />
                Add Money
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Top up your wallet to enable auto-booking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quick amounts */}
              <div className="space-y-2">
                <Label className="text-foreground">Quick Select</Label>
                <div className="flex flex-wrap gap-3">
                  {QUICK_AMOUNTS.map((amount) => (
                    <Button
                      key={amount}
                      variant={selectedAmount === amount ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedAmount(amount)
                        setCustomAmount('')
                      }}
                      className="min-w-[80px]"
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom amount */}
              <div className="space-y-2">
                <Label htmlFor="custom-amount" className="text-foreground">Or Enter Custom Amount</Label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="custom-amount"
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7 bg-input text-foreground"
                      value={customAmount}
                      onChange={(e) => {
                        setCustomAmount(e.target.value)
                        setSelectedAmount(null)
                      }}
                    />
                  </div>
                  <Button 
                    onClick={handleAddMoney}
                    disabled={isPending || (!selectedAmount && !customAmount)}
                    className="min-w-[140px]"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Add Money
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions */}
        <div className="mt-8">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">Transaction History</CardTitle>
              <CardDescription className="text-muted-foreground">
                Your recent wallet activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all">
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="credits">Credits</TabsTrigger>
                  <TabsTrigger value="debits">Debits</TabsTrigger>
                </TabsList>

                <TabsContent value="all">
                  <TransactionList transactions={transactions} />
                </TabsContent>
                <TabsContent value="credits">
                  <TransactionList transactions={transactions.filter(t => t.type === 'credit' || t.type === 'refund')} />
                </TabsContent>
                <TabsContent value="debits">
                  <TransactionList transactions={transactions.filter(t => t.type === 'deduction')} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

function TransactionList({ transactions }: { transactions: WalletTransaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">No transactions yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {transactions.map((txn) => (
        <div
          key={txn.id}
          className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4"
        >
          <div className="flex items-center gap-4">
            <div className={`rounded-full p-2 ${
              txn.type === 'credit' || txn.type === 'refund'
                ? 'bg-green-500/20 text-green-500'
                : 'bg-red-500/20 text-red-500'
            }`}>
              {txn.type === 'credit' || txn.type === 'refund' ? (
                <ArrowDownLeft className="h-4 w-4" />
              ) : (
                <ArrowUpRight className="h-4 w-4" />
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">{txn.description}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(txn.created_at), 'MMM d, yyyy • h:mm a')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`font-semibold ${
              txn.type === 'credit' || txn.type === 'refund'
                ? 'text-green-500'
                : 'text-red-500'
            }`}>
              {txn.type === 'credit' || txn.type === 'refund' ? '+' : '-'}${txn.amount.toFixed(2)}
            </p>
            <Badge variant="secondary" className="mt-1">
              {txn.type}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  )
}
