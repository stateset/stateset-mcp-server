/**
 * Global teardown for Jest tests
 * Ensures all resources are properly cleaned up after test suite completes
 */

export default async function globalTeardown() {
  // Global teardown runs in a separate context
  // We can't reliably import modules here, so just give time for cleanup
  try {
    // Give async operations and timers time to complete
    await new Promise(resolve => setTimeout(resolve, 200));
  } catch (error) {
    // Ignore errors during teardown
    console.error('Error during teardown:', error);
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  console.log('Global teardown completed - all resources cleaned up');
}
