
import React, { useState, useEffect, useMemo } from 'react';
import { WalletData, AssetValues, NetworkKey } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { 
  fetchBalance, 
  createTransferTransaction, 
  fetchNonce, 
  signTransaction, 
  broadcastTransaction, 
  NETWORKS 
} from '../services/cryptoService';
import { logger } from '../services/systemLogger';
import { 
  Send, 
  Wallet, 
  ArrowRight, 
  Lock, 
  RefreshCw, 
  ShieldAlert, 
  Check, 
  ExternalLink,
  ChevronRight,
  Database
} from 'lucide-react';
import { ethers } from 'ethers';

interface TransferHubProps {
  wallets: WalletData[];
  password: string;
}

export const TransferHub: React.FC<TransferHubProps> = ({ wallets, password }) => {
  const [selectedWalletId, setSelectedWalletId] = useState<string>(wallets[0]?.id || '');
  const [network, setNetwork] = useState<string>('mainnet');
  const [asset, setAsset] = useState<'ETH' | 'USDT' | 'USDC'>('ETH');
  const [amount, setAmount] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [status, setStatus] = useState<{status: 'idle'|'signing'|'broadcasting'|'success'|'error', msg?: string}>({status: 'idle'});
  const [balances, setBalances] = useState<Record<string, AssetValues | 'Error'>>({});
  const [isScanning, setIsScanning] = useState(false);

  const selectedWallet = useMemo(() => wallets.find(w => w.id === selectedWalletId), [wallets, selectedWalletId]);

  // Pre-fill bound address on wallet change
  useEffect(() => {
    if (selectedWallet) {
      setToAddress(selectedWallet.metadata?.withdrawalAddress || '');
      refreshBalance();
    }
  }, [selectedWalletId, network]);

  const refreshBalance = async () => {
    if (!selectedWallet) return;
    setIsScanning(true);
    try {
      const result = await fetchBalance(selectedWallet.address, network);
      setBalances(prev => ({ ...prev, [selectedWallet.id]: result }));
    } catch (e) {
      setBalances(prev => ({ ...prev, [selectedWallet.id]: 'Error' }));
    } finally {
      setIsScanning(false);
    }
  };

  const handleSetMax = () => {
    const bal = balances[selectedWalletId];
    if (!bal || bal === 'Error') return;
    
    if (asset === 'ETH') {
      const val = parseFloat(bal.eth);
      setAmount(Math.max(0, val - 0.0015).toFixed(6)); // Reserved for gas
    } else {
      setAmount(asset === 'USDT' ? bal.usdt : bal.usdc);
    }
  };

  const handleExecute = async () => {
    if (!selectedWallet || !toAddress || !amount) return;

    setStatus({ status: 'signing', msg: 'Constructing & Decrypting...' });
    try {
      const nonce = await fetchNonce(selectedWallet.address, network);
      const txData = await createTransferTransaction(toAddress, amount, asset, network);
      
      const provider = new ethers.JsonRpcProvider(NETWORKS[network][0]);
      const feeData = await provider.getFeeData();
      const net = await provider.getNetwork();

      const fullTx = {
        ...txData,
        nonce,
        chainId: net.chainId,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        gasLimit: asset === 'ETH' ? 21000 : 85000,
        type: 2
      };

      const pk = await decryptData(selectedWallet.encryptedPrivateKey, password);
      const sig = await signTransaction(pk, fullTx);

      setStatus({ status: 'broadcasting', msg: 'Pushing to Mempool...' });
      const txHash = await broadcastTransaction(sig, network);
      
      setStatus({ status: 'success', msg: txHash });
      logger.log(`Withdrawal Success: ${amount} ${asset} from ${selectedWallet.name}`, 'success', 'TransferHub');
      refreshBalance(); // Update local state
    } catch (e: any) {
      setStatus({ status: 'error', msg: e.message });
      logger.log(`Withdrawal Failed: ${e.message}`, 'error', 'TransferHub');
    }
  };

  if (wallets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 border border-slate-800 rounded-xl bg-slate-900/50">
        <Database className="w-16 h-16 mb-4 opacity-10" />
        <p>No wallets found in vault. Please import some first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] animate-in fade-in duration-500">
      {/* Wallet Selector Sidebar */}
      <div className="w-full lg:w-72 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shrink-0 shadow-lg">
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Origin</span>
            <RefreshCw className={`w-3 h-3 text-slate-500 cursor-pointer hover:text-white transition-colors ${isScanning ? 'animate-spin' : ''}`} onClick={refreshBalance} />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {wallets.map(w => (
            <button
              key={w.id}
              onClick={() => setSelectedWalletId(w.id)}
              className={`w-full flex items-center p-3 rounded-lg border transition-all ${
                selectedWalletId === w.id 
                  ? 'bg-sky-500/10 border-sky-500/40 text-sky-100' 
                  : 'bg-transparent border-transparent hover:bg-slate-800 text-slate-400'
              }`}
            >
              <div className={`p-2 rounded mr-3 ${selectedWalletId === w.id ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-600'}`}>
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-bold truncate">{w.name}</div>
                <div className="text-[10px] font-mono opacity-50 truncate">{w.address}</div>
              </div>
              {selectedWalletId === w.id && <ChevronRight className="w-4 h-4 text-sky-500" />}
            </button>
          ))}
        </div>
      </div>

      {/* Operation Hub */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-8 flex flex-col shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
            <Send className="w-32 h-32 text-white" />
        </div>

        <div className="mb-8 border-b border-slate-800 pb-6">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Send className="w-6 h-6 mr-3 text-sky-500" />
            Routine Withdrawal
          </h2>
          <p className="text-slate-400 text-sm mt-1">Execute standard transfers using bound addresses.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Controls */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Network</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-sky-500 outline-none transition-all shadow-inner"
                  value={network}
                  onChange={e => setNetwork(e.target.value)}
                >
                  {Object.keys(NETWORKS).map(n => <option key={n} value={n}>{n.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Asset</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-sky-500 outline-none transition-all shadow-inner"
                  value={asset}
                  onChange={e => setAsset(e.target.value as any)}
                >
                  <option value="ETH">ETH (Native)</option>
                  <option value="USDT">USDT</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-500 uppercase">Amount</label>
                <button onClick={handleSetMax} className="text-[10px] text-sky-500 hover:text-sky-400 font-black uppercase tracking-tighter">Use Max Available</button>
              </div>
              <div className="relative">
                <Input 
                  placeholder="0.00" 
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-xl font-mono h-14 pl-6 pr-20"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 font-black">{asset}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Destination Address</label>
              <div className="relative">
                <Input 
                  placeholder="0x..." 
                  value={toAddress}
                  onChange={e => setToAddress(e.target.value)}
                  className={`bg-slate-950 border-slate-700 h-12 ${selectedWallet?.metadata?.withdrawalAddress === toAddress ? 'border-emerald-500/30' : ''}`}
                />
                {selectedWallet?.metadata?.withdrawalAddress === toAddress && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-1 rounded">
                    <Lock className="w-3 h-3 mr-1" /> BOUND
                  </div>
                )}
              </div>
              {selectedWallet?.metadata?.withdrawalAddress && selectedWallet.metadata.withdrawalAddress !== toAddress && (
                <button 
                  onClick={() => setToAddress(selectedWallet.metadata?.withdrawalAddress || '')}
                  className="mt-2 text-[10px] text-sky-500 hover:text-sky-400 flex items-center font-bold"
                >
                  <ArrowRight className="w-3 h-3 mr-1" /> Restore Bound Address
                </button>
              )}
            </div>
          </div>

          {/* Wallet Summary */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 flex flex-col shadow-inner">
            <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Account Summary</h4>
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-900">
                <span className="text-sm text-slate-400">Current Balance</span>
                <div className="text-right">
                    <div className="text-xl font-mono text-white">
                        {balances[selectedWalletId] && balances[selectedWalletId] !== 'Error' 
                            ? (balances[selectedWalletId] as any)[asset.toLowerCase()] 
                            : '0.00'}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase">{asset} on {network}</div>
                </div>
              </div>

              <div className="space-y-3">
                 <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Signer Identity</span>
                    <span className="text-slate-200 font-mono">{selectedWallet?.address.slice(0, 10)}...{selectedWallet?.address.slice(-8)}</span>
                 </div>
                 <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Protocol</span>
                    <span className="text-slate-200 uppercase">{network} RPC v2</span>
                 </div>
                 <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Security</span>
                    <span className="text-emerald-500">AES-256-GCM Verified</span>
                 </div>
              </div>

              {status.status !== 'idle' && (
                <div className={`mt-6 p-4 rounded-xl border flex items-start animate-in zoom-in-95 duration-200 ${
                  status.status === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                  status.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                  'bg-sky-500/10 border-sky-500/30 text-sky-400'
                }`}>
                  {status.status === 'error' && <ShieldAlert className="w-5 h-5 mr-3 shrink-0" />}
                  {status.status === 'success' && <Check className="w-5 h-5 mr-3 shrink-0" />}
                  {(status.status === 'signing' || status.status === 'broadcasting') && <RefreshCw className="w-5 h-5 mr-3 shrink-0 animate-spin" />}
                  
                  <div className="min-w-0 flex-1">
                    {status.status === 'success' ? (
                      <div className="space-y-2">
                        <div className="font-bold">Transaction Sent</div>
                        <div className="text-[10px] font-mono opacity-80 break-all">{status.msg}</div>
                        <a 
                          href="#" 
                          className="flex items-center text-[10px] font-bold underline hover:opacity-80"
                          onClick={(e) => {
                            e.preventDefault();
                            const explorer = network === 'mainnet' ? 'https://etherscan.io' : 'https://explorer.zksync.io';
                            window.open(`${explorer}/tx/${status.msg}`, '_blank');
                          }}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" /> View on Explorer
                        </a>
                      </div>
                    ) : (
                      <span className="text-sm">{status.msg || 'Processing...'}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-auto">
          <Button 
            className="w-full h-16 text-lg font-black uppercase tracking-tighter shadow-xl shadow-sky-900/20" 
            size="lg"
            onClick={handleExecute}
            isLoading={status.status === 'signing' || status.status === 'broadcasting'}
            disabled={status.status === 'success' || !amount || !toAddress}
          >
            <Send className="w-5 h-5 mr-3" />
            Authenticate & Broadcast Transfer
          </Button>
        </div>
      </div>
    </div>
  );
};

const decryptData = async (encryptedBase64: string, password: string): Promise<string> => {
  const packet = JSON.parse(atob(encryptedBase64));
  const salt = new Uint8Array(packet.salt);
  const iv = new Uint8Array(packet.iv);
  const data = new Uint8Array(packet.data);

  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    data
  );

  return new TextDecoder().decode(decrypted);
};
