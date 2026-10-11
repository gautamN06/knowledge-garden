import os 
from dotenv import load_dotenv
from openai import OpenAI 



from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware 
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import SessionLocal
from models import KnowledgeEntry



load_dotenv()

app = FastAPI()
client = OpenAI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Defines the shape of incoming API requests
class KnowledgeEntryCreate(BaseModel):
    title: str
    category: str
    notes: str


class ChatMessage(BaseModel):
    role: str 
    content: str 

class ChatRequest(BaseModel):
    message: str 
    history: list[ChatMessage] = []

# Gives each request its own database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def home():
    return {"message": "Welcome to Knowledge Garden!"}


# Save a new entry
@app.post("/entries")
def create_entry(entry: KnowledgeEntryCreate, db: Session = Depends(get_db)):
    new_entry = KnowledgeEntry(
        title=entry.title,
        category=entry.category,
        notes=entry.notes,
    )

    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)

    return new_entry


@app.get("/entries")
def get_entries(
    search: str | None = None,
    category: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(KnowledgeEntry)

    if search:
        query = query.filter(
            KnowledgeEntry.title.ilike(f"%{search}%")
            | KnowledgeEntry.notes.ilike(f"%{search}%")
        )

    if category:
        query = query.filter(
            KnowledgeEntry.category.ilike(category)
        )

    return query.order_by(KnowledgeEntry.id).all()



# Delete an entry by its ID
@app.delete("/entries/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.get(KnowledgeEntry, entry_id)

    if entry is None:
        raise HTTPException(
            status_code=404,
            detail="Entry not found"
        )

    db.delete(entry)
    db.commit()

    return {"message": "Entry deleted successfully"}



# Update an existing entry
@app.put("/entries/{entry_id}")
def update_entry(
    entry_id: int,
    entry_data: KnowledgeEntryCreate,
    db: Session = Depends(get_db)
):
    entry = db.get(KnowledgeEntry, entry_id)

    if entry is None:
        raise HTTPException(
            status_code=404,
            detail="Entry not found"
        )

    entry.title = entry_data.title
    entry.category = entry_data.category
    entry.notes = entry_data.notes

    db.commit()
    db.refresh(entry)

    return entry



@app.post("/chat")
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    # Split the user's question into searchable words.
    words = set(request.message.lower().split())

    # Search entry titles and notes for matching words.
    query = db.query(KnowledgeEntry)

    matching_entries = query.order_by(KnowledgeEntry.id).all()

    scored_entries = []

    for entry in matching_entries:
        title = entry.title.lower()
        category = entry.category.lower()
        notes = entry.notes.lower()

        score = 0 

        for word in words:
            if len(word) <= 2:
                continue 

            if word in title: 
                score += 3 

            if word in category:
                score += 2

            if word in notes:
                score += 1 

            words = set(request.message.lower().split())

            stop_words = {
                "what", "did", "does", "do", "how", "why", 
                "is", "are", "was", "were", "the", "a", "an", 
                "about", "or", "to", "of", "in", "on", "for", 
                "with", "that", "this", "it"
            }

            words = {
                word for word in words 
                if len(words) > 2 and word not in stop_words 
            }

        if score > 0:
            scored_entries.append((score, entry))

    scored_entries.sort(reverse=True, key=lambda item: item[0])

    relevant_entries = [
        entry for score, entry in scored_entries[:10]
    ]

    # Build context from the matching entries.
    context = "\n\n".join(
        f"Title: {entry.title}\n"
        f"Category: {entry.category}\n"
        f"Notes: {entry.notes}"
        for entry in relevant_entries[:10]
    )

    if not context:
        context = "No matching saved entries were found."

    conversation_history = "\n".join(
    f"{message.role}: {message.content}"
    for message in request.history
)


    # Ask the AI to answer using the retrieved context.
    response = client.responses.create(
        model="gpt-4.1-mini",
        
instructions=(
    "You are the personal AI assistant for Knowledge Garden, "
    "a second brain that helps users understand and connect "
    "their saved knowledge.\n\n"

    "Your responsibilities:\n"
    "1. RECALL: Accurately summarize what the user has saved.\n"
    "2. EXPLAIN: Rephrase notes in clearer language and explain "
    "concepts at an appropriate level.\n"
    "3. CONNECT: Identify meaningful relationships between "
    "saved entries and ideas.\n"
    "4. REFLECT: When asked about the user's thoughts, analyze "
    "their actual notes and offer thoughtful perspectives. "
    "Never invent opinions or beliefs the user has not expressed.\n\n"

    "Use recent conversation history to understand follow-up "
    "questions and pronouns such as 'it', 'that', or 'my thoughts'.\n"
    "Use saved entries as evidence about the user's personal views. "
    "Clearly distinguish those views from general knowledge and "
    "your own analysis.\n"
    "Do not merely repeat notes when an explanation or useful "
    "connection would help. Do not force unrelated entries into "
    "an answer. Acknowledge uncertainty when appropriate.\n"
    "If saved information is insufficient, say so honestly."
),

        input=(
    f"Recent conversation:\n{conversation_history}\n\n"
    f"Saved entries from Knowledge Garden:\n\n{context}\n\n"
    f"Current question: {request.message}"
),
    )

    return {
        "reply": response.output_text,
        "used_entries": [
            {
                "id": entry.id,
                "title": entry.title,
                "category": entry.category,
            }
            for entry in relevant_entries[:10]
        ],
    }
