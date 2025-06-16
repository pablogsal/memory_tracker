import type { Commit, Binary, Run, BenchmarkResult, EnrichedBenchmarkResult, DiffTableRow, PythonVersion, MetricKey, PythonVersionFilterOption, BenchmarkResultJson } from './types';

const createCommit = (sha: string, daysAgo: number, message: string, author: string, pythonVersion: PythonVersion): Commit => ({
  sha,
  timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  message,
  author,
  python_version: pythonVersion,
});

export const mockCommits: Commit[] = [
  createCommit('u1v2w3x4', 0, 'Release version 1.0.0', 'Alice Wonderland', { major: 3, minor: 13, patch: 0 }),
  createCommit('q7r8s9t0', 1, 'Fix minor bug in UI', 'Eve Harrington', { major: 3, minor: 13, patch: 0 }),
  createCommit('m3n4o5p6', 2, 'Optimize hot path for Python 3.12', 'David Copperfield', { major: 3, minor: 12, patch: 5 }),
  createCommit('i9j0k1l2', 3, 'Refactor memory allocation (3.12 base)', 'Carol Danvers', { major: 3, minor: 12, patch: 4 }),
  createCommit('e5f6g7h8', 4, 'Add perf critical module for 3.12', 'Bob The Builder', { major: 3, minor: 12, patch: 3 }),
  createCommit('a1b2c3d4', 5, 'Initial commit (Python 3.11)', 'Alice Wonderland', { major: 3, minor: 11, patch: 0 }),
];
// Ensure commits are sorted newest first by timestamp after creation
mockCommits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());


export const mockBinaries: Binary[] = [
  { id: 'default', name: 'Default', flags: [] },
  { id: 'debug', name: 'Debug', flags: ['--with-debug'] },
  { id: 'nogil', name: 'No GIL', flags: ['--disable-gil'] },
  { id: 'debug-nogil', name: 'Debug & No GIL', flags: ['--with-debug', '--disable-gil'] },
  { id: 'lto', name: 'LTO Enabled', flags: ['--with-lto'] },
  { id: 'pgo', name: 'PGO Optimized', flags: ['--enable-optimizations'] },
];

// A Run links a commit, its specific python version, and a binary configuration
const createRun = (run_id: string, commit_sha: string, binary_id: string, daysAgoOffset: number): Run => {
  const commit = mockCommits.find(c => c.sha === commit_sha);
  if (!commit) throw new Error(`Commit ${commit_sha} not found for run ${run_id}`);
  
  let baseTimestamp = new Date(commit.timestamp).getTime();
  
  return {
    run_id,
    commit_sha,
    binary_id,
    python_version: commit.python_version, // Run's Python version MUST match the commit's
    timestamp: new Date(baseTimestamp - daysAgoOffset * 3600 * 1000).toISOString(), 
  };
};

export const mockRuns: Run[] = [
  // Commit 0 (u1v2w3x4 - Py 3.13.0) - newest
  createRun('run_c0_b0_py313_0', mockCommits[0].sha, mockBinaries[0].id, 0),
  createRun('run_c0_b1_py313_0', mockCommits[0].sha, mockBinaries[1].id, 0.1),
  createRun('run_c0_b2_py313_0', mockCommits[0].sha, mockBinaries[2].id, 0.2),

  // Commit 1 (q7r8s9t0 - Py 3.13.0)
  createRun('run_c1_b0_py313_0', mockCommits[1].sha, mockBinaries[0].id, 1),
  createRun('run_c1_b1_py313_0', mockCommits[1].sha, mockBinaries[1].id, 1.1),

  // Commit 2 (m3n4o5p6 - Py 3.12.5)
  createRun('run_c2_b0_py312_5', mockCommits[2].sha, mockBinaries[0].id, 2),
  createRun('run_c2_b3_py312_5', mockCommits[2].sha, mockBinaries[3].id, 2.1),

  // Commit 3 (i9j0k1l2 - Py 3.12.4)
  createRun('run_c3_b0_py312_4', mockCommits[3].sha, mockBinaries[0].id, 3),
  createRun('run_c3_b1_py312_4', mockCommits[3].sha, mockBinaries[1].id, 3.1),

  // Commit 4 (e5f6g7h8 - Py 3.12.3)
  createRun('run_c4_b0_py312_3', mockCommits[4].sha, mockBinaries[0].id, 4),
  createRun('run_c4_b2_py312_3', mockCommits[4].sha, mockBinaries[2].id, 4.1),

  // Commit 5 (a1b2c3d4 - Py 3.11.0) - oldest
  createRun('run_c5_b0_py311_0', mockCommits[5].sha, mockBinaries[0].id, 5),
  createRun('run_c5_b4_py311_0', mockCommits[5].sha, mockBinaries[4].id, 5.1),
];


export const benchmarkNames = ['pyperformance_go', 'pyperformance_json_dumps', 'pyperformance_regex_dna', 'custom_memory_test_A', 'custom_memory_test_B', 'startup_time', 'threading_overhead'];

const generateBenchmarkResultJson = (baseValue: number, iteration: number, benchmarkName: string, commitTimestamp: string, runTimestamp: string): BenchmarkResultJson => {
  const timeDiffFactor = (new Date(runTimestamp).getTime() - new Date(commitTimestamp).getTime()) / (1000 * 60 * 60 * 24); 
  const iterationFactor = 1 + (Math.random() - 0.45) * 0.05 * iteration + timeDiffFactor * 0.01; 

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
    id: `${run.run_id}_${name.replace(/_/g, '-')}`,
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

// Derives available Python major.minor versions from commits for filtering in Trends view
export const getAvailablePythonVersionFilters = (): PythonVersionFilterOption[] => {
  const versions = new Map<string, PythonVersionFilterOption>();
  mockCommits.forEach(commit => {
    const key = `${commit.python_version.major}.${commit.python_version.minor}`;
    if (!versions.has(key)) {
      versions.set(key, {
        label: key,
        major: commit.python_version.major,
        minor: commit.python_version.minor,
      });
    }
  });
  return Array.from(versions.values()).sort((a,b) => {
    if (b.major === a.major) return b.minor - a.minor;
    return b.major - a.major;
  });
};
export const mockPythonVersionOptions: PythonVersionFilterOption[] = getAvailablePythonVersionFilters();


const findBestRunForCommit = (
  commit: Commit,
  binaryId: string,
  allRuns: Run[]
): Run | undefined => {
  // Find runs that match the commit's SHA, its specific Python version, and the binary ID
  const matchingRuns = allRuns
    .filter(
      (run) =>
        run.commit_sha === commit.sha &&
        run.binary_id === binaryId &&
        run.python_version.major === commit.python_version.major &&
        run.python_version.minor === commit.python_version.minor &&
        run.python_version.patch === commit.python_version.patch // Match full version of the commit
    )
    // If multiple runs (e.g. reruns), pick the latest one by timestamp
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return matchingRuns[0]; 
};


export const getMockDiffTableRows = (
  selectedCommitSha: string,
  selectedBinaryId: string, 
  metricKey: MetricKey = 'high_watermark_bytes'
): DiffTableRow[] => {
  const rows: DiffTableRow[] = [];
  const selectedCommit = mockCommits.find(c => c.sha === selectedCommitSha);
  if (!selectedCommit) return [];

  // Sort commits by timestamp to reliably find the predecessor
  const commitsSortedByTimestamp = [...mockCommits].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const selectedCommitIndexInSorted = commitsSortedByTimestamp.findIndex(c => c.sha === selectedCommitSha);

  const prevCommitInChronologicalOrder = selectedCommitIndexInSorted > 0 ? commitsSortedByTimestamp[selectedCommitIndexInSorted - 1] : undefined;

  for (const benchmarkName of benchmarkNames) {
    const currentRun = findBestRunForCommit(selectedCommit, selectedBinaryId, mockRuns);
    const currentResult = currentRun ? mockBenchmarkResults.find(br => br.run_id === currentRun.run_id && br.benchmark_name === benchmarkName) : undefined;

    if (!currentResult || !currentRun) continue; 

    const currMetricValue = currentResult.result_json[metricKey] as number;
    // Current Python version is derived from the commit itself
    const currPythonVersionStr = `${selectedCommit.python_version.major}.${selectedCommit.python_version.minor}.${selectedCommit.python_version.patch}`;

    let prevMetricValue: number | undefined = undefined;
    let metricDeltaPercent: number | undefined = undefined;
    let prevPythonVersionStr: string | undefined = undefined;
    let prevCommitDetails: Commit | undefined = undefined;

    // Only compare if previous commit exists AND it's for the same Python Major.Minor version
    if (prevCommitInChronologicalOrder && 
        prevCommitInChronologicalOrder.python_version.major === selectedCommit.python_version.major &&
        prevCommitInChronologicalOrder.python_version.minor === selectedCommit.python_version.minor) {
      
      prevCommitDetails = prevCommitInChronologicalOrder;
      // For previous run, we use the parent commit's *specific* Python version and the selected binary
      const previousRun = findBestRunForCommit(prevCommitDetails, selectedBinaryId, mockRuns);
      const prevResult = previousRun ? mockBenchmarkResults.find(br => br.run_id === previousRun.run_id && br.benchmark_name === benchmarkName) : undefined;

      if (prevResult && previousRun) {
        prevMetricValue = prevResult.result_json[metricKey] as number;
        prevPythonVersionStr = `${prevCommitDetails.python_version.major}.${prevCommitDetails.python_version.minor}.${prevCommitDetails.python_version.patch}`;
        
        if (prevMetricValue !== undefined && prevMetricValue !== 0) {
          metricDeltaPercent = ((currMetricValue - prevMetricValue) / prevMetricValue) * 100;
        } else if (prevMetricValue === 0 && currMetricValue !== 0) {
          metricDeltaPercent = Infinity; 
        }
        // If prevMetricValue is undefined (e.g. benchmark didn't run for parent), delta is also undefined
      }
    }
    
    rows.push({
      benchmark_name: benchmarkName,
      metric_delta_percent: metricDeltaPercent,
      prev_metric_value: prevMetricValue,
      curr_metric_value: currMetricValue,
      curr_commit_details: selectedCommit,
      prev_commit_details: prevCommitDetails, // Will be undefined if parent commit is for different Py major.minor
      metric_key: metricKey,
      curr_python_version_str: currPythonVersionStr,
      prev_python_version_str: prevPythonVersionStr,
    });
  }
  return rows;
};
