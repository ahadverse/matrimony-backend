export const BKASH_GATEWAY = 'BKASH_GATEWAY';
export const NAGAD_GATEWAY = 'NAGAD_GATEWAY';

export interface PaymentInitResult {
  redirectUrl: string;
  providerReference: string;
}

export interface PaymentCallbackResult {
  success: boolean;
  providerReference: string;
  amount: number;
  raw: Record<string, any>;
}

export interface PaymentGateway {
  /** Starts a checkout session for the given amount, returns the URL to redirect the payer to. */
  init(params: { amount: number; orderId: string }): Promise<PaymentInitResult>;

  /** Verifies a provider callback/redirect and reports whether the payment actually succeeded. */
  handleCallback(query: Record<string, string>): Promise<PaymentCallbackResult>;
}
