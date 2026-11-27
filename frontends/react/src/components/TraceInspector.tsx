import React from 'react';
import { TraceSnapshot } from '../services/reversibleTraceEngine';

interface TraceInspectorProps {
  snapshot: TraceSnapshot;
}

export const TraceInspector: React.FC<TraceInspectorProps> = ({ snapshot }) => {
  const isHeapAlgo = snapshot.algorithm === 'DIJKSTRA' || snapshot.algorithm === 'ASTAR';

  return (
    <aside className="panel" data-testid="trace-inspector">
      <div className="toolbar-row">
        <h2 className="font-serif" style={{ fontSize: '0.95rem', color: '#f8fafc' }}>
          Reversible Trace State
        </h2>
        <span className="badge badge-gold">
          Step {snapshot.currentStep >= 0 ? snapshot.currentStep + 1 : 0} / {snapshot.totalSteps}
        </span>
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div className="metric-card">
          <span className="metric-label">Current Action</span>
          <span className="metric-value text-gold" style={{ fontSize: '0.78rem' }}>
            {snapshot.currentAction ?? 'INITIAL_GRID'}
            {snapshot.currentOperationSubtype ? ` (${snapshot.currentOperationSubtype})` : ''}
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Active Node</span>
          <span className="metric-value text-sky" style={{ fontSize: '0.78rem' }}>
            {snapshot.activeNode ?? '—'}
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Visited / Closed</span>
          <span className="metric-value text-indigo" style={{ fontSize: '0.78rem' }}>
            {snapshot.nodesVisited} / {snapshot.closedNodes.size}
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Frontier / Max</span>
          <span className="metric-value" style={{ fontSize: '0.78rem' }}>
            {snapshot.frontier.length} / {snapshot.maxFrontierSize}
          </span>
        </div>
      </div>

      {snapshot.currentDetails && (
        <div className="chip" style={{ width: '100%', padding: '0.45rem 0.6rem', color: '#cbd5e1' }}>
          {snapshot.currentDetails}
        </div>
      )}

      <div className="panel-divider">
        <div className="toolbar-label" style={{ marginBottom: '0.4rem' }}>
          {isHeapAlgo ? 'Physical Indexed Min-Heap Frontier' : 'Physical Frontier'} ({snapshot.frontier.length})
        </div>
        <div className="inspector-list">
          {snapshot.frontier.length === 0 ? (
            <span className="text-muted font-mono" style={{ fontSize: '0.72rem' }}>Empty</span>
          ) : (
            snapshot.frontier.map((id, idx) => {
              const prio = snapshot.heapPriorities.get(id);
              const heapIdx = snapshot.heapIndexMap.get(id);
              return (
                <span key={`${id}-${idx}`} className="chip chip-sky">
                  {isHeapAlgo ? `[${heapIdx ?? idx}] ${id}` : id}
                  {isHeapAlgo && prio ? ` (g:${prio.g ?? '—'} f:${prio.f ?? '—'})` : ''}
                </span>
              );
            })
          )}
        </div>
      </div>

      {snapshot.lastHeapSwaps.length > 0 && (
        <div className="panel-divider">
          <div className="toolbar-label" style={{ marginBottom: '0.4rem' }}>
            Physical Heap Swaps ({snapshot.lastHeapSwaps.length})
          </div>
          <div className="inspector-list">
            {snapshot.lastHeapSwaps.map((s, idx) => (
              <span key={idx} className="chip chip-gold">
                [{s.indexA}:{s.nodeA}] ⇄ [{s.indexB}:{s.nodeB}]
              </span>
            ))}
          </div>
        </div>
      )}

      {snapshot.path.length > 0 && (
        <div className="panel-divider">
          <div className="toolbar-label" style={{ marginBottom: '0.4rem' }}>
            Reconstructed Path ({snapshot.path.length} nodes)
          </div>
          <div className="inspector-list">
            {snapshot.path.map((id, idx) => (
              <span key={`${id}-${idx}`} className="chip chip-gold">
                {id}
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
