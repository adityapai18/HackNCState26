"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DashboardStatusBar } from "@/components/dashboard/dashboard-status-bar";
import { truncateAddress } from "@/lib/utils";
import Image from "next/image";
import { LogOut, User } from "lucide-react";

interface DashboardHeaderProps {
  eoaAddress: string | undefined;
  disconnect: () => void;
  pingStatus?: string;
  loading?: string | null;
  addGasStatus?: string;
  hasSessionKey?: boolean;
  hasSmartAccount?: boolean;
  onPing?: () => void;
  onAddGas?: () => void;
  accountPanelExpanded?: boolean;
  onAccountDialogOpen?: (open: boolean) => void;
}

export function DashboardHeader({
  eoaAddress,
  disconnect,
  pingStatus = "",
  loading = null,
  addGasStatus = "",
  hasSessionKey = false,
  hasSmartAccount = false,
  onPing = () => {},
  onAddGas = () => {},
  onAccountDialogOpen,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="flex w-full items-center justify-between gap-4 px-5 py-3 md:px-8">
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden">
            <Image src="/favicon.ico" alt="CryptoKnight" width={28} height={28} className="object-contain scale-150" />
          </div>
          <h1 className="text-base font-semibold tracking-tight">CryptoKnight</h1>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <DashboardStatusBar
            pingStatus={pingStatus}
            loading={loading}
            addGasStatus={addGasStatus}
            hasSessionKey={hasSessionKey}
            hasSmartAccount={hasSmartAccount}
            onPing={onPing}
            onAddGas={onAddGas}
          />
          {eoaAddress && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-chart-3/20 font-semibold text-foreground ring-1 ring-border/60 transition-all duration-200 hover:ring-primary/40 hover:shadow-lg hover:shadow-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  aria-label="Account menu"
                >
                  <span className="text-xs uppercase">
                    {eoaAddress.slice(2, 4)}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-xs text-muted-foreground">Connected as</p>
                  <p className="font-mono text-xs font-medium">{truncateAddress(eoaAddress, 6)}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onAccountDialogOpen?.(true)}
                  className="cursor-pointer gap-2"
                >
                  <User className="h-4 w-4" />
                  Account details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => disconnect()}
                  className="cursor-pointer gap-2 text-red-500 focus:text-red-500 dark:text-red-400 dark:focus:text-red-400"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
