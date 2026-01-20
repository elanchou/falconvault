
export interface WalletMetadata {
  notes?: string;
  withdrawalAddress?: string;
  [key: string]: string | undefined;
}

export interface WalletData {
  id: string;
  name: string;
  address: string;
  encryptedPrivateKey: string; // Base64 encoded JSON of {iv, salt, data}
  metadata?: WalletMetadata;
  createdAt: number;
}

export type OperationType = 
  // Read-Only (3)
  | 'eth_getBalance' 
  | 'eth_call' 
  | 'eth_estimateGas'
  // Signature (4)
  | 'eth_signTransaction' 
  | 'eth_sendRawTransaction' 
  | 'personal_sign' 
  | 'eth_signTypedData'
  // Vault Management (3)
  | 'vault_listWallets'
  | 'vault_getAddress'
  | 'vault_importPrivateKey';

export interface ApiRequest {
  type: OperationType;
  walletLabel?: string; 
  address?: string; // Legacy support, prefer payload
  network?: string;  
  payload?: any; 
}

export interface ServiceResponse {
  status: 'success' | 'error';
  operation?: OperationType;
  result?: any; // Generic result container
  error?: string;
  code?: string;
  // Specific fields for certain responses to match doc
  balance_wei?: string;
  balance_eth?: string;
  gas?: string;
  signedTx?: string;
  txHash?: string;
  signature?: string;
  wallets?: any[];
  address?: string;
  timestamp?: number;
  walletLabel?: string;
  broadcast_status?: string;
  explorer_link?: string;
  walletId?: string; // For import response
}

export type ViewState = 'dashboard' | 'wallets' | 'signer' | 'transfer' | 'settings' | 'docs';

export interface VaultState {
  isLocked: boolean;
  wallets: WalletData[];
  masterHash: string | null;
  integrityHash?: string; // Checksum of the encrypted data
  settings: VaultSettings;
}

export type AttributeType = 'text' | 'select' | 'date';

export interface AttributeDefinition {
  key: string;
  label: string;
  type: AttributeType;
  options?: string[]; // Comma separated values for select
}

export interface VaultSettings {
  autoLockMinutes: number;
  enableLogging: boolean;
  attributeDefinitions: AttributeDefinition[];
}

export type NetworkKey = 'mainnet' | 'zksync' | 'linea' | 'arbitrum' | 'optimism' | 'polygon' | 'base' | 'sepolia';

export interface AssetValues {
  eth: string;
  wei: bigint;
  usdt: string;
  usdc: string;
}

export interface BalanceMap {
  [walletId: string]: AssetValues | 'Error' | null;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  source: string;
}
