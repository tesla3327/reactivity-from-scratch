// Global variables for reactivity system
let activeEffect;
const targetMap = new Map();
// Track nested effects
const effectStack = [];

// Track dependencies for reactive properties
function track(target, key) {
  if (activeEffect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, (dep = new Set()));
    }
    dep.add(activeEffect);
  }
}

// Trigger effects for reactive properties
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const dep = depsMap.get(key);
  if (dep) {
    dep.forEach((effect) => queueJob(effect));
  }
}

// Utility function to check if a value is an object
function isObject(val) {
  return val !== null && typeof val === 'object';
}

// Check if a value is a ref
function isRef(value) {
  return !!(value && value.__v_isRef);
}

// Unwrap a ref if it's a ref, otherwise return the value
function unref(ref) {
  return isRef(ref) ? ref.value : ref;
}

// Create a reactive proxy for an object
function reactive(target) {
  if (!isObject(target)) {
    return target;
  }

  const handler = {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver);
      if (isRef(result)) {
        return result.value;
      }
      track(target, key);
      return isObject(result) ? reactive(result) : result;
    },
    set(target, key, value, receiver) {
      const oldValue = target[key];
      if (isRef(oldValue) && !isRef(value)) {
        oldValue.value = value;
        return true;
      } else {
        const result = Reflect.set(
          target,
          key,
          value,
          receiver
        );
        if (result && oldValue !== value) {
          trigger(target, key);
        }
        return result;
      }
    },
    deleteProperty(target, key) {
      const hadKey = Object.prototype.hasOwnProperty.call(
        target,
        key
      );
      const result = Reflect.deleteProperty(target, key);
      if (result && hadKey) {
        trigger(target, key);
      }
      return result;
    },
  };

  // Special handling for arrays
  if (Array.isArray(target)) {
    handler.set = function (target, key, value, receiver) {
      const oldValue = target[key];
      const result = Reflect.set(
        target,
        key,
        value,
        receiver
      );
      if (result && oldValue !== value) {
        trigger(target, key);
        if (key !== 'length') {
          trigger(target, 'length');
        }
      }
      return result;
    };
  }

  return new Proxy(target, handler);
}

// Create a reactive reference
function ref(initialValue) {
  return reactive({
    __v_isRef: true,
    value: initialValue,
  });
}

// Job queue for batching updates
const queue = new Set();
let isFlushPending = false;

// Queue a job for execution in the next microtask
function queueJob(job) {
  queue.add(job);
  if (!isFlushPending) {
    isFlushPending = true;
    Promise.resolve().then(flushJobs);
  }
}

// Execute all queued jobs
function flushJobs() {
  for (const job of queue) {
    job();
  }
  queue.clear();
  isFlushPending = false;
}

// Methods to abstract effect stack operations
function pushEffect(effect) {
  effectStack.push(effect);
  activeEffect = effect;
}

function popEffect() {
  effectStack.pop();
  activeEffect = effectStack[effectStack.length - 1];
}

// Function to create and run a watchEffect
function watchEffect(effect) {
  let cleanup;
  const wrappedEffect = () => {
    if (cleanup) {
      cleanup();
    }
    pushEffect(wrappedEffect);
    cleanup = undefined;
    const registerCleanup = (fn) => {
      cleanup = fn;
    };
    try {
      effect(registerCleanup);
    } finally {
      popEffect();
    }
  };

  queueJob(wrappedEffect);

  return () => {
    queue.delete(wrappedEffect);
    if (cleanup) cleanup();
    removeEffect(wrappedEffect);
  };
}

// Function to create a computed reference
function computed(getter) {
  let value;
  let dirty = true;

  const computedRef = {
    get value() {
      if (dirty) {
        pushEffect(computedEffect);
        value = getter();
        popEffect();
        dirty = false;
      }
      track(computedRef, 'value');
      return value;
    },
  };

  const computedEffect = () => {
    dirty = true;
    trigger(computedRef, 'value');
  };

  return computedRef;
}

// Composable Store Implementation
function createStore(setup) {
  return reactive(setup());
}

// Demo Store
const useStore = createStore(() => {
  const count = ref(0);
  const todos = ref([]);

  const doubleCount = computed(() => count.value * 2);

  function increment() {
    count.value++;
  }

  function addTodo(text) {
    todos.value.push({
      id: Date.now(),
      text,
      completed: false,
    });
  }

  function toggleTodo(id) {
    const todo = todos.value.find((t) => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
    }
  }

  return {
    count,
    todos,
    doubleCount,
    increment,
    addTodo,
    toggleTodo,
  };
});

// UI Updates
watchEffect(() => {
  document.getElementById('count').textContent =
    useStore.count;
});

watchEffect(() => {
  document.getElementById('doubleCount').textContent =
    useStore.doubleCount.value;
});

watchEffect(() => {
  const todoList = document.getElementById('todoList');
  todoList.innerHTML = '';
  useStore.todos.forEach((todo) => {
    const li = document.createElement('li');
    li.textContent = `${todo.text} (${
      todo.completed ? 'Completed' : 'Pending'
    })`;
    li.onclick = () => useStore.toggleTodo(todo.id);
    todoList.appendChild(li);
  });
});

// Event Listeners
document
  .getElementById('increment')
  .addEventListener('click', useStore.increment);

document
  .getElementById('todoForm')
  .addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('todoInput');
    if (input.value.trim()) {
      useStore.addTodo(input.value.trim());
      input.value = '';
    }
  });
