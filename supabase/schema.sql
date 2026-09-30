-- Apexlog database. Run once in the Supabase SQL editor of a new project.
-- Every table is owner-scoped by row-level security; the browser only ever uses
-- the anon key plus the signed-in user's token.

-- 1. Profiles: display currency and optional starting balance.
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency ~ '^[A-Z]{3,5}$'),
  starting_balance NUMERIC CHECK (starting_balance > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Trades. P&L = (exit - entry) x units x direction - fees, in the account currency.
CREATE TABLE trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  symbol TEXT,
  asset_class TEXT CHECK (asset_class IN ('stocks','crypto','forex','futures','options','other')),
  direction TEXT CHECK (direction IN ('LONG','SHORT')) NOT NULL,
  entry NUMERIC NOT NULL,
  exit_price NUMERIC,
  sl NUMERIC,
  tp NUMERIC,
  units NUMERIC CHECK (units > 0),
  fees NUMERIC CHECK (fees >= 0),
  rr NUMERIC,
  pnl NUMERIC,
  result TEXT CHECK (result IN ('WIN','LOSS','BE')),
  setup_type TEXT,
  mistakes TEXT[],
  emotional_notes TEXT,
  -- Per-trade checklist: {"items": [...], "checked": [...]}. NULL = Unplanned.
  checklist JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX trades_user_date_idx ON trades (user_id, date DESC);
CREATE INDEX trades_user_symbol_idx ON trades (user_id, symbol);

-- 3. Playbooks: the editable item list for each checklist type.
CREATE TABLE checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('premarket','trade','postmarket')) NOT NULL,
  items JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, type)
);

-- 4. Daily progress for the once-a-day checklists. `date` is the trader's LOCAL
-- calendar date, sent by the browser, so the reset happens at their midnight.
CREATE TABLE daily_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  type TEXT CHECK (type IN ('premarket','postmarket')) NOT NULL,
  checked_items JSONB DEFAULT '[]',
  UNIQUE(user_id, date, type)
);

-- 5. Trader-defined mistake tags.
CREATE TABLE custom_mistakes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row level security: each trader reads and writes only their own rows.
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own trades" ON trades FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own checklists" ON checklists FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE daily_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own daily_progress" ON daily_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE custom_mistakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own custom_mistakes" ON custom_mistakes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
