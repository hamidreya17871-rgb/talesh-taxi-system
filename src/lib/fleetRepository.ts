import { ENTITY_KEYS, type BackupData, type EntityKey, type FleetRecord, type RecordPayload } from '@/lib/fleetConfig';
import { supabase } from '@/lib/supabase';

async function fetchTable(table: EntityKey): Promise<FleetRecord[]> {
  const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FleetRecord[];
}

export async function fetchAllRecords() {
  const [drivers, vehicles, licenses, documents, reminders, violations] = await Promise.all(
    ENTITY_KEYS.map(fetchTable)
  );
  return { drivers, vehicles, licenses, documents, reminders, violations };
}

export async function insertRecord(table: EntityKey, payload: RecordPayload): Promise<FleetRecord> {
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data as FleetRecord;
}

export async function updateRecord(table: EntityKey, id: string, payload: RecordPayload): Promise<FleetRecord> {
  const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data as FleetRecord;
}

export async function deleteRecord(table: EntityKey, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

async function deleteAllRows(table: EntityKey): Promise<void> {
  const { error } = await supabase.from(table).delete().not('id', 'is', null);
  if (error) throw error;
}

export async function clearAllRecords(): Promise<void> {
  for (const table of ENTITY_KEYS) {
    await deleteAllRows(table);
  }
}

export async function replaceAllRecords(backup: BackupData): Promise<void> {
  for (const table of ENTITY_KEYS) {
    const rows = backup[table];
    if (!rows) continue;

    if (rows.length === 0) {
      await deleteAllRows(table);
      continue;
    }

    const { error: upsertError } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (upsertError) throw upsertError;

    const keepIds = rows.map(row => row.id).join(',');
    const { error: deleteError } = await supabase.from(table).delete().not('id', 'in', `(${keepIds})`);
    if (deleteError) throw deleteError;
  }
}
