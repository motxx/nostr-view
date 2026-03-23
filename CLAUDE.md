@AGENTS.md

# Coding Style

## Dan Abramov's principles ("You Might Not Need an Effect")

- **useEffectは外部システムとの同期にのみ使用する**（WebSocket, requestAnimationFrame等）
- 派生データはレンダリング中に計算する（useMemo / インライン）。useEffect + setStateで派生しない
- ユーザーイベントへの反応はイベントハンドラに直接書く。useEffectで反応しない
- `document.createElement` 等のDOM APIを避け、`OffscreenCanvas` やReact stateで宣言的に制御する
- `element.style` 等の命令的スタイル変更ではなく、`className` / stateで制御する
- `addEventListener` を直接使わない。ライブラリのコールバック / `onBeforeRender` 等を活用する
- Zustandストアの非リアクティブ読み取りには `getState()` を使い、不要な再レンダーを避ける

## テスト

- 新しいロジック（ドメインサービス、ストア、ユーティリティ）には必ずテストを書く
- テストランナー: `vitest`（`bun run test`）
- テストファイル: `*.test.ts` をソースファイルと同じディレクトリに配置
- パッケージマネージャー: `bun`
