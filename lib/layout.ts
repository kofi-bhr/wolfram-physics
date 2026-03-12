import {
    forceSimulation,
    forceLink,
    forceManyBody,
    forceCenter,
    forceCollide,
    type SimulationNodeDatum,
    type SimulationLinkDatum,
} from 'd3-force';

import type { State } from './rewriter';

export interface NodePosition {
    x: number;
    y: number;
}

interface SimNode extends SimulationNodeDatum {
    id: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
    source: number | SimNode;
    target: number | SimNode;
}

export function computeLayout(
    state: State,
    prevPositions?: Map<number, NodePosition>,
    onProgress?: (positions: Map<number, NodePosition>) => void
): Map<number, NodePosition> {
    // Collect unique nodes
    const nodeSet = new Set<number>();
    for (const rel of state) {
        for (const n of rel) nodeSet.add(n);
    }

    const nodeCount = nodeSet.size;
    if (nodeCount === 0) return new Map();

    const linkDistance = nodeCount < 500 ? 30 : Math.max(12, 30 - (nodeCount - 500) * 0.004);
    const chargeStrength = nodeCount < 500 ? -80 : Math.max(-20, -80 + (nodeCount - 500) * 0.013);
    const nodeRadius = 4;

    const nodeArray = Array.from(nodeSet);
    const nodeMap = new Map<number, number>(); // id -> index
    const simNodes: SimNode[] = nodeArray.map((id, i) => {
        nodeMap.set(id, i);
        const prev = prevPositions?.get(id);
        return {
            id,
            x: prev?.x ?? (Math.random() - 0.5) * Math.sqrt(nodeCount) * 20,
            y: prev?.y ?? (Math.random() - 0.5) * Math.sqrt(nodeCount) * 20,
        };
    });

    const links: SimLink[] = [];
    const linkSet = new Set<string>();

    for (const rel of state) {
        for (let i = 0; i < rel.length - 1; i++) {
            const a = rel[i];
            const b = rel[i + 1];
            if (a === b) continue;

            const key = `${a}-${b}`;
            if (!linkSet.has(key)) {
                linkSet.add(key);
                links.push({ source: nodeMap.get(a)!, target: nodeMap.get(b)! });
            }
        }

        // THE BANE OF MY EXISTENCE OH MY GOD DO NOT DELETE THIS OMFG >:(
        if (rel.length >= 3 && rel[0] !== rel[rel.length - 1]) {
            const a = rel[0];
            const b = rel[rel.length - 1];
            const key = `${a}-${b}-close`;
            if (!linkSet.has(key)) {
                linkSet.add(key);
                links.push({ source: nodeMap.get(a)!, target: nodeMap.get(b)! });
            }
        }
    }

    const simulation = forceSimulation<SimNode>(simNodes)
        .force('link', forceLink<SimNode, SimLink>(links)
            .distance(linkDistance)
            .strength(1 / Math.min(links.length / nodeCount + 1, 4))
        )
        .force('charge', forceManyBody<SimNode>().strength(chargeStrength))
        .force('center', forceCenter(0, 0).strength(0.05))
        .force('collide', forceCollide<SimNode>(nodeRadius + 2))
        .stop();

    const maxTicks = nodeCount > 5000 ? 150 : 300;

    for (let i = 0; i < maxTicks; i++) {
        simulation.tick();

        if (onProgress && nodeCount > 5000 && i % 20 === 0) {
            const positions = new Map<number, NodePosition>();
            for (const node of simNodes) {
                positions.set(node.id, { x: node.x!, y: node.y! });
            }
            onProgress(positions);
        }

        if (simulation.alpha() < 0.001) break;
    }

    const positions = new Map<number, NodePosition>();
    for (const node of simNodes) {
        positions.set(node.id, { x: node.x!, y: node.y! });
    }

    return positions;
}
