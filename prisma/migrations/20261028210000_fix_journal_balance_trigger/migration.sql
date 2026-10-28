-- The original trigger read NEW.entry_id, a column journal_lines never had
-- (it is "entryId"), so every journal with lines failed at commit with
-- 42703 and no journal was ever posted. Same check, correct column.
CREATE OR REPLACE FUNCTION check_journal_balance() RETURNS trigger AS $$
DECLARE
  target_entry text := COALESCE(NEW."entryId", OLD."entryId");
  total_debit numeric;
  total_credit numeric;
  entry_status text;
BEGIN
  SELECT status INTO entry_status FROM journal_entries WHERE id = target_entry;

  -- The entry is gone (deleted with its lines): nothing left to balance.
  IF entry_status IS NULL OR entry_status <> 'POSTED' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN side = 'DEBIT' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN side = 'CREDIT' THEN amount ELSE 0 END), 0)
  INTO total_debit, total_credit
  FROM journal_lines WHERE "entryId" = target_entry;

  IF total_debit <> total_credit THEN
    RAISE EXCEPTION 'Journal entry % unbalanced: DR=%, CR=%',
      target_entry, total_debit, total_credit;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
