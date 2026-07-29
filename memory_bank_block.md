# Memory bank block — LLM internals and GoldenSyrup delegation

Paste this into claude_connector's memory bank. Tagged for get_context retrieval.

---

**Topic: LLM internals — what Claude can and cannot access about itself**

Claude has no first-person access to tokens, tokenizer as callable, attention patterns, activations, weights, context window usage, sampling params, or training data lookup. Any self-report on internals is confabulated text. Has access to: system prompt text, userMemories, tool schemas, available_skills, conversation context, container filesystem, deferred tools via tool_search. Opacity of tokenizer specifics and context-window size is legacy/interface choice, not security (both are public). Opacity of real-time state (exact positions, token count) is defensible as attack-surface reduction.

**Topic: Framework position in the transformer**

Un-embedded: everything (system prompt, userMemories, available_skills, tool schemas, turns) is one flat BPE token sequence. No architectural separation between framework and conversation. Chat-template markers are learned patterns, not enforced. Prompt injection works because substrate has no instruction/data distinction. Embedded: framework sits as a prefix at positions 0..~N, cached in KV cache, re-attended by every generation step. RoPE encodes relative position via rotation on Q/K. Framework has no spatial location the model can point to — separation exists only at feature/attention-head level as learned specialization.

**Topic: Attention formula and complexity**

Attention(Q,K,V) = softmax((QKᵀ)/√d_k + M) · V. Multi-head concatenates h parallel heads, projects through W_O. Block = residual(attention(LN(x))) + residual(MLP(LN(x))). Complexity dominated by N·d² (MLPs + QKV projections, dominates for short sequences) and N²·d (attention scores, dominates for long sequences); crossover around N ≈ d, roughly 10k tokens. KV cache is O(L·N·d) per request, often the binding constraint before compute. Parameter count ≈ L · 12d².

**Topic: N² vs N+C constants question**

Crossover N* = (1 + √(1+4C))/2 ≈ √C for large C. Linear method with overhead 10,000 doesn't beat quadratic until N ≈ 100. This is why Flash Attention wins in practice for N < 4-16k tokens even at O(N²) — its constants are small enough that linear alternatives can't catch. Hybrid architectures (Jamba, Zamba, Griffin, Samba, Hymba) mix attention layers (pay N² tax for softmax selectivity) with linear/SSM layers (linear bulk work) to use each where its constants win.

**Topic: Attention efficiency landscape**

Sparse patterns as paths through the N×N grid: sliding window (Longformer/Mistral), strided/dilated (Sparse Transformer), BigBird (local + global + random). Low-rank exploitation: Linformer (learned projection to r < N), Performer (kernel approximation), Nyströmformer (landmark tokens). Flash Attention is memory-hierarchy improvement not algorithmic — tiles computation so N×N matrix never hits HBM, drops memory traffic from N² to N·d. Flash pattern has been ported to sliding-window / causal / block-sparse variants, Flash Decoding (inference-time), Ring Attention (distributed for million-token contexts), Flash-linear-attention (RetNet/GLA/Mamba-2), MegaBlocks (MoE). Any pairwise-reduction operation with block structure and intermediate reuse benefits.

**Topic: Hamiltonian path / Cantor pairing insight**

Cantor pairing π(i,j) = ((i+j)(i+j+1)/2) + j gives bijection N × N → N — the "straighten the matrix" move. Bijections preserve information but not computation, so relabeling alone doesn't reduce N² work. The useful version: visit only a structured subset of cells (sparse attention). The deeper version: exploit low-rank structure so most cells are determined by a small basis (Linformer et al.). Primality analog: prime check is O(√n) because factors pair around √n; low-rank attention is O(N·r) because Nr independent parameters describe an N×N matrix.

**Topic: Potentially novel attention research angles**

Three underexplored directions from this session: (1) learned Hamiltonian paths where a small network outputs a permutation trained end-to-end, generalizing BigBird's fixed patterns; (2) Cantor-block attention with hierarchical block structure biased toward early tokens (specific low-rank prior); (3) recurrence-over-diagonals — compute k anti-diagonals of attention matrix directly, use SSM-style recurrence for the rest, composing pairing-function idea with state-space linear recurrence. None confirmed novel — needs literature check.

**Topic: Attention variant POC — deferred**

Ran quick CPU experiment comparing full causal / sliding / random-k / BigBird / snake-path / Cantor-ranked sparse patterns on associative recall task. First attempt had bug (key repeats made target ambiguous), all variants stuck at chance. Fixed version at /home/claude/attn_exp3.py with unique keys, ready for real hardware. Deferred running to completion — needs GPU or longer time budget. Realistic scope ladder: Level 1 educational POC (weekend, ~200 lines), Level 2 novel-variant POC (2-4 weeks, needs Triton kernel + real benchmark like WikiText-103 or LRA, publishable at workshop), Level 3 genuine research contribution (months, needs GPU budget for 100M-1B param training).

**Topic: GoldenSyrup OS delegation architecture — decision**

Split chat vs delegation: exploratory reasoning and framework work stays in claude.ai chat with me; bounded defined-deliverable work delegates to raw Claude via GoldenSyrup OS + Anthropic API + claude_connector memory bank. Task envelope for delegation: task spec + deliverable format + scoped memory pull via get_context + attached files + success criteria + sync_memory log-back hook. No public claude.ai chat API exists — GoldenSyrup OS cannot address claude.ai chats as objects. Workable path is rebuilding chat abstraction inside GoldenSyrup OS on Anthropic API + memory bank spine.

**Topic: Delegation fit criteria**

Delegate: code review, contract redlines, submission drafting, landing page copy, repeat-shaped work (weekly cash flow, month-end recon, invoice chase, lead triage), multi-agent pipelines (DutyBreak-style), sub-pillar research, structured extractions (PDF→JSON, transcript→action items). Keep in chat: exploratory reasoning with unknown answer-shape, back-and-forth debugging, high-stakes irreversible outputs (need approval gate), tasks depending on state not captured in memory. Cost: Sonnet 4.6 typical task (5k context + 2k output) ≈ $0.05, Opus ≈ $0.25. Prompt caching drops repeated input to ~$0.30/M. Batch API is 50% cheaper for non-urgent.

**Topic: Cowork-as-dispatcher pattern**

Flow: chat with Claude → Claude calls cowork_dispatch(task, target_module, deliverable_spec) → task queued with scoped memory + credentials → GoldenSyrup OS worker executes → result flows back via sync_memory + status update. Dispatcher itself is its own module with no hard dependencies on target modules — modules can be disabled without breaking dispatch. When a module is disabled, dispatch calls to it get rejected cleanly at the queue layer with a reason.

**Topic: Modularity philosophy for GoldenSyrup**

Insta-drop of any module requires: per-module isolation at connector layer (own MCP endpoint or tool), per-module memory scoping (all get_context calls scoped, no shared "core" memory), per-module credential vaults, circuit breakers not hard failures, no cross-module direct calls (communicate via memory bank or events), explicit module manifests declaring dependencies. MCP tools to add to claude_connector: list_modules, disable_module(name, reason), enable_module(name), is_module_active(name), module_status(name). Memory bank is deliberate exception — kept shared because cross-project synthesis is its whole value; scope-tag every entry instead.

**Topic: Separation vs sharing timing — current stage**

Decision at zero-revenue stage: aggressive sharing is correct. One Railway project holding multiple services. One Postgres instance with per-project schemas (not separate DBs). Single secrets manager or .env files. One observability account with per-project scoping. Free tiers everywhere. Modular at interface layer, shared at substrate. Keep separate even now: financial and identity infrastructure (payment processors, domain ownership under correct entity, customer-facing vs backend email split following auscloud925 vs sriram.bhagavath08 pattern) — expensive to untangle later. Triggers for real separation: paying customers, personal data of non-self humans, co-founder/employee with access, distinct legal entity, tax-material revenue, credible legal threat. Cost delta for full separation across 8 projects when it does matter: ~$100-150/mo. Disciplines that make it work: consistent naming (project name in every resource identifier) and backup discipline (automated per-project, tested restore quarterly).

**Topic: Meta-principles from LLM internals thread**

Constants matter more than asymptotics at realistic N — asymptotic-better ≠ actual-better until crossover. Bijections don't reduce work; structure does — sparsity and low-rank are the real wins. Every serious ML efficiency improvement is a reverse-search example: Flash Attention is a primitive with a guarantee (tiled fused kernels beat memory-bound ops), then people find which operations fit the guarantee shape. Modularity is discipline not substrate — interface-level modularity buys most of the benefit early; substrate separation pays off only once blast radius is real. Delegate what has known shape, chat what doesn't — the API/chat split is about task shape not model capability.
