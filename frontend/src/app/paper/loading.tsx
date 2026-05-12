import { RouteLoadingSkeleton } from "@/components/terminal/RouteLoadingSkeleton";

export default function Loading() {
  return <RouteLoadingSkeleton metricCount={5} title="Loading portfolio and paper trade workspace" />;
}
