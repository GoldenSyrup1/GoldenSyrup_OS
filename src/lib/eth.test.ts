import { describe, it, expect } from 'vitest'
import { computeTradePnl, summarizeTrades, formatUsd } from './eth'
import type { EthTrade } from '../types'

const long: EthTrade = { id: 'a', side: 'long', entry: 2000, size: 2, status: 'open' }
const short: EthTrade = { id: 'b', side: 'short', entry: 3000, size: 1, status: 'open' }
const closed: EthTrade = { id: 'c', side: 'long', entry: 1000, size: 1, status: 'closed', pnlUsd: 500 }

describe('computeTradePnl', () => {
  it('profits a long when price rises', () => {
    expect(computeTradePnl(long, 2500)).toBe(1000) // (2500-2000)*2
  })
  it('profits a short when price falls', () => {
    expect(computeTradePnl(short, 2500)).toBe(500) // (2500-3000)*1*-1
  })
})

describe('summarizeTrades', () => {
  it('aggregates open unrealised and closed realised pnl', () => {
    const s = summarizeTrades([long, short, closed], 2500)
    expect(s.openCount).toBe(2)
    expect(s.closedCount).toBe(1)
    expect(s.livePnl).toBe(1500) // 1000 + 500
    expect(s.realizedPnl).toBe(500)
  })
  it('returns null livePnl when price is unknown', () => {
    expect(summarizeTrades([long], null).livePnl).toBeNull()
  })
})

describe('formatUsd', () => {
  it('signs and groups values', () => {
    expect(formatUsd(1250)).toBe('+$1,250')
    expect(formatUsd(-80)).toBe('-$80')
    expect(formatUsd(0)).toBe('+$0')
  })
})
