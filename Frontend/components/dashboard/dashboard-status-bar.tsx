"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Wifi, WifiOff, Fuel, RefreshCw } from "lucide-react";

interface DashboardStatusBarProps {
  pingStatus: string;
  loading: string | null;
  addGasStatus: string;
  hasSessionKey: boolean;
  hasSmartAccount: boolean;
  onPing: () => void;
  onAddGas: () => void;
}

export function DashboardStatusBar({
  pingStatus,
  loading,
  addGasStatus,
  hasSessionKey,
  hasSmartAccount,
  onPing,
  onAddGas,
}: DashboardStatusBarProps) {
  const isPingLoading = loading === "ping";
  const isAddGasLoading = loading === "addGas";
  const pingOk = pingStatus.startsWith("Success");
  const pingChecked = pingStatus.length > 0;
  const showRed = pingChecked && !pingOk && hasSessionKey;

  if (!hasSessionKey) return null;

  return (
    <div className="flex items-center gap-2">
      {isPingLoading ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking
        </span>
      ) : pingChecked ? (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
            pingOk
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {pingOk ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {pingOk ? "Connected" : "Failed"}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Wifi className="h-3 w-3" />
          Idle
        </span>
      )}

      {showRed && hasSmartAccount && (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 rounded-full px-2 text-[11px]"
            onClick={onAddGas}
            disabled={loading !== null}
          >
            {isAddGasLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Fuel className="h-3 w-3" />}
            Gas
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 rounded-full px-2 text-[11px]"
            onClick={onPing}
            disabled={loading !== null}
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      )}

      {addGasStatus && (
        <span className="max-w-[140px] truncate text-[11px] text-muted-foreground" title={addGasStatus}>
          {addGasStatus}
        </span>
      )}
    </div>
  );
}
