/**
 * @codesage
 * @file      src/app/api/inngest/route.ts
 * @purpose   Serves Inngest functions as Next.js API route endpoints.
 * @tech      Next.js, Inngest
 * @connects  inngest/next, @/lib/inngest/client, @/lib/inngest/functions
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None found.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { assessInterviewFunction, chatAssistantFunction } from "@/lib/inngest/functions";

// Create an API that serves zero-dependency npx inngest-cli dev server
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    assessInterviewFunction,
    chatAssistantFunction,
  ],
});
