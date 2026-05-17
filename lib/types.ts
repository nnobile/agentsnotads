export interface Article {
  id: string;
  url: string;
  title: string;
  source: string;
  published_at: string | null;
  fetched_at: string;
  summary: string | null;
  tags: string[] | null;
  relevance_score: number | null;
  status: "candidate" | "approved" | "rejected";
  approved_at: string | null;
  newsletter_sent: boolean;
}
