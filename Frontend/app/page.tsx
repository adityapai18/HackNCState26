"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();

  useEffect(() => {
    if (isConnected) {
      router.push("/dashboard");
    }
  }, [isConnected, router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-primary"
            >
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
          </div>
          <CardTitle className="text-2xl">Session Keys Dashboard</CardTitle>
          <CardDescription>
            Connect your wallet to manage smart account session keys, deposits, and withdrawals on Sepolia.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full"
            onClick={() => connect({ connector: connectors[0] })}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <svg
                  className="mr-2 h-5 w-5"
                  viewBox="0 0 35 33"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M32.9582 1L19.8241 10.7183L22.2665 4.99099L32.9582 1Z"
                    fill="#E17726"
                    stroke="#E17726"
                    strokeWidth="0.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2.66296 1L15.6886 10.809L13.3546 4.99099L2.66296 1Z"
                    fill="#E27625"
                    stroke="#E27625"
                    strokeWidth="0.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Connect with MetaMask
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Requires MetaMask or any injected wallet on Sepolia testnet
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
