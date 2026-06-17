import { OwnerHtmlReviewFrame } from "@/components/OwnerHtmlReviewFrame";

export default function OwnerVirusReviewPage() {
  return (
    <OwnerHtmlReviewFrame
      apiPath="/api/owner/virus-review"
      title="病毒國考互動複習"
      loadingText="正在載入病毒互動複習..."
      errorFallback="病毒複習頁讀取失敗"
    />
  );
}
