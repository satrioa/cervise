"use client";

import { useEffect, useCallback, useRef } from "react";

export function useUnsavedGuard(isDirty: boolean, message = "Discard changes?") {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = message;
      return message;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [message]);

  // for in-app navigation confirm (used by consumer via confirm fn)
  const confirmLeave = useCallback(() => {
    if (!isDirtyRef.current) return true;
    return window.confirm(message);
  }, [message]);

  return { confirmLeave };
}
