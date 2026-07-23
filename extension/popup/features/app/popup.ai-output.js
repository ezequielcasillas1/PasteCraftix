/** @forward-slice Thin AI task-output bridge delegates for PasteCraftPopup. */

export function emitAiTaskOutput(app, rawArtifact) {
  const bridge = app._aiOutputBridge;
  if (!bridge?.setAiTaskOutputArtifact) return null;
  return bridge.setAiTaskOutputArtifact(app, rawArtifact);
}

export function setAiTaskOutputArtifact(app, rawArtifact) {
  const bridge = app._aiOutputBridge;
  if (!bridge?.setAiTaskOutputArtifact) return null;
  return bridge.setAiTaskOutputArtifact(app, rawArtifact);
}

export function getAiTaskOutputArtifact(app) {
  const bridge = app._aiOutputBridge;
  if (!bridge?.getAiTaskOutputArtifact) return null;
  return bridge.getAiTaskOutputArtifact(app);
}

export function consumeAiTaskOutputArtifact(app) {
  const bridge = app._aiOutputBridge;
  if (!bridge?.consumeAiTaskOutputArtifact) return null;
  return bridge.consumeAiTaskOutputArtifact(app);
}

export function clearAiTaskOutputArtifact(app) {
  const bridge = app._aiOutputBridge;
  if (!bridge?.clearAiTaskOutputArtifact) return null;
  return bridge.clearAiTaskOutputArtifact(app);
}
