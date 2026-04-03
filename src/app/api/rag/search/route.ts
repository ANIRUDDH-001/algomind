import { NextRequest, NextResponse } from "next/server";
import { getRetriever } from "@/lib/rag/retriever";
import { buildRagResponse, mapSearchChunk } from "@/lib/rag/contract";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
    // Auth guard — only authenticated users may query the RAG store
    const supabase = await createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized", ...buildRagResponse('', []) }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { query, topic, difficulty } = body;

        if (!query) {
            return NextResponse.json(
                { error: "Query is required", ...buildRagResponse('', []) },
                { status: 400 }
            );
        }

        const retriever = getRetriever();
        const retrieval = await retriever.retrieve(query, {
            topK: 3,
            includeTopic: topic,
            includeDifficulty: difficulty,
        });

        const chunks = retrieval.results.map(mapSearchChunk);
        return NextResponse.json(buildRagResponse(query, chunks));
    } catch (error) {
        console.error("RAG Search Error:", error);
        return NextResponse.json(
            { error: "Failed to retrieve context", ...buildRagResponse('', []) },
            { status: 500 }
        );
    }
}
