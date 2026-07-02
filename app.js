import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  set,
  onValue,
  remove,
  update,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBo_ZboRdJSJALqDP0gKI5Gmf1Lpq5chI4",
  authDomain: "todo-list-backend-41cf7.firebaseapp.com",
  projectId: "todo-list-backend-41cf7",
  storageBucket: "todo-list-backend-41cf7.firebasestorage.app",
  messagingSenderId: "170003024264",
  appId: "1:170003024264:web:adcd663060e219252ad23d",
  measurementId: "G-H1RQKJJ2SK",
  databaseURL: "https://todo-list-backend-41cf7-default-rtdb.firebaseio.com/",
};

const CATEGORIES = [
  { id: "hobby", label: "취미", icon: "🎨" },
  { id: "work", label: "직업", icon: "💼" },
  { id: "life", label: "생활", icon: "🏠" },
  { id: "study", label: "공부", icon: "📚" },
];

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getDatabase(app);

let todos = [];
let currentFilter = "all";
let editingId = null;
let draggedTodoId = null;
let currentUser = null;
let todosRef = null;
let unsubscribeTodos = null;
let isSignUpMode = false;
let isAppStarted = false;
let isDragSetup = false;

const addForm = document.getElementById("addForm");
const todoInput = document.getElementById("todoInput");
const todoList = document.getElementById("todoList");
const categoriesGrid = document.getElementById("categoriesGrid");
const footer = document.getElementById("footer");
const todoCount = document.getElementById("todoCount");
const clearCompletedBtn = document.getElementById("clearCompleted");
const filterBtns = document.querySelectorAll(".filter-btn");
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editInput = document.getElementById("editInput");
const cancelEditBtn = document.getElementById("cancelEdit");
const modalBackdrop = document.getElementById("modalBackdrop");
const welcomeScreen = document.getElementById("welcomeScreen");
const authScreen = document.getElementById("authScreen");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authError = document.getElementById("authError");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authToggleText = document.getElementById("authToggleText");
const authToggleBtn = document.getElementById("authToggleBtn");
const todoApp = document.getElementById("todoApp");
const startBtn = document.getElementById("startBtn");
const userEmail = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

function getTodosRef(user) {
  return ref(db, `users/${user.uid}/todos`);
}

function unsubscribeFromTodos() {
  if (unsubscribeTodos) {
    unsubscribeTodos();
    unsubscribeTodos = null;
  }
  todosRef = null;
  todos = [];
}

function subscribeTodos(user) {
  unsubscribeFromTodos();
  todosRef = getTodosRef(user);

  unsubscribeTodos = onValue(todosRef, (snapshot) => {
    const data = snapshot.val();

    todos = data
      ? Object.entries(data)
          .map(([id, todo]) => ({ id, ...todo }))
          .sort((a, b) => b.createdAt - a.createdAt)
      : [];

    render();
  });
}

function showAuthError(message) {
  authError.textContent = message;
  authError.hidden = false;
}

function clearAuthError() {
  authError.textContent = "";
  authError.hidden = true;
}

function updateAuthModeUI() {
  if (isSignUpMode) {
    authTitle.textContent = "회원가입";
    authSubtitle.textContent = "새 계정을 만들어 할일 목록을 시작하세요";
    authSubmitBtn.textContent = "회원가입";
    authToggleText.textContent = "이미 계정이 있으신가요?";
    authToggleBtn.textContent = "로그인";
    authPassword.autocomplete = "new-password";
  } else {
    authTitle.textContent = "로그인";
    authSubtitle.textContent = "할일 목록을 사용하려면 로그인하세요";
    authSubmitBtn.textContent = "로그인";
    authToggleText.textContent = "계정이 없으신가요?";
    authToggleBtn.textContent = "회원가입";
    authPassword.autocomplete = "current-password";
  }
}

function showAuthScreen() {
  authScreen.hidden = false;
  todoApp.hidden = true;
  clearAuthError();
  updateAuthModeUI();
}

function hideAuthScreen() {
  authScreen.hidden = true;
}

function showTodoApp(user) {
  currentUser = user;
  hideAuthScreen();
  todoApp.hidden = false;
  todoApp.classList.add("app-enter");
  userEmail.textContent = user.email || "사용자";

  if (!isDragSetup) {
    setupDragAndDrop();
    isDragSetup = true;
  }

  subscribeTodos(user);
  todoInput.focus();
}

function hideTodoApp() {
  currentUser = null;
  todoApp.hidden = true;
  closeEditModal();
  unsubscribeFromTodos();
  render();
}

function getAuthErrorMessage(error) {
  console.error("Firebase Auth error:", error.code, error.message);

  switch (error.code) {
    case "auth/invalid-email":
      return "올바른 이메일 형식을 입력해 주세요.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    case "auth/email-already-in-use":
      return "이미 사용 중인 이메일입니다.";
    case "auth/weak-password":
      return "비밀번호는 6자 이상이어야 합니다.";
    case "auth/too-many-requests":
      return "너무 많은 시도가 있었습니다. 잠시 후 다시 시도해 주세요.";
    case "auth/operation-not-allowed":
      return "Firebase에서 이메일/비밀번호 로그인이 꺼져 있습니다. Firebase 콘솔 → Authentication → Sign-in method에서 '이메일/비밀번호'를 사용 설정해 주세요.";
    case "auth/network-request-failed":
      return "네트워크 오류입니다. 인터넷 연결을 확인하고 다시 시도해 주세요.";
    case "auth/configuration-not-found":
      return "Firebase Authentication이 아직 활성화되지 않았습니다. console.firebase.google.com → 프로젝트 'todo-list-backend-41cf7' → Authentication → '시작하기' 클릭 → Sign-in method에서 '이메일/비밀번호' 사용 설정 후 저장해 주세요.";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "Firebase API 키 설정이 올바르지 않습니다.";
    default:
      return error.message
        ? `오류: ${error.message}`
        : "오류가 발생했습니다. 다시 시도해 주세요.";
  }
}

function getFilteredTodos(includeCategorized = false) {
  let list = includeCategorized
    ? todos
    : todos.filter((t) => !t.category);

  switch (currentFilter) {
    case "active":
      return list.filter((t) => !t.completed);
    case "completed":
      return list.filter((t) => t.completed);
    default:
      return list;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderTodoItemHTML(todo, { compact = false } = {}) {
  const itemClass = compact ? "todo-item category-item" : "todo-item";

  return `
    <li class="${itemClass}${todo.completed ? " completed" : ""}" data-id="${todo.id}">
      <span class="drag-handle" draggable="true" aria-label="드래그하여 이동" title="드래그하여 이동">⠿</span>
      <input
        type="checkbox"
        class="todo-checkbox"
        ${todo.completed ? "checked" : ""}
        aria-label="완료 표시"
      />
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      <div class="todo-actions">
        <button type="button" class="icon-btn edit" aria-label="수정" title="수정">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button type="button" class="icon-btn delete" aria-label="삭제" title="삭제">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </li>
  `;
}

function renderMainList() {
  const filtered = getFilteredTodos(false);
  const activeCount = todos.filter((t) => !t.completed).length;

  if (todos.length === 0) {
    todoList.innerHTML = `
      <li class="empty-state">
        <div class="empty-state-icon">📝</div>
        <p>할일이 없습니다.<br />위에서 새 할일을 추가해 보세요.</p>
      </li>
    `;
    footer.hidden = true;
    return;
  }

  footer.hidden = false;
  todoCount.textContent = `${activeCount}개 남음`;

  if (filtered.length === 0) {
    todoList.innerHTML = `
      <li class="empty-state">
        <p>미분류 할일이 없습니다.<br />아래 카테고리에서 확인하거나, 카테고리 할일을 여기로 드래그하세요.</p>
      </li>
    `;
    return;
  }

  todoList.innerHTML = filtered.map((todo) => renderTodoItemHTML(todo)).join("");
}

function renderCategories() {
  categoriesGrid.innerHTML = CATEGORIES.map((category) => {
    const categoryTodos = todos.filter((t) => t.category === category.id);
    const itemsHTML =
      categoryTodos.length > 0
        ? categoryTodos.map((todo) => renderTodoItemHTML(todo, { compact: true })).join("")
        : `<li class="category-empty">할일을 여기로<br />드래그하세요</li>`;

    return `
      <article class="category-card">
        <div class="category-header">
          <span class="category-icon">${category.icon}</span>
          <span>${category.label}</span>
          <span class="category-count">${categoryTodos.length}</span>
        </div>
        <ul
          class="category-drop-zone"
          data-drop-category="${category.id}"
          aria-label="${category.label} 카테고리"
        >
          ${itemsHTML}
        </ul>
      </article>
    `;
  }).join("");
}

function render() {
  renderMainList();
  renderCategories();
}

async function addTodo(text) {
  if (!todosRef) return;

  const trimmed = text.trim();
  if (!trimmed) return;

  const newTodoRef = push(todosRef);

  await set(newTodoRef, {
    text: trimmed,
    completed: false,
    createdAt: Date.now(),
  });
}

function deleteTodo(id) {
  if (!currentUser) return;
  remove(ref(db, `users/${currentUser.uid}/todos/${id}`));
}

function toggleTodo(id) {
  if (!currentUser) return;

  const todo = todos.find((t) => t.id === id);
  if (todo) {
    update(ref(db, `users/${currentUser.uid}/todos/${id}`), {
      completed: !todo.completed,
    });
  }
}

function updateTodo(id, text) {
  if (!currentUser) return false;

  const trimmed = text.trim();
  if (!trimmed) return false;

  const todo = todos.find((t) => t.id === id);
  if (todo) {
    update(ref(db, `users/${currentUser.uid}/todos/${id}`), { text: trimmed });
    return true;
  }
  return false;
}

function assignCategory(todoId, categoryId) {
  if (!currentUser) return;

  const updates = categoryId ? { category: categoryId } : { category: null };
  update(ref(db, `users/${currentUser.uid}/todos/${todoId}`), updates);
}

function clearCompleted() {
  if (!currentUser) return;

  todos
    .filter((t) => t.completed)
    .forEach((t) => remove(ref(db, `users/${currentUser.uid}/todos/${t.id}`)));
}

function openEditModal(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;

  editingId = id;
  editInput.value = todo.text;
  editModal.hidden = false;
  editInput.focus();
  editInput.select();
}

function closeEditModal() {
  editingId = null;
  editModal.hidden = true;
  editInput.value = "";
}

function getDropZoneFromTarget(target) {
  return target.closest("[data-drop-category]");
}

function setupDragAndDrop() {
  todoApp.addEventListener("dragstart", (e) => {
    if (!e.target.classList.contains("drag-handle")) return;

    const item = e.target.closest(".todo-item");
    if (!item) return;

    draggedTodoId = item.dataset.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggedTodoId);
    item.classList.add("dragging");
  });

  todoApp.addEventListener("dragend", (e) => {
    const item = e.target.closest(".todo-item");
    if (item) item.classList.remove("dragging");
    draggedTodoId = null;
    document.querySelectorAll(".drag-over").forEach((el) => {
      el.classList.remove("drag-over");
    });
  });

  todoApp.addEventListener("dragover", (e) => {
    const dropZone = getDropZoneFromTarget(e.target);
    if (!dropZone || !draggedTodoId) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    document.querySelectorAll(".drag-over").forEach((el) => {
      el.classList.remove("drag-over");
    });
    dropZone.classList.add("drag-over");
  });

  todoApp.addEventListener("dragleave", (e) => {
    const dropZone = getDropZoneFromTarget(e.target);
    if (!dropZone) return;

    const related = e.relatedTarget;
    if (related && dropZone.contains(related)) return;

    dropZone.classList.remove("drag-over");
  });

  todoApp.addEventListener("drop", (e) => {
    const dropZone = getDropZoneFromTarget(e.target);
    if (!dropZone || !draggedTodoId) return;

    e.preventDefault();
    dropZone.classList.remove("drag-over");

    const categoryId = dropZone.dataset.dropCategory;
    assignCategory(draggedTodoId, categoryId || null);
    draggedTodoId = null;
  });
}

function startApp() {
  if (isAppStarted) return;
  isAppStarted = true;

  welcomeScreen.hidden = true;

  if (auth.currentUser) {
    showTodoApp(auth.currentUser);
  } else {
    showAuthScreen();
  }
}

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAuthError();

  const email = authEmail.value.trim();
  const password = authPassword.value;

  authSubmitBtn.disabled = true;

  try {
    if (isSignUpMode) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }

    authForm.reset();
  } catch (error) {
    showAuthError(getAuthErrorMessage(error));
  } finally {
    authSubmitBtn.disabled = false;
  }
});

authToggleBtn.addEventListener("click", () => {
  isSignUpMode = !isSignUpMode;
  clearAuthError();
  updateAuthModeUI();
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch {
    window.alert("로그아웃에 실패했습니다. 다시 시도해 주세요.");
  }
});

onAuthStateChanged(auth, (user) => {
  if (!isAppStarted) return;

  if (user) {
    showTodoApp(user);
  } else {
    hideTodoApp();
    showAuthScreen();
  }
});

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await addTodo(todoInput.value);
  todoInput.value = "";
  todoInput.focus();
});

todoApp.addEventListener("click", (e) => {
  const item = e.target.closest(".todo-item");
  if (!item) return;

  const id = item.dataset.id;

  if (e.target.classList.contains("todo-checkbox")) {
    toggleTodo(id);
    return;
  }

  if (e.target.closest(".edit")) {
    openEditModal(id);
    return;
  }

  if (e.target.closest(".delete")) {
    deleteTodo(id);
  }
});

editForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (editingId && updateTodo(editingId, editInput.value)) {
    closeEditModal();
  }
});

cancelEditBtn.addEventListener("click", closeEditModal);
modalBackdrop.addEventListener("click", closeEditModal);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !editModal.hidden) {
    closeEditModal();
  }
});

clearCompletedBtn.addEventListener("click", clearCompleted);

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    render();
  });
});

startBtn.addEventListener("click", startApp);
