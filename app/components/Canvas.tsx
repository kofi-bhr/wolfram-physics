'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js';

interface NodePosition {
    x: number;
    y: number;
}

interface CanvasProps {
    state: number[][];
    positions: Map<number, NodePosition>;
    showLabels: boolean;
    showHyperedgeFill: boolean;
    edgeThickness: number;
    fadeIn?: boolean;
    recenterTrigger?: number;
}

export default function Canvas({
    state,
    positions,
    showLabels,
    showHyperedgeFill,
    edgeThickness,
    fadeIn = false,
    recenterTrigger = 0,
}: CanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const graphContainerRef = useRef<Container | null>(null);
    const isPanningRef = useRef(false);
    const lastPointerRef = useRef({ x: 0, y: 0 });
    const scaleRef = useRef(1);
    const offsetRef = useRef({ x: 0, y: 0 });
    const mountedRef = useRef(false);

    // Initialize PixiJS
    useEffect(() => {
        if (!containerRef.current || mountedRef.current) return;
        mountedRef.current = true;

        const initPixi = async () => {
            const app = new Application();
            await app.init({
                resizeTo: containerRef.current!,
                backgroundAlpha: 0,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
            });

            containerRef.current!.appendChild(app.canvas as HTMLCanvasElement);
            appRef.current = app;

            const graphContainer = new Container();
            app.stage.addChild(graphContainer);
            graphContainerRef.current = graphContainer;

            // Set initial offset to center
            const w = app.screen.width;
            const h = app.screen.height;
            offsetRef.current = { x: w / 2, y: h / 2 };
            graphContainer.x = w / 2;
            graphContainer.y = h / 2;
        };

        initPixi();

        return () => {
            if (appRef.current) {
                appRef.current.destroy(true);
                appRef.current = null;
                mountedRef.current = false;
            }
        };
    }, []);

    // Pan/zoom handlers
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const onPointerDown = (e: PointerEvent) => {
            isPanningRef.current = true;
            lastPointerRef.current = { x: e.clientX, y: e.clientY };
            el.style.cursor = 'grabbing';
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!isPanningRef.current || !graphContainerRef.current) return;
            const dx = e.clientX - lastPointerRef.current.x;
            const dy = e.clientY - lastPointerRef.current.y;
            lastPointerRef.current = { x: e.clientX, y: e.clientY };

            offsetRef.current.x += dx;
            offsetRef.current.y += dy;
            graphContainerRef.current.x = offsetRef.current.x;
            graphContainerRef.current.y = offsetRef.current.y;
        };

        const onPointerUp = () => {
            isPanningRef.current = false;
            el.style.cursor = 'default';
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (!graphContainerRef.current) return;

            const rect = el.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const oldScale = scaleRef.current;
            const factor = e.deltaY > 0 ? 0.92 : 1.08;
            const newScale = Math.min(8, Math.max(0.05, oldScale * factor));

            // Zoom toward mouse position
            const ratio = newScale / oldScale;
            offsetRef.current.x = mouseX - (mouseX - offsetRef.current.x) * ratio;
            offsetRef.current.y = mouseY - (mouseY - offsetRef.current.y) * ratio;

            scaleRef.current = newScale;
            graphContainerRef.current.scale.set(newScale);
            graphContainerRef.current.x = offsetRef.current.x;
            graphContainerRef.current.y = offsetRef.current.y;
        };

        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('pointermove', onPointerMove);
        el.addEventListener('pointerup', onPointerUp);
        el.addEventListener('pointerleave', onPointerUp);
        el.addEventListener('wheel', onWheel, { passive: false });

        return () => {
            el.removeEventListener('pointerdown', onPointerDown);
            el.removeEventListener('pointermove', onPointerMove);
            el.removeEventListener('pointerup', onPointerUp);
            el.removeEventListener('pointerleave', onPointerUp);
            el.removeEventListener('wheel', onWheel);
        };
    }, []);

    // Handle recenter trigger
    useEffect(() => {
        if (recenterTrigger > 0 && appRef.current && graphContainerRef.current) {
            const w = appRef.current.screen.width;
            const h = appRef.current.screen.height;

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            positions.forEach(pos => {
                if (pos.x < minX) minX = pos.x;
                if (pos.x > maxX) maxX = pos.x;
                if (pos.y < minY) minY = pos.y;
                if (pos.y > maxY) maxY = pos.y;
            });

            if (minX === Infinity) {
                minX = 0; minY = 0; maxX = 0; maxY = 0;
            }

            const graphWidth = Math.max(maxX - minX, 100);
            const graphHeight = Math.max(maxY - minY, 100);

            const padding = 100;
            const scaleX = w / (graphWidth + padding);
            const scaleY = h / (graphHeight + padding);
            const targetScale = Math.min(scaleX, scaleY, 2);

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            const targetX = w / 2 - centerX * targetScale;
            const targetY = h / 2 - centerY * targetScale;

            offsetRef.current = { x: targetX, y: targetY };
            scaleRef.current = targetScale;

            graphContainerRef.current.x = targetX;
            graphContainerRef.current.y = targetY;
            graphContainerRef.current.scale.set(targetScale);
        }
    }, [recenterTrigger, positions]);

    // Render graph
    const renderGraph = useCallback(() => {
        const gc = graphContainerRef.current;
        if (!gc || !appRef.current) return;

        // Clear previous
        gc.removeChildren();

        if (state.length === 0 || positions.size === 0) return;

        const allBinary = state.every(r => r.length === 2);
        const navy = 0x1a2a4a;
        const nodeRadius = 4;
        const strokeWidth = edgeThickness;
        const edgeAlpha = Math.min(0.9, 0.4 + edgeThickness * 0.15);

        // ─── Hyperedge fills (underneath everything) ───
        if (showHyperedgeFill && !allBinary) {
            const hyperGfx = new Graphics();
            for (const rel of state) {
                if (rel.length < 3) continue;

                const pts: { x: number; y: number }[] = [];
                let allFound = true;
                for (const n of rel) {
                    const pos = positions.get(n);
                    if (!pos) { allFound = false; break; }
                    pts.push(pos);
                }
                if (!allFound || pts.length < 3) continue;

                hyperGfx.poly(pts.flatMap(p => [p.x, p.y]));
                hyperGfx.fill({ color: navy, alpha: 0.08 });
            }
            gc.addChild(hyperGfx);
        }

        // ─── Edges ───
        // In PixiJS v8, we draw each edge as its own Graphics object for straight lines,
        // or batch them into groups. The key insight: each moveTo/lineTo/stroke cycle
        // creates one stroked path segment properly.

        // Track parallel edges for curvature offset
        const edgeCounts = new Map<string, number>();

        // Batch all straight edges into one Graphics
        const straightGfx = new Graphics();
        // Separate Graphics for curved edges
        const curvedGfx = new Graphics();
        // Separate Graphics for self-loops
        const loopGfx = new Graphics();
        // Arrowheads drawn as filled triangles
        const arrowGfx = new Graphics();

        for (const rel of state) {
            // Draw directed edges for consecutive pairs
            for (let i = 0; i < rel.length - 1; i++) {
                const a = rel[i];
                const b = rel[i + 1];
                const posA = positions.get(a);
                const posB = positions.get(b);
                if (!posA || !posB) continue;

                if (a === b) {
                    // Self-loop
                    const loopR = 12;
                    loopGfx.circle(posA.x + loopR, posA.y - loopR, loopR);
                    loopGfx.stroke({ color: navy, width: strokeWidth, alpha: edgeAlpha });
                    drawArrowhead(arrowGfx, posA.x + 2, posA.y - 1, posA.x, posA.y, navy, edgeAlpha, strokeWidth);
                    continue;
                }

                // Determine curve offset for parallel edges
                const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
                const count = edgeCounts.get(key) || 0;
                edgeCounts.set(key, count + 1);

                const dx = posB.x - posA.x;
                const dy = posB.y - posA.y;
                const len = Math.sqrt(dx * dx + dy * dy);

                if (count === 0) {
                    // Straight line — accumulate in one path, stroke once later
                    straightGfx.moveTo(posA.x, posA.y);
                    straightGfx.lineTo(posB.x, posB.y);
                    drawArrowhead(arrowGfx, posA.x, posA.y, posB.x, posB.y, navy, edgeAlpha, strokeWidth);
                } else {
                    // Curved line with offset
                    const perpX = -dy / len * count * 10;
                    const perpY = dx / len * count * 10;
                    const midX = (posA.x + posB.x) / 2 + perpX;
                    const midY = (posA.y + posB.y) / 2 + perpY;

                    curvedGfx.moveTo(posA.x, posA.y);
                    curvedGfx.quadraticCurveTo(midX, midY, posB.x, posB.y);
                    curvedGfx.stroke({ color: navy, width: strokeWidth, alpha: edgeAlpha });
                    drawArrowhead(arrowGfx, midX, midY, posB.x, posB.y, navy, edgeAlpha, strokeWidth);
                }
            }
        }

        // Single stroke call for all straight edges — most efficient
        straightGfx.stroke({ color: navy, width: strokeWidth, alpha: edgeAlpha });

        gc.addChild(straightGfx);
        gc.addChild(curvedGfx);
        gc.addChild(loopGfx);
        gc.addChild(arrowGfx);

        // ─── Nodes ───
        const nodeGfx = new Graphics();
        for (const [, pos] of positions) {
            nodeGfx.circle(pos.x, pos.y, nodeRadius);
        }
        nodeGfx.fill({ color: navy });
        gc.addChild(nodeGfx);

        // ─── Labels ───
        if (showLabels) {
            for (const [id, pos] of positions) {
                const label = new Text({
                    text: String(id),
                    style: new TextStyle({
                        fontFamily: 'Geist Mono, monospace',
                        fontSize: 9,
                        fill: navy,
                    }),
                });
                label.x = pos.x + 7;
                label.y = pos.y - 12;
                gc.addChild(label);
            }
        }

        // Fade-in effect
        if (fadeIn) {
            gc.alpha = 0;
            let alpha = 0;
            const fadeInterval = setInterval(() => {
                alpha += 0.04;
                if (alpha >= 1) {
                    gc.alpha = 1;
                    clearInterval(fadeInterval);
                } else {
                    gc.alpha = alpha;
                }
            }, 16);
        }
    }, [state, positions, showLabels, showHyperedgeFill, edgeThickness, fadeIn]);

    useEffect(() => {
        // Small delay to ensure PixiJS is ready
        const timer = setTimeout(() => {
            renderGraph();
        }, 50);
        return () => clearTimeout(timer);
    }, [renderGraph]);

    // Handle resize
    useEffect(() => {
        const handleResize = () => {
            if (appRef.current && containerRef.current) {
                appRef.current.resize();
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div
            ref={containerRef}
            className="canvas-container"
            style={{
                backgroundImage: 'radial-gradient(circle, #e8e8e8 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                backgroundColor: '#ffffff'
            }}
        />
    );
}

function drawArrowhead(
    gfx: Graphics,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: number,
    alpha: number,
    thickness: number
) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    const ux = dx / len;
    const uy = dy / len;

    const arrowLen = 3 + thickness * 1.5;
    const arrowWidth = 1.5 + thickness;

    // Tip at ~4px back from target (node radius)
    const tipX = toX - ux * 5;
    const tipY = toY - uy * 5;

    const baseX = tipX - ux * arrowLen;
    const baseY = tipY - uy * arrowLen;

    gfx.poly([
        tipX, tipY,
        baseX - uy * arrowWidth, baseY + ux * arrowWidth,
        baseX + uy * arrowWidth, baseY - ux * arrowWidth,
    ]);
    gfx.fill({ color, alpha });
}
