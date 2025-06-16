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
import { GitCompareArrows, Download, ArrowUpDown, Filter, AlertCircle } from 'lucide-react';
import type { DiffTableRow, MetricKey } from '@/lib/types';
import { getMockDiffTableRows, mockBinaries, mockCommits } from '@/lib/mockData';
import { METRIC_OPTIONS } from '@/lib/types';
import CommitTooltipContent from '@/components/diff/CommitTooltipContent';

type SortField = 'benchmark_name' | 'abs_change' | 'rel_change';
type SortDirection = 'asc' | 'dsc';

export default function DiffTablePage() {
  const [filterBenchmarkName, setFilterBenchmarkName] = useState('');
  const [filterCommitRangeStart, setFilterCommitRangeStart] = useState('');
  const [filterCommitRangeEnd, setFilterCommitRangeEnd] = useState('');
  const [selectedBinaryId, setSelectedBinaryId] = useState<string | undefined>(mockBinaries[0]?.id);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>(METRIC_OPTIONS[0].value);
  const [filterThreshold, setFilterThreshold] = useState(0);
  const [showOnlyRegressions, setShowOnlyRegressions] = useState(false);
  const [showOnlyImprovements, setShowOnlyImprovements] = useState(false);

  const [sortField, setSortField] = useState<SortField>('rel_change');
  const [sortDirection, setSortDirection] = useState<SortDirection>('dsc');

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  const mockDiffData = useMemo(() => getMockDiffTableRows(selectedMetric), [selectedMetric]);

  const filteredAndSortedData = useMemo(() => {
    let data = [...mockDiffData];

    if (selectedBinaryId) {
      // This filtering should ideally happen when fetching/generating `getMockDiffTableRows`
      // For now, we assume `getMockDiffTableRows` already considers the selected binary via metric.
      // If not, we'd filter by `row.curr_commit.binary.id === selectedBinaryId` if `binary` was on `DiffTableRow`.
    }

    if (filterBenchmarkName) {
      data = data.filter(row => row.benchmark_name.toLowerCase().includes(filterBenchmarkName.toLowerCase()));
    }

    // Simplified commit range filtering by SHA prefix matching
    if (filterCommitRangeStart) {
      data = data.filter(row => row.curr_commit_sha.startsWith(filterCommitRangeStart) || (row.prev_commit_sha && row.prev_commit_sha.startsWith(filterCommitRangeStart)));
    }
    if (filterCommitRangeEnd) {
       data = data.filter(row => {
        const startIndex = mockCommits.findIndex(c => c.sha.startsWith(filterCommitRangeStart));
        const endIndex = mockCommits.findIndex(c => c.sha.startsWith(filterCommitRangeEnd));
        if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) return true; // No range or invalid

        const currCommitIndex = mockCommits.findIndex(c => c.sha === row.curr_commit_sha);
        return currCommitIndex >= startIndex && currCommitIndex <= endIndex;
      });
    }


    if (filterThreshold > 0) {
      data = data.filter(row => row.metric_delta_percent !== undefined && Math.abs(row.metric_delta_percent) >= filterThreshold);
    }
    if (showOnlyRegressions) {
      data = data.filter(row => row.metric_delta_percent !== undefined && row.metric_delta_percent > 0);
    }
    if (showOnlyImprovements) {
      data = data.filter(row => row.metric_delta_percent !== undefined && row.metric_delta_percent < 0);
    }

    // Sorting
    data.sort((a, b) => {
      let compareA: any;
      let compareB: any;

      switch (sortField) {
        case 'benchmark_name':
          compareA = a.benchmark_name;
          compareB = b.benchmark_name;
          break;
        case 'abs_change':
          compareA = Math.abs((a.curr_metric_value ?? 0) - (a.prev_metric_value ?? 0));
          compareB = Math.abs((b.curr_metric_value ?? 0) - (b.prev_metric_value ?? 0));
          break;
        case 'rel_change':
          compareA = Math.abs(a.metric_delta_percent ?? 0);
          compareB = Math.abs(b.metric_delta_percent ?? 0);
          // Handle cases where delta is undefined (e.g. first commit)
          if (a.metric_delta_percent === undefined) compareA = -Infinity; // or some other sentinel
          if (b.metric_delta_percent === undefined) compareB = -Infinity;
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
    mockDiffData, filterBenchmarkName, filterCommitRangeStart, filterCommitRangeEnd, selectedBinaryId, 
    filterThreshold, showOnlyRegressions, showOnlyImprovements, sortField, sortDirection, selectedMetric
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'dsc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('dsc'); // Default to descending for new field
    }
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField === field) {
      return sortDirection === 'asc' ? <ArrowUpDown className="ml-2 h-4 w-4 inline" /> : <ArrowUpDown className="ml-2 h-4 w-4 inline transform rotate-180" />;
    }
    return <ArrowUpDown className="ml-2 h-4 w-4 inline opacity-50" />;
  };
  
  const formatDelta = (delta: number | undefined) => {
    if (delta === undefined) return 'N/A';
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(2)}%`;
  };

  const getDeltaColor = (delta: number | undefined) => {
    if (delta === undefined) return 'text-muted-foreground';
    if (delta > 5) return 'text-red-600 dark:text-red-400 font-semibold'; // Significant regression
    if (delta > 0) return 'text-orange-500 dark:text-orange-400'; // Minor regression
    if (delta < -5) return 'text-green-600 dark:text-green-400 font-semibold'; // Significant improvement
    if (delta < 0) return 'text-emerald-500 dark:text-emerald-400'; // Minor improvement
    return 'text-foreground';
  };

  if (!mounted) {
    return <div className="space-y-6">
     <h1 className="text-3xl font-bold font-headline">Commit-to-Commit Benchmark Comparison</h1>
     <Card><CardHeader><CardTitle>Filters</CardTitle></CardHeader><CardContent><div className="h-40 animate-pulse bg-muted rounded-md"></div></CardContent></Card>
     <Card><CardHeader><CardTitle>Comparison Table</CardTitle></CardHeader><CardContent><div className="h-96 animate-pulse bg-muted rounded-md"></div></CardContent></Card>
   </div>;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-headline">Commit-to-Commit Benchmark Comparison</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5 text-primary" /> Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <Label htmlFor="filter-benchmark-name">Benchmark Name</Label>
              <Input id="filter-benchmark-name" placeholder="e.g., pyperformance_go" value={filterBenchmarkName} onChange={e => setFilterBenchmarkName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="filter-binary">Binary Configuration</Label>
              <Select value={selectedBinaryId} onValueChange={setSelectedBinaryId}>
                <SelectTrigger id="filter-binary"><SelectValue placeholder="Select Binary" /></SelectTrigger>
                <SelectContent>
                  {mockBinaries.map(binary => <SelectItem key={binary.id} value={binary.id}>{binary.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="metric-select-diff">Metric</Label>
              <Select value={selectedMetric} onValueChange={(val) => setSelectedMetric(val as MetricKey)}>
                <SelectTrigger id="metric-select-diff"><SelectValue placeholder="Select Metric" /></SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="filter-threshold">Min. Change Threshold (%)</Label>
              <Input id="filter-threshold" type="number" placeholder="e.g., 5" value={filterThreshold} onChange={e => setFilterThreshold(Number(e.target.value))} />
            </div>
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="filter-commit-start">Commit Range Start (SHA)</Label>
                <Input id="filter-commit-start" placeholder="Commit SHA prefix" value={filterCommitRangeStart} onChange={e => setFilterCommitRangeStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="filter-commit-end">Commit Range End (SHA)</Label>
                <Input id="filter-commit-end" placeholder="Commit SHA prefix" value={filterCommitRangeEnd} onChange={e => setFilterCommitRangeEnd(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-4">
              <Checkbox id="show-regressions" checked={showOnlyRegressions} onCheckedChange={c => setShowOnlyRegressions(c as boolean)} />
              <Label htmlFor="show-regressions">Only Regressions</Label>
            </div>
            <div className="flex items-center space-x-2 pt-4">
              <Checkbox id="show-improvements" checked={showOnlyImprovements} onCheckedChange={c => setShowOnlyImprovements(c as boolean)} />
              <Label htmlFor="show-improvements">Only Improvements</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitCompareArrows className="h-6 w-6 text-primary" />
                Comparison Table
              </CardTitle>
              <CardDescription>
                Showing {filteredAndSortedData.length} comparisons. Metric: {selectedMetric.replace(/_/g, ' ')}.
              </CardDescription>
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
                    <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => handleSort('benchmark_name')}>Benchmark Name {getSortIndicator('benchmark_name')}</TableHead>
                    <TableHead className="whitespace-nowrap">Prev. Commit</TableHead>
                    <TableHead className="whitespace-nowrap">Curr. Commit</TableHead>
                    <TableHead className="text-right cursor-pointer whitespace-nowrap" onClick={() => handleSort('rel_change')}>Metric Delta {getSortIndicator('rel_change')}</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Prev. Value</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Curr. Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedData.map((row, index) => (
                    <TableRow key={`${row.benchmark_name}-${row.curr_commit_sha}-${index}`}>
                      <TableCell className="font-medium">{row.benchmark_name}</TableCell>
                      <TableCell>
                        {row.prev_commit_sha && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
                                {row.prev_commit_sha.substring(0, 7)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="start">
                              <CommitTooltipContent commit={row.prev_commit} />
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-mono cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
                              {row.curr_commit_sha.substring(0, 7)}
                            </span>
                          </TooltipTrigger>
                           <TooltipContent side="top" align="start">
                             <CommitTooltipContent commit={row.curr_commit} />
                           </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className={`text-right ${getDeltaColor(row.metric_delta_percent)}`}>{formatDelta(row.metric_delta_percent)}</TableCell>
                      <TableCell className="text-right font-mono">{row.prev_metric_value !== undefined ? row.prev_metric_value.toLocaleString() : 'N/A'}</TableCell>
                      <TableCell className="text-right font-mono">{row.curr_metric_value.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p className="text-lg">No comparisons match your current filters.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
