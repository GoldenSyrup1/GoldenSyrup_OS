import type { EthTrade } from '../types'

/** Unrealised USD PnL of an open trade at the given price. Pure. */
export function computeTradePnl(trade: EthTrade, price: number): number {
  const direction = trade.side === 'long' ? 1 : -1
  return (price - trade.entry) * trade.size * direction
}

export interface TradeSummary {
  openCount: number
  closedCount: number
  /** Sum of unrealised PnL across open trades; null if no live price. */
  livePnl: number | null
  /** Sum of realised PnL across closed trades. */
  realizedPnl: number
}

export function summarizeTrades(trades: EthTrade[], price: number | null): TradeSummary {
  const open = trades.filter((t) => t.status === 'open')
  const closed = trades.filter((t) => t.status === 'closed')
  return {
    openCount: open.length,
    closedCount: closed.length,
    livePnl: price === null ? null : open.reduce((acc, t) => acc + computeTradePnl(t, price), 0),
    realizedPnl: closed.reduce((acc, t) => acc + (t.pnlUsd ?? 0), 0),
  }
}

/** Format a signed USD value, e.g. +$1,250 / -$80. */
export function formatUsd(value: number): string {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString('en-US')}`
}
