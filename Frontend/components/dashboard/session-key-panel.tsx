"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { truncateAddress } from "@/lib/utils";
import { Loader2, KeyRound, ShieldCheck, Lock } from "lucide-react";

interface SessionKeyPanelProps {
  sessionKeyAddress: string | null;
  smartAccountAddress: string | null;
  step2Status: string;
  loading: string | null;
  hasSmartAccount: boolean;
  isOwnerWallet: boolean;
  onIssueSessionKey: () => void;
}

export function SessionKeyPanel({
  sessionKeyAddress,
  smartAccountAddress,
  step2Status,
  loading,
  hasSmartAccount,
  isOwnerWallet,
  onIssueSessionKey,
}: SessionKeyPanelProps) {
  const canChangeSessionKey = hasSmartAccount && isOwnerWallet;

  return (
    <Card
      className={`overflow-hidden transition-all duration-300 ${
        sessionKeyAddress ? "ring-1 ring-chart-3/20" : ""
      }`}
    >
      <CardContent className="p-5">
        {/* Top row: icon + title + status */}
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${
            sessionKeyAddress ? "bg-chart-3/15" : "bg-muted/60"
          }`}>
            <KeyRound className={`h-5 w-5 transition-colors duration-300 ${
              sessionKeyAddress ? "text-chart-3" : "text-muted-foreground"
            }`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold tracking-tight">Session Key</h3>
              {sessionKeyAddress && (
                <span className="inline-flex items-center gap-1 rounded-full bg-chart-3/10 px-2 py-0.5 text-[10px] font-semibold text-chart-3 animate-in fade-in-0 zoom-in-95 duration-300">
                  <ShieldCheck className="h-3 w-3" />
                  Active
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
              Limited access for your agent. Your wallet stays safe.
            </p>
          </div>
        </div>

        {/* Warning */}
        {hasSmartAccount && !isOwnerWallet && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 animate-in fade-in-0 duration-200">
            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <p className="text-[12px] text-amber-600 dark:text-amber-400">
              Use the wallet that created this account.
            </p>
          </div>
        )}

        {/* Separator */}
        <div className="my-4 h-px bg-border/50" />

        {/* Smart account address */}
        {smartAccountAddress && (
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Smart account
              </p>
              <code className="mt-1 block truncate font-mono text-[13px] text-foreground/90">
                {truncateAddress(smartAccountAddress, 8)}
              </code>
            </div>
            <CopyButton
              value={smartAccountAddress}
              className="h-8 w-8 shrink-0 rounded-lg border border-border/60 transition-colors hover:bg-muted"
            />
          </div>
        )}

        {/* Key state */}
        {sessionKeyAddress ? (
          <div className="flex items-center justify-between gap-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Key address
              </p>
              <code className="mt-1 block truncate font-mono text-[13px] text-foreground/90">
                {truncateAddress(sessionKeyAddress, 8)}
              </code>
            </div>
            <CopyButton
              value={sessionKeyAddress}
              className="h-8 w-8 shrink-0 rounded-lg border border-border/60 transition-colors hover:bg-muted"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center py-2 text-center animate-in fade-in-0 duration-200">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
              <KeyRound className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-2.5 text-[13px] text-muted-foreground">
              Issue a key to give your agent limited access.
            </p>
          </div>
        )}

        {/* Action */}
        <Button
          onClick={onIssueSessionKey}
          disabled={loading !== null || !canChangeSessionKey}
          variant={sessionKeyAddress ? "outline" : "default"}
          className={`mt-4 w-full transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
            !sessionKeyAddress ? "h-10" : ""
          }`}
        >
          {loading === "session" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Issuing…
            </>
          ) : sessionKeyAddress ? (
            "Re-issue Key"
          ) : (
            "Issue Session Key"
          )}
        </Button>

        {/* Status feedback */}
        {step2Status && (
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground break-all animate-in fade-in-0 duration-200">
            {step2Status}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
