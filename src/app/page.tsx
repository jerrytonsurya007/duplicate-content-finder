
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  scrapeAndStoreArticle,
  getArticleUrls,
  clearArticles,
  getScrapedArticles,
  ScrapedArticle,
} from "@/app/actions";
import { findDuplicates } from "@/ai/flows/find-duplicates-flow";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Link as LinkIcon,
  Newspaper,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  XCircle,
  Lightbulb,
  RefreshCw,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { DuplicateAnalysisResult } from "@/ai/flows/find-duplicates-flow";

const ANALYSIS_BATCH_SIZE = 50;

export default function Home() {
  const [isScraping, setIsScraping] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] =
    useState<DuplicateAnalysisResult | null>(null);
  const [scrapedArticles, setScrapedArticles] = useState<ScrapedArticle[]>([]);
  const [totalUrlsToScrape, setTotalUrlsToScrape] = useState(0);
  const [scrapedCount, setScrapedCount] = useState(0);
  const [hasScraped, setHasScraped] = useState(false);
  const [analysisOffset, setAnalysisOffset] = useState(0);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const isStopping = useRef(false);

  const { toast } = useToast();

  const fetchScrapedArticles = useCallback(async () => {
    try {
      const articles = await getScrapedArticles();
      setScrapedArticles(articles);
      setScrapedCount(articles.length);
      setAnalyzedCount(0); // Reset analysis progress
      setAnalysisOffset(0);
      if (articles.length > 0) {
        setHasScraped(true);
      }
    } catch (error) {
      console.error("Failed to fetch scraped articles:", error);
      toast({
        variant: "destructive",
        title: "Failed to load articles",
        description: "Could not fetch previously scraped articles from the database.",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchScrapedArticles();
  }, [fetchScrapedArticles]);


  const handleStartScraping = async () => {
    setIsScraping(true);
    setHasScraped(true);
    setScrapedCount(0);
    setScrapedArticles([]);
    setAnalysisResult(null);
    setAnalyzedCount(0);
    setAnalysisOffset(0);
    isStopping.current = false;

    try {
      await clearArticles();
      const urlsToScrape = await getArticleUrls();
      setTotalUrlsToScrape(urlsToScrape.length);

      for (const url of urlsToScrape) {
        if (isStopping.current) {
          toast({
            title: "Scraping Stopped",
            description: "The scraping process was manually stopped.",
          });
          break;
        }
        try {
          const result = await scrapeAndStoreArticle(url);
          if (result.success) {
            setScrapedCount((prev) => prev + 1);
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
      console.error("Scraping failed:", error);
      toast({
        variant: "destructive",
        title: "Scraping Failed",
        description:
          "Could not fetch the article URL list. Please check the console.",
      });
    } finally {
      setIsScraping(false);
      // After scraping is done, refresh the list from DB
      await fetchScrapedArticles();
    }
  };

  const handleAnalyzeContent = async () => {
    if (scrapedArticles.length === 0) return;

    setIsAnalyzing(true);
    
    // If it's a new analysis, clear previous results
    if (analysisOffset === 0) {
      setAnalysisResult(null);
    }

    try {
      const articlesToAnalyze = scrapedArticles.slice(analysisOffset, analysisOffset + ANALYSIS_BATCH_SIZE);
      const result = await findDuplicates(articlesToAnalyze);
      
      // Merge results
      setAnalysisResult(prevResult => {
        if (!prevResult) return result;
        return {
          duplicateGroups: [...prevResult.duplicateGroups, ...result.duplicateGroups]
        };
      });

      const newOffset = analysisOffset + ANALYSIS_BATCH_SIZE;
      setAnalysisOffset(newOffset);
      setAnalyzedCount(newOffset > scrapedArticles.length ? scrapedArticles.length : newOffset);

      toast({
        title: "Analysis Batch Complete",
        description: `Analyzed ${articlesToAnalyze.length} articles. Click again to continue.`,
      });
    } catch (error: any) {
      console.error("Duplicate analysis failed:", error);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description:
          "Could not analyze content for duplicates. " + error.message,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStopScraping = () => {
    isStopping.current = true;
    setIsScraping(false);
  };

  const handleClearDatabase = async () => {
    setIsClearing(true);
    try {
      const result = await clearArticles();
      if (result.success) {
        toast({
          title: "Database Cleared",
          description: "All scraped articles have been deleted.",
        });
        // Reset state
        setScrapedArticles([]);
        setTotalUrlsToScrape(0);
        setScrapedCount(0);
        setHasScraped(false);
        setAnalysisResult(null);
        setAnalysisOffset(0);
        setAnalyzedCount(0);
      } else {
        toast({
          variant: "destructive",
          title: "Clearing Failed",
          description: result.error,
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Clearing Failed",
        description: error.message,
      });
    } finally {
      setIsClearing(false);
    }
  };

  const progress = totalUrlsToScrape > 0 && isScraping ? (scrapedCount / totalUrlsToScrape) * 100 : 0;
  const analysisProgress = scrapedArticles.length > 0 ? (analyzedCount / scrapedArticles.length) * 100 : 0;

  const canAnalyze = !isScraping && !isAnalyzing && scrapedArticles.length > 0;
  const isAnalysisComplete = analyzedCount >= scrapedArticles.length && scrapedArticles.length > 0;


  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Newspaper className="h-7 w-7 text-primary" />
            <h1 className="font-headline text-xl font-bold tracking-tight md:text-2xl">
              SFL duplicate content finder
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 md:px-6 md:py-12">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Find Duplicate Articles
            </h2>
            <p className="mt-4 text-muted-foreground md:text-xl">
              Analyze your articles to find duplicates based on title and content.
              You can refresh the scraped data at any time.
            </p>
            <div className="mt-8 flex w-full max-w-md mx-auto items-center space-x-2">
              <Button
                onClick={handleAnalyzeContent}
                disabled={!canAnalyze || isAnalysisComplete}
                className="w-full"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : isAnalysisComplete ? (
                   <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Analysis Complete
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Analyze Next {ANALYSIS_BATCH_SIZE} Articles
                  </>
                )}
              </Button>
            </div>
             <div className="mt-4 flex w-full max-w-md mx-auto items-center space-x-2">
              <Button
                onClick={handleStartScraping}
                disabled={isScraping || isClearing || isAnalyzing}
                className="w-full"
                variant="outline"
              >
                {isScraping ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Scraping Data...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Refresh Scraped Data
                  </>
                )}
              </Button>
              {isScraping && (
                <Button
                  onClick={handleStopScraping}
                  variant="destructive"
                  size="icon"
                >
                  <XCircle className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>

          {(hasScraped || isAnalyzing || analysisResult) && (
            <div className="mx-auto mt-12 max-w-4xl space-y-8">
              { hasScraped && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText />
                    Scraped Data Status
                  </CardTitle>
                  <CardDescription>
                    {isScraping
                      ? `Processing ${scrapedCount + 1} of ${totalUrlsToScrape}...`
                      : `Found ${scrapedArticles.length} articles in the database. Ready for analysis.`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {isScraping && <Progress value={progress} className="w-full" />}
                    {scrapedArticles.length > 0 ? (
                      <div className="space-y-3 pt-4">
                        <h4 className="flex items-center gap-2 font-semibold">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                           {isScraping ? `Successfully Scraped ${scrapedCount} Articles` : `${scrapedArticles.length} Scraped Articles Found`}
                        </h4>
                        <ul className="space-y-2 max-h-[400px] overflow-y-auto rounded-md border bg-muted/50 p-4">
                          {scrapedArticles.map(({ url }, index) => (
                            <li
                              key={`${url}-${index}`}
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
                    ) : !isScraping && hasScraped ? (
                      <div className="text-center text-muted-foreground flex flex-col items-center gap-4 pt-4">
                        <AlertCircle className="h-10 w-10 text-destructive" />
                        <p>
                          No articles were scraped. Please check the URL list
                          and website structure.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
                <CardFooter className="flex-col gap-4">
                  <Button
                    onClick={handleClearDatabase}
                    disabled={isClearing || isScraping || isAnalyzing}
                    variant="outline"
                    className="w-full"
                  >
                    {isClearing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-5 w-5" />
                        Clear Scraped Data
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
              )}

              {(isAnalyzing || analysisResult) && (
                <Card>
                   <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb />
                      Analysis Results
                    </CardTitle>
                    <CardDescription>
                      {`Analysis progress: ${analyzedCount} of ${scrapedArticles.length} articles analyzed.`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                     <Progress value={analysisProgress} className="w-full mb-4" />
                     {isAnalyzing && (
                      <div className="flex items-center justify-center rounded-lg border border-dashed p-12">
                          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {analysisResult && analysisResult.duplicateGroups.length > 0 ? (
                      analysisResult.duplicateGroups.map((group, index) => (
                        <div
                          key={index}
                          className="rounded-lg border bg-background p-4 mt-4"
                        >
                          <h4 className="font-semibold">Group {index + 1}</h4>
                          <p className="mt-2 text-sm text-muted-foreground italic">
                            {group.reason}
                          </p>
                          <ul className="mt-3 space-y-2">
                            {group.articles.map((article) => (
                              <li
                                key={article.url}
                                className="text-sm flex items-start gap-2"
                              >
                                <LinkIcon className="h-4 w-4 flex-shrink-0 mt-1" />
                                <div>
                                  <a
                                    href={article.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium hover:underline hover:text-primary"
                                  >
                                    {article.title}
                                  </a>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                    ) : (
                      !isAnalyzing && <p className="text-center text-muted-foreground pt-4">
                        No duplicate or heavily related articles were found in the analyzed batches.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
