"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { truncateAddress } from "@/lib/utils";
import { Loader2, ShieldCheck, ExternalLink } from "lucide-react";

interface WalletInfoCardProps {
  eoaAddress: string | undefined;
  smartAccountAddress: string | null;
  step1Status: string;
  loading: string | null;
  /** True while fetching smart account on dashboard load (eoa connected, client not ready yet) */
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Smart Account
        </CardTitle>
        <CardDescription>
          {loadingSmartAccount
            ? "Loading your smart account…"
            : smartAccountAddress
              ? "Smart account is enabled for your EOA"
              : "Enable your smart account linked to your EOA"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {eoaAddress && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">EOA Address</p>
            <div className="flex items-center gap-1">
              <code className="text-sm font-mono">{truncateAddress(eoaAddress)}</code>
              <CopyButton value={eoaAddress} className="h-6 w-6" />
            </div>
          </div>
        )}
        {loadingSmartAccount ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading smart account…</span>
          </div>
        ) : smartAccountAddress ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Smart Account</p>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="font-mono text-xs">
                {truncateAddress(smartAccountAddress)}
              </Badge>
              <CopyButton value={smartAccountAddress} className="h-6 w-6" />
            </div>
          </div>
        ) : (
          <Button
            onClick={onCreateAccount}
            disabled={loading !== null}
            className="w-full"
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
        <a
          href="https://sepoliafaucet.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Sepolia Faucet <ExternalLink className="h-3 w-3" />
        </a>
        {step1Status && (
          <p className="text-xs text-muted-foreground break-all">{step1Status}</p>
        )}
      </CardContent>
    </Card>
  );
}
