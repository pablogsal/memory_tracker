import type { Commit, Binary, Run, BenchmarkResult, EnrichedBenchmarkResult, DiffTableRow, PythonVersion, MetricKey } from './types';

const createCommit = (sha: string, daysAgo: number, message: string, author: string): Commit => ({
  sha,
  timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  message,
  author,
});

export const mockCommits: Commit[] = [
  createCommit('a1b2c3d4', 5, 'Initial commit with basic features', 'Alice Wonderland'),
  createCommit('e5f6g7h8', 4, 'Add performance critical module', 'Bob The Builder'),
  createCommit('i9j0k1l2', 3, 'Refactor memory allocation strategy', 'Carol Danvers'),
  createCommit('m3n4o5p6', 2, 'Optimize hot path in critical module', 'David Copperfield'),
  createCommit('q7r8s9t0', 1, 'Fix minor bug in UI', 'Eve Harrington'),
  createCommit('u1v2w3x4', 0, 'Release version 1.0.0', 'Alice Wonderland'),
];

const createBinary = (id: string, major: number, minor: number, patch: number, flags: string[]): Binary => ({
  id,
  version: { major, minor, patch },
  flags,
});

export const mockBinaries: Binary[] = [
  createBinary('3.12.0-debug', 3, 12, 0, ['debug']),
  createBinary('3.12.0-nogil', 3, 12, 0, ['nogil']),
  createBinary('3.13.0-opt', 3, 13, 0, ['opt']),
  createBinary('main-debug-nogil', 0, 0, 0, ['debug', 'nogil']), // Assuming 0.0.0 for 'main'
];

const createRun = (run_id: string, commit_sha: string, binary_id: string, daysAgo: number): Run => ({
  run_id,
  commit_sha,
  binary_id,
  timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
});

export const mockRuns: Run[] = [
  createRun('run_001', mockCommits[0].sha, mockBinaries[0].id, 5),
  createRun('run_002', mockCommits[1].sha, mockBinaries[0].id, 4),
  createRun('run_003', mockCommits[2].sha, mockBinaries[0].id, 3),
  createRun('run_004', mockCommits[3].sha, mockBinaries[0].id, 2),
  createRun('run_005', mockCommits[4].sha, mockBinaries[0].id, 1),
  createRun('run_006', mockCommits[5].sha, mockBinaries[0].id, 0),

  createRun('run_007', mockCommits[0].sha, mockBinaries[1].id, 5),
  createRun('run_008', mockCommits[1].sha, mockBinaries[1].id, 4),
  createRun('run_009', mockCommits[2].sha, mockBinaries[1].id, 3),
  
  createRun('run_010', mockCommits[3].sha, mockBinaries[2].id, 2),
  createRun('run_011', mockCommits[4].sha, mockBinaries[2].id, 1),
  createRun('run_012', mockCommits[5].sha, mockBinaries[2].id, 0),
];

const benchmarkNames = ['pyperformance_go', 'pyperformance_json_dumps', 'pyperformance_regex_dna', 'custom_memory_test_A', 'custom_memory_test_B'];

const generateBenchmarkResultJson = (baseValue: number, iteration: number) => {
  const factor = 1 + (Math.random() - 0.45) * 0.1 * iteration; // Small random variation, sometimes regressing
  return {
    high_watermark_bytes: Math.floor(baseValue * factor * (1 + Math.random() * 0.1)),
    allocation_histogram: [[16, 1000 * factor], [32, 500 * factor], [64, 200 * factor]] as [number, number][],
    total_allocated_bytes: Math.floor(baseValue * 2 * factor * (1 + Math.random() * 0.05)),
    top_allocating_functions: [
      { function: 'malloc', count: Math.floor(1000 * factor), total_size: Math.floor(50000 * factor) },
      { function: 'new_object', count: Math.floor(200 * factor), total_size: Math.floor(30000 * factor) },
    ],
  };
};

export const mockBenchmarkResults: BenchmarkResult[] = mockRuns.flatMap((run, runIndex) => 
  benchmarkNames.map((name, benchIndex) => ({
    id: `${run.run_id}_${name}`,
    run_id: run.run_id,
    benchmark_name: name,
    result_json: generateBenchmarkResultJson(1000000 + benchIndex * 200000, runIndex + 1),
  }))
);

export const mockEnrichedBenchmarkResults: EnrichedBenchmarkResult[] = mockBenchmarkResults.map(br => {
  const run = mockRuns.find(r => r.run_id === br.run_id)!;
  const commit = mockCommits.find(c => c.sha === run.commit_sha)!;
  const binary = mockBinaries.find(b => b.id === run.binary_id)!;
  return { ...br, commit, binary };
});


export const getMockDiffTableRows = (metricKey: MetricKey = 'high_watermark_bytes'): DiffTableRow[] => {
  const rows: DiffTableRow[] = [];
  const sortedCommits = [...mockCommits].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  // Filter results for a specific binary, e.g., mockBinaries[0]
  const binaryId = mockBinaries[0].id;
  const relevantResults = mockEnrichedBenchmarkResults.filter(r => r.binary.id === binaryId);

  for (const benchmarkName of benchmarkNames) {
    for (let i = 0; i < sortedCommits.length; i++) {
      const currCommit = sortedCommits[i];
      const prevCommit = i > 0 ? sortedCommits[i - 1] : undefined;

      const currResult = relevantResults.find(r => r.commit.sha === currCommit.sha && r.benchmark_name === benchmarkName);
      const prevResult = prevCommit ? relevantResults.find(r => r.commit.sha === prevCommit.sha && r.benchmark_name === benchmarkName) : undefined;

      if (currResult) {
        const currMetricValue = currResult.result_json[metricKey] as number;
        const prevMetricValue = prevResult ? prevResult.result_json[metricKey] as number : undefined;
        let metricDeltaPercent: number | undefined = undefined;
        if (prevMetricValue !== undefined && prevMetricValue !== 0) {
          metricDeltaPercent = ((currMetricValue - prevMetricValue) / prevMetricValue) * 100;
        } else if (prevMetricValue === 0 && currMetricValue !== 0) {
          metricDeltaPercent = Infinity; // Or handle as a large number
        }


        rows.push({
          benchmark_name: benchmarkName,
          prev_commit_sha: prevCommit?.sha,
          curr_commit_sha: currCommit.sha,
          metric_delta_percent: metricDeltaPercent,
          prev_metric_value: prevMetricValue,
          curr_metric_value: currMetricValue,
          prev_commit: prevCommit,
          curr_commit: currCommit,
          metric_key: metricKey
        });
      }
    }
  }
  // Keep only rows that have a previous commit for actual diffs, or all if you want to show initial values too.
  // For a diff table, we typically want pairs.
  return rows.filter(row => row.prev_commit_sha !== undefined);
};
