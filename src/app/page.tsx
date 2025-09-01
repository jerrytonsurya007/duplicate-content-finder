"use client";

import { useState } from "react";
import { scrapeAndStoreArticle, getArticleUrls } from "@/app/actions";
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
  Loader2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function Home() {
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedUrls, setScrapedUrls] = useState<string[]>([]);
  const [totalUrls, setTotalUrls] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const { toast } = useToast();

  const handleStartAnalysis = async () => {
    setIsScraping(true);
    setHasStarted(true);
    setScrapedUrls([]);
    try {
      const urlsToScrape = await getArticleUrls();
      setTotalUrls(urlsToScrape.length);

      for (const url of urlsToScrape) {
        try {
          const result = await scrapeAndStoreArticle(url);
          if (result.success) {
            setScrapedUrls((prev) => [...prev, result.url!]);
          } else {
             toast({
                variant: "destructive",
                title: "Scraping Failed for URL",
                description: `${url}: ${result.error}`,
            });
          }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Scraping Failed for URL",
                description: `${url}: ${error.message}`,
            });
        }
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description:
          "Could not fetch the article URL list. Please check the console.",
      });
    } finally {
      setIsScraping(false);
    }
  };

  const progress = totalUrls > 0 ? (scrapedUrls.length / totalUrls) * 100 : 0;

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
              Click the button to start scraping articles from the predefined
              list and store their content in Firebase.
            </p>
            <div className="mt-8 flex w-full max-w-md mx-auto items-center">
              <Button
                onClick={handleStartAnalysis}
                disabled={isScraping}
                className="w-full"
                size="lg"
              >
                {isScraping ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Start Analysis
                  </>
                )}
              </Button>
            </div>
          </div>

          {hasStarted && (
            <div className="mx-auto mt-12 max-w-4xl">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText />
                    Scraping Progress
                  </CardTitle>
                  <CardDescription>
                     {isScraping
                      ? `Processing ${scrapedUrls.length + 1} of ${totalUrls}...`
                      : `Scraping complete. Processed ${scrapedUrls.length} of ${totalUrls} articles.`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                     <Progress value={progress} className="w-full" />
                      {scrapedUrls.length > 0 ? (
                        <div className="space-y-3 pt-4">
                          <h4 className="flex items-center gap-2 font-semibold">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            Successfully Scraped {scrapedUrls.length} Articles
                          </h4>
                          <ul className="space-y-2 max-h-[400px] overflow-y-auto rounded-md border bg-muted/50 p-4">
                            {scrapedUrls.map((url) => (
                              <li
                                key={url}
                                className="text-sm text-muted-foreground truncate flex items-center gap-2"
                              >
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
                      ) : !isScraping && (
                        <div className="text-center text-muted-foreground flex flex-col items-center gap-4 pt-4">
                          <AlertCircle className="h-10 w-10 text-destructive" />
                          <p>
                            No articles were scraped. Please check the URL list and website structure.
                          </p>
                        </div>
                      )}
                    </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
