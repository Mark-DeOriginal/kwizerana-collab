"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, Download, Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { readJson } from "@/lib/client-request";

type AccountInfo = { id: string; email: string; name: string | null; hasPassword: boolean };
type TwoFactorStatus = { enabled: boolean; confirmedAt: string | null; hasPendingSetup: boolean };
type TwoFactorSetup = { secret: string; otpauthUrl: string; qrDataUrl: string };

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-white p-5 sm:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function SecurityPage() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [twoFactor, setTwoFactor] = useState<TwoFactorStatus | null>(null);
  const [antiPhishing, setAntiPhishing] = useState("");

  const loadAccount = useCallback(async () => {
    const res = await fetch("/api/p2p/account");
    const data = await readJson<AccountInfo & { error?: string }>(res);
    if (res.ok && data) setAccount(data as AccountInfo);
  }, []);

  const loadTwoFactor = useCallback(async () => {
    const res = await fetch("/api/p2p/2fa");
    const data = await readJson<TwoFactorStatus & { error?: string }>(res);
    if (res.ok && data) setTwoFactor(data as TwoFactorStatus);
  }, []);

  const loadAntiPhishing = useCallback(async () => {
    const res = await fetch("/api/p2p/anti-phishing");
    const data = await readJson<{ code: string } & { error?: string }>(res);
    if (res.ok && data) setAntiPhishing(data.code);
  }, []);

  useEffect(() => {
    void loadAccount();
    void loadTwoFactor();
    void loadAntiPhishing();
  }, [loadAccount, loadTwoFactor, loadAntiPhishing]);

  return (
    <div className="space-y-6">
      <SectionCard
        title="Two-factor authentication"
        description="Add an extra layer of security by requiring a code from an authenticator app when you sign in."
      >
        <TwoFactorPanel
          status={twoFactor}
          hasPassword={account?.hasPassword ?? false}
          onChanged={loadTwoFactor}
        />
      </SectionCard>

      <SectionCard
        title="Anti-phishing code"
        description="This code appears in every official Kwizerana email. If an email claiming to be from us is missing it, don't trust it."
      >
        <AntiPhishingPanel code={antiPhishing} onChanged={loadAntiPhishing} />
      </SectionCard>

      <SectionCard
        title="Password"
        description={account?.hasPassword ? "Change the password you use to sign in." : "Set a password so you can sign in with your email."}
      >
        <PasswordPanel hasPassword={account?.hasPassword ?? false} />
      </SectionCard>
    </div>
  );
}

function TwoFactorPanel({ status, hasPassword, onChanged }: { status: TwoFactorStatus | null; hasPassword: boolean; onChanged: () => void }) {
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [copied, setCopied] = useState(false);

  async function beginSetup() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/p2p/2fa", { method: "POST" });
    const data = await readJson<TwoFactorSetup & { error?: string }>(res);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Unable to start setup.");
      return;
    }
    setSetup(data as TwoFactorSetup);
    setCode("");
    setBackupCodes(null);
  }

  async function confirmSetup() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/p2p/2fa", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    const data = await readJson<{ backupCodes: string[] } & { error?: string }>(res);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Invalid code.");
      return;
    }
    setBackupCodes(data?.backupCodes ?? []);
    setSetup(null);
    onChanged();
  }

  async function disable() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/p2p/2fa", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: disablePassword, code: disableCode })
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Unable to disable.");
      return;
    }
    setShowDisable(false);
    setDisablePassword("");
    setDisableCode("");
    onChanged();
  }

  async function copyBackupCodes() {
    await navigator.clipboard.writeText(backupCodes?.join("\n") ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadBackupCodes() {
    const blob = new Blob([backupCodes?.join("\n") ?? ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kwizerana-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (status === null) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  if (backupCodes) {
    return (
      <div>
        <div className="flex items-start gap-3 border border-mint bg-panel p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-moss" />
          <div className="text-sm leading-6">
            <p className="font-semibold">Two-factor authentication enabled</p>
            <p className="text-muted">Store these backup codes somewhere safe. Each can be used once if you lose access to your authenticator.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {backupCodes.map((c) => (
            <div key={c} className="border border-line bg-panel px-3 py-2 text-center font-mono text-sm tracking-wide">
              {c}
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={copyBackupCodes} className="flex h-10 items-center gap-2 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean">
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy codes"}
          </button>
          <button onClick={downloadBackupCodes} className="flex h-10 items-center gap-2 border border-line bg-white px-4 text-sm font-semibold transition-colors hover:bg-panel">
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
        <button onClick={() => setBackupCodes(null)} className="mt-4 text-sm font-semibold text-ocean underline underline-offset-2">
          Done
        </button>
      </div>
    );
  }

  if (setup) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qrDataUrl} alt="Scan with your authenticator app" className="h-40 w-40 shrink-0 border border-line bg-white p-2" />
          <div className="text-sm leading-6 text-muted">
            <p>1. Open your authenticator app (Google Authenticator, Authy, etc.)</p>
            <p>2. Scan the QR code, or enter the secret manually.</p>
            <p className="mt-2">
              <span className="font-semibold text-ink">Secret:</span>{" "}
              <code className="break-all rounded bg-panel px-1 py-0.5 font-mono text-xs">{setup.secret}</code>
            </p>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="totpCode" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Enter the 6-digit code
            </label>
            <input
              id="totpCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-11 w-full border border-line bg-white px-3 text-center text-lg tracking-[0.3em] outline-none transition-colors focus:border-ocean"
              placeholder="••••••"
              maxLength={6}
            />
          </div>
          <button onClick={confirmSetup} disabled={busy} className="flex h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify
          </button>
        </div>
        {error && <p className="text-sm font-semibold text-coral">{error}</p>}
        <button onClick={() => { setSetup(null); setError(""); }} className="text-sm font-semibold text-muted transition-colors hover:text-ink">
          Cancel
        </button>
      </div>
    );
  }

  if (status.enabled) {
    return (
      <div>
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-moss" />
          <div className="text-sm leading-6">
            <p className="font-semibold">Two-factor authentication is on</p>
            <p className="text-muted">You&apos;ll need a code from your authenticator app to sign in.</p>
          </div>
        </div>
        {!showDisable ? (
          <button onClick={() => setShowDisable(true)} className="mt-4 h-10 border border-line bg-white px-4 text-sm font-semibold text-coral transition-colors hover:bg-coral/5">
            Disable two-factor authentication
          </button>
        ) : (
          <div className="mt-4 space-y-3 border border-line bg-panel p-4">
            <p className="text-sm font-semibold">Confirm your identity to disable 2FA.</p>
            {hasPassword && (
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="h-10 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean"
                placeholder="Password"
              />
            )}
            <input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              className="h-10 w-full border border-line bg-white px-3 text-sm outline-none focus:border-ocean"
              placeholder="Authenticator code or backup code"
            />
            {error && <p className="text-sm font-semibold text-coral">{error}</p>}
            <div className="flex gap-2">
              <button onClick={disable} disabled={busy} className="flex h-10 items-center gap-2 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Disable
              </button>
              <button onClick={() => { setShowDisable(false); setError(""); }} className="h-10 px-4 text-sm font-semibold text-muted transition-colors hover:text-ink">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm leading-6 text-muted">Two-factor authentication is off. We recommend enabling it to protect your account.</p>
      <button onClick={beginSetup} disabled={busy} className="mt-4 flex h-10 items-center gap-2 bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Enable two-factor authentication
      </button>
      {error && <p className="mt-3 text-sm font-semibold text-coral">{error}</p>}
    </div>
  );
}

function AntiPhishingPanel({ code, onChanged }: { code: string; onChanged: () => void }) {
  const [value, setValue] = useState(code);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setValue(code);
  }, [code]);

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/p2p/anti-phishing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: value })
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Unable to save.");
      return;
    }
    setMessage("Saved.");
    onChanged();
  }

  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="antiPhishing" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Code
          </label>
          <input
            id="antiPhishing"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-11 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
            placeholder="e.g. TRUST-2024"
            maxLength={32}
          />
        </div>
        <button onClick={save} disabled={busy} className="flex h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
      </div>
      {message && <p className="mt-2 text-sm font-semibold text-moss">{message}</p>}
      {error && <p className="mt-2 text-sm font-semibold text-coral">{error}</p>}
    </div>
  );
}

function PasswordPanel({ hasPassword }: { hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setBusy(true);
    const res = await fetch("/api/p2p/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await readJson<{ error?: string }>(res);
    setBusy(false);

    if (!res.ok) {
      setError(data?.error ?? "Unable to update password.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage(hasPassword ? "Password updated." : "Password set. You can now sign in with your email.");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {hasPassword && (
        <div>
          <label htmlFor="currentPassword" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Current password
          </label>
          <input
            id="currentPassword"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required={hasPassword}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="h-11 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
          />
        </div>
      )}
      <div>
        <label htmlFor="newPassword" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          New password
        </label>
        <input
          id="newPassword"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="h-11 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
          placeholder="At least 8 characters"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="h-11 w-full border border-line bg-white px-3 text-sm outline-none transition-colors focus:border-ocean"
        />
      </div>

      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-ink"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {show ? "Hide passwords" : "Show passwords"}
      </button>

      {message && <p className="text-sm font-semibold text-moss">{message}</p>}
      {error && <p className="text-sm font-semibold text-coral">{error}</p>}

      <button type="submit" disabled={busy} className="flex h-11 items-center gap-2 bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ocean disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {hasPassword ? "Update password" : "Set password"}
      </button>
    </form>
  );
}
