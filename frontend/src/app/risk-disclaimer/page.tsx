import type { Metadata } from "next";
import RiskDisclosurePage from "../risk-disclosure/page";
import { marketingMetadata } from "@/lib/marketing-seo";

export const metadata: Metadata = marketingMetadata("/risk-disclaimer", {
  title: "Risk Disclaimer — Market Alpha Scanner",
});

export default RiskDisclosurePage;
