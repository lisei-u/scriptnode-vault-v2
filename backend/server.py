from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# --- MODELS ---
class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"
    grade: int = 5  # Клас учня (5-11)

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    grade: int
    completed_tasks: List[dict] = []

class TaskCreate(BaseModel):
    title: str
    category: str
    grade: int = 5  # Для якого класу задача
    desc: str
    explanation: str = ""
    test_args: str
    expected_value: str
    difficulty: int = 1

class TaskResponse(BaseModel):
    id: str
    title: str
    category: str
    grade: int
    desc: str
    explanation: str
    test_args: str
    expected_value: str
    difficulty: int
    is_completed: bool = False
    solution: str = ""

class TaskComplete(BaseModel):
    solution: str

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

# --- AUTH HELPERS ---
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        "id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 30  # 30 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Користувача не знайдено")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Токен прострочений")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Невірний токен")

# --- AUTH ROUTES ---
@api_router.post("/register", response_model=dict)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Цей логін вже зайнятий")
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "username": user_data.username,
        "password": hash_password(user_data.password),
        "role": user_data.role,
        "grade": user_data.grade,
        "completed_tasks": []
    }
    await db.users.insert_one(user_doc)
    return {"message": "Успішна реєстрація"}

@api_router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=400, detail="Невірний логін або пароль")
    
    token = create_token(user["id"], user["role"])
    return TokenResponse(
        token=token,
        user=UserResponse(
            id=user["id"],
            username=user["username"],
            role=user["role"],
            grade=user.get("grade", 5),
            completed_tasks=user.get("completed_tasks", [])
        )
    )

@api_router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        role=current_user["role"],
        grade=current_user.get("grade", 5),
        completed_tasks=current_user.get("completed_tasks", [])
    )

@api_router.put("/me/grade", response_model=dict)
async def update_grade(grade: int, current_user: dict = Depends(get_current_user)):
    if grade < 5 or grade > 11:
        raise HTTPException(status_code=400, detail="Клас має бути від 5 до 11")
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"grade": grade}})
    return {"message": "Клас оновлено"}

# --- TASK ROUTES ---
@api_router.get("/tasks", response_model=List[TaskResponse])
async def get_tasks(
    category: Optional[str] = None,
    grade: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if category:
        query["category"] = category
    if grade:
        query["grade"] = grade
    
    tasks = await db.tasks.find(query, {"_id": 0}).to_list(1000)
    completed_ids = {t.get("task_id") for t in current_user.get("completed_tasks", [])}
    completed_map = {t.get("task_id"): t.get("solution", "") for t in current_user.get("completed_tasks", [])}
    
    result = []
    for task in tasks:
        result.append(TaskResponse(
            id=task["id"],
            title=task["title"],
            category=task["category"],
            grade=task.get("grade", 5),
            desc=task["desc"],
            explanation=task.get("explanation", ""),
            test_args=task["test_args"],
            expected_value=task["expected_value"],
            difficulty=task.get("difficulty", 1),
            is_completed=task["id"] in completed_ids,
            solution=completed_map.get(task["id"], "")
        ))
    return result

@api_router.post("/tasks", response_model=TaskResponse)
async def create_task(task_data: TaskCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Немає прав адміна")
    
    task_doc = {
        "id": str(uuid.uuid4()),
        "title": task_data.title,
        "category": task_data.category,
        "grade": task_data.grade,
        "desc": task_data.desc,
        "explanation": task_data.explanation,
        "test_args": task_data.test_args,
        "expected_value": task_data.expected_value,
        "difficulty": task_data.difficulty
    }
    await db.tasks.insert_one(task_doc)
    return TaskResponse(
        id=task_doc["id"],
        title=task_doc["title"],
        category=task_doc["category"],
        grade=task_doc["grade"],
        desc=task_doc["desc"],
        explanation=task_doc["explanation"],
        test_args=task_doc["test_args"],
        expected_value=task_doc["expected_value"],
        difficulty=task_doc["difficulty"]
    )

@api_router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_data: TaskCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Немає прав адміна")
    
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Задачу не знайдено")
    
    update_data = {
        "title": task_data.title,
        "category": task_data.category,
        "grade": task_data.grade,
        "desc": task_data.desc,
        "explanation": task_data.explanation,
        "test_args": task_data.test_args,
        "expected_value": task_data.expected_value,
        "difficulty": task_data.difficulty
    }
    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    
    return TaskResponse(
        id=task_id,
        **update_data
    )

@api_router.delete("/tasks/{task_id}", response_model=dict)
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Немає прав адміна")
    
    result = await db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Задачу не знайдено")
    return {"message": "Задачу видалено"}

@api_router.post("/tasks/{task_id}/complete", response_model=dict)
async def complete_task(task_id: str, data: TaskComplete, current_user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Задачу не знайдено")
    
    completed_tasks = current_user.get("completed_tasks", [])
    task_index = next((i for i, t in enumerate(completed_tasks) if t.get("task_id") == task_id), -1)
    
    if task_index >= 0:
        completed_tasks[task_index]["solution"] = data.solution
    else:
        completed_tasks.append({"task_id": task_id, "solution": data.solution})
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"completed_tasks": completed_tasks}}
    )
    return {"message": "Прогрес збережено"}

@api_router.post("/tasks/{task_id}/uncomplete", response_model=dict)
async def uncomplete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    completed_tasks = [t for t in current_user.get("completed_tasks", []) if t.get("task_id") != task_id]
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"completed_tasks": completed_tasks}}
    )
    return {"message": "Статус скасовано"}

@api_router.get("/categories", response_model=List[str])
async def get_categories():
    return ["Основи", "Цикли", "Умови", "Масиви", "Об'єкти", "Функції", "DOM", "Алгоритми"]

@api_router.get("/grades", response_model=List[int])
async def get_grades():
    return [5, 6, 7, 8, 9, 10, 11]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
