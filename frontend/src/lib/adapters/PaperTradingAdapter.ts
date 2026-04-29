import "server-only";

import { getPaperAnalytics, getPaperData } from "@/lib/paper-data";

export class PaperTradingAdapter {
  getAccount() {
    return getPaperData();
  }

  getAnalytics() {
    return getPaperAnalytics();
  }
}
