import { useCallback, useEffect, useState } from "react";
import { coaches, type CoachId } from "@/data/coaches";
import { getDecisions, type Decision } from "@/lib/decisions";
import { getActions, type Action } from "@/lib/actions";

export type HistoryItem =
  | {
      kind: "decision";
      id: string;
      coachId: CoachId;
      createdAt: number;
      decision: Decision;
    }
  | {
      kind: "action";
      id: string;
      coachId: CoachId;
      createdAt: number;
      action: Action;
    };

type State = {
  items: HistoryItem[];
  loading: boolean;
  error: string | null;
};

export function useHistory() {
  const [state, setState] = useState<State>({
    items: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const coachIds = coaches.map((c) => c.id);
      const [decisionLists, actionLists] = await Promise.all([
        Promise.all(coachIds.map((id) => getDecisions(id))),
        Promise.all(coachIds.map((id) => getActions(id))),
      ]);

      const decisionItems: HistoryItem[] = decisionLists.flat().map((d) => ({
        kind: "decision",
        id: `dec:${d.id}`,
        coachId: d.coachId,
        createdAt: d.createdAt,
        decision: d,
      }));

      const actionItems: HistoryItem[] = actionLists.flat().map((a) => ({
        kind: "action",
        id: `act:${a.id}`,
        coachId: a.coachId,
        createdAt: a.createdAt,
        action: a,
      }));

      const merged = [...decisionItems, ...actionItems].sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      setState({ items: merged, loading: false, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "기록을 불러오지 못했어";
      setState({ items: [], loading: false, error: msg });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
