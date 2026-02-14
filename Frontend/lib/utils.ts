import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateAddress(address: string, chars = 6): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatWei(wei: bigint | null | undefined): string {
  if (wei === null || wei === undefined) return "—";
  const ethValue = Number(wei) / 1e18;
  if (ethValue === 0) return "0 ETH";
  if (ethValue < 0.000001) return `${wei.toString()} wei`;
  return `${ethValue.toFixed(6)} ETH`;
}
