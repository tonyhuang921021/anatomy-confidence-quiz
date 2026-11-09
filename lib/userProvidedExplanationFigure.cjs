'use strict';

// A single user-supplied, explicitly requested textbook figure. This is not an
// open-license discovery result and never enters or relaxes that review policy.
const FIGURE=Object.freeze({
 id:'q068-guyton-hall-12e-27-19-33693385',
 questionId:'MOEX-111020-1301-Q068',
 explanationHash:'662447cf9e1d422207794b3866ba9597f9947eb5bc428bf7e6d925ba61e0859f',
 replacementRevision:'9380baa3-1948-4709-9ac5-352d52b81e6e',
 imageSha256:'33693385de7116eb83144a35ed1139bcbfc8bdccc44c2f9275c0e9c7745390a7',
 asset:'/user-provided-explanations/33693385de7116eb83144a35ed1139bcbfc8bdccc44c2f9275c0e9c7745390a7.jpg',
 sectionTitle:'生理意義',
 alt:'菊糖清除率計算示意：每分鐘濾過量等於排出量；教材範例 GFR 為 125 mL/min。',
 caption:'菊糖不被腎小管再吸收或分泌，每分鐘濾過量等於每分鐘排出量，因此 GFR = 尿中菊糖濃度 × 尿液流量 ÷ 血漿菊糖濃度。',
 exampleNote:'圖中 125 mL/min 是教材範例（125 × 1 ÷ 1）。本題應代入 35 × 0.6 ÷ 0.25 = 84 mL/min，不要直接套用圖中的數字。此圖說明清除率，未提供各段腎小管的實測濃度。',
 attribution:'Guyton and Hall Textbook of Medical Physiology，第 12 版，圖 27-19',
 sourceUrl:'https://medizzy.com/feed/40870936',
 rightsNotice:'教材著作權歸原權利人；使用者提供原圖，未修改。'
});

function userProvidedExplanationFigure(questionId,explanationHash,replacementRevision){
 return questionId===FIGURE.questionId&&explanationHash===FIGURE.explanationHash&&replacementRevision===FIGURE.replacementRevision?FIGURE:null;
}
module.exports={userProvidedExplanationFigure};
