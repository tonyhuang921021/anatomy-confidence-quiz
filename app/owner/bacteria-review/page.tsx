import { OwnerHtmlReviewFrame } from "@/components/OwnerHtmlReviewFrame";

export default function OwnerBacteriaReviewPage() {
  return (
    <OwnerHtmlReviewFrame
      apiPath="/api/owner/bacteria-review"
      title="細菌國考互動複習"
      loadingText="正在載入細菌互動複習..."
      errorFallback="細菌複習頁讀取失敗"
    />
  );
}
