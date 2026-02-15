"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Wifi, WifiOff, Fuel, RefreshCw } from "lucide-react";

interface DashboardStatusBarProps {
  /** "Success. Call id: …" or error message */
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Ping status indicator */}
      {!hasSessionKey ? (
        <span className="text-xs text-muted-foreground">Issue session key to test ping</span>
      ) : isPingLoading ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking…
        </span>
      ) : pingChecked ? (
        <span
          className={`flex items-center gap-1.5 text-xs font-medium ${pingOk ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
        >
          {pingOk ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {pingOk ? "Live" : "Ping failed"}
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wifi className="h-3.5 w-3.5" />
          Not checked
        </span>
      )}

      {/* When red: Add gas + Check again */}
      {showRed && hasSmartAccount && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={onAddGas}
            disabled={loading !== null}
          >
            {isAddGasLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Fuel className="h-3 w-3" />
            )}
            Add gas
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={onPing}
            disabled={loading !== null}
          >
            <RefreshCw className="h-3 w-3" />
            Check again
          </Button>
        </>
      )}

      {addGasStatus && (
        <span className="text-xs text-muted-foreground max-w-[180px] truncate" title={addGasStatus}>
          {addGasStatus}
        </span>
      )}
    </div>
  );
}
