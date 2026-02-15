"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { hasCompletedOnboarding } from "@/lib/onboarding";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isConnected, address } = useAccount();

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
      return;
    }
    if (address && !hasCompletedOnboarding(address)) {
      router.push("/onboarding");
    }
  }, [isConnected, address, router]);

  if (!isConnected) return null;
  if (address && !hasCompletedOnboarding(address)) return null;

  return <>{children}</>;
}
