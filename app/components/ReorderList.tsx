'use client';
import { useEffect, useRef, useState } from 'react';
import { moveItem, slotForY } from '../lib/reorder';
import { Icon } from './ui';

export type ReorderItem = { id: string; title: string; sub: string };

/**
 * Reorder mode for a list: drag a row by its handle, or use the arrows (one tap = one place, also
 * works with a keyboard or screen reader). Every change is saved right away; saves run one at a
 * time and the latest order always wins.
 */
export default function ReorderList({ items, onSave, onDone }: {
  items: ReorderItem[];
  onSave: (ids: string[]) => Promise<boolean>;
  onDone: () => void;
}) {
  const [order, setOrder] = useState(items);
  const [status, setStatus] = useState<'' | 'saving' | 'saved' | 'error'>('');
  const [announce, setAnnounce] = useState('');
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const latest = useRef(items.map(i => i.id));
  const saved = useRef(items.map(i => i.id).join());
  const saving = useRef(false);

  async function flush() {
    if (saving.current) return;
    saving.current = true;
    while (latest.current.join() !== saved.current) {
      const ids = [...latest.current];
      setStatus('saving');
      const ok = await onSave(ids);
      if (!ok) { setStatus('error'); saving.current = false; return; }
      saved.current = ids.join();
    }
    setStatus('saved');
    saving.current = false;
  }
  function commit(next: ReorderItem[]) { latest.current = next.map(i => i.id); void flush(); }

  function step(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= order.length) return;
    const next = moveItem(order, index, to);
    setOrder(next); commit(next);
    setAnnounce(`${order[index].title} moved to position ${to + 1} of ${order.length}.`);
  }

  // Dragging: the rows stay where they are in the page while the finger is down (the dragged row
  // follows it, the rows it passes slide aside), and the new order is applied on release. Moving
  // the row's element mid-drag can end the touch on iPhone, so nothing is reordered until then.
  type Drag = { id: string; from: number; to: number; startY: number; dy: number; h: number; rects: { top: number; bottom: number }[] };
  const [drag, setDrag] = useState<Drag | null>(null);
  function onDown(e: React.PointerEvent, id: string, index: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    // Positions are kept in page coordinates, so the drag stays right while the page scrolls.
    const sy = window.scrollY;
    const rects = order.map(i => { const r = rowRefs.current.get(i.id)?.getBoundingClientRect(); return { top: (r?.top ?? 0) + sy, bottom: (r?.bottom ?? 0) + sy }; });
    let d: Drag = { id, from: index, to: index, startY: e.clientY + sy, dy: 0, h: rects[index].bottom - rects[index].top, rects };
    let clientY = e.clientY; let live = true;
    setDrag(d);
    const update = () => {
      const dy = clientY + window.scrollY - d.startY;
      // where the middle of the dragged row now is, against the rows' original positions
      const mid = (d.rects[d.from].top + d.rects[d.from].bottom) / 2 + dy;
      d = { ...d, dy, to: slotForY(mid, d.rects) };
      setDrag(d);
    };
    // Near the top of the screen, or just above the tab bar, the page scrolls so any slot can be reached.
    const edge = () => {
      if (!live) return;
      const before = window.scrollY;
      // slow at the start of the zone, faster closer to the edge
      const top = 90 - clientY, bottom = clientY - (window.innerHeight - 140);
      if (top > 0) window.scrollBy(0, -Math.ceil(Math.min(1, top / 80) * 12));
      else if (bottom > 0) window.scrollBy(0, Math.ceil(Math.min(1, bottom / 80) * 12));
      if (window.scrollY !== before) update();
      requestAnimationFrame(edge);
    };
    requestAnimationFrame(edge);
    const move = (ev: PointerEvent) => { ev.preventDefault(); clientY = ev.clientY; update(); };
    const up = () => {
      live = false;
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      setDrag(null);
      if (d.to === d.from) return;
      const next = moveItem(order, d.from, d.to);
      setOrder(next); commit(next);
      setAnnounce(`${order[d.from].title} moved to position ${d.to + 1} of ${order.length}.`);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
  function shiftFor(i: number): number {
    if (!drag || i === drag.from) return 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.h;
    if (drag.from > drag.to && i >= drag.to && i < drag.from) return drag.h;
    return 0;
  }

  useEffect(() => { if (status === 'saved') { const t = setTimeout(() => setStatus(''), 1500); return () => clearTimeout(t); } }, [status]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-sm text-fl-tx2">Drag <Icon name="grip" size={16} className="inline align-[-3px]" /> or use the arrows.</p>
        <button onClick={onDone} disabled={status === 'saving'} className="h-10 rounded-lg bg-fl-acc px-4 text-sm font-bold text-fl-on-acc disabled:opacity-60">Done</button>
      </div>
      <ul className="divide-y divide-fl-line">
        {order.map((it, i) => (
          <li key={it.id} ref={el => { if (el) rowRefs.current.set(it.id, el); else rowRefs.current.delete(it.id); }}
            style={drag ? { transform: `translateY(${drag.id === it.id ? drag.dy : shiftFor(i)}px)`, transition: drag.id === it.id ? 'none' : 'transform 150ms ease' } : undefined}
            className={`flex items-center gap-2 bg-fl-s1 py-2 ${drag?.id === it.id ? 'relative z-10 rounded-xl !bg-fl-s2 shadow-lg' : ''}`}>
            <span onPointerDown={e => onDown(e, it.id, i)} aria-hidden="true"
              className="flex h-11 w-10 shrink-0 cursor-grab touch-none select-none items-center justify-center text-fl-tx2 active:cursor-grabbing">
              <Icon name="grip" size={20} />
            </span>
            <span className="min-w-0 flex-1 select-none">
              <span className="block font-semibold leading-snug [overflow-wrap:anywhere]"><span className="mr-1.5 text-fl-tx2">{i + 1}.</span>{it.title}</span>
              <span className="block text-sm text-fl-tx2">{it.sub}</span>
            </span>
            <button onClick={() => step(i, -1)} disabled={i === 0} aria-label={`Move ${it.title} up`}
              className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg bg-fl-s2 disabled:opacity-30"><Icon name="up" size={18} /></button>
            <button onClick={() => step(i, 1)} disabled={i === order.length - 1} aria-label={`Move ${it.title} down`}
              className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg bg-fl-s2 disabled:opacity-30"><Icon name="down" size={18} /></button>
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite" className="mt-1 min-h-5 text-xs text-fl-tx2">
        {status === 'error' ? <span className="text-fl-bad">⚠ Could not save the new order. Check your connection and try again.</span>
          : status === 'saving' ? 'Saving…' : status === 'saved' ? 'Order saved.' : ''}
        <span className="sr-only">{announce}</span>
      </p>
    </div>
  );
}
