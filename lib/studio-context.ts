'use client';

import { createContext, useContext } from 'react';
import type { View } from '@/lib/nodeTypes';

export type StudioCtx = {
  openSketch: (id: string, view?: View) => void;
  visualise: (id: string) => void;
  openTechpack: (id: string) => void;
  openExtract: (id: string) => void;
  openPattern: (id: string) => void;
  openManufacture: (id: string) => void;
  openRetailer: (id: string) => void;
  openSample: (id: string) => void;
  setNodeImage: (id: string, image: string) => void;
  promptImage: (id: string, prompt: string) => void;
  renameGroup: (id: string, label: string) => void;
  setNoteText: (id: string, text: string) => void;
};

export const StudioContext = createContext<StudioCtx>({
  openSketch: () => {},
  visualise: () => {},
  openTechpack: () => {},
  openExtract: () => {},
  openPattern: () => {},
  openManufacture: () => {},
  openRetailer: () => {},
  openSample: () => {},
  setNodeImage: () => {},
  promptImage: () => {},
  renameGroup: () => {},
  setNoteText: () => {},
});
export const useStudio = () => useContext(StudioContext);
