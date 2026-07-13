# TASC_SQL_COPILOT

An AI-powered assistant that connects **Google AI Studio** with **SQL Server** to browse, understand, and edit databases using natural language commands.

---

## 🚀 Features
- **Natural Language → SQL**: Type commands like “Add a column `email` to `users`” and get valid SQL.
- **Schema Awareness**: Reads table/column metadata to generate context-aware queries.
- **Safe Execution**: Logs queries, blocks destructive commands unless confirmed, supports rollback.
- **Explain Results**: Summarizes query outputs in plain English.

---

## 📂 Project Structure
```text
TASC_SQL_COPILOT/
├── backend/         # SQL execution engine (Python/Node)
├── frontend/        # Google AI Studio integration
├── docs/            # Architecture diagrams, usage notes
├── .env.example     # Environment variables template
└── README.md        # Project documentation
```

---

## ⚙️ Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/viji5626/TASC_SQL_COPILOT.git
   cd TASC_SQL_COPILOT
   ```

2. **Install dependencies**
   ```bash
   pip install pyodbc python-dotenv
   ```

3. **Configure environment**
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_google_ai_key
   SQL_SERVER=localhost
   SQL_DATABASE=YourDB
   SQL_USER=sa
   SQL_PASSWORD=yourpassword
   ```

4. **Run the app**
   ```bash
   python backend/executor.py
   ```

---

## 🛡️ Safety Notes
- Queries are logged before execution.
- `DROP`, `TRUNCATE`, and `DELETE` operations require explicit confirmation.
- Always test in a sandbox database before executing commands in production.

---

## 🧩 Roadmap
- [ ] Add schema introspection (`INFORMATION_SCHEMA`).
- [ ] Implement transaction rollback on execution error.
- [ ] Build a web UI for visual query formulation and schema visualization.
- [ ] Add robust unit tests for common SQL dialects and command categories.

---

## 🤝 Contributing
Pull requests are welcome! Please open an issue first to discuss major changes.

---

## 📜 License
MIT License
