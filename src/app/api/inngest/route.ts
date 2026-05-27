import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { assessInterviewFunction } from "@/lib/inngest/functions";

// Create an API that serves zero-dependency npx inngest-cli dev server
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    assessInterviewFunction,
  ],
});
