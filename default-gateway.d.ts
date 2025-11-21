declare module 'default-gateway' {
  export interface GatewayResult {
    gateway: string;
    int?: string;
  }

  export function gateway4sync(): GatewayResult;
  export function gateway4(): Promise<GatewayResult>;
  export function gateway6sync(): GatewayResult;
  export function gateway6(): Promise<GatewayResult>;
}
