/**
 * Spatial Focus Controller
 *
 * Manages camera state stack for auto-zoom to findings and restore view.
 * Principles:
 * - Auto-focus is assistance, not control hijacking
 * - User can always cancel by manual pan/zoom
 * - Every auto-focus has clear restore path
 * - Multiple focuses managed by stack, not overwriting
 */

export interface CameraState {
  center: [number, number]; // [x, y] in image coordinates
  zoom: number; // zoom level (1 = fit to container)
  focusedFindingId: string | null;
}

export interface FindingAnchor {
  findingId: string;
  bbox: [number, number, number, number]; // [x, y, width, height] in pixels
  label: string;
  confidence: number;
}

export class SpatialFocusController {
  private stateStack: CameraState[] = [];
  private currentState: CameraState;
  private restoreTimer: NodeJS.Timeout | null = null;
  private onStateChange: (state: CameraState) => void;
  private onUserInteraction: () => void;

  constructor(
    initialState: CameraState,
    onStateChange: (state: CameraState) => void,
    onUserInteraction: () => void
  ) {
    this.currentState = initialState;
    this.onStateChange = onStateChange;
    this.onUserInteraction = onUserInteraction;
  }

  /**
   * Get current camera state
   */
  getCurrentState(): CameraState {
    return { ...this.currentState };
  }

  /**
   * Focus on a finding with auto-zoom
   * @param findingId - ID of the finding to focus
   * @param bbox - Bounding box [x, y, width, height]
   * @param ttlMs - Time to live before auto-restore (default: 5000ms)
   */
  focusFinding(findingId: string, bbox: [number, number, number, number], ttlMs: number = 5000): void {
    // Cancel any pending restore
    if (this.restoreTimer) {
      clearTimeout(this.restoreTimer);
      this.restoreTimer = null;
    }

    // Push current state to stack
    this.pushState(this.currentState);

    // Calculate center and zoom for bbox
    const [x, y, width, height] = bbox;
    const center: [number, number] = [x + width / 2, y + height / 2];

    // Zoom to fit bbox with some padding (1.5x the bbox size)
    const targetZoom = Math.min(
      1280 / (width * 1.5),
      1280 / (height * 1.5)
    );

    // Update state
    const newState: CameraState = {
      center,
      zoom: Math.max(1, Math.min(targetZoom, 4)), // Clamp between 1x and 4x
      focusedFindingId: findingId,
    };

    this.currentState = newState;
    this.onStateChange(newState);

    // Schedule auto-restore if TTL specified
    if (ttlMs > 0) {
      this.restoreTimer = setTimeout(() => {
        this.restoreView('previous');
      }, ttlMs);
    }
  }

  /**
   * Restore view to previous state or default
   * @param target - 'previous' to pop from stack, 'default' to reset to initial
   */
  restoreView(target: 'previous' | 'default' = 'previous'): void {
    // Cancel any pending restore
    if (this.restoreTimer) {
      clearTimeout(this.restoreTimer);
      this.restoreTimer = null;
    }

    if (target === 'previous') {
      const previousState = this.popState();
      if (previousState) {
        this.currentState = previousState;
        this.onStateChange(previousState);
      }
    } else {
      // Reset to default (fit to container, centered)
      const defaultState: CameraState = {
        center: [640, 640], // Center of 1280x1280 image
        zoom: 1,
        focusedFindingId: null,
      };
      this.stateStack = []; // Clear stack
      this.currentState = defaultState;
      this.onStateChange(defaultState);
    }
  }

  /**
   * User manually changed camera (pan/zoom)
   * This cancels any auto-restore and clears focus
   */
  handleUserInteraction(newState: Partial<CameraState>): void {
    // Cancel auto-restore
    if (this.restoreTimer) {
      clearTimeout(this.restoreTimer);
      this.restoreTimer = null;
    }

    // Update state
    this.currentState = {
      ...this.currentState,
      ...newState,
      focusedFindingId: null, // Clear focus on manual interaction
    };

    // Clear stack since user took control
    this.stateStack = [];

    this.onStateChange(this.currentState);
    this.onUserInteraction();
  }

  /**
   * Push state to stack
   */
  private pushState(state: CameraState): void {
    // Limit stack size to prevent memory issues
    if (this.stateStack.length >= 10) {
      this.stateStack.shift(); // Remove oldest
    }
    this.stateStack.push({ ...state });
  }

  /**
   * Pop state from stack
   */
  private popState(): CameraState | null {
    return this.stateStack.pop() || null;
  }

  /**
   * Check if currently focused on a finding
   */
  isFocused(): boolean {
    return this.currentState.focusedFindingId !== null;
  }

  /**
   * Get currently focused finding ID
   */
  getFocusedFindingId(): string | null {
    return this.currentState.focusedFindingId;
  }

  /**
   * Clear focus without restoring view
   */
  clearFocus(): void {
    if (this.restoreTimer) {
      clearTimeout(this.restoreTimer);
      this.restoreTimer = null;
    }
    this.currentState.focusedFindingId = null;
    this.onStateChange(this.currentState);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.restoreTimer) {
      clearTimeout(this.restoreTimer);
      this.restoreTimer = null;
    }
    this.stateStack = [];
  }
}

/**
 * React hook for using SpatialFocusController
 */
import { useRef, useEffect, useState, useCallback } from 'react';

export function useSpatialFocus(initialState?: CameraState) {
  const [cameraState, setCameraState] = useState<CameraState>(
    initialState || {
      center: [640, 640],
      zoom: 1,
      focusedFindingId: null,
    }
  );

  const [userInteracting, setUserInteracting] = useState(false);

  const controllerRef = useRef<SpatialFocusController | null>(null);

  // Initialize controller
  useEffect(() => {
    controllerRef.current = new SpatialFocusController(
      cameraState,
      (newState) => setCameraState(newState),
      () => setUserInteracting(true)
    );

    return () => {
      controllerRef.current?.destroy();
    };
  }, []); // Only initialize once

  const focusFinding = useCallback(
    (findingId: string, bbox: [number, number, number, number], ttlMs?: number) => {
      controllerRef.current?.focusFinding(findingId, bbox, ttlMs);
    },
    []
  );

  const restoreView = useCallback((target?: 'previous' | 'default') => {
    controllerRef.current?.restoreView(target);
  }, []);

  const handleUserInteraction = useCallback((newState: Partial<CameraState>) => {
    controllerRef.current?.handleUserInteraction(newState);
  }, []);

  const clearFocus = useCallback(() => {
    controllerRef.current?.clearFocus();
  }, []);

  return {
    cameraState,
    focusFinding,
    restoreView,
    handleUserInteraction,
    clearFocus,
    isFocused: controllerRef.current?.isFocused() || false,
    focusedFindingId: cameraState.focusedFindingId,
    userInteracting,
  };
}
