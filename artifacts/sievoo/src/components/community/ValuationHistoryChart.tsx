import { format } from 'date-fns';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { HistoryPoint } from '@/lib/community-api';
import { formatMoney } from '@/lib/format';
import { useLang } from '@/lib/i18n';

/**
 * Price vs. AutoDCF (base) vs. AutoValue (Graham Number) over every stored
 * valuation run. Shared by the Watchlist history tab and /stock pages.
 */
export function ValuationHistoryChart({
  points,
  currency,
  height = 360,
}: {
  points: HistoryPoint[];
  currency: string | null;
  height?: number;
}) {
  const { t } = useLang();
  const priceLabel = t('Price', 'Kurs');
  const dcfLabel = 'AutoDCF (Base)';
  const grahamLabel = 'AutoValue (Graham)';

  const data = points.map((p) => ({
    date: format(new Date(p.computed_at), 'MMM d, yyyy'),
    [priceLabel]: p.price,
    [dcfLabel]: p.base_dcf,
    [grahamLabel]: p.graham_number,
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" minTickGap={24} />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => formatMoney(v, currency, 0)}
            width={72}
          />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
            formatter={(value) => (typeof value === 'number' ? formatMoney(value, currency) : '—')}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey={priceLabel} stroke="#e5e7eb" strokeWidth={2} dot={points.length < 40 ? { r: 3 } : false} connectNulls />
          <Line type="monotone" dataKey={dcfLabel} stroke="#10b981" strokeWidth={2} dot={points.length < 40 ? { r: 3 } : false} connectNulls />
          <Line type="monotone" dataKey={grahamLabel} stroke="#f59e0b" strokeWidth={2} dot={points.length < 40 ? { r: 3 } : false} connectNulls />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
