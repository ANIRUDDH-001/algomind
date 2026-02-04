import { NextRequest, NextResponse } from "next/server";
import { retrieveContext } from "@/lib/rag/retriever";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { query, topic, difficulty } = body;

        if (!query) {
            return NextResponse.json(
                { error: "Query is required" },
                { status: 400 }
            );
        }

        const context = await retrieveContext(query, {
            topK: 3,
            includeTopic: topic,
            includeDifficulty: difficulty,
        });

        return NextResponse.json({
            status: "ok",
            context,
        });
    } catch (error) {
        console.error("RAG Search Error:", error);
        return NextResponse.json(
            { error: "Failed to retrieve context" },
            { status: 500 }
        );
    }
}
