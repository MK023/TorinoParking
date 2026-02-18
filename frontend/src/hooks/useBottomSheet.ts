import { useCallback, useRef, useState } from "react";

export type SheetState = "closed" | "half" | "full";

interface UseBottomSheetOptions {
  closedHeight?: number;
  halfRatio?: number;
  fullRatio?: number;
  onStateChange?: (state: SheetState) => void;
}

export interface UseBottomSheetReturn {
  sheetState: SheetState;
  setSheetState: (state: SheetState) => void;
  translateY: number;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  isAnimating: boolean;
}

export function useBottomSheet(options: UseBottomSheetOptions = {}): UseBottomSheetReturn {
  const {
    closedHeight = 80,
    halfRatio = 0.5,
    fullRatio = 0.1,
    onStateChange,
  } = options;

  const [sheetState, setSheetStateInternal] = useState<SheetState>("half");
  const [translateY, setTranslateY] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const startYRef = useRef(0);
  const startTranslateRef = useRef(0);
  const isDragging = useRef(false);

  function getSnapY(state: SheetState): number {
    const vh = window.innerHeight;
    switch (state) {
      case "closed": return vh - closedHeight;
      case "half": return vh * halfRatio;
      case "full": return vh * fullRatio;
    }
  }

  const setSheetState = useCallback((state: SheetState) => {
    setIsAnimating(true);
    setTranslateY(getSnapY(state));
    setSheetStateInternal(state);
    onStateChange?.(state);
    setTimeout(() => setIsAnimating(false), 300);
  }, [closedHeight, halfRatio, fullRatio, onStateChange]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    const scrollable = target.closest(".parking-list, .detail-panel");
    if (scrollable && scrollable.scrollTop > 0) return;

    isDragging.current = true;
    startYRef.current = e.touches[0].clientY;
    startTranslateRef.current = translateY || getSnapY(sheetState);
    setIsAnimating(false);
  }, [translateY, sheetState]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const deltaY = e.touches[0].clientY - startYRef.current;
    const newY = startTranslateRef.current + deltaY;

    const minY = getSnapY("full");
    const maxY = getSnapY("closed");
    const clamped = Math.max(minY, Math.min(maxY, newY));

    setTranslateY(clamped);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const currentY = translateY;
    const snaps: { state: SheetState; y: number }[] = [
      { state: "full", y: getSnapY("full") },
      { state: "half", y: getSnapY("half") },
      { state: "closed", y: getSnapY("closed") },
    ];

    let closest = snaps[0];
    for (const snap of snaps) {
      if (Math.abs(currentY - snap.y) < Math.abs(currentY - closest.y)) {
        closest = snap;
      }
    }

    setSheetState(closest.state);
  }, [translateY, setSheetState]);

  return {
    sheetState,
    setSheetState,
    translateY: translateY || getSnapY(sheetState),
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    isAnimating,
  };
}
