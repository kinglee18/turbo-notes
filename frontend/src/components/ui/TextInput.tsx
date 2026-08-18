"use client";

import { useId, useState } from "react";
import type { InputHTMLAttributes } from "react";

const FIELD =
  "w-full rounded-lg border border-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] " +
  "bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & { label: string };

export function TextInput({ label, id, ...props }: TextInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input id={inputId} placeholder={label} className={FIELD} {...props} />
    </div>
  );
}

export function PasswordInput({ label, id, ...props }: TextInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        id={inputId}
        type={visible ? "text" : "password"}
        placeholder={label}
        className={`${FIELD} pr-10`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((shown) => !shown)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-accent"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17.9 17.9A10.3 10.3 0 0 1 12 19c-6.4 0-10-7-10-7a18.5 18.5 0 0 1 5.1-5.9m3.2-1A10.3 10.3 0 0 1 12 5c6.4 0 10 7 10 7a18.6 18.6 0 0 1-2.3 3.3" />
      <path d="m1 1 22 22" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
