import React, { useEffect, useState, useRef } from 'react';

export interface ProgressEvent {
    phase: 'parsing' | 'evolving' | 'layout' | 'idle';
    step?: number;
    totalSteps?: number;
    nodes?: number;
    edges?: number;
    mathString?: string;
}

interface TerminalLoaderProps {
    progress: ProgressEvent;
    visible: boolean;
}

const SPINNERS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export default function TerminalLoader({ progress, visible }: TerminalLoaderProps) {
    const [frame, setFrame] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [log, setLog] = useState<string[]>([]);

    useEffect(() => {
        if (!visible) return;
        const interval = setInterval(() => {
            setFrame((f) => (f + 1) % SPINNERS.length);
        }, 80);
        return () => clearInterval(interval);
    }, [visible]);

    useEffect(() => {
        if (!visible || progress.phase === 'idle') {
            return;
        }

        let line = '';

        if (progress.phase === 'parsing') {
            line = `parsing rule: ${progress.mathString || ''}`;
        } else if (progress.phase === 'evolving') {
            line = `${progress.mathString || ''}`;
        } else if (progress.phase === 'layout') {
            const step = progress.step || 0;
            const total = progress.totalSteps || 0;
            line = `d3-force layout annealing step ${step} of ${total} ...`;
        } else {
            line = `halted...`;
        }

        setLog((prev) => {
            const newLog = [...prev];
            if (newLog.length === 0) {
                newLog.push(line);
            } else {
                const last = newLog[newLog.length - 1];
                if (last.startsWith('d3-force layout') && line.startsWith('d3-force layout')) {
                    newLog[newLog.length - 1] = line;
                } else if (last !== line) {
                    newLog.push(line);
                }
            }
            return newLog.slice(-50);
        });
    }, [progress, visible, frame]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [log]);

    return (
        <div className="terminal-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--bg)' }}>
            <div className="terminal-header" style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 5, padding: '16px 16px 8px 16px', borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
                calculation steps
            </div>
            <div className="terminal-loader" ref={scrollRef} style={{ flex: 1, padding: '8px 16px 16px 16px', overflowY: 'auto' }}>
                <div className="terminal-body" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {log.length === 0 && <div className="dim-line">ready...</div>}
                    {log.map((line, i) => {
                        const isActive = visible && i === log.length - 1;
                        return (
                            <div key={i} className={isActive ? 'active-line' : 'dim-line'} style={{ wordBreak: 'break-all' }}>
                                {isActive ? `${SPINNERS[frame]} ${line}` : line}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
