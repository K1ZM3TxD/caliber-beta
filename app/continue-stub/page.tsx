import { Suspense } from "react";
import ContinueStubClient from "./ContinueStubClient";

export default function ContinueStubPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ContinueStubClient />
    </Suspense>
  );
}
