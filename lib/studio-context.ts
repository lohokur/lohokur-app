'use client';

import { createContext, useContext } from 'react';

export type StudioCtx = {
  openSketch: (id: string) => void;
  visualise: (id: string) => void;
  openTechpack: (id: string) => void;
  openExtract: (id: string) => void;
  openPattern: (id: string) => void;
  openManufacture: (id: string) => void;
  openSample: (id: string) => void;
  setNodeImage: (id: string, image: string) => void;
  promptImage: (id: string, prompt: string) => void;
  renameGroup: (id: string, label: string) => void;
};

export const StudioContext = createContext<StudioCtx>({
  openSketch: () => {},
  visualise: () => {},
  openTechpack: () => {},
  openExtract: () => {},
  openPattern: () => {},
  openManufacture: () => {},
  openSample: () => {},
  setNodeImage: () => {},
  promptImage: () => {},
  renameGroup: () => {},
});
export const useStudio = () => useContext(StudioContext);
