import React from 'react';

interface ComplexityChartProps {
    states: number[][][];
}

export default function ComplexityChart({ states }: ComplexityChartProps) {
    if (states.length === 0) {
        return (
            <div className="chart-container">
                <div className="chart-header">time complexity (nodes & edges)</div>
                <div className="dim-line">No data</div>
            </div>
        );
    }

    const data = states.map((st, i) => {
        const nodes = new Set<number>();
        for (const rel of st) {
            for (const n of rel) nodes.add(n);
        }
        return { step: i, nodes: nodes.size, edges: st.length };
    });

    const maxNodes = Math.max(...data.map(d => d.nodes), 1);
    const maxEdges = Math.max(...data.map(d => d.edges), 1);
    const maxVal = Math.max(maxNodes, maxEdges);
    const minVal = 0;

    // SVG dimensions
    const width = 300;
    const height = 120;
    const paddingX = 10;
    const paddingY = 10;

    const drawWidth = width - paddingX * 2;
    const drawHeight = height - paddingY * 2;

    const getPoints = (key: 'nodes' | 'edges') => {
        if (data.length === 1) {
            return `${paddingX},${height - paddingY - ((data[0][key] - minVal) / (maxVal - minVal)) * drawHeight} ${width - paddingX},${height - paddingY - ((data[0][key] - minVal) / (maxVal - minVal)) * drawHeight}`;
        }
        return data.map((d, i) => {
            const x = paddingX + (i / (data.length - 1)) * drawWidth;
            const y = height - paddingY - ((d[key] - minVal) / (maxVal - minVal)) * drawHeight;
            return `${x},${y}`;
        }).join(' ');
    };

    return (
        <div className="chart-container">
            <div className="chart-header" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                time complexity (
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--navy)', marginLeft: 4 }} /> nodes &
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--meta)', marginLeft: 4 }} /> edges )
            </div>
            <div style={{ position: 'relative', width: '100%', height: '140px', display: 'flex', alignItems: 'center' }}>
                <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    {/* Grid lines */}
                    <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="var(--border)" strokeWidth="1" />
                    <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />

                    <polyline
                        points={getPoints('nodes')}
                        fill="none"
                        stroke="var(--navy)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <polyline
                        points={getPoints('edges')}
                        fill="none"
                        stroke="var(--meta)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
        </div>
    );
}
