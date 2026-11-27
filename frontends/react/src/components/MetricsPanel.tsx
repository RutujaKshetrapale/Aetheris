import React from 'react';
import { ExecutionMetrics } from '../types/contract';

interface MetricsPanelProps {
  metrics: ExecutionMetrics | null;
  algorithm: string;
  pathFound: boolean | null;
  noPathReason?: string | null;
  currentStep: number;
  totalSteps: number;
  playbackSpeed: number;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  metrics,
  algorithm,
  pathFound,
  noPathReason,
  currentStep,
  totalSteps,
  playbackSpeed
}) => {
  const statusLabel =
    pathFound === null ? 'READY' : pathFound ? 'PATH FOUND' : `NO PATH${noPathReason ? ` (${noPathReason})` : ''}`;
  const statusClass = pathFound === null ? 'text-muted' : pathFound ? 'text-emerald' : 'text-rose';

  return (
    <section className="metrics-grid" data-testid="metrics-panel">
      <div className="metric-card">
        <span className="metric-label">Algorithm</span>
        <span className="metric-value text-gold">{algorithm || '—'}</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Status</span>
        <span className={`metric-value ${statusClass}`} data-testid="metric-status" style={{ fontSize: '0.78rem' }}>
          {statusLabel}
        </span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Path Nodes</span>
        <span className="metric-value" data-testid="metric-path-nodes">
          {metrics ? metrics.pathNodeCount : '—'}
        </span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Path Edges</span>
        <span className="metric-value">{metrics ? metrics.pathEdgeCount : '—'}</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Algo Path Cost</span>
        <span className="metric-value text-gold" data-testid="metric-algo-cost">
          {metrics && metrics.algorithmPathCost !== null ? metrics.algorithmPathCost : '—'}
        </span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Terrain Cost</span>
        <span className="metric-value text-gold" data-testid="metric-terrain-cost">
          {metrics && metrics.terrainPathCost !== null ? metrics.terrainPathCost : '—'}
        </span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Visited Nodes</span>
        <span className="metric-value text-indigo">{metrics ? metrics.nodesVisited : '—'}</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Max Frontier</span>
        <span className="metric-value">{metrics ? metrics.maxFrontierSize : '—'}</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Backend Exec Time</span>
        <span className="metric-value text-sky">
          {metrics ? `${metrics.executionTimeMs} ms` : '—'}
        </span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Frontend Playback</span>
        <span className="metric-value text-muted" style={{ fontSize: '0.78rem' }}>
          {currentStep >= 0 ? `${currentStep + 1}/${totalSteps}` : `0/${totalSteps}`} @ {playbackSpeed}ms
        </span>
      </div>
    </section>
  );
};
