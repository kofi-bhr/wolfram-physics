'use client';

interface MetadataOverlayProps {
    step: number;
    nodeCount: number;
    edgeCount: number;
    visible: boolean;
    truncated?: boolean;
    computing?: boolean;
    haltedAtStep?: number | null;
}

export default function MetadataOverlay({
    step,
    nodeCount,
    edgeCount,
    visible,
    truncated,
    computing,
    haltedAtStep,
}: MetadataOverlayProps) {
    let text = `step ${step}  ·  ${nodeCount.toLocaleString()} nodes  ·  ${edgeCount.toLocaleString()} edges`;
    if (truncated) text += '  · truncated (hint: toggle "bypass limits")';
    if (haltedAtStep !== null && haltedAtStep !== undefined) {
        text += `  · no matches at step ${haltedAtStep}`;
    }
    if (computing) text += '  · computing...';

    return (
        <div className={`metadata-overlay ${visible ? 'visible' : ''}`}>
            {text}
        </div>
    );
}
