import type { 
  Binary, 
  Commit, 
  DiffTableRow, 
  EnrichedBenchmarkResult, 
  PythonVersionFilterOption,
  BenchmarkResultJson
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, `API error: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  // Commit endpoints
  getCommits: (skip: number = 0, limit: number = 100) => 
    fetchApi<Commit[]>(`/api/commits?skip=${skip}&limit=${limit}`),
  getCommit: (sha: string) => fetchApi<Commit>(`/api/commits/${sha}`),

  // Binary endpoints
  getBinaries: () => fetchApi<Binary[]>('/api/binaries'),
  getBinary: (id: string) => fetchApi<Binary>(`/api/binaries/${id}`),

  // Python version endpoints
  getPythonVersions: () => fetchApi<PythonVersionFilterOption[]>('/api/python-versions'),

  // Benchmark result endpoints
  getBenchmarkResults: (params: { 
    benchmark_name?: string;
    binary_id?: string;
    python_major?: number;
    python_minor?: number;
    skip?: number;
    limit?: number;
  } = {}) => {
    const queryParams = new URLSearchParams();
    if (params.benchmark_name) queryParams.append('benchmark_name', params.benchmark_name);
    if (params.binary_id) queryParams.append('binary_id', params.binary_id);
    if (params.python_major !== undefined) queryParams.append('python_major', params.python_major.toString());
    if (params.python_minor !== undefined) queryParams.append('python_minor', params.python_minor.toString());
    if (params.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
    
    return fetchApi<EnrichedBenchmarkResult[]>(`/api/benchmark-results?${queryParams.toString()}`);
  },

  // Diff endpoint
  getDiffTable: (params: {
    commit_sha: string;
    binary_id: string;
    metric_key: string;
  }) => {
    const queryParams = new URLSearchParams();
    queryParams.append('commit_sha', params.commit_sha);
    queryParams.append('binary_id', params.binary_id);
    queryParams.append('metric_key', params.metric_key);
    
    return fetchApi<DiffTableRow[]>(`/api/diff?${queryParams.toString()}`);
  },

  // Upload endpoint
  uploadBenchmarkResults: (data: {
    commit_sha: string;
    binary_id: string;
    python_version: {
      major: number;
      minor: number;
      patch: number;
    };
    benchmark_results: BenchmarkResultJson[];
  }) => fetchApi<{ success: boolean }>('/api/upload', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

export { ApiError }; 