import type { Commit, Binary, Run, BenchmarkResult, EnrichedBenchmarkResult, DiffTableRow, PythonVersion, MetricKey, PythonVersionFilterOption } from './types';

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
// Sort commits by timestamp descending (newest first) for easier "previous commit" logic
mockCommits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());


// Binaries are now sets of flags
export const mockBinaries: Binary[] = [
  { id: 'default', name: 'Default', flags: [] },
  { id: 'debug', name: 'Debug', flags: ['debug'] },
  { id: 'nogil', name: 'No GIL', flags: ['nogil'] },
  { id: 'debug-nogil', name: 'Debug & No GIL', flags: ['debug', 'nogil'] },
  { id: 'opt', name: 'Optimized', flags: ['opt'] },
];

// Runs link a commit, a binary flag set, and a specific Python version
const createRun = (run_id: string, commit_sha: string, binary_id: string, python_version: PythonVersion, daysAgoOffset: number): Run => {
  // Find the commit's original daysAgo to base the run's timestamp accurately
  const commit = mockCommits.find(c => c.sha === commit_sha);
  let baseTimestamp = Date.now();
  if (commit) {
    // This logic is a bit simplified; assumes mockCommits 'daysAgo' is relative to current 'Date.now()'
    // For more precise matching, commit timestamp should be used directly.
    // Let's use commit's timestamp and add a small jitter if daysAgoOffset is for sub-day variations.
    baseTimestamp = new Date(commit.timestamp).getTime();
  }
  
  return {
    run_id,
    commit_sha,
    binary_id,
    python_version,
    timestamp: new Date(baseTimestamp - daysAgoOffset * 3600 * 1000).toISOString(), // Offset in hours for variety
  };
};


export const mockRuns: Run[] = [
  // Commit 0 (u1v2w3x4 - newest)
  createRun('run_c0_b0_v0', mockCommits[0].sha, mockBinaries[0].id, { major: 3, minor: 13, patch: 0 }, 0),
  createRun('run_c0_b1_v0', mockCommits[0].sha, mockBinaries[1].id, { major: 3, minor: 13, patch: 0 }, 0),
  createRun('run_c0_b0_v1', mockCommits[0].sha, mockBinaries[0].id, { major: 3, minor: 12, patch: 5 }, 0),

  // Commit 1 (q7r8s9t0)
  createRun('run_c1_b0_v0', mockCommits[1].sha, mockBinaries[0].id, { major: 3, minor: 13, patch: 0 }, 1),
  createRun('run_c1_b1_v0', mockCommits[1].sha, mockBinaries[1].id, { major: 3, minor: 13, patch: 0 }, 1),
  createRun('run_c1_b2_v1', mockCommits[1].sha, mockBinaries[2].id, { major: 3, minor: 12, patch: 5 }, 1),
  createRun('run_c1_b0_v2', mockCommits[1].sha, mockBinaries[0].id, { major: 3, minor: 12, patch: 4 }, 1),

  // Commit 2 (m3n4o5p6)
  createRun('run_c2_b0_v0', mockCommits[2].sha, mockBinaries[0].id, { major: 3, minor: 13, patch: 0 }, 2),
  createRun('run_c2_b3_v1', mockCommits[2].sha, mockBinaries[3].id, { major: 3, minor: 12, patch: 4 }, 2),

  // Commit 3 (i9j0k1l2)
  createRun('run_c3_b0_v0', mockCommits[3].sha, mockBinaries[0].id, { major: 3, minor: 12, patch: 3 }, 3),
  createRun('run_c3_b1_v0', mockCommits[3].sha, mockBinaries[1].id, { major: 3, minor: 12, patch: 3 }, 3),

  // Commit 4 (e5f6g7h8)
  createRun('run_c4_b0_v0', mockCommits[4].sha, mockBinaries[0].id, { major: 3, minor: 12, patch: 1 }, 4),
  createRun('run_c4_b0_v1', mockCommits[4].sha, mockBinaries[0].id, { major: 3, minor: 11, patch: 5 }, 4),
  
  // Commit 5 (a1b2c3d4 - oldest)
  createRun('run_c5_b0_v0', mockCommits[5].sha, mockBinaries[0].id, { major: 3, minor: 12, patch: 0 }, 5),
  createRun('run_c5_b1_v0', mockCommits[5].sha, mockBinaries[1].id, { major: 3, minor: 12, patch: 0 }, 5),
];


export const benchmarkNames = ['pyperformance_go', 'pyperformance_json_dumps', 'pyperformance_regex_dna', 'custom_memory_test_A', 'custom_memory_test_B'];

const generateBenchmarkResultJson = (baseValue: number, iteration: number, benchmarkName: string): BenchmarkResultJson => {
  const factor = 1 + (Math.random() - 0.45) * 0.1 * iteration; // Small random variation
  return {
    benchmark_name: benchmarkName, // Storing benchmark_name here too
    high_watermark_bytes: Math.floor(baseValue * factor * (1 + Math.random() * 0.1)),
    allocation_histogram: [[16, Math.floor(1000 * factor)], [32, Math.floor(500 * factor)], [64, Math.floor(200 * factor)]] as [number, number][],
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
    result_json: generateBenchmarkResultJson(1000000 + benchIndex * 200000, runIndex + 1, name),
  }))
);

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


// Find the best matching run for a commit, binaryId (flags), and Python major.minor prefix
// Prefers highest patch, then latest timestamp if multiple runs match.
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
      // Sort by patch descending
      if (b.python_version.patch !== a.python_version.patch) {
        return b.python_version.patch - a.python_version.patch;
      }
      // Then by timestamp descending (newest first)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  return matchingRuns[0]; // Return the best match (highest patch, newest)
};


export const getMockDiffTableRows = (
  selectedCommitSha: string,
  selectedBinaryId: string, // This is now the ID of a flag set
  selectedPythonMajor: number,
  selectedPythonMinor: number,
  metricKey: MetricKey = 'high_watermark_bytes'
): DiffTableRow[] => {
  const rows: DiffTableRow[] = [];
  const selectedCommit = mockCommits.find(c => c.sha === selectedCommitSha);
  if (!selectedCommit) return [];

  // Find the index of the selected commit in the chronologically sorted (oldest to newest) commit list
  const commitsSortedOldestFirst = [...mockCommits].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const selectedCommitIndex = commitsSortedOldestFirst.findIndex(c => c.sha === selectedCommitSha);

  if (selectedCommitIndex === -1) return []; // Should not happen if selectedCommit is found

  const prevCommit = selectedCommitIndex > 0 ? commitsSortedOldestFirst[selectedCommitIndex - 1] : undefined;

  for (const benchmarkName of benchmarkNames) {
    const currentRun = findBestMatchingRun(selectedCommit.sha, selectedBinaryId, selectedPythonMajor, selectedPythonMinor, mockRuns);
    const currentResult = currentRun ? mockBenchmarkResults.find(br => br.run_id === currentRun.run_id && br.benchmark_name === benchmarkName) : undefined;

    if (!currentResult || !currentRun) continue; // No data for current selection for this benchmark

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
          metricDeltaPercent = Infinity; // Or handle as a large number or special string
        }
      }
    }
    
    // Only add row if there's a current value. Previous value is optional.
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
