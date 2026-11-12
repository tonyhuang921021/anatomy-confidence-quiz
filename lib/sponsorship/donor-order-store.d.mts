import type { DonorPreferences, DonorPreferencesInput } from './donor-projection.mjs';
export type StoredDonorPreferences = DonorPreferences & { readonly revision: number };
export function safeStoredDonorPreferences(value: unknown): StoredDonorPreferences | null;
export function createSupabaseSandboxDonorOrderStore(client: { rpc(name: string, args: Record<string, unknown>): Promise<unknown> }, options: { ownerId: string; donorPreferences?: DonorPreferencesInput | DonorPreferences }): Readonly<{
  durable: true;
  reserve(input: any): Promise<any>;
  saveCheckout(orderId: string, value: any): Promise<any>;
  markUncertain(orderId: string): Promise<any>;
  markVerifiedPaid(orderId: string, checkoutId: string, amount: number): Promise<any>;
  getOrder(orderId: string): Promise<any>;
  getDonorPreferences(orderId: string): Promise<StoredDonorPreferences | null>;
  withdrawDonorConsent(orderId: string, value: { withdrawDisplayName: boolean; withdrawAmount: boolean }): Promise<StoredDonorPreferences | null>;
}>;
