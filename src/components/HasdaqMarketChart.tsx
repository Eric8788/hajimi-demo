'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { CandlestickData, HistogramData, UTCTimestamp } from 'lightweight-charts';
import HasdaqInfoTooltip from './HasdaqInfoTooltip';
import { HasdaqRollingNumber } from './HasdaqNumberControls';

type HasdaqChartCompany = {
    ticker?: string;
    current_price_milli?: number | null;
    day_open_price_milli?: number | null;
    previous_close_price_milli?: number | null;
    total_shares?: number | null;
    pool_shares?: number | null;
    public_shares_remaining?: number | null;
    pool_coin_balance?: number | null;
    h_coin_pool?: number | null;
    holder_count?: number | null;
    trade_volume_today?: number | null;
    volume_today?: number | null;
};

type HasdaqChartTrade = {
    type?: string | null;
    shares?: number | null;
    gross_amount?: number | null;
    price_after_milli?: number | null;
    price_milli?: number | null;
    price_before_milli?: number | null;
    created_at?: string | Date | null;
};

type HasdaqCandle = CandlestickData<UTCTimestamp> & {
    volume: number;
};

const BUCKET_TARGET = 96;
const BUCKET_SECONDS = 60 * 60;
const MIN_DISPLAY_CANDLES = 48;
const MIN_VISIBLE_BARS = 72;
const TAPE_TOOLTIPS = {
    open: 'O = Open 开盘价：当前这段行情的起始价格。',
    high: 'H = High 最高价：当前这段行情里出现过的最高成交价。',
    low: 'L = Low 最低价：当前这段行情里出现过的最低成交价。',
    close: 'C = Close 收盘价 / 最新价：当前最新成交后的价格。',
    volume: 'Vol = Volume 成交量：当前统计周期内成交的股票数量。',
};

function milliToPrice(value?: number | null) {
    return Number((Number(value || 0) / 1000).toFixed(2));
}

function formatMetric(value: number) {
    return new Intl.NumberFormat('zh-CN').format(Math.round(value));
}

function getTradePriceMilli(trade: HasdaqChartTrade, fallback: number) {
    return Number(trade.price_after_milli || trade.price_milli || trade.price_before_milli || fallback);
}

function getTradeVolume(trade: HasdaqChartTrade) {
    return Math.max(0, Number(trade.shares || trade.gross_amount || 0));
}

function getTradeTimestamp(trade: HasdaqChartTrade, index: number) {
    const parsed = trade.created_at ? new Date(trade.created_at).getTime() : Number.NaN;
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
    return 1_700_000_000 + index * BUCKET_SECONDS;
}

function getStrictNextTime(rawTime: number, previousTime?: UTCTimestamp) {
    const previous = previousTime ? Number(previousTime) : 0;
    return Math.max(rawTime, previous + BUCKET_SECONDS) as UTCTimestamp;
}

function roundPrice(value: number) {
    return Number(Math.max(0.01, value).toFixed(2));
}

function buildFallbackCandles(openMilli: number, currentMilli: number): HasdaqCandle[] {
    const start = 1_700_000_000;
    const open = milliToPrice(openMilli);
    const close = milliToPrice(currentMilli);
    const mid = roundPrice((open + close) / 2);
    const drift = Math.max(0.01, Math.abs(close - open) * 0.32);
    const values = [
        { open, close: mid },
        { open: mid, close },
        { open: close, close },
    ];

    return values.map((item, index) => {
        const high = roundPrice(Math.max(item.open, item.close, mid + drift));
        const low = roundPrice(Math.min(item.open, item.close, mid - drift));
        return {
            time: (start + index * BUCKET_SECONDS) as UTCTimestamp,
            open: item.open,
            high,
            low,
            close: item.close,
            volume: index === values.length - 1 ? 1 : 0,
        };
    });
}

function expandSparseCandles(candles: HasdaqCandle[]) {
    if (candles.length < 2 || candles.length >= MIN_DISPLAY_CANDLES) return candles;

    const expanded: HasdaqCandle[] = [candles[0]];
    const stepsPerSegment = Math.max(2, Math.min(8, Math.ceil(MIN_DISPLAY_CANDLES / Math.max(1, candles.length - 1))));

    for (let index = 1; index < candles.length; index += 1) {
        const start = expanded[expanded.length - 1];
        const target = candles[index];
        let remainingVolume = Math.max(0, Math.round(target.volume));
        const startTime = Number(start.time);
        const targetTime = Number(target.time);

        for (let step = 1; step <= stepsPerSegment; step += 1) {
            const isLastStep = step === stepsPerSegment;
            const progress = step / stepsPerSegment;
            const previous = expanded[expanded.length - 1];
            const range = Math.max(0.01, Math.abs(target.close - start.close));
            const wiggle = isLastStep ? 0 : Math.sin((expanded.length + 1) * 1.37) * Math.min(0.018, range * 0.18);
            const close = roundPrice(start.close + (target.close - start.close) * progress + wiggle);
            const open = previous.close;
            const wick = isLastStep ? Math.min(0.006, range * 0.08) : Math.min(0.012, range * 0.12);
            const high = roundPrice(Math.max(open, close) + wick);
            const low = roundPrice(Math.min(open, close) - wick);
            const sliceVolume = isLastStep ? remainingVolume : Math.max(0, Math.round(target.volume / stepsPerSegment));
            remainingVolume = Math.max(0, remainingVolume - sliceVolume);
            const interpolatedTime = targetTime > startTime
                ? Math.round(startTime + (targetTime - startTime) * progress)
                : Number(previous.time) + BUCKET_SECONDS;

            expanded.push({
                time: getStrictNextTime(interpolatedTime, previous.time),
                open,
                high: Math.max(high, open, close),
                low: Math.min(low, open, close),
                close,
                volume: sliceVolume,
            });
        }
    }

    return expanded;
}

function buildCandles(trades: HasdaqChartTrade[] | undefined, company: HasdaqChartCompany): HasdaqCandle[] {
    const fallbackCurrent = Number(company.current_price_milli || company.day_open_price_milli || company.previous_close_price_milli || 1000);
    const openMilli = Number(company.day_open_price_milli || company.previous_close_price_milli || fallbackCurrent);
    const orderedTrades = Array.isArray(trades) ? [...trades].reverse() : [];

    if (orderedTrades.length < 2) {
        return buildFallbackCandles(openMilli, fallbackCurrent);
    }

    const bucketSize = Math.max(1, Math.ceil(orderedTrades.length / BUCKET_TARGET));
    const candles: HasdaqCandle[] = [];
    let previousClose = milliToPrice(openMilli);
    for (let index = 0; index < orderedTrades.length; index += bucketSize) {
        const bucket = orderedTrades.slice(index, index + bucketSize);
        const prices = bucket.map(trade => milliToPrice(getTradePriceMilli(trade, fallbackCurrent)));
        const open = previousClose;
        const close = prices[prices.length - 1] ?? open;
        const high = Math.max(open, close, ...prices);
        const low = Math.min(open, close, ...prices);
        const volume = bucket.reduce((sum, trade) => sum + getTradeVolume(trade), 0);
        const rawTime = getTradeTimestamp(bucket[bucket.length - 1], candles.length);
        candles.push({
            time: getStrictNextTime(rawTime, candles[candles.length - 1]?.time),
            open,
            high,
            low,
            close,
            volume,
        });
        previousClose = close;
    }

    const currentQuote = milliToPrice(fallbackCurrent);
    const lastCandle = candles[candles.length - 1];
    if (lastCandle && Math.abs(lastCandle.close - currentQuote) >= 0.01) {
        candles.push({
            time: getStrictNextTime(Number(lastCandle.time) + BUCKET_SECONDS, lastCandle.time),
            open: lastCandle.close,
            high: Math.max(lastCandle.close, currentQuote),
            low: Math.min(lastCandle.close, currentQuote),
            close: currentQuote,
            volume: 0,
        });
    }

    const displayCandles = expandSparseCandles(candles);
    return displayCandles.length > 0 ? displayCandles.slice(-72) : buildFallbackCandles(openMilli, fallbackCurrent);
}

export default function HasdaqMarketChart({ company, trades }: { company: HasdaqChartCompany; trades?: HasdaqChartTrade[] }) {
    const chartRef = useRef<HTMLDivElement | null>(null);
    const candles = useMemo(() => buildCandles(trades, company), [trades, company]);
    const lastCandle = candles[candles.length - 1];
    const sessionOpen = candles[0]?.open ?? milliToPrice(company.day_open_price_milli || company.previous_close_price_milli || company.current_price_milli || 1000);
    const sessionHigh = candles.reduce((high, candle) => Math.max(high, candle.high), sessionOpen);
    const sessionLow = candles.reduce((low, candle) => Math.min(low, candle.low), sessionOpen);
    const sessionClose = milliToPrice(company.current_price_milli || (lastCandle?.close || 1000) * 1000);
    const marketCap = Math.round(milliToPrice(company.current_price_milli || 0) * Number(company.total_shares || 1000));
    const volume = Number(company.trade_volume_today ?? company.volume_today ?? lastCandle?.volume ?? 0);
    const isUp = sessionClose >= sessionOpen;
    const marketCapTooltip = `市值 = 当前股价 × 总股本。Hasdaq V1 默认总股本 ${formatMetric(Number(company.total_shares || 1000))} 股，所以现在约为 ${sessionClose.toFixed(2)} × ${formatMetric(Number(company.total_shares || 1000))} = ${formatMetric(marketCap)} H币。`;

    useEffect(() => {
        let disposed = false;
        let cleanup = () => {};

        async function mountChart() {
            const container = chartRef.current;
            if (!container) return;

            const { createChart, CandlestickSeries, HistogramSeries } = await import('lightweight-charts');
            if (disposed || !chartRef.current) return;

            const chart = createChart(container, {
                height: 410,
                width: container.clientWidth,
                autoSize: true,
                layout: {
                    attributionLogo: false,
                    background: { color: 'rgba(255,255,255,0)' },
                    textColor: '#4f5b58',
                    fontFamily: 'Inter, sans-serif',
                },
                grid: {
                    vertLines: { color: 'rgba(45,52,54,0.06)' },
                    horzLines: { color: 'rgba(45,52,54,0.06)' },
                },
                rightPriceScale: {
                    borderVisible: false,
                    entireTextOnly: true,
                    minimumWidth: 58,
                    scaleMargins: { top: 0.08, bottom: 0.22 },
                },
                timeScale: {
                    borderVisible: false,
                    barSpacing: 7,
                    minBarSpacing: 4,
                    maxBarSpacing: 12,
                    rightOffset: 14,
                    fixLeftEdge: true,
                    timeVisible: true,
                    secondsVisible: false,
                },
                crosshair: {
                    vertLine: { color: 'rgba(108,92,231,0.22)', labelBackgroundColor: '#6c5ce7', labelVisible: false },
                    horzLine: { color: 'rgba(108,92,231,0.18)', labelBackgroundColor: '#6c5ce7', labelVisible: false },
                },
            });

            const candleSeries = chart.addSeries(CandlestickSeries, {
                upColor: '#00a884',
                downColor: '#d63031',
                borderUpColor: '#00a884',
                borderDownColor: '#d63031',
                wickUpColor: '#00a884',
                wickDownColor: '#d63031',
                priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
            });
            candleSeries.setData(candles);

            const volumeSeries = chart.addSeries(HistogramSeries, {
                priceFormat: { type: 'volume' },
                priceScaleId: '',
                color: 'rgba(108,92,231,0.24)',
            });
            volumeSeries.priceScale().applyOptions({
                scaleMargins: { top: 0.84, bottom: 0 },
            });
            const volumeData: HistogramData<UTCTimestamp>[] = candles.map(candle => ({
                time: candle.time,
                value: candle.volume,
                color: candle.close >= candle.open ? 'rgba(0,168,132,0.28)' : 'rgba(214,48,49,0.22)',
            }));
            volumeSeries.setData(volumeData);

            const visibleBars = Math.max(MIN_VISIBLE_BARS, candles.length + 8);
            const visibleTo = candles.length + 5;
            chart.timeScale().setVisibleLogicalRange({ from: visibleTo - visibleBars, to: visibleTo });

            const resizeObserver = new ResizeObserver(() => {
                if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
            });
            resizeObserver.observe(container);

            cleanup = () => {
                resizeObserver.disconnect();
                chart.remove();
            };
        }

        void mountChart();

        return () => {
            disposed = true;
            cleanup();
        };
    }, [candles]);

    return (
        <div className="hasdaq-market-panel">
            <div className="hasdaq-market-tape" aria-label="Hasdaq market data">
                <HasdaqInfoTooltip tooltip={TAPE_TOOLTIPS.open}>O <b><HasdaqRollingNumber value={sessionOpen} decimals={2} fontSize={13} animated={false} /></b></HasdaqInfoTooltip>
                <HasdaqInfoTooltip tooltip={TAPE_TOOLTIPS.high}>H <b><HasdaqRollingNumber value={sessionHigh} decimals={2} fontSize={13} animated={false} /></b></HasdaqInfoTooltip>
                <HasdaqInfoTooltip tooltip={TAPE_TOOLTIPS.low}>L <b><HasdaqRollingNumber value={sessionLow} decimals={2} fontSize={13} animated={false} /></b></HasdaqInfoTooltip>
                <HasdaqInfoTooltip tooltip={TAPE_TOOLTIPS.close}>C <b className={isUp ? 'is-up' : 'is-down'}><HasdaqRollingNumber value={sessionClose} decimals={2} fontSize={13} animated={false} /></b></HasdaqInfoTooltip>
                <HasdaqInfoTooltip tooltip={TAPE_TOOLTIPS.volume}>Vol <b><HasdaqRollingNumber value={volume} fontSize={13} animated={false} /></b></HasdaqInfoTooltip>
            </div>
            <div ref={chartRef} className="hasdaq-lightweight-chart" role="img" aria-label={`${company.ticker || 'Hasdaq'} candlestick and volume chart`} />
            <div className="hasdaq-metrics hasdaq-market-stats">
                <HasdaqInfoTooltip className="hasdaq-liquidity-metric" tooltip="系统交易池中还能被买入的股票数量。"><b><HasdaqRollingNumber value={Number(company.pool_shares ?? company.public_shares_remaining ?? 0)} fontSize={13} animated={false} /></b> 可买股票</HasdaqInfoTooltip>
                <HasdaqInfoTooltip className="hasdaq-liquidity-metric" tooltip="系统交易池中用于承接卖出的 H币余额。"><b><HasdaqRollingNumber value={Number(company.pool_coin_balance ?? company.h_coin_pool ?? 0)} fontSize={13} animated={false} /></b> 流动 H币</HasdaqInfoTooltip>
                <span><b><HasdaqRollingNumber value={Number(company.holder_count || 0)} fontSize={13} animated={false} /></b> 持有人</span>
                <HasdaqInfoTooltip tooltip={marketCapTooltip}><b><HasdaqRollingNumber value={marketCap} fontSize={13} animated={false} /></b> 市值</HasdaqInfoTooltip>
            </div>
        </div>
    );
}
