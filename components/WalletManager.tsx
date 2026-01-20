
import React, { useState, useEffect, useMemo } from 'react';
import { WalletData, WalletMetadata, VaultSettings, AttributeDefinition, NetworkKey, AssetValues, ViewState } from '../types';
import { Input } from './Input';
import { Button } from './Button';
import { createWalletFromKey, encryptData, decryptData, fetchBalance, createTransferTransaction, fetchNonce, signTransaction, broadcastTransaction, NETWORKS, TOKEN_ADDRESSES } from '../services/cryptoService';
import { logger } from '../services/systemLogger';
import { 
  Trash2, Copy, Plus, Check, Bird, FileSpreadsheet, 
  Settings2, RefreshCw, Search, Wallet, 
  Eye, EyeOff, ShieldAlert,
  Database, Network, Terminal, PlayCircle, ExternalLink, Calculator, Send, ArrowRight, Lock
} from 'lucide-react';
import { ethers } from 'ethers';

interface WalletManagerProps {
  wallets: WalletData[];
  password: string;
  settings: VaultSettings;
  onNavigate: (view: ViewState) => void;
  onAddWallet: (wallet: WalletData) => void;
  onRemoveWallet: (id: string) => void;
  onUpdateWallet?: (id: string, metadata: WalletMetadata) => void;
}

// Cache structure: walletId -> network -> value
type ScanCache = Record<string, Record<string, AssetValues | 'Error'>>;

export const WalletManager: React.FC<WalletManagerProps> = ({ wallets, password, settings, onNavigate, onAddWallet, onRemoveWallet, onUpdateWallet }) => {
  // --- View State ---
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'detail' | 'import'>('detail');
  const [searchTerm, setSearchTerm] = useState('');

  // --- Scan State ---
  const [scanCache, setScanCache] = useState<ScanCache>({});
  const [scanningNetworks, setScanningNetworks] = useState<Record<string, boolean>>({}); // network -> isScanning
  const [isGlobalScanning, setIsGlobalScanning] = useState(false);

  // --- Import State ---
  const [importTab, setImportTab] = useState<'single' | 'batch'>('single');
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newMetadata, setNewMetadata] = useState<Record<string, string>>({});
  const [batchData, setBatchData] = useState('');
  const [importStatus, setImportStatus] = useState<{msg: string, type: 'error' | 'success'} | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Detail Edit State ---
  const [isEditingAttrs, setIsEditingAttrs] = useState(false);
  const [editMetadata, setEditMetadata] = useState<Record<string, string>>({});
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [keyTimer, setKeyTimer] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- Initialization & Auto-Selection ---
  useEffect(() => {
    if (wallets.length > 0 && !selectedWalletId) {
        setSelectedWalletId(wallets[0].id);
        setViewMode('detail');
    } else if (wallets.length === 0) {
        setViewMode('import');
    }
  }, [wallets.length]);

  const selectedWallet = useMemo(() => wallets.find(w => w.id === selectedWalletId), [wallets, selectedWalletId]);

  // --- Statistics Calculation ---
  const portfolioStats = useMemo(() => {
      if (!selectedWalletId || !scanCache[selectedWalletId]) {
          return { eth: 0, usdt: 0, usdc: 0 };
      }
      
      let eth = 0, usdt = 0, usdc = 0;
      Object.values(scanCache[selectedWalletId]).forEach(val => {
          if (val && val !== 'Error') {
              const assetVal = val as AssetValues;
              eth += parseFloat(assetVal.eth);
              usdt += parseFloat(assetVal.usdt);
              usdc += parseFloat(assetVal.usdc);
          }
      });
      return { eth, usdt, usdc };
  }, [scanCache, selectedWalletId]);

  // --- Auto-Scan Logic ---
  useEffect(() => {
      if (selectedWallet && viewMode === 'detail') {
          // If no cache for this wallet, trigger scan
          if (!scanCache[selectedWallet.id]) {
              performDeepScan(selectedWallet.id, selectedWallet.address);
          }
      }
      setRevealedKey(null); // Reset key reveal on switch
  }, [selectedWalletId, viewMode]);

  // --- Security: Auto-Hide Key ---
  useEffect(() => {
      let interval: any;
      if (revealedKey) {
          setKeyTimer(30); // 30 seconds
          interval = setInterval(() => {
              setKeyTimer(prev => {
                  if (prev <= 1) {
                      setRevealedKey(null);
                      logger.log('Private key hidden automatically due to timeout', 'info', 'Security');
                      return 0;
                  }
                  return prev - 1;
              });
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [revealedKey]);

  const performDeepScan = async (walletId: string, address: string, force = false) => {
      if (!force && scanCache[walletId]) return;

      setIsGlobalScanning(true);
      const networks = Object.keys(NETWORKS);
      
      setScanCache(prev => ({
          ...prev,
          [walletId]: prev[walletId] || {}
      }));

      logger.log(`Starting multi-node asset scan for ${address.slice(0, 8)}...`, 'info', 'AssetScanner');

      const chunk = 3;
      for (let i = 0; i < networks.length; i += chunk) {
          if (selectedWalletId !== walletId) break;
          
          const batch = networks.slice(i, i + chunk);
          await Promise.all(batch.map(async (net) => {
             setScanningNetworks(prev => ({ ...prev, [net]: true }));
             try {
                 const result = await fetchBalance(address, net);
                 const assetVal: AssetValues | 'Error' = result === 'Error' ? 'Error' : {
                     eth: result.eth,
                     wei: result.wei,
                     usdt: result.usdt,
                     usdc: result.usdc
                 };
                 setScanCache(prev => ({
                     ...prev,
                     [walletId]: {
                         ...(prev[walletId] || {}),
                         [net]: assetVal
                     }
                 }));
             } catch (e) {
                 setScanCache(prev => ({
                     ...prev,
                     [walletId]: {
                         ...(prev[walletId] || {}),
                         [net]: 'Error'
                     }
                 }));
             } finally {
                 setScanningNetworks(prev => ({ ...prev, [net]: false }));
             }
          }));
      }

      setIsGlobalScanning(false);
      if (selectedWalletId === walletId) {
          logger.log(`Asset scan completed for ${address.slice(0, 8)}`, 'success', 'AssetScanner');
      }
  };

  // --- Action Handlers ---

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
      setCopiedId('action');
      setTimeout(() => setCopiedId(null), 1500);
      logger.log('Copied to clipboard', 'info', 'UI');
  };

  const handleDelete = (id: string) => {
      if (confirm('Are you sure you want to remove this wallet from the vault?')) {
          onRemoveWallet(id);
          if (selectedWalletId === id) setSelectedWalletId(null);
      }
  };

  const handleRevealKey = async () => {
      if (revealedKey) {
          setRevealedKey(null);
          return;
      }
      if (!selectedWallet) return;
      try {
          const pk = await decryptData(selectedWallet.encryptedPrivateKey, password);
          setRevealedKey(pk);
          logger.log(`Private key revealed for ${selectedWallet.name}`, 'warning', 'Security');
      } catch (e) {
          alert('Failed to decrypt. Master password might be invalid (session issue).');
      }
  };

  const handleSaveAttrs = () => {
      if (selectedWalletId && onUpdateWallet) {
          onUpdateWallet(selectedWalletId, editMetadata);
          setIsEditingAttrs(false);
      }
  };

  // --- Import Handlers (Existing) ---
  const processImport = async (name: string, key: string, metadata?: Record<string, string>) => {
      const trimmedName = name.trim();
      if (!trimmedName || !key.trim()) throw new Error('Name and Key required');
      if (wallets.some(w => w.name === trimmedName)) throw new Error(`Name '${trimmedName}' exists`);
      
      const { address, valid } = createWalletFromKey(key.trim());
      if (!valid) throw new Error(`Invalid Key for ${trimmedName}`);
      
      const encrypted = await encryptData(key.trim(), password);
      return {
          id: crypto.randomUUID(),
          name: trimmedName,
          address,
          encryptedPrivateKey: encrypted,
          metadata: metadata || {},
          createdAt: Date.now()
      };
  };

  const handleSingleImport = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessing(true);
      setImportStatus(null);
      try {
          const w = await processImport(newName, newKey, newMetadata);
          onAddWallet(w);
          setImportStatus({ msg: `Imported ${w.name}`, type: 'success' });
          setNewName(''); setNewKey(''); setNewMetadata({});
          setSelectedWalletId(w.id); 
          setViewMode('detail');
      } catch (err: any) {
          setImportStatus({ msg: err.message, type: 'error' });
      } finally {
          setIsProcessing(false);
      }
  };

  const handleBatchImport = async () => {
      setIsProcessing(true);
      setImportStatus(null);
      try {
          const lines = batchData.split('\n');
          let count = 0;
          const errors: string[] = [];
          
          for (const line of lines) {
              if (!line.trim()) continue;
              const [l, k, attr] = line.split(',').map(s => s.trim());
              try {
                  let meta = {};
                  if (attr) {
                       const firstKey = settings.attributeDefinitions[0]?.key || 'note';
                       meta = { [firstKey]: attr };
                  }
                  const w = await processImport(l, k, meta);
                  onAddWallet(w);
                  count++;
              } catch (e: any) {
                  errors.push(e.message);
              }
          }

          if (errors.length > 0) {
               setImportStatus({ msg: `Imported ${count}. Errors: ${errors.join('; ')}`, type: 'error' });
          } else {
               setImportStatus({ msg: `Batch import complete (${count} wallets)`, type: 'success' });
               setBatchData('');
               if (count > 0) setViewMode('detail');
          }
      } catch (e: any) {
          setImportStatus({ msg: e.message, type: 'error' });
      } finally {
          setIsProcessing(false);
      }
  };

  // --- Render Helpers ---
  const renderAttributeInput = (def: AttributeDefinition, value: string, onChange: (val: string) => void) => {
      if (def.type === 'select' && def.options) {
          return (
              <div key={def.key}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{def.label}</label>
                  <select 
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-sky-500"
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                  >
                      <option value="">-- Select --</option>
                      {def.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
              </div>
          );
      }
      return (
          <Input 
             key={def.key}
             label={def.label}
             type={def.type === 'date' ? 'date' : 'text'}
             value={value}
             onChange={(e) => onChange(e.target.value)}
             className="bg-slate-950"
          />
      );
  };

  const filteredWallets = wallets.filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-140px)] animate-in fade-in duration-500 min-h-[600px]">
      
      {/* LEFT COLUMN: Wallet Registry */}
      <div className="flex flex-col space-y-4 h-full">
         <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-full overflow-hidden shadow-xl">
             {/* Header / Search */}
             <div className="p-4 border-b border-slate-800 bg-slate-900 z-10 space-y-3">
                 <div className="flex items-center justify-between">
                     <h3 className="font-bold text-slate-100 flex items-center">
                        <Database className="w-4 h-4 mr-2 text-sky-500" />
                        Registry
                     </h3>
                     <span className="text-xs font-mono text-slate-500">{wallets.length} Keys</span>
                 </div>
                 <div className="relative">
                     <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                     <input 
                        type="text" 
                        placeholder="Filter by label..." 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                     />
                 </div>
                 <Button 
                    variant={viewMode === 'import' ? 'primary' : 'secondary'} 
                    className="w-full justify-center"
                    size="sm"
                    onClick={() => setViewMode('import')}
                 >
                    <Plus className="w-4 h-4 mr-2" /> Add New Wallet
                 </Button>
             </div>

             {/* Scrollable List */}
             <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
                 {filteredWallets.length === 0 && (
                     <div className="text-center py-8 text-slate-600 text-sm">No wallets found</div>
                 )}
                 {filteredWallets.map(w => (
                     <button
                        key={w.id}
                        onClick={() => {
                            setSelectedWalletId(w.id);
                            setViewMode('detail'); 
                        }}
                        className={`w-full flex items-center p-3 rounded-lg border transition-all duration-200 ${
                            selectedWalletId === w.id && viewMode !== 'import'
                            ? 'bg-sky-500/10 border-sky-500/50 shadow-[0_0_15px_rgba(14,165,233,0.1)]' 
                            : 'bg-transparent border-transparent hover:bg-slate-800'
                        }`}
                     >
                        <div className={`p-2 rounded-lg mr-3 ${selectedWalletId === w.id && viewMode !== 'import' ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                            <Wallet className="w-4 h-4" />
                        </div>
                        <div className="flex-1 text-left overflow-hidden">
                            <div className={`font-medium text-sm truncate ${selectedWalletId === w.id && viewMode !== 'import' ? 'text-sky-100' : 'text-slate-300'}`}>{w.name}</div>
                            <div className="text-[10px] font-mono text-slate-500 truncate">{w.address}</div>
                        </div>
                        {w.metadata?.withdrawalAddress && (
                            <div className="text-emerald-500" title="Withdrawal Address Bound">
                                <Lock className="w-3 h-3" />
                            </div>
                        )}
                     </button>
                 ))}
             </div>
         </div>
      </div>

      {/* RIGHT COLUMN: Inspector / Detail View */}
      <div className="flex flex-col space-y-4 h-full overflow-hidden">
         
         {viewMode === 'import' && (
             <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-full overflow-y-auto">
                 <div className="flex items-center mb-6">
                     <FileSpreadsheet className="w-6 h-6 text-emerald-500 mr-3" />
                     <h2 className="text-xl font-bold text-white">Import Wallets</h2>
                 </div>
                 
                 <div className="flex space-x-4 border-b border-slate-800 mb-6">
                     <button onClick={() => setImportTab('single')} className={`pb-2 text-sm font-medium transition-colors ${importTab === 'single' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-500 hover:text-slate-300'}`}>Single Entry</button>
                     <button onClick={() => setImportTab('batch')} className={`pb-2 text-sm font-medium transition-colors ${importTab === 'batch' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-500 hover:text-slate-300'}`}>Batch CSV</button>
                 </div>

                 {importTab === 'single' ? (
                     <form onSubmit={handleSingleImport} className="space-y-4 max-w-lg animate-in fade-in">
                         <Input label="Wallet Label" placeholder="e.g. Treasury_Alpha" value={newName} onChange={e => setNewName(e.target.value)} />
                         <Input label="Private Key" placeholder="0x..." type="password" value={newKey} onChange={e => setNewKey(e.target.value)} />
                         {settings.attributeDefinitions.length > 0 && (
                            <div className="pt-2 grid grid-cols-2 gap-4">
                                {settings.attributeDefinitions.map(def => (
                                    <div key={def.key}>
                                        {renderAttributeInput(def, newMetadata[def.key] || '', v => setNewMetadata({...newMetadata, [def.key]: v}))}
                                    </div>
                                ))}
                            </div>
                         )}
                         <div className="pt-4">
                            <Button type="submit" isLoading={isProcessing} className="w-full">Secure Import</Button>
                         </div>
                     </form>
                 ) : (
                     <div className="space-y-4 animate-in fade-in">
                         <div className="p-3 bg-slate-950 rounded border border-slate-800 text-sm text-slate-400">
                             Format: <span className="font-mono text-sky-400">Label, PrivateKey, [Attribute]</span>
                         </div>
                         <textarea 
                            className="w-full h-48 bg-slate-950 border border-slate-700 rounded-lg p-4 font-mono text-sm text-slate-200 focus:border-sky-500 outline-none"
                            placeholder="Wallet_A, 0x123...&#10;Wallet_B, 0x456..., HighRisk"
                            value={batchData}
                            onChange={e => setBatchData(e.target.value)}
                         />
                         <div className="pt-2">
                             <Button onClick={handleBatchImport} isLoading={isProcessing} className="w-full">Process Batch</Button>
                         </div>
                     </div>
                 )}

                 {importStatus && (
                     <div className={`mt-6 p-4 rounded-lg border ${importStatus.type === 'error' ? 'bg-red-900/20 border-red-900/50 text-red-400' : 'bg-emerald-900/20 border-emerald-900/50 text-emerald-400'}`}>
                         {importStatus.msg}
                     </div>
                 )}
             </div>
         )}

         {viewMode === 'detail' && selectedWallet && (
             <div className="flex flex-col h-full space-y-4 overflow-y-auto pr-1">
                 
                 {/* Top Card: Identity */}
                 <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6 shrink-0">
                     <div className="flex justify-between items-start mb-4">
                         <div>
                             <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
                                 {selectedWallet.name}
                                 <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                                     AES-256
                                 </span>
                             </h2>
                             <div className="flex items-center space-x-2 mt-2">
                                 <code className="bg-slate-950 px-3 py-1.5 rounded-lg text-slate-400 font-mono text-sm border border-slate-800">
                                     {selectedWallet.address}
                                 </code>
                                 <button onClick={() => handleCopy(selectedWallet.address)} className="p-2 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-colors">
                                     {copiedId ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                 </button>
                             </div>
                         </div>
                         <div className="flex space-x-2">
                             <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={() => {
                                    setIsEditingAttrs(!isEditingAttrs);
                                    if (!isEditingAttrs) setEditMetadata(selectedWallet.metadata || {});
                                }}
                             >
                                 <Settings2 className="w-4 h-4 mr-2" />
                                 {isEditingAttrs ? 'Cancel' : 'Edit'}
                             </Button>
                         </div>
                     </div>

                     <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-800 items-start">
                         <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-w-[200px]">
                             {isEditingAttrs ? (
                                 <>
                                    <div className="col-span-full mb-2">
                                        <label className="block text-xs font-bold text-emerald-500 mb-1 flex items-center">
                                            <Lock className="w-3 h-3 mr-1" /> Bound Withdrawal Address
                                        </label>
                                        <Input 
                                            placeholder="0x..." 
                                            value={editMetadata['withdrawalAddress'] || ''}
                                            onChange={e => setEditMetadata({...editMetadata, withdrawalAddress: e.target.value})}
                                            className="border-emerald-900/50 bg-emerald-900/5 focus:border-emerald-500"
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1">This address will be auto-filled for transfers.</p>
                                    </div>
                                    {settings.attributeDefinitions.map(def => (
                                        <div key={def.key}>
                                            {renderAttributeInput(def, editMetadata[def.key] || '', v => setEditMetadata({...editMetadata, [def.key]: v}))}
                                        </div>
                                    ))}
                                    <div className="col-span-full mt-2">
                                        <Button onClick={handleSaveAttrs} size="sm" className="w-full">Save Changes</Button>
                                    </div>
                                 </>
                             ) : (
                                 <>
                                    {selectedWallet.metadata?.withdrawalAddress && (
                                        <div className="col-span-full bg-emerald-950/20 px-3 py-2 rounded-lg border border-emerald-900/30 flex items-center justify-between mb-1">
                                             <span className="text-xs text-emerald-500 uppercase font-bold mr-2 flex items-center">
                                                 <Lock className="w-3 h-3 mr-1" /> Bound To:
                                             </span>
                                             <span className="text-sm text-emerald-100 font-mono truncate">{selectedWallet.metadata.withdrawalAddress}</span>
                                        </div>
                                    )}
                                    {settings.attributeDefinitions.map(def => {
                                        const val = selectedWallet.metadata?.[def.key];
                                        return (
                                            <div key={def.key} className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 flex items-center justify-between">
                                                <span className="text-xs text-slate-500 uppercase font-bold mr-2">{def.label}:</span>
                                                <span className="text-sm text-slate-200 truncate">{val || '-'}</span>
                                            </div>
                                        )
                                    })}
                                 </>
                             )}
                         </div>
                         <div className="flex flex-col gap-2 min-w-[140px]">
                             <Button size="sm" className="bg-sky-600 hover:bg-sky-500" onClick={() => onNavigate('transfer')}>
                                 <Send className="w-4 h-4 mr-2" />
                                 Transfer Hub
                             </Button>
                             <Button size="sm" variant="secondary" onClick={() => onNavigate('signer')}>
                                 <PlayCircle className="w-4 h-4 mr-2 text-sky-500" />
                                 Sign Tool
                             </Button>
                             <a 
                                href={`https://etherscan.io/address/${selectedWallet.address}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-400 bg-slate-950 border border-slate-800 rounded-lg hover:text-white hover:border-slate-700 transition-colors"
                             >
                                 <ExternalLink className="w-4 h-4 mr-2" />
                                 Explorer
                             </a>
                         </div>
                     </div>
                 </div>

                 {/* Asset Scanner & Statistics */}
                 <div className="bg-slate-900 border border-slate-800 rounded-xl flex-1 flex flex-col min-h-[300px] overflow-hidden">
                     <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                         <h3 className="text-md font-bold text-white flex items-center">
                             <Terminal className="w-4 h-4 mr-2 text-emerald-500" />
                             Asset Monitor
                         </h3>
                         <div className="flex items-center space-x-3">
                            {isGlobalScanning && <span className="text-xs text-sky-500 animate-pulse">Scanning Nodes...</span>}
                             <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => performDeepScan(selectedWallet.id, selectedWallet.address, true)}
                                disabled={isGlobalScanning}
                                className="h-8"
                             >
                                 <RefreshCw className={`w-3.5 h-3.5 ${isGlobalScanning ? 'animate-spin' : ''}`} />
                             </Button>
                         </div>
                     </div>
                     
                     {/* Statistics Summary */}
                     <div className="grid grid-cols-3 divide-x divide-slate-800 bg-slate-900/50 border-b border-slate-800">
                         <div className="p-3 text-center">
                             <div className="text-[10px] uppercase text-slate-500 font-bold mb-1">Total ETH</div>
                             <div className="font-mono text-white text-lg">{portfolioStats.eth.toFixed(4)}</div>
                         </div>
                         <div className="p-3 text-center bg-emerald-500/5">
                             <div className="text-[10px] uppercase text-emerald-500/70 font-bold mb-1">Total USDT</div>
                             <div className="font-mono text-emerald-400 text-lg">${portfolioStats.usdt.toFixed(2)}</div>
                         </div>
                         <div className="p-3 text-center bg-blue-500/5">
                             <div className="text-[10px] uppercase text-blue-500/70 font-bold mb-1">Total USDC</div>
                             <div className="font-mono text-blue-400 text-lg">${portfolioStats.usdc.toFixed(2)}</div>
                         </div>
                     </div>

                     <div className="flex-1 overflow-auto bg-slate-950 p-0">
                         <table className="w-full text-left text-sm border-collapse">
                             <thead className="bg-slate-900 text-slate-500 font-mono text-xs uppercase sticky top-0 z-10">
                                 <tr>
                                     <th className="px-4 py-2 font-medium border-b border-slate-800">Chain</th>
                                     <th className="px-4 py-2 font-medium border-b border-slate-800 text-right">ETH</th>
                                     <th className="px-4 py-2 font-medium border-b border-slate-800 text-right">USDT</th>
                                     <th className="px-4 py-2 font-medium border-b border-slate-800 text-right">USDC</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-800/50 text-slate-300 font-mono text-xs">
                                 {Object.keys(NETWORKS).map(net => {
                                     const cached = scanCache[selectedWallet.id]?.[net];
                                     const isScanning = scanningNetworks[net];
                                     const isError = cached === 'Error';
                                     const val = cached as AssetValues;

                                     return (
                                         <tr key={net} className="hover:bg-slate-900/50 transition-colors group">
                                             <td className="px-4 py-3 font-medium flex items-center text-slate-400 group-hover:text-slate-200">
                                                 <div className={`w-1.5 h-1.5 rounded-full mr-2 ${isScanning ? 'bg-amber-500 animate-pulse' : cached && !isError ? 'bg-emerald-500' : isError ? 'bg-red-500' : 'bg-slate-800'}`}></div>
                                                 {net}
                                             </td>
                                             <td className="px-4 py-3 text-right group-hover:bg-slate-900/30">
                                                 {isScanning ? <span className="text-amber-500/50">scanning...</span> : 
                                                  isError ? <span className="text-red-900">FAIL</span> : 
                                                  val ? (val.eth === '0.00' ? <span className="text-slate-700">0.00</span> : <span className="text-white">{val.eth}</span>) : '-'}
                                             </td>
                                             <td className="px-4 py-3 text-right group-hover:bg-slate-900/30">
                                                 {val && !isError ? (val.usdt === '0.00' ? <span className="text-slate-700">0.00</span> : <span className="text-emerald-400">{val.usdt}</span>) : '-'}
                                             </td>
                                             <td className="px-4 py-3 text-right group-hover:bg-slate-900/30">
                                                 {val && !isError ? (val.usdc === '0.00' ? <span className="text-slate-700">0.00</span> : <span className="text-blue-400">{val.usdc}</span>) : '-'}
                                             </td>
                                         </tr>
                                     );
                                 })}
                             </tbody>
                         </table>
                     </div>
                 </div>

                 {/* Danger Zone */}
                 <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shrink-0">
                     <div className="flex justify-between items-center">
                         <div className="flex items-center text-amber-500 text-sm font-bold">
                             <ShieldAlert className="w-4 h-4 mr-2" />
                             Sensitive Zone
                         </div>
                         <div className="flex space-x-2">
                             <Button variant="danger" size="sm" onClick={() => handleDelete(selectedWallet.id)} className="opacity-70 hover:opacity-100">
                                 <Trash2 className="w-4 h-4" />
                             </Button>
                             <Button 
                                variant="ghost" 
                                size="sm" 
                                className={`transition-all ${revealedKey ? 'bg-amber-950/30 text-amber-400 border border-amber-900/50' : 'text-slate-400 hover:text-white'}`}
                                onClick={handleRevealKey}
                             >
                                 {revealedKey ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                                 {revealedKey ? `Hide Key (${keyTimer}s)` : 'Reveal Private Key'}
                             </Button>
                         </div>
                     </div>
                     {revealedKey && (
                         <div className="mt-4 p-4 bg-black/40 border border-amber-900/30 rounded-lg animate-in fade-in slide-in-from-top-2 relative overflow-hidden group">
                             <div className="absolute top-0 left-0 w-1 h-full bg-amber-600"></div>
                             <p className="text-[10px] text-amber-500/70 mb-2 uppercase font-bold tracking-wider">Decrypted Key Material</p>
                             <div className="flex items-center justify-between">
                                 <code className="text-amber-400 font-mono text-sm break-all select-all selection:bg-amber-900/50 blur-[2px] hover:blur-0 transition-all duration-300">
                                     {revealedKey}
                                 </code>
                                 <button onClick={() => handleCopy(revealedKey)} className="ml-4 text-amber-500/50 hover:text-amber-400 p-2 rounded hover:bg-amber-900/20">
                                     <Copy className="w-4 h-4" />
                                 </button>
                             </div>
                         </div>
                     )}
                 </div>

             </div>
         )}
         
         {/* Empty State / Select Prompt */}
         {viewMode === 'detail' && !selectedWallet && (
             <div className="flex flex-col items-center justify-center h-full text-slate-500 border border-slate-800 rounded-xl bg-slate-900/50">
                 <Bird className="w-16 h-16 mb-4 opacity-20" />
                 <p className="font-medium">Select a wallet from the registry</p>
                 <p className="text-xs text-slate-600 mt-2">Or add a new one to get started.</p>
             </div>
         )}
      </div>
    </div>
  );
};
