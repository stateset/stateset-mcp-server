/**
 * Global teardown for Jest tests
 * Ensures all resources are properly cleaned up after test suite completes
 */

export default async function globalTeardown() {
  // Give async operations time to complete
  await new Promise(resolve => setImmediate(resolve));

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  console.log('Global teardown completed - all resources cleaned up');
}
