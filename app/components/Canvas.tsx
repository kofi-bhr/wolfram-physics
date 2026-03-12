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
    fadeIn?: boolean;
}

export default function Canvas({
    state,
    positions,
    showLabels,
    showHyperedgeFill,
    fadeIn = false,
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
                background: 0xffffff,
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

        // Draw hyperedge fills first (underneath everything)
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

        // Draw edges
        const edgeGfx = new Graphics();

        // Track parallel edges for curvature offset
        const edgeCounts = new Map<string, number>();

        for (const rel of state) {
            // Draw directed edges for consecutive pairs
            const pairs: [number, number][] = [];
            for (let i = 0; i < rel.length - 1; i++) {
                pairs.push([rel[i], rel[i + 1]]);
            }

            for (const [a, b] of pairs) {
                const posA = positions.get(a);
                const posB = positions.get(b);
                if (!posA || !posB) continue;

                if (a === b) {
                    // Self-loop
                    const loopR = 12;
                    edgeGfx.circle(posA.x + loopR, posA.y - loopR, loopR);
                    edgeGfx.stroke({ color: navy, width: 1, alpha: 0.6 });
                    // Small arrowhead at bottom of loop
                    drawArrowhead(edgeGfx, posA.x + 2, posA.y - 1, posA.x, posA.y, navy);
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
                    // Straight line
                    edgeGfx.moveTo(posA.x, posA.y);
                    edgeGfx.lineTo(posB.x, posB.y);
                    edgeGfx.stroke({ color: navy, width: 1, alpha: 0.5 });
                    drawArrowhead(edgeGfx, posA.x, posA.y, posB.x, posB.y, navy);
                } else {
                    // Curved line with offset
                    const perpX = -dy / len * count * 10;
                    const perpY = dx / len * count * 10;
                    const midX = (posA.x + posB.x) / 2 + perpX;
                    const midY = (posA.y + posB.y) / 2 + perpY;

                    edgeGfx.moveTo(posA.x, posA.y);
                    edgeGfx.quadraticCurveTo(midX, midY, posB.x, posB.y);
                    edgeGfx.stroke({ color: navy, width: 1, alpha: 0.5 });
                    // Arrow at end of curve
                    drawArrowhead(edgeGfx, midX, midY, posB.x, posB.y, navy);
                }
            }
        }

        gc.addChild(edgeGfx);

        // Draw nodes
        const nodeGfx = new Graphics();
        for (const [, pos] of positions) {
            nodeGfx.circle(pos.x, pos.y, nodeRadius);
            nodeGfx.fill({ color: navy });
        }
        gc.addChild(nodeGfx);

        // Draw labels
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
    }, [state, positions, showLabels, showHyperedgeFill, fadeIn]);

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

    return <div ref={containerRef} className="canvas-container" />;
}

function drawArrowhead(
    gfx: Graphics,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: number
) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    const ux = dx / len;
    const uy = dy / len;

    const arrowLen = 5;
    const arrowWidth = 2.5;

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
    gfx.fill({ color, alpha: 0.6 });
}
