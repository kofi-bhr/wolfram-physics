// ─── Rewrite Web Worker ───
// Runs rewriting computation + layout off the main thread.

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
    type: 'result' | 'progress' | 'error';
    states?: number[][][];
    positions?: Array<[number, { x: number; y: number }]>;
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

    // Get the final state for analysis and layout
    const finalState = evolution.states[evolution.states.length - 1];
    const analysis = analyzeState(finalState);

    // Compute layout
    const positions = computeLayout(finalState);

    // Send result
    const posArray: Array<[number, { x: number; y: number }]> = [];
    positions.forEach((pos, id) => {
        posArray.push([id, pos]);
    });

    (self as unknown as Worker).postMessage({
        type: 'result',
        states: evolution.states,
        positions: posArray,
        nodeCount: analysis.nodeCount,
        edgeCount: analysis.edgeCount,
        allBinary: analysis.allBinary,
        truncated: evolution.truncated,
        haltedAtStep: evolution.haltedAtStep,
        step: evolution.states.length - 1,
    } as WorkerResponse);
};
