import { create } from "zustand";

interface UIState {
  activeTab: string;
  isWalkInModalOpen: boolean;
  selectedAgentFilter: string | null;
  setActiveTab: (tab: string) => void;
  setWalkInModalOpen: (open: boolean) => void;
  setSelectedAgentFilter: (agent: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: "appointments",
  isWalkInModalOpen: false,
  selectedAgentFilter: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setWalkInModalOpen: (open) => set({ isWalkInModalOpen: open }),
  setSelectedAgentFilter: (agent) => set({ selectedAgentFilter: agent })
}));
