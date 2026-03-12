// ─── Rewrite Web Worker ───
// Runs rewriting computation + layout off the main thread.
// Computes layout for every intermediate state (for step animation).

import { parseRule, parseState, isParseError } from '../lib/parser';
import { evolve, analyzeState } from '../lib/rewriter';
import { computeLayout, type NodePosition } from '../lib/layout';

export interface WorkerRequest {
    type: 'compute';
    ruleText: string;
    initialText: string;
    steps: number;
}

export interface WorkerResponse {
    type: 'result' | 'error';
    states?: number[][][];
    allPositions?: Array<Array<[number, { x: number; y: number }]>>;
    nodeCount?: number;
    edgeCount?: number;
    allBinary?: boolean;
    truncated?: boolean;
    haltedAtStep?: number | null;
    step?: number;
    error?: string;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
    const { ruleText, initialText, steps } = e.data;

    // Parse rule
    const ruleResult = parseRule(ruleText);
    if (isParseError(ruleResult)) {
        (self as unknown as Worker).postMessage({
            type: 'error',
            error: ruleResult.error,
        } as WorkerResponse);
        return;
    }

    // Parse initial state
    const initial = parseState(initialText);
    if (!initial) {
        (self as unknown as Worker).postMessage({
            type: 'error',
            error: 'Invalid initial state',
        } as WorkerResponse);
        return;
    }

    // Evolve
    const evolution = evolve(ruleResult, initial, steps);

    // Compute layout for each intermediate state
    // Use previous positions as starting points for incremental layout
    const allPosArrays: Array<Array<[number, { x: number; y: number }]>> = [];
    let prevPositions: Map<number, NodePosition> | undefined;

    for (let i = 0; i < evolution.states.length; i++) {
        const st = evolution.states[i];
        const positions = computeLayout(st, prevPositions);
        prevPositions = positions;

        const posArray: Array<[number, { x: number; y: number }]> = [];
        positions.forEach((pos, id) => {
            posArray.push([id, pos]);
        });
        allPosArrays.push(posArray);
    }

    // Get the final state analysis
    const finalState = evolution.states[evolution.states.length - 1];
    const analysis = analyzeState(finalState);

    (self as unknown as Worker).postMessage({
        type: 'result',
        states: evolution.states,
        allPositions: allPosArrays,
        nodeCount: analysis.nodeCount,
        edgeCount: analysis.edgeCount,
        allBinary: analysis.allBinary,
        truncated: evolution.truncated,
        haltedAtStep: evolution.haltedAtStep,
        step: evolution.states.length - 1,
    } as WorkerResponse);
};
