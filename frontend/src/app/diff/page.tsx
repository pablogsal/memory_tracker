
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GitCompareArrows, Download, ArrowUpDown, Filter, AlertCircle, Info, Code2 } from 'lucide-react';
import type { DiffTableRow, MetricKey, Commit, Binary } from '@/lib/types';
import { METRIC_OPTIONS } from '@/lib/types';
import { api } from '@/lib/api';

interface EnhancedDiffTableRow {
  benchmark_name: string;
  curr_commit_details: Commit;
  prev_commit_details?: Commit;
  curr_python_version_str: string;
  prev_python_version_str?: string;
  
  // High watermark data
  high_watermark_curr: number;
  high_watermark_prev?: number;
  high_watermark_delta_percent?: number;
  
  // Total allocated data
  total_allocated_curr: number;
  total_allocated_prev?: number;
  total_allocated_delta_percent?: number;
}
import CommitTooltipContent from '@/components/diff/CommitTooltipContent';

type SortField = 'benchmark_name' | 'high_watermark_delta_percent' | 'total_allocated_delta_percent';
type SortDirection = 'asc' | 'dsc';

export default function DiffTablePage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [binaries, setBinaries] = useState<Binary[]>([]);
  const [diffData, setDiffData] = useState<EnhancedDiffTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterBenchmarkName, setFilterBenchmarkName] = useState('');
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | undefined>(); 
  const [selectedBinaryId, setSelectedBinaryId] = useState<string | undefined>();
  const [filterThreshold, setFilterThreshold] = useState(0);
  const [showOnlyRegressions, setShowOnlyRegressions] = useState(false);
  const [showOnlyImprovements, setShowOnlyImprovements] = useState(false);

  const [sortField, setSortField] = useState<SortField>('high_watermark_delta_percent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('dsc');

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  const selectedCommitDetails = useMemo(() => commits.find(c => c.sha === selectedCommitSha), [selectedCommitSha, commits]);
  const selectedCommitPythonVersion = useMemo(() => selectedCommitDetails?.python_version, [selectedCommitDetails]);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        
        const [commitsData, binariesData] = await Promise.all([
          api.getCommits(0, 100),
          api.getBinaries()
        ]);
        
        setCommits(commitsData);
        setBinaries(binariesData);
        
        // Set initial selections
        if (commitsData.length > 0) {
          setSelectedCommitSha(commitsData[0].sha);
        }
        if (binariesData.length > 0) {
          setSelectedBinaryId(binariesData[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    
    if (mounted) {
      loadData();
    }
  }, [mounted]);

  // Load diff data when selections change
  useEffect(() => {
    async function loadDiffData() {
      if (!selectedCommitSha || !selectedBinaryId) {
        setDiffData([]);
        return;
      }

      try {
        // Fetch diff data for both metrics
        const [highWatermarkData, totalAllocatedData] = await Promise.all([
          api.getDiffTable(selectedCommitSha, selectedBinaryId, 'high_watermark_bytes'),
          api.getDiffTable(selectedCommitSha, selectedBinaryId, 'total_allocated_bytes')
        ]);

        // Combine the data into enhanced rows
        const enhancedData: EnhancedDiffTableRow[] = [];
        const benchmarkNames = new Set([
          ...highWatermarkData.map(r => r.benchmark_name),
          ...totalAllocatedData.map(r => r.benchmark_name)
        ]);

        benchmarkNames.forEach(benchmarkName => {
          const hwRow = highWatermarkData.find(r => r.benchmark_name === benchmarkName);
          const taRow = totalAllocatedData.find(r => r.benchmark_name === benchmarkName);
          
          if (hwRow || taRow) {
            const baseRow = hwRow || taRow!;
            enhancedData.push({
              benchmark_name: benchmarkName,
              curr_commit_details: baseRow.curr_commit_details,
              prev_commit_details: baseRow.prev_commit_details,
              curr_python_version_str: baseRow.curr_python_version_str,
              prev_python_version_str: baseRow.prev_python_version_str,
              
              // High watermark data
              high_watermark_curr: hwRow?.curr_metric_value || 0,
              high_watermark_prev: hwRow?.prev_metric_value,
              high_watermark_delta_percent: hwRow?.metric_delta_percent,
              
              // Total allocated data
              total_allocated_curr: taRow?.curr_metric_value || 0,
              total_allocated_prev: taRow?.prev_metric_value,
              total_allocated_delta_percent: taRow?.metric_delta_percent,
            });
          }
        });

        setDiffData(enhancedData);
      } catch (err) {
        console.error('Error loading diff data:', err);
        setDiffData([]);
      }
    }

    loadDiffData();
  }, [selectedCommitSha, selectedBinaryId]);


  const filteredAndSortedData = useMemo(() => {
    let data = [...diffData];

    if (filterBenchmarkName) {
      data = data.filter(row => row.benchmark_name.toLowerCase().includes(filterBenchmarkName.toLowerCase()));
    }

    if (filterThreshold > 0) {
      data = data.filter(row => 
        (row.high_watermark_delta_percent !== undefined && Math.abs(row.high_watermark_delta_percent) >= filterThreshold) ||
        (row.total_allocated_delta_percent !== undefined && Math.abs(row.total_allocated_delta_percent) >= filterThreshold)
      );
    }
    if (showOnlyRegressions) {
      data = data.filter(row => 
        (row.high_watermark_delta_percent !== undefined && row.high_watermark_delta_percent > 0) ||
        (row.total_allocated_delta_percent !== undefined && row.total_allocated_delta_percent > 0)
      );
    }
    if (showOnlyImprovements) {
      data = data.filter(row => 
        (row.high_watermark_delta_percent !== undefined && row.high_watermark_delta_percent < 0) ||
        (row.total_allocated_delta_percent !== undefined && row.total_allocated_delta_percent < 0)
      );
    }

    data.sort((a, b) => {
      let compareA: any;
      let compareB: any;

      switch (sortField) {
        case 'benchmark_name':
          compareA = a.benchmark_name;
          compareB = b.benchmark_name;
          break;
        case 'high_watermark_delta_percent':
          compareA = a.high_watermark_delta_percent === undefined ? (sortDirection === 'dsc' ? -Infinity : Infinity) : a.high_watermark_delta_percent;
          compareB = b.high_watermark_delta_percent === undefined ? (sortDirection === 'dsc' ? -Infinity : Infinity) : b.high_watermark_delta_percent;
          break;
        case 'total_allocated_delta_percent':
          compareA = a.total_allocated_delta_percent === undefined ? (sortDirection === 'dsc' ? -Infinity : Infinity) : a.total_allocated_delta_percent;
          compareB = b.total_allocated_delta_percent === undefined ? (sortDirection === 'dsc' ? -Infinity : Infinity) : b.total_allocated_delta_percent;
          break;
        default:
          return 0;
      }
      
      if (compareA < compareB) return sortDirection === 'asc' ? -1 : 1;
      if (compareA > compareB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [
    diffData, filterBenchmarkName, filterThreshold, showOnlyRegressions, 
    showOnlyImprovements, sortField, sortDirection
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'dsc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('dsc'); 
    }
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField === field) {
      return sortDirection === 'asc' ? <ArrowUpDown className="ml-1 h-3 w-3 inline" /> : <ArrowUpDown className="ml-1 h-3 w-3 inline transform rotate-180" />;
    }
    return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-30" />;
  };
  
  const formatDelta = (delta: number | undefined | null) => {
    if (delta === undefined || delta === null) return <span className="text-muted-foreground">N/A</span>;
    if (delta === Infinity) return <span className="text-red-600 dark:text-red-400 font-semibold">New (Prev N/A or Zero)</span>;
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(2)}%`;
  };

  const getDeltaColor = (delta: number | undefined | null) => {
    if (delta === undefined || delta === null) return 'text-muted-foreground';
    if (delta === Infinity) return 'text-red-600 dark:text-red-400 font-semibold';
    if (delta > 5) return 'text-red-600 dark:text-red-400 font-semibold'; 
    if (delta > 0) return 'text-orange-500 dark:text-orange-400'; 
    if (delta < -5) return 'text-green-600 dark:text-green-400 font-semibold'; 
    if (delta < 0) return 'text-emerald-500 dark:text-emerald-400';
    return 'text-foreground';
  };
    
  const getPythonVersionDisplay = (versionStr?: string) => {
    return versionStr ? `(py ${versionStr})` : '';
  }

  if (!mounted || loading) {
    return <div className="space-y-6">
     <h1 className="text-3xl font-bold font-headline">Commit Benchmark Comparison</h1>
     <Card><CardHeader><CardTitle>Filters</CardTitle></CardHeader><CardContent><div className="h-48 animate-pulse bg-muted rounded-md"></div></CardContent></Card>
     <Card><CardHeader><CardTitle>Comparison Table</CardTitle></CardHeader><CardContent><div className="h-96 animate-pulse bg-muted rounded-md"></div></CardContent></Card>
   </div>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-headline">Commit Benchmark Comparison</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
            <p className="text-lg">Error loading data</p>
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-headline">Commit Benchmark Comparison</h1>
        <p className="text-muted-foreground">
          Select a commit to see changes compared to its direct predecessor (for the same Python major.minor version), using the chosen binary flags.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5 text-primary" /> Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="space-y-1">
              <Label htmlFor="filter-commit">Commit</Label>
              <Select value={selectedCommitSha} onValueChange={setSelectedCommitSha}>
                <SelectTrigger id="filter-commit">
                  <SelectValue placeholder="Select Commit" />
                </SelectTrigger>
                <SelectContent>
                  {commits.map(commit => (
                    <SelectItem key={commit.sha} value={commit.sha}>
                      <div className="flex items-center gap-2">
                        {commit.sha.substring(0, 7)}
                        <span className="text-xs text-muted-foreground truncate">
                          (py {commit.python_version.major}.{commit.python_version.minor}.{commit.python_version.patch}, {commit.message.substring(0,30)}{commit.message.length > 30 ? '...' : ''})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
               {selectedCommitDetails && (
                <div className="flex items-center gap-2 mt-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs px-2 py-1 h-auto text-muted-foreground">
                        <Info className="h-3 w-3 mr-1" /> View Commit Details
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start">
                      <CommitTooltipContent commit={selectedCommitDetails} />
                    </TooltipContent>
                  </Tooltip>
                  {selectedCommitPythonVersion && (
                    <span className="text-xs text-muted-foreground flex items-center">
                      <Code2 className="h-3 w-3 mr-1 text-primary" /> Python {selectedCommitPythonVersion.major}.{selectedCommitPythonVersion.minor}.{selectedCommitPythonVersion.patch}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="filter-binary">Binary Flags</Label>
              <Select value={selectedBinaryId} onValueChange={setSelectedBinaryId}>
                <SelectTrigger id="filter-binary"><SelectValue placeholder="Select Binary Flags" /></SelectTrigger>
                <SelectContent>
                  {binaries.map(binary => <SelectItem key={binary.id} value={binary.id}>{binary.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            

            <div className="space-y-1">
              <Label htmlFor="filter-benchmark-name">Benchmark Name</Label>
              <Input id="filter-benchmark-name" placeholder="e.g., pyperformance_go" value={filterBenchmarkName} onChange={e => setFilterBenchmarkName(e.target.value)} />
            </div>
             <div className="space-y-1">
              <Label htmlFor="filter-threshold">Min. Change Threshold (%)</Label>
              <Input id="filter-threshold" type="number" placeholder="e.g., 5" value={filterThreshold} onChange={e => setFilterThreshold(Number(e.target.value))} />
            </div>
            <div className="flex items-center space-x-2 pt-4 md:pt-0 lg:pt-4"> {/* Adjusted for layout */}
              <Checkbox id="show-regressions" checked={showOnlyRegressions} onCheckedChange={c => setShowOnlyRegressions(c as boolean)} />
              <Label htmlFor="show-regressions">Only Regressions</Label>
            </div>
            <div className="flex items-center space-x-2 pt-4 md:pt-0 lg:pt-4"> {/* Adjusted for layout */}
              <Checkbox id="show-improvements" checked={showOnlyImprovements} onCheckedChange={c => setShowOnlyImprovements(c as boolean)} />
              <Label htmlFor="show-improvements">Only Improvements</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitCompareArrows className="h-6 w-6 text-primary" />
                Comparison Table
              </CardTitle>
              {selectedCommitDetails && selectedCommitPythonVersion && (
                <CardDescription>
                  Showing {filteredAndSortedData.length} comparisons for commit <Tooltip><TooltipTrigger asChild><span className="font-mono cursor-help">{selectedCommitSha?.substring(0,7)}</span></TooltipTrigger><TooltipContent><CommitTooltipContent commit={selectedCommitDetails} /></TooltipContent></Tooltip> 
                  (Python {selectedCommitPythonVersion.major}.{selectedCommitPythonVersion.minor}.{selectedCommitPythonVersion.patch}) vs. its parent (if same Python major.minor).
                  <br />
                  Binary: {binaries.find(b=>b.id === selectedBinaryId)?.name}.
                  Displaying both high watermark and total allocated bytes with percentage changes.
                </CardDescription>
              )}
            </div>
            <Button variant="outline" size="sm" disabled>
              <Download className="mr-2 h-4 w-4" />
              Export (CSV)
            </Button>
          </CardHeader>
          <CardContent>
            {filteredAndSortedData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => handleSort('benchmark_name')}>
                      Benchmark Name {getSortIndicator('benchmark_name')}
                    </TableHead>
                    <TableHead className="text-center" colSpan={3}>High Watermark (Bytes)</TableHead>
                    <TableHead className="text-center" colSpan={3}>Total Allocated (Bytes)</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead className="text-right cursor-pointer whitespace-nowrap" onClick={() => handleSort('high_watermark_delta_percent')}>
                      Delta {getSortIndicator('high_watermark_delta_percent')}
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">Previous</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Current</TableHead>
                    <TableHead className="text-right cursor-pointer whitespace-nowrap" onClick={() => handleSort('total_allocated_delta_percent')}>
                      Delta {getSortIndicator('total_allocated_delta_percent')}
                    </TableHead>
                    <TableHead className="text-right whitespace-nowrap">Previous</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Current</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedData.map((row, index) => (
                    <TableRow key={`${row.benchmark_name}-${row.curr_commit_details.sha}-${index}`}>
                      <TableCell className="font-medium">{row.benchmark_name}</TableCell>
                      
                      {/* High Watermark columns */}
                      <TableCell className={`text-right ${getDeltaColor(row.high_watermark_delta_percent)}`}>
                        {formatDelta(row.high_watermark_delta_percent)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.high_watermark_prev !== undefined && row.high_watermark_prev !== null ? 
                          row.high_watermark_prev.toLocaleString() : 
                          <span className="text-muted-foreground">N/A</span>
                        }
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.high_watermark_curr.toLocaleString()}
                      </TableCell>
                      
                      {/* Total Allocated columns */}
                      <TableCell className={`text-right ${getDeltaColor(row.total_allocated_delta_percent)}`}>
                        {formatDelta(row.total_allocated_delta_percent)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.total_allocated_prev !== undefined && row.total_allocated_prev !== null ? 
                          row.total_allocated_prev.toLocaleString() : 
                          <span className="text-muted-foreground">N/A</span>
                        }
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.total_allocated_curr.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p className="text-lg">No comparisons match your current filters or data is unavailable.</p>
                <p className="text-sm">Ensure the selected commit has a predecessor with comparable data for the same Python major.minor version, chosen binary, and metric.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
