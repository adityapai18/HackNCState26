"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CopyButton } from "@/components/copy-button";
import { truncateAddress } from "@/lib/utils";
import { LogOut, Wallet } from "lucide-react";

interface DashboardHeaderProps {
  eoaAddress: string | undefined;
  disconnect: () => void;
}

export function DashboardHeader({ eoaAddress, disconnect }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Session Keys Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          {eoaAddress && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {truncateAddress(eoaAddress, 4)}
                  </Badge>
                  <CopyButton value={eoaAddress} className="h-6 w-6" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-mono text-xs">{eoaAddress}</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Button variant="ghost" size="sm" onClick={() => disconnect()}>
            <LogOut className="mr-1 h-4 w-4" />
            Disconnect
          </Button>
        </div>
      </div>
    </header>
  );
}
