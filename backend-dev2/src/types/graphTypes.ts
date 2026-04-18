export type FileInput = {
  id: string;
  content: string;
  extension: string;
};

export type DependencyInput = {
  from: string;
  to: string;
};

export type RepoAnalyzerInput = {
  files: FileInput[];
  dependencies: DependencyInput[];
};

export type GraphNode = {
  id: string;
  name: string;
  label: string;
  folder: string;
  layer: string;
  impact: number;
  dependencies: string[];
  dependents: string[];
  position: { x: number; y: number };
  highlight: boolean;
};

export type GraphEdge = {
  source: string;
  target: string;
};

export type GraphViews = {
  default: string[];
  highImpact: string[];
  entryPoints: string[];
  byFolder: Record<string, string[]>;
};

export type QueryContext = {
  topNodes: string[];
  entryPoints: string[];
  nodeMap: Record<string, GraphNode>;
};

export type AnalysisResult = {
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  views: GraphViews;
  nodeMap: Record<string, GraphNode>;
  searchIndex: Record<string, string[]>;
  queryContext: QueryContext;
  metadata: {
    totalFiles: number;
    totalEdges: number;
    validEdges: number;
    isLargeGraph: boolean;
    payloadSize: number;
  };
};
export type QueryRequest = {
  query: string;
  context: AnalysisResult;
};

export type QueryResponse = {
  answer: string;
  highlightNodes: string[];
  focusNode: string;
};
