export interface PageData {
  url: string;
  title: string;
  description: string;
  text: string;
  method: "readability" | "fallback";
  jsonLd: unknown[];
  truncated: boolean;
}