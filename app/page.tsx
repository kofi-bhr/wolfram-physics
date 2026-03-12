'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { parseRule, parseState, isParseError } from '../lib/parser';
import Sidebar from './components/Sidebar';
import MetadataOverlay from './components/MetadataOverlay';
import TerminalLoader, { type ProgressEvent } from './components/TerminalLoader';
import ComplexityChart from './components/ComplexityChart';

// Dynamic import for Canvas to avoid SSR issues with PixiJS
const Canvas = dynamic(() => import('./components/Canvas'), { ssr: false });

const DEFAULT_RULE = '{{x,y}} -> {{x,y},{y,z}}';
const DEFAULT_INITIAL = '{{1,2}}';
const DEFAULT_STEPS = 8;

interface NodePosition {
  x: number;
  y: number;
}

export default function Home() {
  const [ruleText, setRuleText] = useState(DEFAULT_RULE);
  const [initialText, setInitialText] = useState(DEFAULT_INITIAL);
  const [steps, setSteps] = useState(DEFAULT_STEPS);

  const [showLabels, setShowLabels] = useState(false);
  const [animateSteps, setAnimateSteps] = useState(false);
  const [edgeThickness, setEdgeThickness] = useState(1.5);

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
  const [progressState, setProgressState] = useState<ProgressEvent>({ phase: 'idle' });
  const [metadataVisible, setMetadataVisible] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const [allStates, setAllStates] = useState<number[][][]>([]);
  const [allPositions, setAllPositions] = useState<Map<number, NodePosition>[]>([]);

  const workerRef = useRef<Worker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animStepRef = useRef(0);
  const isAnimatingRef = useRef(false);

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

      if (data.type === 'progress') {
        setProgressState({
          phase: data.p_type as ProgressEvent['phase'],
          step: data.step,
          totalSteps: data.totalSteps,
          nodes: data.nodeCount,
          edges: data.edgeCount
        });
        return;
      }

      if (data.type === 'result') {
        // Convert all position arrays to Maps
        const positionMaps: Map<number, NodePosition>[] = [];
        for (const posArr of data.allPositions) {
          const posMap = new Map<number, NodePosition>();
          for (const [id, pos] of posArr) {
            posMap.set(id, pos);
          }
          positionMaps.push(posMap);
        }

        const finalPosMap = positionMaps[positionMaps.length - 1] || new Map();
        const finalState = data.states[data.states.length - 1];

        setAllStates(data.states);
        setAllPositions(positionMaps);
        setTruncated(data.truncated || false);
        setHaltedAtStep(data.haltedAtStep || null);
        setComputing(false);

        // If animate is on, start step-by-step playback
        // Otherwise show final state
        setCurrentState(finalState);
        setPositions(finalPosMap);
        setNodeCount(data.nodeCount);
        setEdgeCount(data.edgeCount);
        setCurrentStep(data.step);
        setFadeIn(true);

        // Show metadata after graph settles
        setTimeout(() => setMetadataVisible(true), 600);
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
    setProgressState({ phase: 'parsing' });

    // Stop any running animation
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    isAnimatingRef.current = false;

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

  // Step animation playback
  const playAnimation = useCallback(() => {
    if (allStates.length <= 1 || allPositions.length <= 1) return;

    // Stop any existing animation
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
    }
    isAnimatingRef.current = true;
    animStepRef.current = 0;

    const playStep = () => {
      const i = animStepRef.current;
      if (i >= allStates.length || !isAnimatingRef.current) {
        isAnimatingRef.current = false;
        return;
      }

      const st = allStates[i];
      const pos = allPositions[i] || new Map();

      // Count nodes/edges for this step
      const nodeSet = new Set<number>();
      for (const rel of st) {
        for (const n of rel) nodeSet.add(n);
      }

      setCurrentState(st);
      setPositions(pos);
      setNodeCount(nodeSet.size);
      setEdgeCount(st.length);
      setCurrentStep(i);
      setMetadataVisible(true);

      animStepRef.current = i + 1;
      if (i + 1 < allStates.length) {
        animTimerRef.current = setTimeout(playStep, 800);
      } else {
        isAnimatingRef.current = false;
      }
    };

    playStep();
  }, [allStates, allPositions]);

  // Auto-start animation when animate toggle turns on and we have states
  useEffect(() => {
    if (animateSteps && allStates.length > 1 && allPositions.length > 1) {
      playAnimation();
    } else {
      // Stop animation when toggle turns off
      if (animTimerRef.current) {
        clearTimeout(animTimerRef.current);
        animTimerRef.current = null;
      }
      isAnimatingRef.current = false;
      // Show final state
      if (allStates.length > 0 && allPositions.length > 0) {
        const finalState = allStates[allStates.length - 1];
        const finalPos = allPositions[allPositions.length - 1] || new Map();
        const nodeSet = new Set<number>();
        for (const rel of finalState) {
          for (const n of rel) nodeSet.add(n);
        }
        setCurrentState(finalState);
        setPositions(finalPos);
        setNodeCount(nodeSet.size);
        setEdgeCount(finalState.length);
        setCurrentStep(allStates.length - 1);
      }
    }

    return () => {
      if (animTimerRef.current) {
        clearTimeout(animTimerRef.current);
      }
    };
  }, [animateSteps, allStates, allPositions, playAnimation]);

  const handleReplay = useCallback(() => {
    if (animateSteps && allStates.length > 1) {
      playAnimation();
    } else {
      setFadeIn(true);
      setTimeout(() => setFadeIn(false), 600);
    }
  }, [animateSteps, allStates, playAnimation]);

  return (
    <div className="app">
      <div className="mobile-blur-overlay">
        <div>
          <div style={{ fontSize: 24, marginBottom: 16 }}>{'<>'}</div>
          please use a desktop device for the best visualizer experience
        </div>
      </div>
      <div className="main-content">
        <div className="canvas-wrapper">
          <Canvas
            state={currentState}
            positions={positions}
            showLabels={showLabels}
            edgeThickness={edgeThickness}
            fadeIn={fadeIn}
            recenterTrigger={recenterTrigger}
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
        <div className="bottom-panel">
          <TerminalLoader progress={progressState} visible={computing} />
          <ComplexityChart states={allStates} />
        </div>
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
        animateSteps={animateSteps}
        onToggleAnimate={() => setAnimateSteps(v => !v)}
        edgeThickness={edgeThickness}
        onEdgeThicknessChange={setEdgeThickness}
        onReplay={handleReplay}
        onRecenter={() => setRecenterTrigger(t => t + 1)}
        ruleValid={ruleValid}
        ruleSummary={ruleSummary}
      />
    </div>
  );
}
