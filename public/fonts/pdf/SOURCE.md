# PDF font

Noto Serif TC Regular, official Traditional Chinese subset OTF.

Source: https://github.com/notofonts/noto-cjk/blob/main/Serif/SubsetOTF/TC/NotoSerifTC-Regular.otf
License: SIL Open Font License 1.1; see OFL.txt.

The unmodified font is served locally and loaded only when generating a PDF. The original CFF table is embedded without changing its bytes. An explicit PDF CMap preserves the font's glyph-index-to-CID mapping across PDF readers; the remaining OpenType container is not embedded. Ordinary exports retain the smaller TC font.

## Supplemental CJK coverage

Noto Serif CJK TC Regular, unmodified official full CJK OTF. Loaded only when normalized export text includes characters missing from the smaller TC font; the chosen font alone is embedded. This preserves original characters such as U+8772 without changing question data.

Source: https://github.com/notofonts/noto-cjk/blob/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Serif/OTF/TraditionalChinese/NotoSerifCJKtc-Regular.otf

SHA-256: 234301038e76e7c35c43113785024700c4e4fe7bdce1d1fbbc42fca7e6683798

License: SIL Open Font License 1.1; the upstream Serif/LICENSE is byte-identical to OFL.txt. The 24,541,904-byte font supports 44,777 Unicode code points. Files requiring it are larger; ordinary exports retain the existing font.
