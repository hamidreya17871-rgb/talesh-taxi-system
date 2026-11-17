import { useEffect, useRef, useState } from 'react';
import { Eraser, Save, X } from 'lucide-react';
import { callStaffApi } from '@/lib/staffApi';
import type { Profile } from '@/lib/staff';

type Props = { profile: Profile; onClose: () => void; onSaved: (signature: string) => void };

export default function ProfileSignatureModal({ profile, onClose, onSaved }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signature, setSignature] = useState(profile.signature_data_url ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (signature) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.src = signature;
    }
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  }
  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(event.pointerId);
    const p = point(event);
    const ctx = canvas.getContext('2d')!;
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.strokeStyle = '#173bd1'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    drawing.current = true;
  }
  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const p = point(event);
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    setSignature(canvasRef.current!.toDataURL('image/png'));
  }
  function clear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSignature('');
  }
  async function save() {
    const canvas = canvasRef.current;
    if (!canvas || !signature) { setError('ابتدا امضای خود را روی کادر رسم کنید.'); return; }
    setBusy(true); setError('');
    const image = canvas.toDataURL('image/png');
    try {
      await callStaffApi('save-signature', { signature_data_url: image });
    } catch {
      setBusy(false);
      setError('ذخیره امضا انجام نشد. لطفاً دوباره تلاش کنید.');
      return;
    }
    setBusy(false);
    onSaved(image);
    onClose();
  }

  return <div className="fixed inset-0 z-[70] grid place-items-center bg-ink-900/50 p-4" onClick={() => !busy && onClose()}>
    <section className="panel w-full max-w-[560px]" dir="rtl" onClick={event => event.stopPropagation()}>
      <header className="mb-4 flex items-center justify-between">
        <div><h2 className="text-lg font-bold">امضای دیجیتال پروفایل</h2><p className="mt-1 text-xs text-ink-600">{profile.full_name} · {profile.role === 'manager' ? 'مدیر سازمان' : 'کارشناس'}</p></div>
        <button className="btn-tiny" type="button" onClick={onClose} aria-label="بستن"><X size={17}/></button>
      </header>
      <p className="mb-3 text-sm text-ink-600">با انگشت یا ماوس امضای خود را در کادر رسم و ذخیره کنید. امضا فقط در اسناد مجاز و پس از تأیید استفاده می‌شود.</p>
      <canvas ref={canvasRef} width={900} height={300} className="w-full touch-none rounded-xl border-2 border-dashed border-ink-300 bg-white" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
      {error && <p className="mt-2 text-sm text-error-500">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <button type="button" className="btn btn-secondary" onClick={clear}><Eraser size={15}/> پاک کردن</button>
        <div className="flex gap-2"><button type="button" className="btn btn-secondary" onClick={onClose}>انصراف</button><button type="button" className="btn" disabled={busy} onClick={() => void save()}><Save size={15}/>{busy ? 'در حال ذخیره…' : 'ذخیره امضا'}</button></div>
      </div>
    </section>
  </div>;
}
