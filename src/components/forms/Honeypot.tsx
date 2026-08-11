'use client';

import { useRef, useState } from 'react';

/**
 * The client half of the bot filter in src/lib/bot-filter.ts: a field no human
 * can reach, plus the time spent on the form.
 *
 * Deliberately cheap for the person filling the form in — no puzzle, no extra
 * click, no third-party script. That matters most on the withdrawal function,
 * where § 356a Abs. 1 BGB requires easy access throughout the withdrawal
 * period, but it is the right trade everywhere else too.
 */
export function useBotSignals() {
  const [website, setWebsite] = useState('');
  const mountedAt = useRef(Date.now());

  /** Call at submit time — the dwell is measured then, not at render. */
  const signals = () => ({ website, elapsedMs: Date.now() - mountedAt.current });

  return { website, setWebsite, signals };
}

/**
 * The honeypot field. Off-screen rather than `display: none`, because some bots
 * skip undisplayed inputs; `aria-hidden` plus `tabIndex={-1}` keeps it away
 * from screen readers and out of the tab order, and `autoComplete="off"` keeps
 * a password manager from filling it on a human's behalf.
 *
 * `id` must be unique per page — the results page carries two of these forms.
 */
export function Honeypot({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label htmlFor={id}>Website</label>
      <input
        id={id}
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
