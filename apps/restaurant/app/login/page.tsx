"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { Store, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode) return;
    setIsSubmitting(true);
    setError(null);
    const result = await loginAction(passcode);
    if (result?.error) {
      setError(result.error);
      setIsSubmitting(false);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="bg-primary text-primary-foreground p-3 rounded-xl">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="font-bold text-xl">Restaurant Staff</h1>
          <p className="text-sm text-muted-foreground">Enter your staff passcode</p>
        </div>

        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          autoFocus
          className="input text-center text-lg tracking-widest"
        />

        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-lg border border-destructive/20 text-sm text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !passcode}
          className="h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSubmitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
