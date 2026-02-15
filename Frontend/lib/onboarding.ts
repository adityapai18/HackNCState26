const STORAGE_KEY_PREFIX = "onboarding_done_";

function key(eoa: string): string {
  return STORAGE_KEY_PREFIX + eoa.toLowerCase();
}

export function hasCompletedOnboarding(eoa: string | undefined): boolean {
  if (typeof window === "undefined" || !eoa) return false;
  try {
    return localStorage.getItem(key(eoa)) === "1";
  } catch {
    return false;
  }
}

export function setOnboardingComplete(eoa: string | undefined): void {
  if (typeof window === "undefined" || !eoa) return;
  try {
    localStorage.setItem(key(eoa), "1");
  } catch {
    // ignore
  }
}
