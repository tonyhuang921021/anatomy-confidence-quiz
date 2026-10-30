import { reviewedImageSource } from '@/lib/reviewedImageSource';

export type VerifiedExplanationFigure = {
  asset: string;
  alt: string;
  caption: string;
  sourceUrl: string;
  attribution: string;
  license: string;
  licenseUrl: string;
};

// Only independently reviewed, rights-cleared figures may be added here.
// An empty list is honest: missing images are never invented by the model.
const verifiedFigures: Readonly<Record<string, readonly VerifiedExplanationFigure[]>> = {
  'MOEX-C217-091030-S4004-STAGE1-Q001': [{
    asset:'/reviewed-explanations/assets/eb67df646c2cd09bef17000ae0b27b17368c77946e219b377671fd1eb753a95c.jpg',
    alt:'站立時大腿向前抬起，圖示髖關節屈曲與伸展方向。',
    caption:'髖屈曲使大腿向前抬起；髖伸展則朝後方移動。圖示同時屈膝，髖與膝的動作可分別判讀。',
    sourceUrl:'https://temple.manifoldapp.org/read/a852952e-bd23-4a54-be97-be3a7ef5039f/section/c56ce988-f5f2-42ae-950a-4e8ca4d98263',
    attribution:'Dan Silver, Hands-on Anatomy, Temple University Press / North Broad Press；原圖未修改', license:'CC BY 4.0', licenseUrl:'https://creativecommons.org/licenses/by/4.0/'
  }],
  'MOEX-C217-091030-S4004-STAGE1-Q002': [{
    asset:'/reviewed-explanations/assets/43f8e9dd3b701cea977340812b3e7288c33373cdbff9d5e1e49382eeabae5410.png',
    alt:'紫外線、MC1R、酪胺酸酶與黑色素體轉移的簡化示意圖。',
    caption:'UV 相關訊號促進黑色素生成，黑色素體經細胞突起轉移至角質形成細胞。',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:Melanin_Development_in_Melanocytes.svg',
    attribution:'CamrynKnights；Commons 官方 PNG 縮圖', license:'CC BY 4.0', licenseUrl:'https://creativecommons.org/licenses/by/4.0/'
  }],
  'MOEX-C217-091030-S4004-STAGE1-Q003': [{
    asset:'/reviewed-explanations/assets/a9a16fb839235ef6be3559b08607eaced6523bc67df2554498cbdd2ec81dd10d.jpg',
    alt:'離心血液的血漿、白血球與血小板薄層、紅血球分層圖。',
    caption:'血球與血小板懸浮於血漿；離心後可看到血漿、白血球／血小板層及紅血球分層。圖中數值為教材示例。',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:1901_Composition_of_Blood.jpg',
    attribution:'OpenStax College；原圖未修改', license:'CC BY 3.0', licenseUrl:'https://creativecommons.org/licenses/by/3.0/'
  }]
};

export function validVerifiedFigure(figure: VerifiedExplanationFigure): boolean {
  if (!figure.alt.trim() || !figure.caption.trim() || !figure.attribution.trim() || !figure.license.trim()) return false;
  if (!figure.asset.startsWith('/reviewed-explanations/assets/') || !reviewedImageSource(figure.asset, 'https://example.invalid')) return false;
  try { const url = new URL(figure.sourceUrl); const license = new URL(figure.licenseUrl); return url.protocol === 'https:' && !url.username && !url.password && license.protocol === 'https:' && !license.username && !license.password; }
  catch { return false; }
}

export function getVerifiedExplanationFigures(questionId: string): readonly VerifiedExplanationFigure[] {
  return (verifiedFigures[questionId] ?? []).filter(validVerifiedFigure);
}
