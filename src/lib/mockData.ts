import type { Commit, Binary, Run, BenchmarkResult, EnrichedBenchmarkResult, DiffTableRow, PythonVersion, MetricKey, PythonVersionFilterOption, BenchmarkResultJson } from './types';

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
mockCommits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

export const mockBinaries: Binary[] = [
  { id: 'default', name: 'Default', flags: [] },
  { id: 'debug', name: 'Debug', flags: ['--with-debug'] },
  { id: 'nogil', name: 'No GIL', flags: ['--disable-gil'] },
  { id: 'debug-nogil', name: 'Debug & No GIL', flags: ['--with-debug', '--disable-gil'] },
  { id: 'lto', name: 'LTO Enabled', flags: ['--with-lto'] },
  { id: 'pgo', name: 'PGO Optimized', flags: ['--enable-optimizations'] },
];

const createRun = (run_id: string, commit_sha: string, binary_id: string, python_version: PythonVersion, daysAgoOffset: number): Run => {
  const commit = mockCommits.find(c => c.sha === commit_sha);
  let baseTimestamp = Date.now();
  if (commit) {
    baseTimestamp = new Date(commit.timestamp).getTime();
  }
  
  return {
    run_id,
    commit_sha,
    binary_id,
    python_version,
    timestamp: new Date(baseTimestamp - daysAgoOffset * 3600 * 1000).toISOString(), 
  };
};

export const mockRuns: Run[] = [
  // Commit 0 (u1v2w3x4 - newest)
  createRun('run_c0_b0_py313_0', mockCommits[0].sha, mockBinaries[0].id, { major: 3, minor: 13, patch: 0 }, 0),
  createRun('run_c0_b1_py313_0', mockCommits[0].sha, mockBinaries[1].id, { major: 3, minor: 13, patch: 0 }, 0),
  createRun('run_c0_b0_py312_5', mockCommits[0].sha, mockBinaries[0].id, { major: 3, minor: 12, patch: 5 }, 0),
  createRun('run_c0_b2_py313_0', mockCommits[0].sha, mockBinaries[2].id, { major: 3, minor: 13, patch: 0 }, 0.1),


  // Commit 1 (q7r8s9t0)
  createRun('run_c1_b0_py313_0', mockCommits[1].sha, mockBinaries[0].id, { major: 3, minor: 13, patch: 0 }, 1),
  createRun('run_c1_b1_py313_0', mockCommits[1].sha, mockBinaries[1].id, { major: 3, minor: 13, patch: 0 }, 1),
  createRun('run_c1_b2_py312_5', mockCommits[1].sha, mockBinaries[2].id, { major: 3, minor: 12, patch: 5 }, 1),
  createRun('run_c1_b0_py312_4', mockCommits[1].sha, mockBinaries[0].id, { major: 3, minor: 12, patch: 4 }, 1),

  // Commit 2 (m3n4o5p6)
  createRun('run_c2_b0_py313_0', mockCommits[2].sha, mockBinaries[0].id, { major: 3, minor: 13, patch: 0 }, 2),
  createRun('run_c2_b3_py312_4', mockCommits[2].sha, mockBinaries[3].id, { major: 3, minor: 12, patch: 4 }, 2),
  createRun('run_c2_b0_py311_7', mockCommits[2].sha, mockBinaries[0].id, { major: 3, minor: 11, patch: 7 }, 2.1),


  // Commit 3 (i9j0k1l2)
  createRun('run_c3_b0_py312_3', mockCommits[3].sha, mockBinaries[0].id, { major: 3, minor: 12, patch: 3 }, 3),
  createRun('run_c3_b1_py312_3', mockCommits[3].sha, mockBinaries[1].id, { major: 3, minor: 12, patch: 3 }, 3),

  // Commit 4 (e5f6g7h8)
  createRun('run_c4_b0_py312_1', mockCommits[4].sha, mockBinaries[0].id, { major: 3, minor: 12, patch: 1 }, 4),
  createRun('run_c4_b0_py311_5', mockCommits[4].sha, mockBinaries[0].id, { major: 3, minor: 11, patch: 5 }, 4),
  
  // Commit 5 (a1b2c3d4 - oldest)
  createRun('run_c5_b0_py312_0', mockCommits[5].sha, mockBinaries[0].id, { major: 3, minor: 12, patch: 0 }, 5),
  createRun('run_c5_b1_py312_0', mockCommits[5].sha, mockBinaries[1].id, { major: 3, minor: 12, patch: 0 }, 5),
  createRun('run_c5_b4_py311_3', mockCommits[5].sha, mockBinaries[4].id, { major: 3, minor: 11, patch: 3 }, 5.1),
];

export const benchmarkNames = ['pyperformance_go', 'pyperformance_json_dumps', 'pyperformance_regex_dna', 'custom_memory_test_A', 'custom_memory_test_B', 'startup_time', 'threading_overhead'];

const generateBenchmarkResultJson = (baseValue: number, iteration: number, benchmarkName: string, commitTimestamp: string, runTimestamp: string): BenchmarkResultJson => {
  const timeDiffFactor = (new Date(runTimestamp).getTime() - new Date(commitTimestamp).getTime()) / (1000 * 60 * 60 * 24); // days difference
  const iterationFactor = 1 + (Math.random() - 0.45) * 0.05 * iteration + timeDiffFactor * 0.01; // Small random variation + time trend

  let value = baseValue;
  if (benchmarkName.includes('json')) value *= 1.5;
  if (benchmarkName.includes('regex')) value *= 2.0;
  if (benchmarkName.includes('startup')) value *= 0.1;
  if (benchmarkName.includes('threading')) value *= 0.5;


  return {
    benchmark_name: benchmarkName,
    high_watermark_bytes: Math.floor(value * iterationFactor * (1 + Math.random() * 0.05)),
    allocation_histogram: [[16, Math.floor(1000 * iterationFactor)], [32, Math.floor(500 * iterationFactor)], [64, Math.floor(200 * iterationFactor)]] as [number, number][],
    total_allocated_bytes: Math.floor(value * 1.8 * iterationFactor * (1 + Math.random() * 0.03)),
    top_allocating_functions: [
      { function: 'malloc', count: Math.floor(1000 * iterationFactor), total_size: Math.floor(value * 0.5 * iterationFactor) },
      { function: 'new_object', count: Math.floor(200 * iterationFactor), total_size: Math.floor(value * 0.3 * iterationFactor) },
    ],
  };
};

export const mockBenchmarkResults: BenchmarkResult[] = mockRuns.flatMap((run, runIndex) => {
  const commit = mockCommits.find(c => c.sha === run.commit_sha)!;
  return benchmarkNames.map((name, benchIndex) => ({
    id: `${run.run_id}_${name.replace(/_/g, '-')}`, // Ensure ID is filesystem friendly
    run_id: run.run_id,
    benchmark_name: name,
    result_json: generateBenchmarkResultJson(1000000 + benchIndex * 100000, runIndex + 1, name, commit.timestamp, run.timestamp),
  }));
});

export const mockEnrichedBenchmarkResults: EnrichedBenchmarkResult[] = mockBenchmarkResults.map(br => {
  const run = mockRuns.find(r => r.run_id === br.run_id)!;
  const commit = mockCommits.find(c => c.sha === run.commit_sha)!;
  const binary = mockBinaries.find(b => b.id === run.binary_id)!;
  return { ...br, commit, binary, run_python_version: run.python_version };
});

export const getAvailablePythonVersionFilters = (): PythonVersionFilterOption[] => {
  const versions = new Map<string, PythonVersionFilterOption>();
  mockRuns.forEach(run => {
    const key = `${run.python_version.major}.${run.python_version.minor}`;
    if (!versions.has(key)) {
      versions.set(key, {
        label: key,
        major: run.python_version.major,
        minor: run.python_version.minor,
      });
    }
  });
  return Array.from(versions.values()).sort((a,b) => {
    if (b.major === a.major) return b.minor - a.minor;
    return b.major - a.major;
  });
};
export const mockPythonVersionOptions: PythonVersionFilterOption[] = getAvailablePythonVersionFilters();

const findBestMatchingRun = (
  commitSha: string,
  binaryId: string,
  pythonMajor: number,
  pythonMinor: number,
  allRuns: Run[]
): Run | undefined => {
  const matchingRuns = allRuns
    .filter(
      (run) =>
        run.commit_sha === commitSha &&
        run.binary_id === binaryId &&
        run.python_version.major === pythonMajor &&
        run.python_version.minor === pythonMinor
    )
    .sort((a, b) => {
      if (b.python_version.patch !== a.python_version.patch) {
        return b.python_version.patch - a.python_version.patch;
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  return matchingRuns[0]; 
};

export const getMockDiffTableRows = (
  selectedCommitSha: string,
  selectedBinaryId: string, 
  selectedPythonMajor: number,
  selectedPythonMinor: number,
  metricKey: MetricKey = 'high_watermark_bytes'
): DiffTableRow[] => {
  const rows: DiffTableRow[] = [];
  const selectedCommit = mockCommits.find(c => c.sha === selectedCommitSha);
  if (!selectedCommit) return [];

  const commitsSortedOldestFirst = [...mockCommits].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const selectedCommitIndex = commitsSortedOldestFirst.findIndex(c => c.sha === selectedCommitSha);

  if (selectedCommitIndex === -1) return [];

  const prevCommit = selectedCommitIndex > 0 ? commitsSortedOldestFirst[selectedCommitIndex - 1] : undefined;

  for (const benchmarkName of benchmarkNames) {
    const currentRun = findBestMatchingRun(selectedCommit.sha, selectedBinaryId, selectedPythonMajor, selectedPythonMinor, mockRuns);
    const currentResult = currentRun ? mockBenchmarkResults.find(br => br.run_id === currentRun.run_id && br.benchmark_name === benchmarkName) : undefined;

    if (!currentResult || !currentRun) continue; 

    const currMetricValue = currentResult.result_json[metricKey] as number;
    const currPythonVersionStr = `${currentRun.python_version.major}.${currentRun.python_version.minor}.${currentRun.python_version.patch}`;

    let prevMetricValue: number | undefined = undefined;
    let metricDeltaPercent: number | undefined = undefined;
    let prevPythonVersionStr: string | undefined = undefined;
    let prevCommitDetails: Commit | undefined = undefined;

    if (prevCommit) {
      prevCommitDetails = prevCommit;
      const previousRun = findBestMatchingRun(prevCommit.sha, selectedBinaryId, selectedPythonMajor, selectedPythonMinor, mockRuns);
      const prevResult = previousRun ? mockBenchmarkResults.find(br => br.run_id === previousRun.run_id && br.benchmark_name === benchmarkName) : undefined;

      if (prevResult && previousRun) {
        prevMetricValue = prevResult.result_json[metricKey] as number;
        prevPythonVersionStr = `${previousRun.python_version.major}.${previousRun.python_version.minor}.${previousRun.python_version.patch}`;
        if (prevMetricValue !== undefined && prevMetricValue !== 0) {
          metricDeltaPercent = ((currMetricValue - prevMetricValue) / prevMetricValue) * 100;
        } else if (prevMetricValue === 0 && currMetricValue !== 0) {
          metricDeltaPercent = Infinity; 
        } else if (prevMetricValue === undefined && currMetricValue !== undefined ) {
           metricDeltaPercent = undefined; // New benchmark, no delta
        }
      }
    }
    
    rows.push({
      benchmark_name: benchmarkName,
      metric_delta_percent: metricDeltaPercent,
      prev_metric_value: prevMetricValue,
      curr_metric_value: currMetricValue,
      curr_commit_details: selectedCommit,
      prev_commit_details: prevCommitDetails,
      metric_key: metricKey,
      curr_python_version_str: currPythonVersionStr,
      prev_python_version_str: prevPythonVersionStr,
    });
  }
  return rows;
};
