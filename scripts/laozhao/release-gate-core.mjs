export function evaluatePreviewReleaseGate({
  vercelEnv,
  previewVideoCount,
  publicBoardAssetCount
}) {
  const hasPreviewContent = previewVideoCount > 0 || publicBoardAssetCount > 0;
  const blocked = vercelEnv === "production" && hasPreviewContent;
  return {
    blocked,
    hasPreviewContent,
    message: blocked
      ? "老趙測試教材仍存在，禁止建立 production。請保留為受保護 Preview，且不可直接 promote。"
      : "老趙 Preview production gate 通過。"
  };
}
