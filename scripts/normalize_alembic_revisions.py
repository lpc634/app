#!/usr/bin/env python3
"""
Normalize Alembic revision IDs to fix StringDataRightTruncation and multiple heads issues.

This script:
1. Scans all migration files in migrations/versions/
2. Normalizes any revision ID > 32 chars to deterministic short IDs
3. Updates all down_revision references accordingly
4. Ensures placeholder file exists
5. Computes new heads and creates merge migration

Run from project root: python scripts/normalize_alembic_revisions.py
"""

import os
import re
import hashlib
from datetime import datetime
from pathlib import Path

# Mapping for specific long IDs to normalized short IDs
REVISION_MAPPING = {
    'add_coordinates_to_vehicle_sightings': 'acvs_20250819a1',  # Placeholder already exists
    'add_coordinates_to_sightings': 'acvs_20250819b1',
    'make_job_title_nullable': 'mjtn_20250819a2',
    'add_agent_invoice_numbering': 'aain_20250819a3',
    'add_current_invoice_number': 'acin_20250819a4',
    'add_telegram_integration': 'atel_20250819a5',
    'verification_tracking_001': 'vtck_20250819a6',
    'fix_coordinates_production': 'fcpr_20250819a7',
}

def generate_short_id(long_id):
    """Generate a deterministic short ID for a long revision ID."""
    if long_id in REVISION_MAPPING:
        return REVISION_MAPPING[long_id]
    
    # For any other long IDs, generate a hash-based short ID
    hash_prefix = hashlib.md5(long_id.encode()).hexdigest()[:8]
    return f"auto_{hash_prefix}"

def scan_migration_files(versions_dir):
    """Scan all migration files and extract revision/down_revision info."""
    files_info = {}
    
    for filename in os.listdir(versions_dir):
        if not filename.endswith('.py') or filename == '__init__.py':
            continue
            
        filepath = os.path.join(versions_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract revision and down_revision
        revision_match = re.search(r"^revision = ['\"]([^'\"]+)['\"]", content, re.MULTILINE)
        down_revision_match = re.search(r"^down_revision = ([^\n]+)", content, re.MULTILINE)
        
        if revision_match:
            revision = revision_match.group(1)
            down_revision_raw = down_revision_match.group(1).strip() if down_revision_match else 'None'
            
            # Parse down_revision (could be None, string, or tuple)
            down_revision = None
            if down_revision_raw != 'None':
                if down_revision_raw.startswith('(') and down_revision_raw.endswith(')'):
                    # Tuple format - extract all quoted strings
                    down_revision = re.findall(r"['\"]([^'\"]+)['\"]", down_revision_raw)
                elif down_revision_raw.startswith('"') or down_revision_raw.startswith("'"):
                    # Single quoted string
                    down_revision = down_revision_raw.strip('"\'')
            
            files_info[filename] = {
                'filepath': filepath,
                'content': content,
                'revision': revision,
                'down_revision': down_revision,
                'original_revision': revision
            }
    
    return files_info

def normalize_revisions(files_info):
    """Normalize revision IDs according to requirements and update references."""
    # Build mapping of old -> new revision IDs
    id_mapping = {}
    
    for filename, info in files_info.items():
        old_revision = info['revision']
        # Force normalization for IDs in our mapping or if > 32 chars
        if old_revision in REVISION_MAPPING or len(old_revision) > 32:
            new_revision = generate_short_id(old_revision)
            id_mapping[old_revision] = new_revision
            info['revision'] = new_revision
            print(f"Normalizing {filename}: {old_revision} -> {new_revision}")
    
    # Update all down_revision references
    for filename, info in files_info.items():
        content = info['content']
        
        # Update revision line
        if info['original_revision'] != info['revision']:
            content = re.sub(
                r"^revision = ['\"]([^'\"]+)['\"]",
                f"revision = '{info['revision']}'",
                content,
                flags=re.MULTILINE
            )
        
        # Update down_revision references
        if info['down_revision']:
            if isinstance(info['down_revision'], list):
                # Tuple format
                new_refs = []
                for ref in info['down_revision']:
                    new_ref = id_mapping.get(ref, ref)
                    new_refs.append(f'"{new_ref}"')
                new_down_revision = f"(\n    {','.join(new_refs)},\n)"
                content = re.sub(
                    r"^down_revision = \([^)]+\)",
                    f"down_revision = {new_down_revision}",
                    content,
                    flags=re.MULTILINE | re.DOTALL
                )
            elif isinstance(info['down_revision'], str):
                # Single string
                new_ref = id_mapping.get(info['down_revision'], info['down_revision'])
                content = re.sub(
                    r"^down_revision = ['\"][^'\"]*['\"]",
                    f"down_revision = '{new_ref}'",
                    content,
                    flags=re.MULTILINE
                )
                info['down_revision'] = new_ref
        
        info['content'] = content
    
    return files_info, id_mapping

def ensure_placeholder_exists(versions_dir):
    """Ensure the placeholder migration exists with correct content."""
    placeholder_path = os.path.join(versions_dir, 'add_coordinates_to_vehicle_sightings_placeholder.py')
    
    placeholder_content = '''from alembic import op
import sqlalchemy as sa

# Revision identifiers, used by Alembic.
revision = "acvs_20250819a1"
down_revision = None  # base placeholder, keep None
branch_labels = None
depends_on = None

def upgrade():
    # No-op placeholder to satisfy missing parent revision on Heroku
    pass

def downgrade():
    pass
'''
    
    with open(placeholder_path, 'w', encoding='utf-8') as f:
        f.write(placeholder_content)
    
    print(f"Ensured placeholder exists: {placeholder_path}")

def compute_heads(files_info):
    """Compute current heads (revisions not referenced by any down_revision)."""
    all_revisions = set(info['revision'] for info in files_info.values())
    referenced_revisions = set()
    
    for info in files_info.values():
        if info['down_revision']:
            if isinstance(info['down_revision'], list):
                referenced_revisions.update(info['down_revision'])
            elif isinstance(info['down_revision'], str):
                referenced_revisions.add(info['down_revision'])
    
    heads = all_revisions - referenced_revisions
    return sorted(heads)

def create_merge_migration(versions_dir, heads):
    """Create a merge migration for all current heads."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    merge_filename = f'merge_fix_heads_{timestamp}.py'
    merge_path = os.path.join(versions_dir, merge_filename)
    
    heads_tuple = ',\n    '.join(f'"{head}"' for head in heads)
    
    merge_content = f'''from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "merge_fix_heads_{timestamp[:8]}"
down_revision = (
    {heads_tuple},
)
branch_labels = None
depends_on = None

def upgrade():
    # Merge migration: no schema changes.
    pass

def downgrade():
    # Would re-split branches; keep as no-op.
    pass
'''
    
    with open(merge_path, 'w', encoding='utf-8') as f:
        f.write(merge_content)
    
    print(f"Created merge migration: {merge_filename}")
    return merge_filename

def create_alembic_version_widening_migration(versions_dir, merge_revision):
    """Create optional migration to widen alembic_version.version_num column."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    widen_filename = f'widen_alembic_version_{timestamp}.py'
    widen_path = os.path.join(versions_dir, widen_filename)
    
    widen_content = f'''"""Widen alembic_version.version_num to prevent future StringDataRightTruncation

Revision ID: widen_alembic_version
Revises: {merge_revision}
Create Date: {datetime.now().isoformat()}

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'widen_version_{timestamp[:8]}'
down_revision = '{merge_revision}'
branch_labels = None
depends_on = None

def upgrade():
    """Widen alembic_version.version_num from VARCHAR(32) to VARCHAR(64)."""
    try:
        # Only apply if using PostgreSQL and column is currently 32 chars
        bind = op.get_bind()
        if bind.dialect.name == 'postgresql':
            # Check current column length
            result = bind.execute("""
                SELECT character_maximum_length 
                FROM information_schema.columns 
                WHERE table_name = 'alembic_version' 
                AND column_name = 'version_num'
            """).fetchone()
            
            if result and result[0] == 32:
                op.alter_column('alembic_version', 'version_num', 
                              type_=sa.String(length=64),
                              existing_type=sa.String(length=32))
                print("Widened alembic_version.version_num to VARCHAR(64)")
            else:
                print("alembic_version.version_num already >= 64 chars, skipping")
        else:
            print("Not PostgreSQL, skipping alembic_version widening")
    except Exception as e:
        print(f"Failed to widen alembic_version.version_num: {{e}}")
        # Don't fail the migration for this optional change
        pass

def downgrade():
    """Revert alembic_version.version_num back to VARCHAR(32)."""
    try:
        bind = op.get_bind()
        if bind.dialect.name == 'postgresql':
            op.alter_column('alembic_version', 'version_num',
                          type_=sa.String(length=32),
                          existing_type=sa.String(length=64))
    except Exception as e:
        print(f"Failed to revert alembic_version.version_num: {{e}}")
        pass
'''
    
    with open(widen_path, 'w', encoding='utf-8') as f:
        f.write(widen_content)
    
    print(f"Created alembic_version widening migration: {widen_filename}")
    return widen_filename

def remove_old_merge_files(versions_dir):
    """Remove old/broken merge migration files."""
    old_merge_files = ['merge_all_heads_20250819.py']
    
    for filename in old_merge_files:
        filepath = os.path.join(versions_dir, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
            print(f"Removed old merge file: {filename}")

def write_updated_files(files_info):
    """Write all updated migration files to disk."""
    for filename, info in files_info.items():
        with open(info['filepath'], 'w', encoding='utf-8') as f:
            f.write(info['content'])
        print(f"Updated: {filename}")

def main():
    """Main normalization process."""
    print("Starting Alembic revision normalization...")
    
    # Setup paths
    project_root = Path(__file__).parent.parent
    versions_dir = project_root / 'migrations' / 'versions'
    
    if not versions_dir.exists():
        print(f"Error: {versions_dir} does not exist!")
        return
    
    print(f"Processing migrations in: {versions_dir}")
    
    # Step 1: Scan all migration files
    files_info = scan_migration_files(str(versions_dir))
    print(f"Found {len(files_info)} migration files")
    
    # Step 2: Ensure placeholder exists
    ensure_placeholder_exists(str(versions_dir))
    
    # Re-scan to include placeholder
    files_info = scan_migration_files(str(versions_dir))
    
    # Step 3: Normalize revision IDs and update references
    files_info, id_mapping = normalize_revisions(files_info)
    
    # Step 4: Remove old merge files
    remove_old_merge_files(str(versions_dir))
    
    # Step 5: Compute heads and create new merge migration
    heads = compute_heads(files_info)
    print(f"Current heads: {heads}")
    
    if len(heads) > 1:
        merge_filename = create_merge_migration(str(versions_dir), heads)
        merge_revision = f"merge_fix_heads_{datetime.now().strftime('%Y%m%d')}"
    else:
        print("Only one head found, no merge needed")
        merge_revision = heads[0] if heads else None
    
    # Step 6: Create alembic_version widening migration (optional)
    if merge_revision:
        widen_filename = create_alembic_version_widening_migration(str(versions_dir), merge_revision)
    
    # Step 7: Write all updated files
    write_updated_files(files_info)
    
    print("\nNormalization complete!")
    print(f"Normalized {len(id_mapping)} revision IDs:")
    for old, new in id_mapping.items():
        print(f"  {old} -> {new}")
    
    print(f"\nCurrent heads after normalization: {heads}")
    
    print("\nNext steps:")
    print("1. Review the changes with: git diff")
    print("2. Commit changes: git add migrations/ && git commit -m 'fix: normalize alembic revision IDs and fix multiple heads'")
    print("3. Push to Heroku: git push heroku HEAD:main")
    print("4. Run migration: heroku run flask db upgrade -a v3-app")
    print("5. Verify heads: heroku run flask db heads -a v3-app")

if __name__ == "__main__":
    main()