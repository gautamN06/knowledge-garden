
from database import Base, engine
from models import KnowledgeEntry

Base.metadata.create_all(bind=engine)

print("Database tables created successfully!")

