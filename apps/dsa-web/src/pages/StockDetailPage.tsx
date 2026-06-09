import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { stocksApi } from '../api/stocks';
import { Button } from '../components/common/Button';
import { analysisApi } from '../api/analysis';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

const StockDetailPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(90);

  const fetch = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const d = await stocksApi.getStockDetail(code);
      setDetail(d);
    } catch (e: any) {
      setError(e?.response?.data?.detail?.message ?? e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { void fetch(); }, [fetch]);
  useEffect(() => { document.title = `${code ?? ''} - 个股详情 - DSA`; }, [code]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-text" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-lg text-muted-text">{error || '未找到该股票'}</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate(-1)}>← 返回</Button>
      </div>
    );
  }

  const rt = detail.realtime;
  const kline = detail.kline?.data ?? [];
  const indicators = detail.indicators ?? {};

  // Filter by days
  const filteredKline = kline.slice(-days);

  // Chart data
  const chartData = filteredKline.map((d: any) => ({
    date: d.date?.slice(5) ?? d.date,
    close: d.close,
    ma5: indicators.ma5,
    ma10: indicators.ma10,
    ma20: indicators.ma20,
  }));

  const isPositive = rt && rt.change_pct >= 0;
  const marketLabel: Record<string, string> = { us: '美股', hk: '港股', cn: 'A股' };

  const handleAnalyze = async () => {
    if (!code) return;
    try {
      await analysisApi.analyze({ stockCodes: [code], asyncMode: true, reportType: 'detailed' });
      navigate('/');
    } catch { /* ignore */ }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="rounded-xl p-2 text-muted-text hover:bg-[var(--nav-hover-bg)] hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{detail.code}</h1>
            <p className="text-sm text-muted-text">{detail.name}</p>
          </div>
          {detail.market && (
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-text">
              {marketLabel[detail.market] ?? detail.market}
            </span>
          )}
        </div>
        <Button type="button" size="sm" onClick={handleAnalyze}>分析此股</Button>
      </div>

      {/* Partial data warning */}
      {!rt && detail.kline?.data?.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          实时行情暂不可用（网络超时），以下为本地缓存的 K 线数据。
        </div>
      )}

      {/* Real-time quote */}
      {rt && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-card/60 p-3 backdrop-blur-sm">
            <p className="text-[11px] text-muted-text">最新价</p>
            <p className="mt-1 text-lg font-bold text-foreground tabular-nums">{rt.price?.toFixed(2)}</p>
            <p className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {isPositive ? '+' : ''}{rt.change_pct?.toFixed(2)}%
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 p-3 backdrop-blur-sm">
            <p className="text-[11px] text-muted-text">开盘</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">{rt.open?.toFixed(2) ?? '—'}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 p-3 backdrop-blur-sm">
            <p className="text-[11px] text-muted-text">最高 / 最低</p>
            <p className="mt-1 flex items-baseline gap-1 text-sm font-semibold tabular-nums">
              <span className="text-emerald-600">{rt.high?.toFixed(2) ?? '—'}</span>
              <span className="text-[10px] text-muted-text">/</span>
              <span className="text-rose-600">{rt.low?.toFixed(2) ?? '—'}</span>
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 p-3 backdrop-blur-sm">
            <p className="text-[11px] text-muted-text">昨收</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">{rt.pre_close?.toFixed(2) ?? '—'}</p>
          </div>
        </div>
      )}

      {/* Indicators */}
      {indicators.ma5 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {['ma5', 'ma10', 'ma20'].map((k) => {
            const v = indicators[k];
            if (!v) return null;
            const label = k.toUpperCase();
            const below = rt && rt.price < v ? 'text-rose-600' : 'text-emerald-600';
            return (
              <span key={k} className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs tabular-nums">
                <span className="text-muted-text">{label}</span>{' '}
                <span className={`font-medium ${below}`}>{v.toFixed(2)}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Time range selector */}
      <div className="mb-4 flex gap-1.5">
        {[30, 60, 90, 180].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${days === d ? 'bg-primary/10 text-primary border border-primary/30' : 'text-muted-text hover:text-foreground'}`}
          >
            {d <= 60 ? `${d}天` : `${d / 30}月`}
          </button>
        ))}
      </div>

      {/* K-line chart */}
      <div className="mb-6 rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-text">K 线走势</p>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="closeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? '#059669' : '#e11d48'} stopOpacity={0.2} />
                <stop offset="95%" stopColor={isPositive ? '#059669' : '#e11d48'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--login-grid-line)" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--login-text-muted)" />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} stroke="var(--login-text-muted)" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--login-bg-card)',
                border: '1px solid var(--login-border-card)',
                borderRadius: '12px',
                fontSize: '12px',
              }}
            />
            <Area type="monotone" dataKey="close" stroke={isPositive ? '#059669' : '#e11d48'} fill="url(#closeGradient)" strokeWidth={2} dot={false} />
            {chartData[0]?.ma5 && <Line type="monotone" dataKey="ma5" stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="4 4" />}
            {chartData[0]?.ma10 && <Line type="monotone" dataKey="ma10" stroke="#8b5cf6" strokeWidth={1} dot={false} strokeDasharray="4 4" />}
            {chartData[0]?.ma20 && <Line type="monotone" dataKey="ma20" stroke="#06b6d4" strokeWidth={1} dot={false} strokeDasharray="2 2" />}
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-2 flex justify-center gap-4 text-[10px] text-muted-text">
          <span><span className="inline-block w-3 h-0.5 bg-amber-500 align-middle mr-1" /> MA5</span>
          <span><span className="inline-block w-3 h-0.5 bg-purple-500 align-middle mr-1" /> MA10</span>
          <span><span className="inline-block w-3 h-0.5 bg-cyan-500 align-middle mr-1" /> MA20</span>
        </div>
      </div>

      {/* Source info */}
      {detail.kline?.source && (
        <p className="text-center text-[11px] text-muted-text">数据来源：{detail.kline.source}</p>
      )}
    </div>
  );
};

export default StockDetailPage;
