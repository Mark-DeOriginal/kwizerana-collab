"use client";

import { useEffect, useRef } from "react";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { CHAIN_ID_TO_SLUG } from "@/lib/web3/config";

function useSyncConnectedWallet() {
  const { address, chainId, isConnected } = useAccount();
  const synced = useRef<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) return;
    const slug = CHAIN_ID_TO_SLUG[chainId ?? 1] ?? "ethereum";
    const key = `${slug}:${address.toLowerCase()}`;
    if (synced.current === key) return;
    synced.current = key;
    void fetch("/api/p2p/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chain: slug, address })
    }).catch(() => {});
  }, [address, chainId, isConnected]);

  return null;
}

export function ConnectWalletButton() {
  useSyncConnectedWallet();
  return <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />;
}

export function ConnectWalletAction({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { openConnectModal } = useConnectModal();
  useSyncConnectedWallet();
  return (
    <button type="button" onClick={openConnectModal} className={className}>
      {children ?? "Connect wallet"}
    </button>
  );
}
