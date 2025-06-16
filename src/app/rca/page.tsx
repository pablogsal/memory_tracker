"use client";

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BrainCircuit, Lightbulb, AlertTriangle, Loader2, FileText } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Progress } from "@/components/ui/progress";

// Import AI flow - ensure this path is correct
import { suggestRootCauses, type RootCauseAnalysisInput, type RootCauseSuggestion } from '@/ai/flows/root-cause-analysis-flow';
import { useToast } from "@/hooks/use-toast";

const RCAFormSchema = z.object({
  pythonVersion: z.string().min(1, "Python version is required (e.g., 3.12)"),
  compilerFlags: z.string().min(1, "Compiler flags are required (e.g., debug, nogil)"), // Comma-separated
  benchmarkName: z.string().min(1, "Benchmark name is required"),
  commitSha: z.string().min(7, "Commit SHA is required (min 7 chars)"),
  metricDelta: z.coerce.number().refine(val => !isNaN(val), "Metric delta must be a number")
    .refine(val => val !== 0, "Metric delta cannot be zero for analysis"),
});

type RCAFormValues = z.infer<typeof RCAFormSchema>;

export default function RootCauseAnalysisPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<RootCauseSuggestion[]>([]);

  const { control, handleSubmit, formState: { errors } } = useForm<RCAFormValues>({
    resolver: zodResolver(RCAFormSchema),
    defaultValues: {
      pythonVersion: '3.12.1',
      compilerFlags: 'debug, nogil',
      benchmarkName: 'pyperformance_json_dumps',
      commitSha: 'a1b2c3d',
      metricDelta: 15.5, // Example positive delta for regression
    },
  });

  const onSubmit = async (data: RCAFormValues) => {
    setIsLoading(true);
    setSuggestions([]);
    
    const inputForAI: RootCauseAnalysisInput = {
      ...data,
      compilerFlags: data.compilerFlags.split(',').map(flag => flag.trim()).filter(flag => flag),
    };

    try {
      const result = await suggestRootCauses(inputForAI);
      if (result && result.length > 0) {
        setSuggestions(result);
        toast({
          title: "Analysis Complete",
          description: `${result.length} suggestions generated.`,
        });
      } else {
        setSuggestions([]);
        toast({
          variant: "default",
          title: "No specific suggestions",
          description: "The AI could not generate specific suggestions for this input. Try adjusting the parameters.",
        });
      }
    } catch (error) {
      console.error("Error calling suggestRootCauses:", error);
      setSuggestions([]);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: "An error occurred while generating suggestions. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <header className="text-center mb-10">
        <BrainCircuit className="h-16 w-16 text-primary mx-auto mb-4" />
        <h1 className="text-4xl font-bold font-headline">Root Cause Analysis Assistant</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Get AI-powered insights into potential causes of CPython performance regressions.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Regression Details</CardTitle>
            <CardDescription>Provide information about the observed performance regression.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="pythonVersion">Python Version</Label>
                <Controller name="pythonVersion" control={control} render={({ field }) => <Input id="pythonVersion" placeholder="e.g., 3.12 or 3.13.0a1" {...field} />} />
                {errors.pythonVersion && <p className="text-sm text-destructive mt-1">{errors.pythonVersion.message}</p>}
              </div>
              <div>
                <Label htmlFor="compilerFlags">Compiler Flags (comma-separated)</Label>
                <Controller name="compilerFlags" control={control} render={({ field }) => <Input id="compilerFlags" placeholder="e.g., debug, nogil, opt" {...field} />} />
                {errors.compilerFlags && <p className="text-sm text-destructive mt-1">{errors.compilerFlags.message}</p>}
              </div>
              <div>
                <Label htmlFor="benchmarkName">Benchmark Name</Label>
                <Controller name="benchmarkName" control={control} render={({ field }) => <Input id="benchmarkName" placeholder="e.g., pyperformance_go" {...field} />} />
                {errors.benchmarkName && <p className="text-sm text-destructive mt-1">{errors.benchmarkName.message}</p>}
              </div>
              <div>
                <Label htmlFor="commitSha">Commit SHA</Label>
                <Controller name="commitSha" control={control} render={({ field }) => <Input id="commitSha" placeholder="e.g., a1b2c3d" {...field} />} />
                {errors.commitSha && <p className="text-sm text-destructive mt-1">{errors.commitSha.message}</p>}
              </div>
              <div>
                <Label htmlFor="metricDelta">Metric Delta (%)</Label>
                <Controller name="metricDelta" control={control} render={({ field }) => <Input id="metricDelta" type="number" step="0.1" placeholder="e.g., 10.5 for 10.5% regression" {...field} />} />
                {errors.metricDelta && <p className="text-sm text-destructive mt-1">{errors.metricDelta.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</> : 'Suggest Root Causes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-6 w-6 text-accent" />
              AI Suggestions
            </CardTitle>
            <CardDescription>Potential root causes based on the provided information.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Generating insights, please wait...</p>
              </div>
            )}
            {!isLoading && suggestions.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No suggestions yet. Fill the form and click "Suggest Root Causes".</p>
              </div>
            )}
            {!isLoading && suggestions.length > 0 && (
              <Accordion type="single" collapsible className="w-full">
                {suggestions.map((suggestion, index) => (
                  <AccordionItem value={`item-${index}`} key={index}>
                    <AccordionTrigger className="text-left hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-2">
                        <span className="flex-1 font-medium truncate" title={suggestion.suggestion}>
                          {index + 1}. {suggestion.suggestion}
                        </span>
                        <Badge variant={suggestion.confidence > 0.7 ? "default" : suggestion.confidence > 0.4 ? "secondary" : "outline"} 
                               className="ml-2 shrink-0"
                               style={suggestion.confidence > 0.7 ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' } : {}}>
                          Conf: {(suggestion.confidence * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 p-4 bg-muted/30 rounded-b-md">
                      <div className="flex items-center">
                        <Label className="w-28 shrink-0">Confidence:</Label>
                        <Progress value={suggestion.confidence * 100} className="w-full h-3" />
                        <span className="ml-2 text-xs w-12 text-right">{(suggestion.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div>
                        <Label>Rationale:</Label>
                        <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{suggestion.rationale}</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
