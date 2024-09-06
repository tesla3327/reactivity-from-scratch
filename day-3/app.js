// Global variable to track the currently active effect
let activeEffect;
// Map to store dependencies for each reactive object and its properties
const targetMap = new Map();
// Set to store queued effects for batch processing
const queue = new Set();
// Flag to prevent multiple flush cycles
let isFlushPending = false;

// Function to queue an effect for execution
function queueJob(job) {
  queue.add(job);
  if (!isFlushPending) {
    isFlushPending = true;
    // Schedule job execution on the next microtask
    Promise.resolve().then(flushJobs);
  }
}

// Function to flush all queued effects
function flushJobs() {
  for (const job of queue) {
    job();
  }
  queue.clear();
  isFlushPending = false;
}

// Function to track dependencies
function track(target, key) {
  if (activeEffect) {
    // Get or create a map of dependencies for the target object
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()));
    }
    // Get or create a set of effects for the specific property
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, (dep = new Set()));
    }
    // Add the active effect to the dependency set
    dep.add(activeEffect);
  }
}

// Function to trigger effects when a reactive property changes
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const dep = depsMap.get(key);
  if (dep) {
    // Queue all effects associated with the changed property
    dep.forEach((effect) => queueJob(effect));
  }
}

// Function to remove an effect from all dependencies
function removeEffect(wrappedEffect) {
  targetMap.forEach((depsMap, target) => {
    depsMap.forEach((dep, key) => {
      if (dep.has(wrappedEffect)) {
        dep.delete(wrappedEffect);
        if (dep.size === 0) {
          depsMap.delete(key);
        }
      }
    });
    if (depsMap.size === 0) {
      targetMap.delete(target);
    }
  });
}

// Function to create and run a watchEffect
function watchEffect(effect) {
  let cleanup;
  const wrappedEffect = () => {
    // Run cleanup function if it exists
    if (cleanup) {
      cleanup();
    }
    activeEffect = wrappedEffect;
    cleanup = undefined;
    // Provide a function to register cleanup
    const registerCleanup = (fn) => {
      cleanup = fn;
    };
    try {
      // Run the effect and pass the cleanup registration function
      effect(registerCleanup);
    } finally {
      activeEffect = null;
    }
  };

  // Queue the initial run of the effect
  queueJob(wrappedEffect);

  // Return a function to stop the effect
  return () => {
    queue.delete(wrappedEffect);
    if (cleanup) cleanup();
    removeEffect(wrappedEffect);
  };
}

// Function to create a reactive reference
function ref(value) {
  const refObject = {
    get value() {
      track(refObject, 'value');
      return value;
    },
    set value(newValue) {
      value = newValue;
      trigger(refObject, 'value');
    },
  };
  return refObject;
}

// Demo
const count = ref(0);
let output = '';

// Create a watchEffect to update output when count changes
const stop = watchEffect((onCleanup) => {
  output += `The count is: ${count.value}\n`;
  updateOutput();

  // Register a cleanup function
  onCleanup(() => {
    output += 'Cleanup\n';
    updateOutput();
  });
});

// Event listeners for buttons
document
  .getElementById('increment')
  .addEventListener('click', () => {
    count.value++;
  });

document
  .getElementById('increment-twice')
  .addEventListener('click', () => {
    count.value++;
    count.value++;
  });

document
  .getElementById('stop')
  .addEventListener('click', () => {
    stop();
    output += 'Effect stopped\n';
  });

// Function to update the output in the DOM
function updateOutput() {
  document.getElementById('output').textContent = output;
}

// Initial output update
updateOutput();
