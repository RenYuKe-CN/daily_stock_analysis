import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, TrendingDown, TrendingUp, X } from 'lucide-react';
import { stocksApi } from '../../api/stocks';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

type MoverItem = { code: string; name: string; price: number; change_pct: number; change_amount: number; volume?: number };

export const USMoversCard: React.FC = () => {
  const [gainers, setGainers] = useState<MoverItem[]>([]);
  const [losers, setLosers] = useState<MoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'gainers' | 'losers'>('gainers');
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [klineData, setKlineData] = useState<any>(null);
  const [klineLoading, setKlineLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await stocksApi.getUsMovers();
      setGainers(data.gainers ?? []);
      setLosers(data.losers ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetch(); }, [fetch]);

  const loadKline = async (code: string) => {
    if (selectedStock === code) { setSelectedStock(null); setKlineData(null); return; }
    setSelectedStock(code);
    setKlineLoading(true);
    try {
      const d = await stocksApi.getStockDetail(code);
      setKlineData(d);
    } catch { setKlineData(null); }
    finally { setKlineLoading(false); }
  };

  const list = activeTab === 'gainers' ? gainers : losers;
  const isPositive = activeTab === 'gainers';

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-1 rounded-xl bg-muted/40 p-0.5">
          <button
            onClick={() => { setActiveTab('gainers'); setSelectedStock(null); }}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'gainers' ? 'bg-background text-emerald-600 shadow-sm' : 'text-muted-text hover:text-foreground'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" /> 涨幅榜
          </button>
          <button
            onClick={() => { setActiveTab('losers'); setSelectedStock(null); }}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'losers' ? 'bg-background text-rose-600 shadow-sm' : 'text-muted-text hover:text-foreground'
            }`}
          >
            <TrendingDown className="h-3.5 w-3.5" /> 跌幅榜
          </button>
        </div>
        <button onClick={fetch} className="text-[11px] text-muted-text hover:text-foreground transition-colors">
          刷新
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-text" /></div>
      ) : (
        <div>
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr] gap-2 border-b border-border/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-text">
            <span>代码</span>
            <span>名称</span>
            <span className="text-right">最新价</span>
            <span className="text-right">涨跌幅</span>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {list.map((item, i) => {
              const isSelected = selectedStock === item.code;
              return (
                <div key={item.code}>
                  <button
                    type="button"
                    onClick={() => loadKline(item.code)}
                    className={`grid w-full grid-cols-[1fr_1.5fr_1fr_1fr] gap-2 px-4 py-2.5 text-left text-xs transition-colors hover:bg-[var(--nav-hover-bg)] ${
                      isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'
                    } ${i % 2 === 0 ? '' : 'bg-muted/10'}`}
                  >
                    <span className="truncate font-mono font-medium text-foreground">{item.code}</span>
                    <span className="truncate text-muted-text">{item.name}</span>
                    <span className="text-right tabular-nums font-medium text-foreground">{item.price.toFixed(2)}</span>
                    <span className={`text-right tabular-nums font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {item.change_pct > 0 ? '+' : ''}{item.change_pct.toFixed(2)}%
                    </span>
                  </button>

                  {/* Inline K-line panel */}
                  {isSelected && (
                    <div className="border-b border-border/20 bg-muted/5 px-4 py-3">
                      {klineLoading ? (
                        <div className="flex items-center justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-text" /></div>
                      ) : klineData ? (
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground">{item.code}</span>
                              <span className="text-xs text-muted-text">{klineData.name}</span>
                              {klineData.realtime && (
                                <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {klineData.realtime.price?.toFixed(2)}
                                </span>
                              )}
                            </div>
                            <button onClick={() => { setSelectedStock(null); setKlineData(null); }}
                              className="rounded-lg p-1 text-muted-text hover:bg-[var(--nav-hover-bg)] hover:text-foreground">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <ResponsiveContainer width="100%" height={160}>
                            <AreaChart data={(klineData.kline?.data ?? []).slice(-60).map((d: any) => ({ date: d.date?.slice(5), close: d.close, volume: d.volume }))}>
                              <defs>
                                <linearGradient id={`grad-${item.code}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={isPositive ? '#059669' : '#e11d48'} stopOpacity={0.15} />
                                  <stop offset="95%" stopColor={isPositive ? '#059669' : '#e11d48'} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--login-grid-line)" />
                              <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" stroke="var(--login-text-muted)" />
                              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9 }} width={40} stroke="var(--login-text-muted)" />
                              <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px', border: '1px solid var(--login-border-card)', background: 'var(--login-bg-card)' }} />
                              <Area type="monotone" dataKey="close" stroke={isPositive ? '#059669' : '#e11d48'} fill={`url(#grad-${item.code})`} strokeWidth={1.5} dot={false} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="py-4 text-center text-xs text-muted-text">暂无 K 线数据</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {list.length === 0 && (
              <p className="py-10 text-center text-xs text-muted-text">
                {activeTab === 'gainers' ? '暂无上涨股票' : '暂无下跌股票'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
