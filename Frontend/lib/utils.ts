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

/** Format wei as ETH without rounding (full precision from bigint). */
export function formatWeiExact(wei: bigint | null | undefined): string {
  if (wei === null || wei === undefined) return "—";
  const s = wei.toString();
  if (s === "0") return "0 ETH";
  if (s.length <= 18) {
    const frac = s.padStart(18, "0").replace(/0+$/, "") || "0";
    return `0.${frac} ETH`;
  }
  const intPart = s.slice(0, -18);
  const fracPart = s.slice(-18).replace(/0+$/, "");
  return fracPart ? `${intPart}.${fracPart} ETH` : `${intPart} ETH`;
}
