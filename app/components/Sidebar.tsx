'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface SidebarProps {
    ruleText: string;
    onRuleChange: (v: string) => void;
    initialText: string;
    onInitialChange: (v: string) => void;
    steps: number;
    onStepsChange: (v: number) => void;
    showLabels: boolean;
    onToggleLabels: () => void;
    animateSteps: boolean;
    onToggleAnimate: () => void;
    edgeThickness: number;
    onEdgeThicknessChange: (v: number) => void;
    onReplay: () => void;
    onRecenter: () => void;
    ruleValid: boolean;
    ruleSummary: string;
}

function SidebarContent(props: SidebarProps) {
    const {
        ruleText, onRuleChange,
        initialText, onInitialChange,
        steps, onStepsChange,
        showLabels, onToggleLabels,
        animateSteps, onToggleAnimate,
        edgeThickness, onEdgeThicknessChange,
        onReplay, onRecenter,
        ruleValid, ruleSummary,
    } = props;

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-expand textarea
    const autoResize = useCallback(() => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto';
            const lineH = 18;
            const minRows = 2;
            const maxRows = 6;
            const contentLines = Math.ceil(ta.scrollHeight / lineH);
            const rows = Math.min(maxRows, Math.max(minRows, contentLines));
            ta.style.height = `${rows * lineH}px`;
        }
    }, []);

    useEffect(() => { autoResize(); }, [ruleText, autoResize]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            (e.target as HTMLElement).blur();
        }
    };

    return (
        <>
            <div className="sidebar-section">
                <div className="section-label">Rule</div>
                <textarea
                    ref={textareaRef}
                    className="rule-textarea"
                    value={ruleText}
                    onChange={e => { onRuleChange(e.target.value); autoResize(); }}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    spellCheck={false}
                />
                <div className="rule-info">
                    <div className={`validity-dot ${ruleValid ? 'valid' : 'invalid'}`} />
                    {ruleValid && ruleSummary && (
                        <span className="rule-summary">{ruleSummary}</span>
                    )}
                </div>
            </div>

            <div className="sidebar-section">
                <div className="section-label">Parameters</div>
                <div className="param-row">
                    <span className="param-label">steps</span>
                    <div className="step-control">
                        <button
                            className="step-btn"
                            onClick={() => onStepsChange(Math.max(1, steps - 1))}
                        >
                            –
                        </button>
                        <input
                            type="number"
                            className="step-input"
                            value={steps}
                            min={1}
                            max={50}
                            onChange={e => {
                                const v = parseInt(e.target.value, 10);
                                if (!isNaN(v) && v >= 1 && v <= 50) onStepsChange(v);
                            }}
                            onKeyDown={handleKeyDown}
                        />
                        <button
                            className="step-btn"
                            onClick={() => onStepsChange(Math.min(50, steps + 1))}
                        >
                            +
                        </button>
                    </div>
                </div>
                <div className="param-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                    <span className="param-label">initial</span>
                    <input
                        type="text"
                        className="init-input"
                        value={initialText}
                        onChange={e => onInitialChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        spellCheck={false}
                    />
                </div>
            </div>

            <div className="sidebar-section">
                <div className="section-label">Display</div>

                <div className="toggle-row">
                    <span className="toggle-label">node labels</span>
                    <div className={`toggle-pill ${showLabels ? 'on' : ''}`} onClick={onToggleLabels}>
                        <div className="toggle-knob" />
                    </div>
                </div>

                <div className="toggle-row">
                    <span className="toggle-label">animate steps</span>
                    <div className={`toggle-pill ${animateSteps ? 'on' : ''}`} onClick={onToggleAnimate}>
                        <div className="toggle-knob" />
                    </div>
                </div>

                <div className="toggle-row" style={{ marginTop: 4 }}>
                    <span className="toggle-label">edge thickness</span>
                    <div className="step-control">
                        <button
                            className="step-btn"
                            onClick={() => onEdgeThicknessChange(Math.max(0.5, +(edgeThickness - 0.5).toFixed(1)))}
                        >
                            –
                        </button>
                        <span style={{ fontSize: 11, minWidth: 24, textAlign: 'center' }}>{edgeThickness}</span>
                        <button
                            className="step-btn"
                            onClick={() => onEdgeThicknessChange(Math.min(5, +(edgeThickness + 0.5).toFixed(1)))}
                        >
                            +
                        </button>
                    </div>
                </div>

                <div className="btn-row">
                    <button className="square-btn primary" onClick={onReplay}>
                        render
                    </button>
                    <button className="square-btn" onClick={onRecenter}>
                        center
                    </button>
                </div>
            </div>

            <div className="sidebar-footer">
                by kofi :)
            </div>
        </>
    );
}

export default function Sidebar(props: SidebarProps) {
    const [drawerExpanded, setDrawerExpanded] = useState(false);

    return (
        <>
            <aside className="sidebar">
                <SidebarContent {...props} />
            </aside>

            <div className={`drawer ${drawerExpanded ? 'expanded' : 'collapsed'}`}>
                <div className="drawer-handle" onClick={() => setDrawerExpanded(!drawerExpanded)}>
                    <div className="drawer-pill" />
                </div>
                <div className="drawer-content">
                    <SidebarContent {...props} />
                </div>
            </div>
        </>
    );
}
