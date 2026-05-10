"use client";

import { useState, useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

const CORRECT_PIN = "2000";

export function PinDialog({ onSuccess, onCancel }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      onSuccess();
    } else {
      setError(true);
      setShake(true);
      setPin("");
      setTimeout(() => setShake(false), 500);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setPin(val);
    setError(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onCancel} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-5 ${shake ? "animate-shake" : ""}`}>

          {/* Icon */}
          <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <Lock className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          </div>

          {/* Heading */}
          <div className="text-center">
            <h2 className="text-[16px] font-semibold text-slate-900 dark:text-slate-100">Enter Edit PIN</h2>
            <p className="text-[13px] text-slate-400 mt-1">You only need to enter this once per session</p>
          </div>

          {/* PIN form */}
          <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-3">
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={handleChange}
              placeholder="······"
              className={`w-40 text-center text-[22px] tracking-[0.5em] font-mono border-2 rounded-xl px-4 py-2.5 outline-none transition-colors dark:bg-slate-700 dark:placeholder-slate-500 ${
                error
                  ? "border-red-400 bg-red-50 text-red-600 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300"
                  : "border-slate-200 dark:border-slate-600 focus:border-slate-400 dark:text-slate-100 dark:focus:border-slate-400"
              }`}
            />
            {error && (
              <p className="text-[12px] text-red-500 dark:text-red-400">Incorrect PIN. Try again.</p>
            )}
            <div className="flex gap-2 w-full mt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={pin.length === 0}>
                Unlock
              </Button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </>
  );
}
