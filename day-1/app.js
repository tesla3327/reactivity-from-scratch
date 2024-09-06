// Global variable to track the currently active effect
let activeEffect;
// Map to store dependencies for each reactive object and its properties
const targetMap = new Map();

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
    // Run all effects associated with the changed property
    dep.forEach((effect) => effect());
  }
}

// Function to create a reactive reference
function ref(initialValue) {
  const r = {
    get value() {
      // Track this property access
      track(r, 'value');
      return initialValue;
    },
    set value(newValue) {
      initialValue = newValue;
      // Trigger effects when the value changes
      trigger(r, 'value');
    },
  };
  return r;
}

// Function to create and run an effect
function effect(fn) {
  const wrappedEffect = () => {
    activeEffect = wrappedEffect;
    fn();
    activeEffect = null;
  };
  wrappedEffect();
  return wrappedEffect;
}

// Demo: Counter
const count = ref(0);

// Create an effect to update the DOM when count changes
effect(() => {
  document.getElementById(
    'count-display'
  ).textContent = `Count: ${count.value}`;
});

// Event listeners for buttons
document
  .getElementById('increment')
  .addEventListener('click', () => {
    count.value++;
  });

document
  .getElementById('decrement')
  .addEventListener('click', () => {
    count.value--;
  });

document
  .getElementById('reset')
  .addEventListener('click', () => {
    count.value = 0;
  });
