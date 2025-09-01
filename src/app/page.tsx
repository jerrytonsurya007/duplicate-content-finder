"use client";

import { useState } from "react";
import type { Article } from "@/lib/types";
import { scrape } from "@/app/actions";
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
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();

  const handleScrape = async () => {
    setIsLoading(true);
    setSearched(true);
    setArticles(null);
    try {
      // 1. Scrape articles
      const scrapedArticles = await scrape();
      setArticles(scrapedArticles);

      // 2. Store in Firebase
      const articlesCollection = collection(db, 'articles');
      const dbPromises = scrapedArticles.map(article => {
        const articleRef = doc(articlesCollection, article.id);
        return setDoc(articleRef, {
            title: article.title,
            url: article.url,
            content: article.content,
        });
      });
      await Promise.all(dbPromises);
      
    } catch (error) {
      console.error("Scraping failed:", error);
      toast({
        variant: "destructive",
        title: "Scraping Failed",
        description: "Could not scrape articles. Please try again later.",
      });
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
              Scrape Articles from the Web
            </h2>
            <p className="mt-4 text-muted-foreground md:text-xl">
              Our platform scrapes articles from the Shriram Finance website and
              stores them in your database.
            </p>
            <Button
              size="lg"
              className="mt-8"
              onClick={handleScrape}
              disabled={isLoading}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              {isLoading ? "Scraping Articles..." : "Scrape Articles"}
            </Button>
          </div>

          {(isLoading || (searched && articles)) && (
            <div className="mx-auto mt-12 max-w-4xl">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText />
                    Scraped Articles
                  </CardTitle>
                  <CardDescription>
                    The following articles were scraped and saved to your database.
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
                    articles && (
                        <div className="space-y-4">
                            {articles.length > 0 ? (
                            <div className="space-y-3">
                                <h4 className="flex items-center gap-2 font-semibold">
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                Scraped {articles.length} Articles
                                </h4>
                                <ul className="space-y-2 max-h-[400px] overflow-y-auto rounded-md border bg-muted/50 p-4">
                                {articles.map((article) => (
                                    <li key={article.id} className="text-sm text-muted-foreground truncate flex items-center gap-2">
                                     <LinkIcon className="h-4 w-4 flex-shrink-0" />
                                    <a
                                        href={article.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline hover:text-primary"
                                    >
                                        {article.url}
                                    </a>
                                    </li>
                                ))}
                                </ul>
                            </div>
                            ) : (
                            <p className="text-center text-muted-foreground">No articles were found at the source URL.</p>
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
