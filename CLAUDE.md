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

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
