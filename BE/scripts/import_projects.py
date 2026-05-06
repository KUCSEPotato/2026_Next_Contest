import sys
import os
import json
from datetime import datetime

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.entities import Project, ProjectSkill, ProjectInterest, Skill, Interest
from sqlalchemy.exc import IntegrityError

def import_projects_from_json(json_file_path: str):
    """Import projects, project_skills, and project_interests from JSON file to database."""
    
    db = SessionLocal()
    
    try:
        # Read JSON file
        with open(json_file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        projects_data = data.get("projects", [])
        project_skills_data = data.get("project_skills", [])
        project_interests_data = data.get("project_interests", [])
        
        # =====================
        # 1) Insert Projects
        # =====================
        print(f"Importing {len(projects_data)} projects...")
        project_map = {}  # Map JSON id to DB id
        
        for project_data in projects_data:
            try:
                # Parse timestamps
                started_at = None
                ended_at = None
                
                if project_data.get("started_at"):
                    started_at = datetime.fromisoformat(project_data["started_at"].replace("Z", "+00:00"))
                if project_data.get("ended_at"):
                    ended_at = datetime.fromisoformat(project_data["ended_at"].replace("Z", "+00:00"))
                
                project = Project(
                    idea_id=project_data.get("idea_id"),
                    leader_id=project_data.get("leader_id"),
                    title=project_data.get("title"),
                    summary=project_data.get("summary"),
                    description=project_data.get("description"),
                    category=project_data.get("category"),
                    difficulty=project_data.get("difficulty"),
                    status=project_data.get("status", "planning"),
                    progress_percent=project_data.get("progress_percent", 0),
                    is_public=project_data.get("is_public", True),
                    started_at=started_at,
                    ended_at=ended_at,
                )
                
                db.add(project)
                db.flush()  # Get the auto-generated ID
                
                json_id = project_data.get("id")
                project_map[json_id] = project.id
                
                print(f"✓ Project created: {project.title} (JSON ID: {json_id}, DB ID: {project.id})")
                
            except IntegrityError as e:
                db.rollback()
                print(f"✗ Error creating project: {project_data.get('title')} - {e}")
                continue
        
        db.commit()
        
        # =====================
        # 2) Insert Project Skills
        # =====================
        print(f"\nImporting {len(project_skills_data)} project skills...")
        
        for skill_data in project_skills_data:
            try:
                json_project_id = skill_data.get("project_id")
                db_project_id = project_map.get(json_project_id)
                
                if not db_project_id:
                    print(f"✗ Project ID {json_project_id} not found in project_map")
                    continue
                
                skill_name = skill_data.get("skill_name")
                required_level = skill_data.get("required_level")
                
                # Find or create skill
                skill = db.query(Skill).filter(Skill.name == skill_name).first()
                if not skill:
                    normalized_name = skill_name.strip().lower()
                    skill = Skill(name=skill_name, normalized_name=normalized_name)
                    db.add(skill)
                    db.flush()
                    print(f"  + Created new skill: {skill_name}")
                
                # Check if project_skill already exists
                existing = db.query(ProjectSkill).filter(
                    ProjectSkill.project_id == db_project_id,
                    ProjectSkill.skill_id == skill.id
                ).first()
                
                if not existing:
                    project_skill = ProjectSkill(
                        project_id=db_project_id,
                        skill_id=skill.id,
                        required_level=required_level,
                    )
                    db.add(project_skill)
                    print(f"✓ Added skill '{skill_name}' to project {db_project_id}")
                else:
                    print(f"  - Skill '{skill_name}' already linked to project {db_project_id}")
                
            except IntegrityError as e:
                db.rollback()
                print(f"✗ Error adding project skill: {skill_data} - {e}")
                continue
        
        db.commit()
        
        # =====================
        # 3) Insert Project Interests
        # =====================
        print(f"\nImporting {len(project_interests_data)} project interests...")
        
        for interest_data in project_interests_data:
            try:
                json_project_id = interest_data.get("project_id")
                db_project_id = project_map.get(json_project_id)
                
                if not db_project_id:
                    print(f"✗ Project ID {json_project_id} not found in project_map")
                    continue
                
                interest_name = interest_data.get("interest_name")
                
                # Find or create interest
                interest = db.query(Interest).filter(Interest.name == interest_name).first()
                if not interest:
                    normalized_name = interest_name.strip().lower()
                    interest = Interest(name=interest_name, normalized_name=normalized_name)
                    db.add(interest)
                    db.flush()
                    print(f"  + Created new interest: {interest_name}")
                
                # Check if project_interest already exists
                existing = db.query(ProjectInterest).filter(
                    ProjectInterest.project_id == db_project_id,
                    ProjectInterest.interest_id == interest.id
                ).first()
                
                if not existing:
                    project_interest = ProjectInterest(
                        project_id=db_project_id,
                        interest_id=interest.id,
                    )
                    db.add(project_interest)
                    print(f"✓ Added interest '{interest_name}' to project {db_project_id}")
                else:
                    print(f"  - Interest '{interest_name}' already linked to project {db_project_id}")
                
            except IntegrityError as e:
                db.rollback()
                print(f"✗ Error adding project interest: {interest_data} - {e}")
                continue
        
        db.commit()
        print("\n✓ All data imported successfully!")
        
    except FileNotFoundError:
        print(f"✗ File not found: {json_file_path}")
    except json.JSONDecodeError as e:
        print(f"✗ Invalid JSON format: {e}")
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    # Default path to projects_mock.json
    json_file = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data",
        "projects_mock.json"
    )
    
    import_projects_from_json(json_file)
