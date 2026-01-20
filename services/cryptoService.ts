
import { ethers } from 'ethers';
import { NetworkKey, AssetValues } from '../types';
import { logger } from './systemLogger';

// --- Configuration ---

// Using arrays of RPCs for redundancy. If one fails, the next is attempted.
export const NETWORKS: Record<string, string[]> = {
  mainnet: [
    "https://eth.llamarpc.com",
    "https://rpc.ankr.com/eth",
    "https://1rpc.io/eth",
    "https://cloudflare-eth.com"
  ],
  arbitrum: [
    "https://arb1.arbitrum.io/rpc",
    "https://rpc.ankr.com/arbitrum",
    "https://1rpc.io/arb"
  ],
  optimism: [
    "https://mainnet.optimism.io",
    "https://rpc.ankr.com/optimism",
    "https://optimism.llamarpc.com"
  ],
  polygon: [
    "https://polygon-rpc.com",
    "https://rpc.ankr.com/polygon",
    "https://1rpc.io/matic"
  ],
  base: [
    "https://mainnet.base.org",
    "https://base.llamarpc.com",
    "https://1rpc.io/base"
  ],
  zksync: [
    "https://mainnet.era.zksync.io",
    "https://1rpc.io/zksync2-era"
  ],
  linea: [
    "https://rpc.linea.build",
    "https://1rpc.io/linea"
  ],
  sepolia: [
    "https://rpc.ankr.com/eth_sepolia",
    "https://1rpc.io/sepolia"
  ]
};

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint amount) returns (bool)"
];

// Token Contracts (Address mapping) - Exported for UI use
export const TOKEN_ADDRESSES: Record<string, { usdt?: string; usdc?: string }> = {
  mainnet: {
    usdt: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    usdc: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
  },
  arbitrum: {
    usdt: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
  },
  optimism: {
    usdt: "0x94b008aA00579c1307B0EF2c499aD98a8ce98748",
    usdc: "0x0b2C630C5307324423542016988782fC8f48345e"
  },
  polygon: {
    usdt: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"
  },
  base: {
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  },
  zksync: {
    usdc: "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4"
  },
  linea: {
    usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff"
  }
};

// --- Web Crypto API Helpers (Unchanged) ---

async function getKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export const encryptData = async (data: string, password: string): Promise<string> => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey(password, salt);
  const enc = new TextEncoder();
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(data)
  );

  const packet = {
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  };
  return btoa(JSON.stringify(packet));
};

export const decryptData = async (encryptedBase64: string, password: string): Promise<string> => {
  try {
    const packet = JSON.parse(atob(encryptedBase64));
    const salt = new Uint8Array(packet.salt);
    const iv = new Uint8Array(packet.iv);
    const data = new Uint8Array(packet.data);

    const key = await getKey(password, salt);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      data
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (e) {
    throw new Error("Decryption failed. Password incorrect or data corrupted.");
  }
};

export const generateIntegrityHash = async (data: any): Promise<string> => {
  const str = JSON.stringify(data);
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const hashPassword = async (password: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Blockchain Logic ---

export const getNetworkMetadata = (chainId: number) => {
    switch (Number(chainId)) {
        case 1: return { key: 'mainnet', name: 'Ethereum Mainnet', explorer: 'https://etherscan.io' };
        case 42161: return { key: 'arbitrum', name: 'Arbitrum One', explorer: 'https://arbiscan.io' };
        case 10: return { key: 'optimism', name: 'Optimism', explorer: 'https://optimistic.etherscan.io' };
        case 137: return { key: 'polygon', name: 'Polygon', explorer: 'https://polygonscan.com' };
        case 8453: return { key: 'base', name: 'Base', explorer: 'https://basescan.org' };
        case 324: return { key: 'zksync', name: 'zkSync Era', explorer: 'https://explorer.zksync.io' };
        case 59144: return { key: 'linea', name: 'Linea', explorer: 'https://lineascan.build' };
        case 11155111: return { key: 'sepolia', name: 'Sepolia', explorer: 'https://sepolia.etherscan.io' };
        default: return null;
    }
};

export const createWalletFromKey = (privateKey: string) => {
  try {
    const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const wallet = new ethers.Wallet(pk);
    return { address: wallet.address, valid: true, normalizedKey: pk };
  } catch (e) {
    return { address: '', valid: false, normalizedKey: '' };
  }
};

export const signMessage = async (privateKey: string, message: string): Promise<string> => {
  const wallet = new ethers.Wallet(privateKey);
  return await wallet.signMessage(message);
};

export const signTransaction = async (privateKey: string, transaction: any): Promise<string> => {
  const wallet = new ethers.Wallet(privateKey);
  return await wallet.signTransaction(transaction);
};

export const signTypedData = async (privateKey: string, payload: any): Promise<string> => {
  const wallet = new ethers.Wallet(privateKey);
  if (!payload.domain || !payload.types || !payload.value) {
    throw new Error("TypedData payload must contain domain, types, and value");
  }
  return await wallet.signTypedData(payload.domain, payload.types, payload.value);
};

const formatValue = (val: bigint, decimals: number = 18): string => {
    try {
        const formatted = ethers.formatUnits(val, decimals);
        const num = parseFloat(formatted);
        if (num === 0) return "0.00";
        if (num < 0.0001) return "< 0.0001";
        
        const parts = formatted.split('.');
        if (parts.length > 1) {
            return `${parts[0]}.${parts[1].substring(0, 4)}`; // Truncate to 4 decimals
        }
        return formatted;
    } catch(e) {
        return "0.00";
    }
};

// Retry logic wrapper
const fetchWithRetry = async (urls: string[], callback: (provider: ethers.JsonRpcProvider) => Promise<any>): Promise<any> => {
    let lastError;
    for (const url of urls) {
        try {
            const provider = new ethers.JsonRpcProvider(url);
            // Quick check network
            await provider.getNetwork(); 
            return await callback(provider);
        } catch (e) {
            lastError = e;
            // Continue to next URL
        }
    }
    throw lastError || new Error("All RPCs failed");
}

export const ethCall = async (tx: any, networkKey: string): Promise<string> => {
    const rpcUrls = NETWORKS[networkKey.toLowerCase()];
    if (!rpcUrls) throw new Error(`Unsupported network key: ${networkKey}`);

    try {
        return await fetchWithRetry(rpcUrls, async (provider) => {
            return await provider.call(tx);
        });
    } catch (e: any) {
        const msg = e.message || 'eth_call failed';
        logger.log(`Call failed on ${networkKey}: ${msg}`, 'error', 'RPC');
        throw e;
    }
};

export const estimateGas = async (tx: any, networkKey: string): Promise<bigint> => {
    const rpcUrls = NETWORKS[networkKey.toLowerCase()];
    if (!rpcUrls) throw new Error(`Unsupported network key: ${networkKey}`);

    try {
        return await fetchWithRetry(rpcUrls, async (provider) => {
            return await provider.estimateGas(tx);
        });
    } catch (e: any) {
         const msg = e.message || 'estimateGas failed';
        logger.log(`Estimate Gas failed on ${networkKey}: ${msg}`, 'error', 'RPC');
        throw e;
    }
};

export const fetchNonce = async (address: string, networkKey: string): Promise<number> => {
    const rpcUrls = NETWORKS[networkKey.toLowerCase()];
    if (!rpcUrls) throw new Error(`Unsupported network key: ${networkKey}`);

    try {
        return await fetchWithRetry(rpcUrls, async (provider) => {
            return await provider.getTransactionCount(address);
        });
    } catch (e: any) {
        const msg = e.message || 'Fetch Nonce failed';
        logger.log(`Nonce fetch failed on ${networkKey}: ${msg}`, 'error', 'RPC');
        throw e;
    }
};

export const broadcastTransaction = async (rawTx: string, networkKey: string): Promise<string> => {
    const rpcUrls = NETWORKS[networkKey.toLowerCase()];
    if (!rpcUrls) throw new Error(`Unsupported network key: ${networkKey}`);

    try {
        return await fetchWithRetry(rpcUrls, async (provider) => {
            const txResponse = await provider.broadcastTransaction(rawTx);
            return txResponse.hash;
        });
    } catch (e: any) {
        const msg = e.message || 'Broadcast failed';
        logger.log(`Broadcast failed on ${networkKey}: ${msg}`, 'error', 'RPC');
        throw e;
    }
};

export const fetchBalance = async (address: string, networkKey: string = 'mainnet'): Promise<AssetValues | 'Error'> => {
  const rpcUrls = NETWORKS[networkKey.toLowerCase()] || NETWORKS['mainnet'];
  const tokens = TOKEN_ADDRESSES[networkKey.toLowerCase()] || {};
  
  try {
    return await fetchWithRetry(rpcUrls, async (provider) => {
        // 1. Fetch ETH Balance
        // 5s timeout per request to fail fast
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("RPC Timeout")), 5000));
        
        const ethBalancePromise = Promise.race([
            provider.getBalance(address), 
            timeoutPromise
        ]) as Promise<bigint>;
        
        // 2. Fetch USDT
        let usdtPromise = Promise.resolve(BigInt(0));
        if (tokens.usdt) {
            const usdtContract = new ethers.Contract(tokens.usdt, ERC20_ABI, provider);
            usdtPromise = usdtContract.balanceOf(address).catch(() => BigInt(0));
        }

        // 3. Fetch USDC
        let usdcPromise = Promise.resolve(BigInt(0));
        if (tokens.usdc) {
            const usdcContract = new ethers.Contract(tokens.usdc, ERC20_ABI, provider);
            usdcPromise = usdcContract.balanceOf(address).catch(() => BigInt(0));
        }

        const [ethBal, usdtBal, usdcBal] = await Promise.all([ethBalancePromise, usdtPromise, usdcPromise]);

        return {
            eth: formatValue(ethBal, 18),
            wei: ethBal,
            usdt: formatValue(usdtBal, 6),
            usdc: formatValue(usdcBal, 6)
        };
    });

  } catch (e: any) {
    const msg = e.message || 'Unknown Error';
    if (!msg.includes('rate limit')) {
        logger.log(`Scanning failed for ${networkKey}: ${msg}`, 'warning', 'RPC');
    }
    return "Error";
  }
};

// New Helper: Build transfer transaction
export const createTransferTransaction = async (
    to: string, 
    amount: string, 
    token: 'ETH' | 'USDT' | 'USDC', 
    network: string
): Promise<any> => {
    const tokens = TOKEN_ADDRESSES[network.toLowerCase()];
    
    // ETH Transfer
    if (token === 'ETH') {
        const valueWei = ethers.parseEther(amount);
        return {
            to,
            value: valueWei, // ethers v6 automatic hex conversion
            data: "0x"
        };
    }

    // ERC20 Transfer
    const tokenAddress = token === 'USDT' ? tokens?.usdt : tokens?.usdc;
    if (!tokenAddress) throw new Error(`${token} contract not configured for ${network}`);

    const iface = new ethers.Interface(ERC20_ABI);
    // USDT/USDC usually 6 decimals, but check standard. For this app we assume 6 for USD coins on most EVMs.
    // In production, we should read decimals() from contract, but for speed we'll use 6 for now.
    const decimals = 6; 
    const amountUnits = ethers.parseUnits(amount, decimals);
    
    const data = iface.encodeFunctionData("transfer", [to, amountUnits]);
    
    return {
        to: tokenAddress,
        value: 0,
        data: data
    };
};
