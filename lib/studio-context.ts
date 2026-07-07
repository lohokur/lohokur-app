'use client';

import { createContext, useContext } from 'react';

export type StudioCtx = { openSketch: (id: string) => void };

export const StudioContext = createContext<StudioCtx>({ openSketch: () => {} });
export const useStudio = () => useContext(StudioContext);
