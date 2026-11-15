type NoticeProps = {
  title: string;
  detail: string;
};

export default function Notice({ title, detail }: NoticeProps) {
  return (
    <div className="flex items-start gap-3 border-b border-ink-200 py-3 last:border-0">
      <span className="mt-[5px] h-[9px] w-[9px] shrink-0 rounded-full bg-gold-400" />
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-xs text-ink-600">{detail}</p>
      </div>
    </div>
  );
}
