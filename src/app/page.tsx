"use client";

import { useState } from "react";
import { getUrlsFromSitemap } from "@/app/actions";
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

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [urls, setUrls] = useState<string[] | null>(null);
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
    setUrls(null);
    try {
      const scrapedUrls = await getUrlsFromSitemap(sitemapUrl);
      setUrls(scrapedUrls);
      
    } catch (error) {
      console.error("Scraping failed:", error);
      toast({
        variant: "destructive",
        title: "URL Extraction Failed",
        description: "Could not get URLs from the sitemap. Please check the URL and its structure.",
      });
      setUrls([]);
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
              Extract Article URLs from a Sitemap
            </h2>
            <p className="mt-4 text-muted-foreground md:text-xl">
              Enter the URL of an XML sitemap to extract all the article URLs it contains.
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
                {isLoading ? "Extracting..." : "Extract URLs"}
              </Button>
            </div>
          </div>

          {(isLoading || (searched && urls)) && (
            <div className="mx-auto mt-12 max-w-4xl">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText />
                    Extracted URLs
                  </CardTitle>
                  <CardDescription>
                    {isLoading ? "Extraction in progress..." : `Found ${urls?.length || 0} article URLs.`}
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
                    urls && (
                        <div className="space-y-4">
                            {urls.length > 0 ? (
                            <div className="space-y-3">
                                <h4 className="flex items-center gap-2 font-semibold">
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                 Found {urls.length} Article URLs
                                </h4>
                                <ul className="space-y-2 max-h-[400px] overflow-y-auto rounded-md border bg-muted/50 p-4">
                                {urls.map((url) => (
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
                               <p>No article URLs were found in the provided sitemap. Please check the URL and ensure it's a valid sitemap containing article links.</p>
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
