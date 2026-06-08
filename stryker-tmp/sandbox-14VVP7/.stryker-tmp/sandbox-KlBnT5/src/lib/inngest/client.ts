/**
 * @codesage
 * @file      src/lib/inngest/client.ts
 * @purpose   Inngest job client and function definitions.
 * @tech      Node.js, Inngest
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ 
    id: "algomind", 
    eventKey: process.env.INNGEST_EVENT_KEY || 'local' 
});
