const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ts = require(path.resolve(__dirname, '../../frontends/react/node_modules/typescript'));
const { DeterministicEngine } = require('../fixture-runner/deterministic-engine');

function loadTsClass(tsFilePath, className) {
  const source = fs.readFileSync(tsFilePath, 'utf-8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  });
  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', transpiled.outputText);
  fn(mod.exports, require, mod);
  return mod.exports[className];
}

const ReactEngine = loadTsClass(
  path.resolve(__dirname, '../../frontends/react/src/services/reversibleTraceEngine.ts'),
  'ReversibleTraceEngine'
);
const AngularEngine = loadTsClass(
  path.resolve(__dirname, '../../frontends/angular/src/app/services/reversible-trace-engine.ts'),
  'ReversibleTraceEngine'
);

const fixturesDir = path.resolve(__dirname, '../../contracts/fixtures/pathfinding');
const fixtureFiles = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.fixture.json')).sort();
const deterministicEngine = new DeterministicEngine();

function serializeSnapshot(snap) {
  return {
    currentStep: snap.currentStep,
    totalSteps: snap.totalSteps,
    algorithm: snap.algorithm,
    cellStates: Object.fromEntries(
      [...snap.cellStates.entries()].sort(([a], [b]) => a.localeCompare(b))
    ),
    activeNode: snap.activeNode,
    frontier: snap.frontier,
    closedNodes: [...snap.closedNodes].sort(),
    heapIndexMap: Object.fromEntries(
      [...snap.heapIndexMap.entries()].sort(([a], [b]) => a.localeCompare(b))
    ),
    heapPriorities: Object.fromEntries(
      [...snap.heapPriorities.entries()].sort(([a], [b]) => a.localeCompare(b))
    ),
    lastHeapSwaps: snap.lastHeapSwaps,
    path: snap.path,
    nodesVisited: snap.nodesVisited,
    maxFrontierSize: snap.maxFrontierSize,
    currentAction: snap.currentAction,
    currentOperationSubtype: snap.currentOperationSubtype,
    currentNodeId: snap.currentNodeId
  };
}

for (const file of fixtureFiles) {
  const fixture = JSON.parse(fs.readFileSync(path.join(fixturesDir, file), 'utf-8'));

  test(`ReversibleTraceEngine parity & reversibility: ${file} (${fixture.algorithm})`, () => {
    const traceRes = deterministicEngine.run(fixture.algorithm, fixture.grid);

    const reactPlayer = new ReactEngine(fixture.grid);
    const angularPlayer = new AngularEngine(fixture.grid);

    const initialReact = serializeSnapshot(reactPlayer.getSnapshot());
    const initialAngular = serializeSnapshot(angularPlayer.getSnapshot());
    assert.deepStrictEqual(initialAngular, initialReact, 'Initial grid snapshot must match');

    reactPlayer.loadTrace(fixture.algorithm, traceRes.traceDeltas, traceRes.keyframes || []);
    angularPlayer.loadTrace(fixture.algorithm, traceRes.traceDeltas, traceRes.keyframes || []);

    const keyframeMap = new Map((traceRes.keyframes || []).map((kf) => [kf.step, kf]));

    // 1. Forward playback step-by-step & keyframe verification
    for (let step = 0; step < traceRes.traceDeltas.length; step++) {
      assert.strictEqual(reactPlayer.stepForward(), true);
      assert.strictEqual(angularPlayer.stepForward(), true);

      const rSnap = reactPlayer.getSnapshot();
      const aSnap = angularPlayer.getSnapshot();
      assert.deepStrictEqual(serializeSnapshot(aSnap), serializeSnapshot(rSnap), `Parity mismatch at forward step ${step}`);

      const kf = keyframeMap.get(step);
      if (kf) {
        if (step > 0 || fixture.algorithm === 'DIJKSTRA' || fixture.algorithm === 'ASTAR') {
          assert.deepStrictEqual(rSnap.frontier, kf.frontier, `Frontier mismatch at keyframe ${step}`);
        }
        assert.strictEqual(rSnap.closedNodes.size, kf.closedCount, `ClosedCount mismatch at keyframe ${step}`);
      }
    }

    // Cannot step past end
    assert.strictEqual(reactPlayer.stepForward(), false);
    assert.strictEqual(angularPlayer.stepForward(), false);

    // Final path & metrics match
    const finalSnap = reactPlayer.getSnapshot();
    assert.deepStrictEqual(finalSnap.path, traceRes.path);
    assert.strictEqual(finalSnap.nodesVisited, traceRes.metrics.nodesVisited);
    assert.strictEqual(finalSnap.maxFrontierSize, traceRes.metrics.maxFrontierSize);

    // 2. Full backward playback to initial state (-1)
    for (let step = traceRes.traceDeltas.length - 1; step >= 0; step--) {
      assert.strictEqual(reactPlayer.stepBackward(), true);
      assert.strictEqual(angularPlayer.stepBackward(), true);
      assert.deepStrictEqual(
        serializeSnapshot(angularPlayer.getSnapshot()),
        serializeSnapshot(reactPlayer.getSnapshot()),
        `Parity mismatch at backward step ${step}`
      );
    }
    assert.strictEqual(reactPlayer.stepBackward(), false);
    assert.strictEqual(angularPlayer.stepBackward(), false);

    // Exact restoration to initial state
    const restoredReact = serializeSnapshot(reactPlayer.getSnapshot());
    assert.strictEqual(restoredReact.currentStep, -1);
    assert.strictEqual(restoredReact.activeNode, null);
    assert.deepStrictEqual(restoredReact.frontier, []);
    assert.deepStrictEqual(restoredReact.closedNodes, []);
    assert.deepStrictEqual(restoredReact.heapIndexMap, {});
    assert.deepStrictEqual(restoredReact.heapPriorities, {});
    assert.deepStrictEqual(restoredReact.path, []);
    assert.strictEqual(restoredReact.nodesVisited, 0);
    assert.strictEqual(restoredReact.maxFrontierSize, 0);
    assert.deepStrictEqual(restoredReact.cellStates, initialReact.cellStates);

    // 3. Keyframe-based seeking & stepping across keyframe boundary
    if (traceRes.traceDeltas.length > 2) {
      const mid = Math.floor(traceRes.traceDeltas.length / 2);
      reactPlayer.jumpToStep(mid);
      angularPlayer.jumpToStep(mid);
      assert.deepStrictEqual(
        serializeSnapshot(angularPlayer.getSnapshot()),
        serializeSnapshot(reactPlayer.getSnapshot()),
        `Parity mismatch after jumpToStep(${mid})`
      );

      // Step back from mid, then step forward back to mid
      assert.strictEqual(reactPlayer.stepBackward(), true);
      assert.strictEqual(angularPlayer.stepBackward(), true);
      assert.deepStrictEqual(
        serializeSnapshot(angularPlayer.getSnapshot()),
        serializeSnapshot(reactPlayer.getSnapshot()),
        `Parity mismatch after stepBackward from ${mid}`
      );

      assert.strictEqual(reactPlayer.stepForward(), true);
      assert.strictEqual(angularPlayer.stepForward(), true);
      assert.deepStrictEqual(
        serializeSnapshot(angularPlayer.getSnapshot()),
        serializeSnapshot(reactPlayer.getSnapshot()),
        `Parity mismatch after stepForward back to ${mid}`
      );

      // Jump to -1 keeps trace loaded!
      reactPlayer.jumpToStep(-1);
      angularPlayer.jumpToStep(-1);
      assert.strictEqual(reactPlayer.getTotalSteps(), traceRes.traceDeltas.length);
      assert.strictEqual(angularPlayer.getTotalSteps(), traceRes.traceDeltas.length);
      assert.strictEqual(reactPlayer.getCurrentStep(), -1);
      assert.strictEqual(angularPlayer.getCurrentStep(), -1);
    }
  });
}
