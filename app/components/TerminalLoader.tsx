import React, { useEffect, useState, useRef } from 'react';

export interface ProgressEvent {
    phase: 'parsing' | 'evolving' | 'layout' | 'idle';
    step?: number;
    totalSteps?: number;
    nodes?: number;
    edges?: number;
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

    // Spinner animation
    useEffect(() => {
        if (!visible) return;
        const interval = setInterval(() => {
            setFrame((f) => (f + 1) % SPINNERS.length);
        }, 80);
        return () => clearInterval(interval);
    }, [visible]);

    // Append to log when phase/step changes
    useEffect(() => {
        if (!visible) {
            if (log.length > 0) setLog([]);
            return;
        }

        let line = '';
        const spinner = SPINNERS[frame];

        if (progress.phase === 'parsing') {
            line = `> [INIT] AST PARSE INITIATED...`;
        } else if (progress.phase === 'evolving') {
            const step = progress.step || 0;
            line = `> [EVAL] STEP ${step.toString().padStart(2, '0')} :: [V:${progress.nodes} E:${progress.edges}]`;
        } else if (progress.phase === 'layout') {
            const step = progress.step || 0;
            const total = progress.totalSteps || 0;
            line = `> [D3_F] ANNEALING... [${step}/${total}]`;
        } else {
            line = `> [SLEEP] HALT.`;
        }

        setLog((prev) => {
            const newLog = [...prev];
            // Keep last 4 lines max, but update the current line if it's the same phase
            if (newLog.length === 0) {
                newLog.push(line);
            } else {
                const last = newLog[newLog.length - 1];
                if (last.startsWith('> [EVAL]') && line.startsWith('> [EVAL]')) {
                    newLog[newLog.length - 1] = line;
                } else if (last.startsWith('> [D3_F]') && line.startsWith('> [D3_F]')) {
                    newLog[newLog.length - 1] = line;
                } else if (last !== line) {
                    newLog.push(line);
                }
            }
            return newLog.slice(-5);
        });
    }, [progress, visible, frame]);

    if (!visible) return null;

    return (
        <div className="terminal-loader" ref={scrollRef}>
            <div className="terminal-header">
                <span className="blip"></span> [SYS] CORE REWRITE ENGINE
            </div>
            <div className="terminal-body">
                {log.map((line, i) => (
                    <div key={i} className={i === log.length - 1 ? 'active-line' : 'dim-line'}>
                        {i === log.length - 1 ? `${SPINNERS[frame]} ${line.slice(2)}` : line}
                    </div>
                ))}
            </div>
        </div>
    );
}
