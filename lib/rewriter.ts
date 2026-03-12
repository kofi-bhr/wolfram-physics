
import type { ParsedRule } from './parser';

export type State = number[][];

export interface MatchResult {
    binding: Record<string, number>;
    indices: number[];
}

export interface StepResult {
    state: State;
    nextId: number;
}

export interface EvolutionResult {
    states: State[];
    nextId: number;
    truncated: boolean;
    haltedAtStep: number | null;
}


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

// if you know something better than a greedy left-to-right, please open an issue!
export function findMatches(lhs: string[][], state: State): MatchResult[] {
    const n = lhs.length;
    const used = new Set<number>();
    const matches: MatchResult[] = [];

    if (n === 1) {
        for (let i = 0; i < state.length; i++) {
            if (used.has(i)) continue;

            const binding = tryMatch(lhs, [state[i]]);
            if (binding) {
                used.add(i);
                matches.push({ binding, indices: [i] });
            }
        }
    } else if (n === 2) {
        for (let i = 0; i < state.length; i++) {
            if (used.has(i)) continue;
            for (let j = 0; j < state.length; j++) {
                if (i === j || used.has(j)) continue;

                const binding = tryMatch(lhs, [state[i], state[j]]);
                if (binding) {
                    used.add(i);
                    used.add(j);
                    matches.push({ binding, indices: [i, j] });
                    break;
                }
            }
        }
    } else {
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

        if (currentIndices.length === 0 && matches.length > 0) {
        }
    }
}

export function applyStep(rule: ParsedRule, state: State, nextId: number): StepResult {
    const matches = findMatches(rule.lhs, state);

    if (matches.length === 0) {
        return { state: [...state], nextId };
    }

    const usedIndices = new Set<number>();
    for (const match of matches) {
        for (const idx of match.indices) {
            usedIndices.add(idx);
        }
    }

    const newState: State = [];

    for (let i = 0; i < state.length; i++) {
        if (!usedIndices.has(i)) {
            newState.push(state[i]);
        }
    }

    for (const match of matches) {
        const extendedBinding = { ...match.binding };
        for (const v of rule.newVars) {
            extendedBinding[v] = nextId++;
        }

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

export function evolve(
    rule: ParsedRule,
    initial: State,
    steps: number,
    maxNodes: number = 50000,
    onProgress?: (step: number, nodes: number, edges: number, currentState: State) => void
): EvolutionResult {
    const states: State[] = [initial];

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


        if (result.nextId === nextId && result.state.length === current.length) {
            haltedAtStep = step;
            states.push(result.state);
            break;
        }

        nextId = result.nextId;
        current = result.state;

        const uniqueNodes = new Set<number>();
        for (const rel of current) {
            for (const n of rel) uniqueNodes.add(n);
        }

        if (onProgress) {
            onProgress(step, uniqueNodes.size, current.length, current);
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
