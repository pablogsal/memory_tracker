
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ListChecks, Cpu } from 'lucide-react';
import { mockBinaries } from '@/lib/mockData'; // mockBinaries no longer has a version field

export default function BinariesPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center text-center">
        <ListChecks className="h-16 w-16 text-primary mb-4" />
        <h1 className="text-4xl font-bold font-headline">Binary Configurations</h1>
        <p className="text-lg text-muted-foreground mt-2 max-w-xl">
          Inspect the available binary compilation flag configurations. These configurations can be applied across different Python versions during benchmark runs.
        </p>
      </div>

      {mockBinaries.length > 0 ? (
        <Card className="max-w-3xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-6 w-6 text-primary" />
              Available Binary Flag Sets
            </CardTitle>
            <CardDescription>
              Each item represents a unique set of compilation flags.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {mockBinaries.map((binary) => (
                <AccordionItem value={binary.id} key={binary.id}>
                  <AccordionTrigger className="text-lg hover:bg-accent/10 px-4 py-3 rounded-md">
                    {binary.name}
                    <span className="text-sm font-mono text-muted-foreground ml-auto mr-2">ID: {binary.id}</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 py-3 bg-muted/30 rounded-b-md">
                    <div className="space-y-2">
                      <h4 className="font-semibold">Compilation Flags:</h4>
                      {binary.flags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {binary.flags.map((flag) => (
                            <Badge key={flag} variant="secondary" className="text-sm">
                              {flag}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No specific flags (Default configuration).</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center text-muted-foreground py-10">
          <p>No binary configurations found.</p>
        </div>
      )}
    </div>
  );
}
