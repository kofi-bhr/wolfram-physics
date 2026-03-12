// ─── Hypergraph Rewriting Engine ───
// Implements pattern matching and simultaneous (parallel) rewriting exactly per the PRD.

import type { ParsedRule } from './parser';

export type State = number[][];

export interface MatchResult {
    binding: Record<string, number>;
    indices: number[]; // indices of relations consumed from the state
}

export interface StepResult {
    state: State;
    nextId: number;
}

export interface EvolutionResult {
    states: State[];
    nextId: number;
    truncated: boolean;
    haltedAtStep: number | null; // step at which no matches were found
}

/**
 * Try to match a single LHS against a candidate tuple of relations from the state.
 * Returns a variable binding if successful, null otherwise.
 */
function tryMatch(
    lhs: string[][],
    candidates: number[][]
): Record<string, number> | null {
    if (lhs.length !== candidates.length) return null;

    const sigma: Record<string, number> = {};

    for (let i = 0; i < lhs.length; i++) {
        const pattern = lhs[i];
        const concrete = candidates[i];

        if (pattern.length !== concrete.length) return null;

        for (let j = 0; j < pattern.length; j++) {
            const v = pattern[j];
            const k = concrete[j];

            if (v in sigma) {
                if (sigma[v] !== k) return null;
            } else {
                sigma[v] = k;
            }
        }
    }

    return sigma;
}

/**
 * Find all non-overlapping matches (greedy left-to-right) of the LHS pattern in the state.
 */
export function findMatches(lhs: string[][], state: State): MatchResult[] {
    const n = lhs.length;
    const used = new Set<number>();
    const matches: MatchResult[] = [];

    if (n === 1) {
        // Single-relation LHS: fast path
        for (let i = 0; i < state.length; i++) {
            if (used.has(i)) continue;

            const binding = tryMatch(lhs, [state[i]]);
            if (binding) {
                used.add(i);
                matches.push({ binding, indices: [i] });
            }
        }
    } else if (n === 2) {
        // Two-relation LHS: try all ordered pairs
        for (let i = 0; i < state.length; i++) {
            if (used.has(i)) continue;
            for (let j = 0; j < state.length; j++) {
                if (i === j || used.has(j)) continue;

                const binding = tryMatch(lhs, [state[i], state[j]]);
                if (binding) {
                    used.add(i);
                    used.add(j);
                    matches.push({ binding, indices: [i, j] });
                    break; // greedy: move on with first match for i
                }
            }
        }
    } else {
        // General n-relation LHS: recursive search with backtracking
        // For performance, we do greedy matching
        findMatchesGeneral(lhs, state, used, matches, [], 0);
    }

    return matches;
}

function findMatchesGeneral(
    lhs: string[][],
    state: State,
    used: Set<number>,
    matches: MatchResult[],
    currentIndices: number[],
    depth: number
): void {
    if (depth === lhs.length) {
        // Try to match
        const candidates = currentIndices.map(i => state[i]);
        const binding = tryMatch(lhs, candidates);
        if (binding) {
            for (const idx of currentIndices) used.add(idx);
            matches.push({ binding, indices: [...currentIndices] });
        }
        return;
    }

    for (let i = 0; i < state.length; i++) {
        if (used.has(i)) continue;
        if (currentIndices.includes(i)) continue;

        currentIndices.push(i);
        findMatchesGeneral(lhs, state, used, matches, currentIndices, depth + 1);
        currentIndices.pop();

        // If a match was found at this level, stop trying further because greedy
        if (currentIndices.length === 0 && matches.length > 0) {
            // Check if the last match used this depth
        }
    }
}

/**
 * Apply one step of simultaneous rewriting.
 */
export function applyStep(rule: ParsedRule, state: State, nextId: number): StepResult {
    const matches = findMatches(rule.lhs, state);

    if (matches.length === 0) {
        // No matches: state becomes empty per total rewriting (all unmatched relations discarded)
        // Actually per the PRD: "Relations from the original state that were not part of any match are discarded"
        // But if NO relations match, the entire state is empty.
        return { state: [], nextId };
    }

    const newState: State = [];

    for (const match of matches) {
        // Allocate fresh node labels for new-node variables
        const extendedBinding = { ...match.binding };
        for (const v of rule.newVars) {
            extendedBinding[v] = nextId++;
        }

        // Construct output relations
        for (const rhsRelation of rule.rhs) {
            const concrete: number[] = [];
            for (const token of rhsRelation) {
                concrete.push(extendedBinding[token]);
            }
            newState.push(concrete);
        }
    }

    return { state: newState, nextId };
}

/**
 * Run full evolution from initial state for N steps.
 * Caps at maxNodes (50,000 by default).
 */
export function evolve(
    rule: ParsedRule,
    initial: State,
    steps: number,
    maxNodes: number = 50000
): EvolutionResult {
    const states: State[] = [initial];

    // Find the max node label in the initial state
    let nextId = 0;
    for (const rel of initial) {
        for (const n of rel) {
            if (n >= nextId) nextId = n + 1;
        }
    }

    let current = initial;
    let truncated = false;
    let haltedAtStep: number | null = null;

    for (let step = 1; step <= steps; step++) {
        const result = applyStep(rule, current, nextId);
        nextId = result.nextId;
        current = result.state;

        if (current.length === 0) {
            haltedAtStep = step;
            states.push(current);
            break;
        }

        // Count unique nodes
        const uniqueNodes = new Set<number>();
        for (const rel of current) {
            for (const n of rel) uniqueNodes.add(n);
        }

        if (uniqueNodes.size > maxNodes) {
            truncated = true;
            states.push(current);
            break;
        }

        states.push(current);
    }

    return { states, nextId, truncated, haltedAtStep };
}

/**
 * Extract unique node set and edge/relation info from a state.
 */
export function analyzeState(state: State): {
    nodes: Set<number>;
    nodeCount: number;
    edgeCount: number;
    allBinary: boolean;
} {
    const nodes = new Set<number>();
    let allBinary = true;

    for (const rel of state) {
        for (const n of rel) nodes.add(n);
        if (rel.length !== 2) allBinary = false;
    }

    return {
        nodes,
        nodeCount: nodes.size,
        edgeCount: state.length,
        allBinary,
    };
}
