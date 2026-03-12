'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { parseRule, parseState, isParseError, type ParsedRule } from '../lib/parser';
import Sidebar from './components/Sidebar';
import MetadataOverlay from './components/MetadataOverlay';

// Dynamic import for Canvas to avoid SSR issues with PixiJS
const Canvas = dynamic(() => import('./components/Canvas'), { ssr: false });

const DEFAULT_RULE = '{{x,y},{x,z}} -> {{x,z},{x,w},{y,w},{z,w}}';
const DEFAULT_INITIAL = '{{1,2},{1,3}}';
const DEFAULT_STEPS = 15;

interface NodePosition {
  x: number;
  y: number;
}

export default function Home() {
  const [ruleText, setRuleText] = useState(DEFAULT_RULE);
  const [initialText, setInitialText] = useState(DEFAULT_INITIAL);
  const [steps, setSteps] = useState(DEFAULT_STEPS);

  const [showLabels, setShowLabels] = useState(false);
  const [showHyperedgeFill, setShowHyperedgeFill] = useState(true);
  const [animateSteps, setAnimateSteps] = useState(false);

  const [ruleValid, setRuleValid] = useState(true);
  const [ruleSummary, setRuleSummary] = useState('');

  const [currentState, setCurrentState] = useState<number[][]>([]);
  const [positions, setPositions] = useState<Map<number, NodePosition>>(new Map());
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [haltedAtStep, setHaltedAtStep] = useState<number | null>(null);
  const [computing, setComputing] = useState(false);
  const [metadataVisible, setMetadataVisible] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  const [allStates, setAllStates] = useState<number[][][]>([]);

  const workerRef = useRef<Worker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize Web Worker
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/rewrite.worker.ts', import.meta.url)
    );

    worker.onmessage = (e) => {
      const data = e.data;

      if (data.type === 'error') {
        setComputing(false);
        return;
      }

      if (data.type === 'result') {
        const posMap = new Map<number, NodePosition>();
        for (const [id, pos] of data.positions) {
          posMap.set(id, pos);
        }

        setAllStates(data.states);
        setCurrentState(data.states[data.states.length - 1]);
        setPositions(posMap);
        setNodeCount(data.nodeCount);
        setEdgeCount(data.edgeCount);
        setCurrentStep(data.step);
        setTruncated(data.truncated || false);
        setHaltedAtStep(data.haltedAtStep || null);
        setComputing(false);
        setFadeIn(true);

        // Show metadata after graph settles
        setTimeout(() => setMetadataVisible(true), 600);
        // Reset fadeIn
        setTimeout(() => setFadeIn(false), 600);
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  // Validate rule on change
  useEffect(() => {
    const result = parseRule(ruleText);
    if (isParseError(result)) {
      setRuleValid(false);
      setRuleSummary('');
    } else {
      setRuleValid(true);
      setRuleSummary(result.summary);
    }
  }, [ruleText]);

  // Trigger computation
  const compute = useCallback(() => {
    if (!workerRef.current) return;

    const result = parseRule(ruleText);
    if (isParseError(result)) return;

    const initial = parseState(initialText);
    if (!initial) return;

    setMetadataVisible(false);
    setComputing(true);

    workerRef.current.postMessage({
      type: 'compute',
      ruleText,
      initialText,
      steps,
    });
  }, [ruleText, initialText, steps]);

  // Debounced computation on input change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      compute();
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [compute]);

  // Step animation
  useEffect(() => {
    if (!animateSteps || allStates.length <= 1) return;

    // Stop any existing animation
    if (animFrameRef.current) clearTimeout(animFrameRef.current);

    let stepIdx = 0;
    const playStep = () => {
      if (stepIdx >= allStates.length) return;

      // For animation, we need to recompute layout for intermediate states
      // For simplicity, show intermediate states with the positions we have
      // (full per-step layout would require worker calls)
      setCurrentState(allStates[stepIdx]);
      setCurrentStep(stepIdx);

      stepIdx++;
      if (stepIdx < allStates.length) {
        animFrameRef.current = setTimeout(playStep, 800);
      }
    };

    playStep();

    return () => {
      if (animFrameRef.current) clearTimeout(animFrameRef.current);
    };
  }, [animateSteps, allStates]);

  const handleReplay = useCallback(() => {
    setFadeIn(true);
    setTimeout(() => setFadeIn(false), 600);

    if (animateSteps && allStates.length > 1) {
      // Re-trigger animation
      setCurrentState(allStates[0]);
      setCurrentStep(0);
      // The useEffect will pick up the change
    }
  }, [animateSteps, allStates]);

  return (
    <div className="app">
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          state={currentState}
          positions={positions}
          showLabels={showLabels}
          showHyperedgeFill={showHyperedgeFill}
          fadeIn={fadeIn}
        />
        <MetadataOverlay
          step={currentStep}
          nodeCount={nodeCount}
          edgeCount={edgeCount}
          visible={metadataVisible}
          truncated={truncated}
          computing={computing}
          haltedAtStep={haltedAtStep}
        />
      </div>
      <Sidebar
        ruleText={ruleText}
        onRuleChange={setRuleText}
        initialText={initialText}
        onInitialChange={setInitialText}
        steps={steps}
        onStepsChange={setSteps}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels(v => !v)}
        showHyperedgeFill={showHyperedgeFill}
        onToggleHyperedgeFill={() => setShowHyperedgeFill(v => !v)}
        animateSteps={animateSteps}
        onToggleAnimate={() => setAnimateSteps(v => !v)}
        onReplay={handleReplay}
        ruleValid={ruleValid}
        ruleSummary={ruleSummary}
      />
    </div>
  );
}
