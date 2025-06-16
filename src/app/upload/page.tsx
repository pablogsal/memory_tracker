"use client";

import React, { useState, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UploadCloud, AlertTriangle, CheckCircle, PlusCircle, XCircle, FileJson } from 'lucide-react';
import { mockCommits, mockBinaries } from '@/lib/mockData'; // For dropdown options
import { useToast } from "@/hooks/use-toast";

// Simplified schema for frontend validation. Backend would do more thorough validation.
const BenchmarkFileSchema = z.object({
  name: z.string(),
  content: z.string(), // Base64 encoded or JSON string
  parsedJson: z.any().optional(), // Store parsed JSON if valid
});

const UploadFormSchema = z.object({
  commitSha: z.string().min(7, "Commit SHA is required (min 7 chars)"),
  binaryId: z.string().min(1, "Binary configuration is required"),
  files: z.array(BenchmarkFileSchema).min(1, "At least one benchmark file is required"),
});

type UploadFormValues = z.infer<typeof UploadFormSchema>;

export default function UploadPage() {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<Array<{ fileName: string; status: 'success' | 'error'; message: string }>>([]);

  const { control, handleSubmit, register, setValue, watch, reset, formState: { errors } } = useForm<UploadFormValues>({
    resolver: zodResolver(UploadFormSchema),
    defaultValues: {
      commitSha: '',
      binaryId: '',
      files: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "files",
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length > 0) {
      for (const file of selectedFiles) {
        if (file.type === "application/json") {
          try {
            const content = await file.text();
            const parsedJson = JSON.parse(content); 
            // Basic validation (example: check for a common key)
            if (typeof parsedJson.high_watermark_bytes === 'number') {
               append({ name: file.name, content, parsedJson });
            } else {
              toast({
                variant: "destructive",
                title: "Invalid JSON structure",
                description: `File ${file.name} does not seem to be a valid benchmark result. Missing 'high_watermark_bytes'.`,
              });
            }
          } catch (error) {
             toast({
                variant: "destructive",
                title: "Invalid JSON file",
                description: `File ${file.name} could not be parsed as JSON.`,
              });
          }
        } else {
           toast({
              variant: "destructive",
              title: "Invalid file type",
              description: `File ${file.name} is not a JSON file.`,
            });
        }
      }
    }
    // Reset file input to allow selecting the same file again after removal
    event.target.value = '';
  };

  const onSubmit = async (data: UploadFormValues) => {
    setIsUploading(true);
    setUploadResults([]);
    console.log("Submitting data:", data);

    // Mock upload process
    await new Promise(resolve => setTimeout(resolve, 2000));

    const results = data.files.map(file => {
      // Simulate backend validation and extraction
      if (file.parsedJson && file.parsedJson.benchmark_name && file.parsedJson.high_watermark_bytes) {
        return { fileName: file.name, status: 'success' as const, message: `Extracted benchmark: ${file.parsedJson.benchmark_name}` };
      } else if (file.parsedJson && file.parsedJson.high_watermark_bytes) { // Check if it was parsed but maybe missing name
         return { fileName: file.name, status: 'success' as const, message: `Successfully processed (auto-detected name or generic).` };
      }
      return { fileName: file.name, status: 'error' as const, message: 'Invalid structure or missing key fields.' };
    });
    
    setUploadResults(results);
    setIsUploading(false);

    const allSuccessful = results.every(r => r.status === 'success');
    if (allSuccessful) {
      toast({
        title: "Upload Successful",
        description: "All benchmark files processed successfully.",
      });
      reset(); // Clear the form on full success
    } else {
      toast({
        variant: "destructive",
        title: "Upload Partially Successful",
        description: "Some files had issues. Check results below.",
      });
    }
  };

  // This is a placeholder. In a real app, you'd have proper auth.
  const isAuthenticated = true; 

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">You must be authenticated to upload benchmark data.</p>
        <Button asChild className="mt-4">
          <a href="/api/auth/signin">Sign In (Placeholder)</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold font-headline mb-8 text-center">Upload Benchmark Results</h1>
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="h-6 w-6 text-primary" />
            New Benchmark Data
          </CardTitle>
          <CardDescription>
            Upload JSON files containing benchmark results. Ensure data is correctly formatted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label htmlFor="commitSha">Commit SHA</Label>
              <Controller
                name="commitSha"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="commitSha">
                      <SelectValue placeholder="Select or type Commit SHA" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockCommits.map(commit => (
                        <SelectItem key={commit.sha} value={commit.sha}>
                          {commit.sha.substring(0,12)}... ({commit.message.substring(0,30)}...)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
               {/* Allow typing SHA if not in mock list */}
              <Input 
                placeholder="Or type full Commit SHA" 
                {...register("commitSha")} 
                className="mt-1" 
              />
              {errors.commitSha && <p className="text-sm text-destructive mt-1">{errors.commitSha.message}</p>}
            </div>

            <div>
              <Label htmlFor="binaryId">Binary Configuration</Label>
               <Controller
                name="binaryId"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="binaryId">
                      <SelectValue placeholder="Select Binary Configuration" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockBinaries.map(binary => (
                        <SelectItem key={binary.id} value={binary.id}>
                          {binary.id} (Python {binary.version.major}.{binary.version.minor}.{binary.version.patch}, Flags: {binary.flags.join(', ') || 'none'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.binaryId && <p className="text-sm text-destructive mt-1">{errors.binaryId.message}</p>}
            </div>
            
            <div>
              <Label htmlFor="benchmarkFiles">Benchmark JSON File(s)</Label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md border-border hover:border-primary transition-colors">
                <div className="space-y-1 text-center">
                  <FileJson className="mx-auto h-12 w-12 text-muted-foreground" />
                  <div className="flex text-sm text-muted-foreground">
                    <Label
                      htmlFor="file-upload-input"
                      className="relative cursor-pointer rounded-md font-medium text-primary hover:text-primary/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-ring"
                    >
                      <span>Upload files</span>
                      <Input id="file-upload-input" type="file" className="sr-only" multiple accept=".json" onChange={handleFileChange} />
                    </Label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-muted-foreground">JSON files up to 10MB each</p>
                </div>
              </div>
              {errors.files && <p className="text-sm text-destructive mt-1">{errors.files.message || (errors.files as any).root?.message}</p>}
            </div>

            {fields.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files:</Label>
                <ul className="space-y-2 max-h-60 overflow-y-auto p-2 border rounded-md bg-muted/50">
                  {fields.map((field, index) => (
                    <li key={field.id} className="flex items-center justify-between p-2 bg-background rounded-md shadow-sm">
                      <span className="text-sm truncate" title={field.name}>{field.name}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} aria-label={`Remove ${field.name}`}>
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Upload Benchmarks'}
            </Button>
          </form>

          {uploadResults.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-2">Ingestion Results:</h3>
              <ul className="space-y-2">
                {uploadResults.map((result, index) => (
                  <li key={index} className={`p-3 rounded-md flex items-start ${result.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    {result.status === 'success' ? <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 mt-0.5 shrink-0" /> : <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 shrink-0" />}
                    <div>
                      <p className={`font-semibold ${result.status === 'success' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>{result.fileName}</p>
                      <p className={`text-sm ${result.status === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{result.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
