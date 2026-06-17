import { OwnerHtmlReviewFrame } from "@/components/OwnerHtmlReviewFrame";

export default function OwnerParasitologyReviewPage() {
  return (
    <OwnerHtmlReviewFrame
      apiPath="/api/owner/parasitology-review"
      title="寄生蟲國考互動複習"
      loadingText="正在載入寄生蟲互動複習..."
      errorFallback="寄生蟲複習頁讀取失敗"
    />
  );
}
