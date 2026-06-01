/**
 * @codesage
 * @file      src/app/admin/employers/page.tsx
 * @purpose   Server component wrapper for employers admin page
 * @tech      Next.js server component
 * @connects  ./client
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import EmployersClient from './client';

export const dynamic = 'force-dynamic';

export default async function EmployersPage() {
    return <EmployersClient />;
}
