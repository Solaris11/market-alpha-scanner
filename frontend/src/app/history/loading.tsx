import { RouteLoadingSkeleton } from "@/components/terminal/RouteLoadingSkeleton";

export default function Loading() {
  return <RouteLoadingSkeleton metricCount={3} title="Loading history and replay" />;
}
