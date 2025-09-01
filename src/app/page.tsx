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
import { Input } from "@/components/ui/input";
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
import { db } from "@/lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [sitemapUrl, setSitemapUrl] = useState(
    "https://www.shriramfinance.in/resources.xml"
  );
  const { toast } = useToast();

  const handleScrape = async () => {
    if (!sitemapUrl) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please enter a valid XML sitemap URL.",
      });
      return;
    }
    setIsLoading(true);
    setSearched(true);
    setArticles(null);
    try {
      const scrapedArticles = await scrape(sitemapUrl);
      setArticles(scrapedArticles);

      if (scrapedArticles.length > 0) {
        const articlesCollection = collection(db, 'articles');
        const dbPromises = scrapedArticles.map(article => {
          const docId = article.id || article.url.replace(/[^a-zA-Z0-9]/g, '');
          const articleRef = doc(articlesCollection, docId);
          return setDoc(articleRef, {
              title: article.title,
              url: article.url,
              content: article.content,
          });
        });
        await Promise.all(dbPromises);
        toast({
          title: "Success",
          description: `${scrapedArticles.length} articles have been scraped and saved.`,
        });
      }
      
    } catch (error) {
      console.error("Scraping failed:", error);
      toast({
        variant: "destructive",
        title: "Scraping Failed",
        description: "Could not scrape articles. Please check the sitemap URL and its structure.",
      });
      setArticles([]);
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
              Scrape Articles from any Sitemap
            </h2>
            <p className="mt-4 text-muted-foreground md:text-xl">
              Enter the URL of an XML sitemap to scrape all the articles it contains.
            </p>
            <div className="mt-8 flex w-full max-w-2xl mx-auto items-center space-x-2">
              <Input
                type="url"
                placeholder="https://example.com/sitemap.xml"
                value={sitemapUrl}
                onChange={(e) => setSitemapUrl(e.target.value)}
                className="flex-1"
                disabled={isLoading}
              />
              <Button
                onClick={handleScrape}
                disabled={isLoading}
              >
                <Sparkles className="mr-2 h-5 w-5" />
                {isLoading ? "Scraping..." : "Scrape Articles"}
              </Button>
            </div>
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
                    {isLoading ? "Scraping in progress..." : `Found ${articles?.length || 0} articles.`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      {[...Array(10)].map((_, i) => (
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
                                Scraped and Saved {articles.length} Articles
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
                                        {article.title}
                                    </a>
                                    </li>
                                ))}
                                </ul>
                            </div>
                            ) : (
                            <div className="text-center text-muted-foreground flex flex-col items-center gap-4">
                               <AlertCircle className="h-10 w-10 text-destructive" />
                               <p>No articles were found at the provided URL. Please check the URL and ensure it's a valid sitemap containing article links.</p>
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
