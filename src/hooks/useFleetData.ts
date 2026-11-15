import { useCallback, useEffect, useState } from 'react';
import { createEmptyFleetData, type BackupData, type EntityKey, type FleetData, type RecordPayload } from '@/lib/fleetConfig';
import {
  clearAllRecords,
  deleteRecord,
  fetchAllRecords,
  insertRecord,
  replaceAllRecords,
  updateRecord,
} from '@/lib/fleetRepository';

export type LoadStatus = 'loading' | 'ready' | 'error';

export function useFleetData() {
  const [data, setData] = useState<FleetData>(createEmptyFleetData);
  const [status, setStatus] = useState<LoadStatus>('loading');

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      setData(await fetchAllRecords());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveRecord = useCallback(async (entity: EntityKey, id: string | null, payload: RecordPayload) => {
    const saved = id ? await updateRecord(entity, id, payload) : await insertRecord(entity, payload);
    setData(prev => ({
      ...prev,
      [entity]: id
        ? prev[entity].map(record => (record.id === id ? saved : record))
        : [...prev[entity], saved],
    }));
  }, []);

  const removeRecord = useCallback(async (entity: EntityKey, id: string) => {
    await deleteRecord(entity, id);
    setData(prev => ({ ...prev, [entity]: prev[entity].filter(record => record.id !== id) }));
  }, []);

  const restoreBackup = useCallback(
    async (backup: BackupData) => {
      await replaceAllRecords(backup);
      await reload();
    },
    [reload]
  );

  const clearAll = useCallback(async () => {
    await clearAllRecords();
    setData(createEmptyFleetData());
  }, []);

  return { data, status, reload, saveRecord, removeRecord, restoreBackup, clearAll };
}
