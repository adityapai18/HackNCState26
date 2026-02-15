"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { truncateAddress } from "@/lib/utils";
import { Loader2, ShieldCheck, ExternalLink, Wallet } from "lucide-react";

interface WalletInfoCardProps {
  eoaAddress: string | undefined;
  smartAccountAddress: string | null;
  step1Status: string;
  loading: string | null;
  loadingSmartAccount?: boolean;
  onCreateAccount: () => void;
}

export function WalletInfoCard({
  eoaAddress,
  smartAccountAddress,
  step1Status,
  loading,
  loadingSmartAccount = false,
  onCreateAccount,
}: WalletInfoCardProps) {
  return (
    <div className="space-y-4">
      {/* EOA */}
      {eoaAddress && (
        <div className="rounded-xl bg-muted/40 px-4 py-3 transition-colors duration-200">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Wallet
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <Wallet className="h-4 w-4 shrink-0 text-primary" />
            <code className="flex-1 truncate font-mono text-sm">{truncateAddress(eoaAddress)}</code>
            <CopyButton value={eoaAddress} className="h-6 w-6 shrink-0" />
          </div>
        </div>
      )}

      {/* Smart Account */}
      {loadingSmartAccount ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-5">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading smart account…</span>
        </div>
      ) : smartAccountAddress ? (
        <div className="rounded-xl bg-muted/40 px-4 py-3 transition-colors duration-200">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Smart Account
            </p>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {truncateAddress(smartAccountAddress)}
            </Badge>
            <CopyButton value={smartAccountAddress} className="h-6 w-6 shrink-0" />
          </div>
        </div>
      ) : (
        <Button
          onClick={onCreateAccount}
          disabled={loading !== null}
          className="w-full transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
        >
          {loading === "step1" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enabling…
            </>
          ) : (
            "Enable Smart Account"
          )}
        </Button>
      )}

      {/* Faucet */}
      <a
        href="https://sepoliafaucet.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-primary/80 transition-colors hover:text-primary"
      >
        Sepolia Faucet <ExternalLink className="h-3 w-3" />
      </a>

      {step1Status && (
        <p className="border-t border-border/60 pt-2 text-xs text-muted-foreground break-all">
          {step1Status}
        </p>
      )}
    </div>
  );
}
