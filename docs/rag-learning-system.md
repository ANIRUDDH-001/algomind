# RAG Continuous Learning System

## Overview

AlgoMind's RAG system tracks knowledge gaps and accepts manual contributions.

## How It Works

### 1. Automatic Gap Detection
- Every interview query is analyzed
- Low similarity (<75%) queries are flagged as gaps
- Duplicate queries are consolidated (upvotes increase)

### 2. Admin Dashboard (`/admin/knowledge`)

**Access:** Only emails in `admin_users` table can access.

**Tabs:**
- **Knowledge Gaps:** Queries RAG couldn't answer well
- **DB Chunks:** Chunks stored in Supabase
- **Add Chunk:** Manual form to add new knowledge

### 3. Adding New Knowledge

1. Go to `/admin/knowledge` → "Add Chunk" tab
2. Fill topic, subtopic, content, keywords
3. Submit → Saves to `knowledge_chunks` table
4. Run `npm run rag:ingest` to regenerate embeddings

## Weekly Review Process

1. Check `/admin/knowledge` dashboard
2. Review top gaps by upvotes
3. Create 2-3 new chunks addressing common gaps
4. Regenerate embeddings
5. Deploy

## Database Tables

| Table | Purpose |
|-------|---------|
| `admin_users` | Email whitelist for admin access |
| `knowledge_chunks` | Master registry with usage stats |
| `knowledge_gaps` | Auto-detected unanswered queries |
| `knowledge_suggestions` | Future AI-proposed chunks |

## Admin Users

Current admins (in `admin_users` table):
- `aniruddhvijay2k7@gmail.com`
- `prachi101ed@gmail.com`

To add more admins:
```sql
INSERT INTO admin_users (email, name) VALUES ('email@example.com', 'Name');
```

## Future Enhancements

- Automated chunk proposals from conversation analysis
- Effectiveness tracking (did chunk actually help?)
- A/B testing of chunk quality
