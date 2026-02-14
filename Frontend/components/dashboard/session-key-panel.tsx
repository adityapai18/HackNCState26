"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { truncateAddress } from "@/lib/utils";
import { Loader2, KeyRound } from "lucide-react";

interface SessionKeyPanelProps {
  sessionKeyAddress: string | null;
  step2Status: string;
  loading: string | null;
  hasSmartAccount: boolean;
  /** True when the connected wallet is the one that created the smart account (only it can change session keys) */
  isOwnerWallet: boolean;
  onIssueSessionKey: () => void;
}

export function SessionKeyPanel({
  sessionKeyAddress,
  step2Status,
  loading,
  hasSmartAccount,
  isOwnerWallet,
  onIssueSessionKey,
}: SessionKeyPanelProps) {
  const canChangeSessionKey = hasSmartAccount && isOwnerWallet;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-chart-3" />
          Session Key
        </CardTitle>
        <CardDescription>
          Issue a scoped session key for ping + withdraw on MockVault. Only the wallet that created the smart account can change session keys.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasSmartAccount && !isOwnerWallet && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Connect with the same wallet that created this smart account to issue or re-issue session keys.
          </p>
        )}
        {sessionKeyAddress ? (
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Session Key Address</p>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="font-mono text-xs">
                  {truncateAddress(sessionKeyAddress)}
                </Badge>
                <CopyButton value={sessionKeyAddress} className="h-6 w-6" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-xs">ping()</Badge>
              <Badge variant="secondary" className="text-xs">withdraw()</Badge>
              <Badge variant="secondary" className="text-xs">withdrawTo()</Badge>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Grants <code className="text-xs">ping()</code>, <code className="text-xs">withdraw()</code>, and <code className="text-xs">withdrawTo()</code> permissions with native-token allowance.
            </p>
          </div>
        )}
        <Button
          onClick={onIssueSessionKey}
          disabled={loading !== null || !canChangeSessionKey}
          variant={sessionKeyAddress ? "outline" : "default"}
          className="w-full"
        >
          {loading === "session" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Issuing…
            </>
          ) : sessionKeyAddress ? (
            "Re-issue Session Key"
          ) : (
            "Issue Session Key"
          )}
        </Button>
        {step2Status && (
          <p className="text-xs text-muted-foreground break-all">{step2Status}</p>
        )}
      </CardContent>
    </Card>
  );
}
