'use strict';
function imageWorkMessage(status){
 return ({
  approved:'圖片已通過驗圖並顯示。',
  pending_visual_review:'候選圖已保存，等待圖片審核。',
  held_for_review:'驗圖結果待確認，已保留紀錄與預算，不會重送。',
  paused_lease_held:'圖片處理已暫停，既有操作保留，不會重送。',
  awaiting_budget:'圖片額度已用完，詳解已保留。',
  awaiting_concept_review:'搜尋概念需要核對，尚未新增搜尋。',
  awaiting_image:'這次 Commons 搜尋未取得合適圖片，詳解與紀錄已保留；不代表其他網站沒有相關圖。',
  stale:'詳解版本已更新，舊圖片需求不再套用。',
  idle:'目前沒有可安全處理的新圖片需求。',
  disabled:'圖片處理目前關閉。'
 })[status]||'操作狀態待確認，請重新載入查看；不會自動重送。';
}
module.exports={imageWorkMessage};
