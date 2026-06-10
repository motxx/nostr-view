# Architecture Decision Records

クラスタリング/グラフ構築の設計判断の記録。背景の詳細と検証数値は [docs/clustering.md](../clustering.md) を参照。

| # | 決定 |
|---|---|
| [0001](0001-louvain-replaces-label-propagation.md) | コミュニティ検出にLouvain法を採用し、ラベル伝播法を廃止する |
| [0002](0002-active-users-only-no-follow-edges.md) | コミュニティグラフをノート著者に限定し、フォローエッジを除外する |
| [0003](0003-nip-aware-edge-extraction.md) | エッジ抽出をNIP準拠の単一モジュールに統一する |
| [0004](0004-multi-facet-auto-selection.md) | 多面クラスタリングと品質スコアによる自動選択 |
| [0005](0005-one-way-clustering-then-naming.md) | クラスタリングと命名を一方向に分離する |
| [0006](0006-real-data-validation-required.md) | クラスタリング変更は実リレーデータでの検証を完了条件とする |
| [0007](0007-cluster-identity-reconciliation.md) | クラスタ同一性をメンバー重複で引き継ぎ、Auto選択にヒステリシスを設ける |
| [0008](0008-engagement-concept.md) | エンゲージメント（受信ベース・相互性込み）を単一の中心性概念とする |
