'use client';

import { createContext, useContext } from 'react';

export type StudioCtx = {
  openSketch: (id: string) => void;
  visualise: (id: string) => void;
};

export const StudioContext = createContext<StudioCtx>({
  openSketch: () => {},
  visualise: () => {},
});
export const useStudio = () => useContext(StudioContext);
