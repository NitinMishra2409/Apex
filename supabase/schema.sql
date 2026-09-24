-- Run this in Supabase SQL Editor to set up the database

-- 1. trades table
CREATE TABLE trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  symbol TEXT,
  direction TEXT CHECK (direction IN ('LONG','SHORT')) NOT NULL,
  entry NUMERIC NOT NULL,
  exit_price NUMERIC,
  sl NUMERIC,
  tp NUMERIC,
  size NUMERIC,
  rr NUMERIC,
  pnl NUMERIC,
  result TEXT CHECK (result IN ('WIN','LOSS','BE')),
  setup_type TEXT,
  mistakes TEXT[],
  emotional_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-asset filtering in the trade log, analytics and simulator.
CREATE INDEX IF NOT EXISTS trades_user_symbol_idx ON trades (user_id, symbol);

-- 2. checklists table
CREATE TABLE checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('premarket','during','posttrade')) NOT NULL,
  items JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, type)
);

-- 3. daily_progress table
CREATE TABLE daily_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  type TEXT NOT NULL,
  checked_items JSONB DEFAULT '[]',
  UNIQUE(user_id, date, type)
);

-- 4. custom_mistakes table
CREATE TABLE custom_mistakes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own trades" ON trades FOR ALL USING (auth.uid() = user_id);

ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own checklists" ON checklists FOR ALL USING (auth.uid() = user_id);

ALTER TABLE daily_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own daily_progress" ON daily_progress FOR ALL USING (auth.uid() = user_id);

ALTER TABLE custom_mistakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own custom_mistakes" ON custom_mistakes FOR ALL USING (auth.uid() = user_id);

-- 5. user_profiles table (admin system)
CREATE TABLE user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages profiles" ON user_profiles
  FOR ALL USING (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id, is_admin)
  VALUES (NEW.id, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_profile();
