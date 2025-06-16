
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LineChart as ChartIcon, Download, AlertCircle, Code2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { EnrichedBenchmarkResult, MetricKey, PythonVersionFilterOption } from '@/lib/types';
import { mockEnrichedBenchmarkResults, mockBinaries, mockCommits, benchmarkNames as allBenchmarkNames, mockPythonVersionOptions } from '@/lib/mockData';
import { METRIC_OPTIONS } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

const formatBytes = (bytes: number, decimals = 2) => {
  if (!bytes && bytes !== 0) return 'N/A';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function BenchmarkTrendPage() {
  const [selectedBinaryId, setSelectedBinaryId] = useState<string | undefined>(mockBinaries[0]?.id);
  const [selectedPythonVersionKey, setSelectedPythonVersionKey] = useState<string | undefined>(
    mockPythonVersionOptions[0]?.label // e.g., "3.13"
  );
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>(METRIC_OPTIONS[0].value);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>([allBenchmarkNames[0]]);
  const [benchmarkSearch, setBenchmarkSearch] = useState('');

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const filteredData = useMemo(() => {
    if (!selectedBinaryId || !selectedPythonVersionKey) return [];
    
    const versionOption = mockPythonVersionOptions.find(v => v.label === selectedPythonVersionKey);
    if (!versionOption) return [];

    // Filter results based on selected binary, selected Python major.minor, and selected benchmarks
    return mockEnrichedBenchmarkResults
      .filter(result => 
        result.binary.id === selectedBinaryId &&
        result.commit.python_version.major === versionOption.major && // Match commit's Python major
        result.commit.python_version.minor === versionOption.minor && // Match commit's Python minor
        selectedBenchmarks.includes(result.benchmark_name)
      )
      .sort((a, b) => new Date(a.commit.timestamp).getTime() - new Date(b.commit.timestamp).getTime());
  }, [selectedBinaryId, selectedPythonVersionKey, selectedBenchmarks]);

  const chartData = useMemo(() => {
    const dataByCommit: { 
      [commitSha: string]: { 
        commitSha: string, 
        timestamp: string, 
        commitMessage: string,
        fullVersion?: string, // Full Python version of the commit/run
        [benchmarkName: string]: any 
      } 
    } = {};

    filteredData.forEach(result => {
      const commitSha = result.commit.sha;
      if (!dataByCommit[commitSha]) {
        dataByCommit[commitSha] = { 
          commitSha: commitSha.substring(0, 7), 
          timestamp: new Date(result.commit.timestamp).toLocaleDateString(),
          commitMessage: result.commit.message,
          // Use run_python_version for the full version display in tooltip, as it matches the commit's
          fullVersion: `${result.run_python_version.major}.${result.run_python_version.minor}.${result.run_python_version.patch}`
        };
      }
      dataByCommit[commitSha][result.benchmark_name] = result.result_json[selectedMetric];
      // Ensure all selected benchmarks have an entry (even if undefined) for consistent line rendering
      selectedBenchmarks.forEach(sb => {
        if (!(sb in dataByCommit[commitSha])) {
            dataByCommit[commitSha][sb] = undefined; 
        }
      });
    });
    
    // Sort by commit timestamp (chronological)
    return Object.values(dataByCommit).sort((a,b) => {
        // Find original commit objects to sort by their actual timestamp
        const commitA = mockCommits.find(c => c.sha.startsWith(a.commitSha));
        const commitB = mockCommits.find(c => c.sha.startsWith(b.commitSha));
        if (!commitA || !commitB) return 0;
        return new Date(commitA.timestamp).getTime() - new Date(commitB.timestamp).getTime();
    });

  }, [filteredData, selectedMetric, selectedBenchmarks]);

  const handleBenchmarkSelection = (benchmarkName: string) => {
    setSelectedBenchmarks(prev =>
      prev.includes(benchmarkName)
        ? prev.filter(b => b !== benchmarkName)
        : [...prev, benchmarkName]
    );
  };

  const displayedBenchmarkNames = useMemo(() => {
    return allBenchmarkNames.filter(name => name.toLowerCase().includes(benchmarkSearch.toLowerCase()));
  }, [benchmarkSearch]);

  const lineColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F', '#FFBB28', '#FF8042', '#0088FE', '#00C49F', '#FFBB28'];

  if (!mounted) {
     return <div className="space-y-6">
      <h1 className="text-3xl font-bold font-headline">Benchmark Trends</h1>
      <Card><CardHeader><CardTitle>Filters</CardTitle></CardHeader><CardContent><div className="h-32 animate-pulse bg-muted rounded-md"></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Chart</CardTitle></CardHeader><CardContent><div className="h-96 animate-pulse bg-muted rounded-md"></div></CardContent></Card>
    </div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold font-headline">Benchmark Trends</h1>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Select binary flags, Python version (Major.Minor), metric, and benchmarks to visualize trends.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <Label htmlFor="binary-select">Binary Flags</Label>
            <Select value={selectedBinaryId} onValueChange={setSelectedBinaryId}>
              <SelectTrigger id="binary-select">
                <SelectValue placeholder="Select Binary Flags" />
              </SelectTrigger>
              <SelectContent>
                {mockBinaries.map(binary => (
                  <SelectItem key={binary.id} value={binary.id}>
                    {binary.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="python-version-select">Python Version (Major.Minor)</Label>
            <Select value={selectedPythonVersionKey} onValueChange={setSelectedPythonVersionKey}>
              <SelectTrigger id="python-version-select">
                <SelectValue placeholder="Select Python Version" />
              </SelectTrigger>
              <SelectContent>
                {mockPythonVersionOptions.map(v => ( // mockPythonVersionOptions is derived from commit versions
                  <SelectItem key={v.label} value={v.label}>
                    <div className="flex items-center gap-2">
                       <Code2 className="h-4 w-4 text-primary/80" /> {v.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="metric-select">Metric</Label>
            <Select value={selectedMetric} onValueChange={(val) => setSelectedMetric(val as MetricKey)}>
              <SelectTrigger id="metric-select">
                <SelectValue placeholder="Select Metric" />
              </SelectTrigger>
              <SelectContent>
                {METRIC_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="lg:col-span-3">
            <Label>Benchmarks (Select up to {lineColors.length})</Label>
            <Input 
              placeholder="Search benchmarks..." 
              value={benchmarkSearch} 
              onChange={(e) => setBenchmarkSearch(e.target.value)}
              className="mb-2"
            />
            <ScrollArea className="h-40 rounded-md border p-2">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
                {displayedBenchmarkNames.map(name => (
                  <div key={name} className="flex items-center space-x-2">
                    <Checkbox
                      id={`bench-${name}`}
                      checked={selectedBenchmarks.includes(name)}
                      onCheckedChange={() => handleBenchmarkSelection(name)}
                      disabled={!selectedBenchmarks.includes(name) && selectedBenchmarks.length >= lineColors.length}
                    />
                    <Label htmlFor={`bench-${name}`} className="font-normal cursor-pointer text-sm truncate" title={name}>{name}</Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
             {selectedBenchmarks.length >= lineColors.length && <p className="text-xs text-muted-foreground mt-1">Maximum number of benchmarks selected for visualization.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ChartIcon className="h-6 w-6 text-primary" />
              Trend Chart
            </CardTitle>
            <CardDescription>
              Showing {METRIC_OPTIONS.find(m=>m.value === selectedMetric)?.label} for {mockBinaries.find(b=>b.id === selectedBinaryId)?.name} on Python {selectedPythonVersionKey}.x.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled>
            <Download className="mr-2 h-4 w-4" />
            Export (PNG/CSV)
          </Button>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 && selectedBenchmarks.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="commitSha" 
                  angle={-35} 
                  textAnchor="end" 
                  height={80} 
                  interval={chartData.length > 20 ? Math.floor(chartData.length / 10) : 0} 
                  tickFormatter={(value, index) => chartData[index]?.commitSha || value}
                />
                <YAxis tickFormatter={(value) => formatBytes(value)} />
                <Tooltip 
                  formatter={(value: number, name: string, props) => {
                    const displayName = name.replace(/_/g, ' ');
                    const formattedValue = formatBytes(value);
                    // props.payload.fullVersion comes from the commit's python_version
                    const fullVersion = props.payload.fullVersion ? `(py ${props.payload.fullVersion})` : ''; 
                    return [`${formattedValue} ${fullVersion}`, displayName];
                  }}
                  labelFormatter={(label, payload) => { // label is commitSha here
                     const commitData = payload?.[0]?.payload;
                     if (commitData) {
                       return `${commitData.commitSha} (py ${commitData.fullVersion}): ${commitData.commitMessage.substring(0,50)}...`;
                     }
                     return label;
                  }}
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                  itemSorter={(item) => selectedBenchmarks.indexOf(item.dataKey as string)}
                />
                <Legend formatter={(value) => value.replace(/_/g, ' ')} />
                {selectedBenchmarks.map((benchName, index) => (
                  <Line
                    key={benchName}
                    type="monotone"
                    dataKey={benchName}
                    stroke={lineColors[index % lineColors.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                    connectNulls 
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
              <AlertCircle className="w-16 h-16 mb-4" />
              <p className="text-lg">No data available for the selected filters.</p>
              <p>Please select a binary, Python version, metric, and at least one benchmark, ensuring commits exist for that Python version.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
