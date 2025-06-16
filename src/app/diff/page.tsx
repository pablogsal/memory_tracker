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
import { GitCompareArrows, Download, ArrowUpDown, Filter, AlertCircle, Info } from 'lucide-react';
import type { DiffTableRow, MetricKey, PythonVersionFilterOption, Commit } from '@/lib/types';
import { getMockDiffTableRows, mockBinaries, mockCommits, mockPythonVersionOptions } from '@/lib/mockData';
import { METRIC_OPTIONS } from '@/lib/types';
import CommitTooltipContent from '@/components/diff/CommitTooltipContent';

type SortField = 'benchmark_name' | 'metric_delta_percent';
type SortDirection = 'asc' | 'dsc';

export default function DiffTablePage() {
  const [filterBenchmarkName, setFilterBenchmarkName] = useState('');
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | undefined>(mockCommits[0]?.sha); 
  const [selectedBinaryId, setSelectedBinaryId] = useState<string | undefined>(mockBinaries[0]?.id);
  const [selectedPythonVersionKey, setSelectedPythonVersionKey] = useState<string | undefined>(
    mockPythonVersionOptions[0]?.label
  );
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>(METRIC_OPTIONS[0].value);
  const [filterThreshold, setFilterThreshold] = useState(0);
  const [showOnlyRegressions, setShowOnlyRegressions] = useState(false);
  const [showOnlyImprovements, setShowOnlyImprovements] = useState(false);

  const [sortField, setSortField] = useState<SortField>('metric_delta_percent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('dsc');

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  const selectedCommitDetails = useMemo(() => mockCommits.find(c => c.sha === selectedCommitSha), [selectedCommitSha]);

  const diffData = useMemo(() => {
    if (!selectedCommitSha || !selectedBinaryId || !selectedPythonVersionKey || !selectedMetric) {
      return [];
    }
    const versionOption = mockPythonVersionOptions.find(v => v.label === selectedPythonVersionKey);
    if (!versionOption) return [];

    return getMockDiffTableRows(
      selectedCommitSha,
      selectedBinaryId,
      versionOption.major,
      versionOption.minor,
      selectedMetric
    );
  }, [selectedCommitSha, selectedBinaryId, selectedPythonVersionKey, selectedMetric]);

  const filteredAndSortedData = useMemo(() => {
    let data = [...diffData];

    if (filterBenchmarkName) {
      data = data.filter(row => row.benchmark_name.toLowerCase().includes(filterBenchmarkName.toLowerCase()));
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

    data.sort((a, b) => {
      let compareA: any;
      let compareB: any;

      switch (sortField) {
        case 'benchmark_name':
          compareA = a.benchmark_name;
          compareB = b.benchmark_name;
          break;
        case 'metric_delta_percent':
          compareA = a.metric_delta_percent === undefined ? (sortDirection === 'dsc' ? -Infinity : Infinity) : a.metric_delta_percent;
          compareB = b.metric_delta_percent === undefined ? (sortDirection === 'dsc' ? -Infinity : Infinity) : b.metric_delta_percent;
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
  
  const formatDelta = (delta: number | undefined) => {
    if (delta === undefined) return 'N/A';
    if (delta === Infinity) return <span className="text-red-600 dark:text-red-400 font-semibold">New (Prev N/A or Zero)</span>;
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(2)}%`;
  };

  const getDeltaColor = (delta: number | undefined) => {
    if (delta === undefined) return 'text-muted-foreground';
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

  if (!mounted) {
    return <div className="space-y-6">
     <h1 className="text-3xl font-bold font-headline">Commit Benchmark Comparison</h1>
     <Card><CardHeader><CardTitle>Filters</CardTitle></CardHeader><CardContent><div className="h-48 animate-pulse bg-muted rounded-md"></div></CardContent></Card>
     <Card><CardHeader><CardTitle>Comparison Table</CardTitle></CardHeader><CardContent><div className="h-96 animate-pulse bg-muted rounded-md"></div></CardContent></Card>
   </div>;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-headline">Commit Benchmark Comparison</h1>
        <p className="text-muted-foreground">
          Select a commit to see changes compared to its direct predecessor, for the chosen binary flags and Python version.
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
                  {mockCommits.map(commit => (
                    <SelectItem key={commit.sha} value={commit.sha}>
                      <div className="flex items-center gap-2">
                        {commit.sha.substring(0, 7)}
                        <span className="text-xs text-muted-foreground truncate">({commit.message.substring(0,40)}{commit.message.length > 40 ? '...' : ''})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
               {selectedCommitDetails && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="mt-1 text-xs px-2 py-1 h-auto text-muted-foreground">
                      <Info className="h-3 w-3 mr-1" /> View Commit Details
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start">
                    <CommitTooltipContent commit={selectedCommitDetails} />
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="filter-binary">Binary Flags</Label>
              <Select value={selectedBinaryId} onValueChange={setSelectedBinaryId}>
                <SelectTrigger id="filter-binary"><SelectValue placeholder="Select Binary Flags" /></SelectTrigger>
                <SelectContent>
                  {mockBinaries.map(binary => <SelectItem key={binary.id} value={binary.id}>{binary.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="filter-python-version">Python Version (Major.Minor)</Label>
              <Select value={selectedPythonVersionKey} onValueChange={setSelectedPythonVersionKey}>
                <SelectTrigger id="filter-python-version"><SelectValue placeholder="Select Python Version" /></SelectTrigger>
                <SelectContent>
                  {mockPythonVersionOptions.map(v => <SelectItem key={v.label} value={v.label}>{v.label}</SelectItem>)}
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
              <Label htmlFor="filter-benchmark-name">Benchmark Name</Label>
              <Input id="filter-benchmark-name" placeholder="e.g., pyperformance_go" value={filterBenchmarkName} onChange={e => setFilterBenchmarkName(e.target.value)} />
            </div>
             <div className="space-y-1">
              <Label htmlFor="filter-threshold">Min. Change Threshold (%)</Label>
              <Input id="filter-threshold" type="number" placeholder="e.g., 5" value={filterThreshold} onChange={e => setFilterThreshold(Number(e.target.value))} />
            </div>
            <div className="flex items-center space-x-2 pt-4 md:col-span-2 lg:col-span-1">
              <Checkbox id="show-regressions" checked={showOnlyRegressions} onCheckedChange={c => setShowOnlyRegressions(c as boolean)} />
              <Label htmlFor="show-regressions">Only Regressions</Label>
            </div>
            <div className="flex items-center space-x-2 pt-4 md:col-span-2 lg:col-span-1">
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
                Showing {filteredAndSortedData.length} comparisons for commit <Tooltip><TooltipTrigger asChild><span className="font-mono cursor-help">{selectedCommitSha?.substring(0,7)}</span></TooltipTrigger><TooltipContent><CommitTooltipContent commit={selectedCommitDetails} /></TooltipContent></Tooltip> vs. its parent.
                Metric: {METRIC_OPTIONS.find(m=>m.value === selectedMetric)?.label}.
                Binary: {mockBinaries.find(b=>b.id === selectedBinaryId)?.name}.
                Python: {selectedPythonVersionKey}.
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
                    <TableHead className="text-right cursor-pointer whitespace-nowrap" onClick={() => handleSort('metric_delta_percent')}>Metric Delta {getSortIndicator('metric_delta_percent')}</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Prev. Value</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Curr. Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedData.map((row, index) => (
                    <TableRow key={`${row.benchmark_name}-${row.curr_commit_details.sha}-${index}`}>
                      <TableCell className="font-medium">{row.benchmark_name}</TableCell>
                      <TableCell className={`text-right ${getDeltaColor(row.metric_delta_percent)}`}>{formatDelta(row.metric_delta_percent)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.prev_metric_value !== undefined ? row.prev_metric_value.toLocaleString() : 'N/A'}
                        <span className="text-xs text-muted-foreground ml-1">{getPythonVersionDisplay(row.prev_python_version_str)}</span>
                        </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.curr_metric_value.toLocaleString()}
                        <span className="text-xs text-muted-foreground ml-1">{getPythonVersionDisplay(row.curr_python_version_str)}</span>
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
                <p className="text-sm">Ensure the selected commit has a predecessor with comparable data for the chosen binary, Python version, and metric.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
