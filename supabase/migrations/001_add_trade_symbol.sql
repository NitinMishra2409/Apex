-- Adds the asset/symbol field to trades.
--
-- Run this on an EXISTING database. New projects get it from schema.sql already.
-- Safe to run more than once.
--
-- Symbols are stored normalised and uppercased with no separator: BTCUSDT, not
-- "btc/usdt" or "BTC-USDT". src/lib/symbols.js does the normalising client-side
-- so that "bee tee see you ess dee tee" from voice and "BTC/USDT" typed by hand
-- both land on the same value.

ALTER TABLE trades ADD COLUMN IF NOT EXISTS symbol TEXT;

CREATE INDEX IF NOT EXISTS trades_user_symbol_idx ON trades (user_id, symbol);

-- Existing rows keep symbol = NULL, which the UI shows as "Unspecified".
-- To backfill everything to one asset (only if you traded a single pair):
--   UPDATE trades SET symbol = 'BTCUSDT' WHERE symbol IS NULL;
