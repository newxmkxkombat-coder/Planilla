
export interface SavedPlanilla {
  id: string;
  routeNumber: string;
  planillaNumber: string;
  headers: string[];
  grid: (string | null)[];
  date: string;
}

export interface AppState {
  currentPlanilla: {
    headers: string[];
    grid: (string | null)[];
    routeNumber: string;
    planillaNumber: string;
  } | null;
  history: SavedPlanilla[];
  loading: boolean;
  error: string | null;
}

export interface ExtractionResult {
  routeNumber: string | null;
  planillaNumber: string | null;
  headers: string[]; 
  grid: (string | null)[]; 
}
