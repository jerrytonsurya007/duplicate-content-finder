
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  scrapeAndStoreArticle,
  getArticleUrls,
  clearArticles,
  getScrapedArticles,
  ScrapedArticle,
} from "@/app/actions";
import { compareArticles, ComparisonResult } from "@/ai/flows/find-duplicates-flow";
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
  Play,
  Pause,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

type DuplicateGroup = {
  reason: string;
  articles: { title: string; url: string }[];
};

export default function Home() {
  const [isScraping, setIsScraping] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [scrapedArticles, setScrapedArticles] = useState<ScrapedArticle[]>([]);
  const [totalUrlsToScrape, setTotalUrlsToScrape] = useState(0);
  const [scrapedCount, setScrapedCount] = useState(0);
  const [hasScraped, setHasScraped] = useState(false);

  const [totalPairs, setTotalPairs] = useState(0);
  const [analyzedPairs, setAnalyzedPairs] = useState(0);
  
  const isStoppingScraping = useRef(false);
  const analysisState = useRef({ isRunning: false, currentIndex: 0, currentPairOffset: 1 });


  const { toast } = useToast();

  const fetchScrapedArticles = useCallback(async () => {
    try {
      const articles = await getScrapedArticles();
      setScrapedArticles(articles);
      setScrapedCount(articles.length);
      if (articles.length > 0) {
        setHasScraped(true);
        const pairCount = (articles.length * (articles.length - 1)) / 2;
        setTotalPairs(pairCount);
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
    setDuplicateGroups([]);
    setAnalyzedPairs(0);
    isStoppingScraping.current = false;

    try {
      await clearArticles();
      const urlsToScrape = await getArticleUrls();
      setTotalUrlsToScrape(urlsToScrape.length);

      for (const url of urlsToScrape) {
        if (isStoppingScraping.current) {
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
      await fetchScrapedArticles();
    }
  };

  const handleStopScraping = () => {
    isStoppingScraping.current = true;
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
        setScrapedArticles([]);
        setTotalUrlsToScrape(0);
        setScrapedCount(0);
        setHasScraped(false);
        setDuplicateGroups([]);
        setAnalyzedPairs(0);
        setTotalPairs(0);
        analysisState.current = { isRunning: false, currentIndex: 0, currentPairOffset: 1 };
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
  
  const processDuplicates = (foundPairs: {url1: string, url2: string, reason: string}[]) => {
      const consolidatedGroups = new Map<string, {urls: Set<string>; reason: string}>();
      for (const pair of foundPairs) {
        let groupFound = false;
        for (const group of consolidatedGroups.values()) {
          if (group.urls.has(pair.url1) || group.urls.has(pair.url2)) {
            group.urls.add(pair.url1);
            group.urls.add(pair.url2);
            groupFound = true;
            break;
          }
        }
        if (!groupFound) {
          const newGroupKey = pair.url1;
          consolidatedGroups.set(newGroupKey, {
            urls: new Set([pair.url1, pair.url2]),
            reason: pair.reason,
          });
        }
      }

      const articleMap = new Map(scrapedArticles.map((a) => [a.url, a]));
      const newDuplicateGroups = Array.from(consolidatedGroups.values()).map((group) => {
          return {
            reason: group.reason || 'Found to be a duplicate or heavily related.',
            articles: Array.from(group.urls)
              .map((url) => {
                const article = articleMap.get(url);
                return article ? {title: article.metaTitle, url: article.url} : null;
              })
              .filter((a): a is {title: string; url: string} => a !== null),
          };
        })
        .filter((group) => group.articles.length > 1);

      setDuplicateGroups(newDuplicateGroups);
  };
  
  const runAnalysis = useCallback(async () => {
    if (!analysisState.current.isRunning || isPaused) return;

    let { currentIndex, currentPairOffset } = analysisState.current;
    
    if (currentIndex >= scrapedArticles.length - 1) {
        setIsAnalyzing(false);
        analysisState.current.isRunning = false;
        toast({ title: "Analysis Complete", description: "All article pairs have been analyzed."});
        return;
    }
    
    const article1 = scrapedArticles[currentIndex];
    const article2 = scrapedArticles[currentIndex + currentPairOffset];

    const result = await compareArticles(article1, article2);

    if (result.isDuplicate && result.reason) {
       setDuplicateGroups(prev => {
          const foundPair = { url1: article1.url, url2: article2.url, reason: result.reason! };
          const allPairs = [...prev.flatMap(g => {
              const pairs = [];
              for(let i=0; i<g.articles.length; i++) {
                  for(let j=i+1; j<g.articles.length; j++) {
                      pairs.push({url1: g.articles[i].url, url2: g.articles[j].url, reason: g.reason})
                  }
              }
              return pairs;
          }), foundPair];
          
          const consolidatedGroups = new Map<string, {urls: Set<string>; reason: string}>();
          for (const pair of allPairs) {
            let groupFound = false;
            for (const group of consolidatedGroups.values()) {
              if (group.urls.has(pair.url1) || group.urls.has(pair.url2)) {
                group.urls.add(pair.url1);
                group.urls.add(pair.url2);
                groupFound = true;
                break;
              }
            }
            if (!groupFound) {
              const newGroupKey = pair.url1;
              consolidatedGroups.set(newGroupKey, {
                urls: new Set([pair.url1, pair.url2]),
                reason: pair.reason,
              });
            }
          }
          const articleMap = new Map(scrapedArticles.map((a) => [a.url, a]));
          return Array.from(consolidatedGroups.values()).map((group) => {
              return {
                reason: group.reason || 'Found to be a duplicate.',
                articles: Array.from(group.urls)
                  .map((url) => {
                    const article = articleMap.get(url);
                    return article ? {title: article.metaTitle, url: article.url} : null;
                  })
                  .filter((a): a is {title: string; url: string} => a !== null),
              };
            })
            .filter((group) => group.articles.length > 1);
       });
    }

    setAnalyzedPairs(prev => prev + 1);

    // Update indices for the next pair
    let nextPairOffset = currentPairOffset + 1;
    let nextIndex = currentIndex;

    if (nextIndex + nextPairOffset >= scrapedArticles.length) {
        nextIndex++;
        nextPairOffset = 1;
    }
    
    analysisState.current.currentIndex = nextIndex;
    analysisState.current.currentPairOffset = nextPairOffset;

    // Use requestAnimationFrame to avoid deep call stacks and allow UI to update
    requestAnimationFrame(runAnalysis);

  }, [isPaused, scrapedArticles, toast]);
  
  const handleToggleAnalysis = () => {
    if (isAnalyzing && !isPaused) { // Was running, now pause
        setIsPaused(true);
        analysisState.current.isRunning = false;
        toast({ title: "Analysis Paused" });
    } else { // Was paused or stopped, now run/resume
        setIsPaused(false);
        setIsAnalyzing(true);
        analysisState.current.isRunning = true;
        
        if (!isPaused) { // This is a new run
            setDuplicateGroups([]);
            setAnalyzedPairs(0);
            analysisState.current = { isRunning: true, currentIndex: 0, currentPairOffset: 1 };
        }
        
        requestAnimationFrame(runAnalysis);
    }
  };


  const progress = totalUrlsToScrape > 0 && isScraping ? (scrapedCount / totalUrlsToScrape) * 100 : 0;
  const analysisProgress = totalPairs > 0 ? (analyzedPairs / totalPairs) * 100 : 0;

  const canAnalyze = !isScraping && !isClearing && scrapedArticles.length > 1;
  const isAnalysisComplete = analyzedPairs >= totalPairs && totalPairs > 0;

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
                onClick={handleToggleAnalysis}
                disabled={!canAnalyze || (isAnalyzing && !isPaused) || isAnalysisComplete}
                className="w-full"
                size="lg"
              >
                {isAnalyzing && !isPaused ? (
                  <>
                    <Pause className="mr-2 h-5 w-5" />
                    Pause Analysis
                  </>
                ) : isAnalysisComplete ? (
                   <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Analysis Complete
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" />
                    { isPaused ? 'Resume Analysis' : 'Start Analysis' }
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

          {(hasScraped || isAnalyzing || duplicateGroups.length > 0) && (
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

              {(isAnalyzing || isPaused || duplicateGroups.length > 0 || isAnalysisComplete) && (
                <Card>
                   <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb />
                      Analysis Results
                    </CardTitle>
                    <CardDescription>
                      {`Analysis progress: ${analyzedPairs} of ${totalPairs} pairs analyzed.`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                     <Progress value={analysisProgress} className="w-full mb-4" />
                     {isAnalyzing && !isPaused && (
                      <div className="flex items-center justify-center rounded-lg border border-dashed p-12">
                          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {duplicateGroups.length > 0 ? (
                      duplicateGroups.map((group, index) => (
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
