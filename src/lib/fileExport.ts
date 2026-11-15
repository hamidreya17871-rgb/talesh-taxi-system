import {
  ENTITY_KEYS,
  entityConfigs,
  type BackupData,
  type EntityKey,
  type FleetData,
  type FleetRecord,
  type RecordValue,
  type RestoreRow,
} from '@/lib/fleetConfig';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function downloadFile(content: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function buildCsv(entity: EntityKey, records: FleetRecord[]): string {
  const { columns } = entityConfigs[entity];
  const csvCell = (value: RecordValue) => `"${String(value ?? '').split('"').join('""')}"`;
  const lines = [
    columns.map(column => column.label).join(','),
    ...records.map(record => columns.map(column => csvCell(record[column.key])).join(',')),
  ];
  return '\ufeff' + lines.join('\r\n');
}

export function buildBackup(data: FleetData): string {
  return JSON.stringify(data, null, 2);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toRestoreRow(entity: EntityKey, row: Record<string, unknown>): RestoreRow | null {
  if (typeof row.id !== 'string' || !UUID_PATTERN.test(row.id)) return null;
  const restored: RestoreRow = { id: row.id };
  for (const field of entityConfigs[entity].fields) {
    const value = row[field.key];
    restored[field.key] = typeof value === 'string' || typeof value === 'number' ? value : null;
  }
  return restored;
}

export function parseBackup(text: string): BackupData {
  const parsed: unknown = JSON.parse(text);
  if (!isObject(parsed)) throw new Error('Backup file is not an object');

  const backup: BackupData = {};
  for (const entity of ENTITY_KEYS) {
    const rows = parsed[entity];
    if (!Array.isArray(rows)) continue;
    backup[entity] = rows
      .filter(isObject)
      .map(row => toRestoreRow(entity, row))
      .filter((row): row is RestoreRow => row !== null);
  }
  return backup;
}
