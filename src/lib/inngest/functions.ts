// @ts-nocheck
import { inngest } from "./client";
import { getServiceClient } from "@/lib/supabase/service";
import { CognitiveAnalyzer } from "@/lib/assessment/analyzer";
import { updateKaiMemory } from "@/lib/ai/memory-generator";
import { createAndSaveSession1Baseline } from "@/lib/ai/narrative-generator";
import { logSystemEvent } from "@/lib/monitoring/events";
import { addToQueue, updateSkillRepetition } from "@/lib/spaced-repetition/queue";
import { getKnowledgeGraphService } from "@/lib/knowledge-graph";

export const assessInterviewFunction = inngest.createFunction(
  { id: "assess-interview", retries: 3 },
  { event: "interview/assess" },
  async ({ event, step }) => {
    const { sessionId, userId } = event.data;
    const supabase = getServiceClient(); // Service role client

    // 1. Fetch session data
    const session = await step.run("fetch-session", async () => {
      const { data, error } = await supabase
        .from("interview_sessions")
        .select("id, problem_id, problem_title, transcript, difficulty_mode")
        .eq("id", sessionId)
        .single();
      
      if (error || !data) throw new Error("Session not found");
      return data;
    });

    // 2. Fetch problem details
    const prob = await step.run("fetch-problem", async () => {
      const { data, error } = await supabase
        .from("problems")
        .select("description, difficulty, tags, primary_pattern")
        .eq("id", session.problem_id)
        .single();
      
      if (error || !data) throw new Error("Problem not found");
      return data;
    });

    // 3. Analyze transcript
    const result = await step.run("analyze-transcript", async () => {
      const analyzer = new CognitiveAnalyzer();
      return await analyzer.analyze(
        sessionId,
        {
          title: session.problem_title || "",
          description: prob.description || "",
          difficulty: prob.difficulty || "medium",
        },
        session.transcript as any[]
      );
    });

    // 4. Save assessment
    await step.run("save-assessment", async () => {
      const skills = result.skills || {};
      const isWarmUp = session.difficulty_mode === "warm-up";
      const hireDecision = isWarmUp ? null : (result.hireDecision ?? null);

      const { error } = await supabase.from("assessments").insert({
        session_id: sessionId,
        user_id: userId,
        overall_score: result.rawScore ?? 0,
        adjusted_score: result.adjustedScore ?? null,
        overall_feedback: result.overallFeedback,
        next_steps: result.nextSteps,
        skill_evidence: {
          ...result.skills,
          keyMoments: result.keyMoments || [],
          improvementExamples: result.improvementExamples || [],
        },
        hire_decision: hireDecision,
        problem_decomposition: (skills["problem-decomposition"] as any)?.score ?? null,
        pattern_recognition: (skills["pattern-recognition"] as any)?.score ?? null,
        algorithmic_thinking: (skills["algorithmic-thinking"] as any)?.score ?? null,
        complexity_analysis: (skills["complexity-analysis"] as any)?.score ?? null,
        communication_clarity: (skills["communication-clarity"] as any)?.score ?? null,
        edge_case_awareness: (skills["edge-case-awareness"] as any)?.score ?? null,
        optimization_mindset: (skills["optimization-mindset"] as any)?.score ?? null,
        debugging_approach: (skills["debugging-approach"] as any)?.score ?? null,
        model_used: result.modelUsed ?? "unknown",
        confidence: 0.8,
        validation_pass_done: result.validationPassDone ?? false,
        sub_criteria: Object.fromEntries(
          Object.entries(skills).map(([k, v]) => [k, (v as any).subCriteria || {}])
        ),
      });

      if (error) throw new Error(`Failed to insert assessment: ${error.message}`);
    });

    // 5. Post-commit updates (Knowledge Gaps, Spaced Repetition, KG, etc)
    await step.run("post-commit-updates", async () => {
      const hireDecision = session.difficulty_mode === "warm-up" ? null : (result.hireDecision ?? null);
      const overallScore = result.rawScore ?? 0;

      // Knowledge Gaps
      if (result.knowledgeGaps && result.knowledgeGaps.length > 0) {
        const gapsToInsert = result.knowledgeGaps.map((gap) => ({
          user_query: gap,
          gap_reason: "Identified during AI assessment",
          session_id: sessionId,
          user_id: userId,
          status: "new",
          priority: "medium",
          upvotes: 1,
        }));
        await supabase.from("knowledge_gaps").insert(gapsToInsert);
      }

      // Memory & Spaced Rep
      try {
        await addToQueue({
          userId,
          problemId: session.problem_id,
          problemTitle: session.problem_title || "",
          problemDifficulty: prob.difficulty || "medium",
          overallScore: result.rawScore ?? 5,
        });
      } catch (err) {}

      // Per-skill FSRS updates
      try {
        const skills: Record<string, any> = result.skills || {};
        const dimensionScores: Record<string, number> = {
          "problem-decomposition": (skills["problem-decomposition"] as any)?.score ?? 5,
          "pattern-recognition": (skills["pattern-recognition"] as any)?.score ?? 5,
          "algorithmic-thinking": (skills["algorithmic-thinking"] as any)?.score ?? 5,
          "complexity-analysis": (skills["complexity-analysis"] as any)?.score ?? 5,
          "communication-clarity": (skills["communication-clarity"] as any)?.score ?? 5,
          "edge-case-awareness": (skills["edge-case-awareness"] as any)?.score ?? 5,
          "optimization-mindset": (skills["optimization-mindset"] as any)?.score ?? 5,
          "debugging-approach": (skills["debugging-approach"] as any)?.score ?? 5,
        };
        await updateSkillRepetition({
          userId,
          sessionId,
          dimensionScores,
        });
      } catch (err) {}

      // Knowledge Graph update
      try {
        await getKnowledgeGraphService().onInterviewSessionCompleted({
          userId,
          sessionId,
          problemTags: prob.tags ?? [],
          primaryPattern: prob.primary_pattern ?? null,
          overallScore,
        });
      } catch (err) {}

      // Memory update
      try {
        await updateKaiMemory(userId);
      } catch (err) {}

      // Session 1 baseline
      try {
        const { count, error: countError } = await supabase
          .from("interview_sessions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        if (!countError && count === 1) {
          const skillsForBaseline: Record<string, number> = {};
          for (const [key, value] of Object.entries(result.skills)) {
            skillsForBaseline[key] = (value as any).score ?? 5;
          }
          await createAndSaveSession1Baseline(userId, {
            sessionId,
            problemTitle: session.problem_title || "",
            problemDifficulty: prob.difficulty || "medium",
            overallScore: result.rawScore ?? 0,
            skills: skillsForBaseline,
            completedAt: new Date().toISOString(),
          });
        }
      } catch (err) {}
    });

    return { success: true };
  }
);
