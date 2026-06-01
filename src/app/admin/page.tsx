/**
 * @codesage
 * @file      src/app/admin/page.tsx
 * @purpose   Server component entry point for the main admin page, rendering the AdminsClient.
 * @tech      React, Next.js
 * @connects  ./client
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None found
 * @audit     CODESAGE-v1
 */
import AdminsClient from './client';

export default async function AdminsPage() {
    return <AdminsClient />;
}
