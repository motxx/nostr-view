# クラスタリング設計 — 多面的・動的クラスタリング

最終更新: 2026-06-10

## 背景

旧実装は「ヒューリスティックに考えた手法」の寄せ集めで、言語面以外は綺麗に分析できていなかった:

- **Topic**: ハッシュタグ共起の貪欲マージ（出典なし、マージ順依存）
- **Community**: ラベル伝播法（LPA） — 文献上も実測上も不安定
- **Language**: Unicode文字種判定（これは機能していたが、タイブレークに順序依存バグがあった）

本リライトでは、**論文が存在する/業界で成果が証明されたアルゴリズムのみ**を採用し、
**実Nostrイベントでの定量検証**（`scripts/eval-clustering.ts`）を完了条件とした。

## 調査結果（Twitter・広告業界）

| 手法 | 出典 | 本実装への適用 |
|---|---|---|
| SimClusters: フォロー2部グラフ→producer類似度→コミュニティ検出。k≈145,000、Twitter全推薦の基盤 | Satuluri et al., KDD 2020 ([ACM](https://dl.acm.org/doi/10.1145/3394486.3403370)) | 「クラスタ対象はproducer（=可視ノード）に限定する」という設計原則。生のフォローエッジをそのまま使わない根拠 |
| Louvain法: モジュラリティ貪欲最適化 | Blondel et al., J. Stat. Mech. 2008 | `louvain.ts` — Community/Topic両面の中核 |
| Leiden: Louvainは非連結コミュニティを生む（最大16%） | Traag, Waltman & van Eck, Sci. Rep. 2019 ([arXiv:1810.08473](https://arxiv.org/abs/1810.08473)) | Louvainに**連結成分分割の事後パス**を追加（分割はQを厳密に非減少） |
| LPAの欠陥: 実行毎に結果が変わる・巨大コミュニティへの崩壊 | Traag & Šubelj 2023 ほか | LPA廃止の根拠（実データでも17,466人クラスタへの崩壊を確認） |
| ハッシュタグ共起ネットワーク+コミュニティ検出によるトピック検出（≥3ユーザのノイズフィルタ） | Weng & Menczer 2014 ([arXiv:1402.5443](https://arxiv.org/abs/1402.5443)) ほか | `cluster-detector.ts` — タグ共起グラフにLouvain |
| RFMセグメンテーション: 分位数スコアリング（5分位が業界標準、Recencyが最強の予測因子） | Hughes 1994; 広告/CRM業界標準 | `engagement-cluster.ts` — R/F/E 5分位 + 標準セグメントグリッド |
| c-TF-IDF: W(t,c) = tf(t,c) × log(1 + A/tf(t)) | Grootendorst 2022 ([arXiv:2203.05794](https://arxiv.org/abs/2203.05794), BERTopic) | `cluster-labeling.ts` — 全面のラベル付け（全クラスタ共通タグの排除） |
| モジュラリティQ: 分割品質の標準尺度 | Newman & Girvan 2004 | `cluster-quality.ts` — 全面共通の品質ヤードスティック |

## アーキテクチャ

### 4つの面（facet）+ Auto

| Mode | アルゴリズム | クラスタ対象 |
|---|---|---|
| **Community** (interaction) | リプライ2.0/リポスト1.5/リアクション1.0の重み付きグラフにLouvain + 連結性事後パス | ノート著者間の実関与 |
| **Topic** | ハッシュタグ共起グラフ（≥3ユーザのタグ、≥2共有ユーザのエッジ）にLouvain → ユーザは最多使用トピックに割当 | ハッシュタグ使用者 |
| **Language** | Unicode文字種 + 決定的タイブレーク | 全ノート著者 |
| **Engagement** | RFM 5分位（R=最終投稿, F=投稿数, E=被リアクション0.5+被リポスト2+フォロワー） → Champions / Loyal / Rising / At Risk / Hibernating / Casual | 全ノート著者 |
| **Auto** | 全面を計算し品質スコア最大の面を適用 | — |

### 品質スコア（Auto選択の基準）

```
score = 0.5·max(0, Q) + 0.3·coverage + 0.2·balance   （k<2なら×0.2）
```

- **Q (modularity)**: 対インタラクショングラフのNewman-Girvanモジュラリティ。どの面も同じヤードスティックで「実際の社会構造とどれだけ整合するか」を測る
- **coverage**: アクティブユーザ（ノート著者）のうちクラスタに割当てられた割合
- **balance**: クラスタサイズのシャノンエントロピー / log(k)（1巨大クラスタ縮退の罰則）

UI（ClusterOverviewPanel）にQ/cov/balを常時表示。Autoタブは選択された面を `auto → Community` のように表示する。

### 決定性

全アルゴリズムが**イベント順序に依存しない決定的実装**（ノードはソート順に走査、タイブレークは辞書順）。
`clusterFingerprint` によるLLMラベルキャッシュが再計算をまたいで安定する前提条件。
Language/Engagementのラベルは決定的なので `labelLocked: true` でLLM命名対象から除外。

## 実データ検証（2026-06-10, relay.nostr.band / nos.lol / relay.damus.io, 6時間窓）

データセット: 1,686イベント（790ノート、649リアクション、62リポスト、185フォローリスト）、332ノート著者。
再現: `bun scripts/eval-clustering.ts`（fetch→キャッシュ→評価。stable列はイベント順反転での不変性チェック）。

| 手法 | k | Q | coverage | balance | stable |
|---|---|---|---|---|---|
| LPA（旧） | 10 | 0.109 | 50% | 0.26 | **NO** — 17,466人の巨大クラスタに崩壊 |
| **Louvain（新Community）** | 7 | **0.675** | 21% | 0.92 | yes |
| 貪欲マージ（旧Topic） | 5 | -0.019 | 8% | 0.86 | yes |
| 共起Louvain（新Topic） | 5 | -0.020 | 8% | 0.87 | yes |
| Language（修正後） | 6 | 0.121 | 99% | 0.49 | yes（修正前はNO） |
| Engagement（新） | 6 | 0.177 | 100% | 0.96 | yes |

新Communityが検出した実コミュニティ例: `alephium/blockchain`、`発火大根の生態`（日本語圏）、
`bible/god/godstr`、`fuckbritishgov/fuckeu`（政治圏）、`cat/catstr/photography` など、目視でも一貫したコミュニティ。

**Auto選択の結果**: interaction (0.585) > engagement (0.582) > language (0.456) > topic (0.198) — コミュニティ面を正しく選択。

### 検証から得られた重要な発見

1. **kind-3フォローエッジはウィンドウ規模のコミュニティグラフに入れてはならない**。
   フォロー重みスイープ: follow=0 → Q=0.776・7コミュニティ / follow=0.25〜1.0 → Q≈0.17・1巨大クラスタ。
   フォローリストは数年分の累積でありウィンドウ内の関与を反映せず、コミュニティ横断の密な網になる。
   SimClustersがフォローを使えるのは**cosine類似度変換後**だから（生エッジではない）。
   → `INTERACTION_WEIGHTS.follow = 0`（実測根拠つき）
2. **クラスタ対象はアクティブユーザ（=可視化されるノート著者）に限定する**。
   無制限ではcontact listのp-tagで2万の不可視pubkeyがグラフに流入し構造が崩壊（Q 0.71→0.20）。
3. Topicのcoverage 8%はNostrの実態（ハッシュタグ使用率が低い）。Auto選択が正しく他面を選ぶ。

## 今後の拡張候補

- SimClusters式のproducer-producer cosine類似度グラフ（フォロー信号の正しい使い方）— kind-3を活かすならこれ
- Leidenのrefinementフェーズ完全実装（現状は連結性保証のみ）
- 埋め込みベースのトピック面（transformers.js等、ハッシュタグ非依存でcoverage改善）
- 評価スクリプトの定期実行によるリグレッション監視
