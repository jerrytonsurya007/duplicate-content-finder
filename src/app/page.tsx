"use client";

import { useState } from "react";
import type { AnalysisResult, Article } from "@/lib/types";
import { performAnalysis, scrape } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Link as LinkIcon,
  Newspaper,
  SlidersHorizontal,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { database } from "@/lib/firebase";
import { ref, set } from "firebase/database";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Scraping Articles...");
  const [results, setResults] = useState<AnalysisResult[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [threshold, setThreshold] = useState(50);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    setIsLoading(true);
    setSearched(true);
    setResults(null);
    try {
      // 1. Scrape articles
      setLoadingMessage("Scraping articles...");
      const articles = await scrape();

      // 2. Store in Firebase
      setLoadingMessage("Storing articles in database...");
      const dbPromises = articles.map(article => {
        const articleRef = ref(database, 'articles/' + article.id);
        return set(articleRef, {
            title: article.title,
            url: article.url,
            content: article.content,
        });
      });
      await Promise.all(dbPromises);
      
      // 3. Perform analysis
      setLoadingMessage("Analyzing for duplicates...");
      const analysisResults = await performAnalysis(articles);
      setResults(analysisResults);
    } catch (error) {
      console.error("Analysis failed:", error);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: "Could not analyze articles. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredResults =
    results?.filter(
      (result) => result.similarityScore * 100 >= threshold
    ) || [];

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
              Detect Duplicate Content with AI
            </h2>
            <p className="mt-4 text-muted-foreground md:text-xl">
              Our platform scrapes articles from the Shriram Finance website and leverages
              Gemini to analyze content similarity, helping you identify
              potential duplicates effortlessly.
            </p>
            <Button
              size="lg"
              className="mt-8"
              onClick={handleAnalyze}
              disabled={isLoading}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              {isLoading ? loadingMessage : "Scrape & Analyze Articles"}
            </Button>
          </div>

          {(isLoading || (searched && results)) && (
            <div className="mx-auto mt-12 max-w-6xl">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText />
                    Analysis Report
                  </CardTitle>
                  <CardDescription>
                    Review pairs of articles with potential content overlap.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-6">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="space-y-4 rounded-lg border p-4">
                          <div className="flex justify-between">
                            <Skeleton className="h-5 w-3/5" />
                            <Skeleton className="h-5 w-1/5" />
                          </div>
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    results && (
                      <div className="space-y-8">
                        <div className="space-y-4">
                          <h3 className="flex items-center gap-2 font-semibold">
                            <SlidersHorizontal />
                            Filter by Similarity
                          </h3>
                          <div className="flex items-center gap-4">
                            <Slider
                              value={[threshold]}
                              onValueChange={(value) => setThreshold(value[0])}
                              max={100}
                              step={1}
                              className="w-full"
                            />
                            <span className="w-20 text-center font-mono text-lg font-semibold">
                              {threshold}%
                            </span>
                          </div>
                        </div>

                        {filteredResults.length > 0 ? (
                          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
                            {filteredResults.map((result, index) => (
                              <Card key={index} className="flex flex-col">
                                <CardHeader>
                                  <div className="flex items-start justify-between gap-4">
                                    <CardTitle className="text-lg">
                                      High Similarity Detected
                                    </CardTitle>
                                    <div className="flex h-8 w-20 items-center justify-center rounded-full bg-primary/10">
                                      <span className="font-mono text-lg font-semibold text-primary">
                                        {(
                                          result.similarityScore * 100
                                        ).toFixed(0)}
                                        %
                                      </span>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="flex-1 space-y-4">
                                  <div className="space-y-1">
                                    <p className="font-semibold text-sm">
                                      Article 1:
                                    </p>
                                    <a
                                      href={result.article1.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                                    >
                                      <LinkIcon className="h-4 w-4" />
                                      <span className="truncate group-hover:underline">
                                        {result.article1.title}
                                      </span>
                                    </a>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="font-semibold text-sm">
                                      Article 2:
                                    </p>
                                    <a
                                      href={result.article2.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                                    >
                                      <LinkIcon className="h-4 w-4" />
                                      <span className="truncate group-hover:underline">
                                        {result.article2.title}
                                      </span>
                                    </a>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-sm mb-2">Similarity Score:</p>
                                    <Progress
                                      value={result.similarityScore * 100}
                                    />
                                  </div>

                                  <Accordion type="single" collapsible>
                                    <AccordionItem value="item-1">
                                      <AccordionTrigger>
                                        AI Reasoning
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        {result.reason}
                                      </AccordionContent>
                                    </AccordionItem>
                                  </Accordion>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
                            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h3 className="mt-4 text-xl font-semibold">
                              No Duplicates Found
                            </h3>
                            <p className="mt-2 text-muted-foreground">
                              No results match the current similarity
                              threshold. Try lowering the filter value.
                            </p>
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
