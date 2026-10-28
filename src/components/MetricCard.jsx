import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function MetricCard({ label, value, sub, badge, Icon, accent, delay = '' }) {
  return (
    <div className={`glass glass-interactive metric-card card-accent-${accent} anim-slide-up ${delay}`}>
      <div className="metric-label">
        {Icon && <Icon size={13} />} {label}
      </div>
      <div className={`metric-value ${accent}`}>
        {value}
      </div>
      {badge && (
        <div className={`metric-badge ${badge.type}`}>
          {badge.dir === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {badge.text}
        </div>
      )}
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}
