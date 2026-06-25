import type { EthTrade } from '../types'
import { Card } from './Card'
import { computeTradePnl, summarizeTrades, formatUsd } from '../lib/eth'

export default function EthTracker({
  trades,
  price,
}: {
  trades: EthTrade[]
  price: number | null
}) {
  const summary = summarizeTrades(trades, price)

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="text-xs text-gray-500">ETH spot</span>
          <p className="text-lg font-semibold text-syrup-100 tabular-nums">
            {price === null ? '—' : `$${price.toLocaleString('en-US')}`}
            {price !== null && <span className="ml-1 text-[10px] text-status-live">live</span>}
          </p>
        </div>
        <div className="text-right text-xs">
          <p className="text-gray-500">
            Open PnL:{' '}
            <span className={summary.livePnl && summary.livePnl < 0 ? 'text-status-blocked' : 'text-status-live'}>
              {summary.livePnl === null ? '—' : formatUsd(summary.livePnl)}
            </span>
          </p>
          <p className="text-gray-500">
            Realised:{' '}
            <span className={summary.realizedPnl < 0 ? 'text-status-blocked' : 'text-status-live'}>
              {formatUsd(summary.realizedPnl)}
            </span>
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {trades.length === 0 && <p className="text-xs text-gray-600">No trades tracked.</p>}
        {trades.map((t) => {
          const pnl =
            t.status === 'open' && price !== null
              ? computeTradePnl(t, price)
              : (t.pnlUsd ?? null)
          return (
            <div
              key={t.id}
              className="flex items-center justify-between rounded border border-ink-700 bg-ink-900 px-2 py-1.5 text-xs"
            >
              <span className="flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    t.side === 'long' ? 'bg-status-live/20 text-status-live' : 'bg-status-blocked/20 text-status-blocked'
                  }`}
                >
                  {t.side.toUpperCase()}
                </span>
                <span className="text-gray-300 tabular-nums">
                  {t.size} ETH @ ${t.entry.toLocaleString('en-US')}
                </span>
                <span className="text-[10px] text-gray-600">{t.status}</span>
              </span>
              <span
                className={`tabular-nums ${pnl !== null && pnl < 0 ? 'text-status-blocked' : 'text-status-live'}`}
              >
                {pnl === null ? '—' : formatUsd(pnl)}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
