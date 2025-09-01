export interface Article {
  id: string;
  title: string;
  url: string;
  content: string;
}

export interface AnalysisResult {
  article1: Article;
  article2: Article;
  similarityScore: number;
  reason: string;
}
