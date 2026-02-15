"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WalletInfoCard } from "@/components/dashboard/wallet-info-card";

interface WalletInfoCardProps {
  eoaAddress: string | undefined;
  smartAccountAddress: string | null;
  step1Status: string;
  loading: string | null;
  loadingSmartAccount?: boolean;
  onCreateAccount: () => void;
}

interface AccountDialogProps extends WalletInfoCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountDialog({
  open,
  onOpenChange,
  ...walletProps
}: AccountDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">Account</DialogTitle>
          <DialogDescription className="text-sm">
            Your wallet and smart account details.
          </DialogDescription>
        </DialogHeader>
        <WalletInfoCard {...walletProps} />
      </DialogContent>
    </Dialog>
  );
}
