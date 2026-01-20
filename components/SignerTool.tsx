
import React, { useState } from 'react';
import { WalletData, ApiRequest, ServiceResponse } from '../types';
import { Button } from './Button';
import { decryptData, signMessage, signTransaction, signTypedData, fetchBalance, broadcastTransaction, fetchNonce, ethCall, estimateGas, NETWORKS, getNetworkMetadata, createWalletFromKey, encryptData } from '../services/cryptoService';
import { Terminal, Lock, CheckCircle, AlertCircle, Play, Code, Network, Send, RefreshCw, Calculator, ArrowDown } from 'lucide-react';
import { logger } from '../services/systemLogger';
import { ethers } from 'ethers';

interface SignerToolProps {
  wallets: WalletData[];
  password: string;
  onAddWallet: (wallet: WalletData) => void;
}

// Full API Templates (Strictly 10 interfaces)
const TEMPLATES = {
  // Read Only
  eth_getBalance: `{
  "type": "eth_getBalance",
  "address": "0x...", 
  "network": "zksync"
}`,
  eth_call: `{
  "type": "eth_call",
  "network": "mainnet",
  "payload": {
    "to": "0x6b175474e89094c44da98b954eedeac495271d0f",
    "data": "0x18160ddd" 
  }
}`,
  eth_estimateGas: `{
  "type": "eth_estimateGas",
  "network": "mainnet",
  "payload": {
    "to": "0x...",
    "value": "1000000000000000",
    "data": "0x"
  }
}`,
  // Signatures
  personal_sign: `{
  "type": "personal_sign",
  "walletLabel": "SELECT_WALLET_LABEL",
  "payload": "Login to FalconService at 2024-05-20T10:00:00Z"
}`,
  eth_signTransaction: `{
  "type": "eth_signTransaction",
  "walletLabel": "SELECT_WALLET_LABEL",
  "payload": {
    "to": "0xDESTINATION",
    "value": "1000000000000000",
    "chainId": 1,
    "nonce": 0,
    "gasLimit": "21000",
    "maxFeePerGas": "30000000000",
    "maxPriorityFeePerGas": "1500000000"
  }
}`,
  eth_sendRawTransaction: `{
  "type": "eth_sendRawTransaction",
  "network": "mainnet",
  "payload": {
     "raw": "0x02f8..." 
  }
}`,
  eth_signTypedData: `{
  "type": "eth_signTypedData",
  "walletLabel": "SELECT_WALLET_LABEL",
  "payload": {
    "domain": {
      "name": "Ether Mail",
      "version": "1",
      "chainId": 1,
      "verifyingContract": "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
    },
    "types": {
      "Person": [
        { "name": "name", "type": "string" },
        { "name": "wallet", "type": "address" }
      ]
    },
    "value": {
      "name": "Bob",
      "wallet": "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"
    }
  }
}`,
  // Vault Management
  vault_listWallets: `{
  "type": "vault_listWallets"
}`,
  vault_getAddress: `{
  "type": "vault_getAddress",
  "walletLabel": "SELECT_WALLET_LABEL"
}`,
  vault_importPrivateKey: `{
  "type": "vault_importPrivateKey",
  "payload": {
      "label": "MyNewWallet",
      "privateKey": "0x..."
  }
}`
};

export const SignerTool: React.FC<SignerToolProps> = ({ wallets, password, onAddWallet }) => {
  const [requestJson, setRequestJson] = useState(TEMPLATES.eth_getBalance);
  const [responseJson, setResponseJson] = useState<string>('');
  const [lastSignature, setLastSignature] = useState<{sig: string, chainId?: number} | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [broadcastState, setBroadcastState] = useState<{status: 'idle'|'sending'|'success'|'error', msg?: string}>({status: 'idle'});
  const [isFetchingNonce, setIsFetchingNonce] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  // ABI Encoder State
  const [showAbiTool, setShowAbiTool] = useState(false);
  const [abiFunc, setAbiFunc] = useState('transfer(address to, uint256 amount)');
  const [abiArgs, setAbiArgs] = useState('0x123..., 1000000000000000000');
  const [abiError, setAbiError] = useState('');

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const loadTemplate = (type: keyof typeof TEMPLATES) => {
    let currentLabel = "SELECT_WALLET_LABEL";
    try {
        const parsed = JSON.parse(requestJson);
        if(parsed.walletLabel) currentLabel = parsed.walletLabel;
    } catch(e) {}

    const template = JSON.parse(TEMPLATES[type]);
    if (template.walletLabel) template.walletLabel = currentLabel;
    setRequestJson(JSON.stringify(template, null, 2));
    setLastSignature(null); 
    setBroadcastState({status: 'idle'});
    
    // Auto-open ABI tool for generic calls
    if (type === 'eth_call') setShowAbiTool(true);
  };

  const handleAbiEncode = () => {
    setAbiError('');
    try {
        let sig = abiFunc.trim();
        if (!sig.startsWith('function')) sig = `function ${sig}`;
        
        let args: any[] = [];
        const cleanArgs = abiArgs.trim();
        if (cleanArgs.startsWith('[') && cleanArgs.endsWith(']')) {
             args = JSON.parse(cleanArgs);
        } else {
             args = cleanArgs.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
        }

        const iface = new ethers.Interface([sig]);
        const funcName = sig.split('(')[0].split(' ')[1];
        const data = iface.encodeFunctionData(funcName, args);

        const currentReq = JSON.parse(requestJson);
        if (currentReq.payload) {
            currentReq.payload.data = data;
            setRequestJson(JSON.stringify(currentReq, null, 2));
            addLog(`ABI Encoded successfully: ${funcName}`);
            logger.log(`Generated calldata for ${funcName}`, 'info', 'ABI');
        } else {
            throw new Error("Select a template with a 'payload' object first");
        }
    } catch (e: any) {
        setAbiError(e.message);
        addLog(`ABI Error: ${e.message}`);
    }
  };

  const handleAutoFillNonce = async () => {
    setIsFetchingNonce(true);
    try {
      const request = JSON.parse(requestJson);
      
      let targetAddress = request.address;
      if (!targetAddress && request.walletLabel) {
         const w = wallets.find(w => w.name === request.walletLabel);
         if (w) targetAddress = w.address;
      }
      
      if (!targetAddress) throw new Error("Could not resolve address. Select a valid wallet or add 'address' field.");

      let networkKey = request.network;
      if (!networkKey && request.payload?.chainId) {
          const meta = getNetworkMetadata(request.payload.chainId);
          if (meta) networkKey = meta.key;
      }
      if (!networkKey) networkKey = 'mainnet';

      addLog(`Fetching next nonce for ${targetAddress.slice(0,8)}... on ${networkKey}`);
      const nonce = await fetchNonce(targetAddress, networkKey);
      
      if (request.payload) {
          request.payload.nonce = nonce;
      } else {
          request.nonce = nonce;
      }
      
      setRequestJson(JSON.stringify(request, null, 2));
      addLog(`Success! Nonce updated to: ${nonce}`);
      logger.log(`Nonce auto-filled: ${nonce}`, 'info', 'RPC');

    } catch (e: any) {
      addLog(`Nonce Fetch Error: ${e.message}`);
    } finally {
        setIsFetchingNonce(false);
    }
  };

  const handleProcessRequest = async () => {
    setStatus('processing');
    setResponseJson('');
    setLogs([]);
    setLastSignature(null);
    setBroadcastState({status: 'idle'});
    addLog("Received API request...");

    try {
      let request: ApiRequest;
      try {
        request = JSON.parse(requestJson);
        addLog(`Payload parsed. Type: ${request.type}`);
      } catch (e) {
        throw new Error("Invalid JSON format.");
      }

      // --- 1. VAULT MANAGEMENT METHODS (No Crypto, No Keys for retrieval) ---
      if (request.type.startsWith('vault_')) {
          let response: ServiceResponse;
          
          if (request.type === 'vault_listWallets') {
             response = {
                 status: 'success',
                 operation: request.type,
                 wallets: wallets.map(w => ({ label: w.name, address: w.address }))
             };
          } else if (request.type === 'vault_getAddress') {
             const w = wallets.find(w => w.name === request.walletLabel);
             if (!w) throw new Error(`Wallet not found: ${request.walletLabel}`);
             response = {
                 status: 'success',
                 operation: request.type,
                 address: w.address
             };
          } else if (request.type === 'vault_importPrivateKey') {
              // Handle Import via API
              if (!request.payload?.label || !request.payload?.privateKey) {
                  throw new Error("Import requires 'label' and 'privateKey' in payload");
              }
              const label = request.payload.label;
              if (wallets.some(w => w.name === label)) throw new Error(`Wallet label '${label}' already exists`);
              
              const { address, valid } = createWalletFromKey(request.payload.privateKey);
              if (!valid) throw new Error("Invalid Private Key");

              const encrypted = await encryptData(request.payload.privateKey, password);
              const newWallet: WalletData = {
                  id: crypto.randomUUID(),
                  name: label,
                  address,
                  encryptedPrivateKey: encrypted,
                  createdAt: Date.now(),
                  metadata: { notes: 'Imported via API' }
              };
              
              onAddWallet(newWallet);
              
              response = {
                  status: 'success',
                  operation: request.type,
                  walletId: newWallet.id,
                  address: newWallet.address,
                  walletLabel: newWallet.name
              };
          } else {
              throw new Error("Unknown vault method");
          }
          
          setResponseJson(JSON.stringify(response, null, 2));
          setStatus('success');
          return;
      }

      // --- 2. READ-ONLY RPC METHODS (No Private Key) ---
      if (['eth_getBalance', 'eth_call', 'eth_estimateGas', 'eth_sendRawTransaction'].includes(request.type)) {
           const network = request.network || 'mainnet';
           addLog(`Executing Read-Only/RPC Op on ${network}...`);
           
           let response: ServiceResponse = { status: 'success', operation: request.type };

           if (request.type === 'eth_getBalance') {
               const addr = request.address || request.payload?.address;
               if (!addr) throw new Error("Missing 'address'");
               const bal = await fetchBalance(addr, network);
               if (bal === 'Error') throw new Error("RPC Error fetching balance");
               response.balance_wei = bal.wei.toString();
               response.balance_eth = bal.eth;
           } 
           else if (request.type === 'eth_call') {
               if (!request.payload) throw new Error("Missing payload");
               const res = await ethCall(request.payload, network);
               response.result = res;
           }
           else if (request.type === 'eth_estimateGas') {
               if (!request.payload) throw new Error("Missing payload");
               const gas = await estimateGas(request.payload, network);
               response.gas = gas.toString();
           }
           else if (request.type === 'eth_sendRawTransaction') {
               if (!request.payload?.raw) throw new Error("Missing payload.raw (hex string)");
               const txHash = await broadcastTransaction(request.payload.raw, network);
               response.txHash = txHash;
           }

           setResponseJson(JSON.stringify(response, null, 2));
           setStatus('success');
           addLog("RPC Operation Successful.");
           return;
      }

      // --- 3. SIGNATURE METHODS (Requires Private Key) ---
      
      // Resolve Wallet
      let targetWallet: WalletData | undefined;
      if (request.walletLabel) {
          targetWallet = wallets.find(w => w.name === request.walletLabel);
          if (targetWallet) {
             addLog(`Resolved Wallet Label '${request.walletLabel}'`);
          }
      }

      if (!targetWallet) {
          throw new Error(`Operation ${request.type} requires a valid 'walletLabel' present in the vault.`);
      }

      addLog(`Decrypting key for ${targetWallet.name}...`);
      const privateKey = await decryptData(targetWallet.encryptedPrivateKey, password);
      addLog("Decryption successful.");

      let response: ServiceResponse = { status: 'success', operation: request.type, walletLabel: targetWallet.name };

      if (request.type === 'personal_sign') {
         addLog("Signing message...");
         const sig = await signMessage(privateKey, request.payload);
         response.signature = sig;
      } 
      else if (request.type === 'eth_signTransaction') {
         addLog("Signing transaction...");
         const sig = await signTransaction(privateKey, request.payload);
         response.signedTx = sig;
         response.txHash = ethers.keccak256(sig);
         
         // Store for UI broadcast
         if (request.payload.chainId) {
             setLastSignature({ sig: sig, chainId: Number(request.payload.chainId) });
         }
      } 
      else if (request.type === 'eth_signTypedData') {
         addLog("Signing typed data (EIP-712)...");
         const sig = await signTypedData(privateKey, request.payload);
         response.signature = sig;
      } 
      else {
          throw new Error("Unsupported operation type");
      }
      
      setResponseJson(JSON.stringify(response, null, 2));
      setStatus('success');
      addLog("Signature generated successfully.");
      logger.log(`Signed ${request.type} with ${targetWallet.name}`, 'success', 'Signer');

    } catch (err: any) {
      setStatus('error');
      const errorResponse: ServiceResponse = {
          status: 'error',
          code: 'EXECUTION_ERROR',
          error: err.message
      };
      setResponseJson(JSON.stringify(errorResponse, null, 2));
      addLog(`Error: ${err.message}`);
      logger.log(`Op failed: ${err.message}`, 'error', 'Signer');
    }
  };

  const handleBroadcast = async () => {
      if (!lastSignature || !lastSignature.chainId) return;
      
      const meta = getNetworkMetadata(lastSignature.chainId);
      if (!meta) {
          setBroadcastState({status: 'error', msg: `Chain ID ${lastSignature.chainId} is not configured with an RPC endpoint.`});
          return;
      }

      setBroadcastState({status: 'sending'});
      addLog(`Broadcasting transaction to ${meta.name} (ChainID: ${lastSignature.chainId})...`);

      try {
          const txHash = await broadcastTransaction(lastSignature.sig, meta.key);
          setBroadcastState({status: 'success', msg: txHash});
          addLog(`Broadcast Success! TxHash: ${txHash}`);
          logger.log(`Transaction broadcasted: ${txHash}`, 'success', 'RPC');
          
          // Update response with tx hash
          try {
              const currentResp = JSON.parse(responseJson);
              currentResp.broadcast_status = "success";
              currentResp.tx_hash = txHash;
              setResponseJson(JSON.stringify(currentResp, null, 2));
          } catch(e) {}

      } catch (e: any) {
          setBroadcastState({status: 'error', msg: e.message});
          addLog(`Broadcast Error: ${e.message}`);
      }
  };

  const renderBroadcastSection = () => {
      if (!lastSignature || !lastSignature.chainId) return null;

      const meta = getNetworkMetadata(lastSignature.chainId);
      
      return (
        <div className="mt-4 pt-4 border-t border-slate-800 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
                <div className="text-sm">
                    <span className="text-slate-400 block mb-1">Ready to Broadcast?</span>
                    <div className="flex items-center space-x-2">
                         <Network className="w-4 h-4 text-sky-500" />
                         <span className={`font-bold uppercase ${meta ? 'text-white' : 'text-amber-500'}`}>
                             {meta ? meta.name : `Unknown Chain (${lastSignature.chainId})`}
                         </span>
                    </div>
                </div>
                
                {broadcastState.status === 'success' && meta ? (
                    <div className="flex flex-col items-end">
                        <span className="text-emerald-400 font-bold flex items-center mb-1">
                            <CheckCircle className="w-4 h-4 mr-1" /> Sent
                        </span>
                        <a 
                            href={`${meta.explorer}/tx/${broadcastState.msg}`} 
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-sky-500 hover:text-sky-300 underline"
                        >
                            View on Explorer
                        </a>
                    </div>
                ) : (
                    <Button 
                        onClick={handleBroadcast} 
                        isLoading={broadcastState.status === 'sending'}
                        disabled={!meta}
                        title={!meta ? "No RPC configured for this Chain ID" : "Broadcast transaction"}
                    >
                        <Send className="w-4 h-4 mr-2" />
                        {meta ? "Broadcast to Chain" : "Unsupported Chain"}
                    </Button>
                )}
            </div>
            {broadcastState.status === 'error' && (
                <div className="mt-2 text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-900/50">
                    Error: {broadcastState.msg}
                </div>
            )}
        </div>
      );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-140px)] animate-in fade-in duration-500">
      
      {/* Left Column: Request Input */}
      <div className="flex flex-col space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center text-slate-100 font-semibold">
              <Terminal className="w-5 h-5 mr-2 text-sky-500" />
              API Request Payload
            </div>
            <div className="flex flex-wrap gap-1">
                 {/* Vault Methods */}
                 <div className="flex gap-1 border-r border-slate-700 pr-1 mr-1">
                    <button onClick={() => loadTemplate('vault_listWallets')} className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 transition">List</button>
                    <button onClick={() => loadTemplate('vault_importPrivateKey')} className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 transition">Import</button>
                 </div>
                 {/* RPC Methods */}
                 <div className="flex gap-1 border-r border-slate-700 pr-1 mr-1">
                    <button onClick={() => loadTemplate('eth_getBalance')} className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-sky-900/30 text-sky-400 border border-sky-900/50 transition">Bal</button>
                    <button onClick={() => loadTemplate('eth_call')} className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-sky-900/30 text-sky-400 border border-sky-900/50 transition">Call</button>
                    <button onClick={() => loadTemplate('eth_estimateGas')} className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-sky-900/30 text-sky-400 border border-sky-900/50 transition">Gas</button>
                 </div>
                 {/* Sign Methods */}
                 <div className="flex gap-1">
                    <button onClick={() => loadTemplate('personal_sign')} className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-purple-900/30 text-purple-400 border border-purple-900/50 transition">Sign</button>
                    <button onClick={() => loadTemplate('eth_signTransaction')} className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-purple-900/30 text-purple-400 border border-purple-900/50 transition">Tx</button>
                    <button onClick={() => loadTemplate('eth_signTypedData')} className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-purple-900/30 text-purple-400 border border-purple-900/50 transition">EIP712</button>
                 </div>
            </div>
          </div>

          <div className="relative mb-4 min-h-[200px] md:flex-1">
            <textarea 
                className="w-full h-full min-h-[200px] bg-slate-950 font-mono text-sm text-slate-300 p-4 rounded-lg border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none resize-none"
                value={requestJson}
                onChange={(e) => setRequestJson(e.target.value)}
                spellCheck={false}
            />
            <div className="absolute top-2 right-2 flex space-x-2">
                <button 
                    onClick={() => setShowAbiTool(!showAbiTool)}
                    className="bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs px-2 py-1 rounded flex items-center border border-slate-700 shadow-sm transition-all opacity-80 hover:opacity-100"
                    title="Open ABI Encoder Tool"
                >
                    <Calculator className="w-3 h-3 mr-1" />
                    ABI
                </button>
                <button 
                    onClick={handleAutoFillNonce}
                    disabled={isFetchingNonce}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded flex items-center border border-slate-700 shadow-sm transition-all opacity-80 hover:opacity-100"
                    title="Fetch next nonce from chain"
                >
                    <RefreshCw className={`w-3 h-3 mr-1 ${isFetchingNonce ? 'animate-spin' : ''}`} />
                    Nonce
                </button>
            </div>
          </div>
          
          {/* ABI Encoder Tool */}
          {showAbiTool && (
             <div className="mb-4 bg-slate-950 border border-slate-700 rounded-lg p-3 animate-in fade-in slide-in-from-top-2">
                 <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-emerald-500 uppercase flex items-center"><Code className="w-3 h-3 mr-1"/> ABI Data Encoder</span>
                    <button onClick={() => setShowAbiTool(false)} className="text-[10px] text-slate-500 hover:text-white">Close</button>
                 </div>
                 <div className="space-y-2">
                     <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Function Signature</label>
                        <input 
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-300 focus:border-emerald-500 outline-none" 
                            value={abiFunc}
                            onChange={(e) => setAbiFunc(e.target.value)}
                            placeholder="transfer(address to, uint256 amount)"
                        />
                     </div>
                     <div>
                        <label className="text-[10px] text-slate-500 block mb-1">Arguments (Comma separated)</label>
                        <input 
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-300 focus:border-emerald-500 outline-none" 
                            value={abiArgs}
                            onChange={(e) => setAbiArgs(e.target.value)}
                            placeholder="0x123..., 100"
                        />
                     </div>
                     {abiError && <div className="text-[10px] text-red-400">{abiError}</div>}
                     <button 
                        onClick={handleAbiEncode}
                        className="w-full bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-900/50 text-emerald-400 text-xs py-1.5 rounded transition-colors flex items-center justify-center"
                     >
                        Generate Data & Apply <ArrowDown className="w-3 h-3 ml-1" />
                     </button>
                 </div>
             </div>
          )}

          <div className="flex justify-between items-center">
            <div className="flex items-center text-xs text-slate-500 space-x-2">
               <span>Supported Networks:</span>
               {Object.keys(NETWORKS).slice(0, 3).map(n => (
                   <span key={n} className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">{n}</span>
               ))}
            </div>
            <Button onClick={handleProcessRequest} isLoading={status === 'processing'}>
              <Play className="w-4 h-4 mr-2" />
              Execute Request
            </Button>
          </div>
          <div className="flex gap-2 mt-2 overflow-x-auto pb-2 scrollbar-hide">
            {wallets.map(w => (
              <button 
                key={w.id}
                onClick={() => {
                  try {
                    const req = JSON.parse(requestJson);
                    req.walletLabel = w.name;
                    if(req.type === 'eth_getBalance') req.address = w.address;
                    setRequestJson(JSON.stringify(req, null, 2));
                  } catch(e) {}
                }}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-700 whitespace-nowrap"
              >
                Use {w.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Output & Logs */}
      <div className="flex flex-col space-y-4">
        {/* Response Area */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-[2] flex flex-col min-h-0 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center text-slate-100 font-semibold">
              <Code className="w-5 h-5 mr-2 text-purple-500" />
              API Response
            </div>
            {status === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
            {status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
          </div>
          <div className="relative flex-1">
             <textarea 
              readOnly
              className={`absolute inset-0 w-full h-full bg-slate-950 font-mono text-sm p-4 rounded-lg border outline-none resize-none ${
                status === 'error' ? 'text-red-400 border-red-900/50' : 
                status === 'success' ? 'text-emerald-400 border-emerald-900/50' : 
                'text-slate-500 border-slate-800'
              }`}
              value={responseJson || '// Waiting for execution...'}
            />
          </div>

          {/* Broadcast Bar */}
          {renderBroadcastSection()}
        </div>

        {/* Security Logs */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex-1 overflow-y-auto">
          <div className="flex items-center text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Lock className="w-3 h-3 mr-1.5" />
            Local Debug Audit
          </div>
          <div className="space-y-1 font-mono text-xs">
            {logs.length === 0 && <span className="text-slate-600 italic">No activity recorded for this session.</span>}
            {logs.map((log, i) => (
              <div key={i} className="text-slate-400 border-l-2 border-slate-800 pl-2 py-0.5">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};
