# -*- coding: utf-8 -*-
"""
===================================
股票数据服务层
===================================

职责：
1. 封装股票数据获取逻辑
2. 提供实时行情和历史数据接口
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from src.repositories.stock_repo import StockRepository

logger = logging.getLogger(__name__)


class StockService:
    """
    股票数据服务
    
    封装股票数据获取的业务逻辑
    """
    
    def __init__(self):
        """初始化股票数据服务"""
        self.repo = StockRepository()
    
    def get_realtime_quote(self, stock_code: str) -> Optional[Dict[str, Any]]:
        """
        获取股票实时行情
        
        Args:
            stock_code: 股票代码
            
        Returns:
            实时行情数据字典
        """
        try:
            # 调用数据获取器获取实时行情
            from data_provider.base import DataFetcherManager
            
            manager = DataFetcherManager()
            quote = manager.get_realtime_quote(stock_code)
            
            if quote is None:
                logger.warning(f"获取 {stock_code} 实时行情失败")
                return None
            
            # UnifiedRealtimeQuote 是 dataclass，使用 getattr 安全访问字段
            # 字段映射: UnifiedRealtimeQuote -> API 响应
            # - code -> stock_code
            # - name -> stock_name
            # - price -> current_price
            # - change_amount -> change
            # - change_pct -> change_percent
            # - open_price -> open
            # - high -> high
            # - low -> low
            # - pre_close -> prev_close
            # - volume -> volume
            # - amount -> amount
            return {
                "stock_code": getattr(quote, "code", stock_code),
                "stock_name": getattr(quote, "name", None),
                "current_price": getattr(quote, "price", 0.0) or 0.0,
                "change": getattr(quote, "change_amount", None),
                "change_percent": getattr(quote, "change_pct", None),
                "open": getattr(quote, "open_price", None),
                "high": getattr(quote, "high", None),
                "low": getattr(quote, "low", None),
                "prev_close": getattr(quote, "pre_close", None),
                "volume": getattr(quote, "volume", None),
                "amount": getattr(quote, "amount", None),
                "update_time": datetime.now().isoformat(),
            }
            
        except ImportError:
            logger.warning("DataFetcherManager 未找到，使用占位数据")
            return self._get_placeholder_quote(stock_code)
        except Exception as e:
            logger.error(f"获取实时行情失败: {e}", exc_info=True)
            return None
    
    def get_history_data(
        self,
        stock_code: str,
        period: str = "daily",
        days: int = 30
    ) -> Dict[str, Any]:
        """
        获取股票历史行情
        
        Args:
            stock_code: 股票代码
            period: K 线周期 (daily/weekly/monthly)
            days: 获取天数
            
        Returns:
            历史行情数据字典
            
        Raises:
            ValueError: 当 period 不是 daily 时抛出（weekly/monthly 暂未实现）
        """
        # 验证 period 参数，只支持 daily
        if period != "daily":
            raise ValueError(
                f"暂不支持 '{period}' 周期，目前仅支持 'daily'。"
                "weekly/monthly 聚合功能将在后续版本实现。"
            )
        
        try:
            # 调用数据获取器获取历史数据
            from data_provider.base import DataFetcherManager
            
            manager = DataFetcherManager()
            df, source = manager.get_daily_data(stock_code, days=days)
            
            if df is None or df.empty:
                logger.warning(f"获取 {stock_code} 历史数据失败")
                return {"stock_code": stock_code, "period": period, "data": []}
            
            # 获取股票名称
            stock_name = manager.get_stock_name(stock_code)
            
            # 转换为响应格式
            data = []
            for _, row in df.iterrows():
                date_val = row.get("date")
                if hasattr(date_val, "strftime"):
                    date_str = date_val.strftime("%Y-%m-%d")
                else:
                    date_str = str(date_val)
                
                data.append({
                    "date": date_str,
                    "open": float(row.get("open", 0)),
                    "high": float(row.get("high", 0)),
                    "low": float(row.get("low", 0)),
                    "close": float(row.get("close", 0)),
                    "volume": float(row.get("volume", 0)) if row.get("volume") else None,
                    "amount": float(row.get("amount", 0)) if row.get("amount") else None,
                    "change_percent": float(row.get("pct_chg", 0)) if row.get("pct_chg") else None,
                })
            
            return {
                "stock_code": stock_code,
                "stock_name": stock_name,
                "period": period,
                "data": data,
            }
            
        except ImportError:
            logger.warning("DataFetcherManager 未找到，返回空数据")
            return {"stock_code": stock_code, "period": period, "data": []}
        except Exception as e:
            logger.error(f"获取历史数据失败: {e}", exc_info=True)
            return {"stock_code": stock_code, "period": period, "data": []}
    
    # Popular US stocks for movers board
    US_MOVER_SYMBOLS = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B",
        "JPM", "V", "UNH", "WMT", "XOM", "JNJ", "PG", "MA", "HD", "CVX",
        "BAC", "PFE", "ABBV", "KO", "PEP", "TMO", "AVGO", "COST", "CSCO",
        "ABT", "MCD", "ACN", "NKE", "DIS", "NFLX", "AMD", "INTC", "QCOM",
        "CRM", "TXN", "AMAT", "ADBE", "PYPL", "UBER", "SQ", "SNAP", "PLTR",
    ]

    def get_us_movers(self) -> Dict[str, Any]:
        """Get top US stock gainers and losers using yfinance batch download."""
        try:
            import yfinance as yf
            import time
            import pandas as pd

            symbols = self.US_MOVER_SYMBOLS

            # Batch download: get previous close and current info
            tickers = yf.Tickers(" ".join(symbols))

            quotes = []
            for code in symbols:
                try:
                    t = tickers.tickers.get(code)
                    if not t:
                        continue
                    info = getattr(t, "info", {}) or {}
                    fast = getattr(t, "fast_info", None)
                    name = info.get("shortName") or info.get("longName") or code

                    # Get price and change
                    prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose")
                    price = info.get("currentPrice") or info.get("regularMarketPrice")

                    if fast and not price:
                        price = getattr(fast, "last_price", None) or getattr(fast, "lastPrice", None)
                    if fast and not prev_close:
                        prev_close = getattr(fast, "previous_close", None) or getattr(fast, "previousClose", None)

                    if not price or price <= 0:
                        continue

                    change_pct = None
                    change_amount = None
                    if prev_close and prev_close > 0:
                        change_amount = round(float(price) - float(prev_close), 2)
                        change_pct = round((change_amount / float(prev_close)) * 100, 2)

                    quotes.append({
                        "code": code,
                        "name": str(name) if name else code,
                        "price": round(float(price), 2),
                        "change_pct": change_pct,
                        "change_amount": change_amount,
                    })
                except Exception:
                    continue

            quotes.sort(key=lambda x: x.get("change_pct") or 0, reverse=True)

            gainers = [q for q in quotes if q.get("change_pct") and q["change_pct"] > 0][:10]
            losers = sorted(
                [q for q in quotes if q.get("change_pct") and q["change_pct"] < 0],
                key=lambda x: x["change_pct"]
            )[:10]

            return {
                "gainers": gainers,
                "losers": losers,
                "total_scanned": len(quotes),
                "updated_at": datetime.now().isoformat(),
            }
        except Exception as e:
            logger.error(f"获取美股涨跌榜失败: {e}")
            return {"gainers": [], "losers": [], "total_scanned": 0, "updated_at": datetime.now().isoformat()}

    def get_stock_detail(self, stock_code: str) -> Optional[Dict[str, Any]]:
        """Get combined realtime quote + K-line for a stock detail page."""
        try:
            from data_provider.base import DataFetcherManager

            manager = DataFetcherManager()

            # Fetch realtime and history in parallel
            import concurrent.futures
            quote_result = None
            history_result = None
            name_result = None

            def _fetch_quote():
                nonlocal quote_result
                try:
                    q = manager.get_realtime_quote(stock_code)
                    if q:
                        quote_result = {
                            "code": getattr(q, "code", stock_code),
                            "name": getattr(q, "name", None),
                            "price": getattr(q, "price", 0) or 0,
                            "change_pct": getattr(q, "change_pct", None),
                            "change_amount": getattr(q, "change_amount", None),
                            "open": getattr(q, "open_price", None),
                            "high": getattr(q, "high", None),
                            "low": getattr(q, "low", None),
                            "pre_close": getattr(q, "pre_close", None),
                            "volume": getattr(q, "volume", None),
                        }
                except Exception:
                    pass

            def _fetch_history():
                nonlocal history_result
                try:
                    df, source = manager.get_daily_data(stock_code, days=180)
                    if df is not None and not df.empty:
                        data = []
                        for _, row in df.iterrows():
                            date_val = row.get("date")
                            date_str = date_val.strftime("%Y-%m-%d") if hasattr(date_val, "strftime") else str(date_val)
                            data.append({
                                "date": date_str,
                                "open": float(row.get("open", 0)),
                                "high": float(row.get("high", 0)),
                                "low": float(row.get("low", 0)),
                                "close": float(row.get("close", 0)),
                                "volume": float(row.get("volume", 0)) if row.get("volume") else None,
                                "change_pct": float(row.get("pct_chg", 0)) if row.get("pct_chg") else None,
                            })
                        history_result = {"source": str(source), "data": data}
                except Exception:
                    pass

            def _fetch_name():
                nonlocal name_result
                try:
                    name_result = manager.get_stock_name(stock_code)
                except Exception:
                    pass

            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
                futures = [pool.submit(f) for f in (_fetch_quote, _fetch_history, _fetch_name)]
                for f in futures:
                    f.result(timeout=30)

            if not quote_result and not history_result:
                return None

            # Determine market
            from data_provider.base import canonical_stock_code, normalize_stock_code
            normalized = normalize_stock_code(stock_code)
            canonical = canonical_stock_code(normalized)
            market = "cn"
            if canonical.startswith("HK") or canonical.startswith("hk"):
                market = "hk"
            elif any(c.isalpha() and c.isascii() for c in str(canonical)) and not str(canonical).isdigit():
                if len(str(canonical)) <= 5 and all(not c.isdigit() or i < len(str(canonical)) - 1 for i, c in enumerate(str(canonical))):
                    pass
            from data_provider.us_index_mapping import is_us_stock_code
            if is_us_stock_code(normalized):
                market = "us"
            elif str(canonical).startswith("HK"):
                market = "hk"

            # Compute simple indicators
            indicators = None
            if history_result and history_result.get("data"):
                closes = [d["close"] for d in history_result["data"] if d.get("close")]
                if len(closes) >= 5:
                    ma5 = sum(closes[-5:]) / 5
                else:
                    ma5 = None
                if len(closes) >= 10:
                    ma10 = sum(closes[-10:]) / 10
                else:
                    ma10 = None
                if len(closes) >= 20:
                    ma20 = sum(closes[-20:]) / 20
                else:
                    ma20 = None
                indicators = {
                    "ma5": round(ma5, 2) if ma5 else None,
                    "ma10": round(ma10, 2) if ma10 else None,
                    "ma20": round(ma20, 2) if ma20 else None,
                }

            return {
                "code": stock_code,
                "name": quote_result.get("name") if quote_result else (name_result or stock_code),
                "market": market,
                "realtime": quote_result,
                "kline": history_result,
                "indicators": indicators,
            }
        except Exception as e:
            logger.error(f"获取个股详情失败 {stock_code}: {e}")
            return None

    def _get_placeholder_quote(self, stock_code: str) -> Dict[str, Any]:
        """
        获取占位行情数据（用于测试）
        
        Args:
            stock_code: 股票代码
            
        Returns:
            占位行情数据
        """
        return {
            "stock_code": stock_code,
            "stock_name": f"股票{stock_code}",
            "current_price": 0.0,
            "change": None,
            "change_percent": None,
            "open": None,
            "high": None,
            "low": None,
            "prev_close": None,
            "volume": None,
            "amount": None,
            "update_time": datetime.now().isoformat(),
        }
