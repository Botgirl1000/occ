export interface ProgressEvent {
  phase: string;
  total: number;
  completed: number;
  detail?: string;
}

export type OnProgress = (event: ProgressEvent) => void;
