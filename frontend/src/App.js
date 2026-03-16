import { useState, useEffect, useCallback } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Categories
const CATEGORIES = ["Основи", "Цикли", "Умови", "Масиви", "Об'єкти", "Функції", "DOM", "Алгоритми"];
const GRADES = [5, 6, 7, 8, 9, 10, 11];

// Auth Service
const authService = {
  getToken: () => localStorage.getItem("token"),
  getUser: () => JSON.parse(localStorage.getItem("user") || "null"),
  setAuth: (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  },
  clearAuth: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },
  getHeaders: () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json"
  })
};

// Login Component
const LoginSection = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [grade, setGrade] = useState(5);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password) {
      setError("Заповніть всі поля");
      return;
    }
    setLoading(true);
    setError("");
    
    try {
      if (isRegister) {
        await axios.post(`${API}/register`, { username, password, role: "user", grade });
        setIsRegister(false);
        setError("");
        alert("Реєстрація успішна! Тепер увійдіть.");
      } else {
        const res = await axios.post(`${API}/login`, { username, password });
        authService.setAuth(res.data.token, res.data.user);
        onLogin(res.data.user);
      }
    } catch (e) {
      setError(e.response?.data?.detail || "Помилка сервера");
    }
    setLoading(false);
  };

  return (
    <div id="auth-section">
      <div className="login-box">
        <h1 data-testid="login-title">⚡ ScriptNode Login</h1>
        <p>{isRegister ? "Створіть акаунт" : "Увійдіть, щоб отримати доступ до місій"}</p>
        
        <input
          type="text"
          data-testid="login-username"
          placeholder="Ваш логін"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          data-testid="login-password"
          placeholder="Ваш пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        
        {isRegister && (
          <select
            data-testid="register-grade"
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value))}
          >
            {GRADES.map(g => (
              <option key={g} value={g}>{g} клас</option>
            ))}
          </select>
        )}
        
        {error && <p className="error-text">{error}</p>}
        
        <button
          className="add-btn login-wide"
          data-testid="login-submit"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Завантаження..." : (isRegister ? "Зареєструватися" : "Увійти в Vault")}
        </button>
        
        <p className="switch-text" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? "Вже є акаунт? Увійти" : "Немає акаунту? Зареєструватися"}
        </p>
      </div>
    </div>
  );
};

// Admin Panel Component
const AdminPanel = ({ onTaskAdded }) => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Основи");
  const [grade, setGrade] = useState(5);
  const [desc, setDesc] = useState("");
  const [explanation, setExplanation] = useState("");
  const [testArgs, setTestArgs] = useState("");
  const [expectedValue, setExpectedValue] = useState("");
  const [loading, setLoading] = useState(false);

  const addTask = async () => {
    if (!title || !desc || !testArgs || !expectedValue) {
      alert("Заповніть всі обов'язкові поля");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/tasks`, {
        title,
        category,
        grade,
        desc,
        explanation,
        test_args: testArgs,
        expected_value: expectedValue,
        difficulty: 1
      }, { headers: authService.getHeaders() });
      
      alert("Місія додана успішно!");
      setTitle("");
      setDesc("");
      setExplanation("");
      setTestArgs("");
      setExpectedValue("");
      onTaskAdded();
    } catch (e) {
      alert(e.response?.data?.detail || "Помилка при створенні");
    }
    setLoading(false);
  };

  return (
    <div id="admin-panel" className="form-container" data-testid="admin-panel">
      <h2>➕ Нова задача</h2>
      <div className="input-group">
        <input
          type="text"
          data-testid="task-title"
          id="task-title"
          placeholder="Назва місії..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          data-testid="task-category"
          id="task-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          data-testid="task-grade"
          id="task-grade"
          value={grade}
          onChange={(e) => setGrade(Number(e.target.value))}
        >
          {GRADES.map(g => (
            <option key={g} value={g}>{g} клас</option>
          ))}
        </select>
      </div>
      <textarea
        data-testid="task-desc"
        id="task-desc"
        placeholder="Умова задачі..."
        rows="2"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      <textarea
        data-testid="task-explanation"
        id="task-explanation"
        placeholder="Початковий код (напр. function sum(a,b) { })"
        rows="2"
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
      />
      <div className="test-inputs">
        <input
          type="text"
          data-testid="task-test-args"
          id="task-test-args"
          placeholder="Аргументи тесту (напр. 5, 10)"
          value={testArgs}
          onChange={(e) => setTestArgs(e.target.value)}
        />
        <input
          type="text"
          data-testid="task-expected"
          id="task-expected"
          placeholder="Очікуваний результат (напр. 15)"
          value={expectedValue}
          onChange={(e) => setExpectedValue(e.target.value)}
        />
      </div>
      <button
        className="add-btn"
        data-testid="add-task-btn"
        onClick={addTask}
        disabled={loading}
      >
        {loading ? "Додавання..." : "Додати в базу"}
      </button>
    </div>
  );
};

// Task Card Component
const TaskCard = ({ task, onStatusChange }) => {
  const [code, setCode] = useState(task.solution || task.explanation || "");
  const [status, setStatus] = useState({ show: false, type: "", message: "" });

  const handleKeyDown = (e) => {
    const start = e.target.selectionStart;
    const end = e.target.selectionEnd;
    const value = e.target.value;
    const selectedText = value.substring(start, end);

    if (e.key === "Tab") {
      e.preventDefault();
      const newValue = value.substring(0, start) + "    " + value.substring(end);
      setCode(newValue);
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 4;
      }, 0);
    }

    const pairs = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
    if (pairs[e.key]) {
      e.preventDefault();
      const closingChar = pairs[e.key];
      if (start !== end) {
        const newValue = value.substring(0, start) + e.key + selectedText + closingChar + value.substring(end);
        setCode(newValue);
        setTimeout(() => {
          e.target.selectionStart = start + 1;
          e.target.selectionEnd = end + 1;
        }, 0);
      } else {
        const newValue = value.substring(0, start) + e.key + closingChar + value.substring(end);
        setCode(newValue);
        setTimeout(() => {
          e.target.selectionStart = e.target.selectionEnd = start + 1;
        }, 0);
      }
    }
  };

  const toggleStatus = async () => {
    setStatus({ show: true, type: "", message: "⏳ Тестування..." });

    if (task.is_completed) {
      try {
        await axios.post(`${API}/tasks/${task.id}/uncomplete`, {}, { headers: authService.getHeaders() });
        onStatusChange();
      } catch (e) {
        setStatus({ show: true, type: "error", message: "Помилка скасування" });
      }
      return;
    }

    try {
      const funcNameMatch = code.match(/function\s+([a-zA-Z0-9_]+)/);
      if (!funcNameMatch) {
        setStatus({ show: true, type: "error", message: "⚠️ Ви не оголосили функцію через 'function назва()'" });
        return;
      }
      const funcName = funcNameMatch[1];

      const testInputs = task.test_args.split(";").map(s => s.trim());
      const expectedOutputs = task.expected_value.split(";").map(s => s.trim());

      let passedCount = 0;

      for (let i = 0; i < testInputs.length; i++) {
        const currentInput = testInputs[i];
        const currentExpectedRaw = expectedOutputs[i];

        const fullCode = `${code}\nreturn ${funcName}(${currentInput});`;
        // eslint-disable-next-line no-new-func
        const runner = new Function(fullCode);
        const userResult = runner();

        let expected;
        try {
          expected = JSON.parse(currentExpectedRaw);
        } catch {
          expected = currentExpectedRaw;
        }

        if (JSON.stringify(userResult) === JSON.stringify(expected)) {
          passedCount++;
        } else {
          setStatus({
            show: true,
            type: "error",
            message: `❌ Тест №${i + 1} провалено! Аргументи: (${currentInput}), Очікували: ${JSON.stringify(expected)}, Отримано: ${JSON.stringify(userResult)}`
          });
          return;
        }
      }

      if (passedCount === testInputs.length) {
        setStatus({ show: true, type: "success", message: `🚀 ГЕНІАЛЬНО! Всі тести (${passedCount}/${testInputs.length}) пройдено.` });
        await axios.post(`${API}/tasks/${task.id}/complete`, { solution: code }, { headers: authService.getHeaders() });
        onStatusChange();
      }
    } catch (e) {
      setStatus({ show: true, type: "error", message: `⚠️ Помилка виконання: ${e.message}` });
    }
  };

  return (
    <div className={`task-card ${task.is_completed ? "completed" : ""}`} data-testid={`task-card-${task.id}`}>
      <h3>
        {task.title}
        <span className="badge">{task.category}</span>
        <span className="badge grade-badge">{task.grade} клас</span>
      </h3>
      <p>{task.desc}</p>

      <textarea
        className="code-editor"
        data-testid={`code-${task.id}`}
        placeholder="function ..."
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {status.show && (
        <div className={`status-message ${status.type}`} data-testid={`status-${task.id}`}>
          {status.message}
        </div>
      )}

      <button className="action-btn" data-testid={`toggle-btn-${task.id}`} onClick={toggleStatus}>
        {task.is_completed ? "↩️ Скасувати" : "✅ Перевірити та зберегти"}
      </button>
    </div>
  );
};

// Main App Component
function App() {
  const [user, setUser] = useState(authService.getUser());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterGrade, setFilterGrade] = useState("");

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API}/tasks`;
      const params = new URLSearchParams();
      if (filterCategory) params.append("category", filterCategory);
      if (filterGrade) params.append("grade", filterGrade);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await axios.get(url, { headers: authService.getHeaders() });
      setTasks(res.data);
    } catch (e) {
      console.error("Помилка завантаження:", e);
    }
    setLoading(false);
  }, [filterCategory, filterGrade]);

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user, loadTasks]);

  const handleLogout = () => {
    authService.clearAuth();
    setUser(null);
    setTasks([]);
  };

  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) {
    return <LoginSection onLogin={setUser} />;
  }

  return (
    <div id="app-section" data-testid="app-section">
      <div className="header-flex">
        <h1 className="main-title">⚡ ScriptNode Vault</h1>
        <div className="header-right">
          <span className="user-info" data-testid="user-info">
            {user.username} ({user.role === "admin" ? "Адмін" : `${user.grade} клас`})
          </span>
          <button id="logout-btn" data-testid="logout-btn" onClick={handleLogout}>Вихід</button>
        </div>
      </div>

      {user.role === "admin" && <AdminPanel onTaskAdded={loadTasks} />}

      <div className="controls">
        <input
          type="text"
          data-testid="search-input"
          id="search-input"
          placeholder="🔍 Пошук місії..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="filter-row">
          <select
            data-testid="filter-category"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">Всі категорії</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            data-testid="filter-grade"
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
          >
            <option value="">Всі класи</option>
            {GRADES.map(g => (
              <option key={g} value={g}>{g} клас</option>
            ))}
          </select>
        </div>
      </div>

      <div id="task-list" data-testid="task-list">
        {loading ? (
          <div className="loader-box">
            <p className="loader-text">📡 Підключення до Vault...</p>
            <p className="loader-subtext">(Якщо сервер спить, це може зайняти до 1 хвилини)</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="loader-box">
            <p className="loader-text">Задач не знайдено</p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <TaskCard key={task.id} task={task} onStatusChange={loadTasks} />
          ))
        )}
      </div>
    </div>
  );
}

export default App;
