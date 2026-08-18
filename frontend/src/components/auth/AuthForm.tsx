"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { PasswordInput, TextInput } from "@/components/ui/TextInput";

interface AuthFormProps {
  mode: "login" | "signup";
  heading: string;
  submitLabel: string;
  illustration: { src: string; alt: string; width: number; height: number };
  altLink: { href: string; label: string };
}

/** Reads a DRF error body, which is either {detail} or {field: [messages]}. */
function firstError(data: unknown): string {
  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    for (const value of Object.values(record)) {
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      if (typeof value === "string") return value;
    }
  }
  return "Something went wrong. Please try again.";
}

export function AuthForm({
  mode,
  heading,
  submitLabel,
  illustration,
  altLink,
}: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setError(firstError(await response.json().catch(() => null)));
        return;
      }

      router.replace("/notes");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Image
        src={illustration.src}
        alt={illustration.alt}
        width={illustration.width}
        height={illustration.height}
        priority
        className="mb-4 h-auto w-auto"
      />

      <h1 className="mb-8 font-display text-4xl text-accent">{heading}</h1>

      <form onSubmit={onSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <TextInput
          label="Email address"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordInput
          label="Password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && (
          <p role="alert" className="text-center text-xs text-red-800">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="mt-3 w-full">
          {pending ? "One moment…" : submitLabel}
        </Button>
      </form>

      <Link
        href={altLink.href}
        className="mt-3 text-xs text-accent underline underline-offset-2 hover:opacity-75"
      >
        {altLink.label}
      </Link>
    </main>
  );
}
