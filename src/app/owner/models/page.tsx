import { ModelsTab } from './ModelsClient';
import { ModelRoutingTab } from './RoutingClient';

export default function ModelsPage() {
  return (
    <div className="space-y-12">
      <ModelsTab />
      <ModelRoutingTab />
    </div>
  );
}
