
import React, { useEffect, useState, useRef } from 'react';
import { WalletData, VaultSettings, LogEntry } from '../types';
import { NETWORKS } from '../services/cryptoService';
import { Activity, Server, Shield, Cpu, Terminal, Wifi, Database } from 'lucide-react';

interface DashboardProps {
  wallets: WalletData[];
  settings?: VaultSettings;
  logs: LogEntry[];
  onNavigate: (view: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ wallets, settings, logs, onNavigate }) => {
  const [latency, setLatency] = useState<number | null>(null);
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Real Network Latency Check
  useEffect(() => {
    const checkHealth = async () => {
        setIsCheckingNetwork(true);
        const start = Date.now();
        try {
            // Simple POST to mainnet RPC to check connectivity
            // NETWORKS.mainnet is an array, pick the first one for the health check
            await fetch(NETWORKS.mainnet[0], {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] })
            });
            setLatency(Date.now() - start);
        } catch (e) {
            setLatency(-1); // Error code
        } finally {
            setIsCheckingNetwork(false);
        }
    };
    checkHealth();
    // Poll every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate Memory Usage (Approximate JSON size of wallet data)
  const estimatedSizeKB = (JSON.stringify(wallets).length / 1024).toFixed(2);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-140px)] animate-in fade-in duration-500">
      
      {/* LEFT COLUMN: System Diagnostics */}
      <div className="flex flex-col space-y-4">
          
          {/* Status Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center text-slate-100 font-semibold">
                      <Activity className="w-5 h-5 mr-2 text-sky-500" />
                      System Diagnostics
                  </div>
                  <div className="flex items-center space-x-2">
                       <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs text-emerald-400 font-mono">ONLINE</span>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <div className="flex items-center text-xs text-slate-500 mb-2 uppercase font-bold">
                          <Wifi className="w-3 h-3 mr-1" /> Network Latency
                      </div>
                      <div className={`text-xl font-mono ${latency === -1 ? 'text-red-500' : 'text-slate-100'}`}>
                          {isCheckingNetwork ? '...' : latency === -1 ? 'OFFLINE' : `${latency}ms`}
                      </div>
                      <div className="text-[10px] text-slate-600 mt-1 truncate">
                          Target: Mainnet RPC
                      </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <div className="flex items-center text-xs text-slate-500 mb-2 uppercase font-bold">
                          <Database className="w-3 h-3 mr-1" /> Vault Usage
                      </div>
                      <div className="text-xl font-mono text-slate-100">
                          {estimatedSizeKB} KB
                      </div>
                      <div className="text-[10px] text-slate-600 mt-1">
                          {wallets.length} Encrypted Keys
                      </div>
                  </div>

                   <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <div className="flex items-center text-xs text-slate-500 mb-2 uppercase font-bold">
                          <Shield className="w-3 h-3 mr-1" /> Security
                      </div>
                      <div className="text-xl font-mono text-slate-100">
                          AES-256
                      </div>
                      <div className="text-[10px] text-slate-600 mt-1">
                          Auto-Lock: {settings?.autoLockMinutes}m
                      </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <div className="flex items-center text-xs text-slate-500 mb-2 uppercase font-bold">
                          <Cpu className="w-3 h-3 mr-1" /> Engine
                      </div>
                      <div className="text-xl font-mono text-slate-100">
                          v1.2.0
                      </div>
                      <div className="text-[10px] text-slate-600 mt-1">
                          Browser Environment
                      </div>
                  </div>
              </div>
          </div>

          {/* Quick Actions / Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex-1">
              <div className="flex items-center text-slate-100 font-semibold mb-4">
                  <Server className="w-5 h-5 mr-2 text-indigo-500" />
                  Service Overview
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  The FalconVault Signing Service is operating normally. All private keys are encrypted at rest using AES-GCM. 
                  Access to the signing oracle is gated by the master password session.
              </p>
              
              <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                       <span className="text-slate-500">Total Wallets</span>
                       <span className="font-mono text-white">{wallets.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                       <span className="text-slate-500">Active Attributes</span>
                       <span className="font-mono text-white">{settings?.attributeDefinitions.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pb-2">
                       <span className="text-slate-500">Logging</span>
                       <span className={`font-mono ${settings?.enableLogging ? 'text-emerald-400' : 'text-slate-500'}`}>
                           {settings?.enableLogging ? 'Enabled' : 'Disabled'}
                       </span>
                  </div>
              </div>
          </div>
      </div>

      {/* RIGHT COLUMN: Live Terminal */}
      <div className="flex flex-col h-full min-h-0">
          <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
                  <div className="flex items-center text-slate-100 font-semibold">
                      <Terminal className="w-5 h-5 mr-2 text-emerald-500" />
                      Live Event Stream
                  </div>
                  <div className="flex space-x-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
                  </div>
              </div>
              
              <div className="flex-1 bg-slate-950 p-4 overflow-y-auto font-mono text-xs space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
                  {logs.length === 0 && (
                      <div className="text-slate-600 opacity-50 mt-4 text-center italic">
                          Waiting for system events...
                      </div>
                  )}
                  {logs.map((log) => (
                      <div key={log.id} className="flex gap-3 hover:bg-slate-900/50 p-0.5 rounded transition-colors">
                          <span className="text-slate-600 whitespace-nowrap">
                              [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}]
                          </span>
                          <span className="text-sky-600/70 w-20 whitespace-nowrap overflow-hidden text-ellipsis text-right">
                              {log.source}
                          </span>
                          <span className={`flex-1 break-all ${
                              log.type === 'error' ? 'text-red-400' :
                              log.type === 'success' ? 'text-emerald-400' :
                              log.type === 'warning' ? 'text-amber-400' :
                              'text-slate-300'
                          }`}>
                              {log.type === 'success' && '>> '}
                              {log.message}
                          </span>
                      </div>
                  ))}
                  <div ref={logEndRef} />
              </div>
          </div>
      </div>

    </div>
  );
};
