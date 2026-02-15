"use client";

import { WalletInfoCard } from "@/components/dashboard/wallet-info-card";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

interface WalletInfoCardProps {
  eoaAddress: string | undefined;
  smartAccountAddress: string | null;
  step1Status: string;
  loading: string | null;
  loadingSmartAccount?: boolean;
  onCreateAccount: () => void;
}

interface AccountPanelProps extends WalletInfoCardProps {
  onMinimize: () => void;
}

export function AccountPanel({
  onMinimize,
  ...walletProps
}: AccountPanelProps) {
  return (
    <aside className="flex w-full max-w-sm flex-col border-r border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold">Account</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onMinimize}
          className="h-8 w-8 p-0"
          aria-label="Minimize account panel"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <WalletInfoCard {...walletProps} />
      </div>
    </aside>
  );
}
