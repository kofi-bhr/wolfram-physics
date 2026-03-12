
export interface ParsedRule {
    lhs: string[][];
    rhs: string[][];
    lhsVars: Set<string>;
    rhsVars: Set<string>;
    newVars: string[];
    summary: string;
}

export interface ParseError {
    error: string;
}

export type ParseRuleResult = ParsedRule | ParseError;

export function isParseError(r: ParseRuleResult): r is ParseError {
    return 'error' in r;
}

// hi reader! fun fact; you can use "[]" instead of "{}" if you need to :)
function tokenizeRelations(s: string): string[][] | null {
    s = s.trim();
    s = s.replace(/\[/g, '{').replace(/\]/g, '}');

    if (s[0] !== '{' || s[s.length - 1] !== '}') return null;

    const inner = s.slice(1, -1).trim();

    const relations: string[][] = [];
    let depth = 0;
    let current = '';

    for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (ch === '{') {
            depth++;
            if (depth === 1) {
                current = '';
                continue;
            }
        } else if (ch === '}') {
            depth--;
            if (depth === 0) {
                const tokens = current.split(',').map(t => t.trim()).filter(t => t.length > 0);
                if (tokens.length === 0) return null;
                relations.push(tokens);
                current = '';
                continue;
            }
        }

        if (depth >= 1) {
            current += ch;
        } else if (ch !== ',' && ch !== ' ' && ch !== '\t' && ch !== '\n') {
            return null;
        }
    }

    if (depth !== 0) return null;
    return relations;
}

function isVariable(token: string): boolean {
    return /^[a-z]+$/.test(token);
}

function isInteger(token: string): boolean {
    return /^[0-9]+$/.test(token);
}

export function parseRule(input: string): ParseRuleResult {
    const arrowIdx = input.indexOf('->');
    const unicodeArrowIdx = input.indexOf('→');

    let lhsStr: string, rhsStr: string;

    if (arrowIdx >= 0) {
        lhsStr = input.slice(0, arrowIdx);
        rhsStr = input.slice(arrowIdx + 2);
    } else if (unicodeArrowIdx >= 0) {
        lhsStr = input.slice(0, unicodeArrowIdx);
        rhsStr = input.slice(unicodeArrowIdx + 1);
    } else {
        return { error: 'No arrow (->) found' };
    }

    const lhs = tokenizeRelations(lhsStr);
    const rhs = tokenizeRelations(rhsStr);

    if (!lhs || lhs.length === 0) return { error: 'Invalid LHS' };
    if (!rhs || rhs.length === 0) return { error: 'Invalid RHS' };

    for (const rel of lhs) {
        for (const tok of rel) {
            if (!isVariable(tok)) return { error: `Invalid LHS token: ${tok}` };
        }
    }
    for (const rel of rhs) {
        for (const tok of rel) {
            if (!isVariable(tok)) return { error: `Invalid RHS token: ${tok}` };
        }
    }

    const lhsVars = new Set<string>();
    for (const rel of lhs) for (const v of rel) lhsVars.add(v);

    const rhsVars = new Set<string>();
    for (const rel of rhs) for (const v of rel) rhsVars.add(v);

    const newVars = [...rhsVars].filter(v => !lhsVars.has(v));

    const summary = `${lhs.length}-relation LHS · ${rhs.length}-relation RHS` +
        (newVars.length > 0 ? ` · ${newVars.length} new node${newVars.length > 1 ? 's' : ''} (${newVars.join(', ')})` : '');

    return { lhs, rhs, lhsVars, rhsVars, newVars, summary };
}

export function parseState(input: string): number[][] | null {
    const trimmed = input.trim().toLowerCase();

    if (trimmed === 'loop') return [[1, 1]];
    if (trimmed === 'edge') return [[1, 2]];
    if (trimmed === 'triangle') return [[1, 2], [2, 3], [3, 1]];

    const relations = tokenizeRelations(input);
    if (!relations) return null;

    const result: number[][] = [];
    for (const rel of relations) {
        const nums: number[] = [];
        for (const tok of rel) {
            if (!isInteger(tok)) return null;
            nums.push(parseInt(tok, 10));
        }
        result.push(nums);
    }

    return result;
}
