import { QueryRequest, QueryResponse, GraphNode } from "../types/graphTypes";
import { tokenize } from "../utils/tokenizer";

const WEAK_TOKENS = new Set(["where", "is", "the", "what", "how", "a", "an", "of", "and", "or", "to", "in"]);

/**
 * Handles natural language queries and maps them to graph nodes with intelligent scoring.
 */
export function handleQuery(request: QueryRequest): QueryResponse {
  const { query, context } = request;
  const nodes = context.graph.nodes;
  const nodeMap = context.nodeMap;

  // 1. Normalization & Pre-processing
  const cleanQuery = query.toLowerCase().trim().replace(/[?.!,]/g, "");
  
  // 2. Empty Query Handling (Fallback immediately)
  if (!cleanQuery) {
    return getFallbackResponse("Showing key files in the repository.", context);
  }

  // 3. Keyword Extraction
  const rawTokens = tokenize(cleanQuery);
  const strongTokens = rawTokens.filter(t => t.length >= 3 && !WEAK_TOKENS.has(t));

  // If no strong tokens extracted, trigger fallback
  if (strongTokens.length === 0) {
    return getFallbackResponse("No specific matches found. Showing general exploration views.", context);
  }

  // Limit search to first 3 strong tokens for precision and performance
  const searchTokens = strongTokens.slice(0, 3);

  // 4. Scoring Engine (O(n))
  const candidateScores = new Map<string, number>();

  for (const node of nodes) {
    const nodeNameLow = node.name.toLowerCase();
    const nodeFolderLow = node.folder.toLowerCase();
    let score = 0;
    let matchFound = false;

    for (const token of searchTokens) {
      let tokenMatched = false;

      // Exact name match or starts-with boost (+4)
      if (nodeNameLow === token || nodeNameLow.startsWith(token + ".")) {
        score += 4;
        tokenMatched = true;
      } 
      // Substring filename match (+3)
      else if (nodeNameLow.includes(token)) {
        score += 3;
        tokenMatched = true;
      }

      // Folder match (+2)
      if (nodeFolderLow.includes(token)) {
        score += 2;
        // Combined Folder + Filename boost (+3)
        if (tokenMatched) {
          score += 3;
        }
        tokenMatched = true;
      }

      if (tokenMatched) {
        matchFound = true;
        // Multi-token boost (+2 for each additional unique matching token)
        score += 2;
      }
    }

    if (matchFound) {
      // Impact weight (Indisputable tie-breaker/relevance booster)
      score += node.impact * 0.2;
      candidateScores.set(node.id, score);
    }
  }

  // 5. Result Sorting & Selection
  const sortedIds = Array.from(candidateScores.keys()).sort((a, b) => {
    const scoreA = candidateScores.get(a) || 0;
    const scoreB = candidateScores.get(b) || 0;
    if (Math.abs(scoreB - scoreA) > 0.001) {
      return scoreB - scoreA;
    }
    // Secondary Tie-breaker: Impact
    return (nodeMap[b]?.impact || 0) - (nodeMap[a]?.impact || 0);
  });

  // 6. Hard Fallback if no meaningful matches
  if (sortedIds.length === 0) {
    return getFallbackResponse(`No direct match found for '${searchTokens.join(", ")}'. Showing entry points.`, context);
  }

  // 7. Successful Response Assembly
  const highlightNodes = sortedIds.slice(0, 5);
  const focusNode = highlightNodes[0];

  // Extract basenames for the answer string
  const relevantFiles = highlightNodes
    .slice(0, 4) // Max 4 for answer
    .map(id => id.split("/").pop() || id)
    .join(", ");

  const answer = `The most relevant files for '${query}' are: ${relevantFiles}. These components likely handle this functionality based on their structure and local dependencies.`;

  // Debug Logging
  if (process.env.DEBUG_QUERY === "true") {
    console.log(`[DEBUG] Query: ${query}`);
    console.log(`[DEBUG] Tokens: ${searchTokens}`);
    console.log(`[DEBUG] Matches Found: ${sortedIds.length}`);
  }

  return {
    answer,
    highlightNodes,
    focusNode
  };
}

/**
 * Generates a consistent fallback response based on repository views.
 */
function getFallbackResponse(answer: string, context: AnalysisResult): QueryResponse {
  const views = context.views;
  
  // Try Entry Points -> High Impact -> Default
  let highlightNodes = views.entryPoints.length > 0 ? views.entryPoints.slice(0, 5) :
                     views.highImpact.length > 0 ? views.highImpact.slice(0, 5) :
                     views.default.slice(0, 5);

  // Absolute fallback to first node if everything else fails
  if (highlightNodes.length === 0 && context.graph.nodes.length > 0) {
    highlightNodes = [context.graph.nodes[0].id];
  }

  return {
    answer,
    highlightNodes,
    focusNode: highlightNodes[0] || ""
  };
}

// Support functions/types if needed, but AnalysisResult handles it
import { AnalysisResult } from "../types/graphTypes";
