
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ListChecks, Settings, Code2, AlertCircle, Zap, Bug, Gauge, Shield, Search } from 'lucide-react';
import type { Binary } from '@/lib/types';
import { api } from '@/lib/api';

export default function BinariesPage() {
  const [binaries, setBinaries] = useState<Binary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBinaries() {
      try {
        setLoading(true);
        setError(null);
        const binariesData = await api.getBinaries();
        setBinaries(binariesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load binaries');
      } finally {
        setLoading(false);
      }
    }

    loadBinaries();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col items-center text-center">
          <ListChecks className="h-16 w-16 text-primary mb-4" />
          <h1 className="text-4xl font-bold font-headline">Binary Configurations</h1>
          <div className="h-4 w-96 bg-muted animate-pulse rounded mt-2"></div>
        </div>
        <Card className="max-w-3xl mx-auto">
          <CardContent className="p-8">
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-6 w-48 bg-muted animate-pulse rounded"></div>
                  <div className="h-4 w-full bg-muted animate-pulse rounded"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col items-center text-center">
          <ListChecks className="h-16 w-16 text-primary mb-4" />
          <h1 className="text-4xl font-bold font-headline">Binary Configurations</h1>
        </div>
        <Card className="max-w-3xl mx-auto">
          <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
            <p className="text-lg">Error loading binaries</p>
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Helper function to get icon and description for each binary type
  const getBinaryInfo = (binary: Binary) => {
    const info = {
      default: {
        icon: Settings,
        description: "Standard CPython build with default compilation settings. Used as baseline for performance comparisons.",
        color: "text-primary",
        bgColor: "bg-muted/50 border-border hover:bg-muted/70",
        accentColor: "border-l-4 border-l-blue-500",
      },
      debug: {
        icon: Bug,
        description: "Debug build with additional runtime checks and debugging symbols. Higher memory usage but better error detection.",
        color: "text-destructive",
        bgColor: "bg-muted/50 border-border hover:bg-muted/70",
        accentColor: "border-l-4 border-l-red-500",
      },
      nogil: {
        icon: Zap,
        description: "Experimental build without the Global Interpreter Lock (GIL). Enables true parallelism for CPU-bound tasks.",
        color: "text-yellow-600 dark:text-yellow-400",
        bgColor: "bg-muted/50 border-border hover:bg-muted/70",
        accentColor: "border-l-4 border-l-yellow-500",
      },
      "debug-nogil": {
        icon: Shield,
        description: "Debug build combined with no-GIL features. Best for development and testing of parallel applications.",
        color: "text-purple-600 dark:text-purple-400",
        bgColor: "bg-muted/50 border-border hover:bg-muted/70",
        accentColor: "border-l-4 border-l-purple-500",
      },
      lto: {
        icon: Gauge,
        description: "Link Time Optimization enabled. Performs cross-module optimizations for better performance.",
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-muted/50 border-border hover:bg-muted/70",
        accentColor: "border-l-4 border-l-green-500",
      },
      pgo: {
        icon: Zap,
        description: "Profile Guided Optimization build. Uses runtime profiling data to optimize frequently executed code paths.",
        color: "text-indigo-600 dark:text-indigo-400",
        bgColor: "bg-muted/50 border-border hover:bg-muted/70",
        accentColor: "border-l-4 border-l-indigo-500",
      },
      trace: {
        icon: Search,
        description: "Build with trace reference counting enabled. Useful for memory leak detection and debugging.",
        color: "text-teal-600 dark:text-teal-400",
        bgColor: "bg-muted/50 border-border hover:bg-muted/70",
        accentColor: "border-l-4 border-l-teal-500",
      },
      valgrind: {
        icon: Shield,
        description: "Build optimized for Valgrind memory debugging tool. Includes additional instrumentation for memory analysis.",
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-muted/50 border-border hover:bg-muted/70",
        accentColor: "border-l-4 border-l-orange-500",
      },
    };
    return info[binary.id as keyof typeof info] || info.default;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center text-center">
        <ListChecks className="h-16 w-16 text-primary mb-4" />
        <h1 className="text-4xl font-bold font-headline">Binary Configurations</h1>
        <p className="text-lg text-muted-foreground mt-2 max-w-2xl">
          Explore different CPython compilation configurations. Each binary represents a unique combination of 
          compilation flags that affects performance, debugging capabilities, and memory usage patterns.
        </p>
      </div>

      {binaries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {binaries.map((binary) => {
            const info = getBinaryInfo(binary);
            const IconComponent = info.icon;
            
            return (
              <Card 
                key={binary.id} 
                className={`hover:shadow-xl transition-all duration-300 hover:scale-105 ${info.bgColor} ${info.accentColor}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <IconComponent className={`h-8 w-8 ${info.color}`} />
                    <Badge variant="outline" className="font-mono text-xs">
                      {binary.id}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{binary.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription className="text-sm leading-relaxed">
                    {info.description}
                  </CardDescription>
                  
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                      <Code2 className="h-4 w-4" />
                      Compilation Flags
                    </h4>
                    {binary.flags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {binary.flags.map((flag, index) => (
                          <Badge 
                            key={index} 
                            variant="secondary" 
                            className="font-mono text-xs px-2 py-1"
                          >
                            {flag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        No additional flags
                      </Badge>
                    )}
                  </div>

                  {/* Performance hint */}
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Gauge className="h-3 w-3" />
                      {binary.id === 'pgo' && "Highest performance"}
                      {binary.id === 'lto' && "Optimized performance"}
                      {binary.id === 'default' && "Baseline performance"}
                      {binary.id === 'nogil' && "Parallel performance"}
                      {(binary.id === 'debug' || binary.id === 'debug-nogil') && "Development build"}
                      {(binary.id === 'trace' || binary.id === 'valgrind') && "Debugging build"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Settings className="w-16 h-16 mb-4" />
            <p className="text-lg">No binary configurations found</p>
            <p className="text-sm">Check your database or add some binary configurations.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
