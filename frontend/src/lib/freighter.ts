'use client';

import {
  getAddress,
  isConnected,
  signTransaction,
  setAllowed,
  requestAccess,
  getNetwork,
  WatchWalletChanges,
} from '@stellar/freighter-api';

export interface FreighterWallet {
  connected: boolean;
  publicKey: string | null;
  network: string | null;
}

export async function checkFreighterInstalled(): Promise<boolean> {
  const result = await isConnected();
  return result.isConnected;
}

export async function connectFreighter(): Promise<string> {
  const conn = await isConnected();
  if (!conn.isConnected) {
    throw new Error('Freighter wallet not installed. Please install the Freighter browser extension.');
  }

  await setAllowed();
  const accessResult = await requestAccess();
  if (accessResult.error) {
    throw new Error(accessResult.error);
  }

  return accessResult.address;
}

export async function getWalletPublicKey(): Promise<string | null> {
  const addrResult = await getAddress();
  if (addrResult.error) return null;
  return addrResult.address || null;
}

export async function getWalletNetwork(): Promise<string | null> {
  const netResult = await getNetwork();
  if (netResult.error) return null;
  return netResult.network || null;
}

export async function signWithFreighter(
  txXdr: string,
  networkPassphrase: string
): Promise<string> {
  const result = await signTransaction(txXdr, {
    networkPassphrase,
  });

  if (result.error) {
    throw new Error(result.error);
  }

  return result.signedTxXdr;
}

export function watchWalletChanges(
  onAccountChange: (publicKey: string) => void,
  onNetworkChange: (network: string) => void
): () => void {
  const watcher = new WatchWalletChanges();
  watcher.watch(({ address, network }) => {
    if (address) onAccountChange(address);
    if (network) onNetworkChange(network);
  });
  return () => watcher.stop();
}
