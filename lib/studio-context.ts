'use client';

import { createContext, useContext } from 'react';
import type { View } from '@/lib/nodeTypes';

export type StudioCtx = {
  openSketch: (id: string, view?: View) => void;
  visualise: (id: string, onlyView?: View) => void;
  openTechpack: (id: string) => void;
  shareTechpack: (id: string) => void;
  openExtract: (id: string) => void;
  openPattern: (id: string) => void;
  openManufacture: (id: string) => void;
  openRetailer: (id: string) => void;
  openSample: (id: string) => void;
  openShip: (id: string) => void;
  setNodeImage: (id: string, image: string) => void;
  promptImage: (id: string, prompt: string) => void;
  renameGroup: (id: string, label: string) => void;
  setNoteText: (id: string, text: string) => void;
  sideLocked: boolean; // free plan: side/back views are paid → show a blurred paywall
};

export const StudioContext = createContext<StudioCtx>({
  openSketch: () => {},
  visualise: () => {},
  openTechpack: () => {},
  shareTechpack: () => {},
  openExtract: () => {},
  openPattern: () => {},
  openManufacture: () => {},
  openRetailer: () => {},
  openSample: () => {},
  openShip: () => {},
  setNodeImage: () => {},
  promptImage: () => {},
  renameGroup: () => {},
  setNoteText: () => {},
  sideLocked: false,
});
export const useStudio = () => useContext(StudioContext);
