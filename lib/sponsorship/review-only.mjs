/** UI-review release gate. Project environment variables cannot enable payment or Auth.
 * Remove only after a separately approved activation and end-to-end acceptance.
 */
export const SPONSORSHIP_REVIEW_ONLY = true;
export function sponsorshipReviewResponse() {
  return new Response(JSON.stringify({
    code: 'PREVIEW_CHECKOUT_DISABLED',
    message: '此預覽未啟用付款、測試登入或訂單查詢，不會建立訂單或扣款。',
  }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
