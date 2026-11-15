/*
  Add a dedicated, vehicle-linked archive category for ownership-transfer dossiers.
  Existing documents and their files remain unchanged.
*/
DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.archive_documents'::regclass
      AND contype = 'c'
      AND pg_catalog.pg_get_constraintdef(oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.archive_documents DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
END $$;

ALTER TABLE public.archive_documents
  ADD CONSTRAINT archive_documents_category_check
    CHECK (category IN ('driver', 'vehicle', 'ownership_transfer', 'inspection', 'committee', 'other')) NOT VALID,
  ADD CONSTRAINT archive_documents_driver_category_check
    CHECK (category <> 'driver' OR driver_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT archive_documents_vehicle_category_check
    CHECK (category NOT IN ('vehicle', 'ownership_transfer') OR vehicle_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT archive_documents_driver_link_check
    CHECK (driver_id IS NULL OR category IN ('driver', 'ownership_transfer')) NOT VALID,
  ADD CONSTRAINT archive_documents_vehicle_link_check
    CHECK (vehicle_id IS NULL OR category IN ('vehicle', 'ownership_transfer')) NOT VALID;

CREATE INDEX IF NOT EXISTS archive_documents_ownership_transfer_vehicle_idx
  ON public.archive_documents (vehicle_id, created_at DESC)
  WHERE category = 'ownership_transfer' AND archived_at IS NULL;
