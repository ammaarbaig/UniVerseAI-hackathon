import { defineConfig } from 'vitest/config';

// On Windows, running the four spec files in parallel intermittently caused Vitest
// to drop a whole file from the run — reporting e.g. 45/61 passed instead of 72,
// with no failure and no error. A silently short run is dangerous: a genuine
// regression can hide behind a file that never executed. Serialising file
// execution in a single fork removes the race (it is a cache/transform write
// collision, not a test bug). The suite is I/O-light, so the cost is negligible.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    // Fail loudly if a file is dropped again rather than silently under-reporting.
    passWithNoTests: false,
  },
});
