'use client';

import { createContext, useContext } from 'react';

export type StudioCtx = {
  openSketch: (id: string) => void;
  visualise: (id: string) => void;
  openTechpack: (id: string) => void;
  setNodeImage: (id: string, image: string) => void;
};

export const StudioContext = createContext<StudioCtx>({
  openSketch: () => {},
  visualise: () => {},
  openTechpack: () => {},
  setNodeImage: () => {},
});
export const useStudio = () => useContext(StudioContext);
