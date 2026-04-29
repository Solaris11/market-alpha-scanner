ALTER TABLE paper_positions
ADD COLUMN IF NOT EXISTS exit_price NUMERIC;

ALTER TABLE paper_positions
ADD COLUMN IF NOT EXISTS unrealized_pnl NUMERIC;
