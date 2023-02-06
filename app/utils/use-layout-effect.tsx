import React from "react";
import { DependencyList, EffectCallback } from "react";

export function useLayoutEffect(effect: EffectCallback, deps: DependencyList | undefined) {
  const isClient = typeof window !== 'undefined';
  return isClient ? React.useLayoutEffect(effect, deps) : React.useEffect(effect, deps);
}