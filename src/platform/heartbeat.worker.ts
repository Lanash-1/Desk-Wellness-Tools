/// <reference lib="webworker" />
/**
 * Dedicated worker that ticks once per second. Browsers throttle page timers in
 * background tabs far more aggressively than worker timers, so this keeps the
 * scheduler reasonably punctual while the tab is hidden.
 */
setInterval(() => {
  (self as unknown as Worker).postMessage(Date.now());
}, 1000);
