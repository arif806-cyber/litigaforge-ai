import { useEffect, useMemo, useRef, useState } from "react";
import {
  readWorkspaceGuideProgress,
  workspaceGuideStorageKey,
  writeWorkspaceGuideProgress,
} from "./workspaceOnboardingProgress";

export interface WorkspaceOnboardingProps {
  open: boolean;
  onClose: () => void;
  userId: number;
  demoMode?: boolean;
  onResetDemo?: () => Promise<void>;
}

type Lesson = {
  id: string;
  title: string;
  group: string;
  summary: string;
  purpose: string;
  when: string;
  inputs: string;
  steps: string[];
  example: string;
  result: string;
  verify: string;
  mistakes: string;
  caveat: string;
};

const lessons: Lesson[] = [
  {
    id: "matter",
    title: "Start with a matter",
    group: "Workspace & matter",
    summary: "Name, find, open, and remove a focused workspace.",
    purpose: "Keep the working canvas, case description, research, and generated matter materials together in one workspace.",
    when: "At the start of a new matter, or when returning to an existing preparation.",
    inputs: "A short matter title and a concise, de-identified case description. The description is the context used by analysis and smart search.",
    steps: [
      "Use the workspace list on the right and choose New Workspace. Enter a title in the new-workspace dialog and create it.",
      "Edit the matter title in the toolbar title field. Press Enter or move focus away to save the title.",
      "To locate a matter, use Search workspaces when it is available (the search field appears when there are more than two workspaces). It searches titles and case descriptions.",
      "Select a workspace card to open it. Its canvas and case description become the active matter.",
      "Use the delete control on a workspace card only when removal is intended; confirm the browser confirmation if shown. Deletion is not an archive workflow."
    ],
    example: "Create “Aster / interim injunction” and describe the parties, relief sought, key dates, forum, and disputed facts without unnecessary identifying details.",
    result: "A named workspace becomes active; its title and case-description context can be used by the other workspace tools.",
    verify: "Check the active title in the toolbar, reopen the workspace from the list, and confirm the saved description and canvas are still present.",
    mistakes: "Creating a second workspace for the same preparation; assuming search matches every hidden document; or deleting a matter to tidy the list without retaining any required record.",
    caveat: "A workspace is a preparation aid, not a substitute for your matter-management, limitation, filing, or client-record systems. Follow your confidentiality and retention obligations."
  },
  {
    id: "description",
    title: "Write the case description",
    group: "Workspace & matter",
    summary: "Give agents and smart search a bounded factual brief.",
    purpose: "Provide shared matter context so agents can reason against the same procedural posture and facts.",
    when: "Before analysis or smart search, and whenever verified case facts or posture change.",
    inputs: "Material facts, dates, procedural history, forum, relief sought, known evidence, and genuine uncertainties. Separate facts from assumptions.",
    steps: [
      "Open the Agents panel on desktop or choose Agents in the mobile bottom bar.",
      "Find the Case Description editor and enter a concise, structured account.",
      "Use neutral wording. Mark disputed assertions and missing documents explicitly; do not silently turn an assumption into a fact.",
      "Run an analysis or smart search only after reviewing the text for accuracy and unnecessary personal data."
    ],
    example: "“Applicant seeks interim restraint of transfer. Notice issued 12 March; reply due 26 March. Applicant says possession began in 2018; title and service of notice remain disputed. Relief requested: status quo pending hearing.”",
    result: "The description is available as context to agent analysis, direct agent questions, search, simulation, and fee suggestion.",
    verify: "Reopen the Agents panel and confirm the latest wording remains in the editor; check that the matter is still the intended active workspace.",
    mistakes: "Pasting an entire unredacted file; mixing client instructions with proven facts; or asking agents to resolve ambiguities that should first be checked in the record.",
    caveat: "Enter only information your practice permits you to process here. The UI’s privacy posture does not replace your own confidentiality, privilege, consent, and data-protection checks."
  },
  {
    id: "canvas",
    title: "Build the case canvas",
    group: "Canvas & reasoning",
    summary: "Turn the record into six connected, editable kinds of legal reasoning.",
    purpose: "Make the structure of the case visible: evidence and law, issues, submissions, vulnerabilities, and next moves.",
    when: "As facts are verified, research is found, and arguments are developed.",
    inputs: "A workspace, source material you have checked, and concise propositions that can be traced to the record.",
    steps: [
      "On desktop, choose Add Node in the toolbar. Create Judgment, Fact, Issue, Argument, Risk, or Strategy nodes. Add initial nodes from the empty-canvas guide where available.",
      "Select a node to edit its text and available type-specific fields. Use the node’s score controls to set or revise its impact score; treat the score as a working assessment, not an outcome probability.",
      "Drag nodes to arrange them. Drag from a node handle to another node to connect them; choose a relationship in the picker. Double-click an existing edge label to change its relationship label.",
      "Pan by dragging the open canvas; zoom with the mouse wheel or trackpad. Use the on-canvas controls to zoom and fit the canvas; the minimap helps orient a large graph.",
      "Select multiple nodes and choose Layout to arrange them hierarchically. Select at least two nodes and choose Group to make a cluster; select a cluster and choose Ungroup to expand it.",
      "Use Undo / Redo in the toolbar or Ctrl+Z / Ctrl+Y. Canvas delete is available for selected items via Delete/Backspace where enabled. Choose Save in the toolbar when you want to persist immediately."
    ],
    example: "Connect a verified “Notice served on 12 March” Fact to an Issue about urgency; connect the Issue to an Argument for status quo, a Risk about disputed service, and a Strategy to obtain the dispatch record.",
    result: "A navigable graph records how each proposition supports or challenges a proposed course.",
    verify: "Confirm the node labels and score are visible, the relationship label reads as intended, then use Save and revisit the matter to confirm persistence.",
    mistakes: "Treating a high score as proof; connecting a judgment to a proposition without reading the holding; grouping too early; or leaving an unlabeled inference indistinguishable from evidence.",
    caveat: "Keep a clear distinction between source-backed facts, legal propositions, client instructions, and AI-generated hypotheses. A canvas is not a verified case record."
  },
  {
    id: "nodes",
    title: "Choose node types and assess them",
    group: "Canvas & reasoning",
    summary: "Use the six node types consistently and make scores explainable.",
    purpose: "Give each item a role so the canvas remains readable and useful for analysis.",
    when: "Whenever adding an item, particularly after research or an agent response.",
    inputs: "A discrete proposition or source; a short label; supporting text and a provisional score where appropriate.",
    steps: [
      "Judgment: record a case citation, court, and relevant holding. Verify it separately before relying on it.",
      "Fact: record one material event or item of evidence, with date/source in the text where useful.",
      "Issue: frame a question the court must decide, not a conclusion disguised as a question.",
      "Argument: record a proposition, its legal basis, and the facts that support it.",
      "Risk: identify an adverse fact, procedural exposure, counterargument, or uncertainty and describe its consequence.",
      "Strategy: record a proposed action, sequence, or alternative prayer. Use the score controls as a prioritisation aid and explain the basis in the node text."
    ],
    example: "“Whether service was effective before the hearing” is an Issue; “Courier tracking shows delivery on 12 March” is a Fact only after checking the underlying record.",
    result: "The canvas separates source, question, submission, exposure, and action rather than flattening them into one narrative.",
    verify: "Review each node’s type and label; inspect its supporting text and score; ensure a reader can identify what is verified and what is provisional.",
    mistakes: "Using Judgment for an unverified citation; placing several unrelated facts in one node; or describing a legal conclusion as a fact.",
    caveat: "A node’s label, type, and score do not establish admissibility, authenticity, legal correctness, or evidential weight."
  },
  {
    id: "agents",
    title: "Run the five specialist agents",
    group: "AI analysis",
    summary: "Ask for complementary perspectives, then inspect each answer.",
    purpose: "Organise issue spotting, research, strategy, risk analysis, drafting, and outcome-oriented considerations into distinct views.",
    when: "After preparing a useful case description and, preferably, adding initial canvas nodes.",
    inputs: "Current case description and canvas context; a clear question for any follow-up.",
    steps: [
      "Open the Agents panel and press Run Agent Analysis (the mobile toolbar also has a quick-analyze control). The five specialists are Research, Strategy, Risk & Counter, Drafting, and Predictive.",
      "Wait while each agent shows Working. Analysis can take time: the interface uses a long-job/SSE-style wait for extended work and may stream partial text; do not assume a quiet interval means completion.",
      "Read Research for legal framework and judgments; Strategy for argument/procedure; Risk & Counter for vulnerabilities and adverse material; Drafting for draft sections and fee recommendation; Predictive for concerns and scenario estimates.",
      "Expand Reasoning Process where available. Use the Ask control on a completed agent to enter a specific follow-up and submit it; wait for the streamed response.",
      "Use helpful / not helpful feedback on a completed result. On Drafting, Copy copies the text to the clipboard and records a style-learning signal. Review the clipboard content before using it."
    ],
    example: "Ask Risk & Counter: “What record evidence would most weaken the applicant’s assertion that notice was not served?” Then compare the answer with the actual service record.",
    result: "Agent cards display their status and generated analysis; some outputs may be added to the canvas and Research may show live judgment references.",
    verify: "Wait for the agent’s Done state; inspect any citations and source links, compare propositions with the file, and confirm a canvas-added badge or new node if applicable.",
    mistakes: "Refreshing away from a long-running task; treating partial streamed text as final; assuming the five agents are independent authorities; or copying draft language before checking names, dates, forum, and relief.",
    caveat: "AI output is analysis, not verified law, legal advice, or a substitute for counsel’s judgment. Verify all citations, quotations, holdings, procedural rules, and factual claims against authoritative sources and the case record."
  },
  {
    id: "search",
    title: "Search Indian Kanoon and add judgments",
    group: "Research & insights",
    summary: "Use a manual query or canvas-informed smart search.",
    purpose: "Find potentially relevant judgments and attach selected results to the active canvas for review.",
    when: "After identifying the legal issue or adding enough context for targeted smart search.",
    inputs: "A focused legal query for manual search, or case description plus canvas nodes for Smart Search.",
    steps: [
      "Open Search in the right-hand tabs on desktop or the Search item in the mobile bottom bar.",
      "For manual search, enter terms such as “Article 21”, “specific relief Act 1963”, or a legal issue and press Go or Enter. A workspace session is required.",
      "For Smart Search from Canvas, add at least one useful node, then press Smart Search from Canvas. The panel displays phases, AI-generated query strings, incoming results, and a final ranked set; wait for completion.",
      "Inspect each result’s court, year, citation, summary, impact score, and source query. Expand a summary if needed; use the external-link control to open the source.",
      "Choose Add to Canvas for an individual result, or Add All to Canvas for all not-yet-added results. Results identify when they are already on canvas."
    ],
    example: "With an Issue node about specific relief and a verified procedural fact, run Smart Search; inspect the generated search phrases, then add only a judgment whose holding and applicability you have read.",
    result: "Search status and judgment cards appear; selected results are added as judgment nodes. The panel reports whether a manual response came from its local database or Indian Kanoon when that source metadata is returned.",
    verify: "Open the source link and compare the citation and relevant passage to an authoritative copy; confirm the chosen judgment appears on the canvas.",
    mistakes: "Using broad keywords without jurisdiction or issue context; selecting by impact score alone; assuming the ranking establishes that a case is binding; or relying on a search snippet as the holding.",
    caveat: "Search availability, coverage, ranking, and source metadata can vary. Search results are not guaranteed complete or current; no search result should be treated as seeded, fictional, or authoritative without checking its actual source."
  },
  {
    id: "insights",
    title: "Review proactive insights",
    group: "Research & insights",
    summary: "Refresh, inspect, accept, or dismiss suggested next steps.",
    purpose: "Surface possible opportunities, risks, precedents, patterns, warnings, agent questions, similar matters, and canvas actions.",
    when: "After the canvas contains useful material, especially after agent analysis.",
    inputs: "An active workspace and canvas context; some insights require at least two nodes.",
    steps: [
      "Open Intel / Proactive Intelligence from the right tabs on desktop or the mobile bottom bar.",
      "Choose Refresh. Wait for the loading cards to finish; insights may also refresh after agent analysis.",
      "Read each suggestion. Choose Detail when available to expand the explanation.",
      "Choose the card’s action to accept it. Depending on type, this may add a canvas item, open a matter, or direct a question to an agent.",
      "Choose the dismiss control to remove an item from the current suggestions. If a suggestion type is later reduced by repeated dismissals, the Legal Twin profile exposes an Undo/reactivate control when available."
    ],
    example: "Refresh after adding a disputed service Fact and a limitation Risk; inspect any warning and accept only a proposed step that fits the actual procedural timetable.",
    result: "The panel shows refreshed cards, expanded details, accepted actions, or an empty-state prompt when a workspace or canvas context is missing.",
    verify: "Check the resulting node, opened matter, or agent question; return to the panel and confirm dismissed suggestions no longer appear in the current list.",
    mistakes: "Accepting suggestions in bulk without review; treating a cross-matter pattern as controlling authority; or dismissing repeatedly without noticing that visibility may be reduced.",
    caveat: "Suggestions are prompts for professional review, not directions or verified legal conclusions. Confirm each against the record, client instructions, governing law, and deadlines."
  },
  {
    id: "simulation",
    title: "Test a what-if assumption",
    group: "AI analysis",
    summary: "Compare a baseline with an explicitly hypothetical change.",
    purpose: "Explore how a stated assumption might alter risks, scores, and strategic options without altering the underlying facts.",
    when: "When pressure-testing a proposition, alternative argument, new evidence scenario, or settlement path.",
    inputs: "A populated canvas and one clearly worded assumption. Quick scenarios are provided; custom assumptions are also accepted.",
    steps: [
      "Open Sim / What-If Simulation from the right tabs or mobile bottom bar.",
      "Choose a quick scenario, such as “Assume the key judgment is distinguished by the court”, or enter a custom assumption in the text box.",
      "For a custom assumption, choose Run Simulation. Ctrl+Enter (or Cmd+Enter) also runs it. Wait while the analysis streams and agent activity is shown.",
      "Compare Before with After: average impact score, risk level, score change, node deltas, summary, and recommendation.",
      "When complete, choose Save to retain the scenario in Saved Simulations. Choose Apply Scores only if you intentionally want its score changes reflected on the canvas."
    ],
    example: "“Assume the opposing party produces a signed delivery receipt dated before the hearing.” Compare the resulting service-related risk and alternative steps with the baseline.",
    result: "A before/after comparison and per-node changes appear; saved runs are listed in the panel; applying scores updates the canvas score view.",
    verify: "Read the exact scenario label; inspect which nodes changed and why; after Apply Scores, check the affected canvas scores and save the canvas.",
    mistakes: "Writing a vague assumption; confusing simulated score shifts with a forecast; or applying hypothetical scores to the live canvas without recording the underlying assumption.",
    caveat: "Simulation is hypothetical AI analysis, not a probability guarantee or prediction of judicial action. Do not present it as evidence or as a verified outcome estimate."
  },
  {
    id: "twin",
    title: "Manage the Legal Twin",
    group: "Privacy & learning",
    summary: "Control learning, review cross-matter patterns, and reset the profile.",
    purpose: "Review aggregate work-pattern signals and, when enabled, tailor suggestions to observed in-Forge interactions.",
    when: "When deciding whether personalisation is appropriate, or reviewing recurring patterns across matters.",
    inputs: "An active workspace; profile data can reflect agent feedback, accepted suggestions, and judgment additions.",
    steps: [
      "Open Twin / Personal Legal Twin from the desktop tabs or mobile bottom bar. If no profile is ready, choose Load Profile or refresh.",
      "Review the Twin Profile, learning status, agent affinities, preferred insight types, cross-matter links, work patterns, and any reduced-visibility categories.",
      "Use Pause or Resume to control whether new learning signals are recorded. Refresh profile or report when you need updated information.",
      "Open My Report / Win Pattern Report and choose Refresh Report to request an updated report when available. The report may show a narrative or fallback insights, and may require more matters.",
      "Use Open on a cross-matter connection only when you intend to switch the active workspace. Use Undo on a reduced-visibility category to reactivate its suggestion type.",
      "Use the profile’s reset control to clear learning data only after considering the consequences; the app asks for confirmation."
    ],
    example: "Pause learning before a sensitive preparation, then inspect the report to distinguish recurring workflow preferences from the legal merits of the current matter.",
    result: "The profile shows learning state and aggregate signals; cross-matter links can open other workspaces; the report shows a narrative or available fallback insights.",
    verify: "Confirm the Learning On / Paused indicator changes after your action; refresh and inspect the report timestamp or visible profile state.",
    mistakes: "Assuming a profile score measures advocacy quality; treating similarities across matters as precedent; or assuming Pause erases earlier signals.",
    caveat: "The interface describes learning as based on in-Forge signals rather than case text, but do not infer that this eliminates all data risk. Review product policy and professional confidentiality duties. Reset is distinct from demo reset."
  },
  {
    id: "files",
    title: "Case folder and files",
    group: "Files & outputs",
    summary: "Inspect generated matter files and download available documents.",
    purpose: "Keep generated preparation materials associated with the active workspace and retrieve them when needed.",
    when: "After agent analysis has generated a case folder, or when reviewing an existing matter’s generated files.",
    inputs: "An active workspace; analysis may create a folder and generate files such as a lawyer package, analysis report, vakalatnama, or invoice.",
    steps: [
      "Open the Files / sessions tab on desktop. On mobile, open Files from the bottom bar and select the matter.",
      "In the Case Folder area, choose the folder header to expand it. If no folder exists, the panel explains that agent analysis can auto-generate one.",
      "Review the file list and its document type and size. Choose the download control beside a file to download it.",
      "For PDF package or invoice creation, use the relevant Drafting-agent controls described in the Exports and fees lesson."
    ],
    example: "After analysis, expand the matter folder, download the analysis report, and compare it with the underlying record before circulating it.",
    result: "An existing folder expands to show files and download actions; an empty folder shows an empty-state message.",
    verify: "Confirm the downloaded filename and open the file locally; verify its matter identity, dates, citations, and version before use.",
    mistakes: "Assuming a folder exists before analysis; assuming the file count means the documents are final; or overlooking that this workspace view does not expose folder rename/delete or individual file-delete controls.",
    caveat: "The current workspace interface provides folder expand/list and file download controls. It does not expose manual folder create, rename, folder delete, or file delete controls here. Keep separate compliant records and do not treat a generated document as approved."
  },
  {
    id: "exports",
    title: "Export a PDF package and generate an invoice",
    group: "Files & outputs",
    summary: "Create a drafting package or invoice PDF from the Drafting agent.",
    purpose: "Download a working lawyer package and prepare an invoice document using entered client and fee details.",
    when: "After reviewing agent drafting and confirming that the active workspace and details are correct.",
    inputs: "Completed Drafting output and session; for an invoice, client name, lawyer name, firm/enrolment number, contact, amount, and payment mode.",
    steps: [
      "Open a completed Drafting Agent card. If necessary, run the five-agent analysis first.",
      "Choose PDF to download the lawyer package as an A4 PDF. Wait for export and check the downloaded document.",
      "Choose Invoice to open the invoice form. A fee suggestion may populate the amount; the amount is editable. If no amount appears, wait for the suggestion or enter the amount you have determined.",
      "Enter Client Name, Your Name, Firm / Enroll. No., Contact, and Amount (Rs.). Choose UPI, NEFT/RTGS, Cash, Cheque, or Bank Transfer as the Payment Mode.",
      "Choose Download Invoice PDF. Review the generated document and correct any fields before sending."
    ],
    example: "Generate the package for the reviewed matter; separately enter the agreed fee and correct client details in the invoice form before downloading.",
    result: "The browser downloads LitigaForge_Package.pdf or a client-named invoice PDF; invoice fields are supplied to the generated document.",
    verify: "Open each downloaded PDF and check party names, forum, citations, relief, amount, payment mode, firm details, and page breaks.",
    mistakes: "Using an AI fee suggestion as an agreed fee; relying on auto-filled drafting text; or assuming an export was successful without opening it.",
    caveat: "Fee suggestions are not a fee agreement, tax determination, or regulatory opinion. Confirm applicable professional-conduct, billing, tax, and client-disclosure requirements."
  },
  {
    id: "fees",
    title: "Review the fee suggestion",
    group: "Files & outputs",
    summary: "Understand where the suggested amount comes from before quoting.",
    purpose: "Offer a starting point for fee discussion through the Drafting agent and invoice form.",
    when: "When preparing a provisional estimate or invoice draft, never as a substitute for an engagement agreement.",
    inputs: "Matter description and case type context; the interface may request a suggestion when opening the invoice form if the amount is blank.",
    steps: [
      "Review the Drafting agent’s FEE RECOMMENDATION section if present.",
      "Open Invoice. If the amount is blank, the workspace requests a fee suggestion and may fill the Amount (Rs.) field.",
      "Compare the suggestion with your scope, complexity, forum, expected work, client agreement, and applicable rules.",
      "Edit the amount to the agreed figure before generating an invoice."
    ],
    example: "If a suggested amount appears, treat it as a prompt for review; enter the amount already agreed with the client rather than accepting it by default.",
    result: "A provisional suggested amount may appear in the invoice form; it remains editable.",
    verify: "Confirm the amount field matches the written engagement terms and the generated invoice before sending.",
    mistakes: "Assuming a recommendation is binding, market-validated, or inclusive of disbursements; leaving an automatically populated amount unreviewed.",
    caveat: "The suggestion is AI-generated and may be incomplete or unsuitable. The advocate alone determines and communicates fees in accordance with applicable rules and the client agreement."
  },
  {
    id: "mobile",
    title: "Use Forge on a phone or tablet",
    group: "Workspace & matter",
    summary: "Find the mobile sheets and understand what changes on smaller screens.",
    purpose: "Keep core workspace tasks reachable in a compact, touch-oriented layout.",
    when: "When the workspace is displayed at its mobile breakpoint.",
    inputs: "Touch or keyboard navigation; an open matter.",
    steps: [
      "Use the fixed bottom bar: Agents, Files, Search, Intel, Sim, and Twin each open a slide-up sheet. Select the active item again or use its close control to dismiss it.",
      "Use the toolbar’s workspace menu to open the Files/workspaces sheet. Select a matter card to switch workspaces.",
      "Use the quick-analyze toolbar control to run analysis. The mobile toolbar also keeps the matter title and Save control available.",
      "The desktop Add Node, Undo/Redo, Layout, Group/Ungroup, language toggle, and account controls are hidden on mobile. Use the empty-canvas guide or other available in-context actions for adding nodes; use a larger viewport for desktop-only canvas organization controls.",
      "Use touch gestures on the canvas to pan and zoom. Open tool panels from the bottom bar rather than expecting the desktop right-hand tabs."
    ],
    example: "On a phone, open Search from the bottom bar, run a manual query, inspect a result, then add it to the canvas; return to Agents through the same bar.",
    result: "The selected tool appears in a bottom-anchored sheet above the fixed tab bar; closing it returns focus to the canvas.",
    verify: "Check the sheet heading matches the selected tab and that the active matter title remains the intended one.",
    mistakes: "Looking for desktop tabs or Add Node in the mobile toolbar; forgetting the sheet overlays part of the canvas; or making precise graph edits on a cramped display.",
    caveat: "For careful citation review, detailed node editing, and broad canvas arrangement, use a device and viewport that allow the full source and graph to be inspected."
  }
];

const storyboard = [
  {
    title: "01 / Open with a matter",
    narration: "Begin by naming the preparation, then write a short description that separates verified facts from disputed points. One clear matter context gives every later tool a shared starting point.",
    action: "Create or open a workspace; inspect its title and case-description editor.",
    cue: "A matter title is visible in the toolbar and the description is ready for review."
  },
  {
    title: "02 / Give the record a shape",
    narration: "Build the canvas as a map, not a verdict. Facts and judgments inform issues; arguments answer issues; risks test them; strategies turn the analysis into next steps.",
    action: "Add one Fact and one Issue, then connect them with a labeled relationship.",
    cue: "A labeled edge makes the relationship explicit and the source remains distinguishable from the inference."
  },
  {
    title: "03 / Ask specialists, then wait",
    narration: "Run the five agents for distinct perspectives. Long analysis can stream in stages. Let each card reach its completed state before treating the text as a finished response.",
    action: "Run Agent Analysis; open a completed card and ask one narrow follow-up question.",
    cue: "Agent status changes to Done and the direct answer appears on its card."
  },
  {
    title: "04 / Search is a lead, not a conclusion",
    narration: "Search manually from a precise issue or let Smart Search derive queries from the case description and canvas. Inspect every candidate in its source before adding it to the argument map.",
    action: "Run a manual or smart search; open a result’s source and add a checked judgment to canvas.",
    cue: "The result is on the canvas and its actual source has been opened for verification."
  },
  {
    title: "05 / Pressure-test the theory",
    narration: "State one hypothetical assumption at a time. Compare before and after, note which node changes, and keep scenario scores separate from the live matter unless you intentionally apply them.",
    action: "Run a quick or custom simulation, inspect deltas, then save it or apply scores deliberately.",
    cue: "The assumption remains visible alongside the comparison and any saved run."
  },
  {
    title: "06 / Finish with control",
    narration: "Review proactive suggestions, control whether Legal Twin learning is on, and inspect generated files before use. Save the canvas and verify each export as a working draft.",
    action: "Refresh Intel; inspect Twin privacy controls; save; verify any downloaded PDF.",
    cue: "The workspace is saved, suggestions are considered, and generated materials have been checked."
  }
];

const printSteps = [
  "Create or open the correct workspace; confirm its title and prepare a concise, de-identified case description.",
  "Build a source-aware canvas with Fact, Judgment, Issue, Argument, Risk, and Strategy nodes as needed. Label connections; distinguish verified material from assumptions.",
  "Run the five specialist agents. Wait for completion; inspect reasoning and ask focused follow-up questions.",
  "Search manually or with Smart Search. Open source materials and verify every citation, holding, and quotation before adding a judgment to the canvas.",
  "Refresh proactive insights and review each suggestion. Test important assumptions in What-If Simulation; keep hypothetical scores separate unless intentionally applied.",
  "Review Legal Twin learning controls and any cross-matter patterns. These describe workflow signals, not the legal merits of a matter.",
  "Inspect the case folder and download available files. Use Drafting PDF / Invoice tools only after confirming matter and billing details.",
  "Save from the toolbar. Reopen the workspace and verify its title, case description, canvas, labels, and any exported document.",
  "Before external use, check confidentiality, client instructions, dates, forum, procedural rules, source authority, and the final document."
];

const css = `
  .lf-guide-root { --g-ink:#142c3a; --g-muted:#5b7075; --g-paper:#f5f3ec; --g-card:#fffefa; --g-line:#d6dfd9; --g-teal:#087e78; --g-teal-soft:#e4f1ec; --g-gold:#b98135; --g-warn:#9d4b39; color:var(--g-ink); font-family: Georgia, 'Times New Roman', serif; }
  .lf-guide-root * { box-sizing:border-box; }
  .lf-guide-root button, .lf-guide-root input { font:inherit; }
  .lf-guide-overlay { position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; background:rgba(8,20,27,.76); backdrop-filter:blur(5px); }
  .lf-guide-dialog { position:relative; display:flex; flex-direction:column; width:min(1160px,100%); max-height:min(92dvh,980px); overflow:hidden; background:var(--g-paper); border:1px solid #b9c9c1; border-radius:18px; box-shadow:0 28px 90px rgba(0,0,0,.34); }
  .lf-guide-top { padding:22px 28px 17px; border-bottom:1px solid var(--g-line); background:linear-gradient(135deg,#f5f3ec,#edf3ed); }
  .lf-guide-brand { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; }
  .lf-guide-kicker { margin:0 0 7px; color:var(--g-teal); font:700 10px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing:.16em; text-transform:uppercase; }
  .lf-guide-title { margin:0; color:var(--g-ink); font-size:clamp(25px,3vw,38px); line-height:1.06; letter-spacing:-.04em; font-weight:500; }
  .lf-guide-subtitle { max-width:760px; margin:9px 0 0; color:var(--g-muted); font:14px/1.55 system-ui, sans-serif; }
  .lf-guide-close { display:grid; place-items:center; flex:0 0 38px; width:38px; height:38px; border:1px solid var(--g-line); border-radius:11px; background:#fffefa; color:var(--g-ink); cursor:pointer; font:20px/1 system-ui,sans-serif; }
  .lf-guide-close:hover { background:var(--g-teal-soft); }
  .lf-guide-meta { display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin-top:17px; font:11px/1.4 system-ui,sans-serif; color:var(--g-muted); }
  .lf-guide-progress { display:flex; align-items:center; gap:9px; min-width:190px; }
  .lf-guide-progress-track { height:6px; width:110px; overflow:hidden; border-radius:9px; background:#dce5df; }
  .lf-guide-progress-fill { height:100%; border-radius:inherit; background:var(--g-teal); transition:width .2s ease; }
  .lf-guide-notice { padding:10px 28px; background:#fff6e7; border-bottom:1px solid #ead8b8; color:#624722; font:12px/1.5 system-ui,sans-serif; }
  .lf-guide-nav { display:flex; align-items:center; gap:7px; flex-wrap:wrap; padding:12px 24px; border-bottom:1px solid var(--g-line); background:#fbfaf5; }
  .lf-guide-tab { border:1px solid transparent; border-radius:9px; padding:8px 12px; background:transparent; color:var(--g-muted); cursor:pointer; font:700 12px/1.2 system-ui,sans-serif; }
  .lf-guide-tab[aria-selected=true] { color:var(--g-teal); background:var(--g-teal-soft); border-color:#bfdad0; }
  .lf-guide-tools { display:flex; gap:9px; align-items:center; margin-left:auto; }
  .lf-guide-search { width:min(235px,35vw); height:36px; padding:0 11px; border:1px solid var(--g-line); border-radius:9px; background:white; color:var(--g-ink); font:12px system-ui,sans-serif!important; }
  .lf-guide-action { min-height:36px; padding:8px 12px; border:1px solid #bfd0c8; border-radius:9px; background:#fffefa; color:var(--g-ink); cursor:pointer; font:700 11px/1.25 system-ui,sans-serif!important; }
  .lf-guide-action.primary { background:var(--g-teal); border-color:var(--g-teal); color:white; }
  .lf-guide-action.danger { color:#8a4035; border-color:#d9b8ae; background:#fff8f5; }
  .lf-guide-action:disabled { opacity:.5; cursor:wait; }
  .lf-guide-body { display:grid; grid-template-columns:244px minmax(0,1fr); min-height:0; flex:1; }
  .lf-guide-index { overflow:auto; padding:18px 13px 25px 18px; border-right:1px solid var(--g-line); background:#f0f0e9; }
  .lf-guide-index-heading { margin:0 0 12px; color:#6a7b79; font:700 9px/1.4 system-ui,sans-serif; letter-spacing:.14em; text-transform:uppercase; }
  .lf-guide-index-group { margin:15px 0 6px; color:#798780; font:700 9px/1.4 system-ui,sans-serif; letter-spacing:.1em; text-transform:uppercase; }
  .lf-guide-index-button { display:flex; align-items:flex-start; gap:8px; width:100%; padding:8px 9px; border:1px solid transparent; border-radius:8px; text-align:left; color:#3e555b; background:transparent; cursor:pointer; font:12px/1.35 system-ui,sans-serif; }
  .lf-guide-index-button[aria-current=true] { color:#075f5b; background:#e0eee8; border-color:#c3dcd1; }
  .lf-guide-check { display:inline-grid; flex:0 0 17px; width:17px; height:17px; place-items:center; border:1px solid #b8c7bf; border-radius:5px; color:#fff; font:700 10px system-ui,sans-serif; }
  .lf-guide-check.done { border-color:var(--g-teal); background:var(--g-teal); }
  .lf-guide-content { min-height:0; overflow:auto; padding:clamp(18px,3vw,34px); }
  .lf-guide-section-kicker { color:var(--g-teal); font:700 10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.14em; text-transform:uppercase; }
  .lf-guide-section-title { margin:8px 0 9px; font-size:clamp(24px,3vw,34px); line-height:1.1; font-weight:500; letter-spacing:-.035em; }
  .lf-guide-summary { max-width:720px; margin:0 0 20px; color:#516870; font:14px/1.6 system-ui,sans-serif; }
  .lf-guide-fields { display:grid; gap:11px; }
  .lf-guide-field { padding:13px 15px; border-left:2px solid #b8d7cc; background:rgba(255,255,255,.64); }
  .lf-guide-field h3 { margin:0 0 5px; color:#48625f; font:700 9px/1.4 system-ui,sans-serif; letter-spacing:.12em; text-transform:uppercase; }
  .lf-guide-field p, .lf-guide-field ol { margin:0; color:#344d55; font:13px/1.6 system-ui,sans-serif; }
  .lf-guide-field ol { padding-left:19px; }
  .lf-guide-field li { padding:0 0 5px 2px; }
  .lf-guide-field.example { border-color:#d5b274; background:#fcf8ef; }
  .lf-guide-field.caution { border-color:#cb8c7b; background:#fbf1ed; }
  .lf-guide-complete { display:flex; gap:10px; align-items:flex-start; margin-top:17px; padding:12px 14px; border:1px solid var(--g-line); border-radius:10px; background:#f9faf5; color:var(--g-muted); font:12px/1.5 system-ui,sans-serif; }
  .lf-guide-complete input { margin:3px 0 0; accent-color:var(--g-teal); width:16px; height:16px; }
  .lf-guide-bottom { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 24px; border-top:1px solid var(--g-line); background:#fbfaf5; }
  .lf-guide-bottom-note { color:#687b78; font:11px/1.4 system-ui,sans-serif; }
  .lf-guide-controls { display:flex; gap:8px; }
  .lf-guide-story { max-width:780px; margin:auto; min-height:100%; display:flex; flex-direction:column; justify-content:center; }
  .lf-guide-story-number { color:var(--g-teal); font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.13em; }
  .lf-guide-story h2 { margin:12px 0; font-size:clamp(32px,5vw,52px); line-height:1; font-weight:500; letter-spacing:-.05em; }
  .lf-guide-story-copy { max-width:680px; color:#4e646a; font-size:clamp(17px,2vw,21px); line-height:1.6; }
  .lf-guide-story-step { margin-top:25px; padding:17px 19px; border-left:3px solid var(--g-gold); background:#fcf8ef; font:13px/1.6 system-ui,sans-serif; color:#485a5c; }
  .lf-guide-story-cue { margin-top:11px; color:#47716c; font:12px/1.5 system-ui,sans-serif; }
  .lf-guide-story-controls { display:flex; justify-content:space-between; gap:12px; margin-top:26px; }
  .lf-guide-empty { padding:38px 20px; border:1px dashed #bdccc4; border-radius:12px; text-align:center; color:var(--g-muted); font:13px/1.6 system-ui,sans-serif; }
  .lf-guide-confirm-backdrop { position:absolute; inset:0; z-index:2; display:grid; place-items:center; padding:20px; background:rgba(10,24,30,.62); }
  .lf-guide-confirm { width:min(430px,100%); padding:23px; border:1px solid #d7c1b9; border-radius:14px; background:#fffefa; box-shadow:0 18px 50px rgba(0,0,0,.25); }
  .lf-guide-confirm h2 { margin:0 0 9px; font-size:23px; font-weight:500; }
  .lf-guide-confirm p { color:#53676b; font:13px/1.6 system-ui,sans-serif; }
  .lf-guide-confirm-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:18px; }
  .lf-guide-print { display:none; }
  @media (max-width:760px) {
    .lf-guide-overlay { padding:0; align-items:stretch; }
    .lf-guide-dialog { width:100%; max-height:100dvh; border-radius:0; }
    .lf-guide-top { padding:17px 17px 13px; }
    .lf-guide-nav { padding:9px 13px; }
    .lf-guide-tools { width:100%; margin:3px 0 0; }
    .lf-guide-search { width:100%; flex:1; }
    .lf-guide-body { grid-template-columns:1fr; grid-template-rows:auto minmax(0,1fr); }
    .lf-guide-index { display:flex; gap:6px; overflow-x:auto; overflow-y:hidden; padding:9px 12px; border-right:0; border-bottom:1px solid var(--g-line); }
    .lf-guide-index-heading, .lf-guide-index-group { display:none; }
    .lf-guide-index-button { flex:0 0 auto; width:auto; max-width:220px; align-items:center; padding:7px 9px; white-space:nowrap; }
    .lf-guide-index-button > span:last-child { overflow:hidden; text-overflow:ellipsis; }
    .lf-guide-check { flex-basis:16px; width:16px; height:16px; }
    .lf-guide-content { padding:20px 17px 27px; }
    .lf-guide-notice { padding:9px 17px; }
    .lf-guide-meta { margin-top:12px; }
    .lf-guide-bottom { padding:10px 13px; }
    .lf-guide-bottom-note { display:none; }
  }
  @media print {
    body * { visibility:hidden!important; }
    .lf-guide-root, .lf-guide-root * { visibility:visible!important; }
    .lf-guide-overlay { position:static!important; display:block!important; padding:0!important; background:white!important; backdrop-filter:none!important; }
    .lf-guide-dialog { display:block!important; width:100%!important; max-height:none!important; overflow:visible!important; border:0!important; border-radius:0!important; box-shadow:none!important; background:white!important; }
    .lf-guide-top { padding:0 0 12px!important; background:white!important; }
    .lf-guide-close, .lf-guide-nav, .lf-guide-body, .lf-guide-bottom, .lf-guide-notice, .lf-guide-confirm-backdrop { display:none!important; }
    .lf-guide-print { display:block!important; color:#152e37!important; font-family:Georgia,serif!important; }
    .lf-guide-print h1 { font-size:25pt; margin:4pt 0; }
    .lf-guide-print h2 { font-size:15pt; margin:14pt 0 5pt; page-break-after:avoid; }
    .lf-guide-print p, .lf-guide-print li { font:10pt/1.45 Arial,sans-serif; }
    .lf-guide-print ol { padding-left:20pt; }
    .lf-guide-print li { margin:0 0 5pt; }
    .lf-guide-print .print-warning { padding:8pt; border:1px solid #c7b98e; background:#fff8e8; }
    @page { margin:16mm; }
  }
`;

export default function WorkspaceOnboarding({
  open,
  onClose,
  userId,
  demoMode = false,
  onResetDemo,
}: WorkspaceOnboardingProps) {
  const storageKey = workspaceGuideStorageKey(userId);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [activeTab, setActiveTab] = useState<"guide" | "storyboard">("guide");
  const [activeLesson, setActiveLesson] = useState(lessons[0].id);
  const [query, setQuery] = useState("");
  const [slide, setSlide] = useState(0);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActiveTab("guide");
    setQuery("");
    setShowResetConfirmation(false);
    setResetError("");
    const restored = readWorkspaceGuideProgress(
      window.localStorage,
      userId,
      lessons.map(lesson => lesson.id),
    );
    setCompleted(restored);
    setLoadedKey(storageKey);
    const timer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("button, input, [tabindex='0']")?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, [open, storageKey]);

  useEffect(() => {
    if (!open || loadedKey !== storageKey || typeof window === "undefined") return;
    writeWorkspaceGuideProgress(window.localStorage, userId, completed);
  }, [completed, loadedKey, open, storageKey]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (showResetConfirmation) setShowResetConfirmation(false);
        else onClose();
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex='-1'])"
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, showResetConfirmation]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredLessons = useMemo(
    () => lessons.filter(lesson => !normalizedQuery || [
      lesson.title, lesson.group, lesson.summary, lesson.purpose, lesson.when,
      lesson.inputs, lesson.example, lesson.result, lesson.verify, lesson.mistakes,
      lesson.caveat, ...lesson.steps
    ].join(" ").toLowerCase().includes(normalizedQuery)),
    [normalizedQuery]
  );
  const currentLesson = lessons.find(lesson => lesson.id === activeLesson) ?? lessons[0];
  const progress = Math.round((completed.length / lessons.length) * 100);

  if (!open) return null;

  function chooseLesson(id: string) {
    setActiveLesson(id);
    setActiveTab("guide");
  }

  function toggleComplete(id: string) {
    setCompleted(value => value.includes(id) ? value.filter(item => item !== id) : [...value, id]);
  }

  async function resetDemo() {
    if (!onResetDemo) return;
    setResetBusy(true);
    setResetError("");
    try {
      await onResetDemo();
      setShowResetConfirmation(false);
    } catch {
      setResetError("The demo could not be reset. Your current demo data was left unchanged. Try again.");
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="lf-guide-root">
      <style>{css}</style>
      <div className="lf-guide-overlay" onMouseDown={event => {
        if (event.target === event.currentTarget && !showResetConfirmation) onClose();
      }}>
        <section
          ref={dialogRef}
          className="lf-guide-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lf-guide-title"
          aria-describedby="lf-guide-description"
          onMouseDown={event => event.stopPropagation()}
        >
          <header className="lf-guide-top">
            <div className="lf-guide-brand">
              <div>
                <p className="lf-guide-kicker">LitigaForge AI / Forge Workspace</p>
                <h1 id="lf-guide-title" className="lf-guide-title">A methodical start to case preparation.</h1>
                <p id="lf-guide-description" className="lf-guide-subtitle">
                  A practical guide to the canvas, research, specialist tools, and review controls. Use it as a searchable lesson book or walk through a narrated storyboard.
                </p>
              </div>
              <button className="lf-guide-close" type="button" onClick={onClose} aria-label="Close workspace guide" title="Close guide">×</button>
            </div>
            <div className="lf-guide-meta">
              <div className="lf-guide-progress" aria-label={`${completed.length} of ${lessons.length} lessons complete`}>
                <span>{completed.length} / {lessons.length} complete</span>
                <div className="lf-guide-progress-track" aria-hidden="true">
                  <div className="lf-guide-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <strong>{progress}%</strong>
              </div>
              <span>Progress is stored on this device for user {userId}.</span>
              <button className="lf-guide-action" type="button" onClick={() => window.print()}>Print quick-start</button>
              {demoMode && onResetDemo && (
                <button className="lf-guide-action danger" type="button" onClick={() => setShowResetConfirmation(true)}>Reset demo</button>
              )}
            </div>
          </header>

          {demoMode && (
            <div className="lf-guide-notice" role="note">
              Demo mode: any sample matter or case facts shown in the workspace are fictional and for product demonstration only. Indian Kanoon search is a real search action when available; search results are not represented as demo fixtures. Check all returned sources independently.
            </div>
          )}

          <nav className="lf-guide-nav" aria-label="Guide views">
            <button className="lf-guide-tab" type="button" role="tab" aria-selected={activeTab === "guide"} onClick={() => setActiveTab("guide")}>Lessons</button>
            <button className="lf-guide-tab" type="button" role="tab" aria-selected={activeTab === "storyboard"} onClick={() => setActiveTab("storyboard")}>Interactive walkthrough</button>
            <div className="lf-guide-tools">
              {activeTab === "guide" && (
                <input
                  className="lf-guide-search"
                  type="search"
                  aria-label="Search guide lessons"
                  placeholder="Search lessons and steps"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                />
              )}
            </div>
          </nav>

          {activeTab === "guide" ? (
            <div className="lf-guide-body" role="tabpanel" aria-label="Workspace lessons">
              <aside className="lf-guide-index" aria-label="Lesson index">
                <p className="lf-guide-index-heading">Quick-start lessons</p>
                {filteredLessons.length === 0 ? (
                  <p className="lf-guide-bottom-note">No lessons match that search.</p>
                ) : filteredLessons.map((lesson, index) => (
                  <div key={lesson.id}>
                    {(index === 0 || filteredLessons[index - 1].group !== lesson.group) && <div className="lf-guide-index-group">{lesson.group}</div>}
                    <button
                      type="button"
                      className="lf-guide-index-button"
                      aria-current={activeLesson === lesson.id ? "true" : undefined}
                      onClick={() => chooseLesson(lesson.id)}
                    >
                      <span className={`lf-guide-check${completed.includes(lesson.id) ? " done" : ""}`} aria-label={completed.includes(lesson.id) ? "Complete" : "Not complete"}>{completed.includes(lesson.id) ? "✓" : ""}</span>
                      <span>{lesson.title}</span>
                    </button>
                  </div>
                ))}
              </aside>
              <article className="lf-guide-content" aria-live="polite">
                {filteredLessons.some(lesson => lesson.id === currentLesson.id) ? (
                  <>
                    <div className="lf-guide-section-kicker">{currentLesson.group} / Field guide</div>
                    <h2 className="lf-guide-section-title">{currentLesson.title}</h2>
                    <p className="lf-guide-summary">{currentLesson.summary}</p>
                    <div className="lf-guide-fields">
                      <section className="lf-guide-field"><h3>Purpose</h3><p>{currentLesson.purpose}</p></section>
                      <section className="lf-guide-field"><h3>When to use it</h3><p>{currentLesson.when}</p></section>
                      <section className="lf-guide-field"><h3>Inputs</h3><p>{currentLesson.inputs}</p></section>
                      <section className="lf-guide-field"><h3>Exact steps</h3><ol>{currentLesson.steps.map((step, index) => <li key={index}>{step}</li>)}</ol></section>
                      <section className="lf-guide-field example"><h3>Concrete example</h3><p>{currentLesson.example}</p></section>
                      <section className="lf-guide-field"><h3>Expected result</h3><p>{currentLesson.result}</p></section>
                      <section className="lf-guide-field"><h3>How to verify</h3><p>{currentLesson.verify}</p></section>
                      <section className="lf-guide-field"><h3>Common mistakes</h3><p>{currentLesson.mistakes}</p></section>
                      <section className="lf-guide-field caution"><h3>Professional caveat</h3><p>{currentLesson.caveat}</p></section>
                    </div>
                    <label className="lf-guide-complete">
                      <input type="checkbox" checked={completed.includes(currentLesson.id)} onChange={() => toggleComplete(currentLesson.id)} />
                      <span><strong>Mark this lesson complete</strong><br />Your progress is saved locally under this account’s guide key.</span>
                    </label>
                  </>
                ) : (
                  <div className="lf-guide-empty" role="status">No lessons match “{query}”. Try “canvas”, “invoice”, “mobile”, or “citation”.</div>
                )}
              </article>
            </div>
          ) : (
            <div className="lf-guide-content" role="tabpanel" aria-label="Interactive narrated walkthrough">
              <article className="lf-guide-story" aria-live="polite">
                <div className="lf-guide-story-number">STORYBOARD / {String(slide + 1).padStart(2, "0")} OF {String(storyboard.length).padStart(2, "0")}</div>
                <h2>{storyboard[slide].title}</h2>
                <p className="lf-guide-story-copy">{storyboard[slide].narration}</p>
                <div className="lf-guide-story-step"><strong>Try this in Forge</strong><br />{storyboard[slide].action}</div>
                <p className="lf-guide-story-cue"><strong>Look for:</strong> {storyboard[slide].cue}</p>
                <p className="lf-guide-bottom-note">Narrated, interactive storyboard. This is not an MP4 recording; it describes actual workspace steps for you to perform.</p>
                <div className="lf-guide-story-controls">
                  <button className="lf-guide-action" type="button" onClick={() => setSlide(value => Math.max(0, value - 1))} disabled={slide === 0}>Previous slide</button>
                  {slide < storyboard.length - 1 ? (
                    <button className="lf-guide-action primary" type="button" onClick={() => setSlide(value => value + 1)}>Next slide</button>
                  ) : (
                    <button className="lf-guide-action primary" type="button" onClick={() => { setSlide(0); setActiveTab("guide"); }}>Return to lessons</button>
                  )}
                </div>
              </article>
            </div>
          )}

          <footer className="lf-guide-bottom">
            <span className="lf-guide-bottom-note">AI-generated output is analysis, not verified law. Check citations against authoritative sources.</span>
            <div className="lf-guide-controls">
              <button className="lf-guide-action" type="button" onClick={() => window.print()}>Print</button>
              <button className="lf-guide-action primary" type="button" onClick={onClose}>Return to workspace</button>
            </div>
          </footer>

          <section className="lf-guide-print" aria-label="Printable quick-start">
            <h1>Forge Workspace / Quick-start</h1>
            <p><strong>Purpose:</strong> a private, methodical case-preparation workspace. Use the canvas to map material and the specialist panels to support review.</p>
            {demoMode && <p className="print-warning"><strong>Demo notice:</strong> any sample matter or case facts shown in the workspace are fictional. Search results are not described as seeded or fictional; check each actual source.</p>}
            <ol>{printSteps.map((step, index) => <li key={index}>{step}</li>)}</ol>
            <h2>Control map</h2>
            <p><strong>Canvas:</strong> Judgment, Fact, Issue, Argument, Risk, Strategy; move/pan/zoom; edit/score; connect and label edges; undo/redo; layout; group/ungroup; save.</p>
            <p><strong>Panels:</strong> Research, Strategy, Risk &amp; Counter, Drafting, Predictive; manual / Smart Search; Proactive Intel; What-If Simulation; Legal Twin; Files.</p>
            <p><strong>Mobile:</strong> Agents, Files, Search, Intel, Sim, and Twin open slide-up sheets from the bottom bar. Several desktop toolbar controls (Add Node, Undo/Redo, Layout, Group/Ungroup) are hidden at the mobile breakpoint.</p>
            <h2>Professional review before use</h2>
            <p>AI-generated output is analysis, not verified law. Independently verify citations, quotations, holdings, procedural rules, facts, dates, forum, and deadlines against authoritative sources and the case record. Confirm confidentiality, client instructions, and all exported material before external use.</p>
            <p>Case folders can list and download generated files. The current workspace panel does not expose manual folder create, rename, folder delete, or file delete controls.</p>
          </section>

          {showResetConfirmation && (
            <div className="lf-guide-confirm-backdrop">
              <section className="lf-guide-confirm" role="alertdialog" aria-modal="true" aria-labelledby="lf-reset-title" aria-describedby="lf-reset-description">
                <h2 id="lf-reset-title">Reset the demo workspace?</h2>
                <p id="lf-reset-description">This calls the demo reset action supplied by the app. It may replace fictional demo matters and canvas content. This does not reset your Legal Twin or affect non-demo matters.</p>
                {resetError && <p role="alert" style={{ color: "#9d4b39" }}>{resetError}</p>}
                <div className="lf-guide-confirm-actions">
                  <button className="lf-guide-action" type="button" onClick={() => setShowResetConfirmation(false)} disabled={resetBusy}>Keep demo as-is</button>
                  <button className="lf-guide-action danger" type="button" onClick={() => void resetDemo()} disabled={resetBusy}>{resetBusy ? "Resetting…" : "Confirm reset"}</button>
                </div>
              </section>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
