"use client";

import { useState } from "react";
import { scrapeAndStoreArticles } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Link as LinkIcon,
  Newspaper,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [scrapedUrls, setScrapedUrls] = useState<string[] | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const { toast } = useToast();

  const handleStartAnalysis = async () => {
    setIsLoading(true);
    setScrapedUrls(null);
    setHasAnalyzed(true);
    try {
      const result = await scrapeAndStoreArticles();
      setScrapedUrls(result);
    } catch (error) {
      console.error("Analysis failed:", error);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: "Could not scrape and store the articles. Please check the console for more details.",
      });
      setScrapedUrls([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Newspaper className="h-7 w-7 text-primary" />
            <h1 className="font-headline text-xl font-bold tracking-tight md:text-2xl">
              Article Insights
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 md:px-6 md:py-12">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Web Scrape and Store Articles
            </h2>
            <p className="mt-4 text-muted-foreground md:text-xl">
              Click the button to start scraping articles from the predefined list and store their content in Firebase.
            </p>
            <div className="mt-8 flex w-full max-w-md mx-auto items-center">
              <Button
                onClick={handleStartAnalysis}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                {isLoading ? "Analyzing..." : "Start Analysis"}
              </Button>
            </div>
          </div>

          {(isLoading || (hasAnalyzed && scrapedUrls)) && (
            <div className="mx-auto mt-12 max-w-4xl">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText />
                    Scraped Articles
                  </CardTitle>
                  <CardDescription>
                    {isLoading ? "Scraping in progress..." : `Found and processed ${scrapedUrls?.length || 0} article URLs.`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : (
                    scrapedUrls && (
                        <div className="space-y-4">
                            {scrapedUrls.length > 0 ? (
                            <div className="space-y-3">
                                <h4 className="flex items-center gap-2 font-semibold">
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                 Successfully Scraped {scrapedUrls.length} Articles
                                </h4>
                                <ul className="space-y-2 max-h-[400px] overflow-y-auto rounded-md border bg-muted/50 p-4">
                                {scrapedUrls.map((url) => (
                                    <li key={url} className="text-sm text-muted-foreground truncate flex items-center gap-2">
                                     <LinkIcon className="h-4 w-4 flex-shrink-0" />
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline hover:text-primary"
                                    >
                                        {url}
                                    </a>
                                    </li>
                                ))}
                                </ul>
                            </div>
                            ) : (
                            <div className="text-center text-muted-foreground flex flex-col items-center gap-4">
                               <AlertCircle className="h-10 w-10 text-destructive" />
                               <p>No articles were found or scraped. Please check the URL list in the backend and ensure the website structure is correct.</p>
                            </div>
                            )}
                        </div>
                    )
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
