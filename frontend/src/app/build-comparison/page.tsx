"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LineChart as ChartIcon, Download, AlertCircle, Code2, GitCompare } from 'lucide-react';
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
import type { EnrichedBenchmarkResult, MetricKey, PythonVersionFilterOption, Binary, Environment } from '@/lib/types';
import { METRIC_OPTIONS } from '@/lib/types';
import { api } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const formatBytes = (bytes: number, decimals = 2) => {
  if (!bytes && bytes !== 0) return 'N/A';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function BuildComparisonPage() {
  const [binaries, setBinaries] = useState<Binary[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [pythonVersionOptions, setPythonVersionOptions] = useState<PythonVersionFilterOption[]>([]);
  const [benchmarkResults, setBenchmarkResults] = useState<EnrichedBenchmarkResult[]>([]);
  const [allBenchmarkNames, setAllBenchmarkNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | undefined>();
  const [selectedPythonVersionKey, setSelectedPythonVersionKey] = useState<string | undefined>();
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>(METRIC_OPTIONS[0].value);
  const [selectedBinaries, setSelectedBinaries] = useState<string[]>([]);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>([]);
  const [benchmarkSearch, setBenchmarkSearch] = useState('');

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Load initial data (metadata only)
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setError(null);
        
        const [binariesData, environmentsData, pythonVersionsData] = await Promise.all([
          api.getBinaries(),
          api.getEnvironments(),
          api.getPythonVersions()
        ]);
        
        setBinaries(binariesData);
        setEnvironments(environmentsData);
        setPythonVersionOptions(pythonVersionsData);
        
        // Set initial selections
        if (environmentsData.length > 0 && !selectedEnvironmentId) {
          setSelectedEnvironmentId(environmentsData[0].id);
        }
        if (pythonVersionsData.length > 0 && !selectedPythonVersionKey) {
          setSelectedPythonVersionKey(pythonVersionsData[0].label);
        }
        if (binariesData.length > 1 && selectedBinaries.length === 0) {
          // Select first two binaries by default for comparison
          setSelectedBinaries([binariesData[0].id, binariesData[1].id]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    
    if (mounted) {
      loadInitialData();
    }
  }, [mounted]);

  // Load benchmark data when filters change
  useEffect(() => {
    async function loadBenchmarkData() {
      if (!selectedEnvironmentId || !selectedPythonVersionKey || selectedBinaries.length === 0) {
        return;
      }

      const versionOption = pythonVersionOptions.find(v => v.label === selectedPythonVersionKey);
      if (!versionOption) return;

      try {
        // Use the optimized endpoint to load data
        const benchmarkResultsData = await api.getFilteredBenchmarkResults({
          environment_id: selectedEnvironmentId,
          python_major: versionOption.major,
          python_minor: versionOption.minor,
          binary_ids: selectedBinaries,
          limit: 5000
        });
        
        setBenchmarkResults(benchmarkResultsData);
        
        // Extract unique benchmark names
        const uniqueBenchmarks = Array.from(new Set(benchmarkResultsData.map(r => r.benchmark_name)));
        setAllBenchmarkNames(uniqueBenchmarks);
        
        // Set initial benchmark selection if empty
        if (uniqueBenchmarks.length > 0 && selectedBenchmarks.length === 0) {
          setSelectedBenchmarks([uniqueBenchmarks[0]]);
        }
      } catch (err) {
        console.error('Failed to load benchmark data:', err);
      }
    }

    if (!loading && mounted) {
      loadBenchmarkData();
    }
  }, [selectedEnvironmentId, selectedPythonVersionKey, selectedBinaries, pythonVersionOptions, loading, mounted]);

  const filteredData = useMemo(() => {
    if (!selectedEnvironmentId || !selectedPythonVersionKey || selectedBenchmarks.length === 0 || selectedBinaries.length === 0) return [];
    
    const versionOption = pythonVersionOptions.find(v => v.label === selectedPythonVersionKey);
    if (!versionOption) return [];

    // Create Sets for faster lookup
    const benchmarkSet = new Set(selectedBenchmarks);
    const binarySet = new Set(selectedBinaries);

    // Filter results for the selected parameters and binaries
    return benchmarkResults
      .filter(result => 
        binarySet.has(result.binary.id) &&
        result.environment.id === selectedEnvironmentId &&
        result.commit.python_version.major === versionOption.major &&
        result.commit.python_version.minor === versionOption.minor &&
        benchmarkSet.has(result.benchmark_name)
      )
      .sort((a, b) => new Date(a.commit.timestamp).getTime() - new Date(b.commit.timestamp).getTime());
  }, [selectedEnvironmentId, selectedPythonVersionKey, selectedBenchmarks, selectedBinaries, benchmarkResults, pythonVersionOptions]);

  const chartData = useMemo(() => {
    // Group by benchmark first
    const dataByBenchmark: {
      [benchmarkName: string]: Array<{
        commitSha: string, 
        timestamp: string, 
        commitMessage: string,
        fullVersion?: string,
        sortTimestamp: number,
        [binaryId: string]: any 
      }>
    } = {};

    // Initialize data structure for each benchmark
    selectedBenchmarks.forEach(benchmark => {
      dataByBenchmark[benchmark] = [];
    });

    // Group data by commit and benchmark
    const commitDataMap: {
      [key: string]: {
        commitSha: string,
        timestamp: string,
        commitMessage: string,
        fullVersion?: string,
        sortTimestamp: number,
        benchmarkData: { [benchmarkName: string]: { [binaryId: string]: any } }
      }
    } = {};

    filteredData.forEach(result => {
      const commitSha = result.commit.sha;
      const benchmarkName = result.benchmark_name;
      const key = `${commitSha}-${benchmarkName}`;
      
      if (!commitDataMap[commitSha]) {
        const timestampMs = new Date(result.commit.timestamp).getTime();
        commitDataMap[commitSha] = {
          commitSha: commitSha.substring(0, 7),
          timestamp: new Date(result.commit.timestamp).toLocaleDateString(),
          commitMessage: result.commit.message,
          fullVersion: `${result.run_python_version.major}.${result.run_python_version.minor}.${result.run_python_version.patch}`,
          sortTimestamp: timestampMs,
          benchmarkData: {}
        };
      }
      
      if (!commitDataMap[commitSha].benchmarkData[benchmarkName]) {
        commitDataMap[commitSha].benchmarkData[benchmarkName] = {};
      }
      
      commitDataMap[commitSha].benchmarkData[benchmarkName][result.binary.id] = result.result_json[selectedMetric];
    });

    // Convert to array format for charts, one dataset per benchmark
    Object.values(commitDataMap).forEach(commitData => {
      selectedBenchmarks.forEach(benchmarkName => {
        const benchmarkBinaryData = commitData.benchmarkData[benchmarkName];
        if (benchmarkBinaryData && Object.keys(benchmarkBinaryData).length === selectedBinaries.length) {
          // Only include if we have data for all selected binaries
          dataByBenchmark[benchmarkName].push({
            commitSha: commitData.commitSha,
            timestamp: commitData.timestamp,
            commitMessage: commitData.commitMessage,
            fullVersion: commitData.fullVersion,
            sortTimestamp: commitData.sortTimestamp,
            ...benchmarkBinaryData
          });
        }
      });
    });

    // Sort each benchmark's data by timestamp
    Object.keys(dataByBenchmark).forEach(benchmark => {
      dataByBenchmark[benchmark].sort((a, b) => a.sortTimestamp - b.sortTimestamp);
    });

    return dataByBenchmark;
  }, [filteredData, selectedMetric, selectedBinaries, selectedBenchmarks]);

  // Calculate Y-axis domain for auto-scaling per benchmark
  const yAxisDomains = useMemo(() => {
    const domains: { [benchmark: string]: [number, number] } = {};
    
    Object.entries(chartData).forEach(([benchmark, data]) => {
      if (data.length === 0) {
        domains[benchmark] = ['auto' as any, 'auto' as any];
        return;
      }

      let min = Infinity;
      let max = -Infinity;

      data.forEach(dataPoint => {
        selectedBinaries.forEach(binaryId => {
          const value = dataPoint[binaryId];
          if (typeof value === 'number' && !isNaN(value)) {
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
        });
      });

      if (min === Infinity || max === -Infinity) {
        domains[benchmark] = ['auto' as any, 'auto' as any];
      } else {
        // Add 10% padding to top and bottom for better visualization
        const padding = (max - min) * 0.1;
        const domainMin = Math.max(0, min - padding);
        const domainMax = max + padding;
        domains[benchmark] = [domainMin, domainMax];
      }
    });

    return domains;
  }, [chartData, selectedBinaries]);

  const handleBinarySelection = (binaryId: string) => {
    setSelectedBinaries(prev =>
      prev.includes(binaryId)
        ? prev.filter(b => b !== binaryId)
        : [...prev, binaryId]
    );
  };

  const handleBenchmarkSelection = (benchmarkName: string) => {
    setSelectedBenchmarks(prev =>
      prev.includes(benchmarkName)
        ? prev.filter(b => b !== benchmarkName)
        : [...prev, benchmarkName]
    );
  };

  const handleExport = (format: 'png' | 'csv') => {
    if (format === 'csv') {
      exportAsCSV();
    } else if (format === 'png') {
      exportAsPNG();
    }
  };

  const exportAsCSV = () => {
    if (Object.keys(chartData).length === 0) return;

    // Export all benchmarks data combined
    const binaryNames = selectedBinaries.map(id => binaries.find(b => b.id === id)?.name || id);
    const headers = ['Benchmark', 'Commit SHA', 'Timestamp', 'Message', 'Python Version', ...binaryNames];
    
    const rows: any[] = [];
    Object.entries(chartData).forEach(([benchmark, data]) => {
      data.forEach(dataPoint => {
        rows.push([
          benchmark,
          dataPoint.commitSha,
          dataPoint.timestamp,
          `"${dataPoint.commitMessage}"`,
          dataPoint.fullVersion || '',
          ...selectedBinaries.map(binaryId => {
            const value = dataPoint[binaryId];
            return typeof value === 'number' ? value : '';
          })
        ]);
      });
    });

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `build-comparison-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAsPNG = () => {
    // Use html2canvas to capture the chart
    const chartElement = document.querySelector('.recharts-wrapper');
    if (!chartElement) return;

    import('html2canvas').then(html2canvas => {
      html2canvas.default(chartElement as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `build-comparison-${selectedBenchmark}-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL();
        link.click();
      });
    }).catch(error => {
      console.error('Failed to export chart as PNG:', error);
      alert('PNG export failed. Please try again.');
    });
  };

  const displayedBenchmarkNames = useMemo(() => {
    if (allBenchmarkNames.length === 0) {
      return [];
    }
    return allBenchmarkNames.filter(name => 
      name.toLowerCase().includes(benchmarkSearch.toLowerCase())
    );
  }, [allBenchmarkNames, benchmarkSearch]);

  const lineColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00C49F', '#FFBB28', '#FF8042', '#0088FE'];

  if (!mounted || loading) {
    return <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
          <GitCompare className="h-8 w-8 text-primary" />
          Binary Configuration Comparison
        </h1>
        <p className="text-muted-foreground mt-2">Compare performance across different binary configurations for the same commits</p>
      </div>
      <Card><CardHeader><CardTitle>Configuration</CardTitle></CardHeader><CardContent><div className="h-32 animate-pulse bg-muted rounded-md"></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Charts</CardTitle></CardHeader><CardContent><div className="h-96 animate-pulse bg-muted rounded-md"></div></CardContent></Card>
    </div>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
            <GitCompare className="h-8 w-8 text-primary" />
            Binary Configuration Comparison
          </h1>
          <p className="text-muted-foreground mt-2">Compare performance across different binary configurations for the same commits</p>
        </div>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
          <GitCompare className="h-8 w-8 text-primary" />
          Binary Configuration Comparison
        </h1>
        <p className="text-muted-foreground mt-2">
          Compare performance across {binaries.length} different binary configurations 
          {binaries.length > 0 && ` (${binaries.map(b => b.name).join(', ')})`} for the same commits
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Select environment, Python version, benchmarks, and multiple binary configurations from the {binaries.length} available options to compare
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="environment-select">Environment</Label>
              <Select value={selectedEnvironmentId} onValueChange={setSelectedEnvironmentId}>
                <SelectTrigger id="environment-select">
                  <SelectValue placeholder="Select Environment" />
                </SelectTrigger>
                <SelectContent>
                  {environments.map(environment => (
                    <SelectItem key={environment.id} value={environment.id}>
                      {environment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="python-version-select">Python Version</Label>
              <Select value={selectedPythonVersionKey} onValueChange={setSelectedPythonVersionKey}>
                <SelectTrigger id="python-version-select">
                  <SelectValue placeholder="Select Python Version" />
                </SelectTrigger>
                <SelectContent>
                  {pythonVersionOptions.map(v => (
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
          </div>

          <div>
            <Label>Benchmarks (Select multiple to compare)</Label>
            <Input 
              placeholder="Search benchmarks..." 
              value={benchmarkSearch} 
              onChange={(e) => setBenchmarkSearch(e.target.value)}
              className="mb-2 mt-2"
            />
            <ScrollArea className="h-48 rounded-md border p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                {displayedBenchmarkNames.map(name => (
                  <div key={name} className="flex items-center space-x-2">
                    <Checkbox
                      id={`bench-${name}`}
                      checked={selectedBenchmarks.includes(name)}
                      onCheckedChange={() => handleBenchmarkSelection(name)}
                    />
                    <Label htmlFor={`bench-${name}`} className="font-normal cursor-pointer text-sm truncate" title={name}>{name}</Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {selectedBenchmarks.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">Select at least 1 benchmark to compare</p>
            )}
          </div>

          <div>
            <Label>Binary Configurations (Select 2 or more from {binaries.length} available)</Label>
            <ScrollArea className="h-48 rounded-md border p-4 mt-2">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                {binaries.map(binary => (
                  <div key={binary.id} className="flex items-start space-x-2">
                    <Checkbox
                      id={`binary-${binary.id}`}
                      checked={selectedBinaries.includes(binary.id)}
                      onCheckedChange={() => handleBinarySelection(binary.id)}
                      disabled={!selectedBinaries.includes(binary.id) && selectedBinaries.length >= lineColors.length}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={`binary-${binary.id}`} className="font-normal cursor-pointer text-sm">
                        <div className="font-medium truncate" title={binary.name}>{binary.name}</div>
                        {binary.flags.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1 truncate" title={binary.flags.join(', ')}>
                            {binary.flags.join(', ')}
                          </div>
                        )}
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {selectedBinaries.length < 2 && (
              <p className="text-sm text-muted-foreground mt-2">Select at least 2 binary configurations to compare</p>
            )}
            {selectedBinaries.length >= lineColors.length && (
              <p className="text-sm text-muted-foreground mt-2">Maximum {lineColors.length} binary configurations can be displayed simultaneously</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ChartIcon className="h-6 w-6 text-primary" />
              Binary Configuration Comparison Charts
            </CardTitle>
            <CardDescription>
              Comparing {selectedBinaries.length} binary configuration{selectedBinaries.length !== 1 ? 's' : ''} across {selectedBenchmarks.length} benchmark{selectedBenchmarks.length !== 1 ? 's' : ''} on Python {selectedPythonVersionKey}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={Object.keys(chartData).length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('png')}>
                <Download className="mr-2 h-4 w-4" />
                Export as PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <Download className="mr-2 h-4 w-4" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          {Object.keys(chartData).length > 0 && selectedBinaries.length >= 2 ? (
            <div className="space-y-8">
              {selectedBenchmarks.map((benchmarkName) => {
                const data = chartData[benchmarkName];
                if (!data || data.length === 0) return null;
                
                return (
                  <div key={benchmarkName}>
                    <h3 className="text-lg font-semibold mb-4">{benchmarkName}</h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="commitSha" 
                          angle={-35} 
                          textAnchor="end" 
                          height={80} 
                          interval={data.length > 20 ? Math.floor(data.length / 10) : 0}
                        />
                        <YAxis 
                          domain={yAxisDomains[benchmarkName]}
                          tickFormatter={(value) => formatBytes(value)} 
                        />
                        <Tooltip 
                          formatter={(value: number, name: string) => {
                            const binary = binaries.find(b => b.id === name);
                            const displayName = binary?.name || name;
                            return [formatBytes(value), displayName];
                          }}
                          labelFormatter={(label, payload) => {
                            const commitData = payload?.[0]?.payload;
                            if (commitData) {
                              return `${commitData.commitSha}: ${commitData.commitMessage.substring(0,50)}...`;
                            }
                            return label;
                          }}
                          contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}
                          itemSorter={(item) => selectedBinaries.indexOf(item.dataKey as string)}
                        />
                        <Legend formatter={(value) => binaries.find(b => b.id === value)?.name || value} />
                        {selectedBinaries.map((binaryId, index) => (
                          <Line
                            key={binaryId}
                            type="monotone"
                            dataKey={binaryId}
                            stroke={lineColors[index % lineColors.length]}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 6 }}
                            connectNulls 
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
              <AlertCircle className="w-16 h-16 mb-4" />
              <p className="text-lg">No data available</p>
              {selectedBinaries.length < 2 ? (
                <p>Please select at least 2 binary configurations to compare</p>
              ) : selectedBenchmarks.length === 0 ? (
                <p>Please select at least 1 benchmark</p>
              ) : (
                <p>No commits found with results for all selected binary configurations and benchmarks</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}