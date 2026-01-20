
import React from 'react';
import { BookOpen, Code, Terminal, Key, Database, Shield } from 'lucide-react';

export const Documentation: React.FC = () => {
  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500 max-w-4xl mx-auto pb-12">
      <div className="border-b border-slate-800 pb-6">
        <h2 className="text-3xl font-bold text-white mb-2">FalconVault API Reference</h2>
        <p className="text-slate-400">
          A local signing oracle service. FalconVault processes JSON payloads to perform cryptographic operations without exposing private keys.
        </p>
      </div>

      <div className="space-y-12">
        {/* Intro */}
        <section>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
             <h3 className="text-xl font-bold text-white mb-2">Base Endpoint</h3>
             <div className="bg-slate-950 p-3 rounded border border-slate-800 mb-4">
                 <code className="text-sm font-mono text-sky-400">POST /api/v1/rpc</code>
             </div>
             <p className="text-slate-400 text-sm mb-4">All interactions are performed via POST requests containing a JSON payload with a specific <code className="text-sky-300">type</code>.</p>
             
             <h4 className="text-sm font-bold text-slate-300 mb-2">Standard Request Structure</h4>
             <pre className="bg-slate-950 p-4 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto border border-slate-800">
{`{
  "type": "eth_signTransaction",    // Method Name
  "walletLabel": "Deployer_1",      // Target Wallet (Optional for read-only)
  "network": "mainnet",             // Target Network (Optional for non-RPC)
  "payload": { ... }                // Method Arguments
}`}
             </pre>
          </div>
        </section>

        {/* 1. Read-Only Methods */}
        <section>
          <div className="flex items-center mb-4">
              <Database className="w-6 h-6 mr-3 text-sky-500" />
              <h3 className="text-2xl font-bold text-white">1. Read-Only Methods</h3>
          </div>
          <div className="space-y-6">
            
            <MethodCard 
                title="eth_getBalance"
                desc="Fetch the native ETH balance of any address."
                req={`{
  "type": "eth_getBalance",
  "address": "0x123...", 
  "network": "zksync"
}`}
                res={`{
  "status": "success",
  "operation": "eth_getBalance",
  "balance_wei": "1450200000000000000",
  "balance_eth": "1.4502"
}`}
            />

            <MethodCard 
                title="eth_call"
                desc="Executes a new message call immediately without creating a transaction on the block chain."
                req={`{
  "type": "eth_call",
  "network": "mainnet",
  "payload": {
    "to": "0xContract",
    "data": "0x70a08231..." // balanceOf(...)
  }
}`}
                res={`{
  "status": "success",
  "result": "0x00000000000000000000000000000000000000000000000000000000000003e8"
}`}
            />

            <MethodCard 
                title="eth_estimateGas"
                desc="Generates and returns an estimate of how much gas is necessary to allow the transaction to complete."
                req={`{
  "type": "eth_estimateGas",
  "network": "zksync",
  "payload": {
    "to": "0x...",
    "data": "0x..."
  }
}`}
                res={`{
  "status": "success",
  "gas": "21000"
}`}
            />

          </div>
        </section>

        {/* 2. Signature Methods */}
        <section>
          <div className="flex items-center mb-4">
              <Key className="w-6 h-6 mr-3 text-amber-500" />
              <h3 className="text-2xl font-bold text-white">2. Signature Methods</h3>
          </div>
          <p className="text-slate-400 text-sm mb-6">These methods require the <code className="text-amber-300">walletLabel</code> parameter. The vault must be unlocked.</p>
          
          <div className="space-y-6">
            
            <MethodCard 
                title="eth_signTransaction"
                desc="Signs a transaction object. Returns the raw signed RLP encoded transaction and its hash."
                req={`{
  "type": "eth_signTransaction",
  "walletLabel": "Wallet_A",
  "payload": {
    "to": "0x...",
    "value": "100000",
    "chainId": 1,
    "nonce": 5,
    "gasLimit": "21000"
  }
}`}
                res={`{
  "status": "success",
  "walletLabel": "Wallet_A",
  "signedTx": "0xf86b8085...",
  "txHash": "0xabc123..."
}`}
            />

            <MethodCard 
                title="personal_sign"
                desc={`Calculates an Ethereum specific signature with: sign(keccak256("\\x19Ethereum Signed Message:\\n" + len(message) + message))).`}
                req={`{
  "type": "personal_sign",
  "walletLabel": "Wallet_A",
  "payload": "Login Request"
}`}
                res={`{
  "status": "success",
  "signature": "0x..."
}`}
            />

            <MethodCard 
                title="eth_signTypedData"
                desc="Signs structured data (EIP-712)."
                req={`{
  "type": "eth_signTypedData",
  "walletLabel": "Wallet_A",
  "payload": {
    "domain": { ... },
    "types": { ... },
    "value": { ... }
  }
}`}
                res={`{
  "status": "success",
  "signature": "0x..."
}`}
            />

             <MethodCard 
                title="eth_sendRawTransaction"
                desc="Submits a pre-signed transaction for broadcast."
                req={`{
  "type": "eth_sendRawTransaction",
  "network": "mainnet",
  "payload": {
      "raw": "0xf86b8085..."
  }
}`}
                res={`{
  "status": "success",
  "txHash": "0x123..."
}`}
            />

          </div>
        </section>

        {/* 3. Vault Management */}
        <section>
          <div className="flex items-center mb-4">
              <Shield className="w-6 h-6 mr-3 text-emerald-500" />
              <h3 className="text-2xl font-bold text-white">3. Vault Management</h3>
          </div>
          
          <div className="space-y-6">
             <MethodCard 
                title="vault_listWallets"
                desc="Lists all public addresses and labels currently loaded in the vault."
                req={`{
  "type": "vault_listWallets"
}`}
                res={`{
  "status": "success",
  "wallets": [
    { "label": "s2", "address": "0xabc..." }
  ]
}`}
            />

            <MethodCard 
                title="vault_getAddress"
                desc="Retrieve the public address for a specific wallet label."
                req={`{
  "type": "vault_getAddress",
  "walletLabel": "s2"
}`}
                res={`{
  "status": "success",
  "address": "0xabc..."
}`}
            />

             <MethodCard 
                title="vault_importPrivateKey"
                desc="Import a new private key securely via API."
                req={`{
  "type": "vault_importPrivateKey",
  "payload": {
      "label": "MyNewWallet",
      "privateKey": "0x..."
  }
}`}
                res={`{
  "status": "success",
  "walletId": "b492...",
  "address": "0x..."
}`}
            />
          </div>
        </section>

      </div>
    </div>
  );
};

// Helper Component for Documentation Cards
const MethodCard: React.FC<{title: string, desc: string, req: string, res: string}> = ({ title, desc, req, res }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-900/50">
            <h4 className="text-lg font-mono font-semibold text-sky-400">{title}</h4>
            <p className="text-sm text-slate-400 mt-1">{desc}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
            <div className="p-4 bg-slate-950">
                <div className="text-xs font-bold text-slate-500 uppercase mb-2">Request</div>
                <pre className="text-xs font-mono text-slate-300 overflow-x-auto">{req}</pre>
            </div>
            <div className="p-4 bg-slate-950">
                <div className="text-xs font-bold text-emerald-500/70 uppercase mb-2">Response</div>
                <pre className="text-xs font-mono text-emerald-400 overflow-x-auto">{res}</pre>
            </div>
        </div>
    </div>
);
