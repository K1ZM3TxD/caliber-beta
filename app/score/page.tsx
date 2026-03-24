import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ScoreClient from "./ScoreClient";

export default async function ScorePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/calibration");
  }
  return <ScoreClient />;
}
