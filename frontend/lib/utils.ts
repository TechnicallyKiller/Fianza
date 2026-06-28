import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn/ui class-merge helper.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
