-- Wallet system for automatic payment deduction
-- Each user has one wallet with a balance

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id),
  CONSTRAINT positive_balance CHECK (balance >= 0)
);

-- Create wallet transactions table for history
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('top_up', 'deduction', 'refund')),
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wallets
CREATE POLICY "Users can view their own wallet"
  ON wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own wallet"
  ON wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet"
  ON wallets FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for wallet_transactions
CREATE POLICY "Users can view their own transactions"
  ON wallet_transactions FOR SELECT
  USING (
    wallet_id IN (
      SELECT id FROM wallets WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create transactions for their wallet"
  ON wallet_transactions FOR INSERT
  WITH CHECK (
    wallet_id IN (
      SELECT id FROM wallets WHERE user_id = auth.uid()
    )
  );

-- Function to create wallet on user signup (trigger)
CREATE OR REPLACE FUNCTION create_wallet_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO wallets (user_id, balance)
  VALUES (NEW.id, 0.00)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create wallet on user signup
DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON auth.users;
CREATE TRIGGER on_auth_user_created_wallet
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_wallet_for_new_user();

-- Create wallets for existing users
INSERT INTO wallets (user_id, balance)
SELECT id, 0.00 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Function to add money to wallet
CREATE OR REPLACE FUNCTION add_to_wallet(
  p_user_id UUID,
  p_amount DECIMAL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_new_balance DECIMAL;
BEGIN
  -- Get or create wallet
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance)
    VALUES (p_user_id, p_amount)
    RETURNING id, balance INTO v_wallet_id, v_new_balance;
  ELSE
    UPDATE wallets
    SET balance = balance + p_amount, updated_at = NOW()
    WHERE id = v_wallet_id
    RETURNING balance INTO v_new_balance;
  END IF;
  
  -- Record transaction
  INSERT INTO wallet_transactions (wallet_id, type, amount, description)
  VALUES (v_wallet_id, 'top_up', p_amount, 'Wallet top-up');
  
  RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- Function to deduct from wallet
CREATE OR REPLACE FUNCTION deduct_from_wallet(
  p_user_id UUID,
  p_amount DECIMAL,
  p_booking_id UUID,
  p_description TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance DECIMAL;
  v_new_balance DECIMAL;
BEGIN
  -- Get wallet
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  
  IF v_wallet_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  IF v_current_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Deduct amount
  UPDATE wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;
  
  -- Record transaction
  INSERT INTO wallet_transactions (wallet_id, type, amount, description, booking_id)
  VALUES (v_wallet_id, 'deduction', p_amount, p_description, p_booking_id);
  
  RETURN json_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;
