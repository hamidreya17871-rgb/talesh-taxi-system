import { useState } from 'react';
import { CheckCircle2, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { effectiveLicenseStatus } from '@/lib/driverLicenses';
import { entityConfigs, type EntityKey, type FleetRecord } from '@/lib/fleetConfig';
import { formatNumber, formatPersianDate } from '@/lib/format';
import { reviewLabelFor } from '@/lib/reviews';

type RecordsPageProps = {
  entity: EntityKey;
  records: FleetRecord[];
  readOnly?: boolean;
  onCreate: () => void;
  onEdit: (record: FleetRecord) => void;
  onDelete: (record: FleetRecord) => void;
  onReview: (record: FleetRecord) => void;
  onExport: () => void;
};

export default function RecordsPage({ entity, records, readOnly = false, onCreate, onEdit, onDelete, onReview, onExport }: RecordsPageProps) {
  const config = entityConfigs[entity];
  const dateKeys = new Set(config.fields.filter(field => field.type === 'date').map(field => field.key));
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const orderedRecords = entity === 'vehicles'
    ? [...records].sort((a, b) => {
        const toRowNumber = (value: unknown): number | null => {
          const normalized = String(value ?? '')
            .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
            .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
            .trim();
          if (!normalized) return null;
          const match = normalized.match(/\d+/);
          return match ? Number(match[0]) : null;
        };
        const left = toRowNumber(a.taxi_row_no);
        const right = toRowNumber(b.taxi_row_no);
        if (left === null && right === null) return 0;
        if (left === null) return 1;
        if (right === null) return -1;
        return left - right;
      })
    : records;
  const visible = normalizedQuery
    ? orderedRecords.filter(record =>
        config.fields.some(field => String(record[field.key] ?? '').toLowerCase().includes(normalizedQuery))
      )
    : orderedRecords;

  return (
    <>
      <div className="mb-[18px] flex items-center justify-between gap-3 max-[650px]:flex-col max-[650px]:items-start">
        <div>
          <h2 className="text-[21px] font-bold">{config.title}</h2>
          <p className="text-sm text-ink-600">
            ثبت و مدیریت {config.singular}‌ها · {formatNumber(records.length)} مورد
          </p>
        </div>
        {!readOnly && (
          <button type="button" className="btn max-[650px]:w-full" onClick={onCreate}>
            <Plus size={18} />
            افزودن {config.singular}
          </button>
        )}
      </div>

      <section className="panel">
        <div className="mb-[17px] flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold">فهرست {config.title}</h3>
          <div className="flex w-full flex-wrap gap-[9px] sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-600" />
              <input
                type="search"
                placeholder="جستجو در فهرست…"
                value={query}
                onChange={event => setQuery(event.target.value)}
                className="field-input rounded-[10px] ps-9 sm:w-[220px]"
              />
            </div>
            <button type="button" className="btn btn-secondary" onClick={onExport}>
              <Download size={16} />
              خروجی CSV
            </button>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full whitespace-nowrap border-collapse text-sm">
            <thead>
              <tr>
                {config.columns.map(column => (
                  <th key={column.key} className="border-b border-ink-200 bg-ink-50 px-2.5 py-[13px] text-right text-xs font-normal text-ink-600">
                    {column.label}
                  </th>
                ))}
                {!readOnly && (
                  <th className="border-b border-ink-200 bg-ink-50 px-2.5 py-[13px] text-right text-xs font-normal text-ink-600">
                    عملیات
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-0">
              {visible.map(record => (
                <tr key={record.id} className="transition duration-200 hover:bg-brand-50/60">
                  {config.columns.map(column => {
                    const value = record[column.key];
                    return (
                      <td key={column.key} className="border-b border-ink-200 px-2.5 py-[13px] text-right">
                        {column.key === 'status' ? (
                          <StatusBadge status={entity === 'licenses' ? effectiveLicenseStatus(value, record.expires_on) : value} />
                        ) : column.key === 'amount' ? (
                          formatNumber(value)
                        ) : dateKeys.has(column.key) ? (
                          formatPersianDate(typeof value === 'string' ? value : null)
                        ) : (
                          String(value ?? '') || '—'
                        )}
                      </td>
                    );
                  })}
                  {!readOnly && (
                    <td className="border-b border-ink-200 px-2.5 py-[13px] text-right">
                      <div className="flex gap-1.5">
                        {reviewLabelFor(entity, record) && (
                          <button type="button" className="btn-tiny" onClick={() => onReview(record)}>
                            <CheckCircle2 size={13} />
                            {reviewLabelFor(entity, record)}
                          </button>
                        )}
                        <button type="button" className="btn-tiny" onClick={() => onEdit(record)}>
                          <Pencil size={13} />
                          ویرایش
                        </button>
                        <button type="button" className="btn-tiny btn-tiny-danger" onClick={() => onDelete(record)}>
                          <Trash2 size={13} />
                          حذف
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={config.columns.length + (readOnly ? 0 : 1)} className="py-[30px] text-center text-ink-600">
                    {query.trim()
                      ? 'موردی مطابق جستجو پیدا نشد.'
                      : 'هنوز موردی ثبت نشده است. برای شروع روی «افزودن» بزنید.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
