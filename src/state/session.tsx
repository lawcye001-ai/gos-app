import { createContext, useContext, useState, ReactNode } from "react";
import type { CoachId } from "@/data/coaches";

type SessionState = {
  selectedCoach: CoachId | null;
  setSelectedCoach: (id: CoachId) => void;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [selectedCoach, setSelectedCoach] = useState<CoachId | null>(null);
  return (
    <SessionContext.Provider value={{ selectedCoach, setSelectedCoach }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
