import { OwnerHtmlReviewFrame } from "@/components/OwnerHtmlReviewFrame";

export default function OwnerBiochemistryReviewPage() {
  return (
    <OwnerHtmlReviewFrame
      apiPath="/api/owner/biochemistry-review"
      title="生物化學國考互動複習"
      loadingText="正在載入生物化學互動複習..."
      errorFallback="生物化學複習頁讀取失敗"
    />
  );
}
