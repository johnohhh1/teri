#!/usr/bin/env python3
"""
ChromaDB Setup Script for TERI Model
Initializes vector database with relationship themes and embeddings
"""

import chromadb
import logging
import json
import os
from typing import List, Dict
from sentence_transformers import SentenceTransformer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Relationship themes for vector similarity search
RELATIONSHIP_THEMES = [
    {
        "id": "resentment",
        "theme": "resentment",
        "description": "Built-up anger, frustration, or bitterness toward partner",
        "examples": [
            "You never help with anything",
            "I'm tired of doing everything myself",
            "You don't appreciate what I do",
            "I feel taken for granted",
            "You always leave me to handle things alone"
        ]
    },
    {
        "id": "disconnection",
        "theme": "disconnection",
        "description": "Feeling emotionally distant or unconnected from partner",
        "examples": [
            "We feel like roommates",
            "I miss feeling close to you",
            "We don't talk anymore",
            "I feel alone even when you're here",
            "We're living parallel lives"
        ]
    },
    {
        "id": "household_labor",
        "theme": "household_labor",
        "description": "Conflicts about division of housework and domestic responsibilities",
        "examples": [
            "You never do the dishes",
            "I'm tired of cleaning up after you",
            "The house is always a mess",
            "I do all the cooking and cleaning",
            "You don't notice when things need to be done"
        ]
    },
    {
        "id": "appreciation",
        "theme": "appreciation",
        "description": "Need for recognition and gratitude from partner",
        "examples": [
            "You don't see everything I do",
            "I wish you'd notice my efforts",
            "I need more acknowledgment",
            "You take me for granted",
            "I work hard and get no thanks"
        ]
    },
    {
        "id": "communication",
        "theme": "communication",
        "description": "Issues with how partners talk to each other",
        "examples": [
            "You never listen to me",
            "You interrupt me constantly",
            "We can't have a conversation without fighting",
            "You shut down when I try to talk",
            "You don't hear what I'm saying"
        ]
    },
    {
        "id": "time_together",
        "theme": "time_together",
        "description": "Desire for more quality time and attention from partner",
        "examples": [
            "We never spend time together",
            "You're always on your phone",
            "You prioritize everything over us",
            "I miss our connection time",
            "We need more couple time"
        ]
    },
    {
        "id": "financial_stress",
        "theme": "financial_stress",
        "description": "Money-related tensions and disagreements",
        "examples": [
            "We can't afford this",
            "You spend too much money",
            "I'm worried about our finances",
            "We have different spending priorities",
            "Money is always tight"
        ]
    },
    {
        "id": "intimacy",
        "theme": "intimacy",
        "description": "Physical and emotional intimacy concerns",
        "examples": [
            "We're not intimate anymore",
            "I miss physical closeness",
            "You don't initiate affection",
            "I feel rejected when you pull away",
            "We've lost our spark"
        ]
    },
    {
        "id": "parenting",
        "theme": "parenting",
        "description": "Disagreements about child-rearing and parenting approaches",
        "examples": [
            "You're too strict with the kids",
            "I do all the parenting work",
            "We disagree on discipline",
            "You don't help with bedtime",
            "The kids listen to you but not me"
        ]
    },
    {
        "id": "trust",
        "theme": "trust",
        "description": "Issues with honesty, reliability, and faith in partner",
        "examples": [
            "I don't trust you anymore",
            "You broke your promise again",
            "I can't rely on you",
            "You hide things from me",
            "I need to know you're being honest"
        ]
    },
    {
        "id": "control",
        "theme": "control",
        "description": "Power dynamics and control issues in the relationship",
        "examples": [
            "You always have to be right",
            "You make all the decisions",
            "I feel controlled by you",
            "You don't consider my opinions",
            "It's your way or the highway"
        ]
    },
    {
        "id": "support",
        "theme": "support",
        "description": "Need for emotional and practical support from partner",
        "examples": [
            "You're not there for me",
            "I need you to have my back",
            "You don't support my dreams",
            "I feel like I'm on my own",
            "You don't encourage me"
        ]
    },
    {
        "id": "in_laws",
        "theme": "in_laws",
        "description": "Conflicts involving extended family members",
        "examples": [
            "Your mother interferes too much",
            "You always side with your family",
            "I don't feel welcome with your relatives",
            "Your parents don't respect me",
            "Family events are stressful"
        ]
    },
    {
        "id": "jealousy",
        "theme": "jealousy",
        "description": "Feelings of jealousy or insecurity about partner's relationships",
        "examples": [
            "You flirt with other people",
            "I feel threatened by your friend",
            "You give others more attention",
            "I'm worried about your coworker",
            "You text them too much"
        ]
    },
    {
        "id": "personal_growth",
        "theme": "personal_growth",
        "description": "Individual development and self-improvement journeys",
        "examples": [
            "You don't support my goals",
            "I'm growing and you're staying the same",
            "We want different things now",
            "I need space to develop myself",
            "You hold me back from changing"
        ]
    }
]

def setup_chroma_client(host: str = "localhost", port: int = 8000) -> chromadb.Client:
    """
    Set up ChromaDB client connection
    """
    try:
        client = chromadb.HttpClient(host=host, port=port)
        logger.info(f"Connected to ChromaDB at {host}:{port}")
        return client
    except Exception as e:
        logger.error(f"Failed to connect to ChromaDB: {e}")
        raise

def create_collections(client: chromadb.Client) -> Dict[str, chromadb.Collection]:
    """
    Create necessary collections for TERI model
    """
    collections = {}
    
    # Relationship themes collection
    try:
        collections["relationship_themes"] = client.create_collection(
            name="relationship_themes",
            metadata={"description": "Semantic themes for relationship conflicts and conversations"}
        )
        logger.info("Created relationship_themes collection")
    except Exception as e:
        if "already exists" in str(e):
            collections["relationship_themes"] = client.get_collection("relationship_themes")
            logger.info("Using existing relationship_themes collection")
        else:
            raise e
    
    # Translator history collection
    try:
        collections["translator_history"] = client.create_collection(
            name="translator_history",
            metadata={"description": "Historical translator outputs for pattern learning"}
        )
        logger.info("Created translator_history collection")
    except Exception as e:
        if "already exists" in str(e):
            collections["translator_history"] = client.get_collection("translator_history")
            logger.info("Using existing translator_history collection")
        else:
            raise e
    
    # Game suggestions collection
    try:
        collections["game_contexts"] = client.create_collection(
            name="game_contexts",
            metadata={"description": "Game recommendation contexts and patterns"}
        )
        logger.info("Created game_contexts collection")
    except Exception as e:
        if "already exists" in str(e):
            collections["game_contexts"] = client.get_collection("game_contexts")
            logger.info("Using existing game_contexts collection")
        else:
            raise e
    
    return collections

def generate_embeddings(texts: List[str], model_name: str = "all-MiniLM-L6-v2") -> List[List[float]]:
    """
    Generate embeddings using sentence transformers
    """
    model = SentenceTransformer(model_name)
    embeddings = model.encode(texts).tolist()
    logger.info(f"Generated {len(embeddings)} embeddings")
    return embeddings

def populate_relationship_themes(collection: chromadb.Collection) -> None:
    """
    Populate the relationship themes collection with initial data
    """
    logger.info("Populating relationship themes collection...")
    
    # Prepare data for insertion
    documents = []
    metadatas = []
    ids = []
    
    for theme_data in RELATIONSHIP_THEMES:
        # Create a comprehensive text representation
        text_content = f"{theme_data['theme']} {theme_data['description']} {' '.join(theme_data['examples'])}"
        documents.append(text_content)
        
        metadatas.append({
            "theme": theme_data["theme"],
            "description": theme_data["description"],
            "examples_count": len(theme_data["examples"])
        })
        
        ids.append(theme_data["id"])
    
    # Generate embeddings
    embeddings = generate_embeddings(documents)
    
    # Insert into collection
    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids,
        embeddings=embeddings
    )
    
    logger.info(f"Added {len(documents)} relationship themes to collection")

def populate_game_contexts(collection: chromadb.Collection) -> None:
    """
    Populate game contexts for recommendation engine
    """
    logger.info("Populating game contexts collection...")
    
    game_contexts = [
        {
            "id": "iwr_daily_checkin",
            "context": "daily emotional check-in feeling disconnected need quick connection",
            "game_id": "iwr",
            "rationale": "Quick daily emotional check-in to rebuild connection",
            "themes": ["disconnection", "communication"]
        },
        {
            "id": "pause_conflict_spiral",
            "context": "arguing fighting conflict spiraling elevated emotions",
            "game_id": "pause",
            "rationale": "Stop the conflict spiral and take accountability",
            "themes": ["communication", "control"]
        },
        {
            "id": "and_what_else_resentment",
            "context": "built up resentment anger frustration unexpressed",
            "game_id": "and_what_else",
            "rationale": "Clear accumulated resentments safely",
            "themes": ["resentment", "communication"]
        },
        {
            "id": "pillar_talk_foundation",
            "context": "relationship foundation values principles basic connection",
            "game_id": "pillar_talk",
            "rationale": "Reconnect with relationship foundations",
            "themes": ["support", "communication"]
        },
        {
            "id": "closeness_counter_intimacy",
            "context": "feeling distant disconnected roommates physical emotional distance",
            "game_id": "closeness_counter",
            "rationale": "Explore physical and emotional distance patterns",
            "themes": ["disconnection", "intimacy"]
        },
        {
            "id": "switch_perspective_taking",
            "context": "different views opinions perspective understanding disagreement",
            "game_id": "switch",
            "rationale": "Build empathy by arguing partner's position",
            "themes": ["communication", "control"]
        },
        {
            "id": "bomb_squad_recurring_issue",
            "context": "same fight recurring issue never resolved keeps coming up",
            "game_id": "bomb_squad",
            "rationale": "Systematically defuse a recurring conflict",
            "themes": ["communication", "resentment"]
        },
        {
            "id": "seven_nights_vulnerability",
            "context": "need vulnerability sharing truth deeper connection intimacy",
            "game_id": "seven_nights",
            "rationale": "Build vulnerability and truth-sharing muscle",
            "themes": ["intimacy", "trust"]
        }
    ]
    
    # Prepare data for insertion
    documents = [ctx["context"] for ctx in game_contexts]
    metadatas = [
        {
            "game_id": ctx["game_id"],
            "rationale": ctx["rationale"],
            "themes": json.dumps(ctx["themes"])
        }
        for ctx in game_contexts
    ]
    ids = [ctx["id"] for ctx in game_contexts]
    
    # Generate embeddings
    embeddings = generate_embeddings(documents)
    
    # Insert into collection
    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids,
        embeddings=embeddings
    )
    
    logger.info(f"Added {len(documents)} game contexts to collection")

def test_similarity_search(collections: Dict[str, chromadb.Collection]) -> None:
    """
    Test similarity search functionality
    """
    logger.info("Testing similarity search...")
    
    # Test relationship themes
    test_queries = [
        "I'm so tired of doing all the housework",
        "We never spend time together anymore",
        "I don't trust you",
        "We keep fighting about the same thing"
    ]
    
    themes_collection = collections["relationship_themes"]
    
    for query in test_queries:
        results = themes_collection.query(
            query_texts=[query],
            n_results=3
        )
        
        logger.info(f"Query: '{query}'")
        for i, (doc, metadata, distance) in enumerate(zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0]
        )):
            logger.info(f"  {i+1}. Theme: {metadata['theme']} (distance: {distance:.3f})")
        logger.info("")

def main():
    """
    Main setup function
    """
    # Get configuration from environment
    chroma_host = os.getenv("CHROMA_HOST", "localhost")
    chroma_port = int(os.getenv("CHROMA_PORT", "8000"))
    
    logger.info("Starting ChromaDB setup for TERI Model...")
    
    try:
        # Setup client and collections
        client = setup_chroma_client(chroma_host, chroma_port)
        collections = create_collections(client)
        
        # Populate collections
        populate_relationship_themes(collections["relationship_themes"])
        populate_game_contexts(collections["game_contexts"])
        
        # Test functionality
        test_similarity_search(collections)
        
        logger.info("ChromaDB setup completed successfully!")
        
        # Print collection stats
        for name, collection in collections.items():
            count = collection.count()
            logger.info(f"Collection '{name}': {count} documents")
            
    except Exception as e:
        logger.error(f"Setup failed: {e}")
        raise

if __name__ == "__main__":
    main()